from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.services.auth_service import get_current_user
from app.models.equipment_model import Equipment, Store
from app.models.audit_model import Audit, AuditScan, Movement
from app.utils.pdf_generator import generate_user_manual, generate_presentation
from app.utils.excel_exporter import (
    build_classifications_excel, build_movements_excel, build_audits_excel
)
from app.services.audit_service import model_to_dict
from app.security.jwt_handler import decode_token

router = APIRouter(tags=["downloads"])


async def get_user_from_token_param(token: str, db: AsyncSession) -> dict:
    try:
        return decode_token(token, "access")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")


async def resolve_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    if authorization and authorization.startswith("Bearer "):
        return decode_token(authorization.split(" ")[1], "access")
    if token:
        return await get_user_from_token_param(token, db)
    raise HTTPException(status_code=401, detail="Not authenticated")


@router.get("/download/manual")
async def download_manual(user: dict = Depends(resolve_user), db: AsyncSession = Depends(get_db)):
    stats = await _get_stats(db)
    output = generate_user_manual(stats, [])
    return StreamingResponse(output, media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=SIGAF_Manual_de_Usuario.pdf"})


@router.get("/download/presentation")
async def download_presentation(user: dict = Depends(resolve_user), db: AsyncSession = Depends(get_db)):
    stats = await _get_stats(db)
    output = generate_presentation(stats, [])
    return StreamingResponse(output, media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=SIGAF_Presentacion.pdf"})


@router.get("/export/{export_type}")
async def export_excel(
    export_type: str,
    user: dict = Depends(resolve_user),
    db: AsyncSession = Depends(get_db),
    classification: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    plaza: Optional[str] = None,
):
    today = datetime.now().strftime("%Y-%m-%d")
    plaza_name = plaza or "General"

    if export_type == "classifications":
        q = select(AuditScan)
        filters = []
        if classification and classification != "all":
            from sqlalchemy import and_
            filters.append(AuditScan.classification == classification)
        if search:
            from sqlalchemy import or_
            filters.append(AuditScan.codigo_barras.ilike(f"%{search}%"))
        if filters:
            from sqlalchemy import and_
            q = q.where(and_(*filters))
        items = (await db.execute(q.order_by(AuditScan.scanned_at.desc()))).scalars().all()
        output = build_classifications_excel([model_to_dict(i) for i in items])
        filename = f"sigaf_classifications_{today}.xlsx"

    elif export_type in ("movements-ab", "movements-transferencias", "movements"):
        q = select(Movement)
        filters = []
        if export_type == "movements-ab":
            from sqlalchemy import or_
            filters.append(Movement.type.in_(["alta", "baja", "disposal"]))
        elif export_type == "movements-transferencias":
            filters.append(Movement.type == "transfer")
        elif type and type != "all":
            filters.append(Movement.type == type)
        if plaza and plaza != "all":
            filters.append(Movement.plaza == plaza)
        if filters:
            from sqlalchemy import and_
            q = q.where(and_(*filters))
        items = (await db.execute(q.order_by(Movement.created_at.desc()))).scalars().all()
        output = build_movements_excel([model_to_dict(m) for m in items], export_type, plaza_name)
        prefix_map = {"movements-ab": "AB", "movements-transferencias": "TRANSFERENCIAS", "movements": "MOVIMIENTOS"}
        filename = f"SIGAF_{prefix_map.get(export_type, 'MOVIMIENTOS')}_{plaza_name}_{today}.xlsx"

    elif export_type == "audits":
        q = select(Audit)
        filters = []
        if status and status != "all":
            filters.append(Audit.status == status)
        if search:
            from sqlalchemy import or_
            filters.append(or_(Audit.tienda.ilike(f"%{search}%"), Audit.cr_tienda.ilike(f"%{search}%")))
        if filters:
            from sqlalchemy import and_
            q = q.where(and_(*filters))
        items = (await db.execute(q.order_by(Audit.started_at.desc()))).scalars().all()
        output = build_audits_excel([model_to_dict(a) for a in items])
        filename = f"sigaf_audits_{today}.xlsx"
    else:
        raise HTTPException(status_code=400, detail="Invalid export type")

    return StreamingResponse(output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"})


async def _get_stats(db: AsyncSession) -> dict:
    try:
        total_stores = (await db.execute(select(func.count()).select_from(Store))).scalar()
        audited = (await db.execute(select(func.count()).select_from(Store).where(Store.audited == True))).scalar()
        total_eq = (await db.execute(select(func.count()).select_from(Equipment))).scalar()
        deprecated = (await db.execute(select(func.count()).select_from(Equipment).where(Equipment.depreciado == True))).scalar()
        val = (await db.execute(select(func.sum(Equipment.costo).label("c"), func.sum(Equipment.valor_real).label("r")).select_from(Equipment))).one()
        completed = (await db.execute(select(func.count()).select_from(Audit).where(Audit.status == "completed"))).scalar()
        plaza_rows = (await db.execute(select(Equipment.plaza, func.count().label("cnt")).group_by(Equipment.plaza))).all()
        return {
            "total_stores": total_stores, "audited_stores": audited,
            "total_equipment": total_eq, "deprecated_equipment": deprecated,
            "active_equipment": total_eq - deprecated,
            "total_cost": float(val.c or 0), "total_real_value": float(val.r or 0),
            "completed_audits": completed,
            "equipment_by_plaza": {r.plaza: r.cnt for r in plaza_rows if r.plaza},
        }
    except Exception:
        return {}
