from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id:            Mapped[str]      = mapped_column(String, primary_key=True)
    nombre:        Mapped[str]      = mapped_column(String(120))
    email:         Mapped[str]      = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str]      = mapped_column(String(200))
    perfil:        Mapped[str]      = mapped_column(String(50), index=True)   # Super Administrador | Administrador | Socio Tecnologico
    is_backup:     Mapped[bool]     = mapped_column(Boolean, default=False)
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self, include_hash=False):
        d = {c.key: getattr(self, c.key) for c in self.__mapper__.columns}
        if not include_hash:
            d.pop("password_hash", None)
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()
        return d
