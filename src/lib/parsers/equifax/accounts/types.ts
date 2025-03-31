
import { AccountSummary } from "../../../types/creditReport";

// Column position mapping interface
export interface ColumnPositions {
  [key: string]: number;
}

// Define standardized column keys for account summaries
export const ACCOUNT_COLUMN_KEYS = [
  'accountType', 'open', 'withBalance', 'totalBalance', 
  'available', 'creditLimit', 'debtToCredit', 'payment'
] as const;

// Function to create empty account summaries
export function createEmptyAccountSummaries(): AccountSummary[] {
  return [
    { accountType: 'Revolving', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Mortgage', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Installment', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Other', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Total', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null }
  ];
}
