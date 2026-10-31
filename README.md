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
- Docker Compose v2 (for the recommended local PostgreSQL setup)

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
- For the documented migration workflow, keep `AUTO_CREATE_TABLES=false` and
  run Alembic before startup. Set it to `true` only for quick throwaway
  prototypes that intentionally skip migrations; production should always use
  migrations with runtime table creation disabled.


### Local PostgreSQL (recommended)

Start a persistent local Postgres 16 database from the repository root:

```sh
docker compose up -d --wait postgres
cd backend
python -m venv .venv
.venv/bin/activate            # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env          # Windows: Copy-Item .env.example .env
```

The example `.env` points `DATABASE_URL` at the Compose database
(`postgresql+psycopg://technobaazar:technobaazar@localhost:5432/technobaazar`).
These credentials are for local development only. Then apply the full Alembic
migration chain, seed the 57 starter listings, and verify the configured DB:

```sh
flask --app app db upgrade
flask --app app create-admin    # needs ADMIN_EMAIL + ADMIN_PASSWORD in .env
flask --app app seed-catalog
flask --app app verify-catalog # must report 57/57 in postgresql database
flask --app app run --debug
```

The seeded catalog is intentionally one-time per database; `seed-catalog`
refuses to overwrite an already initialized catalog. To reset this disposable
local database and start over, run `docker compose down -v` and then repeat the
commands. Keep `DATABASE_URL` set in the backend environment to run the store
against Postgres. SQLite remains supported if you explicitly set
`DATABASE_URL=sqlite:///store.db`.

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
  when behind a TLS-terminating reverse proxy. Admin API and dashboard access
  reject plain HTTP in production, set secure HttpOnly session cookies, and
  require credentials again on each dashboard visit (no persistent browser
  token). `create-admin` rejects placeholder or shorter-than-12-character
  passwords. Localhost HTTP is allowed only for local development.

## Admin dashboard

Open `/admin` and sign in through the Flask API:

- **Overview** — catalog, order, revenue, and low-stock stats.
- **Products** — search, category filters, add/edit/delete, compare-at prices,
  stock tracking toggle, and per-product page content (eyebrow, subtitle,
  gallery, intro highlight, info notes).
- **Orders** — readable order cards with customer, delivery, items, totals, and
  fulfillment separated into clear sections; search and filters; status/payment
  updates; CSV export; and confirmed deletion (reserved stock is restored).
- **Sales tracker** — 7/30/90-day revenue, order counts, average order value,
  previous-period comparison, daily sales chart, and best sellers.
- **Images** — a dedicated media library to upload, preview, copy, and delete
  storefront images. New uploads live in `backend/images/` (or `UPLOAD_DIR`).
- **Landing content** — edit the announcement bar, hero, section headings,
  benefits, and checkout notes as a draft, then publish; revision history
  with restore.
- **Settings** — delivery fees, free-delivery threshold, low-stock alert,
  delivery cities, coupons, category visibility, and the media library
  (uploaded images are served from `/api/media/...`).
- **SEO** — site and page-level snippets, search-engine verification, analytics
  IDs, robots.txt, business JSON-LD details, social profiles, live snippet/card
  previews, and a searchable product SEO editor with completeness indicators.

## Customer checkout

Shoppers check out as guests or signed-in customers. Name, phone, email, delivery
address, selected Pakistan city, postal code, and payment method are required;
order notes and coupons remain optional. City-wise delivery fees, coupon-aware
totals, cash on delivery or manual bank transfer, and an idempotent order
confirmation are supported. Signed-in customers keep their bag, favorites, and
order history. Run `flask --app app seed-store` after deploying to populate new
and additional Pakistan delivery cities.

## Frontend scripts (run inside `frontend/`)

- `npm run dev` starts the local development server.
- `npm run build` type-checks the project and creates a production build in `dist/`.
- `npm run lint` checks the source with ESLint.
- `npm run preview` serves the production build locally.
