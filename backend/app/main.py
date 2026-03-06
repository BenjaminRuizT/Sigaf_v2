"""
SIGAF — Sistema Integral de Gestión de Activo Fijo
FastAPI Entry Point — Modular Architecture
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging

from app.config import settings
from app.database import init_db, import_initial_data
from app.api.auth_routes import router as auth_router
from app.api.audit_routes import router as audit_router
from app.api.equipment_routes import router as equipment_router
from app.api.reports_routes import router as reports_router
from app.api.admin_routes import router as admin_router
from app.api.store_routes import router as store_router
from app.api.movement_routes import router as movement_router
from app.api.log_routes import router as log_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s — %(name)s — %(levelname)s — %(message)s")
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 SIGAF starting up…")
    await init_db()
    await import_initial_data()
    yield
    logger.info("🛑 SIGAF shutting down…")

app = FastAPI(
    title="SIGAF API", description="Sistema Integral de Gestión de Activo Fijo",
    version="2.0.0", lifespan=lifespan,
    docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

PREFIX = "/api"
app.include_router(auth_router,      prefix=PREFIX)
app.include_router(audit_router,     prefix=PREFIX)
app.include_router(equipment_router, prefix=PREFIX)
app.include_router(reports_router,   prefix=PREFIX)
app.include_router(admin_router,     prefix=PREFIX)
app.include_router(store_router,     prefix=PREFIX)
app.include_router(movement_router,  prefix=PREFIX)
app.include_router(log_router,       prefix=PREFIX)

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
