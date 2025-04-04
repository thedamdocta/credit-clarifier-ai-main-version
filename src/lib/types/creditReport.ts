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
  type: string;
  count: number;
  highCredit: number | null;
  pastDue: number | null;
  balance: number | null;
  payment: number | null;
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

export interface CreditReport {
  reportId?: string;
  fileName?: string;
  reportDate: string;
  bureau: 'Equifax' | 'Experian' | 'TransUnion' | 'Unknown';
  personalInfo: {
    name: string;
    addresses: string[];
    dateOfBirth?: string;
    phoneNumbers?: string[];
    employmentHistory?: string[];
    otherInfo?: Record<string, string>;
  };
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
}
