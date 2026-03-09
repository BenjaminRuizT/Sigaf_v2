from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from typing import Optional
import asyncio

from app.database import get_db
from app.models.equipment_model import Equipment, Store
from app.models.audit_model import Audit
from app.models.movement_model import Movement
from app.security.jwt_handler import get_current_user

router = APIRouter(tags=["reports"])


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    plaza: Optional[str] = None,
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    """Optimized: runs queries concurrently instead of sequentially."""
    plaza_filter_eq = (Equipment.plaza == plaza) if plaza and plaza != "all" else True
    plaza_filter_st = (Store.plaza == plaza)     if plaza and plaza != "all" else True
    plaza_filter_au = (Audit.plaza == plaza)     if plaza and plaza != "all" else True

    async def store_stats():
        row = (await db.execute(
            select(
                func.count(Store.id).label("total"),
                func.sum(func.cast(Store.audited, "integer")).label("audited"),
            ).where(plaza_filter_st)
        )).one()
        return int(row.total or 0), int(row.audited or 0)

    async def equipment_stats():
        row = (await db.execute(
            select(
                func.count(Equipment.id).label("total"),
                func.sum(func.cast(Equipment.depreciado, "integer")).label("deprecated"),
                func.sum(Equipment.costo).label("total_cost"),
                func.sum(Equipment.valor_real).label("total_real"),
            ).where(plaza_filter_eq)
        )).one()
        return (
            int(row.total or 0), int(row.deprecated or 0),
            float(row.total_cost or 0), float(row.total_real or 0),
        )

    async def audit_stats():
        row = (await db.execute(
            select(
                func.sum(func.cast(Audit.status == "completed",  "integer")).label("completed"),
                func.sum(func.cast(Audit.status == "in_progress","integer")).label("active"),
            ).where(plaza_filter_au)
        )).one()
        return int(row.completed or 0), int(row.active or 0)

    async def plaza_breakdown():
        rows = (await db.execute(
            select(Equipment.plaza, func.count(Equipment.id).label("cnt"))
            .group_by(Equipment.plaza)
        )).all()
        return {r.plaza: r.cnt for r in rows if r.plaza}

    (total_stores, audited_stores), (total_eq, dep_eq, total_cost, total_real), \
    (completed, active), by_plaza = await asyncio.gather(
        store_stats(), equipment_stats(), audit_stats(), plaza_breakdown()
    )

    return {
        "total_stores": total_stores,
        "audited_stores": audited_stores,
        "unaudited_stores": total_stores - audited_stores,
        "total_equipment": total_eq,
        "deprecated_equipment": dep_eq,
        "active_equipment": total_eq - dep_eq,
        "total_cost": round(total_cost, 2),
        "total_real_value": round(total_real, 2),
        "active_audits": active,
        "completed_audits": completed,
        "equipment_by_plaza": by_plaza,
    }


@router.get("/reports/summary")
async def get_reports_summary(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user["perfil"] not in ("Administrador", "Super Administrador"):
        raise HTTPException(403, "Access denied")

    async def plaza_data():
        rows = (await db.execute(
            select(
                Equipment.plaza,
                func.count(Equipment.id).label("count"),
                func.sum(Equipment.costo).label("total_cost"),
                func.sum(Equipment.valor_real).label("total_real"),
                func.sum(func.cast(Equipment.depreciado, "integer")).label("deprecated"),
            ).group_by(Equipment.plaza)
        )).all()
        return [
            {"plaza": r.plaza, "count": r.count,
             "total_cost": round(float(r.total_cost or 0), 2),
             "total_real": round(float(r.total_real or 0), 2),
             "deprecated": int(r.deprecated or 0)}
            for r in rows if r.plaza
        ]

    async def year_data():
        rows = (await db.execute(
            select(Equipment.anio_adquisicion,
                   func.count(Equipment.id).label("count"),
                   func.sum(Equipment.costo).label("cost"))
            .group_by(Equipment.anio_adquisicion)
            .order_by(Equipment.anio_adquisicion)
        )).all()
        return [{"year": r.anio_adquisicion, "count": r.count,
                 "cost": round(float(r.cost or 0), 2)} for r in rows if r.anio_adquisicion]

    async def top_missing():
        rows = (await db.scalars(
            select(Audit).where(Audit.status == "completed", Audit.not_found_count > 0)
            .order_by(Audit.not_found_count.desc()).limit(20)
        )).all()
        return [a.to_dict() for a in rows]

    async def movement_summary():
        rows = (await db.execute(
            select(Movement.type, func.count(Movement.id).label("count"))
            .group_by(Movement.type)
        )).all()
        return {r.type: {"count": r.count} for r in rows if r.type}

    plazas, years, missing, movements = await asyncio.gather(
        plaza_data(), year_data(), top_missing(), movement_summary()
    )

    return {
        "plaza_equipment": plazas,
        "top_missing_stores": missing,
        "equipment_by_year": years,
        "movement_summary": movements,
    }
