import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { buildDefaultIntake } from "../src/features/dispute-letters/defaults.ts";
import { generateAccountRuleCatalog, generateDisputeReasons, generateNonAccountReasons } from "../src/features/dispute-letters/reasonEngine.ts";
import { mapWorkerResultToCreditReport } from "../server/resultMapper.mjs";

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const BLANK_PAYMENT_VALUES = new Set(["", "ND", "X", "-", "--"]);
const TARGET_ISSUES = new Set([
  "payment_history_missing_months",
  "recent_payment_missing_when_history_implies_payment",
  "delinquency_progression_inconsistency",
  "severe_delinquency_jump_without_predecessor_support",
  "reaging_jump_after_current_reset",
  "retroactive_derogatory_backfill_after_reporting_gap",
  "payment_activity_conflicts_with_delinquency_progression",
]);

const DEFAULT_REPORT_PATHS = [
  path.resolve(process.cwd(), "output", "dispute-letters", "fixtures", "experian", "report.json"),
  path.resolve(process.cwd(), "tmp", "report-layout-analysis", "REF-EX-F.report.json"),
  path.resolve(process.cwd(), "tmp", "REF-E-experian-credit-report.json"),
  path.resolve(
    process.cwd(),
    "tmp",
    "backend-sessions",
    "401d2586-1c1e-4807-85e2-3a821d468368",
    "outputs",
    "result.json",
  ),
];

const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const compactText = (value) => normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");

const parseEntityKey = (value) => {
  const [accountName = "", accountNumber = ""] = String(value ?? "").split("::", 2);
  return {
    accountName: normalizeText(accountName),
    accountNumber: normalizeText(accountNumber),
  };
};

const monthRef = (year, month) => `${year}:${month}`;

const parseMonthYear = (value) => {
  const normalized = normalizeText(value);
  const match = normalized.match(
    /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b[\s,/-]+(\d{4})/i,
  );
  if (!match) {
    return null;
  }
  const monthToken = match[1].slice(0, 3).toLowerCase();
  const month = MONTH_KEYS.find((entry) => entry === monthToken);
  return month ? { year: match[2], month } : null;
};

const normalizePages = (pages) =>
  [...new Set((Array.isArray(pages) ? pages : []).map((page) => Number(page)).filter((page) => Number.isInteger(page) && page > 0))].sort((left, right) => left - right);

const pageOverlapScore = (leftPages, rightPages) => {
  if (leftPages.length === 0 || rightPages.length === 0) {
    return 0;
  }
  const rightSet = new Set(rightPages);
  return leftPages.reduce((count, page) => count + (rightSet.has(page) ? 1 : 0), 0);
};

const paymentHistoryCoverageScore = (account) =>
  (Array.isArray(account?.paymentHistory?.rows) ? account.paymentHistory.rows : []).reduce((count, row) => {
    const year = normalizeText(row?.year);
    if (!/^\d{4}$/.test(year)) {
      return count;
    }
    return (
      count +
      MONTH_KEYS.reduce((monthCount, month) => monthCount + (normalizeText(row?.[month]) ? 1 : 0), 0)
    );
  }, 0);

const resolveExperianAccount = (report, entityKey, sourcePages = []) => {
  const { accountName, accountNumber } = parseEntityKey(entityKey);
  const targetName = compactText(accountName);
  const targetDigits = compactText(accountNumber).slice(-6);
  const targetPages = normalizePages(sourcePages);
  const accounts = report?.components?.accounts?.accounts ?? [];
  const candidates = accounts.filter((account) => {
    const headerName = compactText(account?.header?.accountName);
    const headerDigits = compactText(account?.header?.accountNumber).slice(-6);
    if (!targetName || !headerName.includes(targetName)) {
      return false;
    }
    if (!targetDigits) {
      return true;
    }
    return headerDigits.endsWith(targetDigits);
  });

  if (candidates.length <= 1) {
    return candidates[0] ?? null;
  }

  const rankedCandidates = candidates
    .map((account, index) => ({
      account,
      index,
      overlap: pageOverlapScore(targetPages, normalizePages(account?.sourcePages)),
      coverage: paymentHistoryCoverageScore(account),
    }))
    .sort((left, right) => {
      if (right.overlap !== left.overlap) {
        return right.overlap - left.overlap;
      }
      if (right.coverage !== left.coverage) {
        return right.coverage - left.coverage;
      }
      return left.index - right.index;
    });

  return rankedCandidates[0]?.account ?? null;
};

