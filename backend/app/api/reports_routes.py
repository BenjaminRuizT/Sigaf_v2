"""
Dashboard stats and reports summary.
Uses proper SQLAlchemy cast(col, Integer) — NOT func.cast() which breaks on PostgreSQL.
FIXED: added plaza_audits, fixed movement_summary to include value, added stores_most/least missing.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Integer, Float
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
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Build optional filters
    pf_eq = (Equipment.plaza == plaza) if plaza and plaza != "all" else True
    pf_st = (Store.plaza == plaza)     if plaza and plaza != "all" else True
    pf_au = (Audit.plaza == plaza)     if plaza and plaza != "all" else True

    # --- Store stats (1 query) ---
    st = (await db.execute(
        select(
            func.count(Store.id).label("total"),
            func.sum(cast(Store.audited, Integer)).label("audited"),
        ).where(pf_st)
    )).one()

    # --- Equipment stats (1 query) ---
    eq = (await db.execute(
        select(
            func.count(Equipment.id).label("total"),
            func.sum(cast(Equipment.depreciado, Integer)).label("deprecated"),
            func.sum(Equipment.costo).label("total_cost"),
            func.sum(Equipment.valor_real).label("total_real"),
        ).where(pf_eq)
    )).one()

    # --- Audit stats (1 query using filter()) ---
    au = (await db.execute(
        select(
            func.count(Audit.id).filter(Audit.status == "completed").label("completed"),
            func.count(Audit.id).filter(Audit.status == "in_progress").label("active"),
        ).where(pf_au)
    )).one()

    # --- Equipment by plaza ---
    plaza_rows = (await db.execute(
        select(Equipment.plaza, func.count(Equipment.id).label("cnt"))
        .group_by(Equipment.plaza)
    )).all()

    # --- Top stores most missing (for dashboard) ---
    most_missing_rows = (await db.scalars(
        select(Audit)
        .where(Audit.status == "completed", Audit.not_found_count > 0)
        .order_by(Audit.not_found_count.desc())
        .limit(5)
    )).all()

    # --- Least missing stores (for dashboard) ---
    least_missing_rows = (await db.scalars(
        select(Audit)
        .where(Audit.status == "completed", Audit.not_found_count >= 0)
        .order_by(Audit.not_found_count.asc())
        .limit(5)
    )).all()

    total_stores   = int(st.total    or 0)
    audited_stores = int(st.audited  or 0)
    total_eq       = int(eq.total    or 0)
    dep_eq         = int(eq.deprecated or 0)

    return {
        "total_stores":         total_stores,
        "audited_stores":       audited_stores,
        "unaudited_stores":     total_stores - audited_stores,
        "total_equipment":      total_eq,
        "deprecated_equipment": dep_eq,
        "active_equipment":     total_eq - dep_eq,
        "total_cost":           round(float(eq.total_cost  or 0), 2),
        "total_real_value":     round(float(eq.total_real  or 0), 2),
        "active_audits":        int(au.active    or 0),
        "completed_audits":     int(au.completed or 0),
        "equipment_by_plaza":   {r.plaza: r.cnt for r in plaza_rows if r.plaza},
        "stores_most_missing":  [a.to_dict() for a in most_missing_rows],
        "stores_least_missing": [a.to_dict() for a in least_missing_rows],
    }


@router.get("/reports/summary")
async def get_reports_summary(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user["perfil"] not in ("Administrador", "Super Administrador"):
        raise HTTPException(403, "Access denied")

    # Plaza breakdown (equipment)
    plaza_rows = (await db.execute(
        select(
            Equipment.plaza,
            func.count(Equipment.id).label("count"),
            func.sum(Equipment.costo).label("total_cost"),
            func.sum(Equipment.valor_real).label("total_real"),
            func.sum(cast(Equipment.depreciado, Integer)).label("deprecated"),
        ).group_by(Equipment.plaza)
    )).all()

    # Acquisition year breakdown
    year_rows = (await db.execute(
        select(
            Equipment.anio_adquisicion,
            func.count(Equipment.id).label("count"),
            func.sum(Equipment.costo).label("cost"),
        )
        .group_by(Equipment.anio_adquisicion)
        .order_by(Equipment.anio_adquisicion)
    )).all()

    # Top stores with missing equipment
    top_missing = (await db.scalars(
        select(Audit)
        .where(Audit.status == "completed", Audit.not_found_count > 0)
        .order_by(Audit.not_found_count.desc())
        .limit(20)
    )).all()

    # Movement counts per type WITH value
    mov_rows = (await db.execute(
        select(
            Movement.type,
            func.count(Movement.id).label("count"),
        )
        .group_by(Movement.type)
    )).all()

    # Plaza audit breakdown (for plaza_audits table)
    plaza_audit_rows = (await db.execute(
        select(
            Audit.plaza,
            func.count(Audit.id).filter(Audit.status == "completed").label("completed"),
            func.count(Audit.id).filter(Audit.status.in_(["incompleto"])).label("incompleto"),
            func.sum(Audit.not_found_count).label("total_not_found"),
            func.sum(Audit.not_found_value).label("total_not_found_value"),
        )
        .where(Audit.status == "completed")
        .group_by(Audit.plaza)
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
        "top_missing_stores": [a.to_dict() for a in top_missing],
        "equipment_by_year": [
            {
                "year":  r.anio_adquisicion,
                "count": r.count,
                "cost":  round(float(r.cost or 0), 2),
            }
            for r in year_rows if r.anio_adquisicion
        ],
        "movement_summary": {
            r.type: {"count": r.count, "value": 0}
            for r in mov_rows if r.type
        },
        "plaza_audits": [
            {
                "plaza":                   r.plaza,
                "completed":               int(r.completed or 0),
                "incompleto":              int(r.incompleto or 0),
                "total_not_found":         int(r.total_not_found or 0),
                "total_not_found_value":   round(float(r.total_not_found_value or 0), 2),
            }
            for r in plaza_audit_rows if r.plaza
        ],
    }
