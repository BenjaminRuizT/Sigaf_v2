from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from typing import Optional
from app.models.equipment_model import Equipment, Store


class EquipmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, eq_id: str) -> Optional[Equipment]:
        result = await self.db.execute(select(Equipment).where(Equipment.id == eq_id))
        return result.scalar_one_or_none()

    async def get_by_barcode(self, barcode: str) -> Optional[Equipment]:
        result = await self.db.execute(
            select(Equipment).where(Equipment.codigo_barras == barcode)
        )
        return result.scalar_one_or_none()

    async def get_by_barcode_and_store(self, barcode: str, cr_tienda: str) -> Optional[Equipment]:
        result = await self.db.execute(
            select(Equipment).where(
                and_(Equipment.codigo_barras == barcode, Equipment.cr_tienda == cr_tienda)
            )
        )
        return result.scalar_one_or_none()

    async def get_by_barcode_other_store(self, barcode: str, cr_tienda: str) -> Optional[Equipment]:
        result = await self.db.execute(
            select(Equipment).where(
                and_(Equipment.codigo_barras == barcode, Equipment.cr_tienda != cr_tienda)
            )
        )
        return result.scalar_one_or_none()

    async def get_store_equipment(
        self, cr_tienda: str, search: Optional[str] = None, skip: int = 0, limit: int = 100
    ) -> tuple[list[Equipment], int]:
        q = select(Equipment).where(Equipment.cr_tienda == cr_tienda)
        count_q = select(func.count()).select_from(Equipment).where(Equipment.cr_tienda == cr_tienda)
        if search:
            filt = or_(
                Equipment.codigo_barras.ilike(f"%{search}%"),
                Equipment.no_activo.ilike(f"%{search}%"),
                Equipment.descripcion.ilike(f"%{search}%"),
                Equipment.serie.ilike(f"%{search}%"),
            )
            q = q.where(filt)
            count_q = count_q.where(filt)
        total_result = await self.db.execute(count_q)
        total = total_result.scalar()
        items_result = await self.db.execute(q.offset(skip).limit(limit))
        return list(items_result.scalars().all()), total

    async def get_all_for_store(self, cr_tienda: str) -> list[Equipment]:
        result = await self.db.execute(
            select(Equipment).where(Equipment.cr_tienda == cr_tienda)
        )
        return list(result.scalars().all())

    async def list_admin(
        self, search: Optional[str] = None, plaza: Optional[str] = None, skip: int = 0, limit: int = 50
    ) -> tuple[list[Equipment], int]:
        q = select(Equipment)
        count_q = select(func.count()).select_from(Equipment)
        filters = []
        if plaza and plaza != "all":
            filters.append(Equipment.plaza == plaza)
        if search:
            filters.append(or_(
                Equipment.codigo_barras.ilike(f"%{search}%"),
                Equipment.no_activo.ilike(f"%{search}%"),
                Equipment.descripcion.ilike(f"%{search}%"),
                Equipment.serie.ilike(f"%{search}%"),
                Equipment.tienda.ilike(f"%{search}%"),
            ))
        if filters:
            q = q.where(and_(*filters))
            count_q = count_q.where(and_(*filters))
        total = (await self.db.execute(count_q)).scalar()
        items = (await self.db.execute(q.offset(skip).limit(limit))).scalars().all()
        return list(items), total

    async def bulk_insert(self, equipment_list: list[dict]) -> None:
        """Efficient bulk insert."""
        objects = [Equipment(**eq) for eq in equipment_list]
        self.db.add_all(objects)
        await self.db.flush()

    async def update(self, eq: Equipment, **kwargs) -> Equipment:
        for key, value in kwargs.items():
            setattr(eq, key, value)
        await self.db.flush()
        await self.db.refresh(eq)
        return eq

    async def count_by_filter(self, **filters) -> int:
        q = select(func.count()).select_from(Equipment)
        conditions = [getattr(Equipment, k) == v for k, v in filters.items()]
        if conditions:
            q = q.where(and_(*conditions))
        result = await self.db.execute(q)
        return result.scalar()

    async def aggregate_by_plaza(self) -> list[dict]:
        from sqlalchemy import text
        result = await self.db.execute(
            select(Equipment.plaza, func.count().label("count"),
                   func.sum(Equipment.costo).label("total_cost"),
                   func.sum(Equipment.valor_real).label("total_real"),
                   func.sum(func.cast(Equipment.depreciado, type_=int)).label("deprecated"))
            .group_by(Equipment.plaza)
        )
        return [dict(row._mapping) for row in result.all()]

    async def aggregate_by_year(self) -> list[dict]:
        result = await self.db.execute(
            select(Equipment.año_adquisicion.label("year"),
                   func.count().label("count"),
                   func.sum(Equipment.costo).label("cost"))
            .group_by(Equipment.año_adquisicion)
            .order_by(Equipment.año_adquisicion)
        )
        return [dict(row._mapping) for row in result.all()]

    async def value_totals(self, plaza: Optional[str] = None) -> dict:
        q = select(func.sum(Equipment.costo).label("total_cost"),
                   func.sum(Equipment.valor_real).label("total_real")).select_from(Equipment)
        if plaza and plaza != "all":
            q = q.where(Equipment.plaza == plaza)
        result = await self.db.execute(q)
        row = result.one()
        return {"total_cost": row.total_cost or 0, "total_real": row.total_real or 0}
