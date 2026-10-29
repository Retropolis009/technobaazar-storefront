#!/usr/bin/env python3
"""Apply the raw SQL migrations in backend/db/migrations (Nutikals-style).

Usage (from the backend/ folder):
    DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db python sql_migrate.py

Applied files are tracked in the schema_migrations table, so reruns are safe.
Alternatively, apply the files with psql:
    psql "$DATABASE_URL" -f db/migrations/000_initial_schema.sql
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text  # noqa: E402

from app import create_app, db  # noqa: E402

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db', 'migrations')

TRACKING_DDL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename varchar(200) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""


def split_statements(sql):
    # Migration files contain plain DDL/DML only: no dollar-quoted bodies
    # and no semicolons inside string literals.
    return [chunk.strip() for chunk in sql.split(';') if chunk.strip()]


def main():
    files = sorted(name for name in os.listdir(MIGRATIONS_DIR) if name.endswith('.sql'))
    if not files:
        raise SystemExit(f'No .sql migrations found in {MIGRATIONS_DIR}')
    app = create_app()
    with app.app_context():
        with db.engine.begin() as conn:
            conn.execute(text(TRACKING_DDL))
            applied = {row[0] for row in conn.execute(text('SELECT filename FROM schema_migrations'))}
        for filename in files:
            if filename in applied:
                print(f'skip {filename} (already applied)')
                continue
            with open(os.path.join(MIGRATIONS_DIR, filename), encoding='utf-8') as handle:
                statements = split_statements(handle.read())
            with db.engine.begin() as conn:
                for statement in statements:
                    conn.execute(text(statement))
                conn.execute(
                    text('INSERT INTO schema_migrations (filename) VALUES (:name)'),
                    {'name': filename},
                )
            print(f'applied {filename} ({len(statements)} statements)')
    print('done.')


if __name__ == '__main__':
    main()
