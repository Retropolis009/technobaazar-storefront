#!/usr/bin/env python3
"""Manage the local PostgreSQL database for development.

Uses embedded Postgres binaries (pip package `pgserver`), so no system
Postgres install is needed. Data lives in ~/pgdata (outside the repo).

Usage (from the backend/ folder):
    python local_postgres.py start    # init + start, print DATABASE_URL
    python local_postgres.py status   # show server + database status
    python local_postgres.py stop     # stop the server (data is kept)

After `start`, point the store at it, e.g. in backend/.env:
    DATABASE_URL=<the printed URL>
then run the usual setup:
    flask --app app db upgrade
    flask --app app create-admin     # needs ADMIN_EMAIL + ADMIN_PASSWORD
    flask --app app seed-catalog
"""

import os
import sys

PGDATA = os.path.expanduser('~/pgdata')
DB_NAME = os.environ.get('LOCAL_PG_DB', 'technobaazar')


def server():
    try:
        import pgserver
    except ImportError:
        raise SystemExit('pgserver is not installed. Run: pip install "pgserver==0.1.4"')
    os.makedirs(PGDATA, exist_ok=True)
    return pgserver.get_server(PGDATA, cleanup_mode=None)


def database_url():
    return f'postgresql+psycopg://postgres@/{DB_NAME}?host={PGDATA}'


def cmd_start():
    srv = server()
    srv.ensure_pgdata_inited()
    srv.ensure_postgres_running()
    import psycopg

    conn = psycopg.connect(f'postgresql://postgres@/postgres?host={PGDATA}', autocommit=True)
    exists = conn.execute('SELECT 1 FROM pg_database WHERE datname=%s', (DB_NAME,)).fetchone()
    if not exists:
        conn.execute(f'CREATE DATABASE {DB_NAME}')
        print(f'created database {DB_NAME}')
    version = conn.execute('SELECT version()').fetchone()[0].split(',')[0]
    print(f'{version} running with data in {PGDATA}')
    print(f'DATABASE_URL={database_url()}')


def cmd_status():
    srv = server()
    pid = srv.get_pid()
    if not pid:
        print('local Postgres is not running (start it with: python local_postgres.py start)')
        return
    print(f'local Postgres is running (pid {pid}), data in {PGDATA}')
    try:
        import psycopg

        conn = psycopg.connect(f'postgresql://postgres@/{DB_NAME}?host={PGDATA}')
        tables = conn.execute(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
        ).fetchone()[0]
        print(f'database {DB_NAME}: reachable, {tables} tables')
    except Exception as exc:
        print(f'database {DB_NAME}: not reachable ({exc})')
    print(f'DATABASE_URL={database_url()}')


def cmd_stop():
    srv = server()
    if not srv.get_pid():
        print('local Postgres is not running.')
        return
    # NOTE: never use srv.cleanup() here — it deletes the pgdata directory.
    import pgserver
    from pathlib import Path

    print(pgserver.pg_ctl(['stop', '-m', 'fast', '-t', '30'], Path(PGDATA)).strip())
    print('local Postgres stopped (data kept).')


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if command == 'start':
        cmd_start()
    elif command == 'status':
        cmd_status()
    elif command == 'stop':
        cmd_stop()
    else:
        raise SystemExit(f'Unknown command {command!r}. Use start, status, or stop.')


if __name__ == '__main__':
    main()
