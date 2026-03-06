from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class LoginInput(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"


class RefreshInput(BaseModel):
    refresh_token: str


class ProfileUpdateInput(BaseModel):
    nombre: Optional[str] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: str
    nombre: str
    email: str
    perfil: str
    created_at: datetime

    class Config:
        from_attributes = True
