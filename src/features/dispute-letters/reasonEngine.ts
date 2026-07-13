import type { Account, ConsumerInformationIndicator, CreditReport, PublicRecord } from "@/lib/types/creditReport";
import {
  AccountRuleCatalogGroup,
  AccountPosture,
  AccountRuleCategoryGroup,
  DisputeLetterIntake,
  ManualAccountReason,
  DisputeReason,
  DisputeReasonCategory,
  DisputeReasonEvidence,
  DisputeReasonEvidenceRef,
  DisputeRuleEvaluation,
  DisputeRuleStatus,
  DisputeSelectionBasis,
} from "./types";

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

const normalizeText = (value: string | null | undefined) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeMatchText = (value: string | null | undefined) => normalizeText(value).toLowerCase();
const normalizePages = (pages?: number[]) => Array.from(new Set((pages ?? []).filter((page) => Number.isInteger(page) && page > 0)));
const canonicalIdentityText = (value: string | null | undefined) =>
  normalizeMatchText(value)
    .replace(/\bjunior\b/g, "jr")
    .replace(/\bsenior\b/g, "sr")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9]/g, "");

const EMPTY_FIELD_TOKENS = new Set([
  "",
  "-",
  "--",
  "---",
  "blank",
  "n/a",
  "n/r",
  "no data",
  "none",
  "none reported",
  "not reported",
  "not available",
  "unknown",
]);
const EMPTY_HISTORY_TOKENS = new Set(["", "-", "--", "---", "x", "nd", "not reported", "not available", "unknown"]);
const CURRENT_HISTORY_TOKENS = new Set(["ok", "current", "paid as agreed", "terms met"]);
const DEROGATORY_HISTORY_TOKENS = new Set(["30", "60", "90", "120", "150", "180", "c", "col", "co", "r", "f", "v", "b", "vs"]);
const COLLECTION_STATUS_TOKENS = [
  "collection",
  "placed for collection",
  "collection account",
  "debt buyer",
  "factoring company",
];
const DEROGATORY_STATUS_TOKENS = [
  "past due",
  "charge off",
  "charged off",
  "collection",
  "repo",
  "repossession",
  "foreclosure",
  "written off",
  "delinquen",
  "late",
];
const PAYMENT_PLAN_TOKENS = [
  "payment plan",
  "payment arrangement",
  "repayment plan",
  "installment arrangement",
  "settlement",
  "settled",
  "deferred",
  "forbearance",
];
const LITIGATION_CONTEXT_TOKENS = [
  "account in litigation",
  "in litigation",
  "litigation",
];
const PUBLIC_RECORD_RESTRICTED_TOKENS = [
  "vacated",
  "dismissed",
  "withdrawn",
  "sealed",
  "expunged",
  "released",
  "satisfied",
];
const PUBLIC_RECORD_ACTIVE_ADVERSE_TOKENS = [
  "open",
  "pending",
  "filed",
  "active",
  "unsatisfied",
  "judgment",
  "bankruptcy",
];
const BANKRUPTCY_CONTEXT_TOKENS = [
  "bankruptcy",
  "chapter 7",
  "chapter 11",
  "chapter 13",
  "included in bankruptcy",
  "discharged through bankruptcy",
];
const INSTALLMENT_ACCOUNT_TOKENS = [
  "installment",
  "mortgage",
  "student",
  "loan",
  "auto",
  "personal",
];
const REVOLVING_ACCOUNT_TOKENS = [
  "revolving",
  "credit card",
  "card",
  "line of credit",
];
const THIRD_PARTY_COLLECTION_TOKENS = [
  "collection",
  "recovery",
  "portfolio",
  "midland",
  "lvnv",
  "cavalry",
  "credit management",
  "debt buyer",
  "asset acceptance",
  "resurgent",
  "allianceone",
];
const STUDENT_LOAN_SERVICER_TOKENS = [
  "dept of ed",
  "department of education",
  "us dept of education",
  "u.s. dept of education",
  "aidv",
  "aidvantage",
  "navient",
  "nelnet",
  "mohela",
  "edfinancial",
  "fedloan",
  "great lakes",
  "sallie mae",
  "aes/pheaa",
  "pheaa",
];
const STUDENT_LOAN_TYPE_TOKENS = ["student loan", "education loan", "education", "student"];
const EXPLICIT_NON_STUDENT_LOAN_TOKENS = [
  "auto loan",
  "auto",
  "lease",
  "mortgage",
  "credit card",
  "card",
  "collection",
  "revolving",
  "secured",
  "line of credit",
  "personal loan",
  "personal",
  "debt buyer",
  "factoring",
];
const ATTORNEY_ESCALATION_ISSUE_TYPES = new Set([
  "multiple_social_security_numbers",
]);

const ISSUE_CATEGORY_MAP: Record<string, DisputeReasonCategory> = {
  duplicate_conflicting_tradeline: "account_identity",
  missing_account_number: "account_identity",
  missing_furnisher_identification: "account_identity",
  missing_account_status: "account_identity",
  responsibility_requires_special_handling: "account_identity",
  incomplete_original_creditor_identity: "account_identity",
  student_loan_lender_identity_mismatch: "account_identity",
  account_in_litigation: "legal_public_record",
  public_record_missing_core_details: "legal_public_record",
  public_record_duplicate_reporting: "legal_public_record",
  public_record_obsolete_reporting: "legal_public_record",
  public_record_restricted_or_vacated_context: "legal_public_record",
  consumer_information_indicator_missing_core_details: "legal_public_record",
  consumer_information_indicator_account_conflict: "legal_public_record",
  missing_payment_history: "payment_history",
  payment_history_missing_months: "payment_history",
  payment_history_incomplete_since_open_date: "payment_history",
  payment_history_24_month_past_due_conflict: "payment_history",
  past_due_without_monthly_support: "payment_history",
  amount_past_due_history_conflict: "payment_history",
  payment_history_24_month_activity_conflict: "payment_history",
  recent_payment_missing_when_history_implies_payment: "payment_history",
  monthly_payment_missing_for_open_installment: "payment_history",
  delinquency_progression_inconsistency: "payment_history",
  derogatory_status_without_monthly_support: "payment_history",
  severe_delinquency_jump_without_predecessor_support: "payment_history",
  reaging_jump_after_current_reset: "payment_history",
  first_30_day_late_without_prior_reporting_support: "payment_history",
  first_derogatory_month_without_prior_reporting_support: "payment_history",
  blank_gap_before_derogatory_month: "payment_history",
  retroactive_derogatory_backfill_after_reporting_gap: "payment_history",
  charge_off_or_collection_without_monthly_build_up: "payment_history",
  payment_plan_or_forbearance_context_without_history: "payment_history",
  payment_plan_or_forbearance_context_with_derogatory_conflict: "payment_history",
  payment_activity_conflicts_with_delinquency_progression: "payment_history",
  balance_reduction_conflicts_with_worsening_delinquency: "payment_history",
  thirty_day_late_without_full_30_day_interval: "payment_history",
  last_payment_date_without_scheduled_payment_amount: "payment_history",
  last_payment_date_without_payment_amount: "payment_history",
  scheduled_payment_amount_without_terms: "payment_history",
  closed_account_final_month_reporting_incomplete: "payment_history",
  closed_account_actual_payment_conflicts_with_closure_month_history: "payment_history",
  missing_current_balance_field: "balance_amount",
  closed_account_missing_closure_timing: "date_reporting_timeline",
  date_of_first_delinquency_conflict: "date_reporting_timeline",
  status_updated_timeline_conflict: "date_reporting_timeline",
  balance_updated_timeline_conflict: "date_reporting_timeline",
  on_record_until_conflict: "date_reporting_timeline",
  high_balance_not_supported_by_history: "balance_amount",
  balance_history_monthly_gap_conflict: "balance_amount",
  credit_limit_not_supported_by_history: "balance_amount",
  insufficient_balance_history: "balance_amount",
  payment_history_balance_history_conflict: "balance_amount",
  charge_off_without_chargeoff_history: "charge_off_collection",
  collection_payment_activity_conflict: "charge_off_collection",
  missing_reporting_date: "date_reporting_timeline",
  missing_status_updated_date: "date_reporting_timeline",
  missing_balance_updated_date: "date_reporting_timeline",
  personal_information_name_mismatch: "personal_information",
  personal_information_address_mismatch: "personal_information",
  multiple_social_security_numbers: "attorney_escalation",
  report_review_request: "report_review",
};

const ACCOUNT_RULE_CATEGORY_ORDER: DisputeReasonCategory[] = [
  "account_identity",
  "payment_history",
  "balance_amount",
  "charge_off_collection",
  "legal_public_record",
  "date_reporting_timeline",
];

const ACCOUNT_RULE_CATEGORY_LABELS: Record<DisputeReasonCategory, string> = {
  account_identity: "Identity",
  payment_history: "Payment History",
  balance_amount: "Balance / Amounts",
  charge_off_collection: "Collection / Charge-Off",
  legal_public_record: "Legal / Public Record",
  date_reporting_timeline: "Status / Dates",
  tradeline_integrity: "Identity",
  personal_information: "Personal Information",
  attorney_escalation: "Attorney Escalation",
  report_review: "Report Review",
};

type AnyRecord = Record<string, unknown>;
type HistoryMonthKey = `${string}-${typeof MONTH_KEYS[number]}`;

interface HistoryCell {
  year: string;
  month: (typeof MONTH_KEYS)[number];
  value: string;
  state?: string;
  source?: string;
  provenanceId?: string;
}

interface HistorySequenceConflict {
  current: HistoryCell;
  previous: HistoryCell | null;
  gapMonths?: HistoryMonthKey[];
}

interface PaymentActivityConflict {
  current: HistoryCell;
  previous: HistoryCell | null;
  gapMonths?: HistoryMonthKey[];
  paidAmountCell?: HistoryCell;
  scheduledAmountCell?: HistoryCell;
  paidAmountValue?: string;
  scheduledAmountValue?: string;
  lastPaymentValue?: string;
  useLastPaymentField?: boolean;
  recentPaymentValue?: string;
}

interface BalanceReductionConflict {
  current: HistoryCell;
  previous: HistoryCell;
  previousBalanceValue: string;
  currentBalanceValue: string;
}

type ReportedMoneyFieldState =
  | "present_with_value"
  | "present_with_zero"
  | "present_explicit_not_reported"
  | "missing_field";

interface ReportedMoneyFieldObservation {
  value: string;
  state: ReportedMoneyFieldState;
  sourceKey?: string;
}

type LastPaymentSignalKind = "" | "actual_payment_amount" | "last_payment_date";

interface DayLevelTimingSignal {
  date: Date;
  dateText: string;
  monthKey: HistoryMonthKey;
  label: string;
  amountValue?: string;
}

interface ThirtyDayLateIntervalConflict {
  current: HistoryCell;
  currentSignal: DayLevelTimingSignal;
  previousSignal: DayLevelTimingSignal;
  intervalDays: number;
  corroboratingPaidAmountValue?: string;
  previousBalanceValue?: string;
  currentBalanceValue?: string;
}

interface ReasonAccountView {
  displayName: string;
  accountTypeText: string;
  accountCategoryText: string;
  accountSubtypeText: string;
  reportingCategoryText: string;
  legalCategoryText: string;
  consumerInformationIndicatorText: string;
  accountNumber: string;
  entityKey: string;
  sourcePages: number[];
  statusText: string;
  responsibilityText: string;
  addressText: string;
  phoneText: string;
  comments: string[];
  additionalInformationLines: string[];
  consumerStatementLines: string[];
  reinvestigationInfoLines: string[];
  paymentHistory: string[];
  paymentHistoryYears: string[];
  paymentHistoryCells: HistoryCell[];
  paymentHistoryGapCells: HistoryCell[];
  balanceHistoryValues: string[];
  balanceHistoryCells: HistoryCell[];
  paidAmountHistoryCells: HistoryCell[];
  scheduledPaymentHistoryCells: HistoryCell[];
  amountPastDueHistoryValues: string[];
  amountPastDueHistoryCells: HistoryCell[];
  creditLimitHistoryValues: string[];
  creditLimitHistoryCells: HistoryCell[];
  reportedBalanceValue: string;
  reportedBalanceFieldState: ReportedMoneyFieldState;
  reportedPaymentAmountValue: string;
  reportedPaymentAmountFieldState: ReportedMoneyFieldState;
  reportedScheduledPaymentAmountValue: string;
  reportedScheduledPaymentAmountFieldState: ReportedMoneyFieldState;
  reportedLastPaymentDateValue: string;
  balanceValue: string;
  originalBalanceValue: string;
  amountPastDueValue: string;
  chargeOffAmountValue: string;
  creditLimitValue: string;
  highestBalanceValue: string;
  originalCreditorText: string;
  paymentAmountValue: string;
  scheduledPaymentAmountValue: string;
  recentPaymentValue: string;
  lastPaymentDateValue: string;
  dateOfFirstDelinquencyValue: string;
  dateOpenedValue: string;
  dateReportedValue: string;
  dateClosedValue: string;
  closureTimingValue: string;
  closureMonthKey: HistoryMonthKey | "";
  closureMonthPaymentStatus: string;
  closureMonthActualPaymentValue: string;
  closureMonthHasTableActivity: boolean;
  lastPaymentSignalValue: string;
  lastPaymentSignalKind: LastPaymentSignalKind;
  paymentTimingSignals: DayLevelTimingSignal[];
  reportingTimingSignals: DayLevelTimingSignal[];
  statusUpdatedValue: string;
  balanceUpdatedValue: string;
  estimatedRemovalValue: string;
  termsFrequencyValue: string;
  termDurationValue: string;
  monthsReviewedValue: string;
  isClosed: boolean;
  month24Sections?: Record<string, HistoryCell[]>;
  month24NarrativeCodes?: string[];
}

interface AccountRuleDefinition {
  ruleId?: string;
  issueType: string;
  issueLabel: string;
  category: DisputeReasonCategory;
  description: string;
  applies: (account: ReasonAccountView, report: CreditReport) => boolean;
  canEvaluate: (account: ReasonAccountView, report: CreditReport) => boolean;
}

type BuildReasonPartial = Omit<
  DisputeReason,
  "selected" | "defaultSelected" | "selectionBasis" | "category" | "isAttorneyEscalation" | "evidence" | "evidenceRefs"
> & {
  selected?: boolean;
  defaultSelected?: boolean;
  selectionBasis?: DisputeSelectionBasis;
  category?: DisputeReasonCategory;
  isAttorneyEscalation?: boolean;
  evidence?: DisputeReasonEvidence;
  evidenceRefs?: DisputeReasonEvidenceRef[];
};

const isMissing = (value: string | null | undefined) => EMPTY_FIELD_TOKENS.has(normalizeMatchText(value));
const isIncompleteAccountIdentifier = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (isMissing(normalized)) {
    return true;
  }

  const alphanumeric = normalized.replace(/[^a-z0-9]/gi, "");
  if (!alphanumeric) {
    return true;
  }

  if (/[*#x]/i.test(normalized)) {
    return true;
  }

  return alphanumeric.length < 6;
};
const accountEntityKey = (accountName: string, accountNumber: string) => `${normalizeMatchText(accountName)}::${normalizeText(accountNumber)}`;
const hasAccountIdentity = (accountName: string, accountNumber: string) => Boolean(normalizeText(accountName) || normalizeText(accountNumber));
const hasHistoryTableValue = (value: string | null | undefined) => !isMissing(value) && !isBlankHistoryValue(value);
const deriveClosureTimingValue = (
  isClosed: boolean,
  dateClosedValue: string,
  statusUpdatedValue: string,
  balanceUpdatedValue: string,
) => (isClosed ? firstNonEmptyText(dateClosedValue, statusUpdatedValue, balanceUpdatedValue) : "");
const deriveClosureMonthKey = (closureTimingValue: string, reportedLastPaymentDateValue: string) => {
  const closureDate = parseDateLike(closureTimingValue) ?? parseDateLike(reportedLastPaymentDateValue);
  return closureDate ? historyMonthKeyFromDate(closureDate) : "";
};
const deriveLastPaymentSignal = (
  reportedPaymentAmountValue: string,
  reportedLastPaymentDateValue: string,
): { value: string; kind: LastPaymentSignalKind } => {
  if (!isMissing(reportedPaymentAmountValue)) {
    return { value: reportedPaymentAmountValue, kind: "actual_payment_amount" };
  }
  if (!isMissing(reportedLastPaymentDateValue)) {
    return { value: reportedLastPaymentDateValue, kind: "last_payment_date" };
  }
  return { value: "", kind: "" };
};
const deriveClosureMonthFacts = (
  closureMonthKey: HistoryMonthKey | "",
  paymentHistoryCells: HistoryCell[],
  actualPaymentHistoryCells: HistoryCell[],
  extraTableCells: HistoryCell[] = [],
) => {
  if (!closureMonthKey) {
    return {
      closureMonthPaymentStatus: "",
      closureMonthActualPaymentValue: "",
      closureMonthHasTableActivity: false,
    };
  }

  const paymentHistoryLookup = toHistoryLookup(paymentHistoryCells);
  const actualPaymentLookup = toHistoryLookup(actualPaymentHistoryCells);
  const extraTableLookup = toHistoryLookup(extraTableCells);
  const closureMonthPaymentStatus = paymentHistoryLookup.get(closureMonthKey) ?? "";
  const closureMonthActualPaymentValue = actualPaymentLookup.get(closureMonthKey) ?? "";
  const closureMonthHasTableActivity =
    hasHistoryTableValue(closureMonthPaymentStatus) ||
    hasHistoryTableValue(closureMonthActualPaymentValue) ||
    hasHistoryTableValue(extraTableLookup.get(closureMonthKey) ?? "");

  return {
    closureMonthPaymentStatus,
    closureMonthActualPaymentValue,
    closureMonthHasTableActivity,
  };
};

const buildReason = (partial: BuildReasonPartial): DisputeReason => {
  return {
    ...partial,
    category: partial.category,
    defaultSelected: partial.defaultSelected,
    selectionBasis: partial.selectionBasis,
    selected: partial.selected ?? partial.defaultSelected,
    isAttorneyEscalation: partial.isAttorneyEscalation,
    evidence: partial.evidence ?? {
      comparedFields: partial.supportingFields,
      scalarComparisons: partial.supportingFacts.map((fact) => ({ label: "Report evidence", value: fact })),
    },
    evidenceRefs: partial.evidenceRefs,
  };
};

const isExperianProvenanceProfile = (report: CreditReport) => report.profileId === "experian_acr_v1";

const fieldEvidenceRefId = (entityKey: string, fieldName: string) => `account:${entityKey}:field:${fieldName}`;
const historyCellEvidenceRefId = (entityKey: string, fieldName: string, year: string, month: string) =>
  `account:${entityKey}:history:${fieldName}:${year}:${month}`;
const historyLatestEvidenceRefId = (entityKey: string, fieldName: string) => `account:${entityKey}:history-latest:${fieldName}`;
const historyMaxEvidenceRefId = (entityKey: string, fieldName: string) => `account:${entityKey}:history-max:${fieldName}`;
const historyGapEvidenceRefId = (entityKey: string, fieldName: string, year: string, month: string) =>
  `account:${entityKey}:history-gap:${fieldName}:${year}:${month}`;

const buildFieldEvidenceRef = (
  entityKey: string,
  fieldName: string,
  label: string,
  slideId: string,
  slideLabel: string,
): DisputeReasonEvidenceRef => ({
  refId: fieldEvidenceRefId(entityKey, fieldName),
  kind: "field",
  fieldName,
  label,
  slideId,
  slideLabel,
});

const buildHistoryCellEvidenceRef = (
  entityKey: string,
  fieldName: string,
  year: string,
  month: string,
  label: string,
  slideId: string,
  slideLabel: string,
  expectedValue?: string,
): DisputeReasonEvidenceRef => ({
  refId: historyCellEvidenceRefId(entityKey, fieldName, year, month),
  kind: "history_cell",
  fieldName,
  label,
  slideId,
  slideLabel,
  year,
  month,
  expectedValue,
});

const buildHistoryLatestEvidenceRef = (
  entityKey: string,
  fieldName: string,
  label: string,
  slideId: string,
  slideLabel: string,
): DisputeReasonEvidenceRef => ({
  refId: historyLatestEvidenceRefId(entityKey, fieldName),
  kind: "history_latest",
  fieldName,
  label,
  slideId,
  slideLabel,
});

const buildHistoryMaxEvidenceRef = (
  entityKey: string,
  fieldName: string,
  label: string,
  slideId: string,
  slideLabel: string,
): DisputeReasonEvidenceRef => ({
  refId: historyMaxEvidenceRefId(entityKey, fieldName),
  kind: "history_max",
  fieldName,
  label,
  slideId,
  slideLabel,
});

const buildHistoryGapEvidenceRef = (
  entityKey: string,
  fieldName: string,
  year: string,
  month: string,
  label: string,
  slideId: string,
  slideLabel: string,
): DisputeReasonEvidenceRef => ({
  refId: historyGapEvidenceRefId(entityKey, fieldName, year, month),
  kind: "history_gap",
  fieldName,
  label,
  slideId,
  slideLabel,
  year,
  month,
});

const historyMonthDistance = (left: HistoryMonthKey, right: HistoryMonthKey) =>
  Math.abs(historyMonthSortValue(left) - historyMonthSortValue(right));

const meaningfulHistoryCells = (cells: HistoryCell[]) =>
  sortHistoryCellsChronologically(cells).filter((cell) => !isBlankHistoryValue(cell.value));

const findInternalHistoryGapMonths = (cells: HistoryCell[]) => {
  const ordered = meaningfulHistoryCells(cells);
  const gapMonths: HistoryMonthKey[] = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const older = ordered[index];
    const newer = ordered[index + 1];
    const olderKey = toHistoryMonthKey(older.year, older.month);
    const newerKey = toHistoryMonthKey(newer.year, newer.month);
    const distance = historyMonthDistance(olderKey, newerKey);
    if (distance <= 1) {
      continue;
    }
    let cursor = nextMonthKey(olderKey);
    while (cursor && cursor !== newerKey) {
      gapMonths.push(cursor);
      cursor = nextMonthKey(cursor);
    }
  }
  return Array.from(new Set(gapMonths));
};

const findGapBoundaryCells = (cells: HistoryCell[], gapMonth: HistoryMonthKey) => {
  const ordered = meaningfulHistoryCells(cells);
  const gapSort = historyMonthSortValue(gapMonth);
  let older: HistoryCell | null = null;
  let newer: HistoryCell | null = null;
  for (const cell of ordered) {
    const cellKey = toHistoryMonthKey(cell.year, cell.month);
    const cellSort = historyMonthSortValue(cellKey);
    if (cellSort < gapSort) {
      older = cell;
    }
    if (cellSort > gapSort) {
      newer = cell;
      break;
    }
  }
  return { older, newer };
};

const findGapGroupBoundaryCells = (cells: HistoryCell[], gapMonths: HistoryMonthKey[]) => {
  const ordered = meaningfulHistoryCells(cells);
  const gapSortValues = gapMonths.map((monthKey) => historyMonthSortValue(monthKey));
  const gapStart = Math.min(...gapSortValues);
  const gapEnd = Math.max(...gapSortValues);
  let older: HistoryCell | null = null;
  let newer: HistoryCell | null = null;
  for (const cell of ordered) {
    const cellSort = historyMonthSortValue(toHistoryMonthKey(cell.year, cell.month));
    if (cellSort < gapStart) {
      older = cell;
      continue;
    }
    if (cellSort > gapEnd) {
      newer = cell;
      break;
    }
  }
  return { older, newer };
};

const parseHistoryMonthKey = (monthKey: HistoryMonthKey) => {
  const [year = "", month = ""] = String(monthKey).split("-");
  return { year, month };
};

const compactHistoryMonthKeys = (keys: HistoryMonthKey[], maxKeys = 6) => {
  const deduped = Array.from(new Set(keys));
  if (deduped.length <= maxKeys) {
    return deduped;
  }
  const leadingCount = Math.ceil(maxKeys / 2);
  const trailingCount = maxKeys - leadingCount;
  return Array.from(new Set([...deduped.slice(0, leadingCount), ...deduped.slice(-trailingCount)]));
};

