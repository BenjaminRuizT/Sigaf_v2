from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional

from app.database import get_db
from app.models.audit_model import Audit, AuditScan
from app.models.movement_model import Movement
from app.security.jwt_handler import get_current_user

router = APIRouter(tags=["logs"])


@router.get("/logs/classifications")
async def get_classification_logs(
    audit_id: Optional[str] = None, classification: Optional[str] = None,
    search: Optional[str] = None, page: int = 1, limit: int = 100,
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(AuditScan)
    if audit_id: q = q.where(AuditScan.audit_id == audit_id)
    if classification: q = q.where(AuditScan.classification == classification)
    if search:
        q = q.where(or_(AuditScan.codigo_barras.ilike(f"%{search}%")))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    items = (await db.scalars(q.order_by(AuditScan.scanned_at.desc()).offset((page-1)*limit).limit(limit))).all()
    return {"items": [s.to_dict() for s in items], "total": total, "page": page, "pages": max(1, -(-total // limit))}


@router.get("/logs/movements")
async def get_movement_logs(
    type: Optional[str] = None, search: Optional[str] = None,
    page: int = 1, limit: int = 100,
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(Movement)
    if type and type != "all":
        type_map = {"bajas": ["baja","disposal"], "altas": ["alta"], "transferencias": ["transfer"]}
        types = type_map.get(type, [type])
        q = q.where(Movement.type.in_(types))
    if search:
        q = q.where(or_(
            Movement.from_tienda.ilike(f"%{search}%"),
            Movement.to_tienda.ilike(f"%{search}%"),
            Movement.from_cr_tienda.ilike(f"%{search}%"),
            Movement.to_cr_tienda.ilike(f"%{search}%"),
        ))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    items = (await db.scalars(q.order_by(Movement.created_at.desc()).offset((page-1)*limit).limit(limit))).all()
    return {"items": [m.to_dict() for m in items], "total": total, "page": page, "pages": max(1, -(-total // limit))}


@router.get("/logs/audits")
async def get_audit_logs(
    status: Optional[str] = None, search: Optional[str] = None,
    page: int = 1, limit: int = 50,
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(Audit)
    if status: q = q.where(Audit.status == status)
    if search:
        q = q.where(or_(Audit.tienda.ilike(f"%{search}%"), Audit.cr_tienda.ilike(f"%{search}%")))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    items = (await db.scalars(q.order_by(Audit.started_at.desc()).offset((page-1)*limit).limit(limit))).all()
    return {"items": [a.to_dict() for a in items], "total": total, "page": page, "pages": max(1, -(-total // limit))}
