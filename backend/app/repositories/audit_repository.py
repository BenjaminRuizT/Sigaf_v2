from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete
from typing import Optional
from app.models.audit_model import Audit, AuditScan
from app.models.movement_model import Movement
from app.models.equipment_model import Store


class AuditRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, audit_id: str) -> Optional[Audit]:
        result = await self.db.execute(select(Audit).where(Audit.id == audit_id))
        return result.scalar_one_or_none()

    async def get_active_for_store(self, cr_tienda: str) -> Optional[Audit]:
        result = await self.db.execute(
            select(Audit).where(and_(Audit.cr_tienda == cr_tienda, Audit.status == "in_progress"))
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> Audit:
        audit = Audit(**kwargs)
        self.db.add(audit)
        await self.db.flush()
        await self.db.refresh(audit)
        return audit

    async def update(self, audit: Audit, **kwargs) -> Audit:
        for key, value in kwargs.items():
            setattr(audit, key, value)
        await self.db.flush()
        await self.db.refresh(audit)
        return audit

    async def delete(self, audit: Audit) -> None:
        await self.db.delete(audit)
        await self.db.flush()

    async def list_logs(
        self, status: Optional[str] = None, search: Optional[str] = None,
        skip: int = 0, limit: int = 50
    ) -> tuple[list[Audit], int]:
        q = select(Audit)
        count_q = select(func.count()).select_from(Audit)
        filters = []
        if status:
            filters.append(Audit.status == status)
        if search:
            filters.append(or_(
                Audit.tienda.ilike(f"%{search}%"),
                Audit.cr_tienda.ilike(f"%{search}%"),
            ))
        if filters:
            q = q.where(and_(*filters))
            count_q = count_q.where(and_(*filters))
        total = (await self.db.execute(count_q)).scalar()
        items = (await self.db.execute(q.order_by(Audit.started_at.desc()).offset(skip).limit(limit))).scalars().all()
        return list(items), total

    # ---- Scans ----
    async def get_scan(self, scan_id: str, audit_id: str) -> Optional[AuditScan]:
        result = await self.db.execute(
            select(AuditScan).where(and_(AuditScan.id == scan_id, AuditScan.audit_id == audit_id))
        )
        return result.scalar_one_or_none()

    async def get_scan_by_barcode(self, audit_id: str, barcode: str) -> Optional[AuditScan]:
        result = await self.db.execute(
            select(AuditScan).where(and_(AuditScan.audit_id == audit_id, AuditScan.codigo_barras == barcode))
        )
        return result.scalar_one_or_none()

    async def create_scan(self, **kwargs) -> AuditScan:
        scan = AuditScan(**kwargs)
        self.db.add(scan)
        await self.db.flush()
        await self.db.refresh(scan)
        return scan

    async def delete_scan(self, scan: AuditScan) -> None:
        await self.db.delete(scan)
        await self.db.flush()

    async def get_all_scans(self, audit_id: str) -> list[AuditScan]:
        result = await self.db.execute(
            select(AuditScan).where(AuditScan.audit_id == audit_id).order_by(AuditScan.scanned_at.desc())
        )
        return list(result.scalars().all())

    async def list_scan_logs(
        self, audit_id: Optional[str] = None, classification: Optional[str] = None,
        search: Optional[str] = None, skip: int = 0, limit: int = 100
    ) -> tuple[list[AuditScan], int]:
        q = select(AuditScan)
        count_q = select(func.count()).select_from(AuditScan)
        filters = []
        if audit_id:
            filters.append(AuditScan.audit_id == audit_id)
        if classification:
            filters.append(AuditScan.classification == classification)
        if search:
            filters.append(or_(
                AuditScan.codigo_barras.ilike(f"%{search}%"),
            ))
        if filters:
            q = q.where(and_(*filters))
            count_q = count_q.where(and_(*filters))
        total = (await self.db.execute(count_q)).scalar()
        items = (await self.db.execute(q.order_by(AuditScan.scanned_at.desc()).offset(skip).limit(limit))).scalars().all()
        return list(items), total

    # ---- Movements ----
    async def create_movement(self, **kwargs) -> Movement:
        movement = Movement(**kwargs)
        self.db.add(movement)
        await self.db.flush()
        await self.db.refresh(movement)
        return movement

    async def get_movements(self, audit_id: str) -> list[Movement]:
        result = await self.db.execute(
            select(Movement).where(Movement.audit_id == audit_id)
        )
        return list(result.scalars().all())

    async def list_movement_logs(
        self, type_filter: Optional[str] = None, search: Optional[str] = None,
        plaza: Optional[str] = None, skip: int = 0, limit: int = 100
    ) -> tuple[list[Movement], int]:
        q = select(Movement)
        count_q = select(func.count()).select_from(Movement)
        filters = []
        if type_filter and type_filter != "all":
            if type_filter == "bajas":
                filters.append(Movement.type.in_(["baja", "disposal"]))
            elif type_filter == "altas":
                filters.append(Movement.type == "alta")
            elif type_filter == "transferencias":
                filters.append(Movement.type == "transfer")
            else:
                filters.append(Movement.type == type_filter)
        if plaza and plaza != "all":
            filters.append(Movement.plaza == plaza)
        if search:
            filters.append(or_(
                Movement.from_tienda.ilike(f"%{search}%"),
                Movement.to_tienda.ilike(f"%{search}%"),
                Movement.from_cr_tienda.ilike(f"%{search}%"),
                Movement.to_cr_tienda.ilike(f"%{search}%"),
            ))
        if filters:
            q = q.where(and_(*filters))
            count_q = count_q.where(and_(*filters))
        total = (await self.db.execute(count_q)).scalar()
        items = (await self.db.execute(q.order_by(Movement.created_at.desc()).offset(skip).limit(limit))).scalars().all()
        return list(items), total

    async def count_audits(self, **filters) -> int:
        q = select(func.count()).select_from(Audit)
        conditions = [getattr(Audit, k) == v for k, v in filters.items()]
        if conditions:
            q = q.where(and_(*conditions))
        result = await self.db.execute(q)
        return result.scalar()

    async def top_missing(self, plaza: Optional[str] = None, limit: int = 20) -> list[Audit]:
        q = select(Audit).where(
            Audit.status.in_(["completed"]), Audit.not_found_count > 0
        )
        if plaza and plaza != "all":
            q = q.where(Audit.plaza == plaza)
        result = await self.db.execute(q.order_by(Audit.not_found_count.desc()).limit(limit))
        return list(result.scalars().all())
