from sqlalchemy import String, Float, Integer, Boolean, DateTime, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from typing import Optional
from app.database import Base

class Audit(Base):
    __tablename__ = "audits"
    __table_args__ = (
        Index("ix_audit_cr_tienda", "cr_tienda"),
        Index("ix_audit_status", "status"),
    )

    id:             Mapped[str]            = mapped_column(String, primary_key=True)
    cr_tienda:      Mapped[str]            = mapped_column(String(20))
    tienda:         Mapped[str]            = mapped_column(String(200))
    plaza:          Mapped[str]            = mapped_column(String(100), default="")
    cr_plaza:       Mapped[str]            = mapped_column(String(20), default="")
    auditor_id:     Mapped[str]            = mapped_column(String)
    auditor_name:   Mapped[str]            = mapped_column(String(120))
    started_at:     Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    finished_at:    Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status:         Mapped[str]            = mapped_column(String(30), default="in_progress")
    located_count:  Mapped[int]            = mapped_column(Integer, default=0)
    surplus_count:  Mapped[int]            = mapped_column(Integer, default=0)
    not_found_count: Mapped[int]           = mapped_column(Integer, default=0)
    not_found_value: Mapped[float]         = mapped_column(Float, default=0.0)
    total_equipment: Mapped[int]           = mapped_column(Integer, default=0)
    notes:          Mapped[str]            = mapped_column(Text, default="")
    cancel_reason:  Mapped[Optional[str]]  = mapped_column(String(500), nullable=True)
    cancelled_by:   Mapped[Optional[str]]  = mapped_column(String(120), nullable=True)
    photo_ab:       Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    photo_transf:   Mapped[Optional[str]]  = mapped_column(Text, nullable=True)

    def to_dict(self):
        d = {c.key: getattr(self, c.key) for c in self.__mapper__.columns}
        for k in ("started_at", "finished_at"):
            if isinstance(d.get(k), datetime):
                d[k] = d[k].isoformat()
        return d


class AuditScan(Base):
    __tablename__ = "audit_scans"
    __table_args__ = (
        Index("ix_scan_audit_id", "audit_id"),
        Index("ix_scan_barcode",  "codigo_barras"),
    )

    id:              Mapped[str]           = mapped_column(String, primary_key=True)
    audit_id:        Mapped[str]           = mapped_column(String, index=True)
    codigo_barras:   Mapped[str]           = mapped_column(String(60))
    equipment_id:    Mapped[Optional[str]] = mapped_column(String, nullable=True)
    classification:  Mapped[str]           = mapped_column(String(30))
    equipment_data:  Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # JSON
    origin_store:    Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # JSON
    scanned_at:      Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    scanned_by:      Mapped[str]           = mapped_column(String(120), default="")
    registered_manually: Mapped[bool]      = mapped_column(Boolean, default=False)

    def to_dict(self):
        import json
        d = {c.key: getattr(self, c.key) for c in self.__mapper__.columns}
        for k in ("scanned_at",):
            if isinstance(d.get(k), datetime):
                d[k] = d[k].isoformat()
        for k in ("equipment_data", "origin_store"):
            if d.get(k) and isinstance(d[k], str):
                try:
                    d[k] = json.loads(d[k])
                except Exception:
                    pass
        return d
