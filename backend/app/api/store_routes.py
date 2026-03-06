from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional

from app.database import get_db
from app.models.equipment_model import Store, Equipment
from app.security.jwt_handler import get_current_user

router = APIRouter(tags=["stores"])


@router.get("/stores")
async def get_stores(
    plaza: Optional[str] = None, search: Optional[str] = None,
    page: int = 1, limit: int = 50,
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(Store)
    if plaza and plaza != "all":
        q = q.where(Store.plaza == plaza)
    if search:
        q = q.where(or_(Store.cr_tienda.ilike(f"%{search}%"), Store.tienda.ilike(f"%{search}%")))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    items = (await db.scalars(q.order_by(Store.tienda).offset((page-1)*limit).limit(limit))).all()
    return {"stores": [s.to_dict() for s in items], "total": total, "page": page, "pages": max(1, -(-total // limit))}


@router.get("/stores/plazas")
async def get_plazas(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Store.cr_plaza, Store.plaza, func.count(Store.id).label("store_count"))
        .group_by(Store.cr_plaza, Store.plaza).order_by(Store.plaza)
    )).all()
    return [{"cr_plaza": r.cr_plaza, "plaza": r.plaza, "store_count": r.store_count} for r in rows]


@router.get("/stores/{cr_tienda}")
async def get_store(cr_tienda: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    store = await db.scalar(select(Store).where(Store.cr_tienda == cr_tienda))
    if not store:
        raise HTTPException(404, "Store not found")
    return store.to_dict()


@router.get("/stores/{cr_tienda}/equipment")
async def get_store_equipment(
    cr_tienda: str, search: Optional[str] = None, page: int = 1, limit: int = 100,
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    q = select(Equipment).where(Equipment.cr_tienda == cr_tienda)
    if search:
        q = q.where(or_(
            Equipment.codigo_barras.ilike(f"%{search}%"),
            Equipment.no_activo.ilike(f"%{search}%"),
            Equipment.descripcion.ilike(f"%{search}%"),
            Equipment.serie.ilike(f"%{search}%"),
        ))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    items = (await db.scalars(q.offset((page-1)*limit).limit(limit))).all()
    return {"equipment": [e.to_dict() for e in items], "total": total, "page": page, "pages": max(1, -(-total // limit))}
