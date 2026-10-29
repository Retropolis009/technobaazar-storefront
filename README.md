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

## Local PostgreSQL

SQLite works out of the box, but the recommended local database is
PostgreSQL — same engine as production. No system install needed: the
helper uses embedded Postgres binaries (data in `~/pgdata`, outside the repo).

```sh
cd backend
pip install "pgserver==0.1.4"   # one time, inside your venv
python local_postgres.py start  # prints DATABASE_URL
```

Copy the printed `DATABASE_URL` into `backend/.env`, then run the usual
setup (`db upgrade`, `create-admin`, `seed-catalog`). Other commands:

```sh
python local_postgres.py status  # server + database health
python local_postgres.py stop    # stop the server (data is kept)
```

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
- **Landing content** — edit the announcement bar, hero, header/footer text,
  section headings, benefits, and checkout notes as a draft, then publish;
  revision history with restore. A live preview shows the homepage as you type.
- **SEO** — site title/description/keywords, canonical domain, social share
  image, Google/Bing verification, GA4/Tag Manager/Meta Pixel IDs, business
  info (JSON-LD), robots.txt, per-page titles, and per-product search settings
  with an SEO-health checklist. Live Google-snippet and link previews.
  Crawlers are served `/robots.txt` and an auto-generated `/sitemap.xml`.
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