const compactHistoryCells = (cells: HistoryCell[], maxCells = 6) => {
  if (cells.length <= maxCells) {
    return cells;
  }
  const leadingCount = Math.ceil(maxCells / 2);
  const trailingCount = maxCells - leadingCount;
  const seen = new Set<string>();
  return [...cells.slice(0, leadingCount), ...cells.slice(-trailingCount)].filter((cell) => {
    const key = `${cell.year}-${cell.month}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const findHistoryCellByMonth = (cells: HistoryCell[], monthKey: HistoryMonthKey) => {
  const { year, month } = parseHistoryMonthKey(monthKey);
  return cells.find((cell) => cell.year === year && cell.month === month);
};

const findHistoryCellForMonthKeys = (
  cells: HistoryCell[],
  monthKeys: HistoryMonthKey[],
  predicate: (cell: HistoryCell) => boolean,
) => {
  for (const monthKey of monthKeys) {
    const cell = findHistoryCellByMonth(cells, monthKey);
    if (cell && predicate(cell)) {
      return cell;
    }
  }
  return undefined;
};

const buildMissingPaymentHistoryEvidenceRef = (
  entityKey: string,
  monthKey: HistoryMonthKey,
  slideId: string,
  slideLabel: string,
  gapCells: HistoryCell[],
  paymentHistoryCells: HistoryCell[],
  label = "Missing payment-history month",
) => {
  const { year, month } = parseHistoryMonthKey(monthKey);
  const canonicalGapCell = findHistoryCellByMonth(gapCells, monthKey);
  if (canonicalGapCell?.provenanceId) {
    return buildHistoryCellEvidenceRef(
      entityKey,
      "paymentHistoryGapSlots",
      year,
      month,
      label,
      slideId,
      slideLabel,
    );
  }
  return buildHistoryCellEvidenceRef(
    entityKey,
    "paymentHistory",
    year,
    month,
    label,
    slideId,
    slideLabel,
  );
};

const compactBridgeHistoryCells = (cells: HistoryCell[]) => {
  if (cells.length <= 2) {
    return cells;
  }
  const first = cells[0];
  const last = cells[cells.length - 1];
  if (first.year === last.year && first.month === last.month) {
    return [first];
  }
  return [first, last];
};

const collectHistoryCellsInRange = (
  cells: HistoryCell[],
  startMonth: HistoryMonthKey,
  endMonth: HistoryMonthKey,
  includeBlanks = false,
) => {
  const startSort = Math.min(historyMonthSortValue(startMonth), historyMonthSortValue(endMonth));
  const endSort = Math.max(historyMonthSortValue(startMonth), historyMonthSortValue(endMonth));
  return sortHistoryCellsChronologically(cells).filter((cell) => {
    const cellSort = historyMonthSortValue(toHistoryMonthKey(cell.year, cell.month));
    if (cellSort < startSort || cellSort > endSort) {
      return false;
    }
    return includeBlanks || !isBlankHistoryValue(cell.value);
  });
};

const buildExperianBalanceConflictEvidenceRefs = (
  entityKey: string,
  conflicts: Array<{ month: HistoryMonthKey; paidAmount: number; balanceValue: number; nextBalanceValue: number }>,
): DisputeReasonEvidenceRef[] =>
  conflicts.slice(0, 6).flatMap((entry) => {
    const { year, month } = parseHistoryMonthKey(entry.month);
    const next = nextMonthKey(entry.month);
    const nextParts = next ? parseHistoryMonthKey(next) : null;
    const slideId = `payment-balance:${entry.month}`;
    const slideLabel = `${formatHistoryMonth(entry.month)} payment activity vs balance history`;
    const refs = [
      buildHistoryCellEvidenceRef(
        entityKey,
        "actualPaymentHistory",
        year,
        month,
        "Actual payment history",
        slideId,
        slideLabel,
        String(entry.paidAmount),
      ),
      buildHistoryCellEvidenceRef(
        entityKey,
        "balanceHistory",
        year,
        month,
        "Balance history",
        slideId,
        slideLabel,
        String(entry.balanceValue),
      ),
    ];
    if (nextParts) {
      refs.push(
        buildHistoryCellEvidenceRef(
          entityKey,
          "balanceHistory",
          nextParts.year,
          nextParts.month,
          "Next-month balance history",
          slideId,
          slideLabel,
          String(entry.nextBalanceValue),
        ),
      );
    }
    return refs;
  });

const buildExperianGapEvidenceRefs = (
  entityKey: string,
  groups: HistoryMonthKey[][],
  balanceHistoryCells: HistoryCell[],
): DisputeReasonEvidenceRef[] =>
  groups
    .slice(0, 4)
    .flatMap((group) => group)
    .slice(0, 5)
    .flatMap((monthKey) => {
      const { year, month } = parseHistoryMonthKey(monthKey);
      const slideId = `balance-gap:${monthKey}`;
      const slideLabel = `${formatHistoryMonth(monthKey)} payment history vs missing balance history`;
      const { older, newer } = findGapBoundaryCells(balanceHistoryCells, monthKey);
      const refs = [
        buildHistoryCellEvidenceRef(entityKey, "paymentHistory", year, month, "Payment history", slideId, slideLabel),
        buildHistoryCellEvidenceRef(entityKey, "balanceHistoryGapSlots", year, month, "Missing balance-history slot", slideId, slideLabel),
      ];
      if (older) {
        refs.push(
          buildHistoryCellEvidenceRef(
            entityKey,
            "balanceHistory",
            older.year,
            older.month,
            "Older reported balance month",
            slideId,
            slideLabel,
            older.value,
          ),
        );
      }
      if (newer) {
        refs.push(
          buildHistoryCellEvidenceRef(
            entityKey,
            "balanceHistory",
            newer.year,
            newer.month,
            "Newer reported balance month",
            slideId,
            slideLabel,
            newer.value,
          ),
        );
      }
      return refs;
    });

const buildExperianPaymentGapEvidenceRefs = (
  entityKey: string,
  groups: HistoryMonthKey[][],
  paymentHistoryCells: HistoryCell[],
  paymentHistoryGapCells: HistoryCell[],
): DisputeReasonEvidenceRef[] =>
  groups.slice(0, 4).flatMap((group) => {
    if (group.length === 0) {
      return [];
    }
    const { older, newer } = findGapGroupBoundaryCells(paymentHistoryCells, group);
    const slices: HistoryMonthKey[][] = [];
    for (const monthKey of group) {
      const current = slices[slices.length - 1];
      if (!current) {
        slices.push([monthKey]);
        continue;
      }
      const previous = current[current.length - 1];
      const [previousYear] = previous.split("-") as [string, (typeof MONTH_KEYS)[number]];
      const [nextYear] = monthKey.split("-") as [string, (typeof MONTH_KEYS)[number]];
      if (previousYear === nextYear && historyMonthSortValue(monthKey) === historyMonthSortValue(previous) + 1) {
        current.push(monthKey);
        continue;
      }
      slices.push([monthKey]);
    }
    return slices.slice(0, 3).flatMap((slice, sliceIndex) => {
      const slideId = `payment-gap:${slice[0]}:${slice[slice.length - 1]}`;
      const slideLabel = `${describeHistoryMonthGroup(slice)} missing from payment history`;
      const refs = compactHistoryMonthKeys(slice, 4).map((monthKey) =>
        buildMissingPaymentHistoryEvidenceRef(
          entityKey,
          monthKey,
          slideId,
          slideLabel,
          paymentHistoryGapCells,
          paymentHistoryCells,
          "Missing payment-history month",
        ),
      );
      if (sliceIndex === 0 && older) {
        refs.push(
          buildHistoryCellEvidenceRef(
            entityKey,
            "paymentHistory",
            older.year,
            older.month,
            "Older reported payment-history month",
            slideId,
            slideLabel,
            older.value,
          ),
        );
      }
      if (sliceIndex === slices.length - 1 && newer) {
        refs.push(
          buildHistoryCellEvidenceRef(
            entityKey,
            "paymentHistory",
            newer.year,
            newer.month,
            "Newer reported payment-history month",
            slideId,
            slideLabel,
            newer.value,
          ),
        );
      }
      return refs;
    });
  });

const buildExperianProgressionEvidenceRefs = (
  entityKey: string,
  conflicts: Array<{ from: HistoryCell; to: HistoryCell }>,
  paymentHistoryCells: HistoryCell[],
): DisputeReasonEvidenceRef[] =>
  conflicts.slice(0, 6).flatMap(({ from, to }) => {
    const fromKey = toHistoryMonthKey(from.year, from.month);
    const toKey = toHistoryMonthKey(to.year, to.month);
    const slideId = `payment-progression:${fromKey}:${toKey}`;
    const slideLabel = `${formatHistoryMonth(fromKey)} ${from.value} to ${formatHistoryMonth(toKey)} ${to.value}`;
    const rangeCells = collectHistoryCellsInRange(paymentHistoryCells, fromKey, toKey).filter(
      (cell) =>
        !(cell.year === from.year && cell.month === from.month) &&
        !(cell.year === to.year && cell.month === to.month),
    );
    const bridgeCells = compactBridgeHistoryCells(rangeCells);
    return [
      buildHistoryCellEvidenceRef(
        entityKey,
        "paymentHistory",
        from.year,
        from.month,
        "Earlier delinquency month",
        slideId,
        slideLabel,
        from.value,
      ),
      ...bridgeCells.map((cell) =>
        buildHistoryCellEvidenceRef(
          entityKey,
          "paymentHistory",
          cell.year,
          cell.month,
          "Intervening reported month",
          slideId,
          slideLabel,
          cell.value,
        ),
      ),
      buildHistoryCellEvidenceRef(
        entityKey,
        "paymentHistory",
        to.year,
        to.month,
        "Later delinquency month",
        slideId,
        slideLabel,
        to.value,
      ),
    ];
  });

const buildExperianSevereJumpEvidenceRefs = (
  entityKey: string,
  conflicts: HistorySequenceConflict[],
  paymentHistoryCells: HistoryCell[],
  paymentHistoryGapCells: HistoryCell[],
): DisputeReasonEvidenceRef[] =>
  conflicts.slice(0, 6).flatMap((conflict) => {
    const currentKey = toHistoryMonthKey(conflict.current.year, conflict.current.month);
    const previousKey = conflict.previous ? toHistoryMonthKey(conflict.previous.year, conflict.previous.month) : null;
    const slideId = `payment-severe-jump:${entityKey}:${previousKey ?? "start"}:${currentKey}`;
    const slideLabel = `${formatHistoryMonth(currentKey)} severe delinquency jump`;
    const refs: DisputeReasonEvidenceRef[] = [];

    if (conflict.previous) {
      refs.push(
        buildHistoryCellEvidenceRef(
          entityKey,
          "paymentHistory",
          conflict.previous.year,
          conflict.previous.month,
          "Earlier reported month",
          slideId,
          slideLabel,
          conflict.previous.value,
        ),
      );
    }

    for (const monthKey of compactHistoryMonthKeys(conflict.gapMonths ?? [], 3)) {
      refs.push(
        buildMissingPaymentHistoryEvidenceRef(
          entityKey,
          monthKey,
          slideId,
          slideLabel,
          paymentHistoryGapCells,
          paymentHistoryCells,
          "Blank month before the severe jump",
        ),
      );
    }

    refs.push(
      buildHistoryCellEvidenceRef(
        entityKey,
        "paymentHistory",
        conflict.current.year,
        conflict.current.month,
        "Later severe delinquency month",
        slideId,
        slideLabel,
        conflict.current.value,
      ),
    );

    return refs;
  });

const buildExperianReagingEvidenceRefs = (
  entityKey: string,
  conflicts: HistorySequenceConflict[],
  paymentHistoryCells: HistoryCell[],
  paymentHistoryGapCells: HistoryCell[],
): DisputeReasonEvidenceRef[] =>
  conflicts.slice(0, 6).flatMap((conflict) => {
    const currentKey = toHistoryMonthKey(conflict.current.year, conflict.current.month);
    const previousKey = conflict.previous ? toHistoryMonthKey(conflict.previous.year, conflict.previous.month) : null;
    const slideId = `payment-reaging:${entityKey}:${previousKey ?? "start"}:${currentKey}`;
    const slideLabel = `${formatHistoryMonth(currentKey)} re-aging jump`;
    const refs: DisputeReasonEvidenceRef[] = [];

    if (conflict.previous) {
      refs.push(
        buildHistoryCellEvidenceRef(
          entityKey,
          "paymentHistory",
          conflict.previous.year,
          conflict.previous.month,
          "Current reset month",
          slideId,
          slideLabel,
          conflict.previous.value,
        ),
      );
    }

    for (const monthKey of compactHistoryMonthKeys(conflict.gapMonths ?? [], 3)) {
      refs.push(
        buildMissingPaymentHistoryEvidenceRef(
          entityKey,
          monthKey,
          slideId,
          slideLabel,
          paymentHistoryGapCells,
          paymentHistoryCells,
          "Blank month before the renewed severe delinquency",
        ),
      );
    }

    refs.push(
      buildHistoryCellEvidenceRef(
        entityKey,
        "paymentHistory",
        conflict.current.year,
        conflict.current.month,
        "Later severe delinquency month",
        slideId,
        slideLabel,
        conflict.current.value,
      ),
    );

    return refs;
  });

const buildExperianRetroactiveBackfillEvidenceRefs = (
  entityKey: string,
  conflicts: HistorySequenceConflict[],
  paymentHistoryCells: HistoryCell[],
  paymentHistoryGapCells: HistoryCell[],
): DisputeReasonEvidenceRef[] =>
  conflicts.slice(0, 4).flatMap((conflict) => {
    if (!conflict.gapMonths?.length) {
      return [];
    }
    const currentKey = toHistoryMonthKey(conflict.current.year, conflict.current.month);
    const slices: HistoryMonthKey[][] = [];
    for (const monthKey of conflict.gapMonths) {
      const current = slices[slices.length - 1];
      if (!current) {
        slices.push([monthKey]);
        continue;
      }
      const previous = current[current.length - 1];
      const [previousYear] = previous.split("-") as [string, (typeof MONTH_KEYS)[number]];
      const [nextYear] = monthKey.split("-") as [string, (typeof MONTH_KEYS)[number]];
      if (previousYear === nextYear && historyMonthSortValue(monthKey) === historyMonthSortValue(previous) + 1) {
        current.push(monthKey);
        continue;
      }
      slices.push([monthKey]);
    }
    return slices.slice(0, 3).flatMap((slice, sliceIndex) => {
      const slideId = `payment-backfill:${entityKey}:${slice[0]}:${slice[slice.length - 1]}`;
      const slideLabel =
        sliceIndex === slices.length - 1
          ? `${formatHistoryMonth(currentKey)} derogatory reporting after a blank gap`
          : `${describeHistoryMonthGroup(slice)} blank gap before later derogatory reporting`;
      const refs: DisputeReasonEvidenceRef[] = [];
      if (sliceIndex === 0 && conflict.previous) {
        refs.push(
          buildHistoryCellEvidenceRef(
            entityKey,
            "paymentHistory",
            conflict.previous.year,
            conflict.previous.month,
            "Earlier reported month before the gap",
            slideId,
            slideLabel,
            conflict.previous.value,
          ),
        );
      }
      for (const monthKey of compactHistoryMonthKeys(slice, 4)) {
        refs.push(
          buildMissingPaymentHistoryEvidenceRef(
            entityKey,
            monthKey,
            slideId,
            slideLabel,
            paymentHistoryGapCells,
            paymentHistoryCells,
            "Blank reporting-gap month",
          ),
        );
      }
      if (sliceIndex === slices.length - 1) {
        refs.push(
          buildHistoryCellEvidenceRef(
            entityKey,
            "paymentHistory",
            conflict.current.year,
            conflict.current.month,
            "Later derogatory month after the gap",
            slideId,
            slideLabel,
            conflict.current.value,
          ),
        );
      }
      return refs;
    });
  });

const buildExperianRecentPaymentEvidenceRefs = (
  entityKey: string,
  recentCurrentCells: HistoryCell[],
): DisputeReasonEvidenceRef[] => {
  if (recentCurrentCells.length === 0) {
    return [];
  }
  const latestCell = recentCurrentCells[recentCurrentCells.length - 1];
  const latestKey = toHistoryMonthKey(latestCell.year, latestCell.month);
  const slideId = `recent-payment:${entityKey}:${latestKey}`;
  const slideLabel = `${formatHistoryMonth(latestKey)} current activity vs missing recent payment details`;
  const refs: DisputeReasonEvidenceRef[] = [
    buildFieldEvidenceRef(entityKey, "recentPayment", "Reported recent payment field", slideId, slideLabel),
  ];
  for (const cell of compactHistoryCells(recentCurrentCells, 3)) {
    refs.push(
      buildHistoryCellEvidenceRef(
        entityKey,
        "paymentHistory",
        cell.year,
        cell.month,
        cell.year === latestCell.year && cell.month === latestCell.month
          ? "Latest current payment-history month"
          : "Recent current payment-history month",
        slideId,
        slideLabel,
        cell.value,
      ),
    );
  }
  return refs;
};

const buildExperianPaymentPlanConflictEvidenceRefs = (
  entityKey: string,
  paymentPlanConflictMonths: HistoryMonthKey[],
  paymentHistoryLookup: Map<HistoryMonthKey, string>,
): DisputeReasonEvidenceRef[] => {
  const refs: DisputeReasonEvidenceRef[] = [
    buildFieldEvidenceRef(
      entityKey,
      "status",
      "Reported deferment or forbearance status",
      `payment-plan-status:${entityKey}`,
      "Reported deferment or forbearance status",
    ),
    buildFieldEvidenceRef(
      entityKey,
      "originalBalance",
      "Reported original amount field",
      `payment-plan-remarks:${entityKey}`,
      "Reported remarks and original amount context",
    ),
  ];

  for (const monthKey of paymentPlanConflictMonths.slice(0, 3)) {
    const { year, month } = parseHistoryMonthKey(monthKey);
    refs.push(
      buildHistoryCellEvidenceRef(
        entityKey,
        "paymentHistory",
        year,
        month,
        "Conflicting payment-history month",
        `payment-plan-conflict:${entityKey}:${monthKey}`,
        `${formatHistoryMonth(monthKey)} derogatory payment-history month`,
        paymentHistoryLookup.get(monthKey) || undefined,
      ),
    );
  }

  return refs;
};

const buildExperianPaymentActivityConflictEvidenceRefs = (
  entityKey: string,
  conflicts: PaymentActivityConflict[],
  paymentHistoryCells: HistoryCell[],
  paymentHistoryGapCells: HistoryCell[],
): DisputeReasonEvidenceRef[] =>
  conflicts.slice(0, 6).flatMap((conflict) => {
    const currentKey = toHistoryMonthKey(conflict.current.year, conflict.current.month);
    const previousKey = conflict.previous ? toHistoryMonthKey(conflict.previous.year, conflict.previous.month) : null;
    const slideId = `payment-activity:${entityKey}:${previousKey ?? "start"}:${currentKey}`;
    const slideLabel = `${formatHistoryMonth(currentKey)} payment activity vs worsening delinquency`;
    const refs: DisputeReasonEvidenceRef[] = [];

    if (conflict.previous) {
      refs.push(
        buildHistoryCellEvidenceRef(
          entityKey,
          "paymentHistory",
          conflict.previous.year,
          conflict.previous.month,
          "Earlier delinquency month",
          slideId,
          slideLabel,
          conflict.previous.value,
        ),
      );
    }

    const gapMonths = compactHistoryMonthKeys(conflict.gapMonths ?? [], 3);
    if (gapMonths.length > 0) {
      for (const monthKey of gapMonths) {
        refs.push(
          buildMissingPaymentHistoryEvidenceRef(
            entityKey,
            monthKey,
            slideId,
            slideLabel,
            paymentHistoryGapCells,
            paymentHistoryCells,
            "Blank month inside the delinquency timeline",
          ),
        );
      }
    } else if (conflict.previous && previousKey) {
      const bridgeCells = compactBridgeHistoryCells(
        collectHistoryCellsInRange(paymentHistoryCells, previousKey, currentKey).filter(
          (cell) =>
            !(cell.year === conflict.previous?.year && cell.month === conflict.previous?.month) &&
            !(cell.year === conflict.current.year && cell.month === conflict.current.month),
        ),
      );
      for (const cell of bridgeCells) {
        refs.push(
          buildHistoryCellEvidenceRef(
            entityKey,
            "paymentHistory",
            cell.year,
            cell.month,
            "Intervening reported month",
            slideId,
            slideLabel,
            cell.value,
          ),
        );
      }
    }

    refs.push(
      buildHistoryCellEvidenceRef(
        entityKey,
        "paymentHistory",
        conflict.current.year,
        conflict.current.month,
        "Later conflicting delinquency month",
        slideId,
        slideLabel,
        conflict.current.value,
      ),
    );

    if (conflict.paidAmountCell) {
      refs.push(
        buildHistoryCellEvidenceRef(
          entityKey,
          "actualPaymentHistory",
          conflict.paidAmountCell.year,
          conflict.paidAmountCell.month,
          "Recorded paid amount",
          slideId,
          slideLabel,
          conflict.paidAmountCell.value,
        ),
      );
    }

    if (conflict.scheduledAmountCell) {
      refs.push(
        buildHistoryCellEvidenceRef(
          entityKey,
          "scheduledPaymentHistory",
          conflict.scheduledAmountCell.year,
          conflict.scheduledAmountCell.month,
          "Recorded scheduled payment",
          slideId,
          slideLabel,
          conflict.scheduledAmountCell.value,
        ),
      );
    } else if (conflict.scheduledAmountValue) {
      refs.push(
        buildFieldEvidenceRef(
          entityKey,
          "paymentAmount",
          "Reported scheduled payment field",
          slideId,
          slideLabel,
        ),
      );
    }

    if (conflict.lastPaymentValue && conflict.useLastPaymentField) {
      refs.push(
        buildFieldEvidenceRef(
          entityKey,
          "lastPaymentDate",
          "Reported last payment date field",
          slideId,
          slideLabel,
        ),
      );
    }

    if (conflict.recentPaymentValue && !conflict.paidAmountCell) {
      refs.push(
        buildFieldEvidenceRef(
          entityKey,
          "recentPayment",
          "Reported recent payment field",
          slideId,
          slideLabel,
        ),
      );
    }

    return refs;
  });

const buildExperianHighBalanceEvidenceRefs = (entityKey: string): DisputeReasonEvidenceRef[] => [
  buildFieldEvidenceRef(entityKey, "highestBalance", "Reported high balance", "high-balance", "High balance vs balance history"),
  buildFieldEvidenceRef(entityKey, "balance", "Reported current balance", "high-balance", "High balance vs balance history"),
  buildHistoryMaxEvidenceRef(entityKey, "balanceHistory", "Observed highest balance in history", "high-balance", "High balance vs balance history"),
];

const buildExperianInsufficientBalanceEvidenceRefs = (
  entityKey: string,
  values: { balanceValue?: string; amountPastDueValue?: string; statusText?: string; chargeOffAmountValue?: string },
): DisputeReasonEvidenceRef[] => {
  const refs: DisputeReasonEvidenceRef[] = [];
  if (!isMissing(values.balanceValue)) {
    refs.push(
      buildFieldEvidenceRef(entityKey, "balance", "Reported balance", "insufficient-balance-history", "Reported balance without complete history"),
    );
  }
  if (!isMissing(values.amountPastDueValue)) {
    refs.push(
      buildFieldEvidenceRef(entityKey, "amountPastDue", "Reported amount past due", "insufficient-balance-history", "Reported balance without complete history"),
    );
  }
  if (!refs.length && !isMissing(values.chargeOffAmountValue)) {
    refs.push(
      buildFieldEvidenceRef(entityKey, "chargeOffAmount", "Reported charge-off amount", "insufficient-balance-history", "Reported balance without complete history"),
    );
  }
  if (!refs.length && !isMissing(values.statusText)) {
    refs.push(
      buildFieldEvidenceRef(entityKey, "status", "Reported status", "insufficient-balance-history", "Reported balance without complete history"),
    );
  }
  return refs;
};

const buildExperianBalanceUpdatedEvidenceRefs = (entityKey: string): DisputeReasonEvidenceRef[] => [
  buildFieldEvidenceRef(entityKey, "balanceUpdated", "Balance-updated date", "balance-updated", "Balance-updated date vs latest balance history"),
  buildHistoryLatestEvidenceRef(entityKey, "balanceHistory", "Latest balance-history month", "balance-updated", "Balance-updated date vs latest balance history"),
];

const dedupeEvidenceRefs = (refs: DisputeReasonEvidenceRef[]): DisputeReasonEvidenceRef[] => {
  const seen = new Set<string>();
  const result: DisputeReasonEvidenceRef[] = [];
  for (const ref of refs) {
    const key = [
      ref.refId,
      ref.kind,
      ref.fieldName,
      ref.slideId,
      ref.slideLabel,
      ref.year ?? "",
      ref.month ?? "",
      ref.label,
      ref.expectedValue ?? "",
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(ref);
  }
  return result;
};

const extractPhoneNumbers = (value: string) => {
  const matches = value.match(/(?:\+?1[\s.-]*)?(?:\(\d{3}\)|\d{3})[\s.-]*\d{3}[\s.-]*\d{4}/g);
  return matches?.map((match) => normalizeText(match)) ?? [];
};

const removePhoneNumbers = (value: string) => {
  let nextValue = value;
  for (const phone of extractPhoneNumbers(value)) {
    nextValue = nextValue.replace(phone, " ");
  }
  return normalizeText(nextValue.replace(/\s*\|\s*/g, " ").replace(/\s+,/g, ","));
};

const normalizeHistoryCode = (value: string | null | undefined) =>
  normalizeMatchText(value)
    .replace(/[<>]/g, "")
    .replace(/✓|✔/g, "ok");

const isBlankHistoryValue = (value: string | null | undefined) => EMPTY_HISTORY_TOKENS.has(normalizeHistoryCode(value));
const isCurrentHistoryValue = (value: string | null | undefined) => CURRENT_HISTORY_TOKENS.has(normalizeHistoryCode(value));
const isDerogatoryHistoryValue = (value: string | null | undefined) => DEROGATORY_HISTORY_TOKENS.has(normalizeHistoryCode(value));

const hasMeaningfulPaymentHistory = (values: string[]) => values.some((value) => !isBlankHistoryValue(value));
const hasAnyDerogatoryHistory = (values: string[]) => values.some((value) => isDerogatoryHistoryValue(value));
const hasAnyCurrentHistory = (values: string[]) => values.some((value) => isCurrentHistoryValue(value));

const hasOnlyCurrentOrBlankHistory = (values: string[]) => {
  let currentCount = 0;
  for (const value of values) {
    if (isBlankHistoryValue(value)) {
      continue;
    }
    if (!isCurrentHistoryValue(value)) {
      return false;
    }
    currentCount += 1;
  }
  return currentCount > 0;
};

const isProjectedMissingHistoryCell = (cell: HistoryCell) => cell.state === "missing_slot" && cell.source === "projected_gap_slot";

const parseMoneyValue = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/-?\$?\d[\d,]*(?:\.\d{2})?/);
  if (!match) {
    return null;
  }
  const numeric = Number.parseFloat(match[0].replace(/[$,]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const extractMoneyValues = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [] as number[];
  }
  return (normalized.match(/-?\$?\d[\d,]*(?:\.\d{2})?/g) ?? [])
    .map((match) => Number.parseFloat(match.replace(/[$,]/g, "")))
    .filter((entry) => Number.isFinite(entry));
};

const maxNumericFromValues = (values: string[]) => {
  const numbers = values.flatMap((value) => extractMoneyValues(value));
  return numbers.length ? Math.max(...numbers) : null;
};

const parsePositiveInteger = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/\d+/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isCollectionLikeStatus = (statusText: string, comments: string[]) => {
  const combined = normalizeMatchText([statusText, ...comments].join(" "));
  return COLLECTION_STATUS_TOKENS.some((token) => combined.includes(token));
};

const isDerogatoryStatus = (statusText: string) => {
  const normalized = normalizeMatchText(statusText);
  return DEROGATORY_STATUS_TOKENS.some((token) => normalized.includes(token));
};

const hasPaymentPlanContext = (statusText: string, comments: string[]) => {
  const combined = normalizeMatchText([statusText, ...comments].join(" "));
  return PAYMENT_PLAN_TOKENS.some((token) => combined.includes(token));
};

const hasToken = (value: string, tokens: string[]) => {
  const normalized = normalizeMatchText(value);
  return tokens.some((token) => normalized.includes(token));
};

const uniqueStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }
  return result;
};

const firstNonEmptyText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

const hasOwnRecordField = (record: unknown, key: string): record is Record<string, unknown> =>
  Boolean(record && typeof record === "object" && !Array.isArray(record) && Object.prototype.hasOwnProperty.call(record, key));

const classifyReportedMoneyField = (
  candidates: Array<{ record: unknown; key: string }>,
): ReportedMoneyFieldObservation => {
  let explicitObservation: ReportedMoneyFieldObservation | null = null;

  for (const candidate of candidates) {
    if (!hasOwnRecordField(candidate.record, candidate.key)) {
      continue;
    }

    const rawValue = normalizeText(String(candidate.record[candidate.key] ?? ""));
    if (!rawValue || isMissing(rawValue)) {
      explicitObservation ??= {
        value: rawValue || "Not reported",
        state: "present_explicit_not_reported",
        sourceKey: candidate.key,
      };
      continue;
    }

    const parsedValue = parseMoneyValue(rawValue);
    if (parsedValue === 0) {
      return {
        value: rawValue,
        state: "present_with_zero",
        sourceKey: candidate.key,
      };
    }

    return {
      value: rawValue,
      state: "present_with_value",
      sourceKey: candidate.key,
    };
  }

  return explicitObservation ?? {
    value: "",
    state: "missing_field",
  };
};

const normalizeStringList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(String(entry ?? "")))
      .filter(Boolean);
  }
  return normalizeText(String(value ?? ""))
    .split(/\n|;|\|/)
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
};

const joinUniqueStrings = (...values: unknown[]) => uniqueStrings(values.flatMap((value) => normalizeStringList(value))).join(" ");

const extractCommentLines = (...values: unknown[]) => uniqueStrings(values.flatMap((value) => normalizeStringList(value)));

const isInstallmentLikeAccount = (account: ReasonAccountView) =>
  hasToken(
    [
      account.statusText,
      account.displayName,
      account.accountTypeText,
      account.accountCategoryText,
      account.comments.join(" "),
    ].join(" "),
    INSTALLMENT_ACCOUNT_TOKENS,
  );

const isRevolvingLikeAccount = (account: ReasonAccountView) =>
  hasToken(
    [
      account.statusText,
      account.displayName,
      account.accountTypeText,
      account.accountCategoryText,
      account.comments.join(" "),
    ].join(" "),
    REVOLVING_ACCOUNT_TOKENS,
  );

const hasKnownStudentLoanServicerIdentity = (account: ReasonAccountView) =>
  hasToken([account.displayName, account.originalCreditorText].join(" "), STUDENT_LOAN_SERVICER_TOKENS);

const isStudentLoanLikeAccount = (account: ReasonAccountView) => {
  const typeContext = [account.accountTypeText, account.accountCategoryText].join(" ");
  if (hasToken(typeContext, EXPLICIT_NON_STUDENT_LOAN_TOKENS)) {
    return false;
  }
  if (hasToken(typeContext, STUDENT_LOAN_TYPE_TOKENS)) {
    return true;
  }
  return hasKnownStudentLoanServicerIdentity(account);
};

const buildStructuredAccountContext = (account: ReasonAccountView) =>
  normalizeMatchText(
    [
      account.displayName,
      account.accountTypeText,
      account.accountCategoryText,
      account.accountSubtypeText,
      account.reportingCategoryText,
      account.legalCategoryText,
      account.consumerInformationIndicatorText,
      account.statusText,
      account.comments.join(" "),
      account.additionalInformationLines.join(" "),
      account.consumerStatementLines.join(" "),
      account.reinvestigationInfoLines.join(" "),
      account.originalCreditorText,
    ].join(" "),
  );

const isCollectionLikeAccount = (account: ReasonAccountView) =>
  normalizeMatchText(account.reportingCategoryText) === "collection" ||
  isCollectionLikeStatus(account.statusText, [...account.comments, ...account.additionalInformationLines]);

const isBankruptcyLinkedAccount = (account: ReasonAccountView) =>
  normalizeMatchText(account.legalCategoryText) === "bankruptcy" ||
  hasToken(account.consumerInformationIndicatorText, BANKRUPTCY_CONTEXT_TOKENS) ||
  hasToken(buildStructuredAccountContext(account), BANKRUPTCY_CONTEXT_TOKENS);

const hasAccountLitigationContext = (account: ReasonAccountView) => {
  const combined = buildStructuredAccountContext(account);
  return LITIGATION_CONTEXT_TOKENS.some((token) => combined.includes(token));
};

const publicRecordContextText = (record: PublicRecord) =>
  normalizeMatchText(
    [
      record.recordType,
      record.court,
      record.referenceNumber,
      record.status,
      record.amount,
      record.dateFiled,
      record.dateResolved,
      record.summary,
      ...(record.details ?? []),
    ].join(" "),
  );

const publicRecordIdentityKey = (record: PublicRecord) => {
  const referenceNumber = canonicalIdentityText(record.referenceNumber);
  if (referenceNumber) {
    return `reference:${referenceNumber}`;
  }
  const recordType = canonicalIdentityText(record.recordType);
  const court = canonicalIdentityText(record.court);
  const filedDate = normalizeMatchText(record.dateFiled);
  if (recordType && court && filedDate) {
    return `type-court-filed:${recordType}:${court}:${filedDate}`;
  }
  return "";
};

const publicRecordHasRestrictedOrVacatedContext = (record: PublicRecord) =>
  hasToken(publicRecordContextText(record), PUBLIC_RECORD_RESTRICTED_TOKENS);

const publicRecordStillLooksAdverse = (record: PublicRecord) =>
  hasToken(normalizeMatchText([record.status, record.summary].join(" ")), PUBLIC_RECORD_ACTIVE_ADVERSE_TOKENS);

const publicRecordCoreDetailPairs = (record: PublicRecord) => [
  { label: "Record type", value: record.recordType },
  { label: "Status", value: record.status },
  { label: "Court", value: record.court },
  { label: "Reference number", value: record.referenceNumber },
  { label: "Filed date", value: record.dateFiled },
  { label: "Resolved date", value: record.dateResolved },
  { label: "Summary", value: record.summary },
];

const resolvePublicRecordAnchorDate = (record: PublicRecord) =>
  parseDateLike(record.dateFiled) ?? parseDateLike(record.dateResolved);

const isOlderThanYears = (anchorDate: Date, comparisonDate: Date, years: number) =>
  monthsBetweenDates(anchorDate, comparisonDate) >= years * 12;

const consumerIndicatorContextText = (indicator: ConsumerInformationIndicator) =>
  normalizeMatchText(
    [
      indicator.code,
      indicator.description,
      indicator.category,
      indicator.linkedAccountName,
      indicator.linkedAccountNumber,
    ].join(" "),
  );

const consumerIndicatorHasCoreDetails = (indicator: ConsumerInformationIndicator) => {
  const hasDescription = !isMissing(indicator.description);
  const hasPartialLinkage = Boolean(!isMissing(indicator.linkedAccountName) !== !isMissing(indicator.linkedAccountNumber));
  return hasDescription && !hasPartialLinkage;
};

const accountNumberTail = (value: string | null | undefined) => normalizeText(value).replace(/[^0-9]/g, "").slice(-4);

const findLinkedAccountForIndicator = (report: CreditReport, indicator: ConsumerInformationIndicator) => {
  const normalizedName = canonicalIdentityText(indicator.linkedAccountName);
  const numberTail = accountNumberTail(indicator.linkedAccountNumber);
  return report.accounts.find((account) => {
    const accountName = canonicalIdentityText(account.accountName);
    const accountTail = accountNumberTail(account.accountNumber);
    const nameMatch = normalizedName && accountName.includes(normalizedName);
    const tailMatch = numberTail && accountTail && accountTail === numberTail;
    return Boolean(nameMatch || tailMatch);
  });
};

const rawAccountContextText = (account: Account) =>
  normalizeMatchText(
    [
      account.accountName,
      account.accountType,
      account.accountCategory,
      account.accountSubtype,
      account.reportingCategory,
      account.legalCategory,
      account.consumerInformationIndicator,
      account.status,
      ...(account.comments ?? []),
      ...(account.additionalInformation ?? []),
    ].join(" "),
  );

const rawAccountLooksCurrentOrActive = (account: Account) =>
  hasToken(
    [
      account.status,
      account.paymentStatus,
      account.accountStatus,
      ...account.paymentHistory,
    ].join(" "),
    ["current", "open", "paid as agreed", "ok"],
  );

const rawAccountHasBankruptcyContext = (account: Account) =>
  normalizeMatchText(account.legalCategory).includes("bankruptcy") ||
  hasToken(rawAccountContextText(account), BANKRUPTCY_CONTEXT_TOKENS);

const hasStructuredPaymentHistory = (account: ReasonAccountView) => account.paymentHistoryCells.length > 0;
const hasStructuredBalanceHistory = (account: ReasonAccountView) =>
  account.balanceHistoryCells.length > 0 || Object.values(account.month24Sections ?? {}).some((cells) => cells.length > 0);
const hasStructuredPastDueHistory = (account: ReasonAccountView) =>
  account.amountPastDueHistoryCells.length > 0 || (account.month24Sections?.pastDueAmount?.length ?? 0) > 0;
const hasStructuredMonth24History = (account: ReasonAccountView) =>
  Object.values(account.month24Sections ?? {}).some((cells) => cells.length > 0);
const hasReportedCurrentBalance = (account: ReasonAccountView) =>
  account.reportedBalanceFieldState === "present_with_value" || account.reportedBalanceFieldState === "present_with_zero";
const hasReportedPaymentAmount = (account: ReasonAccountView) =>
  account.reportedPaymentAmountFieldState === "present_with_value" || account.reportedPaymentAmountFieldState === "present_with_zero";
const hasReportedScheduledPaymentAmount = (account: ReasonAccountView) =>
  account.reportedScheduledPaymentAmountFieldState === "present_with_value" || account.reportedScheduledPaymentAmountFieldState === "present_with_zero";
const hasClosureMonthActualPaymentValue = (account: ReasonAccountView) => hasHistoryTableValue(account.closureMonthActualPaymentValue);
const isReportedCurrentBalanceFieldMissing = (account: ReasonAccountView) => account.reportedBalanceFieldState === "missing_field";
const describeReportedCurrentBalance = (account: ReasonAccountView) =>
  isReportedCurrentBalanceFieldMissing(account)
    ? "Missing"
    : account.reportedBalanceValue || "Not reported";
const describeReportedPaymentAmount = (account: ReasonAccountView) =>
  account.reportedPaymentAmountValue || "Not reported";
const describeReportedScheduledPaymentAmount = (account: ReasonAccountView) =>
  account.reportedScheduledPaymentAmountValue || "Not reported";
const isNegativeByFields = (account: ReasonAccountView) =>
  isDerogatoryStatus(account.statusText) ||
  isCollectionLikeAccount(account) ||
  isBankruptcyLinkedAccount(account) ||
  (parseMoneyValue(account.amountPastDueValue) ?? 0) > 0 ||
  (parseMoneyValue(account.chargeOffAmountValue) ?? 0) > 0 ||
  hasAnyDerogatoryHistory(account.paymentHistory);

const findMeaningfulHistoryRange = (cells: HistoryCell[]) => {
  const meaningfulIndexes = cells
    .map((cell, index) => ({ cell, index }))
    .filter(({ cell }) => !isBlankHistoryValue(cell.value))
    .map(({ index }) => index);
  if (meaningfulIndexes.length < 2) {
    return null;
  }
  return {
    start: meaningfulIndexes[0],
    end: meaningfulIndexes[meaningfulIndexes.length - 1],
  };
};

const findMissingHistoryMonths = (cells: HistoryCell[]) => {
  const range = findMeaningfulHistoryRange(cells);
  if (!range) {
    return [] as HistoryMonthKey[];
  }
  return cells
    .slice(range.start, range.end + 1)
    .filter((cell) => isBlankHistoryValue(cell.value))
    .map((cell) => toHistoryMonthKey(cell.year, cell.month));
};

const historyMonthSortValue = (key: HistoryMonthKey) => {
  const [year, month] = key.split("-") as [string, (typeof MONTH_KEYS)[number]];
  return Number.parseInt(year || "0", 10) * 12 + MONTH_KEYS.indexOf(month);
};

const groupConsecutiveHistoryMonths = (keys: HistoryMonthKey[]) => {
  const sorted = Array.from(new Set(keys)).sort((left, right) => historyMonthSortValue(left) - historyMonthSortValue(right));
  const groups: HistoryMonthKey[][] = [];
  for (const key of sorted) {
    const currentGroup = groups[groups.length - 1];
    if (!currentGroup) {
      groups.push([key]);
      continue;
    }
    const previous = currentGroup[currentGroup.length - 1];
    if (historyMonthSortValue(key) === historyMonthSortValue(previous) + 1) {
      currentGroup.push(key);
      continue;
    }
    groups.push([key]);
  }
  return groups;
};

const describeHistoryMonthGroup = (group: HistoryMonthKey[]) => {
  if (group.length === 0) {
    return "";
  }
  if (group.length === 1) {
    return formatHistoryMonth(group[0]);
  }
  return `${formatHistoryMonth(group[0])} through ${formatHistoryMonth(group[group.length - 1])}`;
};

const flattenMonthlyHistoryRows = (rows: unknown[]) => {
  const values: string[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const record = row as AnyRecord;
    for (const monthKey of MONTH_KEYS) {
      values.push(normalizeText(String(record?.[monthKey] ?? "")));
    }
  }
  return values;
};

const historyCellsFromRows = (rows: unknown[]) => {
  const cells: HistoryCell[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const record = row as AnyRecord;
    const year = normalizeText(String(record?.year ?? ""));
    if (!year) {
      continue;
    }
    for (const monthKey of MONTH_KEYS) {
      cells.push({
        year,
        month: monthKey,
        value: normalizeText(String(record?.[monthKey] ?? "")),
      });
    }
  }
  return cells;
};

const historyCellsFromEvidenceRows = (rows: unknown[]) => {
  const cells: HistoryCell[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const record = row as AnyRecord;
    const year = normalizeText(String(record?.year ?? ""));
    const months = (record?.months ?? {}) as AnyRecord;
    if (!year || !months || typeof months !== "object") {
      continue;
    }
    for (const monthKey of MONTH_KEYS) {
      const detail = months?.[monthKey] as AnyRecord | undefined;
      if (!detail || typeof detail !== "object") {
        continue;
      }
      cells.push({
        year,
        month: monthKey,
        value: normalizeText(String(detail.value ?? "")),
        state: normalizeText(String(detail.state ?? "")),
        source: normalizeText(String(detail.source ?? "")),
        provenanceId: normalizeText(String(detail.id ?? "")),
      });
    }
  }
  return cells;
};

const historyCellsFromFlatValues = (years: string[], values: string[]) => {
  const cells: HistoryCell[] = [];
  years.forEach((year, yearIndex) => {
    MONTH_KEYS.forEach((monthKey, monthIndex) => {
      cells.push({
        year: normalizeText(year),
        month: monthKey,
        value: normalizeText(values[yearIndex * MONTH_KEYS.length + monthIndex] ?? ""),
      });
    });
  });
  return cells;
};

const toHistoryMonthKey = (year: string, month: (typeof MONTH_KEYS)[number]) => `${year}-${month}` as HistoryMonthKey;

const nextMonthKey = (key: HistoryMonthKey): HistoryMonthKey | null => {
  const [year, month] = key.split("-") as [string, (typeof MONTH_KEYS)[number]];
  const monthIndex = MONTH_KEYS.indexOf(month);
  if (monthIndex < 0) {
    return null;
  }
  if (monthIndex < MONTH_KEYS.length - 1) {
    return toHistoryMonthKey(year, MONTH_KEYS[monthIndex + 1]);
  }
  const nextYear = Number.parseInt(year || "0", 10) + 1;
  if (!Number.isFinite(nextYear) || nextYear <= 0) {
    return null;
  }
  return toHistoryMonthKey(String(nextYear), MONTH_KEYS[0]);
};

const toHistoryLookup = (cells: HistoryCell[]) =>
  new Map<HistoryMonthKey, string>(cells.map((cell) => [toHistoryMonthKey(cell.year, cell.month), cell.value]));

const formatHistoryMonth = (key: HistoryMonthKey) => {
  const [year, month] = key.split("-") as [string, (typeof MONTH_KEYS)[number]];
  return `${month.slice(0, 1).toUpperCase()}${month.slice(1)} ${year}`;
};

const flattenExperianPaymentHistory = (rows: unknown[]) => {
  const values: string[] = [];
  const years: string[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const record = row as AnyRecord;
    years.push(normalizeText(String(record?.year ?? "")));
    for (const monthKey of MONTH_KEYS) {
      values.push(normalizeText(String(record?.[monthKey] ?? "")));
    }
  }
  return { values, years };
};

const flattenHistoryRows = (rows: unknown[]) => {
  const values: string[] = [];
  const years: string[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const record = row as AnyRecord;
    const year = normalizeText(String(record?.year ?? ""));
    if (!year) {
      continue;
    }
    years.push(year);
    for (const monthKey of MONTH_KEYS) {
      values.push(normalizeText(String(record?.[monthKey] ?? "")));
    }
  }
  return { values, years, cells: historyCellsFromRows(rows) };
};

const MONTH_NAME_LOOKUP: Record<string, (typeof MONTH_KEYS)[number]> = {
  jan: "jan",
  january: "jan",
  feb: "feb",
  february: "feb",
  mar: "mar",
  march: "mar",
  apr: "apr",
  april: "apr",
  may: "may",
  jun: "jun",
  june: "jun",
  jul: "jul",
  july: "jul",
  aug: "aug",
  august: "aug",
  sep: "sep",
  sept: "sep",
  september: "sep",
  oct: "oct",
  october: "oct",
  nov: "nov",
  november: "nov",
  dec: "dec",
  december: "dec",
};

const parseMonthYearParts = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const monthYearMatch = normalized.match(/([A-Za-z]+)\s+(\d{4})/);
  if (monthYearMatch) {
    const month = MONTH_NAME_LOOKUP[monthYearMatch[1].toLowerCase()];
    if (month) {
      return { month, year: monthYearMatch[2] };
    }
  }

  const slashMatch = normalized.match(/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const monthIndex = Number.parseInt(slashMatch[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < MONTH_KEYS.length) {
      return { month: MONTH_KEYS[monthIndex], year: slashMatch[2] };
    }
  }

  return null;
};

const historyCellsFromDatedEntries = (entries: unknown[], valueKey: string) => {
  const cells: HistoryCell[] = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const record = entry as AnyRecord;
    const monthYear = parseMonthYearParts(String(record.date ?? record.month ?? ""));
    if (!monthYear) {
      continue;
    }
    cells.push({
      year: monthYear.year,
      month: monthYear.month,
      value: normalizeText(String(record[valueKey] ?? "")),
    });
  }
  return cells;
};

const valuesFromHistoryCells = (cells: HistoryCell[]) => cells.map((cell) => cell.value).filter(Boolean);

const sortHistoryCellsChronologically = (cells: HistoryCell[]) =>
  [...cells].sort(
    (left, right) =>
      historyMonthSortValue(toHistoryMonthKey(left.year, left.month)) -
      historyMonthSortValue(toHistoryMonthKey(right.year, right.month)),
  );

const latestMeaningfulHistoryCell = (cells: HistoryCell[]) => {
  const meaningful = sortHistoryCellsChronologically(cells).filter((cell) => !isBlankHistoryValue(cell.value));
  return meaningful[meaningful.length - 1] ?? null;
};

const findRecentCurrentHistoryCells = (cells: HistoryCell[], maxDistanceMonths = 2) => {
  const meaningful = sortHistoryCellsChronologically(cells).filter((cell) => !isBlankHistoryValue(cell.value));
  if (meaningful.length === 0) {
    return [] as HistoryCell[];
  }
  const latestMeaningful = meaningful[meaningful.length - 1];
  const latestSort = historyMonthSortValue(toHistoryMonthKey(latestMeaningful.year, latestMeaningful.month));
  return meaningful.filter((cell) => {
    if (!isCurrentHistoryValue(cell.value)) {
      return false;
    }
    const cellSort = historyMonthSortValue(toHistoryMonthKey(cell.year, cell.month));
    const distance = latestSort - cellSort;
    return distance >= 0 && distance <= maxDistanceMonths;
  });
};

const earliestMeaningfulHistoryCell = (cells: HistoryCell[]) => {
  const meaningful = sortHistoryCellsChronologically(cells).filter((cell) => !isBlankHistoryValue(cell.value));
  return meaningful[0] ?? null;
};

const latestMeaningfulHistoryValue = (cells: HistoryCell[]) => latestMeaningfulHistoryCell(cells)?.value ?? "";

const latestPositiveMoneyHistoryValue = (cells: HistoryCell[]) => {
  const positive = sortHistoryCellsChronologically(cells).filter((cell) => (parseMoneyValue(cell.value) ?? 0) > 0);
  return positive[positive.length - 1]?.value ?? "";
};

const maxMoneyHistoryValue = (cells: HistoryCell[]) => {
  let bestCell: HistoryCell | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const cell of cells) {
    const parsed = parseMoneyValue(cell.value);
    if (parsed === null || parsed <= bestValue) {
      continue;
    }
    bestValue = parsed;
    bestCell = cell;
  }
  return bestCell?.value ?? "";
};

const extractFirstMoneyText = (value: string | null | undefined) =>
  normalizeText(value).match(/-?\$?\d[\d,]*(?:\.\d{2})?/)?.[0] ?? "";

const extractContextualMoneyText = (value: string | null | undefined, requiredTokens: string[]) => {
  const normalized = normalizeMatchText(value);
  if (!normalized || !requiredTokens.some((token) => normalized.includes(token))) {
    return "";
  }
  return extractFirstMoneyText(value);
};

const extractDateText = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  return (
    normalized.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/)?.[0] ??
    normalized.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ??
    normalized.match(/\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\b/)?.[0] ??
    normalized.match(/\b[A-Za-z]{3,9}\s+\d{4}\b/)?.[0] ??
    ""
  );
};

const extractDayLevelDateText = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }
  return (
    normalized.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/)?.[0] ??
    normalized.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ??
    normalized.match(/\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\b/)?.[0] ??
    ""
  );
};

const parseDayLevelDate = (value: string | null | undefined) => {
  const dayLevelDateText = extractDayLevelDateText(value);
  if (!dayLevelDateText) {
    return null;
  }
  return parseDateLike(dayLevelDateText);
};

const historyMonthKeyFromParsedDate = (date: Date) =>
  `${date.getUTCFullYear()}-${MONTH_KEYS[date.getUTCMonth()]}` as HistoryMonthKey;

const buildDayLevelTimingSignal = (
  value: string | null | undefined,
  label: string,
  amountValue?: string,
): DayLevelTimingSignal | null => {
  const parsedDate = parseDayLevelDate(value);
  if (!parsedDate) {
    return null;
  }
  return {
    date: parsedDate,
    dateText: extractDayLevelDateText(value),
    monthKey: historyMonthKeyFromParsedDate(parsedDate),
    label,
    amountValue: normalizeText(amountValue),
  };
};

const dedupeDayLevelTimingSignals = (signals: DayLevelTimingSignal[]) => {
  const seen = new Set<string>();
  const result: DayLevelTimingSignal[] = [];
  for (const signal of signals) {
    const key = `${signal.label}::${signal.date.toISOString()}::${signal.amountValue ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(signal);
  }
  return result.sort((left, right) => left.date.getTime() - right.date.getTime());
};

const buildScalarTimingSignals = (
  candidates: Array<{ value: string | null | undefined; label: string; amountValue?: string }>,
) =>
  dedupeDayLevelTimingSignals(
    candidates
      .map((candidate) => buildDayLevelTimingSignal(candidate.value, candidate.label, candidate.amountValue))
      .filter((signal): signal is DayLevelTimingSignal => Boolean(signal)),
  );

const buildHistoryCellTimingSignals = (
  cells: HistoryCell[],
  label: string,
  amountLookup?: Map<HistoryMonthKey, string>,
) =>
  dedupeDayLevelTimingSignals(
    cells
      .map((cell) =>
        buildDayLevelTimingSignal(
          cell.value,
          label,
          amountLookup ? amountLookup.get(toHistoryMonthKey(cell.year, cell.month)) ?? "" : "",
        ),
      )
      .filter((signal): signal is DayLevelTimingSignal => Boolean(signal)),
  );

const buildDatedEntryTimingSignals = (
  entries: unknown[],
  dateKey: string,
  amountKey: string,
  label: string,
) =>
  dedupeDayLevelTimingSignals(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => {
        const record = entry as AnyRecord;
        const amountValue = normalizeText(String(record?.[amountKey] ?? ""));
        if ((parseMoneyValue(amountValue) ?? 0) <= 0) {
          return null;
        }
        return buildDayLevelTimingSignal(String(record?.[dateKey] ?? ""), label, amountValue);
      })
      .filter((signal): signal is DayLevelTimingSignal => Boolean(signal)),
  );

const historyRowsByLabel = (entries: AnyRecord[], ...labels: string[]) =>
  entries.find((entry) => labels.some((label) => normalizeMatchText(entry?.label) === normalizeMatchText(label)))?.rows ?? [];

const historyCommentsFromRows = (rows: unknown[]) =>
  historyCellsFromRows(rows)
    .map((cell) => cell.value)
    .filter((value) => !isBlankHistoryValue(value));

const normalizedInstitutionName = (value: string | null | undefined) =>
  normalizeMatchText(value)
    .replace(/\b(bank|na|n a|usa|us|llc|inc|corp|corporation|company|co|financial|finance|svc|svcs|services|service|trust|association|ssb|fsb)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

const displayNameProvidesOriginalCreditorIdentity = (account: ReasonAccountView) => {
  const normalizedName = normalizedInstitutionName(account.displayName);
  if (!normalizedName) {
    return false;
  }

  const combined = normalizeMatchText(
    [account.displayName, account.accountTypeText, account.accountCategoryText, account.statusText, account.comments.join(" ")].join(" "),
  );

  if (THIRD_PARTY_COLLECTION_TOKENS.some((token) => combined.includes(token))) {
    return false;
  }

  if (isStudentLoanLikeAccount(account) && hasKnownStudentLoanServicerIdentity(account)) {
    return false;
  }

  return normalizedName.length >= 4;
};

const hasUsableOriginalCreditorIdentity = (account: ReasonAccountView) =>
  !isMissing(account.originalCreditorText) || displayNameProvidesOriginalCreditorIdentity(account);

const buildGenericAccountView = (account: AnyRecord): ReasonAccountView | null => {
  const accountInfo = (account.accountInfo ?? account.accountDetail ?? account.accountDetails ?? account.details ?? {}) as AnyRecord;
  const contactInfo = (account.contactInfo ?? account.furnisherContact ?? account.contactDetails ?? {}) as AnyRecord;
  const historicalInfo = (account.historicalInfo ?? account.accountHistory ?? account.history ?? {}) as AnyRecord;
  const historyEvidence = (account._historyEvidence ?? {}) as AnyRecord;
  const displayName = normalizeText(String(account.accountName ?? accountInfo.accountName ?? historicalInfo.accountName ?? ""));
  const accountNumber = normalizeText(String(account.accountNumber ?? accountInfo.accountNumber ?? historicalInfo.accountNumber ?? ""));
  if (!hasAccountIdentity(displayName, accountNumber)) {
    return null;
  }

  const contactLines = extractCommentLines(account.contact, contactInfo.address, accountInfo.address);
  const joinedContact = contactLines.join(" ");
  const phoneText = firstNonEmptyText(
    String(account.phoneNumber ?? ""),
    String(contactInfo.phoneNumber ?? ""),
    String(accountInfo.phoneNumber ?? ""),
    extractPhoneNumbers(joinedContact)[0] ?? "",
  );
  const addressText = firstNonEmptyText(
    String(account.address ?? ""),
    joinUniqueStrings(contactInfo.address, accountInfo.address),
    removePhoneNumbers(joinedContact),
  );

  const rawPaymentHistory = Array.isArray(account.paymentHistory)
    ? (account.paymentHistory as unknown[])
    : Array.isArray(accountInfo.paymentHistory)
      ? (accountInfo.paymentHistory as unknown[])
      : Array.isArray(historicalInfo.paymentHistory)
        ? (historicalInfo.paymentHistory as unknown[])
        : [];
  const paymentHistoryYears = Array.isArray(account.paymentHistoryYears)
    ? account.paymentHistoryYears.map((entry) => normalizeText(String(entry ?? ""))).filter(Boolean)
    : Array.isArray(accountInfo.paymentHistoryYears)
      ? (accountInfo.paymentHistoryYears as unknown[]).map((entry) => normalizeText(String(entry ?? ""))).filter(Boolean)
      : [];
  const paymentHistoryUsesRows = rawPaymentHistory.some((entry) => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  const flattenedPaymentHistory = paymentHistoryUsesRows
    ? flattenHistoryRows(rawPaymentHistory)
    : {
        values: rawPaymentHistory.map((entry) => normalizeText(String(entry ?? ""))),
        years: paymentHistoryYears,
        cells: historyCellsFromFlatValues(paymentHistoryYears, rawPaymentHistory.map((entry) => normalizeText(String(entry ?? "")))),
      };
  const balanceHistoryRows = Array.isArray(account.balanceHistory)
    ? (account.balanceHistory as unknown[])
    : Array.isArray(accountInfo.balanceHistory)
      ? (accountInfo.balanceHistory as unknown[])
      : [];
  const paidAmountHistoryRows = Array.isArray(account.actualPaymentHistory ?? account.paymentAmountHistory)
    ? ((account.actualPaymentHistory ?? account.paymentAmountHistory) as unknown[])
    : Array.isArray(accountInfo.actualPaymentHistory ?? accountInfo.paymentAmountHistory)
      ? ((accountInfo.actualPaymentHistory ?? accountInfo.paymentAmountHistory) as unknown[])
      : [];
  const scheduledPaymentHistoryRows = Array.isArray(account.scheduledPaymentHistory)
    ? (account.scheduledPaymentHistory as unknown[])
    : Array.isArray(accountInfo.scheduledPaymentHistory)
      ? (accountInfo.scheduledPaymentHistory as unknown[])
      : [];
  const amountPastDueHistoryRows = Array.isArray(account.amountPastDueHistory)
    ? (account.amountPastDueHistory as unknown[])
    : Array.isArray(accountInfo.amountPastDueHistory)
      ? (accountInfo.amountPastDueHistory as unknown[])
      : [];
  const creditLimitHistoryRows = Array.isArray(account.creditLimitHistory)
    ? (account.creditLimitHistory as unknown[])
    : Array.isArray(accountInfo.creditLimitHistory)
      ? (accountInfo.creditLimitHistory as unknown[])
      : [];
  const balanceHistoryCells = historyCellsFromRows(balanceHistoryRows);
  const paidAmountHistoryCells = historyCellsFromRows(paidAmountHistoryRows);
  const scheduledPaymentHistoryCells = historyCellsFromRows(scheduledPaymentHistoryRows);
  const amountPastDueHistoryCells = historyCellsFromRows(amountPastDueHistoryRows);
  const creditLimitHistoryCells = historyCellsFromRows(creditLimitHistoryRows);
  const responsibilityText = firstNonEmptyText(
    String(account.responsibility ?? ""),
    String(account.accountOwnership ?? ""),
    String(account.paymentResponsibility ?? ""),
    String(accountInfo.responsibility ?? ""),
  );
  const dateOpenedValue = firstNonEmptyText(
    String(account.dateOpened ?? ""),
    String(account.openDate ?? ""),
    String(accountInfo.dateOpened ?? ""),
    String(historicalInfo.dateOpened ?? ""),
  );
  const dateReportedValue = firstNonEmptyText(
    String(account.dateReported ?? ""),
    String(account.delinquencyFirstReported ?? ""),
    String(accountInfo.dateReported ?? ""),
    String(accountInfo.dateUpdated ?? ""),
    String(historicalInfo.dateReported ?? ""),
  );
  const dateClosedValue = firstNonEmptyText(String(account.dateClosed ?? ""), String(accountInfo.dateClosed ?? ""), String(historicalInfo.dateClosed ?? ""));
  const statusText = firstNonEmptyText(
    String(account.accountStatus ?? ""),
    String(account.status ?? ""),
    String(account.paymentStatus ?? ""),
    String(accountInfo.status ?? ""),
    String(accountInfo.accountStatus ?? ""),
    String(historicalInfo.status ?? ""),
  );
  const comments = extractCommentLines(
    account.comments,
    account.contact,
    account.remarks,
    accountInfo.comments,
    accountInfo.remarks,
    historicalInfo.comments,
    historicalInfo.remarks,
  );
  const paymentAmountValue = firstNonEmptyText(
    String(account.paymentAmount ?? ""),
    String(account.scheduledPaymentAmount ?? ""),
    String(account.actualPaymentAmount ?? ""),
    String(accountInfo.monthlyPayment ?? ""),
    String(accountInfo.paymentReceived ?? ""),
    latestPositiveMoneyHistoryValue(scheduledPaymentHistoryCells),
    latestPositiveMoneyHistoryValue(paidAmountHistoryCells),
  );
  const scheduledPaymentAmountValue = firstNonEmptyText(
    String(account.scheduledPaymentAmount ?? ""),
    String(accountInfo.scheduledPaymentAmount ?? ""),
    latestPositiveMoneyHistoryValue(scheduledPaymentHistoryCells),
  );
  const recentPaymentValue = firstNonEmptyText(
    String(account.actualPaymentAmount ?? ""),
    String(account.paymentAmount ?? ""),
    String(accountInfo.paymentReceived ?? ""),
    String(accountInfo.recentPayment ?? ""),
    latestMeaningfulHistoryValue(paidAmountHistoryCells),
  );
  const balanceHistoryValues = flattenMonthlyHistoryRows(balanceHistoryRows);
  const amountPastDueHistoryValues = flattenMonthlyHistoryRows(amountPastDueHistoryRows);
  const creditLimitNarrative = firstNonEmptyText(String(accountInfo.creditLimitHistory ?? ""), String(account.creditLimitHistory ?? ""));
  const creditLimitHistoryValues = uniqueStrings([
    ...flattenMonthlyHistoryRows(creditLimitHistoryRows),
    extractContextualMoneyText(creditLimitNarrative, ["credit limit"]),
  ]);
  const reportedBalance = classifyReportedMoneyField([
    { record: account, key: "currentBalance" },
    { record: account, key: "balance" },
    { record: accountInfo, key: "balance" },
  ]);
  const reportedPaymentAmount = classifyReportedMoneyField([
    { record: account, key: "actualPaymentAmount" },
    { record: accountInfo, key: "paymentReceived" },
    { record: accountInfo, key: "recentPayment" },
  ]);
  const reportedScheduledPaymentAmount = classifyReportedMoneyField([
    { record: account, key: "scheduledPaymentAmount" },
    { record: accountInfo, key: "scheduledPaymentAmount" },
    { record: accountInfo, key: "monthlyPayment" },
  ]);
  const reportedLastPaymentDateValue = firstNonEmptyText(
    String(account.lastPaymentDate ?? ""),
    String(account.dateOfLastPayment ?? ""),
    String(accountInfo.lastPaymentDate ?? ""),
    String(accountInfo.lastPaymentMade ?? ""),
    String(historicalInfo.lastPaymentDate ?? ""),
  );
  const lastPaymentDateValue = firstNonEmptyText(
    reportedLastPaymentDateValue,
    extractDateText(String(accountInfo.recentPayment ?? "")),
    extractDateText(latestMeaningfulHistoryValue(paidAmountHistoryCells)),
  );
  const statusUpdatedValue = firstNonEmptyText(
    String(account.statusUpdated ?? ""),
    String(accountInfo.statusUpdated ?? ""),
    String(account.dateReported ?? ""),
    String(account.delinquencyFirstReported ?? ""),
    dateReportedValue,
  );
  const balanceUpdatedValue = firstNonEmptyText(
    String(account.balanceUpdated ?? ""),
    String(accountInfo.balanceUpdated ?? ""),
    String(account.dateOfLastActivity ?? ""),
    dateReportedValue,
  );
  const isClosed =
    Boolean(account.isClosed) ||
    !isMissing(dateClosedValue) ||
    hasToken([statusText, comments.join(" "), String(account.activityDesignator ?? "")].join(" "), ["closed", "paid and closed", "closed or paid"]);
  const closureTimingValue = deriveClosureTimingValue(isClosed, dateClosedValue, statusUpdatedValue, balanceUpdatedValue);
  const closureMonthKey = deriveClosureMonthKey(closureTimingValue, reportedLastPaymentDateValue);
  const closureMonthFacts = deriveClosureMonthFacts(closureMonthKey, flattenedPaymentHistory.cells, paidAmountHistoryCells);
  const lastPaymentSignal = deriveLastPaymentSignal(reportedPaymentAmount.value, reportedLastPaymentDateValue);
  const paymentTimingSignals = buildScalarTimingSignals([
    { value: reportedLastPaymentDateValue, label: "Reported last payment date field", amountValue: reportedPaymentAmount.value },
    { value: lastPaymentDateValue, label: "Derived last payment timing", amountValue: recentPaymentValue },
  ]);
  const reportingTimingSignals = buildScalarTimingSignals([
    { value: dateReportedValue, label: "Reported date field" },
    { value: statusUpdatedValue, label: "Status-updated date field" },
    { value: balanceUpdatedValue, label: "Balance-updated date field" },
    { value: dateClosedValue, label: "Closed date field" },
  ]);

  return {
    displayName,
    accountTypeText: firstNonEmptyText(
      String(account.accountType ?? ""),
      String(account.creditType ?? ""),
      String(account.loanType ?? ""),
      String(accountInfo.accountType ?? ""),
      String(accountInfo.loanType ?? ""),
    ),
    accountCategoryText: firstNonEmptyText(
      String(account.accountCategory ?? ""),
      String(account.loanType ?? ""),
      String(account.creditorClassification ?? ""),
      String(accountInfo.accountCategory ?? ""),
      String(accountInfo.loanType ?? ""),
    ),
    accountSubtypeText: "",
    reportingCategoryText: "",
    legalCategoryText: "",
    consumerInformationIndicatorText: "",
    accountNumber,
    entityKey: accountEntityKey(displayName, accountNumber),
    sourcePages: normalizePages(account.sourcePages as number[] | undefined),
    statusText,
    responsibilityText,
    addressText,
    phoneText,
    comments,
    additionalInformationLines: extractCommentLines(account.additionalInformation, account.additionalInfo, accountInfo.additionalInformation),
    consumerStatementLines: extractCommentLines(account.consumerStatement),
    reinvestigationInfoLines: extractCommentLines(account.reinvestigationInfo),
    paymentHistory: flattenedPaymentHistory.values,
    paymentHistoryYears: flattenedPaymentHistory.years,
    paymentHistoryCells: flattenedPaymentHistory.cells,
    paymentHistoryGapCells: historyCellsFromEvidenceRows((historyEvidence.paymentHistoryGapSlots ?? []) as unknown[]),
    balanceHistoryValues,
    balanceHistoryCells,
    paidAmountHistoryCells,
    scheduledPaymentHistoryCells,
    amountPastDueHistoryValues,
    amountPastDueHistoryCells,
    creditLimitHistoryValues,
    creditLimitHistoryCells,
    reportedBalanceValue: reportedBalance.value,
    reportedBalanceFieldState: reportedBalance.state,
    reportedPaymentAmountValue: reportedPaymentAmount.value,
    reportedPaymentAmountFieldState: reportedPaymentAmount.state,
    reportedScheduledPaymentAmountValue: reportedScheduledPaymentAmount.value,
    reportedScheduledPaymentAmountFieldState: reportedScheduledPaymentAmount.state,
    reportedLastPaymentDateValue,
    balanceValue: firstNonEmptyText(reportedBalance.value, latestMeaningfulHistoryValue(balanceHistoryCells)),
    originalBalanceValue: firstNonEmptyText(String(account.originalBalance ?? ""), String(accountInfo.originalBalance ?? "")),
    amountPastDueValue: firstNonEmptyText(
      String(account.amountPastDue ?? ""),
      String(accountInfo.amountPastDue ?? ""),
      latestPositiveMoneyHistoryValue(amountPastDueHistoryCells),
    ),
    chargeOffAmountValue: firstNonEmptyText(
      String(account.chargeOffAmount ?? ""),
      String(accountInfo.chargeOffAmount ?? ""),
      String(historicalInfo.chargeOffAmount ?? ""),
      extractContextualMoneyText(statusText, ["charge off", "charged off"]),
    ),
    creditLimitValue: firstNonEmptyText(String(account.creditLimit ?? ""), String(accountInfo.creditLimit ?? ""), latestPositiveMoneyHistoryValue(creditLimitHistoryCells), extractContextualMoneyText(creditLimitNarrative, ["credit limit"])),
    highestBalanceValue: firstNonEmptyText(
      String(account.highestBalance ?? ""),
      String(account.highCredit ?? ""),
      String(accountInfo.highestBalance ?? ""),
      String(accountInfo.highCredit ?? ""),
      maxMoneyHistoryValue(balanceHistoryCells),
    ),
    originalCreditorText: firstNonEmptyText(
      String(account.originalCreditorName ?? ""),
      String(accountInfo.originalCreditor ?? ""),
      String(accountInfo.originalCreditorName ?? ""),
      String(historicalInfo.originalCreditor ?? ""),
    ),
    paymentAmountValue,
    scheduledPaymentAmountValue,
    recentPaymentValue,
    lastPaymentDateValue,
    dateOfFirstDelinquencyValue: firstNonEmptyText(
      String(account.dateOfFirstDelinquency ?? ""),
      String(account.delinquencyFirstReported ?? ""),
      String(accountInfo.dateOfFirstDelinquency ?? ""),
      String(historicalInfo.dateOfFirstDelinquency ?? ""),
    ),
    dateOpenedValue,
    dateReportedValue,
    dateClosedValue,
    closureTimingValue,
    closureMonthKey,
    closureMonthPaymentStatus: closureMonthFacts.closureMonthPaymentStatus,
    closureMonthActualPaymentValue: closureMonthFacts.closureMonthActualPaymentValue,
    closureMonthHasTableActivity: closureMonthFacts.closureMonthHasTableActivity,
    lastPaymentSignalValue: lastPaymentSignal.value,
    lastPaymentSignalKind: lastPaymentSignal.kind,
    paymentTimingSignals,
    reportingTimingSignals,
    statusUpdatedValue,
    balanceUpdatedValue,
    estimatedRemovalValue: firstNonEmptyText(
      String(account.onRecordUntil ?? account.estimatedRemoval ?? ""),
      String(accountInfo.onRecordUntil ?? ""),
      String(accountInfo.estimatedRemoval ?? ""),
      String(historicalInfo.onRecordUntil ?? ""),
      String(historicalInfo.estimatedRemoval ?? ""),
    ),
    termsFrequencyValue: firstNonEmptyText(String(account.termsFrequency ?? ""), String(accountInfo.termsFrequency ?? ""), String(accountInfo.terms ?? "")),
    termDurationValue: firstNonEmptyText(String(account.termDuration ?? ""), String(accountInfo.termDuration ?? ""), String(accountInfo.terms ?? "")),
    monthsReviewedValue: firstNonEmptyText(String(account.monthsReviewed ?? ""), String(accountInfo.monthsReviewed ?? "")),
    isClosed,
    month24Sections: undefined,
    month24NarrativeCodes: undefined,
  };
};

const buildExperianAccountView = (account: AnyRecord): ReasonAccountView | null => {
  const header = (account.header ?? {}) as AnyRecord;
  const accountInfo = (account.accountInfo ?? {}) as AnyRecord;
  const contactInfo = (account.contactInfo ?? {}) as AnyRecord;
  const comment = (account.comment ?? {}) as AnyRecord;
  const historicalInfo = (account.historicalInfo ?? {}) as AnyRecord;
  const historyEvidence = (account._historyEvidence ?? {}) as AnyRecord;
  const displayName = normalizeText(String(header.accountName ?? accountInfo.accountName ?? ""));
  const accountNumber = normalizeText(String(header.accountNumber ?? accountInfo.accountNumber ?? ""));
  if (!hasAccountIdentity(displayName, accountNumber)) {
    return null;
  }

  const addressLines = Array.isArray(contactInfo.address)
    ? contactInfo.address.map((entry) => normalizeText(String(entry ?? ""))).filter(Boolean)
    : [];
  const phoneText = normalizeText(String(contactInfo.phoneNumber ?? ""));
  const { values, years } = flattenExperianPaymentHistory(((account.paymentHistory ?? {}) as AnyRecord).rows as unknown[]);
  const balanceHistoryEntries = Array.isArray(account.balanceHistories) ? (account.balanceHistories as AnyRecord[]) : [];
  const balanceHistoryCells = historyCellsFromDatedEntries(balanceHistoryEntries, "balance");
  const paidAmountHistoryCells = historyCellsFromDatedEntries(balanceHistoryEntries, "paid");
  const scheduledPaymentHistoryCells = historyCellsFromDatedEntries(balanceHistoryEntries, "scheduledPayment");
  const derivedRecentPaymentValue = latestMeaningfulHistoryValue(paidAmountHistoryCells);
  const derivedScheduledPaymentValue = latestPositiveMoneyHistoryValue(scheduledPaymentHistoryCells);
  const derivedLastPaymentDateValue = extractDateText(firstNonEmptyText(String(accountInfo.recentPayment ?? ""), derivedRecentPaymentValue));
  const derivedAmountPastDueValue = extractContextualMoneyText(String(accountInfo.status ?? ""), ["past due"]);
  const derivedChargeOffAmountValue = extractContextualMoneyText(String(accountInfo.status ?? ""), ["charge off", "charged off"]);
  // Keep true balance-history comparisons scoped to the extracted balance column.
  // Scheduled and paid entries are tracked separately and should not satisfy
  // balance-history presence checks for Experian tradelines.
  const balanceHistoryValues = valuesFromHistoryCells(balanceHistoryCells);
  const paymentAmountValue = firstNonEmptyText(String(accountInfo.monthlyPayment ?? ""), derivedScheduledPaymentValue);
  const recentPaymentValue = firstNonEmptyText(String(accountInfo.recentPayment ?? ""), derivedRecentPaymentValue);
  const statusUpdatedValue = firstNonEmptyText(String(accountInfo.statusUpdated ?? ""), String(historicalInfo.statusUpdated ?? ""));
  const balanceUpdatedValue = firstNonEmptyText(String(accountInfo.balanceUpdated ?? ""), String(historicalInfo.balanceUpdated ?? ""));
  const dateReportedValue = statusUpdatedValue || balanceUpdatedValue;
  const comments = extractCommentLines(comment.current, comment.previous, account.additionalInfo);
  const reportedBalance = classifyReportedMoneyField([{ record: accountInfo, key: "balance" }]);
  const reportedPaymentAmount = classifyReportedMoneyField([{ record: accountInfo, key: "recentPayment" }]);
  const reportedScheduledPaymentAmount = classifyReportedMoneyField([{ record: accountInfo, key: "monthlyPayment" }]);
  const reportedLastPaymentDateValue = firstNonEmptyText(String(historicalInfo.lastPaymentDate ?? ""), String(accountInfo.lastPaymentDate ?? ""));
  const paymentHistoryCells = historyCellsFromRows((((account.paymentHistory ?? {}) as AnyRecord).rows as unknown[]));
  const dateClosedValue = normalizeText(String(accountInfo.dateClosed ?? ""));
  const lastPaymentDateValue = firstNonEmptyText(reportedLastPaymentDateValue, derivedLastPaymentDateValue);
  const isClosed = Boolean(header.isClosed) || !isMissing(dateClosedValue) || normalizeMatchText(String(accountInfo.status ?? "")).includes("closed");
  const closureTimingValue = deriveClosureTimingValue(isClosed, dateClosedValue, statusUpdatedValue, balanceUpdatedValue);
  const closureMonthKey = deriveClosureMonthKey(closureTimingValue, reportedLastPaymentDateValue);
  const closureMonthFacts = deriveClosureMonthFacts(closureMonthKey, paymentHistoryCells, paidAmountHistoryCells);
  const lastPaymentSignal = deriveLastPaymentSignal(reportedPaymentAmount.value, reportedLastPaymentDateValue);
  const paymentTimingSignals = dedupeDayLevelTimingSignals([
    ...buildScalarTimingSignals([
      { value: reportedLastPaymentDateValue, label: "Reported last payment date field", amountValue: reportedPaymentAmount.value },
      { value: lastPaymentDateValue, label: "Derived last payment timing", amountValue: recentPaymentValue },
    ]),
    ...buildDatedEntryTimingSignals(balanceHistoryEntries, "date", "paid", "Paid-history date"),
  ]);
  const reportingTimingSignals = buildScalarTimingSignals([
    { value: dateReportedValue, label: "Reported date field" },
    { value: statusUpdatedValue, label: "Status-updated date field" },
    { value: balanceUpdatedValue, label: "Balance-updated date field" },
    { value: dateClosedValue, label: "Closed date field" },
  ]);

  return {
    displayName,
    accountTypeText: firstNonEmptyText(String(accountInfo.accountType ?? ""), String(accountInfo.accountCategory ?? "")),
    accountCategoryText: firstNonEmptyText(String(accountInfo.loanType ?? ""), String(accountInfo.accountCategory ?? "")),
    accountSubtypeText: "",
    reportingCategoryText: "",
    legalCategoryText: "",
    consumerInformationIndicatorText: "",
    accountNumber,
    entityKey: accountEntityKey(displayName, accountNumber),
    sourcePages: normalizePages(account.sourcePages as number[] | undefined),
    statusText: normalizeText(String(accountInfo.status ?? "")),
    responsibilityText: normalizeText(String(accountInfo.responsibility ?? "")),
    addressText: addressLines.join(" "),
    phoneText,
    comments,
    additionalInformationLines: extractCommentLines(account.additionalInfo, account.additionalInformation),
    consumerStatementLines: extractCommentLines(account.consumerStatement),
    reinvestigationInfoLines: extractCommentLines(account.reinvestigationInfo),
    paymentHistory: values,
    paymentHistoryYears: years,
    paymentHistoryCells,
    paymentHistoryGapCells: historyCellsFromEvidenceRows((historyEvidence.paymentHistoryGapSlots ?? []) as unknown[]),
    balanceHistoryValues,
    balanceHistoryCells,
    paidAmountHistoryCells,
    scheduledPaymentHistoryCells,
    amountPastDueHistoryValues: [],
    amountPastDueHistoryCells: [],
    creditLimitHistoryValues: [],
    creditLimitHistoryCells: [],
    reportedBalanceValue: reportedBalance.value,
    reportedBalanceFieldState: reportedBalance.state,
    reportedPaymentAmountValue: reportedPaymentAmount.value,
    reportedPaymentAmountFieldState: reportedPaymentAmount.state,
    reportedScheduledPaymentAmountValue: reportedScheduledPaymentAmount.value,
    reportedScheduledPaymentAmountFieldState: reportedScheduledPaymentAmount.state,
    reportedLastPaymentDateValue,
    balanceValue: firstNonEmptyText(reportedBalance.value, latestMeaningfulHistoryValue(balanceHistoryCells)),
    originalBalanceValue: normalizeText(String(accountInfo.originalBalance ?? "")),
    amountPastDueValue: firstNonEmptyText(String(accountInfo.amountPastDue ?? ""), String(historicalInfo.amountPastDue ?? ""), derivedAmountPastDueValue),
    chargeOffAmountValue: firstNonEmptyText(String(accountInfo.chargeOffAmount ?? ""), String(historicalInfo.chargeOffAmount ?? ""), derivedChargeOffAmountValue),
    creditLimitValue: normalizeText(String(accountInfo.creditLimit ?? "")),
    highestBalanceValue: firstNonEmptyText(String(accountInfo.highestBalance ?? ""), maxMoneyHistoryValue(balanceHistoryCells)),
    originalCreditorText: firstNonEmptyText(String(accountInfo.originalCreditor ?? ""), String(historicalInfo.originalCreditor ?? "")),
    paymentAmountValue,
    scheduledPaymentAmountValue: paymentAmountValue,
    recentPaymentValue,
    lastPaymentDateValue,
    dateOfFirstDelinquencyValue: normalizeText(String(historicalInfo.dateOfFirstDelinquency ?? "")),
    dateOpenedValue: normalizeText(String(accountInfo.dateOpened ?? "")),
    dateReportedValue,
    dateClosedValue,
    closureTimingValue,
    closureMonthKey,
    closureMonthPaymentStatus: closureMonthFacts.closureMonthPaymentStatus,
    closureMonthActualPaymentValue: closureMonthFacts.closureMonthActualPaymentValue,
    closureMonthHasTableActivity: closureMonthFacts.closureMonthHasTableActivity,
    lastPaymentSignalValue: lastPaymentSignal.value,
    lastPaymentSignalKind: lastPaymentSignal.kind,
    paymentTimingSignals,
    reportingTimingSignals,
    statusUpdatedValue,
    balanceUpdatedValue,
    estimatedRemovalValue: firstNonEmptyText(String(accountInfo.onRecordUntil ?? ""), String(historicalInfo.onRecordUntil ?? ""), String(historicalInfo.estimatedRemoval ?? "")),
    termsFrequencyValue: normalizeText(String(accountInfo.terms ?? "")),
    termDurationValue: firstNonEmptyText(String(accountInfo.termDuration ?? ""), String(accountInfo.terms ?? "")),
    monthsReviewedValue: firstNonEmptyText(String(historicalInfo.monthsReviewed ?? ""), String(accountInfo.monthsReviewed ?? "")),
    isClosed,
    month24Sections: undefined,
    month24NarrativeCodes: undefined,
  };
};

const buildEquifaxNewAccountView = (account: AnyRecord): ReasonAccountView | null => {
  const historyEvidence = (account._historyEvidence ?? {}) as AnyRecord;
  const displayName = normalizeText(String(account.accountName ?? ""));
  const accountNumber = normalizeText(String(account.accountNumber ?? ""));
  if (!hasAccountIdentity(displayName, accountNumber)) {
    return null;
  }

  const paymentRows = Array.isArray(account.paymentHistory) ? account.paymentHistory : [];
  const { values, years, cells } = flattenHistoryRows(paymentRows);
  const rawSections = (((account.month24History ?? {}) as AnyRecord).sections ?? []) as AnyRecord[];
  const month24Sections: Record<string, HistoryCell[]> = {};
  for (const rawSection of rawSections) {
    const key = normalizeText(String(rawSection.key ?? ""));
    if (!key) {
      continue;
    }
    month24Sections[key] = historyCellsFromRows((rawSection.rows ?? []) as unknown[]);
  }
  const balanceHistoryCells = month24Sections.balance ?? [];
  const paymentAmountHistoryCells = month24Sections.paymentAmount ?? [];
  const lastPaymentDateHistoryCells = month24Sections.lastPaymentDate ?? [];
  const pastDueHistoryCells = month24Sections.pastDueAmount ?? [];
  const creditLimitHistoryCells = month24Sections.creditLimit ?? [];
  const highCreditHistoryCells = month24Sections.highCredit ?? [];
  const narrativeHistoryValues = (month24Sections.narrativeCodes ?? [])
    .map((entry) => entry.value)
    .filter((value) => !isBlankHistoryValue(value));
  const comments = uniqueStrings([
    ...(Array.isArray(account.narrativeCodes)
      ? (account.narrativeCodes as AnyRecord[]).map((entry) => normalizeText(String(entry.description ?? entry.code ?? ""))).filter(Boolean)
      : normalizeText(String(account.narrativeCodeList ?? ""))
          .split(",")
          .map((entry) => normalizeText(entry))
          .filter(Boolean)),
    ...narrativeHistoryValues,
    normalizeText(String(account.activityDesignator ?? "")),
  ]);
  const derivedPaymentAmountValue = latestPositiveMoneyHistoryValue(paymentAmountHistoryCells);
  const derivedLastPaymentDateValue = latestMeaningfulHistoryValue(lastPaymentDateHistoryCells);
  const reportedBalance = classifyReportedMoneyField([{ record: account, key: "balance" }]);
  const reportedPaymentAmount = classifyReportedMoneyField([{ record: account, key: "actualPaymentAmount" }]);
  const reportedScheduledPaymentAmount = classifyReportedMoneyField([{ record: account, key: "scheduledPaymentAmount" }]);
  const reportedLastPaymentDateValue = firstNonEmptyText(String(account.dateOfLastPayment ?? ""));
  const lastPaymentDateValue = firstNonEmptyText(reportedLastPaymentDateValue, derivedLastPaymentDateValue);
  const statusUpdatedValue = firstNonEmptyText(String(account.dateReported ?? ""), String(account.dateOfLastActivity ?? ""));
  const balanceUpdatedValue = firstNonEmptyText(String(account.dateOfLastActivity ?? ""), String(account.dateReported ?? ""));
  const dateClosedValue = normalizeText(String(account.dateClosed ?? ""));
  const isClosed =
    Boolean(account.isClosed) ||
    !isMissing(dateClosedValue) ||
    hasToken([String(account.status ?? ""), String(account.activityDesignator ?? ""), comments.join(" ")].join(" "), ["closed", "paid and closed", "closed or paid"]);
  const closureTimingValue = deriveClosureTimingValue(isClosed, dateClosedValue, statusUpdatedValue, balanceUpdatedValue);
  const closureMonthKey = deriveClosureMonthKey(closureTimingValue, reportedLastPaymentDateValue);
  const closureMonthFacts = deriveClosureMonthFacts(closureMonthKey, cells, paymentAmountHistoryCells, lastPaymentDateHistoryCells);
  const lastPaymentSignal = deriveLastPaymentSignal(reportedPaymentAmount.value, reportedLastPaymentDateValue);
  const month24PaymentAmountLookup = toHistoryLookup(paymentAmountHistoryCells);
  const paymentTimingSignals = dedupeDayLevelTimingSignals([
    ...buildScalarTimingSignals([
      { value: reportedLastPaymentDateValue, label: "Reported last payment date field", amountValue: reportedPaymentAmount.value },
      { value: lastPaymentDateValue, label: "Derived last payment timing", amountValue: derivedPaymentAmountValue },
    ]),
    ...buildHistoryCellTimingSignals(lastPaymentDateHistoryCells, "24-month last-payment date", month24PaymentAmountLookup),
  ]);
  const reportingTimingSignals = buildScalarTimingSignals([
    { value: normalizeText(String(account.dateReported ?? "")), label: "Reported date field" },
    { value: statusUpdatedValue, label: "Status-updated date field" },
    { value: balanceUpdatedValue, label: "Balance-updated date field" },
    { value: dateClosedValue, label: "Closed date field" },
  ]);

  return {
    displayName,
    accountTypeText: firstNonEmptyText(String(account.loanAccountType ?? ""), String(account.accountType ?? "")),
    accountCategoryText: firstNonEmptyText(String(account.owner ?? ""), String(account.accountType ?? ""), String(account.activityDesignator ?? "")),
    accountSubtypeText: "",
    reportingCategoryText: "",
    legalCategoryText: "",
    consumerInformationIndicatorText: "",
    accountNumber,
    entityKey: accountEntityKey(displayName, accountNumber),
    sourcePages: normalizePages(account.sourcePages as number[] | undefined),
    statusText: firstNonEmptyText(String(account.status ?? ""), String(account.activityDesignator ?? "")),
    responsibilityText: normalizeText(String(account.owner ?? "")),
    addressText: normalizeText(String(account.address ?? "")),
    phoneText: normalizeText(String(account.phoneNumber ?? "")),
    comments,
    additionalInformationLines: extractCommentLines(account.additionalInformation),
    consumerStatementLines: extractCommentLines(account.consumerStatement),
    reinvestigationInfoLines: extractCommentLines(account.reinvestigationInfo),
    paymentHistory: values,
    paymentHistoryYears: years,
    paymentHistoryCells: cells,
    paymentHistoryGapCells: historyCellsFromEvidenceRows((historyEvidence.paymentHistoryGapSlots ?? []) as unknown[]),
    balanceHistoryValues: balanceHistoryCells.map((entry) => entry.value).filter(Boolean),
    balanceHistoryCells,
    paidAmountHistoryCells: paymentAmountHistoryCells,
    scheduledPaymentHistoryCells: paymentAmountHistoryCells,
    amountPastDueHistoryValues: pastDueHistoryCells.map((entry) => entry.value).filter(Boolean),
    amountPastDueHistoryCells: pastDueHistoryCells,
    creditLimitHistoryValues: creditLimitHistoryCells.map((entry) => entry.value).filter(Boolean),
    creditLimitHistoryCells,
    reportedBalanceValue: reportedBalance.value,
    reportedBalanceFieldState: reportedBalance.state,
    reportedPaymentAmountValue: reportedPaymentAmount.value,
    reportedPaymentAmountFieldState: reportedPaymentAmount.state,
    reportedScheduledPaymentAmountValue: reportedScheduledPaymentAmount.value,
    reportedScheduledPaymentAmountFieldState: reportedScheduledPaymentAmount.state,
    reportedLastPaymentDateValue,
    balanceValue: firstNonEmptyText(reportedBalance.value, latestMeaningfulHistoryValue(balanceHistoryCells)),
    originalBalanceValue: normalizeText(String(account.originalBalance ?? "")),
    amountPastDueValue: firstNonEmptyText(String(account.amountPastDue ?? ""), latestPositiveMoneyHistoryValue(pastDueHistoryCells)),
    chargeOffAmountValue: normalizeText(String(account.chargeOffAmount ?? "")),
    creditLimitValue: firstNonEmptyText(String(account.creditLimit ?? ""), latestPositiveMoneyHistoryValue(creditLimitHistoryCells)),
    highestBalanceValue: firstNonEmptyText(String(account.highCredit ?? ""), String(account.highBalance ?? ""), maxMoneyHistoryValue(highCreditHistoryCells), maxMoneyHistoryValue(balanceHistoryCells)),
    originalCreditorText: normalizeText(String(account.originalCreditorName ?? "")),
    paymentAmountValue: firstNonEmptyText(String(account.actualPaymentAmount ?? ""), String(account.scheduledPaymentAmount ?? ""), derivedPaymentAmountValue),
    scheduledPaymentAmountValue: firstNonEmptyText(String(account.scheduledPaymentAmount ?? ""), derivedPaymentAmountValue),
    recentPaymentValue: firstNonEmptyText(String(account.actualPaymentAmount ?? ""), derivedPaymentAmountValue),
    lastPaymentDateValue,
    dateOfFirstDelinquencyValue: firstNonEmptyText(String(account.dateOfFirstDelinquency ?? ""), String(account.dateMajorDelinquencyFirstReported ?? "")),
    dateOpenedValue: normalizeText(String(account.dateOpened ?? "")),
    dateReportedValue: normalizeText(String(account.dateReported ?? "")),
    dateClosedValue,
    closureTimingValue,
    closureMonthKey,
    closureMonthPaymentStatus: closureMonthFacts.closureMonthPaymentStatus,
    closureMonthActualPaymentValue: closureMonthFacts.closureMonthActualPaymentValue,
    closureMonthHasTableActivity: closureMonthFacts.closureMonthHasTableActivity,
    lastPaymentSignalValue: lastPaymentSignal.value,
    lastPaymentSignalKind: lastPaymentSignal.kind,
    paymentTimingSignals,
    reportingTimingSignals,
    statusUpdatedValue,
    balanceUpdatedValue,
    estimatedRemovalValue: normalizeText(String(account.onRecordUntil ?? "")),
    termsFrequencyValue: normalizeText(String(account.termsFrequency ?? "")),
    termDurationValue: normalizeText(String(account.termDuration ?? "")),
    monthsReviewedValue: normalizeText(String(account.monthsReviewed ?? "")),
    isClosed,
    month24Sections,
    month24NarrativeCodes: comments,
  };
};

const buildTransunionAccountView = (account: AnyRecord): ReasonAccountView | null => {
  const accountInfo = (account.accountInfo ?? {}) as AnyRecord;
  const contactInfo = (account.contactInfo ?? {}) as AnyRecord;
  const historyEvidence = (account._historyEvidence ?? {}) as AnyRecord;
  const displayName = normalizeText(String(account.accountName ?? accountInfo.accountName ?? ""));
  const accountNumber = normalizeText(String(account.accountNumber ?? accountInfo.accountNumber ?? ""));
  if (!hasAccountIdentity(displayName, accountNumber)) {
    return null;
  }

  const paymentRows = Array.isArray(account.paymentHistory) ? account.paymentHistory : [];
  const { values, years, cells } = flattenHistoryRows(paymentRows);
  const balanceHistories = Array.isArray(account.balanceHistories) ? (account.balanceHistories as AnyRecord[]) : [];
  const balanceRows = historyRowsByLabel(balanceHistories, "Balance");
  const pastDueRows = historyRowsByLabel(balanceHistories, "Past Due");
  const highCreditRows = historyRowsByLabel(balanceHistories, "High Credit");
  const creditLimitRows = historyRowsByLabel(balanceHistories, "Credit Limit");
  const paidAmountRows = historyRowsByLabel(balanceHistories, "Amount Paid");
  const scheduledPaymentRows = historyRowsByLabel(balanceHistories, "Scheduled Payment");
  const remarksRows = historyRowsByLabel(balanceHistories, "Remarks");
  const balanceHistoryCells = historyCellsFromRows(balanceRows);
  const pastDueHistoryCells = historyCellsFromRows(pastDueRows);
  const highCreditHistoryCells = historyCellsFromRows(highCreditRows);
  const creditLimitHistoryCells = historyCellsFromRows(creditLimitRows);
  const paidAmountHistoryCells = historyCellsFromRows(paidAmountRows);
  const scheduledPaymentHistoryCells = historyCellsFromRows(scheduledPaymentRows);
  const remarksHistory = historyCommentsFromRows(remarksRows);
  const derivedCreditLimitText = extractContextualMoneyText(String(accountInfo.creditLimitHistory ?? ""), ["credit limit"]);
  const derivedRecentPaymentValue = latestMeaningfulHistoryValue(paidAmountHistoryCells);
  const derivedScheduledPaymentValue = latestPositiveMoneyHistoryValue(scheduledPaymentHistoryCells);
  const derivedLastPaymentDateValue = extractDateText(firstNonEmptyText(String(accountInfo.paymentReceived ?? ""), derivedRecentPaymentValue));
  const reportedBalance = classifyReportedMoneyField([{ record: accountInfo, key: "balance" }]);
  const reportedPaymentAmount = classifyReportedMoneyField([{ record: accountInfo, key: "paymentReceived" }]);
  const reportedScheduledPaymentAmount = classifyReportedMoneyField([{ record: accountInfo, key: "monthlyPayment" }]);
  const reportedLastPaymentDateValue = firstNonEmptyText(String(accountInfo.lastPaymentMade ?? ""));
  const dateClosedValue = normalizeText(String(accountInfo.dateClosed ?? ""));
  const lastPaymentDateValue = firstNonEmptyText(reportedLastPaymentDateValue, derivedLastPaymentDateValue);
  const statusUpdatedValue = normalizeText(String(accountInfo.dateUpdated ?? ""));
  const balanceUpdatedValue = normalizeText(String(accountInfo.dateUpdated ?? ""));
  const isClosed =
    Boolean(account.isClosed) ||
    !isMissing(dateClosedValue) ||
    hasToken([String(accountInfo.payStatus ?? ""), String(accountInfo.remarks ?? "")].join(" "), ["closed", "paid and closed", "closed or paid"]);
  const closureTimingValue = deriveClosureTimingValue(isClosed, dateClosedValue, statusUpdatedValue, balanceUpdatedValue);
  const closureMonthKey = deriveClosureMonthKey(closureTimingValue, reportedLastPaymentDateValue);
  const closureMonthFacts = deriveClosureMonthFacts(closureMonthKey, cells, paidAmountHistoryCells);
  const lastPaymentSignal = deriveLastPaymentSignal(reportedPaymentAmount.value, reportedLastPaymentDateValue);
  const paymentTimingSignals = buildScalarTimingSignals([
    { value: reportedLastPaymentDateValue, label: "Reported last payment date field", amountValue: reportedPaymentAmount.value },
    { value: extractDateText(String(accountInfo.paymentReceived ?? "")), label: "Payment received date field", amountValue: reportedPaymentAmount.value },
    {
      value: lastPaymentDateValue,
      label: "Derived last payment timing",
      amountValue: firstNonEmptyText(String(accountInfo.paymentReceived ?? ""), derivedRecentPaymentValue),
    },
  ]);
  const reportingTimingSignals = buildScalarTimingSignals([
    { value: normalizeText(String(accountInfo.dateUpdated ?? "")), label: "Reported date field" },
    { value: statusUpdatedValue, label: "Status-updated date field" },
    { value: balanceUpdatedValue, label: "Balance-updated date field" },
    { value: dateClosedValue, label: "Closed date field" },
  ]);

  return {
    displayName,
    accountTypeText: firstNonEmptyText(String(accountInfo.accountType ?? ""), String(accountInfo.loanType ?? "")),
    accountCategoryText: firstNonEmptyText(String(accountInfo.loanType ?? ""), String(account.sectionType ?? "")),
    accountSubtypeText: "",
    reportingCategoryText: "",
    legalCategoryText: "",
    consumerInformationIndicatorText: "",
    accountNumber,
    entityKey: accountEntityKey(displayName, accountNumber),
    sourcePages: normalizePages(account.sourcePages as number[] | undefined),
    statusText: firstNonEmptyText(String(accountInfo.payStatus ?? ""), String(accountInfo.accountStatus ?? ""), String(account.accountStatus ?? ""), String(account.status ?? "")),
    responsibilityText: normalizeText(String(accountInfo.responsibility ?? "")),
    addressText: normalizeText(String(contactInfo.address?.join(" ") ?? accountInfo.address ?? "")),
    phoneText: normalizeText(String(contactInfo.phoneNumber ?? accountInfo.phoneNumber ?? "")),
    comments: extractCommentLines(accountInfo.remarks, accountInfo.comments, remarksHistory),
    additionalInformationLines: extractCommentLines(account.additionalInformation, accountInfo.additionalInformation),
    consumerStatementLines: extractCommentLines(account.consumerStatement),
    reinvestigationInfoLines: extractCommentLines(account.reinvestigationInfo),
    paymentHistory: values,
    paymentHistoryYears: years,
    paymentHistoryCells: cells,
    paymentHistoryGapCells: historyCellsFromEvidenceRows((historyEvidence.paymentHistoryGapSlots ?? []) as unknown[]),
    balanceHistoryValues: flattenMonthlyHistoryRows(balanceRows),
    balanceHistoryCells,
    paidAmountHistoryCells,
    scheduledPaymentHistoryCells,
    amountPastDueHistoryValues: flattenMonthlyHistoryRows(pastDueRows),
    amountPastDueHistoryCells: pastDueHistoryCells,
    creditLimitHistoryValues: uniqueStrings([
      ...flattenMonthlyHistoryRows(creditLimitRows),
      derivedCreditLimitText,
    ]),
    creditLimitHistoryCells,
    reportedBalanceValue: reportedBalance.value,
    reportedBalanceFieldState: reportedBalance.state,
    reportedPaymentAmountValue: reportedPaymentAmount.value,
    reportedPaymentAmountFieldState: reportedPaymentAmount.state,
    reportedScheduledPaymentAmountValue: reportedScheduledPaymentAmount.value,
    reportedScheduledPaymentAmountFieldState: reportedScheduledPaymentAmount.state,
    reportedLastPaymentDateValue,
    balanceValue: firstNonEmptyText(reportedBalance.value, latestMeaningfulHistoryValue(balanceHistoryCells)),
    originalBalanceValue: normalizeText(String(accountInfo.originalBalance ?? "")),
    amountPastDueValue: firstNonEmptyText(String(accountInfo.amountPastDue ?? ""), latestPositiveMoneyHistoryValue(pastDueHistoryCells)),
    chargeOffAmountValue: firstNonEmptyText(String(accountInfo.chargeOffAmount ?? ""), extractContextualMoneyText(String(accountInfo.payStatus ?? ""), ["charge off", "charged off"])),
    creditLimitValue: firstNonEmptyText(String(accountInfo.creditLimit ?? ""), derivedCreditLimitText, latestPositiveMoneyHistoryValue(creditLimitHistoryCells)),
    highestBalanceValue: firstNonEmptyText(String(accountInfo.highBalance ?? ""), String(accountInfo.highCredit ?? ""), maxMoneyHistoryValue(highCreditHistoryCells), maxMoneyHistoryValue(balanceHistoryCells)),
    originalCreditorText: normalizeText(String(accountInfo.originalCreditor ?? "")),
    paymentAmountValue: firstNonEmptyText(String(accountInfo.monthlyPayment ?? ""), derivedScheduledPaymentValue, String(accountInfo.paymentReceived ?? ""), derivedRecentPaymentValue),
    scheduledPaymentAmountValue: firstNonEmptyText(String(accountInfo.monthlyPayment ?? ""), derivedScheduledPaymentValue),
    recentPaymentValue: firstNonEmptyText(String(accountInfo.paymentReceived ?? ""), derivedRecentPaymentValue),
    lastPaymentDateValue,
    dateOfFirstDelinquencyValue: normalizeText(String(accountInfo.dateOfFirstDelinquency ?? "")),
    dateOpenedValue: normalizeText(String(accountInfo.dateOpened ?? "")),
    dateReportedValue: normalizeText(String(accountInfo.dateUpdated ?? "")),
    dateClosedValue,
    closureTimingValue,
    closureMonthKey,
    closureMonthPaymentStatus: closureMonthFacts.closureMonthPaymentStatus,
    closureMonthActualPaymentValue: closureMonthFacts.closureMonthActualPaymentValue,
    closureMonthHasTableActivity: closureMonthFacts.closureMonthHasTableActivity,
    lastPaymentSignalValue: lastPaymentSignal.value,
    lastPaymentSignalKind: lastPaymentSignal.kind,
    paymentTimingSignals,
    reportingTimingSignals,
    statusUpdatedValue,
    balanceUpdatedValue,
    estimatedRemovalValue: normalizeText(String(accountInfo.estimatedRemoval ?? "")),
    termsFrequencyValue: normalizeText(String(accountInfo.terms ?? "")),
    termDurationValue: normalizeText(String(accountInfo.termDuration ?? accountInfo.terms ?? "")),
    monthsReviewedValue: normalizeText(String(accountInfo.monthsReviewed ?? "")),
    isClosed,
    month24Sections: undefined,
    month24NarrativeCodes: undefined,
  };
};

const filterPositiveMoneyMonths = (cells: HistoryCell[]) => {
  const months: Array<{ key: HistoryMonthKey; value: number; raw: string }> = [];
  for (const cell of cells) {
    const parsed = parseMoneyValue(cell.value);
    if ((parsed ?? 0) > 0) {
      months.push({ key: toHistoryMonthKey(cell.year, cell.month), value: parsed!, raw: cell.value });
    }
  }
  return months;
};

const describeMonthConflicts = (keys: HistoryMonthKey[], lookup: Map<HistoryMonthKey, string>, fallback = "blank") =>
  keys.map((key) => `${formatHistoryMonth(key)} (${lookup.get(key) || fallback})`);

const hasHistoryCode = (values: string[], code: string) => values.some((value) => normalizeHistoryCode(value) === code);

const historySeverityRank = (value: string | null | undefined) => {
  switch (normalizeHistoryCode(value)) {
    case "30":
      return 1;
    case "60":
      return 2;
    case "90":
      return 3;
    case "120":
      return 4;
    case "150":
      return 5;
    case "180":
      return 6;
    case "c":
    case "col":
      return 7;
    case "co":
      return 8;
    case "r":
    case "f":
    case "v":
    case "b":
    case "vs":
      return 9;
    default:
      return 0;
  }
};

const findDelinquencyProgressionConflicts = (cells: HistoryCell[]) => {
  const conflicts: Array<{ from: HistoryCell; to: HistoryCell }> = [];
  let previousDerogatory: HistoryCell | null = null;
  for (const cell of cells) {
    if (isBlankHistoryValue(cell.value)) {
      continue;
    }
    if (isCurrentHistoryValue(cell.value)) {
      previousDerogatory = null;
      continue;
    }
    if (!isDerogatoryHistoryValue(cell.value)) {
      continue;
    }
    if (previousDerogatory) {
      const previousRank = historySeverityRank(previousDerogatory.value);
      const currentRank = historySeverityRank(cell.value);
      if (previousRank > 0 && currentRank > 0 && currentRank < previousRank) {
        conflicts.push({ from: previousDerogatory, to: cell });
      }
    }
    previousDerogatory = cell;
  }
  return conflicts;
};

const formatHistoryCellMonth = (cell: HistoryCell) => formatHistoryMonth(toHistoryMonthKey(cell.year, cell.month));
const parseHistoryCellDate = (cell: HistoryCell) => parseDateLike(formatHistoryCellMonth(cell));
const daysBetweenDates = (left: Date, right: Date) => Math.round((right.getTime() - left.getTime()) / 86_400_000);

const analyzeThirtyDayLateIntervals = (
  account: ReasonAccountView,
  paidAmountLookup: Map<HistoryMonthKey, string> = toHistoryLookup(
    account.paidAmountHistoryCells.length > 0 ? account.paidAmountHistoryCells : account.month24Sections?.paymentAmount ?? [],
  ),
  balanceHistoryLookup: Map<HistoryMonthKey, string> = toHistoryLookup(
    account.balanceHistoryCells.length > 0 ? account.balanceHistoryCells : account.month24Sections?.balance ?? [],
  ),
) => {
  const conflicts: ThirtyDayLateIntervalConflict[] = [];
  const evaluatedMonths = new Set<HistoryMonthKey>();
  const thirtyDayLateCells = sortHistoryCellsChronologically(account.paymentHistoryCells).filter(
    (cell) => normalizeHistoryCode(cell.value) === "30",
  );
  const paymentSignals = [...account.paymentTimingSignals].sort((left, right) => left.date.getTime() - right.date.getTime());
  const reportingSignals = [...account.reportingTimingSignals].sort((left, right) => left.date.getTime() - right.date.getTime());

  for (const current of thirtyDayLateCells) {
    const currentKey = toHistoryMonthKey(current.year, current.month);
    const currentSignals = [...paymentSignals.filter((signal) => signal.monthKey === currentKey), ...reportingSignals.filter((signal) => signal.monthKey === currentKey)].sort(
      (left, right) => left.date.getTime() - right.date.getTime(),
    );
    let bestPair: { currentSignal: DayLevelTimingSignal; previousSignal: DayLevelTimingSignal; intervalDays: number } | null = null;

    for (const currentSignal of currentSignals) {
      const previousSignal = [...paymentSignals]
        .filter((signal) => signal.date.getTime() < currentSignal.date.getTime())
        .filter((signal) => {
          const monthDistance = historyMonthSortValue(currentKey) - historyMonthSortValue(signal.monthKey);
          return monthDistance >= 0 && monthDistance <= 1;
        })
        .filter((signal) => {
          const intervalDays = daysBetweenDates(signal.date, currentSignal.date);
          return intervalDays > 0 && intervalDays <= 45;
        })
        .pop();

      if (!previousSignal) {
        continue;
      }

      const intervalDays = daysBetweenDates(previousSignal.date, currentSignal.date);
      evaluatedMonths.add(currentKey);
      if (!bestPair || intervalDays < bestPair.intervalDays) {
        bestPair = { currentSignal, previousSignal, intervalDays };
      }
    }

    if (!bestPair || ![28, 29].includes(bestPair.intervalDays)) {
      continue;
    }

    const previousBalanceValue = balanceHistoryLookup.get(bestPair.previousSignal.monthKey) ?? "";
    const currentBalanceValue = balanceHistoryLookup.get(currentKey) ?? "";
    const corroboratingPaidAmountValue =
      [
        paidAmountLookup.get(currentKey) ?? "",
        paidAmountLookup.get(bestPair.previousSignal.monthKey) ?? "",
        bestPair.currentSignal.amountValue ?? "",
        bestPair.previousSignal.amountValue ?? "",
      ].find((value) => (parseMoneyValue(value) ?? 0) > 0) ?? "";

    conflicts.push({
      current,
      currentSignal: bestPair.currentSignal,
      previousSignal: bestPair.previousSignal,
      intervalDays: bestPair.intervalDays,
      corroboratingPaidAmountValue: corroboratingPaidAmountValue || undefined,
      previousBalanceValue: previousBalanceValue || undefined,
      currentBalanceValue: currentBalanceValue || undefined,
    });
  }

  return {
    conflicts,
    evaluatedMonths: Array.from(evaluatedMonths),
  };
};

const findPreviousMeaningfulHistoryCell = (cells: HistoryCell[], index: number) => {
  for (let pointer = index - 1; pointer >= 0; pointer -= 1) {
    if (!isBlankHistoryValue(cells[pointer]?.value)) {
      return cells[pointer];
    }
  }
  return null;
};

const hasMeaningfulHistoryBeforeIndex = (cells: HistoryCell[], index: number) => {
  for (let pointer = 0; pointer < index; pointer += 1) {
    if (!isBlankHistoryValue(cells[pointer]?.value)) {
      return true;
    }
  }
  return false;
};

const collectImmediateBlankGap = (cells: HistoryCell[], index: number) => {
  const gap: HistoryCell[] = [];
  for (let pointer = index - 1; pointer >= 0; pointer -= 1) {
    if (!isBlankHistoryValue(cells[pointer]?.value)) {
      break;
    }
    gap.push(cells[pointer]);
  }
  return gap.reverse();
};

const isSevereDerogatoryHistoryValue = (value: string | null | undefined) => {
  const normalized = normalizeHistoryCode(value);
  return ["60", "90", "120", "150", "180", "c", "col", "co", "r", "f", "v", "b", "vs"].includes(normalized);
};

const isChargeOffOrCollectionHistoryValue = (value: string | null | undefined) => {
  const normalized = normalizeHistoryCode(value);
  return normalized === "c" || normalized === "col" || normalized === "co";
};

const historyStartsBeforeCell = (dateOpenedValue: string, cell: HistoryCell) => {
  const openedDate = parseDateLike(dateOpenedValue);
  const cellDate = parseHistoryCellDate(cell);
  return Boolean(openedDate && cellDate && monthsBetweenDates(openedDate, cellDate) >= 1);
};

const resolvePaymentHistoryLookbackMonths = (account: ReasonAccountView) => {
  const defaultLookbackMonths = 84;
  const reviewedMonths = parsePositiveInteger(account.monthsReviewedValue);
  if (isStudentLoanLikeAccount(account) && (reviewedMonths ?? 0) > defaultLookbackMonths) {
    return reviewedMonths ?? defaultLookbackMonths;
  }
  return defaultLookbackMonths;
};

const findPaymentHistoryGapSinceOpenedDate = (
  cells: HistoryCell[],
  dateOpenedValue: string,
  anchorDateValue: string,
  maxLookbackMonths = 84,
) => {
  const firstReportedCell = earliestMeaningfulHistoryCell(cells);
  const openedDate = parseDateLike(dateOpenedValue);
  const anchorDate = parseDateLike(anchorDateValue);
  if (!firstReportedCell || !openedDate || !anchorDate) {
    return null;
  }

  const firstReportedDate = parseHistoryCellDate(firstReportedCell);
  if (!firstReportedDate) {
    return null;
  }

  // Operator ruling (Session 23): a payment can never be reported for the
  // month the account opened — the first month history can be expected for is
  // the month AFTER opening. Expecting the opening month itself produced
  // logically impossible "missing month" disputes on newly opened accounts.
  const firstExpectableMonth = addUtcMonths(startOfUtcMonth(openedDate), 1);
  const expectedStartDate = startOfUtcMonth(
    monthsBetweenDates(addUtcMonths(startOfUtcMonth(anchorDate), -(maxLookbackMonths - 1)), firstExpectableMonth) > 0
      ? firstExpectableMonth
      : addUtcMonths(startOfUtcMonth(anchorDate), -(maxLookbackMonths - 1)),
  );
  const firstReportedMonthDate = startOfUtcMonth(firstReportedDate);

  if (monthsBetweenDates(expectedStartDate, firstReportedMonthDate) <= 0) {
    return null;
  }

  const gapMonths: HistoryMonthKey[] = [];
  const gapEndMonth = addUtcMonths(firstReportedMonthDate, -1);
  for (let cursor = expectedStartDate; monthsBetweenDates(cursor, gapEndMonth) >= 0; cursor = addUtcMonths(cursor, 1)) {
    gapMonths.push(historyMonthKeyFromDate(cursor));
  }

  return gapMonths.length
    ? {
        expectedLookbackMonths: maxLookbackMonths,
        expectedStart: historyMonthKeyFromDate(expectedStartDate),
        firstReportedMonth: toHistoryMonthKey(firstReportedCell.year, firstReportedCell.month),
        gapMonths,
      }
    : null;
};

const findSevereJumpWithoutPredecessorSupport = (cells: HistoryCell[]) => {
  const sorted = sortHistoryCellsChronologically(cells);
  const conflicts: HistorySequenceConflict[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (!isSevereDerogatoryHistoryValue(current.value)) {
      continue;
    }
    const previous = findPreviousMeaningfulHistoryCell(sorted, index);
    if (!previous) {
      continue;
    }
    const previousRank = historySeverityRank(previous.value);
    const currentRank = historySeverityRank(current.value);
    const jumpedFromCurrent = isCurrentHistoryValue(previous.value);
    const skippedSeverityStep = previousRank > 0 && currentRank > previousRank + 1;
    if (jumpedFromCurrent || skippedSeverityStep) {
      conflicts.push({
        current,
        previous,
        gapMonths: collectImmediateBlankGap(sorted, index).map((cell) => toHistoryMonthKey(cell.year, cell.month)),
      });
    }
  }
  return conflicts;
};

const findReagingJumpAfterCurrentReset = (cells: HistoryCell[]) => {
  const sorted = sortHistoryCellsChronologically(cells);
  const conflicts: HistorySequenceConflict[] = [];
  let sawEarlierDerogatory = false;
  let latestCurrentReset: { cell: HistoryCell } | null = null;
  for (let index = 0; index < sorted.length; index += 1) {
    const cell = sorted[index];
    if (isBlankHistoryValue(cell.value)) {
      continue;
    }
    if (isDerogatoryHistoryValue(cell.value)) {
      if (latestCurrentReset && isSevereDerogatoryHistoryValue(cell.value)) {
        conflicts.push({
          current: cell,
          previous: latestCurrentReset.cell,
          gapMonths: collectImmediateBlankGap(sorted, index).map((gapCell) => toHistoryMonthKey(gapCell.year, gapCell.month)),
        });
      }
      sawEarlierDerogatory = true;
      latestCurrentReset = null;
      continue;
    }
    if (isCurrentHistoryValue(cell.value) && sawEarlierDerogatory) {
      latestCurrentReset = { cell };
    }
  }
  return conflicts;
};

const findFirstThirtyDayLateWithoutPriorSupport = (cells: HistoryCell[], dateOpenedValue: string) => {
  const sorted = sortHistoryCellsChronologically(cells);
  const firstThirtyIndex = sorted.findIndex((cell) => normalizeHistoryCode(cell.value) === "30");
  if (firstThirtyIndex < 0) {
    return null;
  }
  const current = sorted[firstThirtyIndex];
  if (hasMeaningfulHistoryBeforeIndex(sorted, firstThirtyIndex) || !historyStartsBeforeCell(dateOpenedValue, current)) {
    return null;
  }
  const gapMonths = sorted.slice(0, firstThirtyIndex).filter((cell) => isBlankHistoryValue(cell.value)).map((cell) => toHistoryMonthKey(cell.year, cell.month));
  return { current, previous: null, gapMonths };
};

const findFirstDerogatoryMonthWithoutPriorSupport = (cells: HistoryCell[], dateOpenedValue: string) => {
  const sorted = sortHistoryCellsChronologically(cells);
  const firstDerogatoryIndex = sorted.findIndex((cell) => isDerogatoryHistoryValue(cell.value));
  if (firstDerogatoryIndex < 0) {
    return null;
  }
  const current = sorted[firstDerogatoryIndex];
  if (!isSevereDerogatoryHistoryValue(current.value)) {
    return null;
  }
  if (hasMeaningfulHistoryBeforeIndex(sorted, firstDerogatoryIndex) || !historyStartsBeforeCell(dateOpenedValue, current)) {
    return null;
  }
  const gapMonths = sorted.slice(0, firstDerogatoryIndex).filter((cell) => isBlankHistoryValue(cell.value)).map((cell) => toHistoryMonthKey(cell.year, cell.month));
  return { current, previous: null, gapMonths };
};

const findBlankGapBeforeDerogatoryMonth = (cells: HistoryCell[]) => {
  const sorted = sortHistoryCellsChronologically(cells);
  const conflicts: HistorySequenceConflict[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (!isDerogatoryHistoryValue(current.value)) {
      continue;
    }
    const gap = collectImmediateBlankGap(sorted, index);
    if (gap.length === 0 || gap.length >= 3) {
      continue;
    }
    if (!hasMeaningfulHistoryBeforeIndex(sorted, index - gap.length)) {
      continue;
    }
    conflicts.push({
      current,
      previous: findPreviousMeaningfulHistoryCell(sorted, index),
      gapMonths: gap.map((cell) => toHistoryMonthKey(cell.year, cell.month)),
    });
  }
  return conflicts;
};

const findRetroactiveDerogatoryBackfillAfterGap = (cells: HistoryCell[]) => {
  const sorted = sortHistoryCellsChronologically(cells);
  const conflicts: HistorySequenceConflict[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (!isSevereDerogatoryHistoryValue(current.value)) {
      continue;
    }
    const gap = collectImmediateBlankGap(sorted, index);
    if (gap.length < 3 || !hasMeaningfulHistoryBeforeIndex(sorted, index - gap.length)) {
      continue;
    }
    conflicts.push({
      current,
      previous: findPreviousMeaningfulHistoryCell(sorted, index),
      gapMonths: gap.map((cell) => toHistoryMonthKey(cell.year, cell.month)),
    });
  }
  return conflicts;
};

const findChargeOffOrCollectionWithoutMonthlyBuildUp = (cells: HistoryCell[]) => {
  const sorted = sortHistoryCellsChronologically(cells);
  const conflicts: HistorySequenceConflict[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (!isChargeOffOrCollectionHistoryValue(current.value)) {
      continue;
    }
    const previous = findPreviousMeaningfulHistoryCell(sorted, index);
    const priorDerogatoryRanks = sorted
      .slice(0, index)
      .filter((cell) => isDerogatoryHistoryValue(cell.value))
      .map((cell) => historySeverityRank(cell.value));
    const highestPriorRank = priorDerogatoryRanks.length ? Math.max(...priorDerogatoryRanks) : 0;
    if (!previous || isCurrentHistoryValue(previous.value) || highestPriorRank < 4) {
      conflicts.push({ current, previous });
    }
  }
  return conflicts;
};

const hasAccountPaymentPlanContext = (account: ReasonAccountView) => {
  const combined = normalizeMatchText(
    [
      account.statusText,
      account.accountTypeText,
      account.accountCategoryText,
      account.accountSubtypeText,
      account.legalCategoryText,
      account.comments.join(" "),
      account.additionalInformationLines.join(" "),
      ...(account.month24NarrativeCodes ?? []),
    ].join(" "),
  );
  return PAYMENT_PLAN_TOKENS.some((token) => combined.includes(token));
};

const hasAnyPaymentActivityEvidence = (account: ReasonAccountView) =>
  account.paidAmountHistoryCells.some((cell) => (parseMoneyValue(cell.value) ?? 0) > 0) ||
  account.scheduledPaymentHistoryCells.some((cell) => (parseMoneyValue(cell.value) ?? 0) > 0) ||
  (parseMoneyValue(account.recentPaymentValue) ?? 0) > 0 ||
  !isMissing(account.lastPaymentDateValue) ||
  (account.month24Sections?.lastPaymentDate ?? []).some((cell) => !isMissing(cell.value));

const collectSequenceConflictMonths = (conflicts: HistorySequenceConflict[]) =>
  Array.from(new Set(conflicts.map((conflict) => toHistoryMonthKey(conflict.current.year, conflict.current.month))));

const findPaymentActivityConflicts = (
  conflicts: HistorySequenceConflict[],
  paidAmountCells: HistoryCell[],
  scheduledPaymentCells: HistoryCell[],
  lastPaymentLookup: Map<HistoryMonthKey, string>,
  lastPaymentDateValue: string,
  recentPaymentValue: string,
) => {
  const matched: PaymentActivityConflict[] = [];
  for (const conflict of conflicts) {
    const currentKey = toHistoryMonthKey(conflict.current.year, conflict.current.month);
    const previousKey = conflict.previous ? toHistoryMonthKey(conflict.previous.year, conflict.previous.month) : null;
    const nearbyKeys = [currentKey, previousKey].filter((value): value is HistoryMonthKey => Boolean(value));
    const paidAmountCell = findHistoryCellForMonthKeys(
      paidAmountCells,
      nearbyKeys,
      (cell) => (parseMoneyValue(cell.value) ?? 0) > 0,
    );
    const scheduledAmountCell = findHistoryCellForMonthKeys(
      scheduledPaymentCells,
      nearbyKeys,
      (cell) => (parseMoneyValue(cell.value) ?? 0) > 0,
    );
    const paidAmountValue = paidAmountCell?.value ?? "";
    const scheduledAmountValue = scheduledAmountCell?.value ?? "";
    const monthlyLastPaymentValue = nearbyKeys.map((key) => lastPaymentLookup.get(key) ?? "").find((value) => !isMissing(value)) ?? "";
    const currentDate = parseHistoryCellDate(conflict.current);
    const lastPaymentDate = parseDateLike(lastPaymentDateValue);
    const lastPaymentNearConflict =
      Boolean(lastPaymentDate && currentDate) && Math.abs(monthsBetweenDates(lastPaymentDate!, currentDate!)) <= 2;
    const recentPaymentPositive = (parseMoneyValue(recentPaymentValue) ?? 0) > 0;
    if (!paidAmountValue && !scheduledAmountValue && !monthlyLastPaymentValue && !lastPaymentNearConflict && !recentPaymentPositive) {
      continue;
    }
    matched.push({
      current: conflict.current,
      previous: conflict.previous,
      gapMonths: conflict.gapMonths,
      paidAmountCell,
      scheduledAmountCell,
      paidAmountValue: paidAmountValue || undefined,
      scheduledAmountValue: scheduledAmountValue || undefined,
      lastPaymentValue: monthlyLastPaymentValue || (lastPaymentNearConflict ? lastPaymentDateValue : undefined),
      useLastPaymentField: !monthlyLastPaymentValue && lastPaymentNearConflict,
      recentPaymentValue: recentPaymentPositive ? recentPaymentValue : undefined,
    });
  }
  return matched;
};

const findBalanceReductionConflicts = (
  conflicts: HistorySequenceConflict[],
  balanceHistoryLookup: Map<HistoryMonthKey, string>,
) => {
  const matched: BalanceReductionConflict[] = [];
  for (const conflict of conflicts) {
    if (!conflict.previous) {
      continue;
    }
    const previousKey = toHistoryMonthKey(conflict.previous.year, conflict.previous.month);
    const currentKey = toHistoryMonthKey(conflict.current.year, conflict.current.month);
    const previousBalanceValue = balanceHistoryLookup.get(previousKey) ?? "";
    const currentBalanceValue = balanceHistoryLookup.get(currentKey) ?? "";
    const previousBalance = parseMoneyValue(previousBalanceValue);
    const currentBalance = parseMoneyValue(currentBalanceValue);
    if (previousBalance === null || currentBalance === null) {
      continue;
    }
    if (previousBalance - currentBalance < 25) {
      continue;
    }
    matched.push({
      current: conflict.current,
      previous: conflict.previous,
      previousBalanceValue,
      currentBalanceValue,
    });
  }
  return matched;
};

const parseDateLike = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized || isMissing(normalized)) {
    return null;
  }

  const monthYear = parseMonthYearParts(normalized);
  if (monthYear) {
    return new Date(Date.UTC(Number.parseInt(monthYear.year, 10), MONTH_KEYS.indexOf(monthYear.month), 1));
  }

  const slash = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let year = slash[3];
    if (year.length === 2) {
      year = `${Number.parseInt(year, 10) >= 70 ? "19" : "20"}${year}`;
    }
    return new Date(Date.UTC(Number.parseInt(year, 10), Number.parseInt(slash[1], 10) - 1, Number.parseInt(slash[2], 10)));
  }

  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(Date.UTC(Number.parseInt(iso[1], 10), Number.parseInt(iso[2], 10) - 1, Number.parseInt(iso[3], 10)));
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : new Date(parsed);
};

