
export type TransactionType = "income" | "expense";

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  description: string;
}

export interface CategoryTotal {
  category: string;
  total: number;
}

export interface MonthlyTrend {
  month: string;
  income: number;
  expense: number;
}

export interface Summary {
  total_income: number;
  total_expense: number;
  net_balance: number;
  savings_rate: number;
  transaction_count: number;
  category_breakdown: CategoryTotal[];
  monthly_trend: MonthlyTrend[];
  month: string | null;
}

export interface Budget {
  id: number;
  category: string;
  monthly_limit: number;
  spent: number;
  remaining: number;
  percent_used: number;
  month: string;
}
