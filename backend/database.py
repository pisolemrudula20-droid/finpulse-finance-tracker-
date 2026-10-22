import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(
    os.getenv("FINPULSE_DB_PATH", str(BASE_DIR / "finance.db"))
)


@contextmanager
def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(str(DB_PATH), timeout=10)
    connection.row_factory = sqlite3.Row

    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db():
    with get_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL
                    CHECK(type IN ('income', 'expense')),
                amount REAL NOT NULL CHECK(amount > 0),
                category TEXT NOT NULL,
                date TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL UNIQUE COLLATE NOCASE,
                monthly_limit REAL NOT NULL CHECK(monthly_limit > 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_transactions_date
            ON transactions(date DESC)
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_transactions_category
            ON transactions(category)
        """)