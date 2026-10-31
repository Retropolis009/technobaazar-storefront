# TechnoBaazar

A responsive TypeScript storefront backed by a Node.js API. The API uses Express and Sequelize, and supports PostgreSQL for deployment plus SQLite for local development and tests. The existing SQL schema and catalog data are retained.

```
technobaazar-storefront/
├── backend/    # Express API, Sequelize models, migrations, seed scripts, media
└── frontend/   # React + Vite storefront
```

## Requirements

- Node.js 20.17+ (22 LTS recommended)
- npm
- Docker Compose v2 (recommended for local PostgreSQL; SQLite is also supported)

## Run locally

Terminal 1 — database and API:

```sh
docker compose up -d --wait postgres
cd backend
npm ci
cp .env.example .env       # fill in private values
npm run migrate
npm run create-admin       # uses ADMIN_EMAIL + ADMIN_PASSWORD from .env
npm run seed:catalog       # one-time; includes store defaults and starter catalog
npm start                  # API at http://localhost:5000/api
```

For SQLite, set `DATABASE_URL=sqlite:///store.db` in `backend/.env`. Run `npm run migrate` before using the API. To seed only store settings, categories, cities, and CMS defaults, run `npm run seed:store`. The optional `npm run seed:more` adds extra listings; `npm run verify:catalog` checks that all 57 starter listings remain present.

Terminal 2 — frontend:

```sh
cd frontend
npm ci
npm run dev                # store at http://localhost:5173 (proxies /api)
```

## Environment and deployment

`backend/.env.example` documents the supported environment variables. Set a unique `SESSION_SECRET` (the legacy `FLASK_SECRET_KEY` is also accepted for existing deployments), a PostgreSQL `DATABASE_URL`, `APP_ENV=production`, exact `FRONTEND_ORIGIN`, and `AUTO_CREATE_TABLES=false` for production. Set `TRUSTED_PROXY_HOPS` when requests pass through a TLS-terminating proxy. The API uses secure HttpOnly session cookies in production and enforces the configured request origin for state-changing routes. Admin sign-in uses the Node API; migrated Werkzeug password hashes remain supported.

- **One service:** run `npm run build` in `frontend/`, then start the API from `backend/`; if `frontend/dist/` exists, Express serves the storefront with an SPA fallback.
- **Split hosting:** deploy `frontend/dist/` as static assets and the Node API separately. Set `VITE_API_URL` at frontend build time and include the frontend origin in `FRONTEND_ORIGIN`.
- PostgreSQL is the recommended production database. SQLite remains available for local use and automated tests.

## Database migrations and data

- `npm run migrate` applies `backend/db/migrations/*.sql` to PostgreSQL, tracking applied files in `schema_migrations`. For SQLite, the Sequelize migration runner creates missing tables and adds missing columns in place to preserve existing records.
- These migrations retain the existing schema and data; no catalog replacement is performed.
- The starter catalog is one-time per database. `seed:catalog` refuses to overwrite an initialized catalog.

## Storefront and admin features

The existing API routes and frontend contracts are maintained, including guest/customer carts, checkout and idempotency, inventory reservations, coupons, customer accounts and order history, admin order management and CSV/XLSX exports, product SEO and galleries, category hierarchy and custom specification fields, media uploads, CMS draft/publish/history, delivery settings, robots.txt, and sitemap generation.

Open `/admin` and sign in with the configured administrator account. Create the first account using `npm run create-admin` after migrations.

## Validation

From `backend/`, run `npm test` and `npm audit`. From `frontend/`, run `npm run build` and `npm run lint`.
