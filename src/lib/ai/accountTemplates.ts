import { Account, MonthlyHistoryEntry } from "@/lib/types/creditReport";

const DEFAULT_PAYMENT_STATUS_CODES: Record<string, string> = {
  "30": "30 days late",
  "60": "60 days late",
  "90": "90 days late",
  "120": "120 days late",
  "150": "150 days past due",
  "180": "180 days past due",
  "OK": "Payment made on time",
  "COL": "In collections",
  "C": "Collection account",
  "CO": "Charge-off",
  "R": "Repossession",
  "F": "Foreclosure",
  "V": "Voluntary surrender",
  "B": "Included in bankruptcy",
  "TNT": "Too new to rate",
  "X": "No data available"
};

const DEFAULT_YEARS = ["-", "-", "-"];

const createMonthlyHistoryEntry = (year: string = "-"): MonthlyHistoryEntry => ({
  year,
  jan: "-",
  feb: "-",
  mar: "-",
  apr: "-",
  may: "-",
  jun: "-",
  jul: "-",
  aug: "-",
  sep: "-",
  oct: "-",
  nov: "-",
  dec: "-"
});

const createMonthlyHistory = (years: string[] = DEFAULT_YEARS): MonthlyHistoryEntry[] => {
  return years.map((year) => createMonthlyHistoryEntry(year));
};

const createPaymentHistory = (length: number = 36): string[] => Array.from({ length }, () => "-");

export const createDefaultAccount = (overrides: Partial<Account> = {}): Account => {
  const {
    accountName = "Sample Account",
    accountNumber = "XXXX-XXXX-XXXX-1234",
    accountType = "Not reported",
    accountCategory = "Not reported",
    accountOwnership = "Not reported",
    openDate = "Not reported",
    status = "Not reported"
  } = overrides;

  return {
    accountName,
    accountNumber,
    accountType,
    accountCategory,
    accountOwnership,
    openDate,
    status,
    balance: "Not reported",
    balanceHistory: createMonthlyHistory(),
    scheduledPaymentHistory: createMonthlyHistory(),
    actualPaymentHistory: createMonthlyHistory(),
    creditLimitHistory: createMonthlyHistory(),
    amountPastDueHistory: createMonthlyHistory(),
    activityDesignatorHistory: createMonthlyHistory(),
    paymentHistory: createPaymentHistory(),
    paymentStatusCodes: { ...DEFAULT_PAYMENT_STATUS_CODES },
    creditLimit: "Not reported",
    highestBalance: "Not reported",
    highCredit: "Not reported",
    paymentStatus: "Not reported",
    dateOpened: "Not reported",
    dateReported: "Not reported",
    dateClosed: "Not reported",
    lastPaymentDate: "Not reported",
    dateOfLastActivity: "Not reported",
    dateOfFirstDelinquency: "Not reported",
    delinquencyFirstReported: "Not reported",
    deferredPaymentStartDate: "Not reported",
    balloonPaymentDate: "Not reported",
    currentBalance: "Not reported",
    paymentAmount: "Not reported",
    actualPaymentAmount: "Not reported",
    scheduledPaymentAmount: "Not reported",
    amountPastDue: "Not reported",
    chargeOffAmount: "Not reported",
    balloonPaymentAmount: "Not reported",
    creditType: "Not reported",
    loanType: "Not reported",
    responsibility: "Not reported",
    paymentResponsibility: "Not reported",
    termsFrequency: "Not reported",
    termDuration: "Not reported",
    monthsReviewed: "Not reported",
    activityDesignator: "Not reported",
    creditorClassification: "Not reported",
    accountStatus: "Not reported",
    comments: ["Not reported"],
    contact: [],
    totalAccounts: 0,
    openAccounts: 0,
    closedAccounts: 0,
    debugPages: [],
    debugPageImages: [],
    debugSnippet: "",
    ...overrides
  };
};

const mergeMonthlyHistory = (
  defaults: MonthlyHistoryEntry[] | undefined,
  incoming: MonthlyHistoryEntry[] | undefined
): MonthlyHistoryEntry[] | undefined => {
  if (!defaults && !incoming) return undefined;
  if (!incoming || incoming.length === 0) return defaults;

  const result = (defaults || createMonthlyHistory()).map((entry, index) => {
    const source = incoming[index] || {};
    return {
      year: source.year ?? entry.year,
      jan: source.jan ?? entry.jan,
      feb: source.feb ?? entry.feb,
      mar: source.mar ?? entry.mar,
      apr: source.apr ?? entry.apr,
      may: source.may ?? entry.may,
      jun: source.jun ?? entry.jun,
      jul: source.jul ?? entry.jul,
      aug: source.aug ?? entry.aug,
      sep: source.sep ?? entry.sep,
      oct: source.oct ?? entry.oct,
      nov: source.nov ?? entry.nov,
      dec: source.dec ?? entry.dec
    };
  });

  return result;
};

const mergeStringArray = (defaults: string[] = [], incoming?: string[]): string[] => {
  if (!incoming || incoming.length === 0) return defaults;
  return incoming;
};

export const mergeAccountWithDefaults = (partial: Partial<Account>, base?: Account): Account => {
  const defaults = base ?? createDefaultAccount({
    accountName: partial.accountName,
    accountNumber: partial.accountNumber,
    accountType: partial.accountType,
    accountCategory: partial.accountCategory,
    accountOwnership: partial.accountOwnership,
    openDate: partial.openDate,
    status: partial.status
  });

  return {
    ...defaults,
    ...partial,
    balanceHistory: mergeMonthlyHistory(defaults.balanceHistory, partial.balanceHistory),
    scheduledPaymentHistory: mergeMonthlyHistory(defaults.scheduledPaymentHistory, partial.scheduledPaymentHistory),
    actualPaymentHistory: mergeMonthlyHistory(defaults.actualPaymentHistory, partial.actualPaymentHistory),
    creditLimitHistory: mergeMonthlyHistory(defaults.creditLimitHistory, partial.creditLimitHistory),
    amountPastDueHistory: mergeMonthlyHistory(defaults.amountPastDueHistory, partial.amountPastDueHistory),
    activityDesignatorHistory: mergeMonthlyHistory(defaults.activityDesignatorHistory, partial.activityDesignatorHistory),
    paymentHistory: mergeStringArray(defaults.paymentHistory, partial.paymentHistory),
    paymentStatusCodes: {
      ...(defaults.paymentStatusCodes ?? {}),
      ...(partial.paymentStatusCodes ?? {})
    },
    comments: mergeStringArray(defaults.comments, partial.comments),
    contact: mergeStringArray(defaults.contact, partial.contact),
    debugPages: partial.debugPages ?? defaults.debugPages ?? [],
    debugPageImages: partial.debugPageImages ?? defaults.debugPageImages ?? [],
    debugSnippet: partial.debugSnippet ?? defaults.debugSnippet ?? ""
  };
};

export const defaultPaymentStatusCodes = DEFAULT_PAYMENT_STATUS_CODES;
