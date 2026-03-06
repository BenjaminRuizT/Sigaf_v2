from sqlalchemy import String, Float, DateTime, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from typing import Optional
from app.database import Base

class Movement(Base):
    __tablename__ = "movements"
    __table_args__ = (
        Index("ix_movement_audit_id", "audit_id"),
        Index("ix_movement_type",     "type"),
    )

    id:              Mapped[str]           = mapped_column(String, primary_key=True)
    audit_id:        Mapped[str]           = mapped_column(String, index=True)
    equipment_id:    Mapped[Optional[str]] = mapped_column(String, nullable=True)
    type:            Mapped[str]           = mapped_column(String(30))          # alta | baja | transfer | disposal
    from_cr_tienda:  Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    to_cr_tienda:    Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    from_tienda:     Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    to_tienda:       Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    plaza:           Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status:          Mapped[str]           = mapped_column(String(20), default="pending")
    created_at:      Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by:      Mapped[str]           = mapped_column(String(120), default="")
    created_by_id:   Mapped[str]           = mapped_column(String, default="")
    equipment_data:  Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    auto_generated:  Mapped[bool]          = mapped_column(String(5), default="false")

    def to_dict(self):
        import json
        d = {c.key: getattr(self, c.key) for c in self.__mapper__.columns}
        for k in ("created_at",):
            if isinstance(d.get(k), datetime):
                d[k] = d[k].isoformat()
        for k in ("equipment_data",):
            if d.get(k) and isinstance(d[k], str):
                try:
                    d[k] = json.loads(d[k])
                except Exception:
                    pass
        return d
