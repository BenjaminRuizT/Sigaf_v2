from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_repository import UserRepository
from app.security.jwt_handler import create_access_token, create_refresh_token, decode_token
from app.security.password_hash import hash_password, verify_password
from app.database import get_db
from app.models.user_model import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials, expected_type="access")
    repo = UserRepository(db)
    user = await repo.get_by_id(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return payload


def require_role(*roles: str):
    async def dependency(current_user: dict = Depends(get_current_user)):
        if current_user["perfil"] not in roles:
            raise HTTPException(status_code=403, detail="Access denied")
        return current_user
    return dependency


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = UserRepository(db)

    async def login(self, email: str, password: str) -> dict:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
        if not user.is_active:
            raise HTTPException(status_code=401, detail="Cuenta desactivada")
        access_token = create_access_token(user.id, user.email, user.perfil, user.nombre)
        refresh_token = create_refresh_token(user.id)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "nombre": user.nombre,
                "email": user.email,
                "perfil": user.perfil,
                "created_at": user.created_at,
            },
        }

    async def refresh(self, refresh_token: str) -> dict:
        payload = decode_token(refresh_token, expected_type="refresh")
        user = await self.repo.get_by_id(payload["sub"])
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found")
        new_access = create_access_token(user.id, user.email, user.perfil, user.nombre)
        new_refresh = create_refresh_token(user.id)
        return {"access_token": new_access, "refresh_token": new_refresh, "token_type": "bearer"}

    async def get_me(self, user_id: str) -> User:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    async def update_profile(self, user_id: str, nombre: str = None, password: str = None) -> dict:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        updates = {}
        if nombre and nombre.strip():
            updates["nombre"] = nombre.strip()
        if password and password.strip():
            updates["password_hash"] = hash_password(password.strip())
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        updated = await self.repo.update(user, **updates)
        new_access = create_access_token(updated.id, updated.email, updated.perfil, updated.nombre)
        new_refresh = create_refresh_token(updated.id)
        return {
            "user": {"id": updated.id, "nombre": updated.nombre, "email": updated.email,
                     "perfil": updated.perfil, "created_at": updated.created_at},
            "access_token": new_access,
            "refresh_token": new_refresh,
        }
