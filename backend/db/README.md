# Database migrations

Apply the PostgreSQL migrations from `backend/`:

```sh
npm run migrate
```

The Node migration runner tracks completed SQL files in `schema_migrations`, and can safely be rerun. SQLite uses Sequelize to create missing tables and add columns in place while retaining existing rows.

The `.sql` files remain compatible with manually managed PostgreSQL deployments. They are ordered by filename and use idempotent DDL where supported.
