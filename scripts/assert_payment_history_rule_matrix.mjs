import assert from "node:assert/strict";
import { generateAccountRuleCatalog } from "../src/features/dispute-letters/reasonEngine.ts";

const blankYear = {
  jan: "",
  feb: "",
  mar: "",
  apr: "",
  may: "",
  jun: "",
  jul: "",
  aug: "",
  sep: "",
  oct: "",
  nov: "",
  dec: "",
};

const buildHistoryRow = (year, overrides = {}) => ({
  year,
  ...blankYear,
  ...overrides,
});

const buildReport = ({
  paymentHistory,
  paymentHistoryYears = ["2023"],
  actualPaymentHistory = [],
  balanceHistory = [],
  comments = [],
  status = "Open",
  dateOpened = "01/01/2022",
  accountType = "Installment Loan",
  monthsReviewed = "",
  balance = "$1000",
  omitBalance = false,
  actualPaymentAmount = "",
  scheduledPaymentAmount = "",
  termDuration = "",
  termsFrequency = "",
  paymentAmount = "$100",
  recentPayment = "",
  lastPaymentDate = "",
  dateClosed = "",
  dateReported = "",
  accountIsClosed = false,
}) => ({
  bureau: "Equifax",
  profileId: "equifax_old_v1",
  reportDate: "2026-03-10",
  personalInfo: {
    name: "Test Consumer",
    addresses: ["123 Main St"],
  },
  accounts: [
    {
      accountName: "Synthetic Account",
      accountNumber: "123456789",
      accountType,
      status,
      openDate: dateOpened,
      dateOpened,
      ...(monthsReviewed ? { monthsReviewed } : {}),
      ...(!omitBalance ? { balance } : {}),
      ...(actualPaymentAmount ? { actualPaymentAmount } : {}),
      ...(scheduledPaymentAmount ? { scheduledPaymentAmount } : {}),
      ...(termDuration ? { termDuration } : {}),
      ...(termsFrequency ? { termsFrequency } : {}),
      paymentAmount,
      recentPayment,
      lastPaymentDate,
      ...(dateClosed ? { dateClosed } : {}),
      ...(dateReported ? { dateReported } : {}),
      ...(accountIsClosed ? { isClosed: true } : {}),
      paymentHistory,
      paymentHistoryYears,
      actualPaymentHistory,
      balanceHistory,
      comments,
      sourcePages: [1],
    },
  ],
  inquiries: [],
  publicRecords: [],
  creditScores: [],
  rawText: "",
  sourceComponents: {
    accounts: {
      pages: [1],
    },
  },
});

const buildExperianReport = ({
  paymentHistoryRows,
  balanceHistories = [],
  status = "Open",
  dateOpened = "01/01/2022",
  dateClosed = "",
  recentPayment = "",
  lastPaymentDate = "",
  monthlyPayment = "",
}) => ({
  bureau: "Experian",
  profileId: "experian_acr_v1",
  reportDate: "2026-03-10",
  personalInfo: {
    name: "Test Consumer",
    addresses: ["123 Main St"],
  },
  components: {
    accounts: {
      accounts: [
        {
          header: {
            accountName: "Synthetic Account",
            accountNumber: "123456789",
          },
          accountInfo: {
            status,
            dateOpened,
            ...(dateClosed ? { dateClosed } : {}),
            ...(recentPayment ? { recentPayment } : {}),
            ...(lastPaymentDate ? { lastPaymentDate } : {}),
            ...(monthlyPayment ? { monthlyPayment } : {}),
          },
          paymentHistory: {
            rows: paymentHistoryRows,
          },
          balanceHistories,
          sourcePages: [1],
        },
      ],
    },
  },
  accounts: [],
  inquiries: [],
  publicRecords: [],
  creditScores: [],
  rawText: "",
  sourceComponents: {
    accounts: {
      pages: [1],
    },
  },
});

const buildEquifaxNewReport = ({
  paymentHistoryRows,
  month24Sections = [],
  status = "Open",
  dateOpened = "01/01/2022",
  dateReported = "",
  dateClosed = "",
  actualPaymentAmount = "",
  scheduledPaymentAmount = "",
}) => ({
  bureau: "Equifax",
  profileId: "equifax_new_v1",
  reportDate: "2026-03-10",
  personalInfo: {
    name: "Test Consumer",
    addresses: ["123 Main St"],
  },
  components: {
    accounts: {
      accounts: [
        {
          accountName: "Synthetic Account",
          accountNumber: "123456789",
          status,
          dateOpened,
          ...(dateReported ? { dateReported } : {}),
          ...(dateClosed ? { dateClosed } : {}),
          ...(actualPaymentAmount ? { actualPaymentAmount } : {}),
          ...(scheduledPaymentAmount ? { scheduledPaymentAmount } : {}),
          paymentHistory: paymentHistoryRows,
          month24History: {
            sections: month24Sections,
          },
          sourcePages: [1],
        },
      ],
    },
  },
  accounts: [],
  inquiries: [],
  publicRecords: [],
  creditScores: [],
  rawText: "",
  sourceComponents: {
    accounts: {
      pages: [1],
    },
  },
});

