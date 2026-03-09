# SIGAF v2 — Deployment Patch

## Files in this package

```
backend/app/
  main.py                     ← FIX 1: registers download_routes (PDF endpoints were broken)
  api/
    reports_routes.py         ← FIX 2: adds plaza_audits, fixes movement_summary

frontend/app/(protected)/
  audit/[id]/page.tsx         ← FULL REBUILD: camera photo, transfer dialog, unknown surplus,
                                  store inventory tab, completed summary tabs, disposal
  settings/page.tsx           ← FULL REBUILD: theme toggle, language, color palette, profile,
                                  show/hide password, app info section
  admin/page.tsx              ← FULL REBUILD: user CRUD dialogs, equipment edit, reset-data
                                  with drag-and-drop upload + template downloads
  reports/page.tsx            ← PATCH: adds plaza_audits table
```

## Deploy steps

```bash
# 1. Copy files into your sigaf_v2 repo
cp backend/app/main.py                   <your-repo>/backend/app/main.py
cp backend/app/api/reports_routes.py     <your-repo>/backend/app/api/reports_routes.py
cp "frontend/app/(protected)/audit/[id]/page.tsx"   <your-repo>/frontend/app/(protected)/audit/[id]/page.tsx
cp "frontend/app/(protected)/settings/page.tsx"     <your-repo>/frontend/app/(protected)/settings/page.tsx
cp "frontend/app/(protected)/admin/page.tsx"         <your-repo>/frontend/app/(protected)/admin/page.tsx
cp "frontend/app/(protected)/reports/page.tsx"       <your-repo>/frontend/app/(protected)/reports/page.tsx

# 2. Commit and push
cd <your-repo>
git add -A
git commit -m "fix: PDF endpoints, plaza_audits; rebuild audit/settings/admin pages"
git push origin main
```

Railway will auto-deploy on push.

## Fixes explained

### Fix 1 — PDF "Not authenticated" error
`download_routes` router was imported but never registered in `main.py`.
The route `/api/download/manual` simply didn't exist → FastAPI returned 404.
**Resolution**: Added `app.include_router(download_router, prefix=PREFIX)` to `main.py`.

### Fix 2 — Reports loading error (was transient race condition)
`reports_routes.py` already had the sequential query fix (no asyncio.gather).
This patch also adds:
- `plaza_audits` field in `/reports/summary` response
- `not_found_value` column assumed on `Audit` model (add if missing)

## New feature checklist

### Audit page
- [x] Camera photo capture (AB + Transferencias formats)
- [x] Store inventory tab with scan status indicators
- [x] Unknown surplus registration dialog (ALTA flow)
- [x] Transfer dialog for surplus from other stores
- [x] Disposal (BAJA) dialog from completed audit
- [x] Completed audit summary tabs: Summary / Not Found / Surplus
- [x] Offline queue with per-item removal
- [x] Real-time not-found counter during active audit

### Settings page
- [x] Theme toggle (light/dark)
- [x] Language selector (ES/EN)
- [x] Color palette selector (Professional / OXXO)
- [x] Profile update with show/hide password
- [x] App info section: features, movement types, user profiles, export docs

### Admin page
- [x] Users: sortable table, create/edit/delete dialogs
- [x] Equipment: search + plaza filter + pagination + edit dialog
- [x] Reset data: drag-and-drop upload, structure info, template downloads, RESET confirmation
- [x] Super Admin guard for destructive actions

### Reports page
- [x] plaza_audits table: Resultados de Auditorías por Plaza
