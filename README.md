# TechnoBaazar

A React + TypeScript application powered by Vite.

## Requirements

- Node.js 20.19+ or 22.12+
- npm (included with Node.js)

## Get started

```sh
npm install
npm run dev
```

## Admin dashboard

Open `/admin` and sign in through the Flask API. The dashboard supports product search, category filters, add, edit, and delete. The `seed-catalog` command imports the starter products into SQLite during setup. Product changes are stored by Flask and shared with the storefront.

## Flask API starter

The `backend` folder contains a Flask API starter with SQLAlchemy models, database migrations, cookie-based admin sessions, and product CRUD endpoints. Install its dependencies from that folder in a Python virtual environment:

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Set private values in `backend/.env`, then initialize the database and create the first admin:

```powershell
flask --app app db upgrade
flask --app app create-admin
flask --app app seed-catalog
flask --app app run --debug
```

The API is available at `http://localhost:5000/api`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your ignored local `.env` before running `flask --app app create-admin`; the example file contains placeholders, not a usable account. `seed-catalog` imports the one-time starter records from `backend/seed_products.json` into SQLite. Customers can register, save their cart and favorites, place cash-on-delivery orders, and view their order history. For production, set `APP_ENV=production`, use PostgreSQL and a unique random `FLASK_SECRET_KEY`, serve everything over HTTPS, set `FRONTEND_ORIGIN` to the exact storefront origin, and configure your trusted proxy hop count if deployed behind a reverse proxy.

## Available scripts

- `npm run dev` starts the local development server.
- `npm run build` type-checks the project and creates a production build in `dist/`.
- `npm run lint` checks the source with ESLint.
- `npm run preview` serves the production build locally.