const monthsBetweenDates = (left: Date, right: Date) =>
  (right.getUTCFullYear() - left.getUTCFullYear()) * 12 + (right.getUTCMonth() - left.getUTCMonth());

const startOfUtcMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const addUtcMonths = (date: Date, amount: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
const historyMonthKeyFromDate = (date: Date) => toHistoryMonthKey(String(date.getUTCFullYear()), MONTH_KEYS[date.getUTCMonth()]);

const buildObservedValueEvidence = (pairs: Array<{ label: string; value: string | null | undefined }>): DisputeReasonEvidence => ({
  scalarComparisons: pairs
    .map(({ label, value }) => ({ label, value: normalizeText(value) || "Not reported" }))
    .filter((entry) => entry.value),
});

const countSharedPages = (left: number[], right: number[]) => {
  if (!left.length || !right.length) {
    return 0;
  }
  const rightSet = new Set(right);
  return left.reduce((count, page) => count + (rightSet.has(page) ? 1 : 0), 0);
};

const findMappedAccountForView = (view: ReasonAccountView, accounts: Account[]) => {
  const targetKey = accountEntityKey(view.displayName, view.accountNumber);
  const matches = accounts.filter((account) => accountEntityKey(account.accountName, account.accountNumber) === targetKey);
  if (!matches.length) {
    return undefined;
  }
  if (matches.length === 1) {
    return matches[0];
  }
  return [...matches].sort((left, right) => {
    const overlapDiff = countSharedPages(right.sourcePages ?? [], view.sourcePages) - countSharedPages(left.sourcePages ?? [], view.sourcePages);
    if (overlapDiff !== 0) {
      return overlapDiff;
    }
    const leftStructuredScore = Number(Boolean(left.accountSubtype)) + Number(Boolean(left.reportingCategory)) + Number(Boolean(left.legalCategory));
    const rightStructuredScore = Number(Boolean(right.accountSubtype)) + Number(Boolean(right.reportingCategory)) + Number(Boolean(right.legalCategory));
    return rightStructuredScore - leftStructuredScore;
  })[0];
};

const enrichReasonAccountView = (view: ReasonAccountView, mappedAccount?: Account): ReasonAccountView => {
  if (!mappedAccount) {
    return view;
  }
  return {
    ...view,
    accountSubtypeText: firstNonEmptyText(mappedAccount.accountSubtype ?? "", mappedAccount.accountSubtypeSourceText ?? ""),
    reportingCategoryText: firstNonEmptyText(mappedAccount.reportingCategory ?? ""),
    legalCategoryText: firstNonEmptyText(mappedAccount.legalCategory ?? ""),
    consumerInformationIndicatorText: firstNonEmptyText(mappedAccount.consumerInformationIndicator ?? ""),
    additionalInformationLines: uniqueStrings([
      ...view.additionalInformationLines,
      ...(mappedAccount.additionalInformation ?? []),
    ]),
    consumerStatementLines: uniqueStrings([
      ...view.consumerStatementLines,
      ...(mappedAccount.consumerStatement ?? []),
    ]),
    reinvestigationInfoLines: uniqueStrings([
      ...view.reinvestigationInfoLines,
      ...(mappedAccount.reinvestigationInfo ?? []),
    ]),
    comments: uniqueStrings([
      ...view.comments,
      ...(mappedAccount.comments ?? []),
    ]),
    sourcePages:
      view.sourcePages.length > 0
        ? view.sourcePages
        : normalizePages(mappedAccount.sourcePages),
  };
};

const deriveDefaultAccountSourcePages = (report: CreditReport) =>
  normalizePages([
    ...(report.sourceComponents?.accounts?.pages ?? []),
    ...(report.sourceComponents?.adverseAccounts?.pages ?? []),
    ...(report.sourceComponents?.satisfactoryAccounts?.pages ?? []),
  ]);

const buildAccountViews = (report: CreditReport): ReasonAccountView[] => {
  const defaultSourcePages = deriveDefaultAccountSourcePages(report);
  const mappedAccounts = Array.isArray(report.accounts) ? report.accounts : [];
  const rawAccounts =
    report.profileId === "experian_acr_v1"
      ? ((((report.components?.accounts as AnyRecord | undefined)?.accounts ?? []) as AnyRecord[]))
      : report.profileId === "transunion_acr_v1"
        ? [
            ...((((report.components?.adverseAccounts as AnyRecord | undefined)?.accounts ?? []) as AnyRecord[])),
            ...((((report.components?.satisfactoryAccounts as AnyRecord | undefined)?.accounts ?? []) as AnyRecord[])),
          ]
        : report.profileId === "equifax_new_v1"
          ? // Equifax-new keeps the RAW components shape — its dedicated builder reads
            // row-objects, month24History sections, and _historyEvidence, all of which
            // the legacy account mapper drops.
            ((((report.components?.accounts as AnyRecord | undefined)?.accounts ?? report.accounts ?? []) as AnyRecord[]))
          : // Generic/Equifax-old path: prefer the mapper's enriched top-level accounts —
            // resultMapper.attachAccountSources anchors the flat payment grid with
            // paymentHistoryYears from meta.accountHistoryEvidence (plus per-account
            // sourcePages). The raw components container lacks those anchors, which
            // starves every paymentHistoryCells-based detection (delinquency
            // progression, missing months, cross-table conflicts) into silent no-ops.
            (((Array.isArray(report.accounts) && report.accounts.length > 0
              ? report.accounts
              : ((report.components?.accounts as AnyRecord | undefined)?.accounts ?? [])) as AnyRecord[]));

  return rawAccounts
    .map((account) => {
      if (report.profileId === "experian_acr_v1") {
        return buildExperianAccountView(account);
      }
      if (report.profileId === "transunion_acr_v1") {
        return buildTransunionAccountView(account);
      }
      if (report.profileId === "equifax_new_v1") {
        return buildEquifaxNewAccountView(account);
      }
      return buildGenericAccountView(account);
    })
    .filter((account): account is ReasonAccountView => Boolean(account))
    .map((account) => enrichReasonAccountView(account, findMappedAccountForView(account, mappedAccounts)))
    .map((account) => ({
      ...account,
      sourcePages: account.sourcePages.length > 0 ? account.sourcePages : defaultSourcePages,
    }));
};

const classifyAccountPosture = (account: ReasonAccountView, report: CreditReport): AccountPosture => {
  if (isNegativeByFields(account)) {
    return "negative";
  }

  if (
    report.profileId === "transunion_acr_v1" &&
    normalizePages(account.sourcePages).some((page) => (report.sourceComponents?.adverseAccounts?.pages ?? []).includes(page))
  ) {
    return "negative";
  }

  return "positive";
};

const buildAccountPostureMap = (accountViews: ReasonAccountView[], report: CreditReport) => {
  const postureByEntityKey = new Map<string, AccountPosture>();
  for (const account of accountViews) {
    postureByEntityKey.set(account.entityKey, classifyAccountPosture(account, report));
  }
  return postureByEntityKey;
};

const deriveReasonDefaults = (
  reason: DisputeReason,
  postureByEntityKey: Map<string, AccountPosture>,
): Pick<DisputeReason, "category" | "defaultSelected" | "selectionBasis" | "selected" | "isAttorneyEscalation"> => {
  const category = reason.category ?? ISSUE_CATEGORY_MAP[reason.issueType] ?? "report_review";
  const isAttorneyEscalation = reason.isAttorneyEscalation || ATTORNEY_ESCALATION_ISSUE_TYPES.has(reason.issueType);
  if (typeof reason.defaultSelected === "boolean" && reason.selectionBasis) {
    return {
      category,
      defaultSelected: reason.defaultSelected,
      selectionBasis: reason.selectionBasis,
      selected: typeof reason.selected === "boolean" ? reason.selected : reason.defaultSelected,
      isAttorneyEscalation,
    };
  }
  if (isAttorneyEscalation) {
    return {
      category,
      defaultSelected: true,
      selectionBasis: "attorney_escalation",
      selected: typeof reason.selected === "boolean" ? reason.selected : true,
      isAttorneyEscalation,
    };
  }
  if (reason.entityType === "account") {
    const posture = postureByEntityKey.get(reason.entityKey) ?? "negative";
    const defaultSelected = category === "legal_public_record" || posture === "negative";
    return {
      category,
      defaultSelected,
      selectionBasis: category === "legal_public_record"
        ? "explicit"
        : posture === "negative"
          ? "negative_account"
          : "positive_account",
      selected: typeof reason.selected === "boolean" ? reason.selected : defaultSelected,
      isAttorneyEscalation,
    };
  }
  return {
    category,
    defaultSelected: true,
    selectionBasis: "non_account_default",
    selected: typeof reason.selected === "boolean" ? reason.selected : true,
    isAttorneyEscalation,
  };
};

const applyReasonDefaults = (reasons: DisputeReason[], postureByEntityKey: Map<string, AccountPosture>) =>
  reasons.map((reason) => ({
    ...reason,
    ...deriveReasonDefaults(reason, postureByEntityKey),
  }));

const ACCOUNT_RULE_DEFINITIONS: AccountRuleDefinition[] = [
  {
    issueType: "duplicate_conflicting_tradeline",
    issueLabel: "Conflicting tradeline reporting",
    category: "account_identity",
    description: "Checks whether the same masked account identifier appears more than once with conflicting balances or statuses.",
    applies: () => true,
    canEvaluate: () => true,
  },
  {
    issueType: "missing_account_number",
    issueLabel: "Incomplete account identifier",
    category: "account_identity",
    description: "Checks whether the tradeline exposes enough account-number detail to verify the reported account identity.",
    applies: () => true,
    canEvaluate: () => true,
  },
  {
    issueType: "missing_furnisher_identification",
    issueLabel: "Incomplete furnisher identification",
    category: "account_identity",
    description: "Checks whether the tradeline provides enough creditor contact information to identify the reporting furnisher.",
    applies: () => true,
    canEvaluate: () => true,
  },
  {
    issueType: "missing_account_status",
    issueLabel: "Account status is incomplete",
    category: "account_identity",
    description: "Checks whether a derogatory or collection-style tradeline is missing a usable current status field.",
    applies: (account) => isNegativeByFields(account),
    canEvaluate: () => true,
  },
  {
    issueType: "incomplete_original_creditor_identity",
    issueLabel: "Original creditor identity is incomplete",
    category: "account_identity",
    description: "Checks whether a collection-style tradeline discloses the original creditor or lender identity well enough to verify the account.",
    applies: (account) => isCollectionLikeAccount(account),
    canEvaluate: () => true,
  },
  {
    issueType: "student_loan_lender_identity_mismatch",
    issueLabel: "Student-loan lender identity is incomplete",
    category: "account_identity",
    description: "Checks whether a student-loan tradeline identifies the financial institution or lender with enough detail to verify the reporting.",
    applies: (account) => isStudentLoanLikeAccount(account),
    canEvaluate: () => true,
  },
  {
    issueType: "responsibility_requires_special_handling",
    issueLabel: "Responsibility designation requires review",
    category: "account_identity",
    description: "Checks whether the account is reported with a special responsibility designation such as joint or authorized user.",
    applies: (account) =>
      hasToken(account.responsibilityText, ["joint", "authorized user", "authorized", "co-borrower", "co signer", "cosigner"]),
    canEvaluate: (account) => !isMissing(account.responsibilityText),
  },
  {
    issueType: "account_in_litigation",
    issueLabel: "Account is reported in litigation",
    category: "legal_public_record",
    description: "Checks whether the tradeline explicitly states that the account is in litigation.",
    applies: (account) => hasAccountLitigationContext(account),
    canEvaluate: () => true,
  },
  {
    issueType: "missing_payment_history",
    issueLabel: "Payment history is missing",
    category: "payment_history",
    description: "Checks whether an active non-collection tradeline is missing a meaningful payment-history table.",
    applies: (account) => !isCollectionLikeAccount(account) && !account.isClosed,
    canEvaluate: () => true,
  },
  {
    issueType: "derogatory_status_without_monthly_support",
    issueLabel: "Derogatory reporting lacks monthly support",
    category: "payment_history",
    description: "Checks whether derogatory or past-due reporting lacks a usable month-by-month history to support it.",
    applies: (account) => isNegativeByFields(account),
    canEvaluate: () => true,
  },
  {
    issueType: "payment_history_missing_months",
    issueLabel: "Payment history has missing months",
    category: "payment_history",
    description: "Checks whether the monthly payment-history timeline has blank ranges inside an active reporting span.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "payment_history_activity_before_table_coverage",
    issueLabel: "Derogatory history predates supporting table coverage",
    category: "payment_history",
    description: "Checks whether derogatory payment-grid months predate every record in the supporting balance/past-due/payment tables, leaving that derogatory history unsupported (FCRA incompleteness).",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "payment_history_incomplete_since_open_date",
    issueLabel: "Payment history from date opened is incomplete",
    category: "payment_history",
    description: "Checks whether the payment-history timeline starts too late relative to the reported date opened, using at least a seven-year lookback when the account is older than seven years.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account) && !isMissing(account.dateOpenedValue),
  },
  {
    issueType: "monthly_payment_missing_for_open_installment",
    issueLabel: "Monthly payment is incomplete",
    category: "payment_history",
    description: "Checks whether an open installment-style account is missing its reported monthly payment obligation.",
    applies: (account) => !isCollectionLikeAccount(account) && !account.isClosed && isInstallmentLikeAccount(account) && !isRevolvingLikeAccount(account),
    canEvaluate: () => true,
  },
  {
    issueType: "recent_payment_missing_when_history_implies_payment",
    issueLabel: "Recent payment details are incomplete",
    category: "payment_history",
    description: "Checks whether the tradeline shows current payment activity while last-payment details remain missing.",
    applies: (account) =>
      !isCollectionLikeAccount(account) &&
      !account.isClosed &&
      findRecentCurrentHistoryCells(account.paymentHistoryCells).length > 0,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "payment_history_24_month_past_due_conflict",
    issueLabel: "Payment history conflicts with past-due history",
    category: "payment_history",
    description: "Checks whether positive past-due amounts are reported for months where payment history is blank or current.",
    applies: (_account, report) => report.profileId === "equifax_new_v1",
    canEvaluate: (account, report) => report.profileId === "equifax_new_v1" && hasStructuredPastDueHistory(account) && hasStructuredPaymentHistory(account),
  },
  {
    issueType: "payment_history_24_month_activity_conflict",
    issueLabel: "Payment history is incomplete relative to 24 month history",
    category: "payment_history",
    description: "Checks whether the 24-month history shows account activity in months where the payment-history table is blank.",
    applies: (_account, report) => report.profileId === "equifax_new_v1",
    canEvaluate: (account, report) => report.profileId === "equifax_new_v1" && hasStructuredMonth24History(account) && hasStructuredPaymentHistory(account),
  },
  {
    issueType: "past_due_without_monthly_support",
    issueLabel: "Past-due reporting lacks monthly support",
    category: "payment_history",
    description: "Checks whether a reported amount past due is unsupported by the tradeline's monthly payment-history codes.",
    applies: (account) => (parseMoneyValue(account.amountPastDueValue) ?? 0) > 0,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "amount_past_due_history_conflict",
    issueLabel: "Past-due history conflicts with payment history",
    category: "payment_history",
    description: "Checks whether positive past-due history exists without corresponding derogatory monthly history codes.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPastDueHistory(account) && hasStructuredPaymentHistory(account),
  },
  {
    issueType: "delinquency_progression_inconsistency",
    issueLabel: "Delinquency progression is inconsistent",
    category: "payment_history",
    description: "Checks whether the derogatory payment sequence drops to a less severe state, such as 30 -> 60 -> 30, without a current reset.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "thirty_day_late_without_full_30_day_interval",
    issueLabel: "30-day late does not reflect a full 30-day interval",
    category: "payment_history",
    description: "Checks whether a reported 30-day-late month is supported by strong day-level timing evidence showing a full 30-day interval.",
    applies: (account) => hasHistoryCode(account.paymentHistory, "30"),
    canEvaluate: (account) => analyzeThirtyDayLateIntervals(account).evaluatedMonths.length > 0,
  },
  {
    issueType: "severe_delinquency_jump_without_predecessor_support",
    issueLabel: "Severe delinquency jump lacks predecessor support",
    category: "payment_history",
    description: "Checks whether the payment history jumps into a deeper delinquency level without the expected predecessor month.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "reaging_jump_after_current_reset",
    issueLabel: "Delinquency jumps after a current reset",
    category: "payment_history",
    description: "Checks whether the payment history resets to current and then jumps back to a severe delinquency instead of restarting at 30 days late.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "first_30_day_late_without_prior_reporting_support",
    issueLabel: "First 30-day late lacks prior reporting support",
    category: "payment_history",
    description: "Checks whether the first reported 30-day late appears without earlier monthly reporting even though the account opened earlier.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account) && !isMissing(account.dateOpenedValue),
  },
  {
    issueType: "first_derogatory_month_without_prior_reporting_support",
    issueLabel: "First derogatory month lacks prior reporting support",
    category: "payment_history",
    description: "Checks whether the first severe derogatory month appears without earlier monthly reporting even though the account opened earlier.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account) && !isMissing(account.dateOpenedValue),
  },
  {
    issueType: "blank_gap_before_derogatory_month",
    issueLabel: "Blank gap appears before a derogatory month",
    category: "payment_history",
    description: "Checks whether blank payment-history months immediately precede a derogatory month inside the active reporting span.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "retroactive_derogatory_backfill_after_reporting_gap",
    issueLabel: "Derogatory reporting appears after a long gap",
    category: "payment_history",
    description: "Checks whether a long blank reporting gap is followed by severe derogatory reporting that appears backfilled into the timeline.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "charge_off_or_collection_without_monthly_build_up",
    issueLabel: "Charge-off or collection reporting lacks monthly buildup",
    category: "payment_history",
    description: "Checks whether charge-off or collection-style monthly reporting appears without enough earlier delinquency buildup in the payment history.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "payment_plan_or_forbearance_context_without_history",
    issueLabel: "Payment-plan or forbearance context lacks history",
    category: "payment_history",
    description: "Checks whether plan or forbearance context is reported without any meaningful payment history to support the tradeline timeline.",
    applies: (account) => hasAccountPaymentPlanContext(account),
    canEvaluate: () => true,
  },
  {
    issueType: "payment_plan_or_forbearance_context_with_derogatory_conflict",
    issueLabel: "Payment-plan or forbearance context conflicts with derogatory reporting",
    category: "payment_history",
    description: "Checks whether reported plan or forbearance context still shows contradictory worsening delinquency in the monthly history.",
    applies: (account) => hasAccountPaymentPlanContext(account),
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "payment_activity_conflicts_with_delinquency_progression",
    issueLabel: "Payment activity conflicts with delinquency progression",
    category: "payment_history",
    description: "Checks whether payment-activity fields indicate payments while the monthly delinquency sequence worsens in an unsupported way.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account) && hasAnyPaymentActivityEvidence(account),
  },
  {
    issueType: "balance_reduction_conflicts_with_worsening_delinquency",
    issueLabel: "Balance reduction conflicts with worsening delinquency",
    category: "payment_history",
    description: "Checks whether the reported balance declines while the payment history worsens into a more severe delinquency.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredPaymentHistory(account) && hasStructuredBalanceHistory(account),
  },
  {
    issueType: "last_payment_date_without_scheduled_payment_amount",
    issueLabel: "Last payment date lacks scheduled payment amount",
    category: "payment_history",
    description: "Checks whether the tradeline reports a last payment date without also reporting a scheduled payment amount field.",
    applies: (account) => !isMissing(account.reportedLastPaymentDateValue),
    canEvaluate: () => true,
  },
  {
    issueType: "last_payment_date_without_payment_amount",
    issueLabel: "Last payment date lacks payment amount",
    category: "payment_history",
    description: "Checks whether the tradeline reports a last payment date without also reporting a recent or actual payment amount field.",
    applies: (account) => !isMissing(account.reportedLastPaymentDateValue),
    canEvaluate: () => true,
  },
  {
    issueType: "scheduled_payment_amount_without_terms",
    issueLabel: "Scheduled payment amount lacks terms",
    category: "payment_history",
    description: "Checks whether the tradeline reports a scheduled payment amount without reporting terms or term duration information.",
    applies: (account) => hasReportedScheduledPaymentAmount(account),
    canEvaluate: () => true,
  },
  {
    issueType: "closed_account_final_month_reporting_incomplete",
    issueLabel: "Closed account final-month reporting is incomplete",
    category: "payment_history",
    description: "Checks whether a closed tradeline shows a closure-month payment-history entry and supporting table activity when last-payment reporting is present.",
    applies: (account) => account.isClosed,
    canEvaluate: (account) => Boolean(account.closureMonthKey),
  },
  {
    issueType: "closed_account_actual_payment_conflicts_with_closure_month_history",
    issueLabel: "Closed account actual payment conflicts with closure month",
    category: "payment_history",
    description: "Checks whether a closed tradeline reports an actual last-payment amount that conflicts with the closure-month actual-paid history.",
    applies: (account) => account.isClosed,
    canEvaluate: (account) =>
      Boolean(account.closureMonthKey) &&
      account.lastPaymentSignalKind === "actual_payment_amount" &&
      hasClosureMonthActualPaymentValue(account),
  },
  {
    issueType: "high_balance_not_supported_by_history",
    issueLabel: "High balance is not supported by history",
    category: "balance_amount",
    description: "Checks whether the reported high balance exceeds the historical balance data available on the tradeline.",
    applies: (account) => (parseMoneyValue(account.highestBalanceValue) ?? 0) > 0,
    canEvaluate: (account) => hasStructuredBalanceHistory(account),
  },
  {
    issueType: "payment_history_balance_history_conflict",
    issueLabel: "Balance history conflicts with payment activity",
    category: "balance_amount",
    description: "Checks whether installment payment activity is inconsistent with the reported month-to-month balance changes.",
    applies: (account) => !account.isClosed && isInstallmentLikeAccount(account),
    canEvaluate: (account) => hasStructuredBalanceHistory(account) && account.paidAmountHistoryCells.length > 0,
  },
  {
    issueType: "balance_history_monthly_gap_conflict",
    issueLabel: "Balance history has unexplained monthly gaps",
    category: "balance_amount",
    description: "Checks whether months with payment-history activity are missing matching balance-history values.",
    applies: () => true,
    canEvaluate: (account) => hasStructuredBalanceHistory(account) && hasStructuredPaymentHistory(account),
  },
  {
    issueType: "credit_limit_not_supported_by_history",
    issueLabel: "Credit limit is not supported by history",
    category: "balance_amount",
    description: "Checks whether the reported credit limit is unsupported by the tradeline's historical credit-limit data.",
    applies: (account) => (parseMoneyValue(account.creditLimitValue) ?? 0) > 0,
    canEvaluate: (account) => account.creditLimitHistoryCells.length > 0 || account.creditLimitHistoryValues.length > 0,
  },
  {
    issueType: "missing_current_balance_field",
    issueLabel: "Current balance field is missing",
    category: "balance_amount",
    description: "Checks whether a derogatory tradeline omits the current balance field entirely instead of reporting a balance, zero balance, or an explicit not-reported value.",
    applies: (account) => isNegativeByFields(account),
    canEvaluate: () => true,
  },
  {
    issueType: "insufficient_balance_history",
    issueLabel: "Balance history is incomplete",
    category: "balance_amount",
    description: "Checks whether a derogatory tradeline is missing enough balance-history data to evaluate the reported balances and status.",
    applies: (account) => isNegativeByFields(account),
    canEvaluate: () => true,
  },
  {
    issueType: "charge_off_without_chargeoff_history",
    issueLabel: "Charge-off reporting lacks charge-off history",
    category: "charge_off_collection",
    description: "Checks whether a charged-off tradeline lacks corresponding charge-off support in its monthly history.",
    applies: (account) => normalizeMatchText(account.statusText).includes("charge off") || (parseMoneyValue(account.chargeOffAmountValue) ?? 0) > 0,
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "collection_payment_activity_conflict",
    issueLabel: "Collection tradeline reflects payment activity",
    category: "charge_off_collection",
    description: "Checks whether a collection tradeline shows current payment activity without payment-plan context.",
    applies: (account) => isCollectionLikeAccount(account),
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "date_of_first_delinquency_conflict",
    issueLabel: "Date of first delinquency conflicts with payment history",
    category: "date_reporting_timeline",
    description: "Checks whether the reported date of first delinquency aligns with the earliest derogatory month shown in the tradeline history.",
    applies: (account) => !isMissing(account.dateOfFirstDelinquencyValue),
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "status_updated_timeline_conflict",
    issueLabel: "Status-updated date conflicts with timeline",
    category: "date_reporting_timeline",
    description: "Checks whether the status-updated date fits the latest payment-history timeline shown on the tradeline.",
    applies: (account) => !isMissing(account.statusUpdatedValue),
    canEvaluate: (account) => hasStructuredPaymentHistory(account),
  },
  {
    issueType: "balance_updated_timeline_conflict",
    issueLabel: "Balance-updated date conflicts with timeline",
    category: "date_reporting_timeline",
    description: "Checks whether the balance-updated date fits the latest balance-history timeline shown on the tradeline.",
    applies: (account) => !isMissing(account.balanceUpdatedValue),
    canEvaluate: (account) => hasStructuredBalanceHistory(account),
  },
  {
    issueType: "on_record_until_conflict",
    issueLabel: "On-record-until date conflicts with delinquency date",
    category: "date_reporting_timeline",
    description: "Checks whether the estimated removal or on-record-until date logically aligns with the date of first delinquency.",
    applies: (account) => !isMissing(account.dateOfFirstDelinquencyValue) && !isMissing(account.estimatedRemovalValue),
    canEvaluate: (account) => !isMissing(account.dateOfFirstDelinquencyValue) && !isMissing(account.estimatedRemovalValue),
  },
  {
    issueType: "closed_account_missing_closure_timing",
    issueLabel: "Closed account lacks closure timing",
    category: "date_reporting_timeline",
    description: "Checks whether a closed tradeline reports a usable closure date or bureau-equivalent closure timing.",
    applies: (account) => account.isClosed,
    canEvaluate: () => true,
  },
  {
    issueType: "missing_reporting_date",
    issueLabel: "Reporting date is incomplete",
    category: "date_reporting_timeline",
    description: "Checks whether a derogatory or balance-reporting tradeline is missing a usable reported date.",
    applies: (account) => isNegativeByFields(account) || hasReportedCurrentBalance(account),
    canEvaluate: () => true,
  },
  {
    issueType: "missing_status_updated_date",
    issueLabel: "Status-updated date is incomplete",
    category: "date_reporting_timeline",
    description: "Checks whether a derogatory tradeline is missing the date associated with its current reported status.",
    applies: (account) => isNegativeByFields(account),
    canEvaluate: () => true,
  },
  {
    issueType: "missing_balance_updated_date",
    issueLabel: "Balance-updated date is incomplete",
    category: "date_reporting_timeline",
    description: "Checks whether a tradeline reporting a current balance is missing the date tied to that balance.",
    applies: (account) => hasReportedCurrentBalance(account),
    canEvaluate: () => true,
  },
];

export const ACCOUNT_RULE_DEFINITION_COUNT = ACCOUNT_RULE_DEFINITIONS.length;

const detectDuplicateTradelines = (accountViews: ReasonAccountView[], report: CreditReport) => {
  const byMaskedNumber = new Map<string, ReasonAccountView[]>();
  for (const account of accountViews) {
    const key = normalizeText(account.accountNumber);
    if (!key) continue;
    const existing = byMaskedNumber.get(key) ?? [];
    existing.push(account);
    byMaskedNumber.set(key, existing);
  }

  const reasons: DisputeReason[] = [];
  for (const [maskedNumber, accounts] of byMaskedNumber.entries()) {
    if (accounts.length < 2) continue;
    const distinctStatuses = new Set(accounts.map((account) => normalizeMatchText(account.statusText)).filter(Boolean));
    const distinctBalances = new Set(accounts.map((account) => normalizeText(account.balanceValue)).filter(Boolean));
    if (distinctStatuses.size > 1 || distinctBalances.size > 1) {
      const sourcePages = normalizePages(accounts.flatMap((account) => account.sourcePages));
      for (const account of accounts) {
        reasons.push(buildReason({
          id: `duplicate-tradeline:${account.entityKey}`,
          bureau: report.bureau,
          profileId: report.profileId,
          component: "accounts",
          entityType: "account",
          entityKey: account.entityKey,
          issueType: "duplicate_conflicting_tradeline",
          issueLabel: "Conflicting tradeline reporting",
          reasonSummary: `The tradeline for ${account.displayName} shares a masked account identifier with other tradelines that report conflicting balances or statuses.`,
          supportingFacts: [
            `Masked account number: ${maskedNumber}`,
            `Tradelines found: ${accounts.map((entry) => `${entry.displayName} (${entry.statusText || "status unavailable"}, ${entry.balanceValue || "balance unavailable"})`).join("; ")}`,
          ],
          supportingFields: ["accountNumber", "status", "balance"],
          sourcePages,
          requestedAction: "Please conduct a full reinvestigation, correct any inconsistent reporting, and delete any duplicate tradeline that cannot be verified as complete and accurate.",
          severity: "high",
        }));
      }
    }
  }
  return reasons;
};

const detectAccountReasons = (accountViews: ReasonAccountView[], report: CreditReport) => {
  const reasons: DisputeReason[] = [];

  for (const account of accountViews) {
    const sourcePages = account.sourcePages;
    const displayName = account.displayName;
    const entityKey = account.entityKey;
    const accountLabel = `${displayName} ${account.accountNumber}`.trim();
    const amountPastDue = parseMoneyValue(account.amountPastDueValue);
    const chargeOffAmount = parseMoneyValue(account.chargeOffAmountValue);
    const highestBalance = parseMoneyValue(account.highestBalanceValue);
    const creditLimit = parseMoneyValue(account.creditLimitValue);
    const observedBalanceMax = maxNumericFromValues([
      account.balanceValue,
      ...account.balanceHistoryValues,
    ]);
    const observedCreditLimitMax = maxNumericFromValues(account.creditLimitHistoryValues);
    const observedPastDueMax = maxNumericFromValues(account.amountPastDueHistoryValues);
    const collectionLike = isCollectionLikeAccount(account);
    const derogatoryStatus = isDerogatoryStatus(account.statusText) || collectionLike || (amountPastDue ?? 0) > 0 || (chargeOffAmount ?? 0) > 0;
    const paymentHistoryPresent = hasMeaningfulPaymentHistory(account.paymentHistory);
    const hasDerogatoryHistory = hasAnyDerogatoryHistory(account.paymentHistory);
    const hasCurrentHistory = hasAnyCurrentHistory(account.paymentHistory);
    const onlyCurrentOrBlank = hasOnlyCurrentOrBlankHistory(account.paymentHistory);
    const isEquifaxNew = report.profileId === "equifax_new_v1";
    const useExperianPhaseOneProvenance = isExperianProvenanceProfile(report);
    const chronologicalPaymentHistoryCells = sortHistoryCellsChronologically(account.paymentHistoryCells);
    const chronologicalPaymentHistoryGapCells = sortHistoryCellsChronologically(account.paymentHistoryGapCells);
    const provablePaymentGapMonths = new Set(
      chronologicalPaymentHistoryGapCells
        .filter((cell) => !useExperianPhaseOneProvenance || isProjectedMissingHistoryCell(cell))
        .map((cell) => toHistoryMonthKey(cell.year, cell.month)),
    );
    const recentCurrentHistoryCells = findRecentCurrentHistoryCells(chronologicalPaymentHistoryCells);
    // Operator ruling (Session 23): no month at or before the account's
    // opening month can ever be a "missing payment" — no payment could have
    // been reported yet. Applies to every missing-payment reason below.
    const parsedOpenedDateForHistory = parseDateLike(account.dateOpenedValue);
    const openedMonthSortValue = parsedOpenedDateForHistory
      ? historyMonthSortValue(historyMonthKeyFromDate(startOfUtcMonth(parsedOpenedDateForHistory)))
      : null;
    const missingPaymentHistoryMonths = findMissingHistoryMonths(chronologicalPaymentHistoryCells).filter(
      (monthKey) =>
        (!useExperianPhaseOneProvenance || provablePaymentGapMonths.has(monthKey)) &&
        (openedMonthSortValue === null || historyMonthSortValue(monthKey) > openedMonthSortValue),
    );
    const paymentHistoryLookup = toHistoryLookup(chronologicalPaymentHistoryCells);
    const balanceHistoryCells = account.balanceHistoryCells.length > 0 ? account.balanceHistoryCells : account.month24Sections?.balance ?? [];
    const paidAmountHistoryCells = account.paidAmountHistoryCells.length > 0 ? account.paidAmountHistoryCells : account.month24Sections?.paymentAmount ?? [];
    const scheduledPaymentHistoryCells = account.scheduledPaymentHistoryCells.length > 0 ? account.scheduledPaymentHistoryCells : account.month24Sections?.paymentAmount ?? [];
    const pastDueHistoryCells = account.amountPastDueHistoryCells.length > 0 ? account.amountPastDueHistoryCells : account.month24Sections?.pastDueAmount ?? [];
    const balanceHistoryLookup = toHistoryLookup(balanceHistoryCells);
    const paidAmountHistoryLookup = toHistoryLookup(paidAmountHistoryCells);
    const scheduledPaymentHistoryLookup = toHistoryLookup(scheduledPaymentHistoryCells);
    const month24PaymentAmountLookup = toHistoryLookup(account.month24Sections?.paymentAmount ?? []);
    const month24LastPaymentLookup = toHistoryLookup(account.month24Sections?.lastPaymentDate ?? []);
    const positivePastDueMonths = filterPositiveMoneyMonths(pastDueHistoryCells);
    const monthAwarePastDueConflicts = positivePastDueMonths.filter(({ key }) => {
      const paymentValue = paymentHistoryLookup.get(key);
      return isBlankHistoryValue(paymentValue) || isCurrentHistoryValue(paymentValue);
    });
    const month24ActivityConflictMonths = Array.from(
      new Set(
        [
          ...filterPositiveMoneyMonths(account.month24Sections?.balance ?? []).map(({ key }) => key),
          ...Array.from(month24PaymentAmountLookup.entries())
            .filter(([, value]) => !isMissing(value) && parseMoneyValue(value) !== 0)
            .map(([key]) => key),
          ...Array.from(month24LastPaymentLookup.entries())
            .filter(([, value]) => !isMissing(value) && !isBlankHistoryValue(value))
            .map(([key]) => key),
        ].filter((key) => {
          const paymentValue = paymentHistoryLookup.get(key);
          return isBlankHistoryValue(paymentValue);
        })
      )
    );
    const chargeOffLike = normalizeMatchText(account.statusText).includes("charge off") || (chargeOffAmount ?? 0) > 0;
    const hasChargeOffCode = hasHistoryCode(account.paymentHistory, "co");
    const provableBalanceGapMonths = new Set(findInternalHistoryGapMonths(balanceHistoryCells));
    const monthlyBalanceGapMonths = account.paymentHistoryCells
      .filter((cell) => !isBlankHistoryValue(cell.value))
      .map((cell) => toHistoryMonthKey(cell.year, cell.month))
      .filter((key) => provableBalanceGapMonths.has(key));
    const lastPaymentDateMissing = isMissing(account.lastPaymentDateValue);
    const recentPaymentFieldMissing = isMissing(account.recentPaymentValue);
    const paymentAmountMissing = isMissing(account.paymentAmountValue);
    const installmentLike = isInstallmentLikeAccount(account) && !isRevolvingLikeAccount(account);
    const progressionConflicts = findDelinquencyProgressionConflicts(chronologicalPaymentHistoryCells);
    const thirtyDayLateTimingAnalysis = analyzeThirtyDayLateIntervals(account, paidAmountHistoryLookup, balanceHistoryLookup);
    const thirtyDayLateIntervalConflicts = thirtyDayLateTimingAnalysis.conflicts;
    const severeJumpConflicts = findSevereJumpWithoutPredecessorSupport(chronologicalPaymentHistoryCells);
    const reagingJumpConflicts = findReagingJumpAfterCurrentReset(chronologicalPaymentHistoryCells);
    const firstThirtyWithoutPriorSupport = findFirstThirtyDayLateWithoutPriorSupport(chronologicalPaymentHistoryCells, account.dateOpenedValue);
    const firstDerogatoryWithoutPriorSupport = findFirstDerogatoryMonthWithoutPriorSupport(chronologicalPaymentHistoryCells, account.dateOpenedValue);
    const blankGapBeforeDerogatoryConflicts = findBlankGapBeforeDerogatoryMonth(chronologicalPaymentHistoryCells);
    const retroactiveBackfillConflicts = findRetroactiveDerogatoryBackfillAfterGap(chronologicalPaymentHistoryCells);
    const provableRetroactiveBackfillConflicts = retroactiveBackfillConflicts.filter(
      (conflict) =>
        !useExperianPhaseOneProvenance ||
        (conflict.gapMonths ?? []).length > 0 &&
          (conflict.gapMonths ?? []).every((monthKey) => provablePaymentGapMonths.has(monthKey)),
    );
    const chargeOffOrCollectionWithoutBuildUpConflicts = findChargeOffOrCollectionWithoutMonthlyBuildUp(chronologicalPaymentHistoryCells);
    const chronologyConflictsForActivity = [
      ...severeJumpConflicts,
      ...reagingJumpConflicts,
      ...(firstThirtyWithoutPriorSupport ? [firstThirtyWithoutPriorSupport] : []),
      ...(firstDerogatoryWithoutPriorSupport ? [firstDerogatoryWithoutPriorSupport] : []),
      ...blankGapBeforeDerogatoryConflicts,
      ...provableRetroactiveBackfillConflicts,
      ...chargeOffOrCollectionWithoutBuildUpConflicts,
    ];
    const paymentActivityConflicts = findPaymentActivityConflicts(
      chronologyConflictsForActivity,
      paidAmountHistoryCells,
      scheduledPaymentHistoryCells,
      month24LastPaymentLookup,
      account.lastPaymentDateValue,
      account.recentPaymentValue,
    );
    const balanceReductionConflicts = findBalanceReductionConflicts(chronologyConflictsForActivity, balanceHistoryLookup);
    const paymentPlanContext = hasAccountPaymentPlanContext(account);
    const paymentPlanConflictMonths = collectSequenceConflictMonths(chronologyConflictsForActivity);
    const latestPaymentCell = latestMeaningfulHistoryCell(chronologicalPaymentHistoryCells);
    const latestBalanceCell = latestMeaningfulHistoryCell(balanceHistoryCells);
    const timelineAnchorValue = firstNonEmptyText(
      String(report.reportDate ?? ""),
      account.dateReportedValue,
      account.statusUpdatedValue,
      latestPaymentCell ? formatHistoryCellMonth(latestPaymentCell) : "",
    );
    // Operator ruling (Session 23): an account is too new to owe ANY payment
    // history until its first possible payment month (opening month + 1) has
    // fully elapsed and could appear on the report — i.e. the report anchor
    // sits at least 2 months past the opening month. Younger accounts have
    // naturally blank history; disputing that is logically impossible and
    // legally weak.
    const parsedTimelineAnchorDate = parseDateLike(timelineAnchorValue);
    const accountTooNewForPaymentHistory = Boolean(
      parsedOpenedDateForHistory &&
        parsedTimelineAnchorDate &&
        monthsBetweenDates(
          startOfUtcMonth(parsedOpenedDateForHistory),
          startOfUtcMonth(parsedTimelineAnchorDate),
        ) < 2,
    );
    const paymentHistoryLookbackMonths = resolvePaymentHistoryLookbackMonths(account);
    const paymentHistoryGapSinceOpenedDate = findPaymentHistoryGapSinceOpenedDate(
      chronologicalPaymentHistoryCells,
      account.dateOpenedValue,
      timelineAnchorValue,
      paymentHistoryLookbackMonths,
    );
    const closureMonthLabel = account.closureMonthKey ? formatHistoryMonth(account.closureMonthKey) : "Not reported";
    const parsedStatusUpdatedDate = parseDateLike(account.statusUpdatedValue);
    const parsedBalanceUpdatedDate = parseDateLike(account.balanceUpdatedValue);
    const parsedLastPaymentDate = parseDateLike(account.lastPaymentDateValue);
    const parsedDateClosed = parseDateLike(account.dateClosedValue);
    const parsedEstimatedRemovalDate = parseDateLike(account.estimatedRemovalValue);
    const parsedDateOfFirstDelinquency = parseDateLike(account.dateOfFirstDelinquencyValue);
    const dateOfFirstDelinquencyYear = (account.dateOfFirstDelinquencyValue.match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? "";
    const usableOriginalCreditorIdentity = hasUsableOriginalCreditorIdentity(account);
    const firstDerogatoryMonth = [...chronologicalPaymentHistoryCells]
      .filter((cell) => isDerogatoryHistoryValue(cell.value))
      .sort((left, right) => {
        const yearCompare = Number.parseInt(left.year || "0", 10) - Number.parseInt(right.year || "0", 10);
        if (yearCompare !== 0) {
          return yearCompare;
        }
        return MONTH_KEYS.indexOf(left.month) - MONTH_KEYS.indexOf(right.month);
      })[0];
    const balancePaymentConflictMonths = installmentLike
      ? paidAmountHistoryCells
          .map((cell) => {
            const paidAmount = parseMoneyValue(cell.value);
            const balanceValue = parseMoneyValue(balanceHistoryLookup.get(toHistoryMonthKey(cell.year, cell.month)));
            const nextMonthSort = historyMonthSortValue(toHistoryMonthKey(cell.year, cell.month)) + 1;
            const nextBalanceCell = balanceHistoryCells.find(
              (entry) => historyMonthSortValue(toHistoryMonthKey(entry.year, entry.month)) == nextMonthSort,
            );
            const nextBalanceValue = parseMoneyValue(nextBalanceCell?.value);
            if ((paidAmount ?? 0) <= 0 || balanceValue === null || nextBalanceValue === null) {
              return null;
            }
            const balanceDrop = balanceValue - nextBalanceValue;
            if (balanceDrop >= Math.max(25, paidAmount * 0.25)) {
              return null;
            }
            return {
              month: toHistoryMonthKey(cell.year, cell.month),
              paidAmount,
              balanceValue,
              nextBalanceValue,
            };
          })
          .filter((entry): entry is { month: HistoryMonthKey; paidAmount: number; balanceValue: number; nextBalanceValue: number } => Boolean(entry))
      : [];

    if (isIncompleteAccountIdentifier(account.accountNumber)) {
      reasons.push(buildReason({
        id: `missing-account-number:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "missing_account_number",
        issueLabel: "Incomplete account identifier",
        reasonSummary: `The tradeline for ${displayName} does not disclose a complete enough account identifier to verify that it is being reported accurately and completely.`,
        supportingFacts: [`Account number field is missing or reported as not available for ${displayName}.`],
        supportingFields: ["accountNumber"],
        sourcePages,
        requestedAction: "Please provide a complete and verifiable account identifier or delete the tradeline if it cannot be reported accurately and completely.",
        severity: "high",
      }));
    }

    if (isMissing(account.addressText) && isMissing(account.phoneText)) {
      reasons.push(buildReason({
        id: `missing-furnisher-identification:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "missing_furnisher_identification",
        issueLabel: "Incomplete furnisher identification",
        reasonSummary: `The tradeline for ${displayName} is missing both address and telephone information, which makes the furnisher information incomplete.`,
        supportingFacts: ["Address and phone number are both missing from the reported tradeline details."],
        supportingFields: ["address", "phoneNumber"],
        sourcePages,
        requestedAction: "Please report the furnisher identifying information completely or delete the tradeline if it cannot be verified as complete and accurate.",
        severity: "medium",
      }));
    }

    if (isMissing(account.statusText) && (collectionLike || (amountPastDue ?? 0) > 0 || (chargeOffAmount ?? 0) > 0 || hasDerogatoryHistory)) {
      reasons.push(buildReason({
        id: `missing-account-status:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "missing_account_status",
        issueLabel: "Account status is incomplete",
        reasonSummary: `The tradeline for ${displayName} reflects derogatory or collection-related activity, but the current account status field is missing or incomplete.`,
        supportingFacts: [
          `Reported amount past due: ${account.amountPastDueValue || "Not reported"}`,
          `Reported charge-off amount: ${account.chargeOffAmountValue || "Not reported"}`,
          `Monthly history includes derogatory activity: ${hasDerogatoryHistory ? "Yes" : "No"}`,
        ],
        supportingFields: ["status", "paymentHistory", "amountPastDue", "chargeOffAmount", "comments"],
        sourcePages,
        requestedAction: "Please provide the complete and accurate current account status for this tradeline or delete/correct any reporting that cannot be verified as complete.",
        severity: "medium",
      }));
    }

    if (collectionLike && !usableOriginalCreditorIdentity) {
      reasons.push(buildReason({
        id: `missing-original-creditor:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "incomplete_original_creditor_identity",
        issueLabel: "Original creditor identity is incomplete",
        reasonSummary: `The tradeline for ${displayName} appears to be reported as a collection-style account, but the original creditor identity is missing or incomplete.`,
        supportingFacts: [
          `Reported furnisher name: ${displayName || "Not reported"}`,
          `Reported status: ${account.statusText || "Not reported"}`,
          `Original creditor field: ${account.originalCreditorText || "Not reported"}`,
        ],
        supportingFields: ["status", "originalCreditorName", "comments"],
        sourcePages,
        requestedAction: "Please identify the original creditor completely for this tradeline or delete/correct the reporting if the tradeline cannot be verified as complete and accurate.",
        severity: "medium",
      }));
    }

    if (isStudentLoanLikeAccount(account) && !usableOriginalCreditorIdentity) {
      reasons.push(buildReason({
        id: `student-loan-lender-identity:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "student_loan_lender_identity_mismatch",
        issueLabel: "Student-loan lender identity is incomplete",
        reasonSummary: `The tradeline for ${displayName} appears to be a student-loan account, but the report does not clearly identify the lender or funding institution.`,
        supportingFacts: [
          `Reported furnisher name: ${displayName || "Not reported"}`,
          `Account type context: ${account.accountTypeText || "Not reported"}`,
          `Original creditor field: ${account.originalCreditorText || "Not reported"}`,
        ],
        supportingFields: ["accountType", "originalCreditorName", "status"],
        sourcePages,
        requestedAction: "Please identify the lender or funding institution completely for this student-loan tradeline or delete/correct any reporting that cannot be verified as complete and accurate.",
        severity: "medium",
      }));
    }

    if (
      hasToken(account.responsibilityText, ["joint", "authorized user", "authorized", "co-borrower", "co signer", "cosigner"])
    ) {
      reasons.push(buildReason({
        id: `responsibility-special-handling:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "responsibility_requires_special_handling",
        issueLabel: "Responsibility designation requires review",
        reasonSummary: `The tradeline for ${displayName} is reported with a special responsibility designation that requires closer legal review before this account is disputed in the same manner as an individually liable tradeline.`,
        supportingFacts: [`Reported responsibility: ${account.responsibilityText || "Not reported"}`],
        supportingFields: ["responsibility", "accountOwnership", "paymentResponsibility"],
        sourcePages,
        requestedAction: "Please verify that the responsibility designation on this tradeline is complete and accurate and correct or delete any responsibility information that cannot be verified.",
        severity: "low",
      }));
    }

    if (hasAccountLitigationContext(account)) {
      reasons.push(buildReason({
        id: `account-in-litigation:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "account_in_litigation",
        issueLabel: "Account is reported in litigation",
        reasonSummary: `The tradeline for ${displayName} explicitly references litigation, which requires a separate dispute and legal-review path.`,
        supportingFacts: [
          `Reported status: ${account.statusText || "Not reported"}`,
          `Comments / remarks: ${account.comments.join("; ") || "Not reported"}`,
          `Additional information: ${account.additionalInformationLines.join("; ") || "Not reported"}`,
          `Consumer statement: ${account.consumerStatementLines.join("; ") || "Not reported"}`,
          `Reinvestigation info: ${account.reinvestigationInfoLines.join("; ") || "Not reported"}`,
        ],
        supportingFields: ["status", "comments", "additionalInformation", "consumerStatement", "reinvestigationInfo", "legalCategory"],
        sourcePages,
        requestedAction: "Please verify whether this account is being reported in litigation accurately, completely, and with all required supporting details, or delete/correct the reporting if it cannot be verified.",
        severity: "high",
        category: "legal_public_record",
        defaultSelected: true,
        selectionBasis: "explicit",
        evidence: buildObservedValueEvidence([
          { label: "Reported status", value: account.statusText },
          { label: "Comments / remarks", value: account.comments.join("; ") },
          { label: "Additional information", value: account.additionalInformationLines.join("; ") },
          { label: "Consumer statement", value: account.consumerStatementLines.join("; ") },
          { label: "Reinvestigation info", value: account.reinvestigationInfoLines.join("; ") },
          { label: "Legal category", value: account.legalCategoryText },
        ]),
      }));
    }

    if (derogatoryStatus && isReportedCurrentBalanceFieldMissing(account)) {
      reasons.push(buildReason({
        id: `missing-current-balance-field:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "missing_current_balance_field",
        issueLabel: "Current balance field is missing",
        reasonSummary: `The tradeline for ${displayName} reports derogatory or collection-related activity, but the current balance field is absent entirely, which makes the reported negative information materially incomplete and harder to verify.`,
        supportingFacts: [
          `Current balance field: Missing`,
          `Reported status: ${account.statusText || "Not reported"}`,
          `Reported amount past due: ${account.amountPastDueValue || "Not reported"}`,
          `Reported charge-off amount: ${account.chargeOffAmountValue || "Not reported"}`,
        ],
        supportingFields: ["balance", "status", "amountPastDue", "chargeOffAmount"],
        sourcePages,
        requestedAction: "Please report the current balance field completely for this derogatory tradeline or correct/delete any negative reporting that cannot be verified as complete and accurate.",
        severity: "high",
        evidence: {
          comparedFields: ["balance", "status", "amountPastDue", "chargeOffAmount"],
          scalarComparisons: [
            { label: "Current balance field", value: "Missing" },
            { label: "Status", value: account.statusText || "Not reported" },
            { label: "Amount past due", value: account.amountPastDueValue || "Not reported" },
            { label: "Charge-off amount", value: account.chargeOffAmountValue || "Not reported" },
          ],
        },
      }));
    }

    if ((isNegativeByFields(account) || hasReportedCurrentBalance(account)) && isMissing(account.dateReportedValue)) {
      reasons.push(buildReason({
        id: `missing-reporting-date:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "missing_reporting_date",
        issueLabel: "Reporting date is incomplete",
        reasonSummary: `The tradeline for ${displayName} reports balance or derogatory information, but the report does not disclose a usable reported date for that tradeline.`,
        supportingFacts: [
          `Reported current balance field: ${describeReportedCurrentBalance(account)}`,
          `Reported status: ${account.statusText || "Not reported"}`,
          `Reported date field: ${account.dateReportedValue || "Not reported"}`,
        ],
        supportingFields: ["dateReported", "balance", "status"],
        sourcePages,
        requestedAction: "Please provide the complete reported date for this tradeline or correct/delete any reporting that cannot be verified as complete and timely.",
        severity: "medium",
      }));
    }

    if (isNegativeByFields(account) && isMissing(account.statusUpdatedValue)) {
      reasons.push(buildReason({
        id: `missing-status-updated-date:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "missing_status_updated_date",
        issueLabel: "Status-updated date is incomplete",
        reasonSummary: `The tradeline for ${displayName} reflects derogatory or collection-related reporting, but the report does not disclose the date tied to that reported status.`,
        supportingFacts: [
          `Reported status: ${account.statusText || "Not reported"}`,
          `Status-updated date: ${account.statusUpdatedValue || "Not reported"}`,
        ],
        supportingFields: ["status", "statusUpdated", "dateReported"],
        sourcePages,
        requestedAction: "Please provide the complete status-updated date for this tradeline or correct/delete any incomplete status reporting.",
        severity: "medium",
      }));
    }

    if (hasReportedCurrentBalance(account) && isMissing(account.balanceUpdatedValue)) {
      reasons.push(buildReason({
        id: `missing-balance-updated-date:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "missing_balance_updated_date",
        issueLabel: "Balance-updated date is incomplete",
        reasonSummary: `The tradeline for ${displayName} reports a balance, but the report does not disclose the date associated with that balance.`,
        supportingFacts: [
          `Reported current balance field: ${describeReportedCurrentBalance(account)}`,
          `Balance-updated date: ${account.balanceUpdatedValue || "Not reported"}`,
        ],
        supportingFields: ["balance", "balanceUpdated", "dateReported"],
        sourcePages,
        requestedAction: "Please provide the complete balance-updated date for this tradeline or correct/delete any incomplete balance reporting.",
        severity: "medium",
      }));
    }

    if (account.isClosed && isMissing(account.closureTimingValue)) {
      reasons.push(buildReason({
        id: `closed-account-missing-closure-timing:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "closed_account_missing_closure_timing",
        issueLabel: "Closed account lacks closure timing",
        reasonSummary: `The tradeline for ${displayName} is reported as closed, but the report does not provide a usable closure date or equivalent closure timing field for that tradeline.`,
        supportingFacts: [
          `Reported closed date: ${account.dateClosedValue || "Not reported"}`,
          `Reported status-updated date: ${account.statusUpdatedValue || "Not reported"}`,
          `Reported balance-updated date: ${account.balanceUpdatedValue || "Not reported"}`,
          `Reported status: ${account.statusText || "Not reported"}`,
        ],
        supportingFields: ["dateClosed", "statusUpdated", "balanceUpdated", "status"],
        sourcePages,
        requestedAction: "Please provide the closure timing for this closed tradeline or correct/delete any closed-account reporting that cannot be verified as complete and accurate.",
        severity: "medium",
        evidence: {
          comparedFields: ["dateClosed", "statusUpdated", "balanceUpdated", "status"],
          scalarComparisons: [
            { label: "Reported closed date", value: account.dateClosedValue || "Not reported" },
            { label: "Reported status-updated date", value: account.statusUpdatedValue || "Not reported" },
            { label: "Reported balance-updated date", value: account.balanceUpdatedValue || "Not reported" },
            { label: "Reported status", value: account.statusText || "Not reported" },
          ],
        },
      }));
    }

    if (!paymentHistoryPresent && !collectionLike && !account.isClosed && !accountTooNewForPaymentHistory) {
      reasons.push(buildReason({
        id: `missing-payment-history:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "missing_payment_history",
        issueLabel: "Payment history is missing",
        reasonSummary: `The tradeline for ${displayName} does not provide a meaningful payment history even though the account is being reported as an active tradeline.`,
        supportingFacts: [
          `Reported status: ${account.statusText || "Not reported"}`,
          `Reported payment amount: ${account.paymentAmountValue || "Not reported"}`,
        ],
        supportingFields: ["status", "paymentHistory", "paymentAmount"],
        sourcePages,
        requestedAction: "Please provide the complete month-by-month payment history for this tradeline or delete/correct any reporting that cannot be verified as complete and accurate.",
        severity: "high",
        evidence: {
          comparedFields: ["status", "paymentHistory", "paymentAmount"],
          scalarComparisons: [
            { label: "Reported status", value: account.statusText || "Not reported" },
            { label: "Reported payment amount", value: account.paymentAmountValue || "Not reported" },
          ],
        },
      }));
    }

    if (paymentHistoryPresent && missingPaymentHistoryMonths.length > 0) {
      for (const group of groupConsecutiveHistoryMonths(missingPaymentHistoryMonths).slice(0, 4)) {
        const rangeKey = `${group[0]}:${group[group.length - 1]}`;
        reasons.push(buildReason({
          id: `payment-history-missing-months:${entityKey}:${rangeKey}`,
          bureau: report.bureau,
          profileId: report.profileId,
          component: "accounts",
          entityType: "account",
          entityKey,
          issueType: "payment_history_missing_months",
          issueLabel: "Payment history has missing months",
          reasonSummary: `The tradeline for ${displayName} contains a blank gap in payment history during ${describeHistoryMonthGroup(group)}, which makes the reported timeline incomplete.`,
          supportingFacts: group.map((month) => `${formatHistoryMonth(month)} is blank inside the active payment-history range.`),
          supportingFields: ["paymentHistory"],
          sourcePages,
          requestedAction: "Please provide the complete payment-history timeline for the missing months or delete/correct any incomplete monthly reporting.",
          severity: "medium",
        evidence: {
          comparedFields: ["paymentHistory"],
          monthlyComparisons: group.map((month) => ({
            month: formatHistoryMonth(month),
            leftLabel: "Payment history",
            leftValue: "blank",
            rightLabel: "Expected timeline",
            rightValue: "month missing inside active reporting span",
          })),
        },
        evidenceRefs: useExperianPhaseOneProvenance
          ? buildExperianPaymentGapEvidenceRefs(
              entityKey,
              [group],
              chronologicalPaymentHistoryCells,
              chronologicalPaymentHistoryGapCells,
            )
          : [],
      }));
    }
  }

    if (paymentHistoryGapSinceOpenedDate) {
      const group = paymentHistoryGapSinceOpenedDate.gapMonths;
      const rangeKey = `${group[0]}:${group[group.length - 1]}`;
      reasons.push(buildReason({
        id: `payment-history-open-date-gap:${entityKey}:${rangeKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "payment_history_incomplete_since_open_date",
        issueLabel: "Payment history from date opened is incomplete",
        reasonSummary: `The tradeline for ${displayName} does not provide payment history starting from the expected opened-date period. The account appears opened on ${account.dateOpenedValue || "Not reported"}, and the expected lookback is ${paymentHistoryGapSinceOpenedDate.expectedLookbackMonths} months, but the first reported payment-history month is ${formatHistoryMonth(paymentHistoryGapSinceOpenedDate.firstReportedMonth)}.`,
        supportingFacts: [
          `Date opened: ${account.dateOpenedValue || "Not reported"}`,
          `Expected payment-history lookback: ${paymentHistoryGapSinceOpenedDate.expectedLookbackMonths} months`,
          `Months reviewed field: ${account.monthsReviewedValue || "Not reported"}`,
          `Expected payment-history start: ${formatHistoryMonth(paymentHistoryGapSinceOpenedDate.expectedStart)}`,
          `First reported payment-history month: ${formatHistoryMonth(paymentHistoryGapSinceOpenedDate.firstReportedMonth)}`,
          `Missing opened-date coverage: ${describeHistoryMonthGroup(group)}`,
        ],
        supportingFields: ["dateOpened", "paymentHistory"],
        sourcePages,
        requestedAction: "Please provide the complete payment-history timeline from the expected opened-date period forward or delete/correct any incomplete monthly reporting that cannot be verified.",
        severity: "medium",
        evidence: {
          comparedFields: ["dateOpened", "paymentHistory"],
          monthlyComparisons: group.slice(0, 12).map((month) => ({
            month: formatHistoryMonth(month),
            leftLabel: "Payment history",
            leftValue: "blank or not shown",
            rightLabel: "Expected timeline",
            rightValue: "month should be covered from opened-date period",
          })),
          scalarComparisons: [
            { label: "Date opened", value: account.dateOpenedValue || "Not reported" },
            { label: "Expected payment-history lookback", value: String(paymentHistoryGapSinceOpenedDate.expectedLookbackMonths) },
            { label: "Months reviewed field", value: account.monthsReviewedValue || "Not reported" },
            { label: "Expected payment-history start", value: formatHistoryMonth(paymentHistoryGapSinceOpenedDate.expectedStart) },
            { label: "First reported payment-history month", value: formatHistoryMonth(paymentHistoryGapSinceOpenedDate.firstReportedMonth) },
          ],
        },
      }));
    }

    if (progressionConflicts.length > 0) {
      const monthlyComparisons = progressionConflicts.slice(0, 6).map(({ from, to }) => ({
        month: formatHistoryMonth(toHistoryMonthKey(to.year, to.month)),
        leftLabel: `Earlier month ${formatHistoryMonth(toHistoryMonthKey(from.year, from.month))}`,
        leftValue: from.value,
        rightLabel: "Later month",
        rightValue: to.value,
      }));
      reasons.push(buildReason({
        id: `delinquency-progression:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "delinquency_progression_inconsistency",
        issueLabel: "Delinquency progression is inconsistent",
        reasonSummary: `The tradeline for ${displayName} shows a delinquency progression that drops to a less severe status, such as 30 -> 60 -> 30, without any current-payment reset, which makes the monthly reporting internally inconsistent.`,
        supportingFacts: progressionConflicts.slice(0, 6).map(({ from, to }) => `${formatHistoryMonth(toHistoryMonthKey(from.year, from.month))} reports ${from.value}, but ${formatHistoryMonth(toHistoryMonthKey(to.year, to.month))} later drops to ${to.value} without an intervening current month. This kind of downward regression should reset through OK/current before returning to a lower delinquency level.`),
        supportingFields: ["paymentHistory"],
        sourcePages,
        requestedAction: "Please reinvestigate the month-by-month delinquency sequence and correct or delete any monthly status reporting that is not internally consistent.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory"],
          monthlyComparisons,
        },
        evidenceRefs: useExperianPhaseOneProvenance
          ? buildExperianProgressionEvidenceRefs(entityKey, progressionConflicts, chronologicalPaymentHistoryCells)
          : [],
      }));
    }

    if (thirtyDayLateIntervalConflicts.length > 0) {
      reasons.push(buildReason({
        id: `thirty-day-late-without-full-interval:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "thirty_day_late_without_full_30_day_interval",
        issueLabel: "30-day late does not reflect a full 30-day interval",
        reasonSummary: `The tradeline for ${displayName} reports a 30-day late month even though the strongest available day-level timing evidence shows less than a full 30-day interval between the relevant payment events.`,
        supportingFacts: thirtyDayLateIntervalConflicts.slice(0, 6).map((conflict) => {
          const corroboration = [
            conflict.corroboratingPaidAmountValue ? `paid amount ${conflict.corroboratingPaidAmountValue}` : "",
            conflict.previousBalanceValue && conflict.currentBalanceValue
              ? `balance moved from ${conflict.previousBalanceValue} to ${conflict.currentBalanceValue}`
              : "",
          ]
            .filter(Boolean)
            .join(", ");
          return `${formatHistoryCellMonth(conflict.current)} reports 30 days late, but ${conflict.previousSignal.label} ${conflict.previousSignal.dateText} to ${conflict.currentSignal.label} ${conflict.currentSignal.dateText} spans only ${conflict.intervalDays} days${corroboration ? `, with ${corroboration}` : ""}.`;
        }),
        supportingFields: ["paymentHistory", "lastPaymentDate", "actualPaymentHistory", "recentPayment", "balanceHistory", "dateReported", "statusUpdated", "balanceUpdated"],
        sourcePages,
        requestedAction: "Please reinvestigate the 30-day-late reporting on this tradeline and correct or delete any month that is not supported by a full 30-day interval.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory", "lastPaymentDate", "actualPaymentHistory", "recentPayment", "balanceHistory", "dateReported", "statusUpdated", "balanceUpdated"],
          monthlyComparisons: thirtyDayLateIntervalConflicts.slice(0, 6).map((conflict) => ({
            month: formatHistoryCellMonth(conflict.current),
            leftLabel: conflict.previousSignal.label,
            leftValue: `${conflict.previousSignal.dateText}${conflict.corroboratingPaidAmountValue ? ` | paid ${conflict.corroboratingPaidAmountValue}` : ""}`,
            rightLabel: conflict.currentSignal.label,
            rightValue: `${conflict.currentSignal.dateText} (${conflict.intervalDays} days)${conflict.previousBalanceValue && conflict.currentBalanceValue ? ` | balance ${conflict.previousBalanceValue} -> ${conflict.currentBalanceValue}` : ""}`,
          })),
        },
      }));
    }

    if (severeJumpConflicts.length > 0) {
      reasons.push(buildReason({
        id: `severe-delinquency-jump:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "severe_delinquency_jump_without_predecessor_support",
        issueLabel: "Severe delinquency jump lacks predecessor support",
        reasonSummary: `The tradeline for ${displayName} jumps into a deeper delinquency level without the expected predecessor month, which makes the payment-history sequence internally inconsistent.`,
        supportingFacts: severeJumpConflicts.slice(0, 6).map(({ current, previous }) => `${formatHistoryCellMonth(current)} reports ${current.value}, but the nearest earlier reported month ${previous ? formatHistoryCellMonth(previous) : "Not reported"} shows ${previous?.value || "no earlier reported month"} instead of the expected predecessor delinquency step.`),
        supportingFields: ["paymentHistory"],
        sourcePages,
        requestedAction: "Please reinvestigate the month-by-month delinquency sequence and correct or delete any severe delinquency reporting that is not supported by the tradeline timeline.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory"],
          monthlyComparisons: severeJumpConflicts.slice(0, 6).map(({ current, previous }) => ({
            month: formatHistoryCellMonth(current),
            leftLabel: previous ? `Earlier month ${formatHistoryCellMonth(previous)}` : "Earlier month",
            leftValue: previous?.value || "No earlier reported month",
            rightLabel: "Later month",
            rightValue: current.value,
          })),
        },
        evidenceRefs: useExperianPhaseOneProvenance
          ? buildExperianSevereJumpEvidenceRefs(
              entityKey,
              severeJumpConflicts,
              chronologicalPaymentHistoryCells,
              chronologicalPaymentHistoryGapCells,
            )
          : [],
      }));
    }

    if (reagingJumpConflicts.length > 0) {
      reasons.push(buildReason({
        id: `reaging-jump-after-current:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "reaging_jump_after_current_reset",
        issueLabel: "Delinquency jumps after a current reset",
        reasonSummary: `The tradeline for ${displayName} resets to current and then jumps back to a severe delinquency instead of restarting at 30 days late, which makes the payment-history sequence illogical.`,
        supportingFacts: reagingJumpConflicts.slice(0, 6).map(({ current, previous }) => `${formatHistoryCellMonth(previous ?? current)} reports a current/on-time month, but ${formatHistoryCellMonth(current)} later jumps to ${current.value} instead of restarting at 30 days late.`),
        supportingFields: ["paymentHistory"],
        sourcePages,
        requestedAction: "Please reinvestigate the re-aging sequence on this tradeline and correct or delete any delinquency progression that is not internally consistent.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory"],
          monthlyComparisons: reagingJumpConflicts.slice(0, 6).map(({ current, previous }) => ({
            month: formatHistoryCellMonth(current),
            leftLabel: previous ? `Current reset month ${formatHistoryCellMonth(previous)}` : "Current reset month",
            leftValue: previous?.value || "Current / on time",
            rightLabel: "Later delinquency month",
            rightValue: current.value,
          })),
        },
        evidenceRefs: useExperianPhaseOneProvenance
          ? buildExperianReagingEvidenceRefs(
              entityKey,
              reagingJumpConflicts,
              chronologicalPaymentHistoryCells,
              chronologicalPaymentHistoryGapCells,
            )
          : [],
      }));
    }

    if (firstThirtyWithoutPriorSupport) {
      const gapDescription =
        firstThirtyWithoutPriorSupport.gapMonths && firstThirtyWithoutPriorSupport.gapMonths.length > 0
          ? describeHistoryMonthGroup(firstThirtyWithoutPriorSupport.gapMonths)
          : "no earlier payment-history months";
      reasons.push(buildReason({
        id: `first-30-without-prior-support:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "first_30_day_late_without_prior_reporting_support",
        issueLabel: "First 30-day late lacks prior reporting support",
        reasonSummary: `The first reported 30-day late for ${displayName} appears without earlier monthly reporting support even though the account appears to have been opened earlier.`,
        supportingFacts: [
          `Date opened: ${account.dateOpenedValue || "Not reported"}`,
          `${formatHistoryCellMonth(firstThirtyWithoutPriorSupport.current)} reports 30 days late, but the earlier timeline shows ${gapDescription}.`,
        ],
        supportingFields: ["paymentHistory", "dateOpened"],
        sourcePages,
        requestedAction: "Please provide the complete monthly history leading into the first reported 30-day late or delete/correct any late-payment reporting that cannot be verified.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory", "dateOpened"],
          monthlyComparisons: [
            {
              month: formatHistoryCellMonth(firstThirtyWithoutPriorSupport.current),
              leftLabel: "Earlier payment-history span",
              leftValue: gapDescription,
              rightLabel: "First reported late month",
              rightValue: firstThirtyWithoutPriorSupport.current.value,
            },
          ],
          scalarComparisons: [{ label: "Date opened", value: account.dateOpenedValue || "Not reported" }],
        },
      }));
    }

    if (firstDerogatoryWithoutPriorSupport) {
      const gapDescription =
        firstDerogatoryWithoutPriorSupport.gapMonths && firstDerogatoryWithoutPriorSupport.gapMonths.length > 0
          ? describeHistoryMonthGroup(firstDerogatoryWithoutPriorSupport.gapMonths)
          : "no earlier payment-history months";
      reasons.push(buildReason({
        id: `first-derogatory-without-prior-support:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "first_derogatory_month_without_prior_reporting_support",
        issueLabel: "First derogatory month lacks prior reporting support",
        reasonSummary: `The first severe derogatory month reported for ${displayName} appears without earlier monthly support even though the account appears to have been opened earlier.`,
        supportingFacts: [
          `Date opened: ${account.dateOpenedValue || "Not reported"}`,
          `${formatHistoryCellMonth(firstDerogatoryWithoutPriorSupport.current)} reports ${firstDerogatoryWithoutPriorSupport.current.value}, but the earlier timeline shows ${gapDescription}.`,
        ],
        supportingFields: ["paymentHistory", "dateOpened"],
        sourcePages,
        requestedAction: "Please provide the complete payment-history buildup supporting the first reported derogatory month or delete/correct any unsupported monthly reporting.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory", "dateOpened"],
          monthlyComparisons: [
            {
              month: formatHistoryCellMonth(firstDerogatoryWithoutPriorSupport.current),
              leftLabel: "Earlier payment-history span",
              leftValue: gapDescription,
              rightLabel: "First reported derogatory month",
              rightValue: firstDerogatoryWithoutPriorSupport.current.value,
            },
          ],
          scalarComparisons: [{ label: "Date opened", value: account.dateOpenedValue || "Not reported" }],
        },
      }));
    }

    if (blankGapBeforeDerogatoryConflicts.length > 0) {
      reasons.push(buildReason({
        id: `blank-gap-before-derogatory:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "blank_gap_before_derogatory_month",
        issueLabel: "Blank gap appears before a derogatory month",
        reasonSummary: `The tradeline for ${displayName} contains blank payment-history months immediately before reported derogatory months, which makes the delinquency timeline incomplete.`,
        supportingFacts: blankGapBeforeDerogatoryConflicts.slice(0, 6).map(({ current, gapMonths }) => `${describeHistoryMonthGroup(gapMonths ?? [])} is blank immediately before ${formatHistoryCellMonth(current)}, which reports ${current.value}.`),
        supportingFields: ["paymentHistory"],
        sourcePages,
        requestedAction: "Please provide the missing monthly history leading into the reported derogatory month or delete/correct any delinquency reporting that cannot be fully verified.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory"],
          monthlyComparisons: blankGapBeforeDerogatoryConflicts.slice(0, 6).map(({ current, gapMonths }) => ({
            month: formatHistoryCellMonth(current),
            leftLabel: "Earlier blank gap",
            leftValue: describeHistoryMonthGroup(gapMonths ?? []),
            rightLabel: "Derogatory month",
            rightValue: current.value,
          })),
        },
      }));
    }

    if (provableRetroactiveBackfillConflicts.length > 0) {
      reasons.push(buildReason({
        id: `retroactive-derogatory-backfill:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "retroactive_derogatory_backfill_after_reporting_gap",
        issueLabel: "Derogatory reporting appears after a long gap",
        reasonSummary: `The tradeline for ${displayName} shows severe derogatory reporting after a long blank reporting gap, which makes the timeline appear retroactively backfilled.`,
        supportingFacts: provableRetroactiveBackfillConflicts.slice(0, 6).map(({ current, gapMonths }) => `${describeHistoryMonthGroup(gapMonths ?? [])} is blank before ${formatHistoryCellMonth(current)}, which later reports ${current.value}.`),
        supportingFields: ["paymentHistory"],
        sourcePages,
        requestedAction: "Please reinvestigate the blank reporting gap and the later derogatory reporting, and correct or delete any monthly history that cannot be verified as complete and accurate.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory"],
          monthlyComparisons: provableRetroactiveBackfillConflicts.slice(0, 6).map(({ current, gapMonths }) => ({
            month: formatHistoryCellMonth(current),
            leftLabel: "Long blank gap",
            leftValue: describeHistoryMonthGroup(gapMonths ?? []),
            rightLabel: "Later derogatory month",
            rightValue: current.value,
          })),
        },
        evidenceRefs: useExperianPhaseOneProvenance
          ? buildExperianRetroactiveBackfillEvidenceRefs(
              entityKey,
              provableRetroactiveBackfillConflicts,
              chronologicalPaymentHistoryCells,
              chronologicalPaymentHistoryGapCells,
            )
          : [],
      }));
    }

    if (chargeOffOrCollectionWithoutBuildUpConflicts.length > 0) {
      reasons.push(buildReason({
        id: `chargeoff-or-collection-without-buildup:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "charge_off_or_collection_without_monthly_build_up",
        issueLabel: "Charge-off or collection reporting lacks monthly buildup",
        reasonSummary: `The tradeline for ${displayName} reports charge-off or collection-style monthly history without enough earlier delinquency buildup to support that progression.`,
        supportingFacts: chargeOffOrCollectionWithoutBuildUpConflicts.slice(0, 6).map(({ current, previous }) => `${formatHistoryCellMonth(current)} reports ${current.value}, but the earlier reported month ${previous ? formatHistoryCellMonth(previous) : "Not reported"} does not provide enough buildup to support that level of derogatory reporting.`),
        supportingFields: ["paymentHistory", "status", "chargeOffAmount"],
        sourcePages,
        requestedAction: "Please provide the complete monthly buildup supporting the reported charge-off or collection history or delete/correct any unsupported monthly reporting.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory", "status", "chargeOffAmount"],
          monthlyComparisons: chargeOffOrCollectionWithoutBuildUpConflicts.slice(0, 6).map(({ current, previous }) => ({
            month: formatHistoryCellMonth(current),
            leftLabel: previous ? `Earlier month ${formatHistoryCellMonth(previous)}` : "Earlier month",
            leftValue: previous?.value || "No earlier reported month",
            rightLabel: "Charge-off / collection month",
            rightValue: current.value,
          })),
          scalarComparisons: [
            { label: "Status", value: account.statusText || "Not reported" },
            { label: "Charge-off amount", value: account.chargeOffAmountValue || "Not reported" },
          ],
        },
      }));
    }

    if (derogatoryStatus && !paymentHistoryPresent) {
      reasons.push(buildReason({
        id: `derogatory-without-history:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "derogatory_status_without_monthly_support",
        issueLabel: "Derogatory reporting lacks monthly support",
        reasonSummary: `The tradeline for ${displayName} is reported with derogatory or past-due information, but the report does not provide a meaningful monthly payment history to support or verify that reporting.`,
        supportingFacts: [
          `Reported status: ${account.statusText || "Not reported"}`,
          `The extracted monthly payment history for ${accountLabel} is blank, no-data, or otherwise incomplete.`,
        ],
        supportingFields: ["status", "paymentHistory", "amountPastDue", "chargeOffAmount"],
        sourcePages,
        requestedAction: "Please conduct a full reinvestigation and either provide a complete monthly history supporting this derogatory reporting or delete/correct the tradeline if it cannot be verified as complete and accurate.",
        severity: "high",
      }));
    }

    if (paymentPlanContext && !paymentHistoryPresent) {
      reasons.push(buildReason({
        id: `payment-plan-without-history:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "payment_plan_or_forbearance_context_without_history",
        issueLabel: "Payment-plan or forbearance context lacks history",
        reasonSummary: `The tradeline for ${displayName} reflects payment-plan, deferment, or forbearance context, but the report does not provide a meaningful monthly payment history for that account.`,
        supportingFacts: [
          `Reported status: ${account.statusText || "Not reported"}`,
          `Comments / remarks: ${account.comments.join("; ") || "Not reported"}`,
        ],
        supportingFields: ["status", "comments", "paymentHistory"],
        sourcePages,
        requestedAction: "Please provide the complete monthly payment history associated with the reported plan or forbearance context, or delete/correct any incomplete timeline reporting.",
        severity: "high",
        evidence: {
          comparedFields: ["status", "comments", "paymentHistory"],
          scalarComparisons: [
            { label: "Status", value: account.statusText || "Not reported" },
            { label: "Comments / remarks", value: account.comments.join("; ") || "Not reported" },
          ],
        },
      }));
    }

    if (paymentPlanContext && paymentHistoryPresent && paymentPlanConflictMonths.length > 0) {
      reasons.push(buildReason({
        id: `payment-plan-derogatory-conflict:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "payment_plan_or_forbearance_context_with_derogatory_conflict",
        issueLabel: "Payment-plan or forbearance context conflicts with derogatory reporting",
        reasonSummary: `The tradeline for ${displayName} reflects payment-plan, deferment, or forbearance context, but the monthly history still shows contradictory worsening delinquency.`,
        supportingFacts: [
          `Reported status: ${account.statusText || "Not reported"}`,
          `Comments / remarks: ${account.comments.join("; ") || "Not reported"}`,
          ...paymentPlanConflictMonths.slice(0, 6).map((month) => `${formatHistoryMonth(month)} reports ${paymentHistoryLookup.get(month) || "blank"} despite the reported plan or forbearance context.`),
        ],
        supportingFields: ["status", "comments", "paymentHistory"],
        sourcePages,
        requestedAction: "Please reinvestigate the monthly reporting during the reported plan or forbearance context and correct or delete any derogatory history that cannot be verified as accurate and complete.",
        severity: "high",
        evidenceRefs: isExperianProvenanceProfile(report)
          ? buildExperianPaymentPlanConflictEvidenceRefs(entityKey, paymentPlanConflictMonths, paymentHistoryLookup)
          : undefined,
        evidence: {
          comparedFields: ["status", "comments", "paymentHistory"],
          scalarComparisons: [
            { label: "Status", value: account.statusText || "Not reported" },
            { label: "Comments / remarks", value: account.comments.join("; ") || "Not reported" },
          ],
          monthlyComparisons: paymentPlanConflictMonths.slice(0, 6).map((month) => ({
            month: formatHistoryMonth(month),
            leftLabel: "Reported plan / forbearance context",
            leftValue: account.comments.join("; ") || account.statusText || "Reported",
            rightLabel: "Payment history",
            rightValue: paymentHistoryLookup.get(month) || "blank",
          })),
        },
      }));
    }

    if (paymentActivityConflicts.length > 0) {
      reasons.push(buildReason({
        id: `payment-activity-vs-delinquency:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "payment_activity_conflicts_with_delinquency_progression",
        issueLabel: "Payment activity conflicts with delinquency progression",
        reasonSummary: `The tradeline for ${displayName} shows payment-activity evidence while the payment-history sequence worsens in a way that is not fully supported by the tradeline timeline.`,
        supportingFacts: paymentActivityConflicts.slice(0, 6).map((conflict) => `${formatHistoryCellMonth(conflict.current)} reports ${conflict.current.value}, while related payment activity shows ${[conflict.paidAmountValue && `paid amount ${conflict.paidAmountValue}`, conflict.scheduledAmountValue && `scheduled payment ${conflict.scheduledAmountValue}`, conflict.lastPaymentValue && `last payment ${conflict.lastPaymentValue}`, conflict.recentPaymentValue && `recent payment ${conflict.recentPaymentValue}`].filter(Boolean).join(", ")}.`),
        supportingFields: ["paymentHistory", "actualPaymentHistory", "scheduledPaymentHistory", "lastPaymentDate", "recentPayment"],
        sourcePages,
        requestedAction: "Please reinvestigate the monthly payment activity and delinquency reporting and correct or delete any monthly sequence that is not internally consistent.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory", "actualPaymentHistory", "scheduledPaymentHistory", "lastPaymentDate", "recentPayment"],
          monthlyComparisons: paymentActivityConflicts.slice(0, 6).map((conflict) => ({
            month: formatHistoryCellMonth(conflict.current),
            leftLabel: "Payment activity",
            leftValue: [
              conflict.paidAmountValue && `Paid ${conflict.paidAmountValue}`,
              conflict.scheduledAmountValue && `Scheduled ${conflict.scheduledAmountValue}`,
              conflict.lastPaymentValue && `Last payment ${conflict.lastPaymentValue}`,
              conflict.recentPaymentValue && `Recent payment ${conflict.recentPaymentValue}`,
            ].filter(Boolean).join("; "),
            rightLabel: "Payment history",
            rightValue: conflict.current.value,
          })),
        },
        evidenceRefs: useExperianPhaseOneProvenance
          ? buildExperianPaymentActivityConflictEvidenceRefs(
              entityKey,
              paymentActivityConflicts,
              chronologicalPaymentHistoryCells,
              chronologicalPaymentHistoryGapCells,
            )
          : [],
      }));
    }

    if (balanceReductionConflicts.length > 0) {
      reasons.push(buildReason({
        id: `balance-reduction-vs-delinquency:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "balance_reduction_conflicts_with_worsening_delinquency",
        issueLabel: "Balance reduction conflicts with worsening delinquency",
        reasonSummary: `The tradeline for ${displayName} shows balances declining while the payment history worsens into a more severe delinquency, which makes the account timeline internally inconsistent.`,
        supportingFacts: balanceReductionConflicts.slice(0, 6).map((conflict) => `${formatHistoryCellMonth(conflict.previous)} balance ${conflict.previousBalanceValue} declines to ${conflict.currentBalanceValue} by ${formatHistoryCellMonth(conflict.current)}, even though the payment history worsens to ${conflict.current.value}.`),
        supportingFields: ["paymentHistory", "balanceHistory", "paymentAmount"],
        sourcePages,
        requestedAction: "Please reinvestigate the balance history and delinquency progression and correct or delete any monthly reporting that is not internally consistent.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory", "balanceHistory", "paymentAmount"],
          monthlyComparisons: balanceReductionConflicts.slice(0, 6).map((conflict) => ({
            month: formatHistoryCellMonth(conflict.current),
            leftLabel: "Balance history",
            leftValue: `${conflict.previousBalanceValue} -> ${conflict.currentBalanceValue}`,
            rightLabel: "Payment history",
            rightValue: `${conflict.previous.value} -> ${conflict.current.value}`,
          })),
        },
      }));
    }

    if (collectionLike && paymentHistoryPresent && hasCurrentHistory && !paymentPlanContext) {
      reasons.push(buildReason({
        id: `collection-payment-activity:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "collection_payment_activity_conflict",
        issueLabel: "Collection tradeline reflects payment activity",
        reasonSummary: `The tradeline for ${displayName} is reported as a collection-type account while also reflecting monthly current-payment activity, without any payment-plan context explaining that reporting.`,
        supportingFacts: [
          `Reported status: ${account.statusText || "Not reported"}`,
          "The payment history includes current or on-time months on the same tradeline.",
        ],
        supportingFields: ["status", "paymentHistory", "comments"],
        sourcePages,
        requestedAction: "Please reinvestigate whether the collection-related reporting on this tradeline is complete, accurate, and internally consistent, and delete or correct any information that cannot be verified.",
        severity: "high",
      }));
    }

    if (!collectionLike && !account.isClosed && installmentLike && paymentAmountMissing) {
      reasons.push(buildReason({
        id: `monthly-payment-missing:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "monthly_payment_missing_for_open_installment",
        issueLabel: "Monthly payment is incomplete",
        reasonSummary: `The tradeline for ${displayName} appears to be an open installment-style account, but the reported monthly payment information is missing or incomplete.`,
        supportingFacts: [
          `Account type context: ${account.accountTypeText || "Not reported"}`,
          `Reported payment amount: ${account.paymentAmountValue || "Not reported"}`,
        ],
        supportingFields: ["paymentAmount", "accountType", "status"],
        sourcePages,
        requestedAction: "Please report the monthly payment information completely for this tradeline or correct/delete any incomplete installment reporting.",
        severity: "medium",
        evidence: {
          comparedFields: ["paymentAmount", "accountType", "status"],
          scalarComparisons: [
            { label: "Account type context", value: account.accountTypeText || "Not reported" },
            { label: "Reported payment amount", value: account.paymentAmountValue || "Not reported" },
          ],
        },
      }));
    }

    if (!collectionLike && !account.isClosed && recentCurrentHistoryCells.length > 0 && recentPaymentFieldMissing && lastPaymentDateMissing) {
      const recentCurrentMonthLabels = recentCurrentHistoryCells.map((cell) => formatHistoryCellMonth(cell));
      const latestRecentCurrentCell = recentCurrentHistoryCells[recentCurrentHistoryCells.length - 1];
      reasons.push(buildReason({
        id: `recent-payment-missing:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "recent_payment_missing_when_history_implies_payment",
        issueLabel: "Recent payment details are incomplete",
        reasonSummary: `The tradeline for ${displayName} reflects recent current payment activity, but the report still leaves the recent-payment details incomplete.`,
        supportingFacts: [
          `Recent current payment-history months: ${recentCurrentMonthLabels.join(", ")}`,
          `Reported recent payment field: ${account.recentPaymentValue || "Not reported"}`,
          `Reported last payment date: ${account.lastPaymentDateValue || "Not reported"}`,
        ],
        supportingFields: ["paymentHistory", "recentPayment", "lastPaymentDate"],
        sourcePages,
        requestedAction: "Please provide the missing recent payment information for this tradeline or correct/delete any incomplete payment reporting.",
        severity: "medium",
        evidence: {
          comparedFields: ["paymentHistory", "recentPayment", "lastPaymentDate"],
          monthlyComparisons: latestRecentCurrentCell
            ? [
                {
                  month: formatHistoryCellMonth(latestRecentCurrentCell),
                  leftLabel: "Payment history",
                  leftValue: latestRecentCurrentCell.value,
                  rightLabel: "Recent payment field",
                  rightValue: account.recentPaymentValue || "Not reported",
                },
              ]
            : [],
          scalarComparisons: [
            { label: "Reported recent payment field", value: account.recentPaymentValue || "Not reported" },
            { label: "Reported last payment date", value: account.lastPaymentDateValue || "Not reported" },
          ],
        },
        evidenceRefs: useExperianPhaseOneProvenance
          ? buildExperianRecentPaymentEvidenceRefs(entityKey, recentCurrentHistoryCells)
          : [],
      }));
    }

    if (!isMissing(account.reportedLastPaymentDateValue) && !hasReportedScheduledPaymentAmount(account)) {
      reasons.push(buildReason({
        id: `last-payment-date-without-scheduled-payment:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "last_payment_date_without_scheduled_payment_amount",
        issueLabel: "Last payment date lacks scheduled payment amount",
        reasonSummary: `The tradeline for ${displayName} reports a last payment date, but the scheduled payment amount field is missing or incomplete.`,
        supportingFacts: [
          `Reported last payment date field: ${account.reportedLastPaymentDateValue || "Not reported"}`,
          `Reported scheduled payment amount field: ${describeReportedScheduledPaymentAmount(account)}`,
        ],
        supportingFields: ["lastPaymentDate", "scheduledPaymentAmount"],
        sourcePages,
        requestedAction: "Please provide the scheduled payment amount associated with this reported last payment date or correct/delete any incomplete payment reporting that cannot be verified.",
        severity: "medium",
        evidence: {
          comparedFields: ["lastPaymentDate", "scheduledPaymentAmount"],
          scalarComparisons: [
            { label: "Reported last payment date field", value: account.reportedLastPaymentDateValue || "Not reported" },
            { label: "Reported scheduled payment amount field", value: describeReportedScheduledPaymentAmount(account) },
          ],
        },
      }));
    }

    if (!isMissing(account.reportedLastPaymentDateValue) && !hasReportedPaymentAmount(account)) {
      reasons.push(buildReason({
        id: `last-payment-date-without-payment-amount:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "last_payment_date_without_payment_amount",
        issueLabel: "Last payment date lacks payment amount",
        reasonSummary: `The tradeline for ${displayName} reports a last payment date, but the report does not provide a recent or actual payment amount field for that same tradeline.`,
        supportingFacts: [
          `Reported last payment date field: ${account.reportedLastPaymentDateValue || "Not reported"}`,
          `Reported recent/actual payment amount field: ${describeReportedPaymentAmount(account)}`,
        ],
        supportingFields: ["lastPaymentDate", "recentPayment", "actualPaymentAmount"],
        sourcePages,
        requestedAction: "Please provide the recent or actual payment amount associated with this reported last payment date or correct/delete any incomplete payment reporting that cannot be verified.",
        severity: "medium",
        evidence: {
          comparedFields: ["lastPaymentDate", "recentPayment", "actualPaymentAmount"],
          scalarComparisons: [
            { label: "Reported last payment date field", value: account.reportedLastPaymentDateValue || "Not reported" },
            { label: "Reported recent/actual payment amount field", value: describeReportedPaymentAmount(account) },
          ],
        },
      }));
    }

    if (hasReportedScheduledPaymentAmount(account) && isMissing(account.termsFrequencyValue) && isMissing(account.termDurationValue)) {
      reasons.push(buildReason({
        id: `scheduled-payment-without-terms:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "scheduled_payment_amount_without_terms",
        issueLabel: "Scheduled payment amount lacks terms",
        reasonSummary: `The tradeline for ${displayName} reports a scheduled payment amount, but the report does not provide terms or term duration information needed to interpret that amount.`,
        supportingFacts: [
          `Reported scheduled payment amount field: ${describeReportedScheduledPaymentAmount(account)}`,
          `Reported terms field: ${account.termsFrequencyValue || "Not reported"}`,
          `Reported term duration field: ${account.termDurationValue || "Not reported"}`,
        ],
        supportingFields: ["scheduledPaymentAmount", "terms", "termDuration"],
        sourcePages,
        requestedAction: "Please provide the missing terms information associated with this scheduled payment amount or correct/delete any incomplete payment reporting that cannot be verified.",
        severity: "medium",
        evidence: {
          comparedFields: ["scheduledPaymentAmount", "terms", "termDuration"],
          scalarComparisons: [
            { label: "Reported scheduled payment amount field", value: describeReportedScheduledPaymentAmount(account) },
            { label: "Reported terms field", value: account.termsFrequencyValue || "Not reported" },
            { label: "Reported term duration field", value: account.termDurationValue || "Not reported" },
          ],
        },
      }));
    }

    if (
      account.isClosed &&
      account.closureMonthKey &&
      (
        isBlankHistoryValue(account.closureMonthPaymentStatus) ||
        (!isMissing(account.lastPaymentSignalValue) && !account.closureMonthHasTableActivity)
      )
    ) {
      reasons.push(buildReason({
        id: `closed-account-final-month-reporting:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "closed_account_final_month_reporting_incomplete",
        issueLabel: "Closed account final-month reporting is incomplete",
        reasonSummary: `The tradeline for ${displayName} is reported as closed, but the closure month ${closureMonthLabel} is not fully supported in the report's month tables.`,
        supportingFacts: [
          `Closure timing used: ${account.closureTimingValue || "Not reported"}`,
          `Closure-month payment history: ${account.closureMonthPaymentStatus || "blank"}`,
          `Closure-month actual payment table: ${account.closureMonthActualPaymentValue || "Not reported"}`,
          `Scalar last-payment signal: ${account.lastPaymentSignalValue || "Not reported"}`,
        ],
        supportingFields: ["dateClosed", "paymentHistory", "actualPaymentHistory", "lastPaymentDate", "recentPayment"],
        sourcePages,
        requestedAction: "Please provide the complete closure-month payment reporting for this closed tradeline or correct/delete any closed-account reporting that cannot be verified as complete and accurate.",
        severity: "high",
        evidence: {
          comparedFields: ["dateClosed", "paymentHistory", "actualPaymentHistory", "lastPaymentDate", "recentPayment"],
          monthlyComparisons: [
            {
              month: closureMonthLabel,
              leftLabel: "Closure-month payment history",
              leftValue: account.closureMonthPaymentStatus || "blank",
              rightLabel: "Closure-month table activity",
              rightValue: account.closureMonthHasTableActivity ? "Present" : "Missing",
            },
          ],
          scalarComparisons: [
            { label: "Closure timing used", value: account.closureTimingValue || "Not reported" },
            { label: "Closure-month actual payment table", value: account.closureMonthActualPaymentValue || "Not reported" },
            { label: "Scalar last-payment signal", value: account.lastPaymentSignalValue || "Not reported" },
          ],
        },
      }));
    }

    if (
      account.isClosed &&
      account.closureMonthKey &&
      account.lastPaymentSignalKind === "actual_payment_amount" &&
      hasClosureMonthActualPaymentValue(account)
    ) {
      const scalarActualPaymentAmount = parseMoneyValue(account.lastPaymentSignalValue);
      const closureMonthActualPaymentAmount = parseMoneyValue(account.closureMonthActualPaymentValue);
      if (
        scalarActualPaymentAmount !== null &&
        closureMonthActualPaymentAmount !== null &&
        Math.abs(scalarActualPaymentAmount - closureMonthActualPaymentAmount) >= 0.01
      ) {
        reasons.push(buildReason({
          id: `closed-account-actual-payment-conflict:${entityKey}`,
          bureau: report.bureau,
          profileId: report.profileId,
          component: "accounts",
          entityType: "account",
          entityKey,
          issueType: "closed_account_actual_payment_conflicts_with_closure_month_history",
          issueLabel: "Closed account actual payment conflicts with closure month",
          reasonSummary: `The tradeline for ${displayName} reports an actual last-payment amount that does not match the closure-month actual-paid history shown for ${closureMonthLabel}.`,
          supportingFacts: [
            `Scalar actual payment signal: ${account.lastPaymentSignalValue || "Not reported"}`,
            `Closure-month actual payment table: ${account.closureMonthActualPaymentValue || "Not reported"}`,
            `Closure timing used: ${account.closureTimingValue || "Not reported"}`,
          ],
          supportingFields: ["dateClosed", "actualPaymentAmount", "recentPayment", "actualPaymentHistory"],
          sourcePages,
          requestedAction: "Please reinvestigate the actual payment amount reported for the closure month and correct or delete any closed-account payment reporting that is not internally consistent.",
          severity: "high",
          evidence: {
            comparedFields: ["dateClosed", "actualPaymentAmount", "recentPayment", "actualPaymentHistory"],
            monthlyComparisons: [
              {
                month: closureMonthLabel,
                leftLabel: "Scalar actual payment signal",
                leftValue: account.lastPaymentSignalValue || "Not reported",
                rightLabel: "Closure-month actual payment table",
                rightValue: account.closureMonthActualPaymentValue || "Not reported",
              },
            ],
            scalarComparisons: [
              { label: "Closure timing used", value: account.closureTimingValue || "Not reported" },
            ],
          },
        }));
      }
    }

    if (isEquifaxNew && monthAwarePastDueConflicts.length > 0) {
      const byKey = new Map(monthAwarePastDueConflicts.map((entry) => [entry.key, entry]));
      for (const group of groupConsecutiveHistoryMonths(monthAwarePastDueConflicts.map((entry) => entry.key)).slice(0, 4)) {
        const rangeKey = `${group[0]}:${group[group.length - 1]}`;
        reasons.push(buildReason({
          id: `payment-history-vs-past-due-history:${entityKey}:${rangeKey}`,
          bureau: report.bureau,
          profileId: report.profileId,
          component: "accounts",
          entityType: "account",
          entityKey,
          issueType: "payment_history_24_month_past_due_conflict",
          issueLabel: "Payment history conflicts with past-due history",
          reasonSummary: `The tradeline for ${displayName} reports positive past-due amounts during ${describeHistoryMonthGroup(group)}, but the payment-history table for those same months is blank or current.`,
          supportingFacts: group.map((key) => `${formatHistoryMonth(key)} past-due amount: ${byKey.get(key)?.raw || "Not reported"}; payment history: ${paymentHistoryLookup.get(key) || "blank"}`),
          supportingFields: ["paymentHistory", "amountPastDueHistory", "month24History"],
          sourcePages,
          requestedAction: "Please reinvestigate the month-by-month past-due reporting and correct or delete any monthly data that is incomplete or internally inconsistent.",
          severity: "high",
          evidence: {
            comparedFields: ["paymentHistory", "amountPastDueHistory", "month24History"],
            monthlyComparisons: group.map((key) => ({
              month: formatHistoryMonth(key),
              leftLabel: "Past-due amount",
              leftValue: byKey.get(key)?.raw || "Not reported",
              rightLabel: "Payment history",
              rightValue: paymentHistoryLookup.get(key) || "blank",
            })),
          },
        }));
      }
    }

    if ((amountPastDue ?? 0) > 0 && paymentHistoryPresent && onlyCurrentOrBlank && monthAwarePastDueConflicts.length === 0) {
      reasons.push(buildReason({
        id: `past-due-without-monthly-support:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "past_due_without_monthly_support",
        issueLabel: "Past-due reporting lacks monthly support",
        reasonSummary: `The tradeline for ${displayName} reports an amount past due, but the reported monthly payment history does not show corresponding derogatory activity to support that past-due amount.`,
        supportingFacts: [
          `Reported amount past due: ${account.amountPastDueValue}`,
          "The available monthly payment history reflects only current or no-data months.",
        ],
        supportingFields: ["amountPastDue", "paymentHistory"],
        sourcePages,
        requestedAction: "Please reinvestigate the reported amount past due and correct or delete any past-due reporting that is not supported by the tradeline's own monthly history.",
        severity: "high",
      }));
    }

    if (!hasDerogatoryHistory && (observedPastDueMax ?? 0) > 0) {
      reasons.push(buildReason({
        id: `past-due-history-without-derogatory-codes:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "amount_past_due_history_conflict",
        issueLabel: "Past-due history conflicts with payment history",
        reasonSummary: `The tradeline for ${displayName} reports positive past-due amounts in its history, but the monthly payment-history codes do not reflect corresponding derogatory reporting.`,
        supportingFacts: [
          `Observed positive past-due amount in history: ${observedPastDueMax}`,
          "No corresponding delinquency or collection code was found in the extracted payment history.",
        ],
        supportingFields: ["amountPastDueHistory", "paymentHistory"],
        sourcePages,
        requestedAction: "Please reinvestigate the internal consistency of the tradeline's past-due history and monthly payment history, and correct or delete any information that cannot be verified as accurate and complete.",
        severity: "high",
        evidence: {
          comparedFields: ["amountPastDueHistory", "paymentHistory"],
          scalarComparisons: [
            { label: "Largest past-due amount in history", value: String(observedPastDueMax) },
            { label: "Derogatory payment-history code present", value: "No" },
          ],
        },
      }));
    }

    if ((highestBalance ?? 0) > 0 && (observedBalanceMax ?? 0) > 0 && highestBalance! > observedBalanceMax!) {
      reasons.push(buildReason({
        id: `high-balance-unsupported:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "high_balance_not_supported_by_history",
        issueLabel: "High balance is not supported by history",
        reasonSummary: `The tradeline for ${displayName} reports a high balance that exceeds the balance values reflected in the tradeline's own extracted balance history.`,
        supportingFacts: [
          `Reported high balance: ${account.highestBalanceValue}`,
          `Highest balance reflected in extracted balance history: ${observedBalanceMax}`,
        ],
        supportingFields: ["highestBalance", "balanceHistory", "balance"],
        sourcePages,
        requestedAction: "Please reinvestigate the reported high balance and correct or delete any amount that is not supported by the tradeline's own historical reporting.",
        severity: "medium",
        evidence: {
          comparedFields: ["highestBalance", "balanceHistory", "balance"],
          scalarComparisons: [
            { label: "Reported high balance", value: account.highestBalanceValue || "Not reported" },
            { label: "Observed highest balance in history", value: String(observedBalanceMax) },
          ],
        },
        evidenceRefs: useExperianPhaseOneProvenance ? buildExperianHighBalanceEvidenceRefs(entityKey) : [],
      }));
    }

    if (monthlyBalanceGapMonths.length >= 2) {
      const groupedGapMonths = groupConsecutiveHistoryMonths(monthlyBalanceGapMonths);
      for (const group of groupedGapMonths.slice(0, 4)) {
        const rangeKey = `${group[0]}:${group[group.length - 1]}`;
        reasons.push(buildReason({
          id: `balance-history-monthly-gaps:${entityKey}:${rangeKey}`,
          bureau: report.bureau,
          profileId: report.profileId,
          component: "accounts",
          entityType: "account",
          entityKey,
          issueType: "balance_history_monthly_gap_conflict",
          issueLabel: "Balance history has unexplained monthly gaps",
          reasonSummary: `The tradeline for ${displayName} contains months with payment-history activity during ${describeHistoryMonthGroup(group)}, but the corresponding balance history is blank for those same months.`,
          supportingFacts: describeMonthConflicts(group, balanceHistoryLookup),
          supportingFields: ["paymentHistory", "balanceHistory", "month24History"],
          sourcePages,
          requestedAction: "Please reinvestigate the month-by-month balance history and provide a complete history or correct/delete any reporting that cannot be verified as internally consistent.",
          severity: "medium",
          evidence: {
            comparedFields: ["paymentHistory", "balanceHistory", "month24History"],
            monthlyComparisons: group.map((month) => ({
              month: formatHistoryMonth(month),
              leftLabel: "Payment history",
              leftValue: paymentHistoryLookup.get(month) || "blank",
              rightLabel: "Balance history",
              rightValue: balanceHistoryLookup.get(month) || "blank",
            })),
          },
          evidenceRefs: useExperianPhaseOneProvenance ? buildExperianGapEvidenceRefs(entityKey, [group], balanceHistoryCells) : [],
        }));
      }
    }

    // Coverage-span incompleteness: the payment grid reports DEROGATORY activity in
    // months that predate every record in the supporting money tables (balance,
    // amount past due, actual/scheduled payment). Under the FCRA, incomplete
    // information is disputable alongside inaccurate information — a furnisher
    // reporting delinquency without the supporting month records for those months
    // leaves the derogatory marks unsupported on the face of the report.
    {
      const meaningfulMoneyValue = (value: string | null | undefined) => {
        const normalized = normalizeText(String(value ?? "")).toLowerCase();
        return Boolean(normalized) && !["-", "--", "blank", "n/a"].includes(normalized);
      };
      const supportingTables: Array<{ field: string; label: string; cells: HistoryCell[] }> = [
        { field: "balanceHistory", label: "Balance history", cells: balanceHistoryCells },
        { field: "amountPastDueHistory", label: "Amount past due history", cells: pastDueHistoryCells },
        { field: "actualPaymentHistory", label: "Actual payment history", cells: paidAmountHistoryCells },
        { field: "scheduledPaymentHistory", label: "Scheduled payment history", cells: scheduledPaymentHistoryCells },
      ];
      const derogatoryGridMonths = chronologicalPaymentHistoryCells
        .filter((cell) => isDerogatoryHistoryValue(cell.value))
        .map((cell) => toHistoryMonthKey(cell.year, cell.month));
      if (derogatoryGridMonths.length > 0) {
        const affected: Array<{ field: string; label: string; coverageStart: HistoryMonthKey; months: HistoryMonthKey[] }> = [];
        for (const table of supportingTables) {
          const covered = table.cells
            .filter((cell) => meaningfulMoneyValue(cell.value))
            .map((cell) => toHistoryMonthKey(cell.year, cell.month));
          if (covered.length === 0) {
            continue; // an entirely empty table is handled by the insufficient-history rules
          }
          const coverageStartValue = Math.min(...covered.map(historyMonthSortValue));
          const coverageStart = covered.find((key) => historyMonthSortValue(key) === coverageStartValue) as HistoryMonthKey;
          const uncovered = derogatoryGridMonths.filter((key) => historyMonthSortValue(key) < coverageStartValue);
          if (uncovered.length >= 2) {
            affected.push({ field: table.field, label: table.label, coverageStart, months: uncovered });
          }
        }
        if (affected.length > 0) {
          const primary = affected.find((entry) => entry.field === "balanceHistory") ?? affected[0];
          const uncoveredGroups = groupConsecutiveHistoryMonths(primary.months);
          // Show both ends of the unsupported span: where the derogatory run began
          // (earliest marks, e.g. the 30/60/90 progression) and the months adjacent
          // to the table's coverage boundary.
          const displayMonths = primary.months.length <= 6
            ? primary.months
            : [...primary.months.slice(0, 3), ...primary.months.slice(-3)];
          reasons.push(buildReason({
            id: `history-activity-before-table-coverage:${entityKey}`,
            bureau: report.bureau,
            profileId: report.profileId,
            component: "accounts",
            entityType: "account",
            entityKey,
            issueType: "payment_history_activity_before_table_coverage",
            issueLabel: "Derogatory history predates supporting table coverage",
            reasonSummary: `The tradeline for ${displayName} reports derogatory payment-history activity during ${uncoveredGroups.map(describeHistoryMonthGroup).join(", ")}, but ${affected.map((entry) => `the ${entry.label.toLowerCase()} does not begin until ${formatHistoryMonth(entry.coverageStart)}`).join(" and ")} — leaving those derogatory months without supporting records on the face of the report.`,
            supportingFacts: [
              ...affected.map((entry) => `${entry.label} coverage begins ${formatHistoryMonth(entry.coverageStart)}; ${entry.months.length} derogatory month(s) precede it.`),
              `Derogatory months without table support: ${uncoveredGroups.map(describeHistoryMonthGroup).join(", ")}.`,
            ],
            supportingFields: ["paymentHistory", ...affected.map((entry) => entry.field)],
            sourcePages,
            requestedAction: "Please reinvestigate and provide the complete month-by-month balance and payment records supporting the derogatory history for these months, or correct/delete any reporting that cannot be verified as complete.",
            severity: "high",
            evidence: {
              comparedFields: ["paymentHistory", ...affected.map((entry) => entry.field)],
              monthlyComparisons: displayMonths.map((month) => ({
                month: formatHistoryMonth(month),
                leftLabel: "Payment history",
                leftValue: paymentHistoryLookup.get(month) || "blank",
                rightLabel: `${primary.label} coverage begins ${formatHistoryMonth(primary.coverageStart)}`,
                rightValue: "No record for this month",
              })),
            },
          }));
        }
      }
    }

    if (balancePaymentConflictMonths.length > 0) {
      reasons.push(buildReason({
        id: `payment-balance-conflict:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "payment_history_balance_history_conflict",
        issueLabel: "Balance history conflicts with payment activity",
        reasonSummary: `The tradeline for ${displayName} reports installment payment activity that does not line up with the month-to-month balance changes shown in the tradeline history.`,
        supportingFacts: balancePaymentConflictMonths.slice(0, 6).map((entry) => `${formatHistoryMonth(entry.month)} shows ${entry.paidAmount.toFixed(2)} paid while the balance changes from ${entry.balanceValue.toFixed(2)} to ${entry.nextBalanceValue.toFixed(2)} in the next reported month.`),
        supportingFields: ["paymentHistory", "balanceHistory", "paymentAmount"],
        sourcePages,
        requestedAction: "Please reinvestigate the month-by-month payment and balance reporting and correct or delete any amounts that are not internally consistent.",
        severity: "high",
        evidence: {
          comparedFields: ["paymentHistory", "balanceHistory", "paymentAmount"],
          monthlyComparisons: balancePaymentConflictMonths.slice(0, 6).map((entry) => ({
            month: formatHistoryMonth(entry.month),
            leftLabel: "Paid / payment amount",
            leftValue: String(entry.paidAmount),
            rightLabel: "Balance next month",
            rightValue: `${entry.balanceValue} -> ${entry.nextBalanceValue}`,
          })),
        },
        evidenceRefs: useExperianPhaseOneProvenance
          ? buildExperianBalanceConflictEvidenceRefs(entityKey, balancePaymentConflictMonths)
          : [],
      }));
    }

    if ((creditLimit ?? 0) > 0 && (observedCreditLimitMax ?? 0) > 0 && creditLimit! > observedCreditLimitMax!) {
      reasons.push(buildReason({
        id: `credit-limit-unsupported:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "credit_limit_not_supported_by_history",
        issueLabel: "Credit limit is not supported by history",
        reasonSummary: `The tradeline for ${displayName} reports a credit limit that exceeds the values reflected in the tradeline's own extracted credit-limit history.`,
        supportingFacts: [
          `Reported credit limit: ${account.creditLimitValue}`,
          `Highest credit-limit value reflected in extracted history: ${observedCreditLimitMax}`,
        ],
        supportingFields: ["creditLimit", "creditLimitHistory"],
        sourcePages,
        requestedAction: "Please reinvestigate the reported credit limit and correct or delete any amount that is not supported by the tradeline's own historical reporting.",
        severity: "medium",
        evidence: {
          comparedFields: ["creditLimit", "creditLimitHistory"],
          scalarComparisons: [
            { label: "Reported credit limit", value: account.creditLimitValue || "Not reported" },
            { label: "Observed highest credit-limit history value", value: String(observedCreditLimitMax) },
          ],
        },
      }));
    }

    if (chargeOffLike && paymentHistoryPresent && onlyCurrentOrBlank && !hasChargeOffCode) {
      reasons.push(buildReason({
        id: `charge-off-without-chargeoff-history:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "charge_off_without_chargeoff_history",
        issueLabel: "Charge-off reporting lacks charge-off history",
        reasonSummary: `The tradeline for ${displayName} is reported as charged off, but the monthly history available in the report does not show corresponding charge-off codes and instead reflects only current or blank months.`,
        supportingFacts: [
          `Reported status: ${account.statusText || "Not reported"}`,
          `Reported charge-off amount: ${account.chargeOffAmountValue || "Not reported"}`,
        ],
        supportingFields: ["status", "chargeOffAmount", "paymentHistory"],
        sourcePages,
        requestedAction: "Please reinvestigate the charged-off reporting and either provide complete monthly support for the charge-off status or delete/correct the tradeline if it cannot be verified as complete and accurate.",
        severity: "high",
        evidence: {
          comparedFields: ["status", "chargeOffAmount", "paymentHistory"],
          scalarComparisons: [
            { label: "Reported status", value: account.statusText || "Not reported" },
            { label: "Reported charge-off amount", value: account.chargeOffAmountValue || "Not reported" },
          ],
        },
      }));
    }

    if (isEquifaxNew && month24ActivityConflictMonths.length > 0) {
      for (const group of groupConsecutiveHistoryMonths(month24ActivityConflictMonths).slice(0, 4)) {
        const rangeKey = `${group[0]}:${group[group.length - 1]}`;
        reasons.push(buildReason({
          id: `payment-history-vs-24-month-activity:${entityKey}:${rangeKey}`,
          bureau: report.bureau,
          profileId: report.profileId,
          component: "accounts",
          entityType: "account",
          entityKey,
          issueType: "payment_history_24_month_activity_conflict",
          issueLabel: "Payment history is incomplete relative to 24 month history",
          reasonSummary: `The tradeline for ${displayName} has 24-month-history activity during ${describeHistoryMonthGroup(group)}, but the payment-history table is blank for those same months.`,
          supportingFacts: describeMonthConflicts(group, paymentHistoryLookup),
          supportingFields: ["paymentHistory", "month24History"],
          sourcePages,
          requestedAction: "Please reinvestigate the month-by-month reporting and provide a complete payment history for the months where the 24-month history reflects account activity.",
          severity: "medium",
          evidence: {
            comparedFields: ["paymentHistory", "month24History"],
            monthlyComparisons: group.map((month) => ({
              month: formatHistoryMonth(month),
              leftLabel: "24 month history",
              leftValue: "activity present",
              rightLabel: "Payment history",
              rightValue: paymentHistoryLookup.get(month) || "blank",
            })),
          },
        }));
      }
    }

    if (dateOfFirstDelinquencyYear && firstDerogatoryMonth && firstDerogatoryMonth.year !== dateOfFirstDelinquencyYear) {
      reasons.push(buildReason({
        id: `date-of-first-delinquency-conflict:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "date_of_first_delinquency_conflict",
        issueLabel: "Date of first delinquency conflicts with payment history",
        reasonSummary: `The tradeline for ${displayName} reports a date of first delinquency that does not align with the earliest derogatory month shown in the payment history.`,
        supportingFacts: [
          `Reported date of first delinquency: ${account.dateOfFirstDelinquencyValue}`,
          `Earliest derogatory month shown: ${formatHistoryMonth(toHistoryMonthKey(firstDerogatoryMonth.year, firstDerogatoryMonth.month))}`,
        ],
        supportingFields: ["dateOfFirstDelinquency", "paymentHistory"],
        sourcePages,
        requestedAction: "Please reinvestigate the date of first delinquency and correct or delete any date reporting that is inconsistent with the tradeline's own payment history.",
        severity: "high",
        evidence: {
          comparedFields: ["dateOfFirstDelinquency", "paymentHistory"],
          monthlyComparisons: [
            {
              month: formatHistoryMonth(toHistoryMonthKey(firstDerogatoryMonth.year, firstDerogatoryMonth.month)),
              leftLabel: "Date of first delinquency",
              leftValue: account.dateOfFirstDelinquencyValue,
              rightLabel: "Earliest derogatory month",
              rightValue: firstDerogatoryMonth.value,
            },
          ],
        },
      }));
    }

    if (parsedStatusUpdatedDate && latestPaymentCell) {
      const latestPaymentDate = parseDateLike(formatHistoryMonth(toHistoryMonthKey(latestPaymentCell.year, latestPaymentCell.month)));
      if (latestPaymentDate && monthsBetweenDates(parsedStatusUpdatedDate, latestPaymentDate) > 2) {
        reasons.push(buildReason({
          id: `status-updated-timeline-conflict:${entityKey}`,
          bureau: report.bureau,
          profileId: report.profileId,
          component: "accounts",
          entityType: "account",
          entityKey,
          issueType: "status_updated_timeline_conflict",
          issueLabel: "Status-updated date conflicts with timeline",
          reasonSummary: `The tradeline for ${displayName} reports a status-updated date that does not line up with the latest payment-history month shown on the tradeline.`,
          supportingFacts: [
            `Reported status-updated date: ${account.statusUpdatedValue}`,
            `Latest payment-history month shown: ${formatHistoryMonth(toHistoryMonthKey(latestPaymentCell.year, latestPaymentCell.month))}`,
          ],
          supportingFields: ["statusUpdated", "paymentHistory"],
          sourcePages,
          requestedAction: "Please reinvestigate the status-updated date and correct or delete any status reporting that is not consistent with the tradeline timeline.",
          severity: "medium",
          evidence: {
            comparedFields: ["statusUpdated", "paymentHistory"],
            scalarComparisons: [
              { label: "Status-updated date", value: account.statusUpdatedValue || "Not reported" },
              { label: "Latest payment-history month", value: formatHistoryMonth(toHistoryMonthKey(latestPaymentCell.year, latestPaymentCell.month)) },
            ],
          },
        }));
      }
    }

    if (parsedBalanceUpdatedDate && latestBalanceCell) {
      const latestBalanceDate = parseDateLike(formatHistoryMonth(toHistoryMonthKey(latestBalanceCell.year, latestBalanceCell.month)));
      if (latestBalanceDate && monthsBetweenDates(parsedBalanceUpdatedDate, latestBalanceDate) > 2) {
        reasons.push(buildReason({
          id: `balance-updated-timeline-conflict:${entityKey}`,
          bureau: report.bureau,
          profileId: report.profileId,
          component: "accounts",
          entityType: "account",
          entityKey,
          issueType: "balance_updated_timeline_conflict",
          issueLabel: "Balance-updated date conflicts with timeline",
          reasonSummary: `The tradeline for ${displayName} reports a balance-updated date that does not line up with the latest balance-history month shown on the tradeline.`,
          supportingFacts: [
            `Reported balance-updated date: ${account.balanceUpdatedValue}`,
            `Latest balance-history month shown: ${formatHistoryMonth(toHistoryMonthKey(latestBalanceCell.year, latestBalanceCell.month))}`,
          ],
          supportingFields: ["balanceUpdated", "balanceHistory"],
          sourcePages,
          requestedAction: "Please reinvestigate the balance-updated date and correct or delete any balance reporting that is not consistent with the tradeline timeline.",
          severity: "medium",
          evidence: {
            comparedFields: ["balanceUpdated", "balanceHistory"],
            scalarComparisons: [
              { label: "Balance-updated date", value: account.balanceUpdatedValue || "Not reported" },
              { label: "Latest balance-history month", value: formatHistoryMonth(toHistoryMonthKey(latestBalanceCell.year, latestBalanceCell.month)) },
            ],
          },
          evidenceRefs: useExperianPhaseOneProvenance ? buildExperianBalanceUpdatedEvidenceRefs(entityKey) : [],
        }));
      }
    }

    if (parsedDateOfFirstDelinquency && parsedEstimatedRemovalDate) {
      const removalMonths = monthsBetweenDates(parsedDateOfFirstDelinquency, parsedEstimatedRemovalDate);
      if (removalMonths < 78 || removalMonths > 96) {
        reasons.push(buildReason({
          id: `on-record-until-conflict:${entityKey}`,
          bureau: report.bureau,
          profileId: report.profileId,
          component: "accounts",
          entityType: "account",
          entityKey,
          issueType: "on_record_until_conflict",
          issueLabel: "On-record-until date conflicts with delinquency date",
          reasonSummary: `The tradeline for ${displayName} reports an on-record-until or estimated-removal date that does not logically align with the reported date of first delinquency.`,
          supportingFacts: [
            `Reported date of first delinquency: ${account.dateOfFirstDelinquencyValue}`,
            `Reported estimated removal/on-record-until date: ${account.estimatedRemovalValue}`,
          ],
          supportingFields: ["dateOfFirstDelinquency", "estimatedRemoval"],
          sourcePages,
          requestedAction: "Please reinvestigate the reported delinquency and removal dates and correct or delete any date reporting that is not complete and accurate.",
          severity: "high",
          evidence: {
            comparedFields: ["dateOfFirstDelinquency", "estimatedRemoval"],
            scalarComparisons: [
              { label: "Date of first delinquency", value: account.dateOfFirstDelinquencyValue || "Not reported" },
              { label: "Estimated removal / on-record-until", value: account.estimatedRemovalValue || "Not reported" },
            ],
          },
        }));
      }
    }

    if ((derogatoryStatus || (amountPastDue ?? 0) > 0 || (chargeOffAmount ?? 0) > 0) && paymentHistoryPresent && maxNumericFromValues(account.balanceHistoryValues) === null) {
      reasons.push(buildReason({
        id: `balance-history-incomplete:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "accounts",
        entityType: "account",
        entityKey,
        issueType: "insufficient_balance_history",
        issueLabel: "Balance history is incomplete",
        reasonSummary: `The tradeline for ${displayName} reports derogatory or balance-related information, but the balance history is missing or incomplete, preventing the reported amounts from being fully evaluated.`,
        supportingFacts: [
          `Reported balance: ${account.balanceValue || "Not reported"}`,
          `Reported amount past due: ${account.amountPastDueValue || "Not reported"}`,
        ],
        supportingFields: ["balance", "amountPastDue", "balanceHistory"],
        sourcePages,
        requestedAction: "Please provide the complete balance history supporting this tradeline or delete/correct any reporting that cannot be verified as complete and internally consistent.",
        severity: "medium",
        evidenceRefs: useExperianPhaseOneProvenance
          ? buildExperianInsufficientBalanceEvidenceRefs(entityKey, {
              balanceValue: account.balanceValue,
              amountPastDueValue: account.amountPastDueValue,
              statusText: account.statusText,
              chargeOffAmountValue: account.chargeOffAmountValue,
            })
          : [],
      }));
    }
  }

  return reasons;
};

const publicRecordEntityKey = (record: PublicRecord, index: number) =>
  `public_record::${normalizeMatchText(record.recordType)}::${normalizeMatchText(record.referenceNumber)}::${index}`;

const consumerIndicatorEntityKey = (indicator: ConsumerInformationIndicator, index: number) =>
  `consumer_information_indicator::${normalizeMatchText(indicator.code)}::${normalizeMatchText(indicator.description)}::${index}`;

const isBankruptcyPublicRecord = (record: PublicRecord) =>
  hasToken(publicRecordContextText(record), BANKRUPTCY_CONTEXT_TOKENS);

const publicRecordHasCoreDetails = (record: PublicRecord) =>
  !isMissing(record.recordType) &&
  !isMissing(record.dateFiled) &&
  (!isMissing(record.court) || !isMissing(record.referenceNumber));

const listMissingPublicRecordCoreDetails = (record: PublicRecord) => {
  const missing: string[] = [];
  if (isMissing(record.recordType)) {
    missing.push("record type");
  }
  if (isMissing(record.dateFiled)) {
    missing.push("filed date");
  }
  if (isMissing(record.court) && isMissing(record.referenceNumber)) {
    missing.push("court or reference number");
  } else {
    if (isMissing(record.court)) {
      missing.push("court");
    }
    if (isMissing(record.referenceNumber)) {
      missing.push("reference number");
    }
  }
  return missing;
};

const buildPublicRecordDuplicateGroups = (records: PublicRecord[]) => {
  const groups = new Map<string, Array<{ record: PublicRecord; index: number }>>();
  records.forEach((record, index) => {
    const key = publicRecordIdentityKey(record);
    if (!key) {
      return;
    }
    const bucket = groups.get(key) ?? [];
    bucket.push({ record, index });
    groups.set(key, bucket);
  });
  return Array.from(groups.entries()).filter(([, entries]) => entries.length > 1);
};

const detectPublicRecordReasons = (report: CreditReport): DisputeReason[] => {
  const reasons: DisputeReason[] = [];
  const defaultSourcePages = normalizePages(report.sourceComponents?.publicRecords?.pages);
  const parsedReportDate = parseDateLike(report.reportDate);

  for (const [identityKey, entries] of buildPublicRecordDuplicateGroups(report.publicRecords)) {
    const pages = normalizePages(entries.flatMap(({ record }) => record.sourcePages ?? defaultSourcePages));
    const comparisonPairs = entries.flatMap(({ record }, duplicateIndex) => [
      { label: `Duplicate ${duplicateIndex + 1} type`, value: record.recordType },
      { label: `Duplicate ${duplicateIndex + 1} court`, value: record.court },
      { label: `Duplicate ${duplicateIndex + 1} reference number`, value: record.referenceNumber },
      { label: `Duplicate ${duplicateIndex + 1} filed date`, value: record.dateFiled },
    ]);
    reasons.push(buildReason({
      id: `public-record-duplicate:${identityKey}:${entries[0]?.index ?? 0}`,
      bureau: report.bureau,
      profileId: report.profileId,
      component: "publicRecords",
      entityType: "public_record",
      entityKey: `public_record_duplicate::${identityKey}`,
      issueType: "public_record_duplicate_reporting",
      issueLabel: "Public record appears more than once",
      reasonSummary: "The same public record appears to be reported more than once with matching identifying details.",
      supportingFacts: [
        `Matching reference/case identity: ${identityKey.replace(/^[^:]+:/, "") || "Not reported"}`,
        `Duplicate entries found: ${entries.length}`,
      ],
      supportingFields: ["recordType", "court", "referenceNumber", "dateFiled"],
      sourcePages: pages,
      requestedAction: "Please verify whether these duplicate public-record entries refer to the same record and delete or consolidate any duplicate reporting that cannot be justified as separate records.",
      severity: "high",
      category: "legal_public_record",
      evidence: buildObservedValueEvidence(comparisonPairs),
    }));
  }

  report.publicRecords.forEach((record, index) => {
    const entityKey = publicRecordEntityKey(record, index + 1);
    const sourcePages = normalizePages(record.sourcePages?.length ? record.sourcePages : defaultSourcePages);
    const bankruptcyRecord = isBankruptcyPublicRecord(record);

    if (!publicRecordHasCoreDetails(record)) {
      const missingDetails = listMissingPublicRecordCoreDetails(record);
      reasons.push(buildReason({
        id: `public-record-missing-core-details:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "publicRecords",
        entityType: "public_record",
        entityKey,
        issueType: "public_record_missing_core_details",
        issueLabel: "Public record details are incomplete",
        reasonSummary: `The report includes a public record, but the record is missing ${missingDetails.join(", ")} needed to verify the reporting completely and accurately.`,
        supportingFacts: [
          `Missing details: ${missingDetails.join(", ") || "Not reported"}`,
          `Record type: ${record.recordType || "Not reported"}`,
          `Status: ${record.status || "Not reported"}`,
          `Court: ${record.court || "Not reported"}`,
          `Reference number: ${record.referenceNumber || "Not reported"}`,
          `Filed date: ${record.dateFiled || "Not reported"}`,
        ],
        supportingFields: ["recordType", "status", "court", "referenceNumber", "dateFiled"],
        sourcePages,
        requestedAction: "Please provide the complete identifying details for this public record or delete the record if it cannot be verified as complete and accurate.",
        severity: "high",
        category: "legal_public_record",
        evidence: buildObservedValueEvidence([
          { label: "Record type", value: record.recordType },
          { label: "Status", value: record.status },
          { label: "Court", value: record.court },
          { label: "Reference number", value: record.referenceNumber },
          { label: "Filed date", value: record.dateFiled },
        ]),
      }));
    }

    const anchorDate = parsedReportDate ? resolvePublicRecordAnchorDate(record) : null;
    if (parsedReportDate && anchorDate && isOlderThanYears(anchorDate, parsedReportDate, bankruptcyRecord ? 10 : 7)) {
      reasons.push(buildReason({
        id: `public-record-obsolete:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "publicRecords",
        entityType: "public_record",
        entityKey,
        issueType: "public_record_obsolete_reporting",
        issueLabel: "Public record appears obsolete",
        reasonSummary: bankruptcyRecord
          ? "The report includes a bankruptcy public record that appears older than the normal reporting period based on the dates shown in the file."
          : "The report includes a public record that appears older than the normal reporting period based on the dates shown in the file.",
        supportingFacts: [
          `Record type: ${record.recordType || "Not reported"}`,
          `Anchor date used: ${anchorDate.toISOString().slice(0, 10)}`,
          `Report date: ${report.reportDate || "Not reported"}`,
        ],
        supportingFields: ["recordType", "dateFiled", "dateResolved"],
        sourcePages,
        requestedAction: "Please verify whether this public record is still within the permitted reporting period and delete or correct it if the record is obsolete.",
        severity: "high",
        category: "legal_public_record",
        evidence: buildObservedValueEvidence([
          ...publicRecordCoreDetailPairs(record),
          { label: "Report date", value: report.reportDate },
        ]),
      }));
    }

    if (publicRecordHasRestrictedOrVacatedContext(record) && publicRecordStillLooksAdverse(record)) {
      reasons.push(buildReason({
        id: `public-record-restricted-context:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "publicRecords",
        entityType: "public_record",
        entityKey,
        issueType: "public_record_restricted_or_vacated_context",
        issueLabel: "Public record status appears misleading",
        reasonSummary: "The public record includes restricted, vacated, dismissed, released, or similar limiting language, but it still appears to be presented as active or adverse.",
        supportingFacts: [
          `Status: ${record.status || "Not reported"}`,
          `Summary: ${record.summary || "Not reported"}`,
        ],
        supportingFields: ["status", "summary", "details"],
        sourcePages,
        requestedAction: "Please verify whether this public record is being presented with the correct legal status and delete or correct any misleading adverse presentation.",
        severity: "high",
        category: "legal_public_record",
        evidence: buildObservedValueEvidence(publicRecordCoreDetailPairs(record)),
      }));
    }
  });

  return reasons;
};

