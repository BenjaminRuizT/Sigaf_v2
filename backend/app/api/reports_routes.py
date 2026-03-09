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
    pf_eq = (Equipment.plaza == plaza) if plaza and plaza != "all" else True
    pf_st = (Store.plaza == plaza)     if plaza and plaza != "all" else True
    pf_au = (Audit.plaza == plaza)     if plaza and plaza != "all" else True

    # Store stats — single query
    st_row = (await db.execute(
        select(
            func.count(Store.id).label("total"),
            func.sum(func.cast(Store.audited, "integer")).label("audited"),
        ).where(pf_st)
    )).one()
    total_stores   = int(st_row.total  or 0)
    audited_stores = int(st_row.audited or 0)

    # Equipment stats — single query
    eq_row = (await db.execute(
        select(
            func.count(Equipment.id).label("total"),
            func.sum(func.cast(Equipment.depreciado, "integer")).label("deprecated"),
            func.sum(Equipment.costo).label("total_cost"),
            func.sum(Equipment.valor_real).label("total_real"),
        ).where(pf_eq)
    )).one()
    total_eq   = int(eq_row.total      or 0)
    dep_eq     = int(eq_row.deprecated or 0)
    total_cost = float(eq_row.total_cost or 0)
    total_real = float(eq_row.total_real or 0)

    # Audit stats — single query
    au_row = (await db.execute(
        select(
            func.sum(func.cast(Audit.status == "completed",   "integer")).label("completed"),
            func.sum(func.cast(Audit.status == "in_progress", "integer")).label("active"),
        ).where(pf_au)
    )).one()
    completed = int(au_row.completed or 0)
    active    = int(au_row.active    or 0)

    # Equipment by plaza
    plaza_rows = (await db.execute(
        select(Equipment.plaza, func.count(Equipment.id).label("cnt"))
        .group_by(Equipment.plaza)
    )).all()

    return {
        "total_stores":        total_stores,
        "audited_stores":      audited_stores,
        "unaudited_stores":    total_stores - audited_stores,
        "total_equipment":     total_eq,
        "deprecated_equipment": dep_eq,
        "active_equipment":    total_eq - dep_eq,
        "total_cost":          round(total_cost, 2),
        "total_real_value":    round(total_real, 2),
        "active_audits":       active,
        "completed_audits":    completed,
        "equipment_by_plaza":  {r.plaza: r.cnt for r in plaza_rows if r.plaza},
    }


@router.get("/reports/summary")
async def get_reports_summary(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user["perfil"] not in ("Administrador", "Super Administrador"):
        raise HTTPException(403, "Access denied")

    # Plaza breakdown
    plaza_rows = (await db.execute(
        select(
            Equipment.plaza,
            func.count(Equipment.id).label("count"),
            func.sum(Equipment.costo).label("total_cost"),
            func.sum(Equipment.valor_real).label("total_real"),
            func.sum(func.cast(Equipment.depreciado, "integer")).label("deprecated"),
        ).group_by(Equipment.plaza)
    )).all()

    # Year breakdown
    year_rows = (await db.execute(
        select(
            Equipment.anio_adquisicion,
            func.count(Equipment.id).label("count"),
            func.sum(Equipment.costo).label("cost"),
        )
        .group_by(Equipment.anio_adquisicion)
        .order_by(Equipment.anio_adquisicion)
    )).all()

    # Top missing
    top_missing = (await db.scalars(
        select(Audit)
        .where(Audit.status == "completed", Audit.not_found_count > 0)
        .order_by(Audit.not_found_count.desc())
        .limit(20)
    )).all()

    # Movement summary
    mov_rows = (await db.execute(
        select(Movement.type, func.count(Movement.id).label("count"))
        .group_by(Movement.type)
    )).all()

    return {
        "plaza_equipment": [
            {
                "plaza":      r.plaza,
                "count":      r.count,
                "total_cost": round(float(r.total_cost or 0), 2),
                "total_real": round(float(r.total_real or 0), 2),
                "deprecated": int(r.deprecated or 0),
            }
            for r in plaza_rows if r.plaza
        ],
        "top_missing_stores":  [a.to_dict() for a in top_missing],
        "equipment_by_year":   [
            {"year": r.anio_adquisicion, "count": r.count, "cost": round(float(r.cost or 0), 2)}
            for r in year_rows if r.anio_adquisicion
        ],
        "movement_summary": {r.type: {"count": r.count} for r in mov_rows if r.type},
    }
