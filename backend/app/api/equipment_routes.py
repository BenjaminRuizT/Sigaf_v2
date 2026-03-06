from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.database import get_db
from app.models.equipment_model import Equipment
from app.security.jwt_handler import get_current_user

router = APIRouter(tags=["equipment"])

class EquipmentUpdateInput(BaseModel):
    codigo_barras: Optional[str] = None
    no_activo: Optional[str] = None
    descripcion: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    serie: Optional[str] = None
    costo: Optional[float] = None
    depreciacion: Optional[float] = None


@router.get("/equipment")
async def list_equipment(
    search: Optional[str] = None, plaza: Optional[str] = None,
    page: int = 1, limit: int = 50,
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(Equipment)
    if plaza and plaza != "all": q = q.where(Equipment.plaza == plaza)
    if search:
        q = q.where(or_(
            Equipment.codigo_barras.ilike(f"%{search}%"),
            Equipment.no_activo.ilike(f"%{search}%"),
            Equipment.descripcion.ilike(f"%{search}%"),
            Equipment.serie.ilike(f"%{search}%"),
            Equipment.tienda.ilike(f"%{search}%"),
        ))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    items = (await db.scalars(q.offset((page-1)*limit).limit(limit))).all()
    return {"items": [e.to_dict() for e in items], "total": total, "page": page, "pages": max(1, -(-total // limit))}
