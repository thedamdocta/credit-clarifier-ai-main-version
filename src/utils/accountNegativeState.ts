const HARD_DEROGATORY_TEXT_PATTERNS = [
  /\bcharge(?:d)? off\b/,
  /\bcollection\b/,
  /\bbankruptcy\b/,
  /\brepossession\b/,
  /\bforeclosure\b/,
  /\bpast due\b/,
  /\bpublic record\b/,
];

const SOFT_DEROGATORY_TEXT_PATTERNS = [/\blate\b/, /\bdelinquen\w*\b/, /\bderogatory\b/, /\badverse\b/];

const NON_DEROGATORY_OVERRIDE_PATTERNS = [
  /\bno late\b/,
  /\bnever late\b/,
  /\bnot late\b/,
  /\bno delinquen\w*\b/,
  /\bnever delinquen\w*\b/,
  /\bnot delinquen\w*\b/,
  /\bno derogatory\b/,
  /\bnot derogatory\b/,
  /\bno adverse\b/,
  /\bnot adverse\b/,
  /\bpaid as agreed\b/,
  /\bcurrent account\b/,
];

const NEGATIVE_PAYMENT_CODES = new Set([
  "30",
  "60",
  "90",
  "120",
  "150",
  "180",
  "CO",
  "C/O",
  "COL",
  "R",
  "F",
  "B",
  "V",
  "VS",
  "RPO",
  "CLS",
]);

const HISTORY_MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

const NEGATIVE_LEGAL_CATEGORIES = new Set(["public record", "bankruptcy"]);

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hasNegativeText = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  const hasHardDerogatorySignal = HARD_DEROGATORY_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
  if (hasHardDerogatorySignal) {
    return true;
  }

  const hasSoftDerogatorySignal = SOFT_DEROGATORY_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!hasSoftDerogatorySignal) {
    return false;
  }

  return !NON_DEROGATORY_OVERRIDE_PATTERNS.some((pattern) => pattern.test(normalized));
};

const hasNegativePaymentCode = (value: unknown) => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim().toUpperCase();
  return NEGATIVE_PAYMENT_CODES.has(normalized);
};

const hasNegativeRows = (rows: unknown) =>
  Array.isArray(rows) &&
  rows.some((row) =>
    row && typeof row === "object"
      ? HISTORY_MONTH_KEYS.some((key) => hasNegativePaymentCode((row as Record<string, unknown>)[key]))
      : false
  );

const hasNegativeList = (values: unknown) =>
  Array.isArray(values) && values.some((entry) => hasNegativePaymentCode(entry) || hasNegativeText(entry));

const hasNegativeRecordMap = (values: unknown) =>
  Boolean(
    values &&
      typeof values === "object" &&
      !Array.isArray(values) &&
      Object.values(values as Record<string, unknown>).some((entry) => hasNegativePaymentCode(entry) || hasNegativeText(entry))
  );

export interface NegativeAccountSignals {
  explicitNegative?: boolean;
  reportingCategory?: string | null;
  legalCategory?: string | null;
  status?: string | null;
  accountStatus?: string | null;
  accountType?: string | null;
  loanType?: string | null;
  creditorClassification?: string | null;
  comments?: Array<string | null | undefined>;
  paymentHistoryRows?: unknown;
  paymentHistoryList?: unknown;
  paymentStatusCodes?: unknown;
}

export const isNegativeAccountState = (signals: NegativeAccountSignals) => {
  // This is intentionally narrower than "has a dispute reason".
  // Missing, incomplete, or inconsistent data can be dispute-worthy without being derogatory.
  if (signals.explicitNegative) {
    return true;
  }

  if (normalizeText(signals.reportingCategory) === "collection") {
    return true;
  }

  if (NEGATIVE_LEGAL_CATEGORIES.has(normalizeText(signals.legalCategory))) {
    return true;
  }

  const scalarFields = [
    signals.status,
    signals.accountStatus,
    signals.accountType,
    signals.loanType,
    signals.creditorClassification,
    ...(signals.comments ?? []),
  ];

  if (scalarFields.some((value) => hasNegativeText(value))) {
    return true;
  }

  if (hasNegativeRows(signals.paymentHistoryRows)) {
    return true;
  }

  if (hasNegativeList(signals.paymentHistoryList)) {
    return true;
  }

  if (hasNegativeRecordMap(signals.paymentStatusCodes)) {
    return true;
  }

  return false;
};
