
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
}

export interface PersonalInfo {
  name: string;
  addresses: string[];
  ssn?: string;
  dob?: string;
  employmentHistory?: string;
}

export interface CreditScore {
  score: number;
  range: string;
  provider: string;
  date: string;
}

export interface AccountSummary {
  accountType: string;
  totalAccounts: number | null;
  open: string | null;
  closed: number | null;
  balance: string | null;
  withBalance: string | null;
  totalBalance: string | null;
  available: string | null;
  creditLimit: string | null;
  debtToCredit: string | null;
  payment: string | null;
}

export interface CreditReport {
  bureau: 'Equifax' | 'Experian' | 'TransUnion' | 'Unknown';
  reportDate: string;
  personalInfo: PersonalInfo;
  accounts: Account[];
  accountSummaries?: AccountSummary[];
  inquiries: any[];
  publicRecords: any[];
  collections: any[];
  creditScores: CreditScore[];
  rawText: string;
  
  // Add reportId property to track unique reports
  reportId?: string;
  
  // Additional fields for displaying in the report
  recentInquiry?: string;
  personalInfoItemCount?: number;
  inquiryCount?: number;
  publicRecordCount?: number;
  collectionCount?: number;
  statementCount?: number;
  confirmationNumber?: string;
  creditFileStatus?: string;
  alertContacts?: string;
  averageAccountAge?: string;
  lengthOfCreditHistory?: string;
  accountsWithNegativeInfo?: string | number;
  oldestAccount?: {
    accountName: string;
    openDate: string;
  };
  recentAccount?: {
    accountName: string;
    openDate: string;
  };
  consumerName?: string;
  
  // Error information
  parsingError?: string;
}
