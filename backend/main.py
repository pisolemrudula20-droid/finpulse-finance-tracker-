import csv
import io
import re
from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict, field_validator

from backend.database import get_db, init_db


app = FastAPI(
    title="FinPulse Finance API",
    description="Personal Finance Tracker API",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.on_event("startup")
def startup():
    init_db()


class TransactionInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    type: Literal["income", "expense"]
    amount: float = Field(gt=0, le=1_000_000_000, allow_inf_nan=False)
    category: str = Field(min_length=1, max_length=60)
    date: str
    description: str = Field(default="", max_length=250)

    @field_validator("date")
    @classmethod
    def validate_date(cls, value):
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Use YYYY-MM-DD date format") from exc
        return value

    @field_validator("category")
    @classmethod
    def validate_category(cls, value):
        if not value:
            raise ValueError("Category is required")
        return value


class BudgetInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    category: str = Field(min_length=1, max_length=60)
    monthly_limit: float = Field(
        gt=0,
        le=1_000_000_000,
        allow_inf_nan=False,
    )


def serialize(row):
    return dict(row)


def validate_month(month):
    if month and not re.fullmatch(r"\d{4}-\d{2}", month):
        raise HTTPException(
            status_code=422,
            detail="Month must use YYYY-MM format",
        )


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "FinPulse Finance API",
        "version": app.version,
    }


@app.get("/api/transactions")
def get_transactions(
    search: str | None = None,
    category: str | None = None,
    type: Literal["income", "expense"] | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = Query(default=500, ge=1, le=2000),
):
    conditions = []
    params = []

    if search and search.strip():
        term = f"%{search.strip()}%"
        conditions.append(
            "(description LIKE ? OR category LIKE ?)"
        )
        params.extend([term, term])

    if category and category != "All":
        conditions.append("category = ? COLLATE NOCASE")
        params.append(category)

    if type:
        conditions.append("type = ?")
        params.append(type)

    for value, operator in (
        (start_date, ">="),
        (end_date, "<="),
    ):
        if value:
            try:
                date.fromisoformat(value)
            except ValueError as exc:
                raise HTTPException(
                    status_code=422,
                    detail="Dates must use YYYY-MM-DD format",
                ) from exc

            conditions.append(f"date {operator} ?")
            params.append(value)

    where = (
        " WHERE " + " AND ".join(conditions)
        if conditions
        else ""
    )

    with get_db() as connection:
        rows = connection.execute(
            f"""
            SELECT * FROM transactions
            {where}
            ORDER BY date DESC, id DESC
            LIMIT ?
            """,
            [*params, limit],
        ).fetchall()

    return [serialize(row) for row in rows]


@app.post("/api/transactions", status_code=201)
def add_transaction(transaction: TransactionInput):
    with get_db() as connection:
        cursor = connection.execute(
            """
            INSERT INTO transactions
            (type, amount, category, date, description)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                transaction.type,
                round(transaction.amount, 2),
                transaction.category,
                transaction.date,
                transaction.description,
            ),
        )

        row = connection.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return serialize(row)


@app.put("/api/transactions/{transaction_id}")
def update_transaction(
    transaction_id: int,
    transaction: TransactionInput,
):
    with get_db() as connection:
        cursor = connection.execute(
            """
            UPDATE transactions
            SET type = ?,
                amount = ?,
                category = ?,
                date = ?,
                description = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                transaction.type,
                round(transaction.amount, 2),
                transaction.category,
                transaction.date,
                transaction.description,
                transaction_id,
            ),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Transaction not found",
            )

        row = connection.execute(
            "SELECT * FROM transactions WHERE id = ?",
            (transaction_id,),
        ).fetchone()

    return serialize(row)


