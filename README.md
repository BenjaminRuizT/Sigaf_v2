# SIGAF v2.0 — Sistema Integral de Gestión de Activo Fijo

Modernized architecture: **Next.js 15 + FastAPI + PostgreSQL**

---

## Architecture

```
┌─────────────────────────┐
│   Next.js 15 (App Router)│  :3000
│  Tailwind + Radix UI     │
│  JWT Auth (localStorage) │
│  Offline PWA / SW        │
└──────────┬──────────────┘
           │ REST (axios + interceptors)
┌──────────▼──────────────┐
│   FastAPI (modular)      │  :8000
│  SQLAlchemy async        │
│  Alembic migrations      │
│  bcrypt + JWT (15m/7d)   │
│  RBAC + rate limiting    │
└──────────┬──────────────┘
           │ asyncpg
┌──────────▼──────────────┐
│       PostgreSQL 16      │  :5432
└─────────────────────────┘
```

---

## Running Locally

### Prerequisites
- Docker & Docker Compose
- Node 22+  *(for frontend dev)*
- Python 3.12+  *(for backend dev)*

### 1. Clone / extract project

```bash
cp MAF.xlsx    sigaf_v2/data/
cp USUARIOS.xlsx sigaf_v2/data/
```

### 2. Start with Docker Compose

```bash
cd sigaf_v2
cp .env.example .env        # Edit JWT_SECRET
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend  → http://localhost:8000
- API Docs → http://localhost:8000/api/docs

### 3. Local dev (without Docker)

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # Set DATABASE_URL to local postgres
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

---

## Deploy to Railway

### Option A — Monorepo (recommended)

1. Push repo to GitHub.
2. In Railway → **New Project → Deploy from GitHub Repo**
3. Add three services: `postgres`, `backend`, `frontend`

**Postgres service**
- Use Railway's PostgreSQL plugin
- Copy `DATABASE_URL` (it starts with `postgresql://`, change to `postgresql+asyncpg://`)

**Backend service**
```
Root directory: backend
Build command:  pip install -r requirements.txt
Start command:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
Environment variables:
```
DATABASE_URL=postgresql+asyncpg://...  (from Railway Postgres)
JWT_SECRET=<long random string>
CORS_ORIGINS_STR=https://<your-frontend>.up.railway.app
DATA_DIR=/app/data
```
Add `/data/MAF.xlsx` and `/data/USUARIOS.xlsx` via Railway volume or by baking into the image.

**Frontend service**
```
Root directory: frontend
Build command:  npm install && npm run build
Start command:  npm start
```
Environment variables:
```
NEXT_PUBLIC_API_URL=https://<your-backend>.up.railway.app
```

### Option B — Docker (Railway)

Enable `Dockerfile` in each service instead.

---

## Roles & Permissions

| Role                 | Dashboard | Audit | Logs | Reports | Admin |
|----------------------|-----------|-------|------|---------|-------|
| Socio Tecnologico    | ✅        | ✅    | ✅   | ❌      | ❌    |
| Administrador        | ✅        | ✅    | ✅   | ✅      | ❌    |
| Super Administrador  | ✅        | ✅    | ✅   | ✅      | ✅    |

---

## Running Tests

**Backend**
```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest app/tests/ -v
```

**Frontend (Playwright)**
```bash
cd frontend
npm install
npx playwright install
npm test
```

---

## Migrations (Alembic)

```bash
cd backend
# Auto-generate after model changes
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

---

## Data Format

### MAF.xlsx columns (exact order)
`Cr Plaza | Plaza | Cr Tienda | Tienda | Codigo Barras | No Activo | Mes Adquisicion | Año Adquisicion | Factura | Costo | Depresiacion | Vida util | Remanente | Descripción | Marca | Modelo | Serie`

### USUARIOS.xlsx columns
`Perfil | Nombre | Email | Contraseña`

Valid perfiles: `Super Administrador`, `Administrador`, `Socio Tecnologico`

---

## Key Changes from v1

| v1 (old)                        | v2 (new)                             |
|---------------------------------|--------------------------------------|
| Create React App (deprecated)   | Next.js 15 App Router                |
| MongoDB / Motor                 | PostgreSQL 16 + SQLAlchemy async     |
| Monolithic server.py            | Modular FastAPI (routes/services)    |
| JWT 24h, no refresh             | Access 15min + Refresh 7d            |
| No RBAC factory                 | `require_role()` dependency          |
| No rate limiting                | slowapi on `/auth/login`             |
| Axios in CRA context            | Centralized `lib/api.ts` interceptors|
| No type safety                  | TypeScript throughout                |
| No tests                        | pytest + Playwright                  |