const buildTransunionReport = ({
  paymentHistoryRows,
  balanceHistories = [],
  payStatus = "Open",
  dateOpened = "01/01/2022",
  dateUpdated = "",
  lastPaymentMade = "",
  paymentReceived = "",
  monthlyPayment = "",
}) => ({
  bureau: "TransUnion",
  profileId: "transunion_acr_v1",
  reportDate: "2026-03-10",
  personalInfo: {
    name: "Test Consumer",
    addresses: ["123 Main St"],
  },
  components: {
    adverseAccounts: {
      accounts: [
        {
          accountName: "Synthetic Account",
          accountNumber: "123456789",
          accountInfo: {
            payStatus,
            dateOpened,
            ...(dateUpdated ? { dateUpdated } : {}),
            ...(lastPaymentMade ? { lastPaymentMade } : {}),
            ...(paymentReceived ? { paymentReceived } : {}),
            ...(monthlyPayment ? { monthlyPayment } : {}),
          },
          paymentHistory: paymentHistoryRows,
          balanceHistories,
          sourcePages: [1],
        },
      ],
    },
    satisfactoryAccounts: {
      accounts: [],
    },
  },
  accounts: [],
  inquiries: [],
  publicRecords: [],
  creditScores: [],
  rawText: "",
  sourceComponents: {
    adverseAccounts: {
      pages: [1],
    },
    satisfactoryAccounts: {
      pages: [],
    },
  },
});

const getRuleStatus = (report, issueType) => {
  const catalog = generateAccountRuleCatalog(report);
  assert.equal(catalog.length, 1, "expected one synthetic account group");
  const entry = catalog[0].categories.flatMap((category) => category.entries).find((candidate) => candidate.issueType === issueType);
  assert.ok(entry, `missing rule definition for ${issueType}`);
  return entry;
};

const okToSixtyReport = buildReport({
  paymentHistory: ["OK", "60", "", "", "", "", "", "", "", "", "", ""],
});
assert.equal(
  getRuleStatus(okToSixtyReport, "severe_delinquency_jump_without_predecessor_support").status,
  "triggered",
  "OK -> 60 should trigger a severe delinquency jump reason",
);

const reagingReport = buildReport({
  paymentHistory: ["30", "OK", "90", "", "", "", "", "", "", "", "", ""],
});
assert.equal(
  getRuleStatus(reagingReport, "reaging_jump_after_current_reset").status,
  "triggered",
  "30 -> OK -> 90 should trigger the re-aging jump reason",
);

const downwardRegressionReport = buildReport({
  paymentHistory: ["30", "60", "30", "", "", "", "", "", "", "", "", ""],
});
assert.equal(
  getRuleStatus(downwardRegressionReport, "delinquency_progression_inconsistency").status,
  "triggered",
  "30 -> 60 -> 30 should stay under delinquency progression inconsistency",
);

const resetThenThirtyReport = buildReport({
  paymentHistory: ["30", "60", "OK", "30", "", "", "", "", "", "", "", ""],
});
assert.equal(
  getRuleStatus(resetThenThirtyReport, "delinquency_progression_inconsistency").status,
  "not_triggered",
  "30 -> 60 -> OK -> 30 should clear the delinquency progression rule",
);

const twentyEightDayThirtyLateReport = buildReport({
  paymentHistory: ["", "", "30", "", "", "", "", "", "", "", "", ""],
  dateReported: "03/28/2023",
  lastPaymentDate: "02/28/2023",
});
assert.equal(
  getRuleStatus(twentyEightDayThirtyLateReport, "thirty_day_late_without_full_30_day_interval").status,
  "triggered",
  "A 30-day late supported by only a 28-day interval should trigger",
);

const twentyNineDayThirtyLateReport = buildReport({
  paymentHistory: ["", "30", "", "", "", "", "", "", "", "", "", ""],
  paymentHistoryYears: ["2024"],
  dateReported: "02/29/2024",
  lastPaymentDate: "01/31/2024",
});
assert.equal(
  getRuleStatus(twentyNineDayThirtyLateReport, "thirty_day_late_without_full_30_day_interval").status,
  "triggered",
  "A 30-day late supported by only a 29-day interval should trigger",
);

