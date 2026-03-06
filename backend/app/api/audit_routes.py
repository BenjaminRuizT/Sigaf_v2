"""All audit-related endpoints, preserving full original functionality."""
import uuid, json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update as sql_update

from app.database import get_db
from app.models.audit_model import Audit, AuditScan
from app.models.movement_model import Movement
from app.models.equipment_model import Equipment, Store
from app.security.jwt_handler import get_current_user

router = APIRouter(tags=["audits"])


class AuditCreateInput(BaseModel):
    cr_tienda: str

class ScanInput(BaseModel):
    barcode: str

class AuditCancelInput(BaseModel):
    reason: str

class NotesInput(BaseModel):
    notes: str

class UnknownSurplusInput(BaseModel):
    codigo_barras: str; descripcion: str; marca: str; modelo: str
    no_activo: Optional[str] = ""; serie: Optional[str] = ""

class FinalizeInput(BaseModel):
    photo_ab_base64: Optional[str] = None
    photo_transfer_base64: Optional[str] = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/audits")
async def create_audit(body: AuditCreateInput, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    store = await db.scalar(select(Store).where(Store.cr_tienda == body.cr_tienda))
    if not store:
        raise HTTPException(404, "Store not found")
    existing = await db.scalar(select(Audit).where(Audit.cr_tienda == body.cr_tienda, Audit.status == "in_progress"))
    if existing:
        return existing.to_dict()
    audit = Audit(
        id=str(uuid.uuid4()), cr_tienda=body.cr_tienda, tienda=store.tienda,
        plaza=store.plaza, cr_plaza=store.cr_plaza,
        auditor_id=user["sub"], auditor_name=user["nombre"],
        total_equipment=store.total_equipment,
    )
    db.add(audit)
    await db.flush()
    return audit.to_dict()


@router.get("/audits/{audit_id}")
async def get_audit(audit_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    audit = await db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    return audit.to_dict()


@router.post("/audits/{audit_id}/scan")
async def scan_barcode(audit_id: str, body: ScanInput, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    barcode = body.barcode.strip().replace('\u202d','').replace('\u202c','')
    if not barcode:
        raise HTTPException(400, "Barcode required")

    audit = await db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    if audit.status != "in_progress":
        raise HTTPException(400, "Audit already completed")

    existing = await db.scalar(select(AuditScan).where(AuditScan.audit_id == audit_id, AuditScan.codigo_barras == barcode))
    if existing:
        return {"status": "already_scanned", "scan": existing.to_dict()}

    now = _now()

    # Equipment in same store?
    eq = await db.scalar(select(Equipment).where(Equipment.cr_tienda == audit.cr_tienda, Equipment.codigo_barras == barcode))
    if eq:
        scan = AuditScan(id=str(uuid.uuid4()), audit_id=audit_id, codigo_barras=barcode,
                         equipment_id=eq.id, classification="localizado",
                         equipment_data=json.dumps(eq.to_dict()), scanned_by=user["nombre"])
        db.add(scan)
        audit.located_count += 1
        await db.flush()
        return {"status": "localizado", "scan": scan.to_dict()}

    # Equipment in another store?
    other = await db.scalar(select(Equipment).where(Equipment.codigo_barras == barcode, Equipment.cr_tienda != audit.cr_tienda))
    if other:
        origin = {"cr_tienda": other.cr_tienda, "tienda": other.tienda, "plaza": other.plaza}
        scan = AuditScan(id=str(uuid.uuid4()), audit_id=audit_id, codigo_barras=barcode,
                         equipment_id=other.id, classification="sobrante",
                         equipment_data=json.dumps(other.to_dict()),
                         origin_store=json.dumps(origin), scanned_by=user["nombre"])
        db.add(scan)
        audit.surplus_count += 1
        await db.flush()
        return {"status": "sobrante", "scan": scan.to_dict()}

    # Unknown
    scan = AuditScan(id=str(uuid.uuid4()), audit_id=audit_id, codigo_barras=barcode,
                     equipment_id=None, classification="sobrante_desconocido",
                     equipment_data=None, scanned_by=user["nombre"])
    db.add(scan)
    audit.surplus_count += 1
    await db.flush()
    return {"status": "sobrante_desconocido", "scan": scan.to_dict()}


@router.get("/audits/{audit_id}/scans")
async def get_scans(audit_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    scans = (await db.scalars(select(AuditScan).where(AuditScan.audit_id == audit_id).order_by(AuditScan.scanned_at.desc()))).all()
    return [s.to_dict() for s in scans]


@router.post("/audits/{audit_id}/finalize")
async def finalize_audit(audit_id: str, body: Optional[FinalizeInput] = None, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    audit = await db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    if audit.status != "in_progress":
        raise HTTPException(400, "Audit already completed")

    now = _now()
    scans = (await db.scalars(select(AuditScan).where(AuditScan.audit_id == audit_id))).all()
    scanned_ids     = {s.equipment_id for s in scans if s.equipment_id}
    scanned_barcodes = {s.codigo_barras for s in scans}

    all_eq = (await db.scalars(select(Equipment).where(Equipment.cr_tienda == audit.cr_tienda))).all()
    not_found_items = []
    not_found_value = 0.0

    for eq in all_eq:
        if eq.id not in scanned_ids and eq.codigo_barras not in scanned_barcodes:
            not_found_items.append(eq)
            not_found_value += eq.valor_real or 0.0
            scan = AuditScan(id=str(uuid.uuid4()), audit_id=audit_id, codigo_barras=eq.codigo_barras,
                             equipment_id=eq.id, classification="no_localizado",
                             equipment_data=json.dumps(eq.to_dict()), scanned_by="system", scanned_at=now)
            db.add(scan)
            mov = Movement(id=str(uuid.uuid4()), audit_id=audit_id, equipment_id=eq.id,
                           type="baja", from_cr_tienda=audit.cr_tienda, to_cr_tienda=None,
                           from_tienda=audit.tienda, to_tienda=None, plaza=audit.plaza,
                           created_by=user["nombre"], created_by_id=user["sub"],
                           equipment_data=json.dumps(eq.to_dict()), auto_generated="true")
            db.add(mov)

    audit.status = "completed"
    audit.finished_at = now
    audit.not_found_count = len(not_found_items)
    audit.not_found_value = round(not_found_value, 2)
    if body:
        if body.photo_ab_base64: audit.photo_ab = body.photo_ab_base64
        if body.photo_transfer_base64: audit.photo_transf = body.photo_transfer_base64

    store = await db.scalar(select(Store).where(Store.cr_tienda == audit.cr_tienda))
    if store:
        store.audited = True
        store.last_audit_date = now
        store.last_audit_id = audit_id
        store.audit_status = "completed"

    await db.flush()
    all_scans = (await db.scalars(select(AuditScan).where(AuditScan.audit_id == audit_id))).all()
    movements = (await db.scalars(select(Movement).where(Movement.audit_id == audit_id))).all()

    return {
        "audit": audit.to_dict(),
        "summary": {
            "total_equipment": len(all_eq),
            "located": sum(1 for s in all_scans if s.classification == "localizado"),
            "surplus": sum(1 for s in all_scans if s.classification in ("sobrante","sobrante_desconocido")),
            "not_found": len(not_found_items), "not_found_value": round(not_found_value, 2),
            "not_found_deprecated": sum(1 for e in not_found_items if e.depreciado),
        },
        "scans": [s.to_dict() for s in all_scans],
        "not_found_items": [e.to_dict() for e in not_found_items],
        "movements": [m.to_dict() for m in movements],
    }


@router.post("/audits/{audit_id}/cancel")
async def cancel_audit(audit_id: str, body: AuditCancelInput, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not body.reason.strip():
        raise HTTPException(400, "Se requiere el motivo de cancelación")
    audit = await db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    if audit.status != "in_progress":
        raise HTTPException(400, "Solo se pueden cancelar auditorías en progreso")
    audit.status = "cancelada"
    audit.finished_at = _now()
    audit.cancel_reason = body.reason.strip()
    audit.cancelled_by = user["nombre"]
    store = await db.scalar(select(Store).where(Store.cr_tienda == audit.cr_tienda))
    if store:
        store.audited = False
        store.last_audit_id = None
        store.audit_status = None
    await db.flush()
    return {"message": "Auditoría cancelada", "cancel_reason": body.reason.strip()}


@router.post("/audits/{audit_id}/register-unknown-surplus")
async def register_unknown_surplus(audit_id: str, body: UnknownSurplusInput, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    audit = await db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Auditoría no encontrada")
    if audit.status != "in_progress":
        raise HTTPException(400, "Solo se puede registrar en auditorías activas")
    now = _now()
    new_eq = Equipment(
        id=str(uuid.uuid4()), cr_plaza=audit.cr_plaza, plaza=audit.plaza,
        cr_tienda=audit.cr_tienda, tienda=audit.tienda,
        codigo_barras=body.codigo_barras.strip(), no_activo=body.no_activo or "",
        descripcion=body.descripcion.strip(), marca=body.marca.strip(),
        modelo=body.modelo.strip(), serie=body.serie or "",
        costo=0.0, depreciacion=0.0, valor_real=0.0, depreciado=False,
        alta_manual=True, registered_at=now, registered_by=user["nombre"],
    )
    db.add(new_eq)
    await db.flush()
    scan = await db.scalar(select(AuditScan).where(
        AuditScan.audit_id == audit_id,
        AuditScan.codigo_barras == body.codigo_barras.strip(),
        AuditScan.classification == "sobrante_desconocido",
    ))
    if scan:
        scan.equipment_id = new_eq.id
        scan.equipment_data = json.dumps(new_eq.to_dict())
        scan.registered_manually = True
    mov = Movement(
        id=str(uuid.uuid4()), audit_id=audit_id, equipment_id=new_eq.id,
        type="alta", from_cr_tienda=None, to_cr_tienda=audit.cr_tienda,
        from_tienda=None, to_tienda=audit.tienda, plaza=audit.plaza,
        created_by=user["nombre"], created_by_id=user["sub"],
        equipment_data=json.dumps(new_eq.to_dict()),
    )
    db.add(mov)
    store = await db.scalar(select(Store).where(Store.cr_tienda == audit.cr_tienda))
    if store:
        store.total_equipment += 1
    await db.flush()
    return {"message": "Equipo registrado como ALTA", "equipment": new_eq.to_dict(), "movement": mov.to_dict()}


@router.put("/audits/{audit_id}/notes")
async def update_notes(audit_id: str, body: NotesInput, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    audit = await db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    audit.notes = body.notes
    await db.flush()
    return {"message": "Notes updated"}


@router.delete("/audits/{audit_id}/scans/{scan_id}")
async def delete_scan(audit_id: str, scan_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    audit = await db.get(Audit, audit_id)
    if not audit or audit.status != "in_progress":
        raise HTTPException(400, "Cannot delete scan")
    scan = await db.scalar(select(AuditScan).where(AuditScan.id == scan_id, AuditScan.audit_id == audit_id))
    if not scan:
        raise HTTPException(404, "Scan not found")
    if scan.classification == "localizado":
        audit.located_count = max(0, audit.located_count - 1)
    elif scan.classification in ("sobrante","sobrante_desconocido"):
        audit.surplus_count = max(0, audit.surplus_count - 1)
    await db.delete(scan)
    await db.flush()
    return {"message": "Scan deleted"}


@router.delete("/audits/{audit_id}")
async def delete_audit(audit_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user["perfil"] != "Super Administrador":
        raise HTTPException(403, "Access denied")
    audit = await db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    scans = (await db.scalars(select(AuditScan).where(AuditScan.audit_id == audit_id))).all()
    for s in scans:
        await db.delete(s)
    movs = (await db.scalars(select(Movement).where(Movement.audit_id == audit_id))).all()
    for m in movs:
        await db.delete(m)
    store = await db.scalar(select(Store).where(Store.cr_tienda == audit.cr_tienda))
    if store:
        store.audited = False; store.last_audit_date = None; store.last_audit_id = None; store.audit_status = None
    await db.delete(audit)
    await db.flush()
    return {"message": "Audit deleted", "cr_tienda": audit.cr_tienda}


@router.get("/audits/{audit_id}/summary")
async def get_audit_summary(audit_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    audit = await db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    scans = (await db.scalars(select(AuditScan).where(AuditScan.audit_id == audit_id))).all()
    movements = (await db.scalars(select(Movement).where(Movement.audit_id == audit_id))).all()
    located    = [s.to_dict() for s in scans if s.classification == "localizado"]
    surplus    = [s.to_dict() for s in scans if s.classification in ("sobrante","sobrante_desconocido")]
    not_found  = [s.to_dict() for s in scans if s.classification == "no_localizado"]
    nf_value   = sum((s.get("equipment_data") or {}).get("valor_real", 0) if isinstance(s.get("equipment_data"), dict) else 0 for s in not_found)
    return {
        "audit": audit.to_dict(), "located": located, "surplus": surplus,
        "not_found": not_found, "movements": [m.to_dict() for m in movements],
        "stats": {"total_equipment": audit.total_equipment, "located_count": len(located),
                  "surplus_count": len(surplus), "not_found_count": len(not_found),
                  "not_found_value": round(nf_value, 2),
                  "not_found_deprecated": sum(1 for s in not_found if (s.get("equipment_data") or {}).get("depreciado")),
                  "movements_count": len(movements)},
    }


@router.post("/audits/{audit_id}/photos")
async def upload_photos(audit_id: str,
                        photo_ab: Optional[UploadFile] = File(None),
                        photo_transf: Optional[UploadFile] = File(None),
                        user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    import base64
    audit = await db.get(Audit, audit_id)
    if not audit:
        raise HTTPException(404, "Audit not found")
    if photo_ab:
        audit.photo_ab = base64.b64encode(await photo_ab.read()).decode()
    if photo_transf:
        audit.photo_transf = base64.b64encode(await photo_transf.read()).decode()
    await db.flush()
    return {"message": "Photos saved"}