@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(transaction_id: int):
    with get_db() as connection:
        cursor = connection.execute(
            "DELETE FROM transactions WHERE id = ?",
            (transaction_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Transaction not found",
            )

    return {"message": "Transaction deleted successfully"}


@app.get("/api/summary")
def get_summary(month: str | None = None):
    validate_month(month)

    month_filter = " AND date LIKE ?" if month else ""
    params = [f"{month}-%"] if month else []

    with get_db() as connection:
        totals = connection.execute(
            f"""
            SELECT
                COALESCE(
                    SUM(CASE WHEN type = 'income'
                    THEN amount ELSE 0 END), 0
                ) AS total_income,
                COALESCE(
                    SUM(CASE WHEN type = 'expense'
                    THEN amount ELSE 0 END), 0
                ) AS total_expense,
                COUNT(*) AS transaction_count
            FROM transactions
            WHERE 1=1 {month_filter}
            """,
            params,
        ).fetchone()

        categories = connection.execute(
            f"""
            SELECT category, ROUND(SUM(amount), 2) AS total
            FROM transactions
            WHERE type = 'expense' {month_filter}
            GROUP BY category
            ORDER BY total DESC
            """,
            params,
        ).fetchall()

        monthly = connection.execute("""
            SELECT
                substr(date, 1, 7) AS month,
                ROUND(SUM(
                    CASE WHEN type = 'income'
                    THEN amount ELSE 0 END
                ), 2) AS income,
                ROUND(SUM(
                    CASE WHEN type = 'expense'
                    THEN amount ELSE 0 END
                ), 2) AS expense
            FROM transactions
            WHERE date >= date('now', 'start of month', '-5 months')
            GROUP BY substr(date, 1, 7)
            ORDER BY month
        """).fetchall()

    income = float(totals["total_income"])
    expense = float(totals["total_expense"])

    return {
        "total_income": income,
        "total_expense": expense,
        "net_balance": round(income - expense, 2),
        "savings_rate": round(
            ((income - expense) / income) * 100, 1
        ) if income else 0,
        "transaction_count": totals["transaction_count"],
        "category_breakdown": [
            serialize(row) for row in categories
        ],
        "monthly_trend": [
            serialize(row) for row in monthly
        ],
        "month": month,
    }


@app.get("/api/budgets")
def get_budgets(month: str | None = None):
    validate_month(month)
    selected_month = month or date.today().strftime("%Y-%m")

    with get_db() as connection:
        rows = connection.execute(
            """
            SELECT
                b.id,
                b.category,
                b.monthly_limit,
                COALESCE(SUM(t.amount), 0) AS spent
            FROM budgets b
            LEFT JOIN transactions t
                ON t.category = b.category COLLATE NOCASE
                AND t.type = 'expense'
                AND substr(t.date, 1, 7) = ?
            GROUP BY b.id
            ORDER BY b.category COLLATE NOCASE
            """,
            (selected_month,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "category": row["category"],
            "monthly_limit": row["monthly_limit"],
            "spent": round(row["spent"], 2),
            "remaining": round(
                row["monthly_limit"] - row["spent"], 2
            ),
            "percent_used": round(
                row["spent"] / row["monthly_limit"] * 100, 1
            ),
            "month": selected_month,
        }
        for row in rows
    ]


@app.post("/api/budgets", status_code=201)
def save_budget(budget: BudgetInput):
    with get_db() as connection:
        connection.execute(
            """
            INSERT INTO budgets (category, monthly_limit)
            VALUES (?, ?)
            ON CONFLICT(category)
            DO UPDATE SET
                monthly_limit = excluded.monthly_limit,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                budget.category,
                round(budget.monthly_limit, 2),
            ),
        )

        row = connection.execute(
            """
            SELECT * FROM budgets
            WHERE category = ? COLLATE NOCASE
            """,
            (budget.category,),
        ).fetchone()

    return serialize(row)


@app.delete("/api/budgets/{budget_id}")
def delete_budget(budget_id: int):
    with get_db() as connection:
        cursor = connection.execute(
            "DELETE FROM budgets WHERE id = ?",
            (budget_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Budget not found",
            )

    return {"message": "Budget deleted successfully"}


@app.get("/api/export.csv")
def export_csv():
    with get_db() as connection:
        rows = connection.execute("""
            SELECT date, type, category, description, amount
            FROM transactions
            ORDER BY date DESC, id DESC
        """).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Date",
        "Type",
        "Category",
        "Description",
        "Amount (INR)",
    ])

    for row in rows:
        writer.writerow([
            row["date"],
            row["type"],
            row["category"],
            row["description"],
            row["amount"],
        ])

    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition":
                'attachment; filename="finpulse-transactions.csv"'
        },
    )