const fullThirtyDayIntervalReport = buildReport({
  paymentHistory: ["", "", "30", "", "", "", "", "", "", "", "", ""],
  dateReported: "03/30/2023",
  lastPaymentDate: "02/28/2023",
});
assert.equal(
  getRuleStatus(fullThirtyDayIntervalReport, "thirty_day_late_without_full_30_day_interval").status,
  "not_triggered",
  "A 30-day late with a full 30-day interval should clear",
);

const noTimingAnchorThirtyLateReport = buildReport({
  paymentHistory: ["", "", "30", "", "", "", "", "", "", "", "", ""],
  actualPaymentHistory: [buildHistoryRow("2023", { mar: "$125" })],
  balanceHistory: [buildHistoryRow("2023", { feb: "$1,000", mar: "$850" })],
});
assert.equal(
  getRuleStatus(noTimingAnchorThirtyLateReport, "thirty_day_late_without_full_30_day_interval").status,
  "insufficient_evidence",
  "A 30-day late with only balance or payment corroboration should stay not available",
);

const noThirtyLateReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  dateReported: "03/28/2023",
  lastPaymentDate: "02/28/2023",
});
assert.equal(
  getRuleStatus(noThirtyLateReport, "thirty_day_late_without_full_30_day_interval").status,
  "not_applicable",
  "Accounts without a 30-day-late month should treat the short-month rule as not applicable",
);

const firstThirtyReport = buildReport({
  paymentHistory: ["", "", "30", "", "", "", "", "", "", "", "", ""],
});
assert.equal(
  getRuleStatus(firstThirtyReport, "first_30_day_late_without_prior_reporting_support").status,
  "triggered",
  "A first 30-day late without prior support should trigger",
);

const blankGapReport = buildReport({
  paymentHistory: ["OK", "", "90", "", "", "", "", "", "", "", "", ""],
});
assert.equal(
  getRuleStatus(blankGapReport, "blank_gap_before_derogatory_month").status,
  "triggered",
  "A blank gap before 90 should trigger the blank-gap reason",
);

const openedDateGapReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  dateOpened: "01/01/2022",
});
assert.equal(
  getRuleStatus(openedDateGapReport, "payment_history_incomplete_since_open_date").status,
  "triggered",
  "Payment history that starts too late after the opened date should trigger",
);

const openedDateCoveredReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  paymentHistoryYears: ["2022"],
  dateOpened: "01/01/2022",
});
assert.equal(
  getRuleStatus(openedDateCoveredReport, "payment_history_incomplete_since_open_date").status,
  "not_triggered",
  "Payment history that begins in the opened-date period should clear the opened-date coverage rule",
);

const studentLoanExtendedGapReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  paymentHistoryYears: ["2018"],
  dateOpened: "01/01/2014",
  accountType: "Student Loan",
  monthsReviewed: "120",
});
assert.equal(
  getRuleStatus(studentLoanExtendedGapReport, "payment_history_incomplete_since_open_date").status,
  "triggered",
  "A student-loan tradeline with a reviewed timeline longer than 84 months should require the longer opened-date coverage",
);

const studentLoanExtendedCoveredReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  paymentHistoryYears: ["2016"],
  dateOpened: "01/01/2014",
  accountType: "Student Loan",
  monthsReviewed: "120 months",
});
assert.equal(
  getRuleStatus(studentLoanExtendedCoveredReport, "payment_history_incomplete_since_open_date").status,
  "not_triggered",
  "A student-loan tradeline should clear when the longer reviewed timeline is actually covered",
);

const chargeOffWithoutBuildUpReport = buildReport({
  paymentHistory: ["OK", "CO", "", "", "", "", "", "", "", "", "", ""],
  status: "Charge off",
});
assert.equal(
  getRuleStatus(chargeOffWithoutBuildUpReport, "charge_off_or_collection_without_monthly_build_up").status,
  "triggered",
  "Charge-off reporting without buildup should trigger",
);

const paymentPlanWithoutHistoryReport = buildReport({
  paymentHistory: Array(12).fill(""),
  comments: ["Account in forbearance plan"],
});
assert.equal(
  getRuleStatus(paymentPlanWithoutHistoryReport, "payment_plan_or_forbearance_context_without_history").status,
  "triggered",
  "Forbearance context with missing history should trigger",
);

