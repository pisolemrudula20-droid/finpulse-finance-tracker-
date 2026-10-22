# FinPulse Finance Tracker

FinPulse is a local personal finance tracker with a React dashboard and a
FastAPI backend. It stores transaction and budget data in SQLite.

## Features

- Dashboard summary of income, expenses, balance, and savings rate
- Create, edit, search, filter, and delete income and expense transactions
- Set monthly category budgets and view spending against each budget
- Analytics for expense categories and monthly income/expense trends
- Export transactions as CSV

## Technologies

- Backend: Python, FastAPI, Pydantic, and SQLite
- Frontend: React 18, TypeScript, Vite, Recharts, and Lucide

## Prerequisites

- Python 3.10 or newer
- Node.js and npm

## Setup

### Backend

Run these commands from the project root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.main:app --reload
```

The API runs at `http://127.0.0.1:8000`. FastAPI's interactive API
documentation is available at `http://127.0.0.1:8000/docs`.

The SQLite database is initialized automatically at
`backend/finance.db` on startup. Set `FINPULSE_DB_PATH` before starting the
backend to use a different database file.

### Frontend

In a second PowerShell window:

```powershell
cd frontend
npm ci
npm run dev
```

Open the frontend URL printed by Vite (configured for
`http://127.0.0.1:5173`). Its `/api` requests are proxied to the local backend
at `http://127.0.0.1:8000`.
