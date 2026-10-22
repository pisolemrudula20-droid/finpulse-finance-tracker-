import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  Edit3,
  Filter,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  Budget,
  Summary,
  Transaction,
  TransactionInput,
  TransactionType,
} from "./types";

import "./App.css";

type Page = "dashboard" | "transactions" | "budgets" | "analytics";

const CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Investment",
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Healthcare",
  "Education",
  "Entertainment",
  "Travel",
  "Other",
];

const COLORS = [
  "#9b8afb",
  "#48d6a0",
  "#ffad70",
  "#65b8ff",
  "#ff7185",
  "#e7ce70",
  "#d48cff",
  "#67d7df",
];

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const formatMoney = (value: number) => INR.format(value);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const currentMonth = () => today().slice(0, 7);

const monthLabel = (month: string) => {
  if (!month) return "";
  const [year, m] = month.split("-");
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString(
    "en-IN",
    { month: "short", year: "2-digit" },
  );
};

const dateLabel = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const detail = error?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item: { msg?: string }) => item.msg).join(", ")
      : typeof detail === "string"
        ? detail
        : `Request failed (${response.status})`;

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

const emptySummary = (): Summary => ({
  total_income: 0,
  total_expense: 0,
  net_balance: 0,
  savings_rate: 0,
  transaction_count: 0,
  category_breakdown: [],
  monthly_trend: [],
  month: currentMonth(),
});

const emptyForm = (): TransactionInput => ({
  type: "expense",
  amount: 0,
  category: "Food",
  date: today(),
  description: "",
});

