

export interface Account {
  accountName: string;
  accountNumber: string;
  accountType: string;
  openDate: string;
  status: string;
  balance: number | null;
  paymentHistory: string[];
  comments?: string[];
}

export interface AccountSummary {
  // Required properties from the original interface
  type: string;
  count: number;
  highCredit: number | null;
  pastDue: number | null;
  balance: number | null;
  payment: number | null;
  
  // Additional properties used in the codebase
  accountType: string;
  totalAccounts: number | null;
  open: string | number | null;
  withBalance: string | number | null;
  closed: string | number | null;
  totalBalance: string | number | null;
  available: string | number | null;
  creditLimit: string | number | null;
  debtToCredit: string | number | null;
}

export interface Inquiry {
  date: string;
  company: string;
}

export interface PublicRecord {
  date: string;
  type: string;
  description: string;
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
  amount: number | null;
  lastPaymentDate: string | null;
  statusDate: string | null;
  dateOfFirstDelinquency: string | null;
  status: string | null;
  comments?: string[];
  contact?: string[];
}

export interface CreditScore {
  date: string;
  score: number;
  type: string;
  range: string;
  provider?: string;
}

export interface Alert {
  type: string;
  description: string;
}

export interface HardInquiry {
  date: string | null;
  company: string | null;
  requestOriginator: string | null;
}

export interface SoftInquiry {
  date: string | null;
  company: string | null;
  requestOriginator: string | null;
  description: string | null;
}

export interface PersonalInfo {
  name: string;
  addresses: string[];
  ssn?: string;
  dob?: string;
  phoneNumbers?: string[];
  employmentHistory?: string[];
  otherInfo?: Record<string, string>;
}

export interface CreditReport {
  reportId?: string;
  fileName?: string;
  reportDate: string;
  bureau: 'Equifax' | 'Experian' | 'TransUnion' | 'Unknown';
  personalInfo: PersonalInfo;
  accounts: Account[];
  accountSummaries?: AccountSummary[];
  inquiries: Inquiry[];
  publicRecords: PublicRecord[];
  collections: Collection[];
  creditScores: CreditScore[];
  alerts?: Alert[];
  fileNumber?: string;
  hardInquiries?: HardInquiry[];
  softInquiries?: SoftInquiry[];
  
  // Additional fields used in the codebase
  rawText?: string;
  consumerName?: string;
  confirmationNumber?: string;
  creditFileStatus?: string;
  alertContacts?: string;
  averageAccountAge?: string;
  lengthOfCreditHistory?: string;
  accountsWithNegativeInfo?: number | string;
  oldestAccount?: { name: string; date: string };
  recentAccount?: { name: string; date: string };
  statementCount?: number;
  personalInfoItemCount?: number;
  inquiryCount?: number;
  recentInquiry?: string;
  publicRecordCount?: number;
  collectionCount?: number;
  parsingError?: string;
}

