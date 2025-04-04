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
  comments?: string[]; // Adding comments property
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
  comments: string[];
  contact: string[];
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
  open: string | null; // Changed: always string or null, not number
  closed: number | null;
  balance: string | null;
  withBalance: string | null; // Changed: always string or null, not number
  totalBalance: string | null; // Changed: always string or null, not number
  available: string | null; // Changed: always string or null, not number
  creditLimit: string | null; // Changed: always string or null, not number
  debtToCredit: string | null; // Changed: always string or null, not number
  payment: string | null; // Changed: always string or null, not number
}

export interface CreditReport {
  bureau: 'Equifax' | 'Experian' | 'TransUnion' | 'Unknown';
  reportDate: string;
  personalInfo: PersonalInfo;
  accounts: Account[];
  collections: Collection[]; // Add collections array
  accountSummaries?: AccountSummary[];
  inquiries: any[];
  publicRecords: any[];
  creditScores: CreditScore[];
  rawText: string;
  
  // Add reportId property to track unique reports
  reportId?: string;
  
  // Add fileName property to track the original file name
  fileName?: string;
  
  // Add targetTable property to specify which table to extract
  targetTable?: string;
  
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

export interface Inquiry {
  type: 'hard' | 'soft';
  date: string;
  company: string;
  requestor: string;
  description?: string;
  accountNumber?: string;
}
