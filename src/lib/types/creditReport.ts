
export interface MonthlyHistoryEntry {
  year: string;
  jan: string;
  feb: string;
  mar: string;
  apr: string;
  may: string;
  jun: string;
  jul: string;
  aug: string;
  sep: string;
  oct: string;
  nov: string;
  dec: string;
}

export type SourceComponentKey =
  | "reportConfirmationDetails"
  | "personalInformation"
  | "summary"
  | "creditAccountsSummary"
  | "otherItemsSummary"
  | "accounts"
  | "collections"
  | "inquiries"
  | "reportOverview"
  | "adverseAccounts"
  | "satisfactoryAccounts"
  | "publicRecords"
  | "hardInquiries"
  | "softInquiries"
  | "accountReviewInquiries"
  | "creditReportMessages"
  | "additionalInformation"
  | "consumerInformationIndicators";

export interface SourceSection {
  pages: number[];
}

export interface Account {
  accountName: string;
  accountNumber: string;
  isClosed?: boolean;
  address?: string;
  phoneNumber?: string;
  accountType: string;
  accountCategory?: string;
  accountOwnership?: string;
  openDate: string;
  status: string;
  balance: string | null;
  balanceHistory?: MonthlyHistoryEntry[];
  scheduledPaymentHistory?: MonthlyHistoryEntry[];
  actualPaymentHistory?: MonthlyHistoryEntry[];
  creditLimitHistory?: MonthlyHistoryEntry[];
  amountPastDueHistory?: MonthlyHistoryEntry[];
  activityDesignatorHistory?: MonthlyHistoryEntry[];
  paymentHistory: string[];
  paymentHistoryYears?: string[];
  paymentStatusCodes?: Record<string, string>;
  creditLimit?: string | null;
  highestBalance?: string | null;
  highCredit?: string | null;
  paymentStatus?: string;
  dateOpened?: string;
  dateReported?: string;
  dateClosed?: string;
  lastPaymentDate?: string;
  dateOfLastActivity?: string;
  dateOfFirstDelinquency?: string;
  delinquencyFirstReported?: string;
  deferredPaymentStartDate?: string;
  balloonPaymentDate?: string;
  currentBalance?: string | null;
  paymentAmount?: string | null;
  actualPaymentAmount?: string | null;
  scheduledPaymentAmount?: string | null;
  amountPastDue?: string | null;
  chargeOffAmount?: string | null;
  balloonPaymentAmount?: string | null;
  creditType?: string;
  loanType?: string;
  responsibility?: string;
  paymentResponsibility?: string;
  termsFrequency?: string;
  termDuration?: string;
  monthsReviewed?: string;
  activityDesignator?: string;
  creditorClassification?: string;
  accountStatus?: string;
  accountSubtype?: string;
  accountSubtypeSourceText?: string;
  reportingCategory?: string;
  legalCategory?: string;
  portfolioType?: string;
  specialCommentCode?: string;
  complianceConditionCode?: string;
  consumerInformationIndicator?: string;
  paymentRating?: string;
  ecoaCode?: string;
  additionalInformation?: string[];
  consumerStatement?: string[];
  reinvestigationInfo?: string[];
  comments?: string[];
  contact?: string[];
  totalAccounts?: number;
  openAccounts?: number;
  closedAccounts?: number;
  sourcePages?: number[];
  debugPages?: string[];
  debugPageImages?: string[];
  debugSnippet?: string;
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
  accountSubtype?: string;
  reportingCategory?: string;
  legalCategory?: string;
  sourceText?: string;
  details?: string[];
  sourcePages?: number[];
}

export interface PublicRecord {
  recordType?: string | null;
  court?: string | null;
  referenceNumber?: string | null;
  status?: string | null;
  amount?: string | null;
  dateFiled?: string | null;
  dateResolved?: string | null;
  datePaid?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  courtType?: string | null;
  dateUpdated?: string | null;
  estimatedRemoval?: string | null;
  plaintiffAttorney?: string | null;
  responsibility?: string | null;
  liability?: string | null;
  summary?: string | null;
  details?: string[];
  sourcePages?: number[];
}

export interface ConsumerInformationIndicator {
  code?: string | null;
  description: string;
  category?: string | null;
  sourcePages?: number[];
  linkedAccountName?: string | null;
  linkedAccountNumber?: string | null;
}

export interface Inquiry {
  subscriberName: string | null;
  inquiryDate: string | null;
  purpose: string | null;
  permissiblePurpose: string | null;
  contact: string | null;
  referenceNumber: string | null;
  inquiryType?: "hard" | "soft";
}

export interface PersonalInfo {
  name: string;
  addresses: string[];
  currentAddresses?: string[];
  previousAddresses?: string[];
  ssn?: string;
  socialSecurityNumbers?: string[];
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
  profileId?: string;
  reportDate: string;
  personalInfo: PersonalInfo;
  accounts: Account[];
  collections?: Collection[];
  accountSummaries?: AccountSummary[];
  inquiries: Inquiry[];
  publicRecords: PublicRecord[];
  consumerInformationIndicators?: ConsumerInformationIndicator[];
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
  componentStatus?: Record<string, "complete" | "failed">;
  validationIssues?: Array<{
    component: string;
    severity: string;
    code: string;
    message: string;
  }>;
  readyForAttorney?: boolean;
  components?: Record<string, unknown>;
  inquiryBuckets?: {
    hardInquiries: Inquiry[];
    softInquiries: Inquiry[];
    hardInquiryCount: number;
    softInquiryCount: number;
  };
  sourceSessionId?: string;
  sourceComponents?: Partial<Record<SourceComponentKey, SourceSection>>;
  
  // Error information
  parsingError?: string;
}

export interface RetrievedCreditReportAsset {
  bureau: string;
  bureauKey: string;
  fileName: string;
  downloadUrl: string;
  sizeBytes: number | null;
  createdAt: string;
  extractionStatus: "pending_approval" | "processing" | "ready" | "failed";
  extractionError?: string | null;
  extractedReport?: CreditReport | null;
}