const paymentPlanConflictReport = buildReport({
  paymentHistory: ["OK", "90", "", "", "", "", "", "", "", "", "", ""],
  comments: ["Repayment plan"],
});
assert.equal(
  getRuleStatus(paymentPlanConflictReport, "payment_plan_or_forbearance_context_with_derogatory_conflict").status,
  "triggered",
  "Repayment-plan context with a severe jump should trigger the plan-conflict reason",
);

const paymentAndBalanceConflictReport = buildReport({
  paymentHistory: ["30", "90", "", "", "", "", "", "", "", "", "", ""],
  actualPaymentHistory: [buildHistoryRow("2023", { feb: "$125" })],
  balanceHistory: [buildHistoryRow("2023", { jan: "$1,000", feb: "$820" })],
  lastPaymentDate: "02/15/2023",
  recentPayment: "$125",
});
assert.equal(
  getRuleStatus(paymentAndBalanceConflictReport, "payment_activity_conflicts_with_delinquency_progression").status,
  "triggered",
  "Payment activity alongside a worsening delinquency jump should trigger",
);
assert.equal(
  getRuleStatus(paymentAndBalanceConflictReport, "balance_reduction_conflicts_with_worsening_delinquency").status,
  "triggered",
  "Balance reduction alongside a worsening delinquency jump should trigger",
);

const missingBalanceFieldReport = buildReport({
  paymentHistory: ["30", "60", "", "", "", "", "", "", "", "", "", ""],
  status: "120 days past due",
  omitBalance: true,
});
assert.equal(
  getRuleStatus(missingBalanceFieldReport, "missing_current_balance_field").status,
  "triggered",
  "A derogatory tradeline with no current balance field should trigger the missing-balance-field reason",
);

const explicitBalanceFieldReport = buildReport({
  paymentHistory: ["30", "60", "", "", "", "", "", "", "", "", "", ""],
  status: "120 days past due",
  balance: "Not reported",
});
assert.equal(
  getRuleStatus(explicitBalanceFieldReport, "missing_current_balance_field").status,
  "not_triggered",
  "A present balance field reported as Not reported should not trigger the missing-balance-field reason",
);

const missingScheduledPaymentReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  lastPaymentDate: "02/15/2023",
});
assert.equal(
  getRuleStatus(missingScheduledPaymentReport, "last_payment_date_without_scheduled_payment_amount").status,
  "triggered",
  "A reported last payment date without a scheduled payment amount should trigger",
);

const presentScheduledPaymentReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  lastPaymentDate: "02/15/2023",
  scheduledPaymentAmount: "$75",
});
assert.equal(
  getRuleStatus(presentScheduledPaymentReport, "last_payment_date_without_scheduled_payment_amount").status,
  "not_triggered",
  "A reported scheduled payment amount should clear the last-payment-date comparison rule",
);

const missingPaymentAmountReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  lastPaymentDate: "02/15/2023",
});
assert.equal(
  getRuleStatus(missingPaymentAmountReport, "last_payment_date_without_payment_amount").status,
  "triggered",
  "A reported last payment date without a recent or actual payment amount should trigger",
);

const presentPaymentAmountReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  lastPaymentDate: "02/15/2023",
  actualPaymentAmount: "$75",
});
assert.equal(
  getRuleStatus(presentPaymentAmountReport, "last_payment_date_without_payment_amount").status,
  "not_triggered",
  "A reported recent or actual payment amount should clear the last-payment-date payment-amount rule",
);

const missingTermsReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  scheduledPaymentAmount: "$75",
});
assert.equal(
  getRuleStatus(missingTermsReport, "scheduled_payment_amount_without_terms").status,
  "triggered",
  "A reported scheduled payment amount without terms should trigger",
);

const presentTermsReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  scheduledPaymentAmount: "$75",
  termDuration: "36 months",
  termsFrequency: "Monthly",
});
assert.equal(
  getRuleStatus(presentTermsReport, "scheduled_payment_amount_without_terms").status,
  "not_triggered",
  "Reported terms should clear the scheduled-payment-to-terms rule",
);

const experianThirtyLateReport = buildExperianReport({
  paymentHistoryRows: [buildHistoryRow("2023", { jan: "OK", feb: "30" })],
  balanceHistories: [
    { date: "01/31/2023", paid: "$100" },
    { date: "02/28/2023", paid: "$100" },
  ],
});
assert.equal(
  getRuleStatus(experianThirtyLateReport, "thirty_day_late_without_full_30_day_interval").status,
  "triggered",
  "Experian dated paid-history entries should support the short-month 30-day-late rule",
);

