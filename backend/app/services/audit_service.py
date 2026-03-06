import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.audit_repository import AuditRepository
from app.repositories.equipment_repository import EquipmentRepository
from app.models.audit_model import Audit, AuditScan, Movement
from app.models.equipment_model import Equipment, Store
from sqlalchemy import select, and_


def model_to_dict(obj) -> dict:
    """Convert a SQLAlchemy model instance to dict."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit_repo = AuditRepository(db)
        self.eq_repo = EquipmentRepository(db)

    async def create_audit(self, cr_tienda: str, user: dict) -> dict:
        # Get store
        store_result = await self.db.execute(select(Store).where(Store.cr_tienda == cr_tienda))
        store = store_result.scalar_one_or_none()
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        # Return existing active audit if any
        existing = await self.audit_repo.get_active_for_store(cr_tienda)
        if existing:
            return model_to_dict(existing)
        audit = await self.audit_repo.create(
            id=str(uuid.uuid4()),
            cr_tienda=cr_tienda,
            tienda=store.tienda,
            plaza=store.plaza,
            cr_plaza=store.cr_plaza,
            auditor_id=user["sub"],
            auditor_name=user["nombre"],
            total_equipment=store.total_equipment,
        )
        return model_to_dict(audit)

    async def scan_barcode(self, audit_id: str, barcode: str, user: dict) -> dict:
        barcode = barcode.strip().replace('\u202d', '').replace('\u202c', '')
        if not barcode:
            raise HTTPException(status_code=400, detail="Barcode required")

        audit = await self.audit_repo.get_by_id(audit_id)
        if not audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if audit.status != "in_progress":
            raise HTTPException(status_code=400, detail="Audit already completed")

        # Already scanned?
        existing_scan = await self.audit_repo.get_scan_by_barcode(audit_id, barcode)
        if existing_scan:
            return {"status": "already_scanned", "scan": model_to_dict(existing_scan)}

        now = datetime.now(timezone.utc)
        cr_tienda = audit.cr_tienda

        # Check own store
        eq = await self.eq_repo.get_by_barcode_and_store(barcode, cr_tienda)
        if eq:
            scan = await self.audit_repo.create_scan(
                id=str(uuid.uuid4()), audit_id=audit_id,
                codigo_barras=barcode, equipment_id=eq.id,
                classification="localizado", equipment_data=model_to_dict(eq),
                scanned_at=now, scanned_by=user["nombre"],
            )
            audit.located_count += 1
            await self.db.flush()
            return {"status": "localizado", "scan": model_to_dict(scan)}

        # Check other stores
        other = await self.eq_repo.get_by_barcode_other_store(barcode, cr_tienda)
        if other:
            scan = await self.audit_repo.create_scan(
                id=str(uuid.uuid4()), audit_id=audit_id,
                codigo_barras=barcode, equipment_id=other.id,
                classification="sobrante", equipment_data=model_to_dict(other),
                origin_store={"cr_tienda": other.cr_tienda, "tienda": other.tienda, "plaza": other.plaza},
                scanned_at=now, scanned_by=user["nombre"],
            )
            audit.surplus_count += 1
            await self.db.flush()
            return {"status": "sobrante", "scan": model_to_dict(scan)}

        # Unknown
        scan = await self.audit_repo.create_scan(
            id=str(uuid.uuid4()), audit_id=audit_id,
            codigo_barras=barcode, equipment_id=None,
            classification="sobrante_desconocido", equipment_data=None,
            scanned_at=now, scanned_by=user["nombre"],
        )
        audit.surplus_count += 1
        await self.db.flush()
        return {"status": "sobrante_desconocido", "scan": model_to_dict(scan)}

    async def finalize_audit(self, audit_id: str, photo_ab: str = None, photo_transfer: str = None, user: dict = None) -> dict:
        audit = await self.audit_repo.get_by_id(audit_id)
        if not audit:
            raise HTTPException(status_code=404, detail="Audit not found")
        if audit.status != "in_progress":
            raise HTTPException(status_code=400, detail="Audit already completed")

        cr_tienda = audit.cr_tienda
        now = datetime.now(timezone.utc)

        scans = await self.audit_repo.get_all_scans(audit_id)
        scanned_ids = {s.equipment_id for s in scans if s.equipment_id}
        scanned_barcodes = {s.codigo_barras for s in scans}

        all_eq = await self.eq_repo.get_all_for_store(cr_tienda)

        not_found_items = []
        not_found_value = 0.0

        for eq in all_eq:
            if eq.id not in scanned_ids and eq.codigo_barras not in scanned_barcodes:
                eq_data = model_to_dict(eq)
                not_found_items.append(eq_data)
                not_found_value += eq.valor_real or 0
                await self.audit_repo.create_scan(
                    id=str(uuid.uuid4()), audit_id=audit_id,
                    codigo_barras=eq.codigo_barras, equipment_id=eq.id,
                    classification="no_localizado", equipment_data=eq_data,
                    scanned_at=now, scanned_by="system",
                )
                await self.audit_repo.create_movement(
                    id=str(uuid.uuid4()), audit_id=audit_id,
                    equipment_id=eq.id, type="baja",
                    from_cr_tienda=cr_tienda, to_cr_tienda=None,
                    from_tienda=audit.tienda, to_tienda=None,
                    plaza=audit.plaza or "",
                    created_at=now, created_by=user["nombre"],
                    created_by_id=user["sub"],
                    equipment_data=eq_data, auto_generated=True,
                )

        update_data = {
            "status": "completed",
            "finished_at": now,
            "not_found_count": len(not_found_items),
            "not_found_value": round(not_found_value, 2),
        }
        if photo_ab:
            update_data["photo_ab"] = photo_ab
        if photo_transfer:
            update_data["photo_transf"] = photo_transfer

        await self.audit_repo.update(audit, **update_data)

        # Update store
        store_result = await self.db.execute(select(Store).where(Store.cr_tienda == cr_tienda))
        store = store_result.scalar_one_or_none()
        if store:
            store.audited = True
            store.last_audit_date = now
            store.last_audit_id = audit_id
            store.audit_status = "completed"
            await self.db.flush()

        all_scans = await self.audit_repo.get_all_scans(audit_id)
        movements = await self.audit_repo.get_movements(audit_id)

        return {
            "audit": model_to_dict(audit),
            "summary": {
                "total_equipment": len(all_eq),
                "located": len([s for s in all_scans if s.classification == "localizado"]),
                "surplus": len([s for s in all_scans if s.classification in ("sobrante", "sobrante_desconocido")]),
                "not_found": len(not_found_items),
                "not_found_value": round(not_found_value, 2),
                "not_found_deprecated": len([e for e in not_found_items if e.get("depreciado")]),
            },
            "scans": [model_to_dict(s) for s in all_scans],
            "not_found_items": not_found_items,
            "movements": [model_to_dict(m) for m in movements],
        }

    async def cancel_audit(self, audit_id: str, reason: str, user: dict) -> dict:
        if not reason or not reason.strip():
            raise HTTPException(status_code=400, detail="Se requiere el motivo de cancelación")
        audit = await self.audit_repo.get_by_id(audit_id)
        if not audit:
            raise HTTPException(status_code=404, detail="Auditoría no encontrada")
        if audit.status != "in_progress":
            raise HTTPException(status_code=400, detail="Solo se pueden cancelar auditorías en progreso")

        now = datetime.now(timezone.utc)
        await self.audit_repo.update(audit,
            status="cancelada", finished_at=now,
            cancel_reason=reason.strip(), cancelled_by=user["nombre"], cancelled_at=now
        )
        store_result = await self.db.execute(select(Store).where(Store.cr_tienda == audit.cr_tienda))
        store = store_result.scalar_one_or_none()
        if store:
            store.audited = False
            store.last_audit_id = None
            store.audit_status = None
            await self.db.flush()

        return {"message": "Auditoría cancelada", "cancel_reason": reason.strip()}

    async def register_unknown_surplus(self, audit_id: str, data: dict, user: dict) -> dict:
        audit = await self.audit_repo.get_by_id(audit_id)
        if not audit:
            raise HTTPException(status_code=404, detail="Auditoría no encontrada")
        if audit.status != "in_progress":
            raise HTTPException(status_code=400, detail="Solo se puede registrar en auditorías activas")

        now = datetime.now(timezone.utc)
        cr_tienda = audit.cr_tienda

        new_eq = Equipment(
            id=str(uuid.uuid4()),
            cr_plaza=audit.cr_plaza or "",
            plaza=audit.plaza or "",
            cr_tienda=cr_tienda,
            tienda=audit.tienda,
            codigo_barras=data["codigo_barras"].strip(),
            no_activo=data.get("no_activo", ""),
            descripcion=data["descripcion"].strip(),
            marca=data["marca"].strip(),
            modelo=data["modelo"].strip(),
            serie=data.get("serie", ""),
            mes_adquisicion=datetime.now().month,
            año_adquisicion=datetime.now().year,
            costo=0.0, depreciacion=0.0, valor_real=0.0,
            alta_manual=True, registered_at=now, registered_by=user["nombre"],
        )
        self.db.add(new_eq)
        await self.db.flush()
        await self.db.refresh(new_eq)

        eq_data = model_to_dict(new_eq)

        # Update the sobrante_desconocido scan
        scan = await self.audit_repo.get_scan_by_barcode(audit_id, data["codigo_barras"].strip())
        if scan and scan.classification == "sobrante_desconocido":
            scan.equipment_id = new_eq.id
            scan.equipment_data = eq_data
            scan.registered_manually = True
            await self.db.flush()

        movement = await self.audit_repo.create_movement(
            id=str(uuid.uuid4()), audit_id=audit_id,
            equipment_id=new_eq.id, type="alta",
            from_cr_tienda=None, to_cr_tienda=cr_tienda,
            from_tienda=None, to_tienda=audit.tienda,
            plaza=audit.plaza or "",
            created_at=now, created_by=user["nombre"], created_by_id=user["sub"],
            equipment_data=eq_data,
        )

        # Update store equipment count
        store_result = await self.db.execute(select(Store).where(Store.cr_tienda == cr_tienda))
        store = store_result.scalar_one_or_none()
        if store:
            store.total_equipment += 1
            await self.db.flush()

        return {
            "message": "Equipo registrado como ALTA",
            "equipment": eq_data,
            "movement": model_to_dict(movement),
        }