function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h2 className="heading-title">{title}</h2>
        <p className="heading-description">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Wallet size={23} />
      </div>
      {message}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  color: string;
}) {
  return (
    <div className="summary-card" style={{ "--card-glow": color } as React.CSSProperties}>
      <div className="card-top">
        <span className="card-label">{label}</span>
        <div className="card-icon" style={{ "--card-color": color } as React.CSSProperties}>
          <Icon size={18} />
        </div>
      </div>
      <div className="card-value">{value}</div>
      <div className="card-footer">
        <Activity size={13} />
        <span>{hint}</span>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<Summary>(emptySummary());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [transactionForm, setTransactionForm] =
    useState<TransactionInput>(emptyForm());

  const [budgetCategory, setBudgetCategory] = useState("Food");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("month", month);

      const [summaryData, transactionData, budgetData] = await Promise.all([
        api<Summary>(`/api/summary?${params.toString()}`),
        api<Transaction[]>("/api/transactions?limit=2000"),
        api<Budget[]>(`/api/budgets?month=${encodeURIComponent(month)}`),
      ]);

      setSummary(summaryData);
      setTransactions(transactionData);
      setBudgets(budgetData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your financial data.",
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadData();
  }, [loadData]);
  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((item) => {
      const matchesSearch =
        !query ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      const matchesType =
        filterType === "all" || item.type === filterType;

      const matchesCategory =
        filterCategory === "all" ||
        item.category.toLowerCase() === filterCategory.toLowerCase();

      const matchesStart = !startDate || item.date >= startDate;
      const matchesEnd = !endDate || item.date <= endDate;

      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesStart &&
        matchesEnd
      );
    });
  }, [
    transactions,
    search,
    filterType,
    filterCategory,
    startDate,
    endDate,
  ]);

  const monthlyTrend = useMemo(() => {
    const result = new Map<string, { month: string; income: number; expense: number }>();

    for (const item of summary.monthly_trend) {
      result.set(item.month, {
        month: monthLabel(item.month),
        income: Number(item.income),
        expense: Number(item.expense),
      });
    }

    // Include the selected month even when no transactions exist.
    if (!result.has(month)) {
      result.set(month, {
        month: monthLabel(month),
        income: 0,
        expense: 0,
      });
    }

    return [...result.values()].slice(-6);
  }, [summary.monthly_trend, month]);

  const expenseTotal = summary.total_expense;
  const incomeTotal = summary.total_income;

  const openNewTransaction = () => {
    setEditingId(null);
    setTransactionForm(emptyForm());
    setShowTransactionForm(true);
    setError("");
    setNotice("");
  };

  const openEditTransaction = (item: Transaction) => {
    setEditingId(item.id);
    setTransactionForm({
      type: item.type,
      amount: item.amount,
      category: item.category,
      date: item.date,
      description: item.description,
    });
    setShowTransactionForm(true);
    setError("");
    setNotice("");
    setPage("transactions");
  };

  const saveTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!transactionForm.amount || transactionForm.amount <= 0) {
      setError("Please enter an amount greater than zero.");
      return;
    }

    if (!transactionForm.date || !transactionForm.category.trim()) {
      setError("Please provide a date and category.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload: TransactionInput = {
        ...transactionForm,
        amount: Math.round(transactionForm.amount * 100) / 100,
        category: transactionForm.category.trim(),
        description: transactionForm.description.trim(),
      };

      if (editingId !== null) {
        await api<Transaction>(`/api/transactions/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setNotice("Transaction updated successfully.");
      } else {
        await api<Transaction>("/api/transactions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("Transaction added successfully.");
      }

      setShowTransactionForm(false);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save transaction.");
    } finally {
      setSaving(false);
    }
  };

  const removeTransaction = async (item: Transaction) => {
    const confirmed = window.confirm(
      `Delete "${item.description || item.category}" for ${formatMoney(item.amount)}?`,
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await api(`/api/transactions/${item.id}`, { method: "DELETE" });
      setNotice("Transaction deleted.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete transaction.");
    }
  };

  const saveBudget = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(budgetAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a budget amount greater than zero.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await api("/api/budgets", {
        method: "POST",
        body: JSON.stringify({
          category: budgetCategory,
          monthly_limit: amount,
        }),
      });

      setBudgetAmount("");
      setEditingBudgetId(null);
      setNotice("Monthly budget saved.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save budget.");
    } finally {
      setSaving(false);
    }
  };

  const editBudget = (budget: Budget) => {
    setBudgetCategory(budget.category);
    setBudgetAmount(String(budget.monthly_limit));
    setEditingBudgetId(budget.id);
    setError("");
    setNotice("");
    document.getElementById("budget-form")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const removeBudget = async (budget: Budget) => {
    if (!window.confirm(`Remove the ${budget.category} budget?`)) return;

    setError("");
    setNotice("");

    try {
      await api(`/api/budgets/${budget.id}`, { method: "DELETE" });
      setNotice("Budget removed.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove budget.");
    }
  };

  const exportCSV = () => {
    window.open("/api/export.csv", "_blank", "noopener,noreferrer");
  };

  const navItems: { id: Page; label: string; icon: typeof Wallet }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "transactions", label: "Transactions", icon: ArrowUpRight },
    { id: "budgets", label: "Budgets", icon: Target },
    { id: "analytics", label: "Analytics", icon: ChartNoAxesCombined },
  ];

  const pageTitle: Record<Page, string> = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    budgets: "Budget Planner",
    analytics: "Financial Analytics",
  };

  const pageSubtitle: Record<Page, string> = {
    dashboard: "Your money, clearly in view.",
    transactions: "Track and manage every transaction.",
    budgets: "Set limits and stay in control.",
    analytics: "Understand your financial habits.",
  };

  const renderTransactionTable = (items: Transaction[], compact = false) => (
    <div className="table-scroll">
      <table className="transaction-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Date</th>
            <th>Category</th>
            <th>Type</th>
            <th>Amount</th>
            {!compact && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="transaction-description">
                  <div className="transaction-symbol">
                    {item.type === "income" ? (
                      <ArrowDownLeft size={17} />
                    ) : (
                      <ArrowUpRight size={17} />
                    )}
                  </div>
                  <div>
                    <div className="transaction-main">
                      {item.description || item.category}
                    </div>
                    <div className="transaction-sub">ID #{item.id}</div>
                  </div>
                </div>
              </td>
              <td>{dateLabel(item.date)}</td>
              <td>{item.category}</td>
              <td>
                <span className={`type-pill ${item.type}`}>
                  {item.type === "income" ? "Income" : "Expense"}
                </span>
              </td>
              <td className={item.type === "income" ? "amount-income" : "amount-expense"}>
                {item.type === "income" ? "+" : "−"}
                {formatMoney(item.amount)}
              </td>
              {!compact && (
                <td>
                  <div className="row-actions">
                    <button
                      className="small-action"
                      title="Edit transaction"
                      aria-label="Edit transaction"
                      onClick={() => openEditTransaction(item)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="small-action delete"
                      title="Delete transaction"
                      aria-label="Delete transaction"
                      onClick={() => void removeTransaction(item)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <EmptyState message="No transactions found. Add your first transaction to get started." />
      )}
    </div>
  );

  const renderSummaryCards = () => (
    <div className="summary-grid">
      <SummaryCard
        label="Total Income"
        value={formatMoney(incomeTotal)}
        hint={`${monthLabel(month)} · Money received`}
        icon={ArrowDownLeft}
        color="#48d6a0"
      />
      <SummaryCard
        label="Total Expenses"
        value={formatMoney(expenseTotal)}
        hint={`${monthLabel(month)} · Money spent`}
        icon={ArrowUpRight}
        color="#ff7185"
      />
      <SummaryCard
        label="Net Balance"
        value={formatMoney(summary.net_balance)}
        hint={summary.net_balance >= 0 ? "Positive cash flow" : "Spending exceeds income"}
        icon={Wallet}
        color="#9b8afb"
      />
      <SummaryCard
        label="Savings Rate"
        value={`${summary.savings_rate.toFixed(1)}%`}
        hint={`${summary.transaction_count} transactions this month`}
        icon={TrendingUp}
        color="#65b8ff"
      />
    </div>
  );

  const renderCashFlowChart = () => (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Cash Flow Overview</h3>
          <p className="panel-subtitle">Income versus expenses over six months</p>
        </div>
        <span className="card-icon" style={{ "--card-color": "#9b8afb" } as React.CSSProperties}>
          <ChartNoAxesCombined size={18} />
        </span>
      </div>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthlyTrend} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#48d6a0" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#48d6a0" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9b8afb" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#9b8afb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#292b39" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "#85899d", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              tick={{ fill: "#85899d", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={65}
              tickFormatter={(v: number) =>
                v >= 100000
                  ? `₹${(v / 100000).toFixed(1)}L`
                  : v >= 1000
                    ? `₹${(v / 1000).toFixed(0)}k`
                    : `₹${v}`
              }
            />
            <Tooltip
              contentStyle={{
                background: "#202231",
                border: "1px solid #35384a",
                borderRadius: 10,
                fontSize: 11,
              }}
              formatter={(value) => formatMoney(Number(value))}
            />
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="#48d6a0"
              strokeWidth={2}
              fill="url(#incomeGradient)"
            />
            <Area
              type="monotone"
              dataKey="expense"
              name="Expenses"
              stroke="#9b8afb"
              strokeWidth={2}
              fill="url(#expenseGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderCategoryChart = () => {
    const data = summary.category_breakdown;
    const total = data.reduce((sum, item) => sum + item.total, 0);

    return (
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Spending Breakdown</h3>
            <p className="panel-subtitle">{monthLabel(month)} · By category</p>
          </div>
          <span className="card-icon" style={{ "--card-color": "#ffad70" } as React.CSSProperties}>
            <CircleDollarSign size={18} />
          </span>
        </div>

        {data.length === 0 ? (
          <EmptyState message="Your category spending will appear here." />
        ) : (
          <>
            <div className="chart-wrap" style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={53}
                    outerRadius={77}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {data.map((item, index) => (
                      <Cell
                        key={item.category}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatMoney(Number(value))}
                    contentStyle={{
                      background: "#202231",
                      border: "1px solid #35384a",
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="category-list">
              {data.slice(0, 5).map((item, index) => (
                <div key={item.category}>
                  <div className="category-heading">
                    <span>
                      <span
                        className="category-dot"
                        style={{ background: COLORS[index % COLORS.length] }}
                      />
                      {item.category}
                    </span>
                    <span>{formatMoney(item.total)}</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${total ? (item.total / total) * 100 : 0}%`,
                        background: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderBudgetCards = () => (
    <div className="budget-grid">
      {budgets.map((budget, index) => {
        const percent = Math.min(budget.percent_used, 100);
        const overBudget = budget.spent > budget.monthly_limit;
        const color = overBudget
          ? "#ff7185"
          : percent >= 80
            ? "#ffad70"
            : COLORS[index % COLORS.length];

        return (
          <div className="budget-card" key={budget.id}>
            <div className="panel-header">
              <div>
                <h3 className="panel-title">{budget.category}</h3>
                <p className="panel-subtitle">{monthLabel(month)} budget</p>
              </div>
              <div className="row-actions">
                <button
                  className="small-action"
                  title="Edit budget"
                  aria-label={`Edit ${budget.category} budget`}
                  onClick={() => editBudget(budget)}
                >
                  <Edit3 size={14} />
                </button>
                <button
                  className="small-action delete"
                  title="Delete budget"
                  aria-label={`Delete ${budget.category} budget`}
                  onClick={() => void removeBudget(budget)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="budget-amounts">
              <div>
                <div className="budget-spent">{formatMoney(budget.spent)}</div>
                <div className="budget-limit">Spent so far</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="budget-spent" style={{ fontSize: 16 }}>
                  {formatMoney(budget.monthly_limit)}
                </div>
                <div className="budget-limit">Monthly limit</div>
              </div>
            </div>

            <div className="progress-track" style={{ height: 9 }}>
              <div
                className="progress-fill"
                style={{ width: `${percent}%`, background: color }}
              />
            </div>

            <div className="budget-footer">
              <span style={{ color }}>{budget.percent_used.toFixed(1)}% used</span>
              <span>
                {overBudget
                  ? `${formatMoney(Math.abs(budget.remaining))} over budget`
                  : `${formatMoney(budget.remaining)} left`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="app-shell">
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon">
              <Wallet size={22} />
            </div>
            <div>
              <div className="brand-name">
                Fin<span>Pulse</span>
              </div>
              <div className="brand-subtitle">PERSONAL FINANCE</div>
            </div>
          </div>

          <div className="nav-label">WORKSPACE</div>
          <nav className="nav-list" aria-label="Main navigation">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${page === id ? "active" : ""}`}
                onClick={() => {
                  setPage(id);
                  setShowTransactionForm(false);
                  setError("");
                }}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>

          <div className="nav-label" style={{ marginTop: 30 }}>YOUR FINANCES</div>
          <button
            className="nav-item"
            onClick={() => {
              setPage("transactions");
              setShowTransactionForm(true);
              setEditingId(null);
              setTransactionForm(emptyForm());
            }}
          >
            <Plus size={17} />
            Add transaction
          </button>

          <div className="sidebar-bottom">
            <div className="profile-row">
              <div className="avatar">FP</div>
              <div>
                <div className="profile-name">My Finances</div>
                <div className="profile-caption">Personal workspace</div>
              </div>
              <ShieldCheck size={16} color="#48d6a0" style={{ marginLeft: "auto" }} />
            </div>
          </div>
        </aside>

        <main className="main-area">
          <header className="topbar">
            <div>
              <div className="page-eyebrow">FINPULSE / OVERVIEW</div>
              <h1 className="page-title">{pageTitle[page]}</h1>
            </div>

            <div className="topbar-actions">
              <CalendarDays size={16} color="#85899d" />
              <input
                aria-label="Select reporting month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value || currentMonth())}
                style={{ width: 155 }}
              />
              <button className="primary-btn" onClick={openNewTransaction}>
                <Plus size={16} />
                <span>New transaction</span>
              </button>
            </div>
          </header>

          <div className="content">
            <SectionTitle
              title={
                page === "dashboard"
                  ? "Welcome back 👋"
                  : pageTitle[page]
              }
              subtitle={
                page === "dashboard"
                  ? `Here's your financial overview for ${monthLabel(month)}.`
                  : pageSubtitle[page]
              }
              action={
                page === "dashboard" || page === "transactions" ? (
                  <button className="secondary-btn" onClick={exportCSV}>
                    <Download size={15} />
                    Export CSV
                  </button>
                ) : undefined
              }
            />

            {error && (
              <div className="notice" role="alert">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>{error}</span>
                  <button
                    className="small-action delete"
                    onClick={() => setError("")}
                    aria-label="Dismiss error"
                  >
                    <X size={15} />
                  </button>
                </div>
                {error.toLowerCase().includes("fetch") ||
                error.toLowerCase().includes("network") ? (
                  <p style={{ marginBottom: 0 }}>
                    Check that the FastAPI server is running on port 8000.
                  </p>
                ) : null}
              </div>
            )}

            {notice && (
              <div className="notice success-notice" role="status">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span><Check size={14} style={{ verticalAlign: "middle" }} /> {notice}</span>
                  <button
                    className="small-action"
                    onClick={() => setNotice("")}
                    aria-label="Dismiss message"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="loading-state">
                <LoaderCircle
                  size={22}
                  className="loading-dot"
                  style={{ verticalAlign: "middle" }}
                />
                Loading your financial data...
              </div>
            ) : (
              <>
                {showTransactionForm && (
                  <section className="panel form-panel animate-in">
                    <div className="panel-header">
                      <div>
                        <h3 className="panel-title">
                          {editingId === null ? "Add Transaction" : "Edit Transaction"}
                        </h3>
                        <p className="panel-subtitle">
                          Enter the details below. Your changes are saved to the database.
                        </p>
                      </div>
                      <button
                        className="icon-btn"
                        aria-label="Close transaction form"
                        onClick={() => {
                          setShowTransactionForm(false);
                          setEditingId(null);
                          setError("");
                        }}
                      >
                        <X size={17} />
                      </button>
                    </div>

                    <form onSubmit={saveTransaction}>
                      <div className="form-grid">
                        <div className="form-field">
                          <label htmlFor="transaction-type">Transaction type</label>
                          <select
                            id="transaction-type"
                            value={transactionForm.type}
                            onChange={(event) => {
                              const type = event.target.value as TransactionType;
                              setTransactionForm((old) => ({
                                ...old,
                                type,
                                category:
                                  type === "income"
                                    ? "Salary"
                                    : old.category === "Salary" ||
                                        old.category === "Freelance" ||
                                        old.category === "Business" ||
                                        old.category === "Investment"
                                      ? "Food"
                                      : old.category,
                              }));
                            }}
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label htmlFor="transaction-amount">Amount (₹)</label>
                          <input
                            id="transaction-amount"
                            type="number"
                            min="0.01"
                            max="1000000000"
                            step="0.01"
                            required
                            value={transactionForm.amount || ""}
                            placeholder="e.g. 1500"
                            onChange={(event) =>
                              setTransactionForm((old) => ({
                                ...old,
                                amount: Number(event.target.value),
                              }))
                            }
                          />
                        </div>

                        <div className="form-field">
                          <label htmlFor="transaction-category">Category</label>
                          <select
                            id="transaction-category"
                            required
                            value={transactionForm.category}
                            onChange={(event) =>
                              setTransactionForm((old) => ({
                                ...old,
                                category: event.target.value,
                              }))
                            }
                          >
                            {CATEGORIES.filter((category) =>
                              transactionForm.type === "income"
                                ? ["Salary", "Freelance", "Business", "Investment", "Other"].includes(category)
                                : !["Salary", "Freelance", "Business", "Investment"].includes(category),
                            ).map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-field">
                          <label htmlFor="transaction-date">Date</label>
                          <input
                            id="transaction-date"
                            type="date"
                            required
                            value={transactionForm.date}
                            onChange={(event) =>
                              setTransactionForm((old) => ({
                                ...old,
                                date: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="form-field full">
                          <label htmlFor="transaction-description">
                            Description (optional)
                          </label>
                          <input
                            id="transaction-description"
                            maxLength={250}
                            value={transactionForm.description}
                            placeholder="e.g. Monthly salary, grocery shopping..."
                            onChange={(event) =>
                              setTransactionForm((old) => ({
                                ...old,
                                description: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="form-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => {
                            setShowTransactionForm(false);
                            setEditingId(null);
                            setError("");
                          }}
                        >
                          Cancel
                        </button>
                        <button className="primary-btn" type="submit" disabled={saving}>
                          {saving ? <LoaderCircle size={15} /> : <Check size={15} />}
                          {saving ? "Saving..." : editingId === null ? "Save transaction" : "Update transaction"}
                        </button>
                      </div>
                    </form>
                  </section>
                )}

                {page === "dashboard" && (
                  <div className="animate-in">
                    {renderSummaryCards()}

                    <div className="section-grid">
                      {renderCashFlowChart()}
                      {renderCategoryChart()}
                    </div>

                    <section className="panel table-panel">
                      <div className="panel-header">
                        <div>
                          <h3 className="panel-title">Recent Transactions</h3>
                          <p className="panel-subtitle">
                            Your latest income and expenses
                          </p>
                        </div>
                        <button
                          className="secondary-btn"
                          onClick={() => setPage("transactions")}
                        >
                          View all <ChevronDown size={14} />
                        </button>
                      </div>

                      {renderTransactionTable(
                        [...transactions]
                          .sort((a, b) =>
                            b.date.localeCompare(a.date) || b.id - a.id,
                          )
                          .slice(0, 5),
                        true,
                      )}
                    </section>

                    <section className="panel">
                      <div className="panel-header">
                        <div>
                          <h3 className="panel-title">Budget Snapshot</h3>
                          <p className="panel-subtitle">
                            How you're tracking against your limits
                          </p>
                        </div>
                        <button
                          className="secondary-btn"
                          onClick={() => setPage("budgets")}
                        >
                          Manage budgets
                        </button>
                      </div>
                      {budgets.length ? renderBudgetCards() : (
                        <EmptyState message="No budgets set yet. Create your first monthly budget to start tracking spending." />
                      )}
                    </section>
                  </div>
                )}

                {page === "transactions" && (
                  <div className="panel table-panel animate-in">
                    <div className="panel-header">
                      <div>
                        <h3 className="panel-title">All Transactions</h3>
                        <p className="panel-subtitle">
                          {filteredTransactions.length} results · Search, filter, edit, or delete
                        </p>
                      </div>
                      <ListFilter size={18} color="#9b8afb" />
                    </div>

                    <div className="filter-row">
                      <div className="search-box">
                        <Search size={16} />
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search descriptions or categories..."
                          aria-label="Search transactions"
                        />
                      </div>

                      <select
                        className="filter-control"
                        aria-label="Filter transaction type"
                        value={filterType}
                        onChange={(event) => setFilterType(event.target.value)}
                      >
                        <option value="all">All types</option>
                        <option value="income">Income</option>
                        <option value="expense">Expenses</option>
                      </select>

                      <select
                        className="filter-control"
                        aria-label="Filter transaction category"
                        value={filterCategory}
                        onChange={(event) => setFilterCategory(event.target.value)}
                      >
                        <option value="all">All categories</option>
                        {[...new Set(transactions.map((item) => item.category))]
                          .sort()
                          .map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                      </select>

                      <input
                        type="date"
                        className="filter-control"
                        aria-label="Start date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        title="Start date"
                      />

                      <input
                        type="date"
                        className="filter-control"
                        aria-label="End date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        title="End date"
                      />

                      <button
                        className="icon-btn"
                        aria-label="Clear filters"
                        title="Clear filters"
                        onClick={() => {
                          setSearch("");
                          setFilterType("all");
                          setFilterCategory("all");
                          setStartDate("");
                          setEndDate("");
                        }}
                      >
                        <Filter size={15} />
                      </button>
                    </div>

                    {renderTransactionTable(filteredTransactions)}
                  </div>
                )}

                {page === "budgets" && (
                  <div className="animate-in">
                    <section className="panel form-panel" id="budget-form">
                      <div className="panel-header">
                        <div>
                          <h3 className="panel-title">
                            {editingBudgetId === null ? "Create Monthly Budget" : "Edit Monthly Budget"}
                          </h3>
                          <p className="panel-subtitle">
                            Choose a category and its spending limit for {monthLabel(month)}.
                          </p>
                        </div>
                        <Target size={20} color="#9b8afb" />
                      </div>

                      <form onSubmit={saveBudget}>
                        <div className="form-grid">
                          <div className="form-field">
                            <label htmlFor="budget-category">Category</label>
                            <select
                              id="budget-category"
                              value={budgetCategory}
                              onChange={(event) => setBudgetCategory(event.target.value)}
                            >
                              {CATEGORIES.filter((item) =>
                                !["Salary", "Freelance", "Business", "Investment"].includes(item),
                              ).map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="form-field">
                            <label htmlFor="budget-limit">Monthly limit (₹)</label>
                            <input
                              id="budget-limit"
                              type="number"
                              min="0.01"
                              max="1000000000"
                              step="0.01"
                              required
                              value={budgetAmount}
                              placeholder="e.g. 5000"
                              onChange={(event) => setBudgetAmount(event.target.value)}
                            />
                          </div>
                        </div>

                        <div className="form-actions">
                          {editingBudgetId !== null && (
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => {
                                setEditingBudgetId(null);
                                setBudgetAmount("");
                              }}
                            >
                              Cancel edit
                            </button>
                          )}
                          <button type="submit" className="primary-btn" disabled={saving}>
                            <Plus size={15} />
                            {saving ? "Saving..." : "Save budget"}
                          </button>
                        </div>
                      </form>
                    </section>

                    <div className="panel">
                      <div className="panel-header">
                        <div>
                          <h3 className="panel-title">Your Monthly Budgets</h3>
                          <p className="panel-subtitle">
                            Budget progress is calculated from recorded expenses.
                          </p>
                        </div>
                      </div>
                      {budgets.length ? renderBudgetCards() : (
                        <EmptyState message="No budgets created for this month." />
                      )}
                    </div>
                  </div>
                )}

                {page === "analytics" && (
                  <div className="animate-in">
                    {renderSummaryCards()}

                    <div className="section-grid">
                      {renderCashFlowChart()}
                      {renderCategoryChart()}
                    </div>

                    <section className="panel">
                      <div className="panel-header">
                        <div>
                          <h3 className="panel-title">Financial Insights</h3>
                          <p className="panel-subtitle">
                            A summary based on your recorded transactions for {monthLabel(month)}.
                          </p>
                        </div>
                        <TrendingUp size={19} color="#9b8afb" />
                      </div>

                      <div className="budget-grid">
                        <div className="budget-card">
                          <div className="card-label">Income minus expenses</div>
                          <div className={`card-value ${summary.net_balance >= 0 ? "green" : "red"}`}>
                            {formatMoney(summary.net_balance)}
                          </div>
                          <p className="heading-description">
                            {summary.net_balance >= 0
                              ? "Your recorded income is higher than your expenses."
                              : "Your recorded expenses are higher than your income."}
                          </p>
                        </div>

                        <div className="budget-card">
                          <div className="card-label">Savings rate</div>
                          <div className="card-value purple">
                            {summary.savings_rate.toFixed(1)}%
                          </div>
                          <p className="heading-description">
                            Calculated as (income − expenses) ÷ income. It is 0% when income is zero.
                          </p>
                        </div>

                        <div className="budget-card">
                          <div className="card-label">Highest expense category</div>
                          <div className="card-value">
                            {summary.category_breakdown[0]?.category ?? "No data"}
                          </div>
                          <p className="heading-description">
                            {summary.category_breakdown[0]
                              ? `${formatMoney(summary.category_breakdown[0].total)} recorded in this category.`
                              : "Add expense transactions to see your top category."}
                          </p>
                        </div>

                        <div className="budget-card">
                          <div className="card-label">Budget alerts</div>
                          <div className="card-value">
                            {budgets.filter((item) => item.spent > item.monthly_limit).length}
                          </div>
                          <p className="heading-description">
                            Categories where recorded expenses exceed their monthly limit.
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </>
            )}

            <footer
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 28,
                paddingTop: 20,
                borderTop: "1px solid var(--border)",
                color: "var(--muted)",
                fontSize: 10,
              }}
            >
              <span>© {new Date().getFullYear()} FinPulse. Personal finance dashboard.</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldCheck size={13} color="#48d6a0" />
                Local database · FastAPI
              </span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;