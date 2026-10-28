# TechnoBaazar

A React + TypeScript storefront (Vite) with a Flask + SQLAlchemy backend, modeled on the
Nutikals backend architecture: database-driven landing content with draft/publish revisions,
customizable product pages, server-side guest + customer carts, coupon-aware COD checkout,
order management, and media uploads.

## Requirements

- Node.js 20.19+ or 22.12+
- npm (included with Node.js)
- Python 3.11+ (for the backend)

## Get started

```sh
npm install
npm run dev
```

The dev server proxies `/api` to the Flask backend at `http://localhost:5000`.

## Flask API

The `backend` folder contains the Flask API: SQLAlchemy models, Alembic migrations,
cookie-based admin/customer sessions, product CRUD, a landing-page CMS, guest carts,
checkout with coupons + city-wise delivery fees, order management, and image uploads.

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set private values in `backend/.env`, then initialize and run:

```powershell
flask --app app db upgrade
flask --app app create-admin
flask --app app seed-catalog
flask --app app run --debug
```

Notes:

- `ADMIN_EMAIL` / `ADMIN_PASSWORD` must be set in your ignored local `.env` before
  `create-admin`; the example file contains placeholders, not a usable account.
- `seed-catalog` imports the starter products plus store defaults (delivery cities,
  settings, categories, landing content). `seed-store` refreshes just the store
  defaults and is safe to rerun.
- The app also creates missing tables and default rows at startup (Nutikals-style
  runtime ensures). In production, run migrations and set `AUTO_CREATE_TABLES=false`.
- For production, set `APP_ENV=production`, use PostgreSQL and a unique random
  `FLASK_SECRET_KEY`, serve everything over HTTPS, set `FRONTEND_ORIGIN` to the exact
  storefront origin, and configure `TRUSTED_PROXY_HOPS` behind a reverse proxy.

## Admin dashboard

Open `/admin` and sign in through the Flask API:

- **Overview** — catalog, order, revenue, and low-stock stats.
- **Products** — search, category filters, add/edit/delete, compare-at prices,
  stock tracking toggle, and per-product page content (eyebrow, subtitle, gallery,
  intro highlight, info notes).
- **Orders** — search/filter, status + payment updates (cancelling restores stock),
  order details, and CSV export.
- **Landing content** — edit the announcement bar, hero, section headings, benefits,
  and checkout notes as a draft, then publish; revision history with restore.
- **Settings** — delivery fees, free-delivery threshold, low-stock alert, delivery
  cities, coupons, category visibility, and the media library (uploaded images are
  served from `/api/media/...` and can be used in hero, gallery, or product fields).

## Customer checkout

Shoppers check out as guests or signed-in customers: quantity steppers, coupon codes,
city-wise delivery fees with an optional free-delivery threshold, cash on delivery or
manual bank transfer, and an idempotent order confirmation screen. Signed-in customers
keep their bag, favorites, and order history on their account.

## Available scripts

- `npm run dev` starts the local development server.
- `npm run build` type-checks the project and creates a production build in `dist/`.
- `npm run lint` checks the source with ESLint.
- `npm run preview` serves the production build locally.
