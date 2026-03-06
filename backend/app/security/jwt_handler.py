"""JWT access + refresh token handler."""
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from fastapi import HTTPException, Header, Cookie, Depends
from app.config import settings

ALGORITHM = settings.jwt_algorithm
SECRET    = settings.jwt_secret


def create_access_token(user_id: str, email: str, perfil: str, nombre: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": user_id, "email": email, "perfil": perfil, "nombre": nombre,
         "exp": expire, "type": "access"},
        SECRET, algorithm=ALGORITHM,
    )


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "refresh"}, SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(authorization.split(" ", 1)[1])
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid token type")
    return payload


def require_role(*roles: str):
    """Factory: returns a dependency that ensures the user has one of the given roles."""
    async def dep(user: dict = Depends(get_current_user)):
        if user.get("perfil") not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return dep

# Shorthand deps
require_admin        = require_role("Administrador", "Super Administrador")
require_super_admin  = require_role("Super Administrador")
