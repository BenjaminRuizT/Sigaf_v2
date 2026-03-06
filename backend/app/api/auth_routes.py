from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.user_model import User
from app.security.password_hash import verify_password, hash_password
from app.security.jwt_handler import create_access_token, create_refresh_token, decode_token, get_current_user

router = APIRouter(tags=["auth"])

class LoginInput(BaseModel):
    email: str
    password: str

class ProfileUpdateInput(BaseModel):
    nombre: Optional[str] = None
    password: Optional[str] = None

class RefreshInput(BaseModel):
    refresh_token: str


@router.post("/auth/login")
async def login(body: LoginInput, db: AsyncSession = Depends(get_db)):
    email = body.email.strip().lower()
    user = await db.scalar(select(User).where(User.email == email))
    if not user:
        user = await db.scalar(select(User).where(User.email == body.email.strip()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Credenciales inválidas")
    access  = create_access_token(user.id, user.email, user.perfil, user.nombre)
    refresh = create_refresh_token(user.id)
    return {"token": access, "refresh_token": refresh, "user": user.to_dict()}


@router.post("/auth/refresh")
async def refresh(body: RefreshInput, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid refresh token")
    user = await db.get(User, payload["sub"])
    if not user:
        raise HTTPException(401, "User not found")
    access = create_access_token(user.id, user.email, user.perfil, user.nombre)
    return {"token": access}


@router.get("/auth/me")
async def get_me(user_payload: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_payload["sub"])
    if not user:
        raise HTTPException(404, "User not found")
    return user.to_dict()


@router.put("/auth/profile")
async def update_profile(body: ProfileUpdateInput, user_payload: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_payload["sub"])
    if not user:
        raise HTTPException(404, "User not found")
    if body.nombre and body.nombre.strip():
        user.nombre = body.nombre.strip()
    if body.password and body.password.strip():
        user.password_hash = hash_password(body.password.strip())
    await db.flush()
    new_token = create_access_token(user.id, user.email, user.perfil, user.nombre)
    return {"user": user.to_dict(), "token": new_token}