const equifaxNewThirtyLateReport = buildEquifaxNewReport({
  paymentHistoryRows: [buildHistoryRow("2023", { jan: "OK", feb: "30" })],
  month24Sections: [
    {
      key: "lastPaymentDate",
      rows: [buildHistoryRow("2023", { jan: "01/31/2023", feb: "02/28/2023" })],
    },
    {
      key: "paymentAmount",
      rows: [buildHistoryRow("2023", { jan: "$100", feb: "$100" })],
    },
  ],
});
assert.equal(
  getRuleStatus(equifaxNewThirtyLateReport, "thirty_day_late_without_full_30_day_interval").status,
  "triggered",
  "New Equifax 24-month last-payment-date fields should support the short-month 30-day-late rule",
);

const transunionThirtyLateReport = buildTransunionReport({
  paymentHistoryRows: [buildHistoryRow("2023", { mar: "30" })],
  dateUpdated: "03/28/2023",
  lastPaymentMade: "02/28/2023",
  paymentReceived: "$100",
  balanceHistories: [
    {
      label: "Amount Paid",
      rows: [buildHistoryRow("2023", { feb: "$100", mar: "$100" })],
    },
  ],
});
assert.equal(
  getRuleStatus(transunionThirtyLateReport, "thirty_day_late_without_full_30_day_interval").status,
  "triggered",
  "TransUnion last-payment and update timing should support the short-month 30-day-late rule",
);

const closedMissingTimingReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  status: "Closed",
  accountIsClosed: true,
});
assert.equal(
  getRuleStatus(closedMissingTimingReport, "closed_account_missing_closure_timing").status,
  "triggered",
  "A closed tradeline without closure timing should trigger",
);

const closedBlankClosureMonthReport = buildReport({
  paymentHistory: ["OK", "", "", "", "", "", "", "", "", "", "", ""],
  status: "Closed",
  accountIsClosed: true,
  dateClosed: "02/15/2023",
});
assert.equal(
  getRuleStatus(closedBlankClosureMonthReport, "closed_account_final_month_reporting_incomplete").status,
  "triggered",
  "A closed tradeline with a blank closure-month payment-history entry should trigger",
);

const closedLastPaymentWithoutTableActivityReport = buildReport({
  paymentHistory: ["OK", "", "", "", "", "", "", "", "", "", "", ""],
  status: "Closed",
  accountIsClosed: true,
  dateClosed: "02/15/2023",
  lastPaymentDate: "02/12/2023",
});
assert.equal(
  getRuleStatus(closedLastPaymentWithoutTableActivityReport, "closed_account_final_month_reporting_incomplete").status,
  "triggered",
  "A scalar last-payment signal without closure-month table activity should trigger",
);

const closedCoherentFinalMonthReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  actualPaymentHistory: [buildHistoryRow("2023", { feb: "$125" })],
  status: "Closed",
  accountIsClosed: true,
  dateClosed: "02/15/2023",
  actualPaymentAmount: "$125",
});
assert.equal(
  getRuleStatus(closedCoherentFinalMonthReport, "closed_account_final_month_reporting_incomplete").status,
  "not_triggered",
  "A closed tradeline with closure-month history should clear the final-month rule",
);
assert.equal(
  getRuleStatus(closedCoherentFinalMonthReport, "closed_account_actual_payment_conflicts_with_closure_month_history").status,
  "not_triggered",
  "Matching scalar and closure-month actual payment amounts should clear the closed-account actual-payment rule",
);

const closedActualPaymentConflictReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  actualPaymentHistory: [buildHistoryRow("2023", { feb: "$80" })],
  status: "Closed",
  accountIsClosed: true,
  dateClosed: "02/15/2023",
  actualPaymentAmount: "$125",
});
assert.equal(
  getRuleStatus(closedActualPaymentConflictReport, "closed_account_actual_payment_conflicts_with_closure_month_history").status,
  "triggered",
  "A mismatch between scalar and closure-month actual payment amounts should trigger",
);

const closedScheduledOnlyMismatchReport = buildReport({
  paymentHistory: ["OK", "OK", "", "", "", "", "", "", "", "", "", ""],
  actualPaymentHistory: [buildHistoryRow("2023", { feb: "$125" })],
  status: "Closed",
  accountIsClosed: true,
  dateClosed: "02/15/2023",
  actualPaymentAmount: "$125",
  scheduledPaymentAmount: "$180",
});
assert.equal(
  getRuleStatus(closedScheduledOnlyMismatchReport, "closed_account_actual_payment_conflicts_with_closure_month_history").status,
  "not_triggered",
  "A scheduled-payment difference alone should not trigger the closed-account actual-payment conflict rule",
);

console.log("Payment-history rule matrix assertions passed.");
