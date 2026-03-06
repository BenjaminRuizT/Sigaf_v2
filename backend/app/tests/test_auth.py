"""Auth endpoint tests."""
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

@pytest.fixture
async def client():
    # Import app after env is set
    import os
    os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    os.environ.setdefault("JWT_SECRET", "test-secret")
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

@pytest.mark.asyncio
async def test_login_invalid(client):
    r = await client.post("/api/auth/login", json={"email": "nobody@x.com", "password": "wrong"})
    assert r.status_code == 401
