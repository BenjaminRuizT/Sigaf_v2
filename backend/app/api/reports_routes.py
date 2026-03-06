from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional

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
    eq_q = select(Equipment)
    st_q = select(Store)
    au_q = select(Audit)
    if plaza and plaza != "all":
        eq_q = eq_q.where(Equipment.plaza == plaza)
        st_q = st_q.where(Store.plaza == plaza)
        au_q = au_q.where(Audit.plaza == plaza)

    total_stores    = await db.scalar(select(func.count()).select_from(st_q.subquery()))
    audited_stores  = await db.scalar(select(func.count()).select_from(st_q.where(Store.audited == True).subquery()))
    total_equipment = await db.scalar(select(func.count()).select_from(eq_q.subquery()))
    deprecated_eq   = await db.scalar(select(func.count()).select_from(eq_q.where(Equipment.depreciado == True).subquery()))
    total_cost      = await db.scalar(select(func.sum(Equipment.costo)).select_from(eq_q.subquery())) or 0
    total_real      = await db.scalar(select(func.sum(Equipment.valor_real)).select_from(eq_q.subquery())) or 0
    completed       = await db.scalar(select(func.count()).select_from(au_q.where(Audit.status == "completed").subquery()))
    active          = await db.scalar(select(func.count()).select_from(au_q.where(Audit.status == "in_progress").subquery()))

    plaza_rows = (await db.execute(
        select(Equipment.plaza, func.count(Equipment.id).label("cnt")).group_by(Equipment.plaza)
    )).all()

    missing_rows = (await db.scalars(
        au_q.where(Audit.status == "completed").order_by(Audit.not_found_count.desc()).limit(5)
    )).all()
    least_rows = (await db.scalars(
        au_q.where(Audit.status == "completed", Audit.not_found_count >= 0).order_by(Audit.not_found_count.asc()).limit(5)
    )).all()

    return {
        "total_stores": total_stores, "audited_stores": audited_stores, "unaudited_stores": total_stores - audited_stores,
        "total_equipment": total_equipment, "deprecated_equipment": deprecated_eq, "active_equipment": total_equipment - deprecated_eq,
        "total_cost": round(total_cost, 2), "total_real_value": round(total_real, 2),
        "active_audits": active, "completed_audits": completed,
        "equipment_by_plaza": {r.plaza: r.cnt for r in plaza_rows if r.plaza},
        "stores_most_missing": [a.to_dict() for a in missing_rows],
        "stores_least_missing": [a.to_dict() for a in least_rows],
    }


@router.get("/reports/summary")
async def get_reports_summary(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user["perfil"] not in ("Administrador", "Super Administrador"):
        raise HTTPException(403, "Access denied")

    plaza_rows = (await db.execute(
        select(Equipment.plaza,
               func.count(Equipment.id).label("count"),
               func.sum(Equipment.costo).label("total_cost"),
               func.sum(Equipment.valor_real).label("total_real"),
               func.sum(func.cast(Equipment.depreciado, db.bind.dialect.name == "postgresql" and "int" or "integer")).label("deprecated"))
        .group_by(Equipment.plaza)
    )).all()

    year_rows = (await db.execute(
        select(Equipment.anio_adquisicion, func.count(Equipment.id).label("count"), func.sum(Equipment.costo).label("cost"))
        .group_by(Equipment.anio_adquisicion).order_by(Equipment.anio_adquisicion)
    )).all()

    top_missing = (await db.scalars(
        select(Audit).where(Audit.status == "completed", Audit.not_found_count > 0)
        .order_by(Audit.not_found_count.desc()).limit(20)
    )).all()

    mov_rows = (await db.execute(
        select(Movement.type, func.count(Movement.id).label("count")).group_by(Movement.type)
    )).all()

    return {
        "plaza_equipment": [{"plaza": r.plaza, "count": r.count, "total_cost": round(r.total_cost or 0, 2), "total_real": round(r.total_real or 0, 2), "deprecated": r.deprecated or 0} for r in plaza_rows if r.plaza],
        "top_missing_stores": [a.to_dict() for a in top_missing],
        "equipment_by_year": [{"year": r.anio_adquisicion, "count": r.count, "cost": round(r.cost or 0, 2)} for r in year_rows if r.anio_adquisicion],
        "movement_summary": {r.type: {"count": r.count} for r in mov_rows if r.type},
    }