const buildPaymentHistoryMap = (account) => {
  const rows = Array.isArray(account?.paymentHistory?.rows) ? account.paymentHistory.rows : [];
  const result = new Map();
  for (const row of rows) {
    const year = normalizeText(row?.year);
    if (!/^\d{4}$/.test(year)) {
      continue;
    }
    for (const month of MONTH_KEYS) {
      const value = normalizeText(row?.[month]);
      if (!value) {
        continue;
      }
      result.set(monthRef(year, month), value);
    }
  }
  return result;
};

const buildDatedHistoryMap = (account, valueKey) => {
  const entries = Array.isArray(account?.balanceHistories) ? account.balanceHistories : [];
  const result = new Map();
  for (const entry of entries) {
    const monthYear = parseMonthYear(entry?.date);
    if (!monthYear) {
      continue;
    }
    const value = normalizeText(entry?.[valueKey]);
    if (!value) {
      continue;
    }
    result.set(monthRef(monthYear.year, monthYear.month), value);
  }
  return result;
};

const resolveAccountField = (account, fieldName) => {
  const accountInfo = account?.accountInfo ?? {};
  switch (fieldName) {
    case "recentPayment":
      return normalizeText(accountInfo.recentPayment);
    case "lastPaymentDate":
      return normalizeText(accountInfo.lastPaymentDate);
    case "monthlyPayment":
    case "paymentAmount":
      return normalizeText(accountInfo.monthlyPayment);
    case "status":
      return normalizeText(accountInfo.status);
    case "dateClosed":
      return normalizeText(accountInfo.dateClosed);
    case "dateOpened":
      return normalizeText(accountInfo.dateOpened);
    default:
      return normalizeText(accountInfo[fieldName]);
  }
};

const valuesMatch = (left, right) => {
  const normalizedLeft = compactText(left);
  const normalizedRight = compactText(right);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
};

const loadReport = async (reportPath) => {
  const parsed = JSON.parse(await fs.readFile(reportPath, "utf8"));
  if (parsed?.bureau && parsed?.profileId) {
    return parsed;
  }

  const workerResult = parsed?.result ?? parsed;
  if (!workerResult?.profile) {
    throw new Error(`${reportPath}: unsupported report fixture shape`);
  }

  const pathSegments = reportPath.split(path.sep);
  const backendSessionIndex = pathSegments.lastIndexOf("backend-sessions");
  const sessionId = backendSessionIndex >= 0 ? pathSegments[backendSessionIndex + 1] : path.basename(reportPath, path.extname(reportPath));
  const uploadedFileName = `${sessionId}.pdf`;

  return mapWorkerResultToCreditReport({
    session: {
      id: sessionId,
      uploadedFileName,
    },
    workerResult,
  });
};

