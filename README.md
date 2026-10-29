# TechnoBaazar

A TypeScript storefront with a Flask + SQLAlchemy backend, modeled on the
Nutikals backend architecture: database-driven landing content with draft/publish
revisions, customizable product pages, server-side guest + customer carts,
coupon-aware checkout, order management, and media uploads.

```
technobaazar-storefront/
├── backend/    # Flask API, SQLAlchemy models, migrations, uploads
└── frontend/   # React + Vite storefront (same-origin API calls)
```

## Requirements

- Node.js 20.19+ or 22.12+ (frontend)
- Python 3.11+ (backend)

## Run locally

Terminal 1 — backend:

```sh
cd backend
python -m venv .venv
.venv/bin/activate            # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env          # Windows: Copy-Item .env.example .env
```

Set private values in `backend/.env`, then:

```sh
flask --app app db upgrade
flask --app app create-admin    # needs ADMIN_EMAIL + ADMIN_PASSWORD in .env
flask --app app seed-catalog
flask --app app run --debug     # API at http://localhost:5000/api
```

Terminal 2 — frontend:

```sh
cd frontend
npm install
npm run dev                   # store at http://localhost:5173 (proxies /api)
```

Notes:

- `seed-catalog` imports the starter products plus store defaults (delivery
  cities, settings, categories, landing content). `seed-store` refreshes just
  the store defaults and is safe to rerun.
- The app also creates missing tables and default rows at startup
  (Nutikals-style runtime ensures). In production, run migrations and set
  `AUTO_CREATE_TABLES=false`.

## Database migrations

Two equivalent tracks, kept in the same order:

- **Alembic** (app-managed): `backend/migrations/versions/*.py`,
  applied with `flask --app app db upgrade`.
- **Raw SQL** (Nutikals-style, for managed Postgres / hosting panels):
  `backend/db/migrations/*.sql`, applied with `psql` or
  `python sql_migrate.py` from `backend/`. See `backend/db/README.md`.

## Hosting

- **One service (simplest):** build the frontend, then serve everything from
  Flask — when `frontend/dist/` exists, the API also serves the storefront
  with an SPA fallback (no CORS needed):
  ```sh
  cd frontend && npm run build
  cd ../backend && gunicorn --bind 0.0.0.0:8000 app:app
  ```
- **Split hosting:** deploy `frontend/dist/` to any static host and the Flask
  app separately. Set `VITE_API_URL` at frontend build time
  (e.g. `VITE_API_URL=https://api.example.com`) and add the storefront origin
  to `FRONTEND_ORIGIN` in the backend (comma-separated list allowed).
- The frontend build uses **relative asset paths** and relative API URLs by
  default, so it works from any domain or sub-path without code changes.
- Production backend checklist: `APP_ENV=production`, PostgreSQL
  (`DATABASE_URL`), a unique random `FLASK_SECRET_KEY`, HTTPS everywhere,
  exact `FRONTEND_ORIGIN`, `AUTO_CREATE_TABLES=false`, and `TRUSTED_PROXY_HOPS`
  when behind a reverse proxy. Outside production, localhost and https sandbox
  preview origins are accepted for mutations to keep hosted previews testable.

## Admin dashboard

Open `/admin` and sign in through the Flask API:

- **Overview** — catalog, order, revenue, and low-stock stats.
- **Products** — search, category filters, add/edit/delete, compare-at prices,
  stock tracking toggle, and per-product page content (eyebrow, subtitle,
  gallery, intro highlight, info notes).
- **Orders** — search/filter, status + payment updates (cancelling restores
  stock), order details, and CSV export.
- **Landing content** — edit the announcement bar, hero, section headings,
  benefits, and checkout notes as a draft, then publish; revision history
  with restore.
- **Settings** — delivery fees, free-delivery threshold, low-stock alert,
  delivery cities, coupons, category visibility, and the media library
  (uploaded images are served from `/api/media/...`).

## Customer checkout

Shoppers check out as guests or signed-in customers: quantity steppers, coupon
codes, city-wise delivery fees with an optional free-delivery threshold, cash
on delivery or manual bank transfer, and an idempotent order confirmation
screen. Signed-in customers keep their bag, favorites, and order history.

## Frontend scripts (run inside `frontend/`)

- `npm run dev` starts the local development server.
- `npm run build` type-checks the project and creates a production build in `dist/`.
- `npm run lint` checks the source with ESLint.
- `npm run preview` serves the production build locally.