const detectConsumerInformationIndicatorReasons = (report: CreditReport): DisputeReason[] => {
  const reasons: DisputeReason[] = [];
  const defaultSourcePages = normalizePages(report.sourceComponents?.consumerInformationIndicators?.pages);

  (report.consumerInformationIndicators ?? []).forEach((indicator, index) => {
    const entityKey = consumerIndicatorEntityKey(indicator, index + 1);
    const sourcePages = normalizePages(indicator.sourcePages?.length ? indicator.sourcePages : defaultSourcePages);

    if (!consumerIndicatorHasCoreDetails(indicator)) {
      reasons.push(buildReason({
        id: `consumer-information-indicator-missing-core-details:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "consumerInformationIndicators",
        entityType: "consumer_information_indicator",
        entityKey,
        issueType: "consumer_information_indicator_missing_core_details",
        issueLabel: "Consumer information indicator details are incomplete",
        reasonSummary: "The report includes a consumer-information indicator, but the indicator is missing core identifying details or account linkage needed to evaluate it accurately.",
        supportingFacts: [
          `Indicator code: ${indicator.code || "Not reported"}`,
          `Indicator description: ${indicator.description || "Not reported"}`,
          `Linked account: ${firstNonEmptyText(indicator.linkedAccountName ?? "", indicator.linkedAccountNumber ?? "", "Not reported")}`,
        ],
        supportingFields: ["code", "description", "category", "linkedAccountName", "linkedAccountNumber"],
        sourcePages,
        requestedAction: "Please provide the complete identifying details for this consumer-information indicator or delete it if it cannot be verified as complete and properly attributed.",
        severity: "high",
        category: "legal_public_record",
        evidence: buildObservedValueEvidence([
          { label: "Indicator code", value: indicator.code },
          { label: "Indicator description", value: indicator.description },
          { label: "Indicator category", value: indicator.category },
          { label: "Linked account name", value: indicator.linkedAccountName },
          { label: "Linked account number", value: indicator.linkedAccountNumber },
        ]),
      }));
    }

    const linkedAccount = findLinkedAccountForIndicator(report, indicator);
    const bankruptcyLikeIndicator = hasToken(consumerIndicatorContextText(indicator), BANKRUPTCY_CONTEXT_TOKENS);
    if (
      bankruptcyLikeIndicator &&
      linkedAccount &&
      rawAccountLooksCurrentOrActive(linkedAccount) &&
      !rawAccountHasBankruptcyContext(linkedAccount)
    ) {
      reasons.push(buildReason({
        id: `consumer-information-indicator-account-conflict:${entityKey}`,
        bureau: report.bureau,
        profileId: report.profileId,
        component: "consumerInformationIndicators",
        entityType: "consumer_information_indicator",
        entityKey,
        issueType: "consumer_information_indicator_account_conflict",
        issueLabel: "Consumer indicator conflicts with linked account reporting",
        reasonSummary: "The consumer-information indicator suggests bankruptcy-related treatment, but the linked account still appears to be reported as an active/current tradeline without matching bankruptcy context.",
        supportingFacts: [
          `Indicator description: ${indicator.description || "Not reported"}`,
          `Linked account: ${linkedAccount.accountName || "Not reported"} ${linkedAccount.accountNumber || ""}`.trim(),
          `Linked account status: ${linkedAccount.status || "Not reported"}`,
        ],
        supportingFields: ["description", "linkedAccountName", "linkedAccountNumber", "status"],
        sourcePages: normalizePages([
          ...sourcePages,
          ...(linkedAccount.sourcePages ?? []),
        ]),
        requestedAction: "Please verify whether this consumer-information indicator is correctly attributed to the linked account and correct or delete any indicator or account reporting that creates a bankruptcy-status conflict.",
        severity: "high",
        category: "legal_public_record",
        evidence: buildObservedValueEvidence([
          { label: "Indicator code", value: indicator.code },
          { label: "Indicator description", value: indicator.description },
          { label: "Indicator category", value: indicator.category },
          { label: "Linked account name", value: linkedAccount.accountName },
          { label: "Linked account number", value: linkedAccount.accountNumber },
          { label: "Linked account status", value: linkedAccount.status },
          { label: "Linked account legal category", value: linkedAccount.legalCategory },
        ]),
      }));
    }
  });

  return reasons;
};

const detectPersonalInformationReasons = (report: CreditReport, intake?: DisputeLetterIntake) => {
  const reasons: DisputeReason[] = [];
  const sourcePages = normalizePages(report.sourceComponents?.personalInformation?.pages);
  const socialSecurityNumbers = uniqueStrings(report.personalInfo.socialSecurityNumbers ?? [report.personalInfo.ssn]);
  if (socialSecurityNumbers.length > 1) {
    reasons.push(buildReason({
      id: "personal-info-multiple-ssns",
      bureau: report.bureau,
      profileId: report.profileId,
      component: "personalInformation",
      entityType: "personal_information",
      entityKey: "social_security_numbers",
      issueType: "multiple_social_security_numbers",
      issueLabel: "Multiple Social Security numbers reported",
      reasonSummary: "The report appears to contain more than one Social Security number variation, which requires immediate attorney review and reinvestigation.",
      supportingFacts: socialSecurityNumbers.map((value) => `Reported SSN variation: ${value}`),
      supportingFields: ["socialSecurityNumbers", "ssn"],
      sourcePages,
      requestedAction: "Please conduct a full reinvestigation of the identifying information on file and remove any Social Security number information that is inaccurate, incomplete, mixed, or not attributable to the consumer.",
      severity: "high",
      isAttorneyEscalation: true,
      evidence: {
        comparedFields: ["socialSecurityNumbers", "ssn"],
        scalarComparisons: socialSecurityNumbers.map((value, index) => ({
          label: `SSN variation ${index + 1}`,
          value,
        })),
      },
    }));
  }

  if (!intake) {
    return reasons;
  }

  const intakeName = canonicalIdentityText(intake.fullLegalName);
  const reportName = canonicalIdentityText(report.personalInfo.name || report.consumerName);
  if (intakeName && reportName && intakeName !== reportName) {
    reasons.push(buildReason({
      id: "personal-info-name-mismatch",
      bureau: report.bureau,
      profileId: report.profileId,
      component: "personalInformation",
      entityType: "personal_information",
      entityKey: "name",
      issueType: "personal_information_name_mismatch",
      issueLabel: "Name mismatch",
      reasonSummary: "The report is not reflecting the consumer's identifying name consistently with the identity information being provided for this dispute.",
      supportingFacts: [`Reported name: ${report.personalInfo.name}`, `Provided correct name: ${intake.fullLegalName}`],
      supportingFields: ["name"],
      sourcePages,
      requestedAction: "Please reinvestigate the identifying information section and delete or correct any name information that is inaccurate, incomplete, or not attributable to the consumer.",
      severity: "high",
    }));
  }

  const intakeAddress = canonicalIdentityText(
    [
      intake.mailingAddressLine1,
      intake.mailingAddressLine2,
      `${intake.mailingCity}, ${intake.mailingState} ${intake.mailingZip}`,
    ]
      .filter(Boolean)
      .join(" ")
  );
  const reportAddresses = [
    ...(report.personalInfo.currentAddresses ?? []),
    ...(report.personalInfo.previousAddresses ?? []),
    ...report.personalInfo.addresses,
  ].map(canonicalIdentityText);
  if (intakeAddress && reportAddresses.length > 0 && !reportAddresses.some((address) => address.includes(intakeAddress) || intakeAddress.includes(address))) {
    reasons.push(buildReason({
      id: "personal-info-address-mismatch",
      bureau: report.bureau,
      profileId: report.profileId,
      component: "personalInformation",
      entityType: "personal_information",
      entityKey: "mailing_address",
      issueType: "personal_information_address_mismatch",
      issueLabel: "Address mismatch",
      reasonSummary: "The report is not reflecting the consumer's current mailing address consistently with the identifying information provided for this dispute.",
      supportingFacts: [`Provided current mailing address: ${intakeAddress}`],
      supportingFields: ["addresses", "currentAddresses", "previousAddresses"],
      sourcePages,
      requestedAction: "Please reinvestigate the address information on file and delete or correct any address information that is inaccurate, incomplete, outdated, or not attributable to the consumer.",
      severity: "medium",
    }));
  }

  return reasons;
};

const sortReasons = (reasons: DisputeReason[]) =>
  reasons.sort((left, right) => {
    const severityRank = { high: 0, medium: 1, low: 2 } as const;
    const categoryRank: Record<DisputeReasonCategory, number> = {
      attorney_escalation: 0,
      payment_history: 1,
      balance_amount: 2,
      charge_off_collection: 3,
      legal_public_record: 4,
      date_reporting_timeline: 5,
      account_identity: 6,
      tradeline_integrity: 7,
      personal_information: 8,
      report_review: 9,
    };
    const severityDiff = severityRank[left.severity] - severityRank[right.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }
    const leftCategory = left.category ?? ISSUE_CATEGORY_MAP[left.issueType] ?? "report_review";
    const rightCategory = right.category ?? ISSUE_CATEGORY_MAP[right.issueType] ?? "report_review";
    const categoryDiff = categoryRank[leftCategory] - categoryRank[rightCategory];
    if (categoryDiff !== 0) {
      return categoryDiff;
    }
    return left.id.localeCompare(right.id);
  });

const statusLabelSortRank: Record<DisputeRuleStatus, number> = {
  triggered: 0,
  insufficient_evidence: 1,
  not_triggered: 2,
  not_applicable: 3,
};

const severitySortRank = { high: 0, medium: 1, low: 2 } as const;

const buildSelectionState = (status: DisputeRuleStatus, posture: AccountPosture, category: DisputeReasonCategory) => {
  const legalReviewCategory = category === "legal_public_record";
  const selectionBasis = legalReviewCategory
    ? "explicit"
    : posture === "negative"
      ? "negative_account"
      : "positive_account";
  if (status !== "triggered") {
    return {
      selectable: false,
      selected: false,
      defaultSelected: false,
      selectionBasis,
    };
  }

  const defaultSelected = legalReviewCategory || posture === "negative";
  return {
    selectable: true,
    selected: defaultSelected,
    defaultSelected,
    selectionBasis,
  };
};

const aggregateEvidence = (reasons: DisputeReason[]): DisputeReasonEvidence | undefined => {
  const comparedFields = uniqueStrings(reasons.flatMap((reason) => reason.evidence?.comparedFields ?? reason.supportingFields));
  const scalarComparisons = reasons
    .flatMap((reason) => reason.evidence?.scalarComparisons ?? [])
    .filter((entry, index, collection) => collection.findIndex((candidate) => `${candidate.label}:${candidate.value}` === `${entry.label}:${entry.value}`) === index)
    .slice(0, 12);
  const monthlyComparisons = reasons.flatMap((reason) => reason.evidence?.monthlyComparisons ?? []).slice(0, 24);

  if (!comparedFields.length && !scalarComparisons.length && !monthlyComparisons.length) {
    return undefined;
  }

  return {
    comparedFields: comparedFields.length ? comparedFields : undefined,
    scalarComparisons: scalarComparisons.length ? scalarComparisons : undefined,
    monthlyComparisons: monthlyComparisons.length ? monthlyComparisons : undefined,
  };
};

const buildEvaluationContext = (definition: AccountRuleDefinition, account: ReasonAccountView): Pick<DisputeRuleEvaluation, "supportingFields" | "supportingFacts" | "evidence"> => {
  switch (definition.issueType) {
    case "duplicate_conflicting_tradeline":
      return {
        supportingFields: ["accountNumber", "status", "balance"],
        supportingFacts: [`Masked account number: ${account.accountNumber || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Account number", value: account.accountNumber },
          { label: "Status", value: account.statusText },
          { label: "Balance", value: account.balanceValue },
        ]),
      };
    case "missing_account_number":
      return {
        supportingFields: ["accountNumber"],
        supportingFacts: [`Account number shown: ${account.accountNumber || "Not reported"}`],
        evidence: buildObservedValueEvidence([{ label: "Account number", value: account.accountNumber }]),
      };
    case "missing_furnisher_identification":
      return {
        supportingFields: ["address", "phoneNumber"],
        supportingFacts: [`Address: ${account.addressText || "Not reported"}`, `Phone: ${account.phoneText || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Furnisher address", value: account.addressText },
          { label: "Furnisher phone", value: account.phoneText },
        ]),
      };
    case "missing_account_status":
      return {
        supportingFields: ["status", "paymentHistory", "amountPastDue", "chargeOffAmount"],
        supportingFacts: [`Status: ${account.statusText || "Not reported"}`, `Amount past due: ${account.amountPastDueValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Status", value: account.statusText },
          { label: "Amount past due", value: account.amountPastDueValue },
          { label: "Charge-off amount", value: account.chargeOffAmountValue },
        ]),
      };
    case "account_in_litigation":
      return {
        supportingFields: ["status", "comments", "additionalInformation", "consumerStatement", "reinvestigationInfo", "legalCategory"],
        supportingFacts: [
          `Status: ${account.statusText || "Not reported"}`,
          `Additional information: ${account.additionalInformationLines.join("; ") || "Not reported"}`,
          `Consumer statement: ${account.consumerStatementLines.join("; ") || "Not reported"}`,
          `Reinvestigation info: ${account.reinvestigationInfoLines.join("; ") || "Not reported"}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Status", value: account.statusText },
          { label: "Comments", value: account.comments.join("; ") },
          { label: "Additional information", value: account.additionalInformationLines.join("; ") },
          { label: "Consumer statement", value: account.consumerStatementLines.join("; ") },
          { label: "Reinvestigation info", value: account.reinvestigationInfoLines.join("; ") },
          { label: "Legal category", value: account.legalCategoryText },
        ]),
      };
    case "payment_history_missing_months":
      return {
        supportingFields: ["paymentHistory"],
        supportingFacts: [`Payment-history months reviewed: ${account.monthsReviewedValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([{ label: "Months reviewed", value: account.monthsReviewedValue }]),
      };
    case "payment_history_incomplete_since_open_date":
      return {
        supportingFields: ["dateOpened", "paymentHistory"],
        supportingFacts: [
          `Date opened: ${account.dateOpenedValue || "Not reported"}`,
          `Payment-history months reviewed: ${account.monthsReviewedValue || "Not reported"}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Date opened", value: account.dateOpenedValue },
          { label: "Months reviewed", value: account.monthsReviewedValue },
        ]),
      };
    case "thirty_day_late_without_full_30_day_interval":
      return {
        supportingFields: ["paymentHistory", "lastPaymentDate", "actualPaymentHistory", "recentPayment", "balanceHistory", "dateReported", "statusUpdated", "balanceUpdated"],
        supportingFacts: [
          `Reported last payment date: ${account.lastPaymentDateValue || "Not reported"}`,
          `Reported date: ${account.dateReportedValue || "Not reported"}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Reported last payment date", value: account.lastPaymentDateValue },
          { label: "Recent payment", value: account.recentPaymentValue },
          { label: "Reported date", value: account.dateReportedValue },
          { label: "Status-updated date", value: account.statusUpdatedValue },
          { label: "Balance-updated date", value: account.balanceUpdatedValue },
        ]),
      };
    case "missing_payment_history":
    case "derogatory_status_without_monthly_support":
    case "delinquency_progression_inconsistency":
    case "severe_delinquency_jump_without_predecessor_support":
    case "reaging_jump_after_current_reset":
    case "first_30_day_late_without_prior_reporting_support":
    case "first_derogatory_month_without_prior_reporting_support":
    case "blank_gap_before_derogatory_month":
    case "retroactive_derogatory_backfill_after_reporting_gap":
    case "charge_off_or_collection_without_monthly_build_up":
      return {
        supportingFields: ["paymentHistory"],
        supportingFacts: [`Payment-history months reviewed: ${account.monthsReviewedValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([{ label: "Months reviewed", value: account.monthsReviewedValue }]),
      };
    case "payment_plan_or_forbearance_context_without_history":
    case "payment_plan_or_forbearance_context_with_derogatory_conflict":
      return {
        supportingFields: ["status", "comments", "paymentHistory"],
        supportingFacts: [`Status: ${account.statusText || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Status", value: account.statusText },
          { label: "Comments", value: account.comments.join("; ") },
        ]),
      };
    case "payment_activity_conflicts_with_delinquency_progression":
      return {
        supportingFields: ["paymentHistory", "actualPaymentHistory", "scheduledPaymentHistory", "lastPaymentDate", "recentPayment"],
        supportingFacts: [`Last payment date: ${account.lastPaymentDateValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Last payment date", value: account.lastPaymentDateValue },
          { label: "Recent payment", value: account.recentPaymentValue },
          { label: "Scheduled payment", value: account.scheduledPaymentAmountValue },
        ]),
      };
    case "balance_reduction_conflicts_with_worsening_delinquency":
      return {
        supportingFields: ["paymentHistory", "balanceHistory", "paymentAmount"],
        supportingFacts: [`Current balance: ${account.balanceValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Current balance", value: account.balanceValue },
          { label: "Monthly payment", value: account.paymentAmountValue },
        ]),
      };
    case "last_payment_date_without_scheduled_payment_amount":
      return {
        supportingFields: ["lastPaymentDate", "scheduledPaymentAmount"],
        supportingFacts: [
          `Reported last payment date field: ${account.reportedLastPaymentDateValue || "Not reported"}`,
          `Reported scheduled payment amount field: ${describeReportedScheduledPaymentAmount(account)}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Reported last payment date field", value: account.reportedLastPaymentDateValue },
          { label: "Reported scheduled payment amount field", value: describeReportedScheduledPaymentAmount(account) },
        ]),
      };
    case "last_payment_date_without_payment_amount":
      return {
        supportingFields: ["lastPaymentDate", "recentPayment", "actualPaymentAmount"],
        supportingFacts: [
          `Reported last payment date field: ${account.reportedLastPaymentDateValue || "Not reported"}`,
          `Reported recent/actual payment amount field: ${describeReportedPaymentAmount(account)}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Reported last payment date field", value: account.reportedLastPaymentDateValue },
          { label: "Reported recent/actual payment amount field", value: describeReportedPaymentAmount(account) },
        ]),
      };
    case "scheduled_payment_amount_without_terms":
      return {
        supportingFields: ["scheduledPaymentAmount", "terms", "termDuration"],
        supportingFacts: [
          `Reported scheduled payment amount field: ${describeReportedScheduledPaymentAmount(account)}`,
          `Reported terms field: ${account.termsFrequencyValue || "Not reported"}`,
          `Reported term duration field: ${account.termDurationValue || "Not reported"}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Reported scheduled payment amount field", value: describeReportedScheduledPaymentAmount(account) },
          { label: "Reported terms field", value: account.termsFrequencyValue },
          { label: "Reported term duration field", value: account.termDurationValue },
        ]),
      };
    case "closed_account_final_month_reporting_incomplete":
      return {
        supportingFields: ["dateClosed", "paymentHistory", "actualPaymentHistory", "lastPaymentDate", "recentPayment"],
        supportingFacts: [
          `Closure timing: ${account.closureTimingValue || "Not reported"}`,
          `Closure month: ${account.closureMonthKey ? formatHistoryMonth(account.closureMonthKey) : "Not reported"}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Closure timing", value: account.closureTimingValue },
          { label: "Closure month", value: account.closureMonthKey ? formatHistoryMonth(account.closureMonthKey) : "" },
          { label: "Closure-month payment history", value: account.closureMonthPaymentStatus },
          { label: "Closure-month actual payment table", value: account.closureMonthActualPaymentValue },
          { label: "Scalar last-payment signal", value: account.lastPaymentSignalValue },
        ]),
      };
    case "closed_account_actual_payment_conflicts_with_closure_month_history":
      return {
        supportingFields: ["dateClosed", "actualPaymentAmount", "recentPayment", "actualPaymentHistory"],
        supportingFacts: [
          `Closure timing: ${account.closureTimingValue || "Not reported"}`,
          `Closure-month actual payment table: ${account.closureMonthActualPaymentValue || "Not reported"}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Closure timing", value: account.closureTimingValue },
          { label: "Closure month", value: account.closureMonthKey ? formatHistoryMonth(account.closureMonthKey) : "" },
          { label: "Scalar actual payment signal", value: account.lastPaymentSignalValue },
          { label: "Closure-month actual payment table", value: account.closureMonthActualPaymentValue },
        ]),
      };
    case "missing_current_balance_field":
      return {
        supportingFields: ["balance", "status", "amountPastDue", "chargeOffAmount"],
        supportingFacts: [
          `Current balance field: ${describeReportedCurrentBalance(account)}`,
          `Status: ${account.statusText || "Not reported"}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Current balance field", value: describeReportedCurrentBalance(account) },
          { label: "Status", value: account.statusText },
          { label: "Amount past due", value: account.amountPastDueValue },
          { label: "Charge-off amount", value: account.chargeOffAmountValue },
        ]),
      };
    case "monthly_payment_missing_for_open_installment":
      return {
        supportingFields: ["paymentAmount", "accountType", "terms"],
        supportingFacts: [`Account type: ${account.accountTypeText || "Not reported"}`, `Monthly payment: ${account.paymentAmountValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Account type", value: account.accountTypeText },
          { label: "Monthly payment", value: account.paymentAmountValue },
          { label: "Terms", value: account.termDurationValue || account.termsFrequencyValue },
        ]),
      };
    case "recent_payment_missing_when_history_implies_payment":
      return {
        supportingFields: ["lastPaymentDate", "recentPayment", "paymentHistory"],
        supportingFacts: [`Last payment date: ${account.lastPaymentDateValue || "Not reported"}`, `Recent payment: ${account.recentPaymentValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Last payment date", value: account.lastPaymentDateValue },
          { label: "Recent payment", value: account.recentPaymentValue },
        ]),
      };
    case "payment_history_24_month_past_due_conflict":
    case "amount_past_due_history_conflict":
    case "past_due_without_monthly_support":
      return {
        supportingFields: ["paymentHistory", "amountPastDue", "amountPastDueHistory"],
        supportingFacts: [`Amount past due: ${account.amountPastDueValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([{ label: "Amount past due", value: account.amountPastDueValue }]),
      };
    case "payment_history_24_month_activity_conflict":
      return {
        supportingFields: ["paymentHistory", "month24History"],
        supportingFacts: ["24-month activity fields were compared to the payment-history timeline."],
        evidence: buildObservedValueEvidence([{ label: "Months reviewed", value: account.monthsReviewedValue }]),
      };
    case "payment_history_balance_history_conflict":
    case "balance_history_monthly_gap_conflict":
    case "insufficient_balance_history":
      return {
        supportingFields: ["paymentHistory", "balanceHistory", "paymentAmount"],
        supportingFacts: [`Current balance: ${account.balanceValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Current balance", value: account.balanceValue },
          { label: "Payment amount", value: account.paymentAmountValue },
        ]),
      };
    case "high_balance_not_supported_by_history":
      return {
        supportingFields: ["highestBalance", "balanceHistory"],
        supportingFacts: [`High balance: ${account.highestBalanceValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "High balance", value: account.highestBalanceValue },
          { label: "Current balance", value: account.balanceValue },
        ]),
      };
    case "credit_limit_not_supported_by_history":
      return {
        supportingFields: ["creditLimit", "creditLimitHistory"],
        supportingFacts: [`Credit limit: ${account.creditLimitValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([{ label: "Credit limit", value: account.creditLimitValue }]),
      };
    case "charge_off_without_chargeoff_history":
    case "collection_payment_activity_conflict":
      return {
        supportingFields: ["status", "paymentHistory", "comments"],
        supportingFacts: [`Status: ${account.statusText || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Status", value: account.statusText },
          { label: "Comments", value: account.comments.join("; ") },
        ]),
      };
    case "incomplete_original_creditor_identity":
    case "student_loan_lender_identity_mismatch":
      return {
        supportingFields: ["originalCreditorName", "accountType", "status"],
        supportingFacts: [`Original creditor: ${account.originalCreditorText || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Original creditor", value: account.originalCreditorText },
          { label: "Account type", value: account.accountTypeText },
        ]),
      };
    case "responsibility_requires_special_handling":
      return {
        supportingFields: ["responsibility"],
        supportingFacts: [`Responsibility: ${account.responsibilityText || "Not reported"}`],
        evidence: buildObservedValueEvidence([{ label: "Responsibility", value: account.responsibilityText }]),
      };
    case "date_of_first_delinquency_conflict":
    case "on_record_until_conflict":
      return {
        supportingFields: ["dateOfFirstDelinquency", "estimatedRemoval"],
        supportingFacts: [`Date of first delinquency: ${account.dateOfFirstDelinquencyValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Date of first delinquency", value: account.dateOfFirstDelinquencyValue },
          { label: "Estimated removal", value: account.estimatedRemovalValue },
        ]),
      };
    case "closed_account_missing_closure_timing":
      return {
        supportingFields: ["dateClosed", "statusUpdated", "balanceUpdated", "status"],
        supportingFacts: [`Reported closed date: ${account.dateClosedValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([
          { label: "Reported closed date", value: account.dateClosedValue },
          { label: "Reported status-updated date", value: account.statusUpdatedValue },
          { label: "Reported balance-updated date", value: account.balanceUpdatedValue },
          { label: "Reported status", value: account.statusText },
        ]),
      };
    case "status_updated_timeline_conflict":
    case "missing_status_updated_date":
      return {
        supportingFields: ["statusUpdated", "paymentHistory"],
        supportingFacts: [`Status-updated date: ${account.statusUpdatedValue || "Not reported"}`],
        evidence: buildObservedValueEvidence([{ label: "Status-updated date", value: account.statusUpdatedValue }]),
      };
    case "balance_updated_timeline_conflict":
    case "missing_balance_updated_date":
      return {
        supportingFields: ["balanceUpdated", "balanceHistory"],
        supportingFacts: [
          `Reported current balance field: ${describeReportedCurrentBalance(account)}`,
          `Balance-updated date: ${account.balanceUpdatedValue || "Not reported"}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Reported current balance field", value: describeReportedCurrentBalance(account) },
          { label: "Balance-updated date", value: account.balanceUpdatedValue },
        ]),
      };
    case "missing_reporting_date":
      return {
        supportingFields: ["dateReported", "balance", "status"],
        supportingFacts: [
          `Reported current balance field: ${describeReportedCurrentBalance(account)}`,
          `Reported date: ${account.dateReportedValue || "Not reported"}`,
        ],
        evidence: buildObservedValueEvidence([
          { label: "Reported current balance field", value: describeReportedCurrentBalance(account) },
          { label: "Reported date", value: account.dateReportedValue },
        ]),
      };
    default:
      return {
        supportingFields: [],
        supportingFacts: [],
        evidence: buildObservedValueEvidence([
          { label: "Status", value: account.statusText },
          { label: "Balance", value: account.balanceValue },
        ]),
      };
  }
};

const aggregateTriggeredEvaluation = (
  definition: AccountRuleDefinition,
  reasons: DisputeReason[],
  posture: AccountPosture,
): DisputeRuleEvaluation => {
  const highestSeverity = [...reasons].sort((left, right) => severitySortRank[left.severity] - severitySortRank[right.severity])[0]?.severity ?? "medium";
  const explanation = uniqueStrings(reasons.map((reason) => reason.reasonSummary)).join(" ");
  const supportingFacts = uniqueStrings(reasons.flatMap((reason) => reason.supportingFacts)).slice(0, 12);
  const supportingFields = uniqueStrings(reasons.flatMap((reason) => reason.supportingFields));
  const evidenceRefs = dedupeEvidenceRefs(reasons.flatMap((reason) => reason.evidenceRefs ?? []));
  const sourcePages = normalizePages(reasons.flatMap((reason) => reason.sourcePages));
  const selectionState = buildSelectionState("triggered", posture, definition.category);

  return {
    key: `${definition.issueType}:${reasons[0]?.entityKey ?? "account"}`,
    ruleId: definition.ruleId ?? definition.issueType,
    issueType: definition.issueType,
    issueLabel: reasons[0]?.issueLabel ?? definition.issueLabel,
    category: definition.category,
    status: "triggered",
    explanation: explanation || definition.description,
    severity: highestSeverity,
    supportingFacts,
    supportingFields,
    evidence: aggregateEvidence(reasons),
    evidenceRefs,
    sourcePages,
    requestedAction: reasons[0]?.requestedAction,
    operatorNotes: reasons[0]?.operatorNotes,
    ...selectionState,
  };
};

const buildPassiveEvaluation = (
  definition: AccountRuleDefinition,
  status: DisputeRuleStatus,
  posture: AccountPosture,
  account: ReasonAccountView,
): DisputeRuleEvaluation => {
  const selectionState = buildSelectionState(status, posture, definition.category);
  const context = buildEvaluationContext(definition, account);
  const statusPrefix =
    status === "not_triggered"
      ? "Clear"
      : status === "insufficient_evidence"
        ? "Not available"
        : "Not applicable";

  return {
    key: `${definition.issueType}:${account.entityKey}`,
    ruleId: definition.ruleId ?? definition.issueType,
    issueType: definition.issueType,
    issueLabel: definition.issueLabel,
    category: definition.category,
    status,
    explanation: `${statusPrefix}: ${definition.description}`,
    severity: undefined,
    supportingFacts: context.supportingFacts,
    supportingFields: context.supportingFields,
    evidence: context.evidence,
    evidenceRefs: [],
    sourcePages: account.sourcePages,
    requestedAction: undefined,
    operatorNotes: "",
    ...selectionState,
  };
};

const buildAccountReasonFromEvaluation = (
  report: CreditReport,
  entityKey: string,
  evaluation: DisputeRuleEvaluation,
): DisputeReason => buildReason({
  id: `${evaluation.ruleId}:${entityKey}`,
  bureau: report.bureau,
  profileId: report.profileId,
  component: "accounts",
  entityType: "account",
  entityKey,
  issueType: evaluation.issueType,
  issueLabel: evaluation.issueLabel,
  reasonSummary: evaluation.explanation,
  supportingFacts: evaluation.supportingFacts,
  supportingFields: evaluation.supportingFields,
  sourcePages: evaluation.sourcePages,
  requestedAction: evaluation.requestedAction ?? "Please conduct a full reinvestigation and correct or delete any reporting that cannot be verified as complete and accurate.",
  severity: evaluation.severity ?? "medium",
  category: evaluation.category,
  defaultSelected: evaluation.defaultSelected,
  selectionBasis: evaluation.selectionBasis,
  selected: evaluation.selected,
  evidence: evaluation.evidence,
  evidenceRefs: evaluation.evidenceRefs,
  operatorNotes: evaluation.operatorNotes,
});

const isCompleteManualAccountReason = (reason: ManualAccountReason) =>
  Boolean(normalizeText(reason.issueLabel) && normalizeText(reason.reasonSummary));

const buildManualAccountReason = (
  report: CreditReport,
  account: ReasonAccountView | undefined,
  reason: ManualAccountReason,
): DisputeReason => buildReason({
  id: reason.id,
  bureau: report.bureau,
  profileId: report.profileId,
  component: "accounts",
  entityType: "account",
  entityKey: reason.entityKey,
  issueType: "manual_account_reason",
  issueLabel: reason.issueLabel,
  reasonSummary: reason.reasonSummary,
  supportingFacts: reason.operatorNotes ? [`Operator note: ${reason.operatorNotes}`] : [],
  supportingFields: [],
  sourcePages: reason.sourcePages.length > 0 ? normalizePages(reason.sourcePages) : normalizePages(account?.sourcePages),
  requestedAction: "Please conduct a full reinvestigation and correct or delete any reporting that cannot be verified as complete and accurate.",
  severity: "medium",
  category: reason.category,
  defaultSelected: reason.selected,
  selectionBasis: "explicit",
  selected: reason.selected,
  evidenceRefs: [],
  operatorNotes: reason.operatorNotes,
});

export const generateNonAccountReasons = (report: CreditReport, intake?: DisputeLetterIntake): DisputeReason[] => {
  const accountViews = buildAccountViews(report);
  const postureByEntityKey = buildAccountPostureMap(accountViews, report);
  const reasons = [
    ...detectPersonalInformationReasons(report, intake),
    ...detectPublicRecordReasons(report),
    ...detectConsumerInformationIndicatorReasons(report),
  ];
  if (!reasons.length) {
    return [];
  }
  return sortReasons(applyReasonDefaults(reasons, postureByEntityKey));
};

export const generateAccountRuleCatalog = (report: CreditReport): AccountRuleCatalogGroup[] => {
  const accountViews = buildAccountViews(report);
  const postureByEntityKey = buildAccountPostureMap(accountViews, report);
  const rawReasons = sortReasons(
    applyReasonDefaults(
      [
        ...detectAccountReasons(accountViews, report),
        ...detectDuplicateTradelines(accountViews, report),
      ],
      postureByEntityKey,
    ),
  );
  const triggeredByAccount = new Map<string, Map<string, DisputeReason[]>>();

  for (const reason of rawReasons.filter((entry) => entry.entityType === "account")) {
    const byIssueType = triggeredByAccount.get(reason.entityKey) ?? new Map<string, DisputeReason[]>();
    const existing = byIssueType.get(reason.issueType) ?? [];
    existing.push(reason);
    byIssueType.set(reason.issueType, existing);
    triggeredByAccount.set(reason.entityKey, byIssueType);
  }

  return accountViews.map((account) => {
    const byIssueType = triggeredByAccount.get(account.entityKey) ?? new Map<string, DisputeReason[]>();
    const entries: DisputeRuleEvaluation[] = [];
    const posture = postureByEntityKey.get(account.entityKey) ?? "negative";

    for (const definition of ACCOUNT_RULE_DEFINITIONS) {
      const triggeredEntries = byIssueType.get(definition.issueType) ?? [];
      if (triggeredEntries.length > 0) {
        entries.push(aggregateTriggeredEvaluation(definition, sortReasons([...triggeredEntries]), posture));
        continue;
      }

      const applies = definition.applies(account, report);
      if (!applies) {
        entries.push(buildPassiveEvaluation(definition, "not_applicable", posture, account));
        continue;
      }

      const canEvaluate = definition.canEvaluate(account, report);
      entries.push(buildPassiveEvaluation(definition, canEvaluate ? "not_triggered" : "insufficient_evidence", posture, account));
    }

    const categories: AccountRuleCategoryGroup[] = ACCOUNT_RULE_CATEGORY_ORDER
      .map((category) => ({
        category,
        label: ACCOUNT_RULE_CATEGORY_LABELS[category],
        entries: entries
          .filter((entry) => entry.category === category)
          .sort((left, right) => {
            const statusDiff = statusLabelSortRank[left.status] - statusLabelSortRank[right.status];
            if (statusDiff !== 0) {
              return statusDiff;
            }
            return left.issueLabel.localeCompare(right.issueLabel);
          }),
      }))
      .filter((group) => group.entries.length > 0);

    return {
      key: `account:${account.entityKey}`,
      label: account.displayName.toUpperCase(),
      entityKey: account.entityKey,
      entityType: "account",
      accountPosture: posture,
      categories,
    };
  });
};

export const generateDisputeReasons = (
  report: CreditReport,
  intake?: DisputeLetterIntake,
  accountRuleCatalog: AccountRuleCatalogGroup[] = generateAccountRuleCatalog(report),
  nonAccountReasons: DisputeReason[] = generateNonAccountReasons(report, intake),
  manualAccountReasons: ManualAccountReason[] = [],
): DisputeReason[] => {
  const accountViews = buildAccountViews(report);
  const postureByEntityKey = buildAccountPostureMap(accountViews, report);
  const accountViewByEntityKey = new Map(accountViews.map((account) => [account.entityKey, account]));
  const accountReasons = accountRuleCatalog
    .flatMap((group) =>
      group.categories.flatMap((category) =>
        category.entries
          .filter((entry) => entry.status === "triggered" && entry.selected)
          .map((entry) => buildAccountReasonFromEvaluation(report, group.entityKey, entry)),
      ),
    );
  const manualReasons = manualAccountReasons
    .filter((reason) => reason.selected && isCompleteManualAccountReason(reason))
    .map((reason) => buildManualAccountReason(report, accountViewByEntityKey.get(reason.entityKey), reason));
  const reasons = [...accountReasons, ...manualReasons, ...nonAccountReasons];

  const seen = new Set<string>();
  const filtered = reasons.filter((reason) => {
    if (seen.has(reason.id)) {
      return false;
    }
    seen.add(reason.id);
    return true;
  });

  if (filtered.length > 0) {
    return sortReasons(applyReasonDefaults(filtered, postureByEntityKey));
  }

  return [
    applyReasonDefaults([
      buildReason({
      id: `report-review:${report.reportId ?? report.fileName ?? report.bureau}`,
      bureau: report.bureau,
      profileId: report.profileId,
      component: "report",
      entityType: "report",
      entityKey: report.reportId ?? report.fileName ?? report.bureau,
      issueType: "report_review_request",
      issueLabel: "Report review requested",
      reasonSummary: "The enclosed credit report contains disputed information that should be reinvestigated for completeness and accuracy.",
      supportingFacts: ["Please review the enclosed marked report pages and reinvestigate the disputed information identified in this letter."],
      supportingFields: [],
      sourcePages: [],
      requestedAction: "Please conduct a full and thorough reinvestigation of the enclosed disputed information and provide an updated file disclosure.",
      severity: "medium",
      }),
    ], postureByEntityKey)[0],
  ];
};
