import fs from "node:fs/promises";
import path from "node:path";

const API_BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:8787";
const OUTPUT_ROOT = path.resolve(process.cwd(), "tmp", "report-layout-analysis");
const MORTGAGE_TYPE_PATTERN = /mortgage|home equity|real estate/i;

const usage = () => {
  console.error("Usage: npx -y tsx scripts/analyze_report_layouts.mjs <report.pdf> [more-report.pdf ...]");
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    throw new Error(payload.error || payload.details || payload.raw || `${response.status} ${response.statusText}`);
  }
  return payload;
};

const slugify = (value) =>
  String(value || "report")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "report";

const normalizeText = (value) => String(value ?? "").trim();

const getAccountName = (account) =>
  normalizeText(
    account?.name ??
      account?.accountName ??
      account?.furnisher ??
      account?.creditorName ??
      account?.header?.accountName ??
      account?.accountInfo?.accountName,
  );

const getAccountNumber = (account) =>
  normalizeText(account?.accountNumber ?? account?.header?.accountNumber ?? account?.accountInfo?.accountNumber);

const getAccountType = (account) =>
  normalizeText(account?.accountType ?? account?.loanType ?? account?.accountInfo?.accountType ?? account?.accountInfo?.loanType);

const getAccountStatus = (account) =>
  normalizeText(account?.status ?? account?.accountStatus ?? account?.accountInfo?.status ?? account?.accountInfo?.payStatus);

const getBalance = (account) => normalizeText(account?.balance ?? account?.accountInfo?.balance);

const getMonthlyPayment = (account) =>
  normalizeText(account?.monthlyPayment ?? account?.paymentAmount ?? account?.accountInfo?.monthlyPayment ?? account?.accountInfo?.paymentReceived);

const getRecentPayment = (account) =>
  normalizeText(account?.recentPayment ?? account?.accountInfo?.recentPayment ?? account?.accountInfo?.lastPaymentMade);

const getDateOpened = (account) =>
  normalizeText(account?.dateOpened ?? account?.openDate ?? account?.accountInfo?.dateOpened);

const getTerms = (account) => normalizeText(account?.terms ?? account?.termDuration ?? account?.accountInfo?.terms);

const getSourcePages = (account) =>
  Array.isArray(account?.sourcePages)
    ? account.sourcePages
    : Array.isArray(account?.pageNumbers)
      ? account.pageNumbers
      : [];

const getBalanceHistoryCount = (account) => {
  if (Array.isArray(account?.balanceHistories)) {
    if (account.balanceHistories.length > 0 && Array.isArray(account.balanceHistories[0]?.rows)) {
      return account.balanceHistories.reduce((count, entry) => count + (Array.isArray(entry?.rows) ? entry.rows.length : 0), 0);
    }
    return account.balanceHistories.length;
  }
  if (Array.isArray(account?.balanceHistory)) {
    return account.balanceHistory.length;
  }
  return 0;
};

const isMortgageLikeAccount = (account) => {
  const compositeType = `${getAccountType(account)} ${normalizeText(account?.accountCategory)}`;
  return MORTGAGE_TYPE_PATTERN.test(compositeType);
};

const processReport = async (filePath) => {
  const session = await requestJson(`${API_BASE}/api/sessions`, { method: "POST" });
  const sessionId = session.sessionId;
  const fileBuffer = await fs.readFile(filePath);
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer], { type: "application/pdf" }), path.basename(filePath));

  await requestJson(`${API_BASE}/api/sessions/${sessionId}/upload`, {
    method: "POST",
    body: formData,
  });

  await requestJson(`${API_BASE}/api/sessions/${sessionId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  for (;;) {
    const status = await requestJson(`${API_BASE}/api/sessions/${sessionId}/status`);
    if (status.sessionStatus === "processed") break;
    if (status.sessionStatus === "failed") {
      throw new Error(status.lastError || `Processing failed for ${filePath}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const result = await requestJson(`${API_BASE}/api/sessions/${sessionId}/result`);
  return { sessionId, report: result.report };
};

const summarizeReport = ({ filePath, sessionId, report }) => {
  const accounts = Array.isArray(report?.accounts) ? report.accounts : [];
  const mortgageAccounts = accounts.filter(isMortgageLikeAccount).map((account) => ({
    entityKey:
      normalizeText(account?.accountKey) ||
      `${getAccountName(account) || "unnamed"}::${getAccountNumber(account) || "missing-account-number"}`,
    name: getAccountName(account) || "Not reported",
    accountNumber: getAccountNumber(account) || "Not reported",
    accountType: getAccountType(account) || "Not reported",
    status: getAccountStatus(account) || "Not reported",
    dateOpened: getDateOpened(account) || "Not reported",
    balance: getBalance(account) || "Not reported",
    monthlyPayment: getMonthlyPayment(account) || "Not reported",
    recentPayment: getRecentPayment(account) || "Not reported",
    terms: getTerms(account) || "Not reported",
    balanceHistoryCount: getBalanceHistoryCount(account),
    sourcePages: getSourcePages(account),
  }));

  return {
    filePath,
    sessionId,
    bureau: report?.bureau ?? null,
    profileId: report?.profileId ?? null,
    accountCount: accounts.length,
    validationIssueCount: Array.isArray(report?.validationIssues) ? report.validationIssues.length : 0,
    validationIssues: Array.isArray(report?.validationIssues) ? report.validationIssues : [],
    mortgageLikeCount: mortgageAccounts.length,
    mortgageAccounts,
  };
};

const main = async () => {
  const filePaths = process.argv.slice(2);
  if (filePaths.length === 0) {
    usage();
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const summaries = [];

  for (const inputPath of filePaths) {
    const filePath = path.resolve(inputPath);
    console.error(`Analyzing ${filePath}...`);
    const { sessionId, report } = await processReport(filePath);
    const summary = summarizeReport({ filePath, sessionId, report });
    summaries.push(summary);

    const targetBase = slugify(path.basename(filePath));
    await fs.writeFile(path.join(OUTPUT_ROOT, `${targetBase}.report.json`), JSON.stringify(report, null, 2), "utf8");
    await fs.writeFile(path.join(OUTPUT_ROOT, `${targetBase}.summary.json`), JSON.stringify(summary, null, 2), "utf8");
  }

  console.log(JSON.stringify(summaries, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
