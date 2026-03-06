from sqlalchemy import String, Float, Integer, Boolean, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from typing import Optional
from app.database import Base

class Store(Base):
    __tablename__ = "stores"

    id:              Mapped[str]            = mapped_column(String, primary_key=True)
    cr_plaza:        Mapped[str]            = mapped_column(String(20), index=True)
    plaza:           Mapped[str]            = mapped_column(String(100), index=True)
    cr_tienda:       Mapped[str]            = mapped_column(String(20), unique=True, index=True)
    tienda:          Mapped[str]            = mapped_column(String(200))
    total_equipment: Mapped[int]            = mapped_column(Integer, default=0)
    audited:         Mapped[bool]           = mapped_column(Boolean, default=False, index=True)
    last_audit_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_audit_id:   Mapped[Optional[str]]  = mapped_column(String, nullable=True)
    audit_status:    Mapped[Optional[str]]  = mapped_column(String(30), nullable=True)

    def to_dict(self):
        d = {c.key: getattr(self, c.key) for c in self.__mapper__.columns}
        for k in ("last_audit_date",):
            if isinstance(d.get(k), datetime):
                d[k] = d[k].isoformat()
        return d

class Equipment(Base):
    __tablename__ = "equipment"
    __table_args__ = (
        Index("ix_equipment_barcode", "codigo_barras"),
        Index("ix_equipment_plaza",   "plaza"),
        Index("ix_equipment_tienda",  "cr_tienda"),
    )

    id:                  Mapped[str]           = mapped_column(String, primary_key=True)
    cr_plaza:            Mapped[str]           = mapped_column(String(20))
    plaza:               Mapped[str]           = mapped_column(String(100))
    cr_tienda:           Mapped[str]           = mapped_column(String(20))
    tienda:              Mapped[str]           = mapped_column(String(200))
    codigo_barras:       Mapped[str]           = mapped_column(String(60))
    no_activo:           Mapped[str]           = mapped_column(String(60), default="")
    mes_adquisicion:     Mapped[int]           = mapped_column(Integer, default=1)
    anio_adquisicion:    Mapped[int]           = mapped_column(Integer, default=2020)
    factura:             Mapped[str]           = mapped_column(String(60), default="")
    costo:               Mapped[float]         = mapped_column(Float, default=0.0)
    depreciacion:        Mapped[float]         = mapped_column(Float, default=0.0)
    vida_util:           Mapped[int]           = mapped_column(Integer, default=0)
    remanente:           Mapped[int]           = mapped_column(Integer, default=0)
    descripcion:         Mapped[str]           = mapped_column(String(200), default="")
    marca:               Mapped[str]           = mapped_column(String(100), default="")
    modelo:              Mapped[str]           = mapped_column(String(100), default="")
    serie:               Mapped[str]           = mapped_column(String(100), default="")
    meses_transcurridos: Mapped[int]           = mapped_column(Integer, default=0)
    vida_util_restante:  Mapped[int]           = mapped_column(Integer, default=0)
    valor_real:          Mapped[float]         = mapped_column(Float, default=0.0)
    depreciado:          Mapped[bool]          = mapped_column(Boolean, default=False, index=True)
    alta_manual:         Mapped[bool]          = mapped_column(Boolean, default=False)
    registered_at:       Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    registered_by:       Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    def to_dict(self):
        d = {c.key: getattr(self, c.key) for c in self.__mapper__.columns}
        for k in ("registered_at",):
            if isinstance(d.get(k), datetime):
                d[k] = d[k].isoformat()
        return d