const resolveEvidenceRef = (reason, ref, account, historyMaps) => {
  if (ref.kind === "field") {
    const value = resolveAccountField(account, ref.fieldName);
    assert.ok(value, `${reason.id}: missing field ${ref.fieldName}`);
    if (ref.expectedValue) {
      assert.ok(valuesMatch(value, ref.expectedValue), `${reason.id}: ${ref.fieldName} expected ${ref.expectedValue}, saw ${value}`);
    }
    return {
      type: ["recentPayment", "paymentAmount", "lastPaymentDate"].includes(ref.fieldName) ? "activity-field" : "field",
      value,
    };
  }

  if (ref.kind === "history_cell" || ref.kind === "history_gap") {
    assert.ok(ref.year && ref.month, `${reason.id}: ${ref.kind} is missing year/month`);
    const historyMap = historyMaps.get(ref.fieldName) ?? new Map();
    const historyValue = historyMap.get(monthRef(ref.year, ref.month)) ?? "";

    if (ref.fieldName === "paymentHistoryGapSlots") {
      const paymentHistoryValue = (historyMaps.get("paymentHistory") ?? new Map()).get(monthRef(ref.year, ref.month)) ?? "";
      assert.ok(BLANK_PAYMENT_VALUES.has(paymentHistoryValue), `${reason.id}: expected blank payment-history slot at ${ref.year}-${ref.month}, saw ${paymentHistoryValue || "<empty>"}`);
      return { type: "blank-slot", value: historyValue || "<empty>" };
    }

    if (ref.fieldName === "paymentHistory") {
      assert.ok(historyValue || BLANK_PAYMENT_VALUES.has(historyValue), `${reason.id}: missing payment-history cell ${ref.year}-${ref.month}`);
      if (ref.expectedValue) {
        assert.ok(valuesMatch(historyValue, ref.expectedValue), `${reason.id}: paymentHistory ${ref.year}-${ref.month} expected ${ref.expectedValue}, saw ${historyValue}`);
      }
      return {
        type: BLANK_PAYMENT_VALUES.has(historyValue) ? "blank-slot" : "payment-cell",
        value: historyValue || "<empty>",
      };
    }

    if (ref.fieldName === "actualPaymentHistory" || ref.fieldName === "scheduledPaymentHistory") {
      assert.ok(historyValue, `${reason.id}: missing ${ref.fieldName} cell ${ref.year}-${ref.month}`);
      if (ref.expectedValue) {
        assert.ok(valuesMatch(historyValue, ref.expectedValue), `${reason.id}: ${ref.fieldName} ${ref.year}-${ref.month} expected ${ref.expectedValue}, saw ${historyValue}`);
      }
      return { type: "activity-cell", value: historyValue };
    }
  }

  throw new Error(`${reason.id}: unsupported evidence ref ${ref.kind}:${ref.fieldName}`);
};

const ensureIssueTemplate = (reason, resolvedRefs) => {
  if (reason.issueType === "payment_history_missing_months") {
    assert.ok(resolvedRefs.some((ref) => ref.type === "blank-slot"), `${reason.id}: missing-month dispute must include a blank payment-history slot`);
    assert.ok(resolvedRefs.some((ref) => ref.type === "payment-cell"), `${reason.id}: missing-month dispute must include a boundary payment-history month`);
  }

  if (reason.issueType === "recent_payment_missing_when_history_implies_payment") {
    assert.ok(
      resolvedRefs.some((ref) => ref.type === "field" || ref.type === "activity-field"),
      `${reason.id}: recent-payment dispute must include a recent-payment field ref`,
    );
    assert.ok(resolvedRefs.some((ref) => ref.type === "payment-cell"), `${reason.id}: recent-payment dispute must include a payment-history cell ref`);
  }

  if (reason.issueType === "delinquency_progression_inconsistency") {
    const paymentCells = resolvedRefs.filter((ref) => ref.type === "payment-cell");
    assert.ok(paymentCells.length >= 2, `${reason.id}: progression dispute must include at least two payment-history cells`);
  }

  if (reason.issueType === "severe_delinquency_jump_without_predecessor_support") {
    const paymentCells = resolvedRefs.filter((ref) => ref.type === "payment-cell");
    assert.ok(paymentCells.length >= 2, `${reason.id}: severe-jump dispute must include earlier and later payment-history cells`);
  }

  if (reason.issueType === "reaging_jump_after_current_reset") {
    const paymentCells = resolvedRefs.filter((ref) => ref.type === "payment-cell");
    assert.ok(paymentCells.length >= 2, `${reason.id}: re-aging dispute must include reset and later severe payment-history cells`);
  }

  if (reason.issueType === "retroactive_derogatory_backfill_after_reporting_gap") {
    assert.ok(resolvedRefs.some((ref) => ref.type === "blank-slot"), `${reason.id}: backfill dispute must include a blank payment-history slot`);
    assert.ok(resolvedRefs.filter((ref) => ref.type === "payment-cell").length >= 2, `${reason.id}: backfill dispute must include earlier/later payment-history cells`);
  }

  if (reason.issueType === "payment_activity_conflicts_with_delinquency_progression") {
    assert.ok(
      resolvedRefs.some((ref) => ref.type === "payment-cell"),
      `${reason.id}: payment-activity conflict must include at least one payment-history cell`,
    );
    assert.ok(
      resolvedRefs.some((ref) => ref.type === "activity-cell" || ref.type === "activity-field"),
      `${reason.id}: payment-activity conflict must include at least one payment-activity ref`,
    );
  }
};

