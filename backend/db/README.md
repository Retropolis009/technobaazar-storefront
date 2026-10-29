# Raw SQL migrations (Nutikals-style)

The `migrations/` folder holds the same schema history as the Alembic
revisions in `backend/migrations/versions/`, written as plain Postgres-first
`.sql` files:

| File | Contents |
|---|---|
| `000_initial_schema.sql` | `admin`, `product` |
| `001_catalog_state.sql` | `catalog_state` |
| `002_customers_orders.sql` | `customer`, `cart_item`, `favorite`, `order`, `order_item`, stock columns |
| `003_store_cms.sql` | `category`, `product_content`, guest carts, `coupon`, `store_setting`, `delivery_city`, richer `order`, `order_stock_movement`, `site_content`, `site_content_revision` |
| `004_category_custom_fields.sql` | `category_custom_field` (per-category specification shortcuts) |
| `005_category_hierarchy.sql` | Parent/child category relationships; migrates used categories under their parent |

All files are idempotent (`IF NOT EXISTS`) and safe to rerun.

## When to use which

- **Local development / app-managed deploys:** use Alembic —
  `flask --app app db upgrade` (or rely on the app's startup table creation).
- **Managed Postgres / hosting panels / DBAs:** apply the raw SQL files in
  numeric order, either with `psql`:
  ```sh
  for f in db/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
  ```
  or with the tracker script (records progress in `schema_migrations`):
  ```sh
  DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db python sql_migrate.py
  ```

After the schema exists, seed the store from the backend folder:

```sh
flask --app app create-admin   # needs ADMIN_EMAIL + ADMIN_PASSWORD
flask --app app seed-catalog
```

## Notes

- New schema changes should be added in **both** places: a new Alembic revision
  and a new numbered `.sql` file, kept in the same order.
- The `.sql` files contain plain DDL/DML only (no dollar-quoted function
  bodies, no semicolons inside string literals) so `sql_migrate.py` can split
  them into statements portably.
