
export interface CreditReport {
  reportId: string;
  userId: string;
  datePulled: string;
  creditScore: number | null;
  creditScoreFactors: string[];
  totalAccounts: number | null;
  openAccounts: number | null;
  closedAccounts: number | null;
  creditUtilization: number | null;
  totalCreditLines: number | null;
  totalDebt: number | null;
  rawText: string;
  accountSummaries?: AccountSummary[];
  collections?: Collection[];
  accounts?: Account[];
}

export interface AccountSummary {
  accountType: string | null;
  totalAccounts: number | null;
  open: number | null | string;
  closed: number | null;
  balance: number | null;
  withBalance: number | null | string;
  totalBalance: string | null;
  available: string | null;
  creditLimit: string | null;
  debtToCredit: string | null;
  payment: string | null;
}

export interface Collection {
  dateReported: string | null;
  collectionAgency: string | null;
  balanceDate: string | null;
  originalCreditorName: string | null;
  accountDesignatorCode: string | null;
  dateAssigned: string | null;
  accountNumber: string | null;
  originalAmountOwed: string | null;
  creditorClassification: string | null;
  amount: string | null;
  lastPaymentDate: string | null;
  statusDate: string | null;
  dateOfFirstDelinquency: string | null;
  status: string | null;
  comments: string | null;
  contact: string | null;
}

export interface Account {
  accountName: string;
  accountNumber: string;
  accountType: string;
  openDate: string;
  status: string;
  balance: string | null;
  paymentHistory: string[];
  creditLimit?: string | null;
  highestBalance?: string | null;
  paymentStatus?: string;
  totalAccounts?: number;
  openAccounts?: number;
  closedAccounts?: number;
  comments?: string[];
}
