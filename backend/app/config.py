from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://sigaf:sigaf_pass@postgres:5432/sigaf"

    # JWT
    jwt_secret: str = "sigaf-super-secret-key-change-in-production-2024"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # CORS
    cors_origins_str: str = "http://localhost:3000"

    # App
    environment: str = "development"
    data_dir: str = "/app/data"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.cors_origins_str.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
