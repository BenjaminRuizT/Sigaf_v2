import json, uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.movement_model import Movement
from app.models.equipment_model import Equipment, Store
from app.security.jwt_handler import get_current_user

router = APIRouter(tags=["movements"])

class MovementInput(BaseModel):
    audit_id: str
    equipment_id: Optional[str] = None
    type: str
    from_cr_tienda: Optional[str] = None
    to_cr_tienda: Optional[str] = None
    extra_data: Optional[dict] = None


@router.post("/movements")
async def create_movement(body: MovementInput, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    eq_data = None
    if body.equipment_id:
        eq = await db.get(Equipment, body.equipment_id)
        if eq: eq_data = json.dumps(eq.to_dict())
    from_t = to_t = None
    if body.from_cr_tienda:
        s = await db.scalar(select(Store).where(Store.cr_tienda == body.from_cr_tienda))
        from_t = s.tienda if s else ""
    if body.to_cr_tienda:
        s = await db.scalar(select(Store).where(Store.cr_tienda == body.to_cr_tienda))
        to_t = s.tienda if s else ""
    mov = Movement(
        id=str(uuid.uuid4()), audit_id=body.audit_id, equipment_id=body.equipment_id,
        type=body.type, from_cr_tienda=body.from_cr_tienda, to_cr_tienda=body.to_cr_tienda,
        from_tienda=from_t, to_tienda=to_t,
        created_by=user["nombre"], created_by_id=user["sub"],
        equipment_data=eq_data,
    )
    db.add(mov)
    await db.flush()
    return mov.to_dict()


@router.get("/movements")
async def get_movements(
    audit_id: Optional[str] = None, type: Optional[str] = None,
    page: int = 1, limit: int = 50,
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(Movement)
    if audit_id: q = q.where(Movement.audit_id == audit_id)
    if type:     q = q.where(Movement.type == type)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    items = (await db.scalars(q.order_by(Movement.created_at.desc()).offset((page-1)*limit).limit(limit))).all()
    return {"movements": [m.to_dict() for m in items], "total": total, "page": page}