const main = async () => {
  const reportPaths = process.argv.slice(2);
  const paths = reportPaths.length > 0 ? reportPaths : DEFAULT_REPORT_PATHS;
  const summaries = [];
  const distinctIssueMonths = new Map();
  let reportWithTargetIssueCount = 0;
  let resolvedBlankSlotCount = 0;

  for (const reportPath of paths) {
    const report = await loadReport(reportPath);
    assert.equal(report.bureau, "Experian", `${reportPath}: expected Experian report`);
    assert.equal(report.profileId, "experian_acr_v1", `${reportPath}: expected experian_acr_v1 profile`);

    const intake = buildDefaultIntake(report);
    const accountRuleCatalog = generateAccountRuleCatalog(report);
    const nonAccountReasons = generateNonAccountReasons(report, intake);
    const reasons = generateDisputeReasons(report, intake, accountRuleCatalog, nonAccountReasons);
    const targetReasons = reasons.filter((reason) => TARGET_ISSUES.has(reason.issueType));

    if (targetReasons.length > 0) {
      reportWithTargetIssueCount += 1;
    }

    for (const reason of targetReasons) {
      assert.ok((reason.evidenceRefs?.length ?? 0) > 0, `${reason.id}: canonical payment-history dispute is missing evidenceRefs`);
      const account = resolveExperianAccount(report, reason.entityKey, reason.sourcePages);
      assert.ok(account, `${reason.id}: could not resolve account from report`);
      const historyMaps = new Map([
        ["paymentHistory", buildPaymentHistoryMap(account)],
        ["actualPaymentHistory", buildDatedHistoryMap(account, "paid")],
        ["scheduledPaymentHistory", buildDatedHistoryMap(account, "scheduledPayment")],
      ]);
      const resolvedRefs = reason.evidenceRefs.map((ref) => resolveEvidenceRef(reason, ref, account, historyMaps));
      ensureIssueTemplate(reason, resolvedRefs);

      const monthSet = distinctIssueMonths.get(reason.issueType) ?? new Set();
      for (const ref of reason.evidenceRefs) {
        if (ref.year && ref.month) {
          monthSet.add(`${ref.year}-${ref.month}`);
        }
      }
      distinctIssueMonths.set(reason.issueType, monthSet);
      resolvedBlankSlotCount += resolvedRefs.filter((ref) => ref.type === "blank-slot").length;
    }

    summaries.push({
      reportPath,
      targetReasonCount: targetReasons.length,
      issueCounts: Object.fromEntries(
        [...TARGET_ISSUES].map((issueType) => [
          issueType,
          targetReasons.filter((reason) => reason.issueType === issueType).length,
        ]),
      ),
    });
  }

  assert.ok(reportWithTargetIssueCount >= 2, "expected at least two Experian reports to trigger canonical payment-history disputes");
  assert.ok(resolvedBlankSlotCount > 0, "expected at least one canonical blank payment-history slot across the Experian report set");
  assert.ok(
    (distinctIssueMonths.get("payment_history_missing_months")?.size ?? 0) >= 2,
    "expected payment_history_missing_months to span multiple dynamic months across the Experian report set",
  );

  console.log(
    JSON.stringify(
      {
        reportCount: paths.length,
        reportWithTargetIssueCount,
        resolvedBlankSlotCount,
        distinctIssueMonths: Object.fromEntries(
          [...distinctIssueMonths.entries()].map(([issueType, months]) => [issueType, [...months].sort()]),
        ),
        summaries,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
