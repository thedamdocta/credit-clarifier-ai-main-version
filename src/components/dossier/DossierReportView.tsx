import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Download,
  FileSearch,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Account, CreditReport, MonthlyHistoryEntry } from "@/lib/types/creditReport";
import EquifaxCreditReport from "@/components/EquifaxCreditReport";
import EquifaxNewCreditReport from "@/components/EquifaxNewCreditReport";
import ExperianCreditReport from "@/components/ExperianCreditReport";
import TransUnionCreditReport from "@/components/TransUnionCreditReport";
import SourceReportViewer from "@/components/credit-report/source/SourceReportViewer";
import AccountsList from "@/components/credit-report/accounts/AccountsList";
import {
  formatDollarAmount,
  humanizeExtractedText,
  isNotReportedValue,
} from "@/utils/formatters/accountValueFormatters";
import { getReportReference } from "@/utils/reportDisplay";
import {
  DossierMetaTable,
  DossierPageHeader,
  DossierSection,
  DossierSectionHeader,
} from "./DossierPrimitives";
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";

type ReportTab = "report" | "source" | "json";
type SectionView = "extracted" | "source";
type AccountView =
  | "summary"
  | "details"
  | "payment-history"
  | "account-history"
  | "comments"
  | "source-report";

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const MONTH_LABELS = {
  jan: "Jan",
  feb: "Feb",
  mar: "Mar",
  apr: "Apr",
  may: "May",
  jun: "Jun",
  jul: "Jul",
  aug: "Aug",
  sep: "Sep",
  oct: "Oct",
  nov: "Nov",
  dec: "Dec",
} satisfies Record<(typeof MONTH_KEYS)[number], string>;
const HISTORY_FIELDS = [
  "balanceHistory",
  "scheduledPaymentHistory",
  "actualPaymentHistory",
  "creditLimitHistory",
  "amountPastDueHistory",
  "activityDesignatorHistory",
] as const;
const PAYMENT_HISTORY_FIELDS = ["scheduledPaymentHistory", "actualPaymentHistory"] as const;
const NOISE_TOKENS = new Set(["none", "null", "undefined", "not reported", "n/a", "na", "-"]);
const PAYMENT_STATUS_CODES: Record<string, string> = {
  OK: "Payment made on time",
  "30": "30 days late",
  "60": "60 days late",
  "90": "90 days late",
  "120": "120 days late",
  "150": "150 days past due",
  "180": "180 days past due",
  COL: "In collections",
  C: "Collection account",
  CO: "Charge-off",
  B: "Included in bankruptcy",
  R: "Repossession",
  V: "Voluntary surrender",
  F: "Foreclosure",
  TNT: "Too new to rate",
  X: "No data available",
};

const formatValue = (value: unknown, fallback = "Not reported") => {
  const normalized = cleanDisplayText(value);
  return normalized.length ? normalized : fallback;
};

const cleanDisplayText = (value: unknown) => {
  const normalized = String(value ?? "")
    .replace(/\s+\bnone\b$/i, "")
    .replace(/\b(?:null|undefined)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return NOISE_TOKENS.has(normalized.toLowerCase()) ? "" : normalized;
};

const normalizeLines = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => cleanDisplayText(entry))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|\|/)
      .map((entry) => cleanDisplayText(entry))
      .filter(Boolean);
  }

  return [] as string[];
};

const hasMeaningfulPaymentCode = (value: string | undefined) => {
  const normalized = cleanDisplayText(value);
  return Boolean(normalized && normalized !== "-");
};

const normalizePaymentHistory = (paymentHistory: string[]) => {
  const normalized = Array.isArray(paymentHistory)
    ? paymentHistory.map((value) => (hasMeaningfulPaymentCode(value) ? cleanDisplayText(value) : "-"))
    : [];

  const targetLength = normalized.length > 0 ? Math.ceil(normalized.length / 12) * 12 : 36;

  while (normalized.length < targetLength) {
    normalized.push("-");
  }

  return normalized;
};

const derivePaymentHistoryYears = (account: Account, rowCount: number) => {
  const explicitYears = Array.isArray(account.paymentHistoryYears)
    ? account.paymentHistoryYears.map((year) => cleanDisplayText(year)).filter(Boolean)
    : [];

  if (explicitYears.length > 0) {
    const normalizedYears = [...explicitYears];
    while (normalizedYears.length < rowCount) {
      normalizedYears.push("-");
    }
    return normalizedYears.slice(0, rowCount);
  }

  const years = new Set<number>();
  HISTORY_FIELDS.forEach((field) => {
    const entries = account[field] as MonthlyHistoryEntry[] | undefined;
    entries?.forEach((entry) => {
      const year = Number.parseInt(entry?.year ?? "", 10);
      if (Number.isFinite(year)) {
        years.add(year);
      }
    });
  });

  if (years.size > 0) {
    const sortedYears = Array.from(years)
      .sort((left, right) => right - left)
      .map(String);

    while (sortedYears.length < rowCount) {
      const lastYear = Number.parseInt(sortedYears[sortedYears.length - 1] ?? "", 10);
      if (!Number.isFinite(lastYear)) {
        break;
      }
      sortedYears.push(String(lastYear - 1));
    }

    return sortedYears.slice(0, rowCount);
  }

  const reportedYear = Number.parseInt((account.dateReported ?? "").match(/\b(19|20)\d{2}\b/)?.[0] ?? "", 10);
  if (Number.isFinite(reportedYear)) {
    return Array.from({ length: rowCount }, (_, index) => String(reportedYear - index));
  }

  return Array.from({ length: rowCount }, () => "-");
};

const splitPaymentHistoryRows = (paymentHistory: string[]) => {
  const normalized = normalizePaymentHistory(paymentHistory);

  return Array.from({ length: normalized.length / 12 }, (_, rowIndex) =>
    normalized
      .slice(rowIndex * 12, rowIndex * 12 + 12)
      .map((value) => (hasMeaningfulPaymentCode(value) ? cleanDisplayText(value) : "-")),
  );
};

const hasReportedHistoryRows = (rows?: MonthlyHistoryEntry[]) =>
  Boolean(
    rows?.some((row) =>
      MONTH_KEYS.some((month) => {
        const value = cleanDisplayText(row?.[month]);
        return Boolean(value && value !== "-");
      }),
    ),
  );

const dedupePages = (pages: number[]) =>
  Array.from(
    new Set(
      pages
        .map((page) => Number(page))
        .filter((page) => Number.isInteger(page) && page > 0),
    ),
  ).sort((left, right) => left - right);

const collectSourcePages = (report: CreditReport) =>
  dedupePages(
    Object.values(report.sourceComponents ?? {}).flatMap((section) => (section?.pages ?? []).map((page) => Number(page))),
  );

const getStatusState = (report: CreditReport) => {
  const failedComponents = Object.entries(report.componentStatus ?? {}).filter(([, status]) => status === "failed");
  if (!failedComponents.length) {
    const bureauLabel = report.bureau === "Unknown" ? "scoped" : `${report.bureau} scoped`;
    return {
      tone: "success" as const,
      message: `All ${bureauLabel} components passed validation. Ready for review.`,
    };
  }

  return {
    tone: "warning" as const,
    message: `Extraction requires review for: ${failedComponents.map(([name]) => name).join(", ")}.`,
  };
};

const getOverviewRows = (report: CreditReport) => {
  const components = (report.components ?? {}) as Record<string, any>;
  const overview = components.reportOverview ?? {};
  const personalInformation = components.personalInformation ?? {};
  const atAGlance = overview.atAGlance ?? {};
  const personalInfoCounts = overview.personalInfoCounts ?? {};

  const accountCount = report.accounts.length || Number(atAGlance.accountCount ?? 0);
  const publicRecordCount = report.publicRecords.length || Number(atAGlance.publicRecordCount ?? 0);
  const hardInquiryCount =
    report.inquiryBuckets?.hardInquiryCount ??
    Number(atAGlance.hardInquiryCount ?? report.inquiries.filter((entry) => entry.inquiryType !== "soft").length);
  const nameCount =
    personalInfoCounts.nameCount ??
    (normalizeLines(personalInformation.names).length || (report.personalInfo.name ? 1 : 0));
  const addressCount =
    personalInfoCounts.addressCount ??
    (normalizeLines(personalInformation.addresses).length || report.personalInfo.addresses.length);
  const employerCount =
    personalInfoCounts.employerCount ??
    (normalizeLines(personalInformation.employers).length || normalizeLines(report.personalInfo.employmentHistory).length);
  const statementCount = personalInfoCounts.personalStatementCount ?? Number(report.statementCount ?? 0);

  const piiSummary = [
    `${nameCount} Names`,
    `${addressCount} Addresses`,
    `${employerCount} Employers`,
    `${statementCount} Statement`,
  ];

  return [
    {
      label: "Consumer Name",
      value: overview.consumerName ?? report.consumerName ?? report.personalInfo.name ?? "Not reported",
      valueClassName: "dossier-kv-value",
    },
    {
      label: "Date Generated",
      value: overview.dateGenerated ?? report.reportDate ?? "Not reported",
    },
    {
      label: "Report Number",
      value: getReportReference(report),
    },
    {
      label: "At-a-Glance",
      value: `${accountCount} Accounts | ${publicRecordCount} Public Records | ${hardInquiryCount} Hard Inquiries`,
      valueClassName: "font-mono text-sm leading-7 text-slate-700",
    },
    {
      label: "PII Counts",
      value: piiSummary.join(" | "),
      valueClassName: "font-mono text-sm leading-7 text-slate-700",
    },
  ];
};

const getPersonalInfoRows = (report: CreditReport) => {
  const employmentHistory = normalizeLines(report.personalInfo.employmentHistory);
  const socialSecurity = normalizeLines(report.personalInfo.socialSecurityNumbers).length
    ? normalizeLines(report.personalInfo.socialSecurityNumbers).join(" | ")
    : report.personalInfo.ssn ?? "Not reported";

  return [
    {
      label: "Names",
      value: report.personalInfo.name || "Not reported",
      valueClassName: "dossier-kv-value",
    },
    {
      label: "Addresses",
      value: report.personalInfo.addresses.length ? report.personalInfo.addresses.join(" | ") : "Not reported",
      valueClassName: "font-mono text-sm leading-7 text-slate-700",
    },
    {
      label: "DOB",
      value: report.personalInfo.dob ?? "Not reported",
    },
    {
      label: "SSN / IDs",
      value: socialSecurity,
      valueClassName: "font-mono text-sm leading-7 text-slate-700",
    },
    {
      label: "Employment",
      value: employmentHistory.length ? employmentHistory.join(" | ") : "Not reported",
      valueClassName: "font-mono text-sm leading-7 text-slate-700",
    },
  ];
};

const paymentToneClass = (value: string) => {
  const normalized = value.toUpperCase();
  if (normalized === "OK") return "dossier-pill-ok";
  if (["ND", "---"].includes(normalized)) return "dossier-pill-muted";
  if (["CLS", "CLOSED"].includes(normalized)) return "dossier-pill-closed";
  if (["30", "60", "90", "120", "150", "180", "CO", "COL", "X", "C", "R", "F", "B", "V", "VS"].includes(normalized)) {
    return "dossier-pill-alert";
  }
  return "dossier-pill-muted";
};

const HistoryTable: React.FC<{ title: string; rows: MonthlyHistoryEntry[] }> = ({ title, rows }) => (
  <div className="space-y-3">
    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">{title}</div>
    <div className="overflow-x-auto">
      <table className="payment-grid min-w-full">
        <thead>
          <tr>
            <th>Year</th>
            {MONTH_KEYS.map((month) => (
              <th key={month}>{MONTH_LABELS[month]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <td>{row.year}</td>
              {MONTH_KEYS.map((month) => {
                const value = formatValue(row[month], "---");
                return (
                  <td key={`${row.year}-${month}`}>
                    <span className={paymentToneClass(value)}>{value}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PaymentCodeHistoryTable: React.FC<{ account: Account }> = ({ account }) => {
  const paymentRows = splitPaymentHistoryRows(account.paymentHistory || []);
  const years = derivePaymentHistoryYears(account, paymentRows.length);
  const hasAnyEvidence = paymentRows.some((row) => row.some((value) => value !== "-"));

  if (!paymentRows.length) {
    return (
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
        No payment history codes were extracted for this account.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px]">
        {Object.entries(PAYMENT_STATUS_CODES).map(([code, description]) => (
          <span key={code} className="rounded-full border border-slate-200 px-3 py-1 font-mono uppercase tracking-[0.16em] text-slate-600">
            {code}: {description}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="payment-grid min-w-full">
          <thead>
            <tr>
              <th>Year</th>
              {MONTH_KEYS.map((month) => (
                <th key={month}>{MONTH_LABELS[month]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paymentRows.map((row, rowIndex) => (
              <tr key={`${years[rowIndex]}-${rowIndex}`}>
                <td>{years[rowIndex] ?? "-"}</td>
                {row.map((status, monthIndex) => (
                  <td key={`${rowIndex}-${monthIndex}`}>
                    <span className={paymentToneClass(status === "-" ? "X" : status)}>{status === "-" ? "X" : status}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!hasAnyEvidence ? (
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
          No meaningful payment history codes were proven for this account.
        </div>
      ) : null}
    </div>
  );
};

const GenericAccountCard: React.FC<{ account: Account; sourceSessionId?: string | null }> = ({
  account,
  sourceSessionId,
}) => {
  const hasStructuredPaymentHistory = PAYMENT_HISTORY_FIELDS.some((field) =>
    hasReportedHistoryRows(account[field]),
  );
  const hasCodePaymentHistory = splitPaymentHistoryRows(account.paymentHistory || []).some((row) =>
    row.some((value) => value !== "-"),
  );
  const [activeView, setActiveView] = useState<AccountView>(
    hasStructuredPaymentHistory || hasCodePaymentHistory ? "payment-history" : "summary",
  );
  const sourcePages = dedupePages((account.sourcePages ?? []).map((page) => Number(page)));

  const summaryRows = [
    { label: "Account Name", value: formatValue(humanizeExtractedText(account.accountName)) },
    { label: "Account Number", value: formatValue(account.accountNumber || "Unknown") },
    { label: "Reported Balance", value: formatValue(formatDollarAmount(account.balance ?? account.currentBalance ?? "")) },
    { label: "Account Status", value: formatValue(humanizeExtractedText(account.status) || "Unknown") },
    { label: "Open Date", value: formatValue(account.openDate || account.dateOpened) },
    { label: "Date Reported", value: formatValue(account.dateReported) },
  ];

  const detailsRows = [
    { label: "Account Type", value: formatValue(humanizeExtractedText(account.accountType)) },
    { label: "Account Category", value: formatValue(humanizeExtractedText(account.accountCategory)) },
    { label: "Ownership", value: formatValue(humanizeExtractedText(account.accountOwnership ?? account.responsibility)) },
    { label: "Account Status", value: formatValue(humanizeExtractedText(account.accountStatus ?? account.status)) },
    { label: "High Credit", value: formatValue(formatDollarAmount(account.highCredit ?? account.highestBalance ?? "")) },
    { label: "Credit Limit", value: formatValue(formatDollarAmount(account.creditLimit ?? "")) },
    { label: "Current Balance", value: formatValue(formatDollarAmount(account.currentBalance ?? account.balance ?? "")) },
    { label: "Amount Past Due", value: formatValue(formatDollarAmount(account.amountPastDue ?? "")) },
    { label: "Charge Off Amount", value: formatValue(formatDollarAmount(account.chargeOffAmount ?? "")) },
    { label: "Actual Payment Amount", value: formatValue(formatDollarAmount(account.actualPaymentAmount ?? "")) },
    { label: "Scheduled Payment Amount", value: formatValue(formatDollarAmount(account.scheduledPaymentAmount ?? "")) },
    { label: "Payment Amount", value: formatValue(formatDollarAmount(account.paymentAmount ?? "")) },
    { label: "Credit Type", value: formatValue(humanizeExtractedText(account.creditType)) },
    { label: "Loan Type", value: formatValue(humanizeExtractedText(account.loanType)) },
    { label: "Terms Frequency", value: formatValue(humanizeExtractedText(account.termsFrequency)) },
    { label: "Term Duration", value: formatValue(humanizeExtractedText(account.termDuration)) },
    { label: "Months Reviewed", value: formatValue(account.monthsReviewed) },
    { label: "Payment Responsibility", value: formatValue(humanizeExtractedText(account.paymentResponsibility ?? account.responsibility)) },
    { label: "Activity Designator", value: formatValue(humanizeExtractedText(account.activityDesignator)) },
    { label: "Deferred Payment Start Date", value: formatValue(account.deferredPaymentStartDate) },
    { label: "Balloon Payment Date", value: formatValue(account.balloonPaymentDate) },
    { label: "Date Closed", value: formatValue(account.dateClosed) },
    { label: "Last Payment Date", value: formatValue(account.lastPaymentDate) },
    { label: "Date of Last Activity", value: formatValue(account.dateOfLastActivity) },
    { label: "Date of First Delinquency", value: formatValue(account.dateOfFirstDelinquency) },
    { label: "Delinquency First Reported", value: formatValue(account.delinquencyFirstReported) },
    { label: "Creditor Classification", value: formatValue(humanizeExtractedText(account.creditorClassification)) },
  ];

  const paymentHistories = [
    { title: "Actual Payment History", rows: account.actualPaymentHistory ?? [] },
    { title: "Scheduled Payment History", rows: account.scheduledPaymentHistory ?? [] },
  ].filter((section) => hasReportedHistoryRows(section.rows));

  const accountHistories = [
    { title: "Balance History", rows: account.balanceHistory ?? [] },
    { title: "Credit Limit History", rows: account.creditLimitHistory ?? [] },
    { title: "Amount Past Due History", rows: account.amountPastDueHistory ?? [] },
    { title: "Activity Designator History", rows: account.activityDesignatorHistory ?? [] },
  ].filter((section) => hasReportedHistoryRows(section.rows));
  const comments = (account.comments ?? [])
    .map((comment) => cleanDisplayText(comment))
    .filter((comment) => comment && !isNotReportedValue(comment));
  const contactLines = normalizeLines(account.contact ?? []);

  return (
    <article className="account-card">
      <header className="acct-header">
        <CreditCard className="h-5 w-5 text-slate-500" />
        <h3 className="acct-title">{formatValue(account.accountName)}</h3>
        <span className="acct-num">{formatValue(account.accountNumber)}</span>
        {account.isClosed ? <span className="badge-closed">Closed</span> : null}
      </header>

      <div className="acct-nav">
        {[
          { key: "summary" as const, label: "Summary" },
          { key: "details" as const, label: "Account Details" },
          { key: "payment-history" as const, label: "Payment History" },
          { key: "account-history" as const, label: "Account History" },
          { key: "comments" as const, label: "Comments" },
          ...(sourcePages.length ? [{ key: "source-report" as const, label: "Source Report" }] : []),
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={cn("acct-nav-item", activeView === item.key && "active")}
            onClick={() => setActiveView(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="acct-body">
        {activeView === "summary" ? <DossierMetaTable rows={summaryRows} /> : null}
        {activeView === "details" ? <DossierMetaTable rows={detailsRows} /> : null}
        {activeView === "payment-history" ? (
          hasCodePaymentHistory || paymentHistories.length ? (
            <div className="space-y-8">
              <PaymentCodeHistoryTable account={account} />
              {paymentHistories.map((section) => (
                <HistoryTable key={section.title} title={section.title} rows={section.rows} />
              ))}
            </div>
          ) : (
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
              Payment history was not available for this account.
            </div>
          )
        ) : null}
        {activeView === "account-history" ? (
          accountHistories.length ? (
            <div className="space-y-8">
              {accountHistories.map((section) => (
                <HistoryTable key={section.title} title={section.title} rows={section.rows} />
              ))}
            </div>
          ) : (
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
              Account history tables were not available for this account.
            </div>
          )
        ) : null}
        {activeView === "comments" ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">Comments</div>
              {comments.length ? (
                <div className="space-y-2">
                  {comments.map((comment, index) => (
                    <p key={`${comment}-${index}`} className="text-sm leading-7 text-slate-700">
                      {comment}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
                  No comments reported for this account.
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">Contact Information</div>
              {contactLines.length ? (
                <div className="space-y-2">
                  {contactLines.map((line, index) => (
                    <p key={`${line}-${index}`} className="text-sm leading-7 text-slate-700">
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
                  No contact information reported for this account.
                </div>
              )}
            </div>
          </div>
        ) : null}
        {activeView === "source-report" ? (
          <SourceReportViewer
            sessionId={sourceSessionId}
            pageNumbers={sourcePages}
            title={`${formatValue(account.accountName)} Source Pages`}
            description="These are the report pages used to extract this account."
          />
        ) : null}

        <div className="meta-box-dotted">
          Status: {formatValue(account.status)}
          <br />
          Bal: {formatValue(formatDollarAmount(account.balance ?? account.currentBalance ?? ""))}
        </div>
      </div>
    </article>
  );
};

const renderDetailedReport = (report: CreditReport) => {
  if (report.profileId === "equifax_new_v1") {
    return <EquifaxNewCreditReport report={report} hideExtractionStatus />;
  }

  if (report.profileId === "equifax_old_v1") {
    return <EquifaxCreditReport report={report} hideExtractionStatus />;
  }

  if (report.profileId === "experian_acr_v1" || report.bureau === "Experian") {
    return <ExperianCreditReport report={report} hideExtractionStatus />;
  }

  if (report.profileId === "transunion_acr_v1" || report.bureau === "TransUnion") {
    return <TransUnionCreditReport report={report} hideExtractionStatus />;
  }

  return <EquifaxCreditReport report={report} hideExtractionStatus />;
};

const SectionToggle: React.FC<{
  value: SectionView;
  onChange: (value: SectionView) => void;
  hasSource: boolean;
}> = ({ value, onChange, hasSource }) => (
  <div className="section-tabs">
    <button type="button" className={cn("s-tab", value === "extracted" && "active")} onClick={() => onChange("extracted")}>
      Extracted Data
    </button>
    {hasSource ? (
      <button type="button" className={cn("s-tab", value === "source" && "active")} onClick={() => onChange("source")}>
        Source Report
      </button>
    ) : null}
  </div>
);

interface DossierReportViewProps {
  report: CreditReport;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onDownload: () => void;
}

const DossierReportView: React.FC<DossierReportViewProps> = ({
  report,
  onRefresh,
  onOpenSettings,
  onDownload,
}) => {
  const { advancedUiEnabled } = useReportWorkspace();
  const [activeTab, setActiveTab] = useState<ReportTab>("report");
  const [overviewView, setOverviewView] = useState<SectionView>("extracted");
  const status = useMemo(() => getStatusState(report), [report]);
  const allSourcePages = useMemo(() => collectSourcePages(report), [report]);
  const overviewPages = report.sourceComponents?.reportOverview?.pages ?? [];
  const reportNumber = getReportReference(report);
  const hasDedicatedBureauView =
    report.profileId === "equifax_new_v1" ||
    report.profileId === "equifax_old_v1" ||
    report.profileId === "experian_acr_v1" ||
    report.profileId === "transunion_acr_v1" ||
    report.bureau === "Equifax" ||
    report.bureau === "Experian" ||
    report.bureau === "TransUnion";
  const subtitle = `Report Generated: ${formatValue(report.reportDate)} // System Ref: ${formatValue(reportNumber)}`;

  useEffect(() => {
    if (!advancedUiEnabled && activeTab === "json") {
      setActiveTab("report");
    }
  }, [activeTab, advancedUiEnabled]);

  return (
    <div className="dossier-page">
      <header className="top-bar">
        <div className="tabs-secondary">
          {[
            { key: "report" as const, label: "Report" },
            { key: "source" as const, label: "Source PDF" },
            ...(advancedUiEnabled ? [{ key: "json" as const, label: "Raw JSON" }] : []),
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={cn("tab-sec", activeTab === item.key && "active")}
              onClick={() => setActiveTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button type="button" className="btn" onClick={onOpenSettings}>
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </button>
          <button type="button" className="btn btn-primary" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </header>

      <DossierPageHeader
        title="Credit Report"
        badge={<span className="badge-experian">{report.bureau}</span>}
        subtitle={subtitle}
      />

      <div className={cn("status-row", status.tone === "warning" && "status-row-error")}>
        {status.tone === "success" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <span>{status.message}</span>
      </div>

      {activeTab === "report" ? (
        hasDedicatedBureauView ? (
          <DossierSection className="border-b-0">
            <DossierSectionHeader
              title="Extracted Report Components"
              description="The original bureau-specific extracted sections remain intact here, restyled inside the dossier shell without duplicating report metadata above them."
            />
            <div className="dossier-legacy-surface">{renderDetailedReport(report)}</div>
          </DossierSection>
        ) : (
          <>
            <DossierSection>
              <DossierSectionHeader
                title="Report Overview"
                actions={<SectionToggle value={overviewView} onChange={setOverviewView} hasSource={overviewPages.length > 0} />}
              />
              {overviewView === "extracted" ? (
                <DossierMetaTable rows={getOverviewRows(report)} />
              ) : (
                <SourceReportViewer
                  sessionId={report.sourceSessionId}
                  pageNumbers={overviewPages}
                  title="Report Overview Source Pages"
                  description="These pages support the extracted report overview."
                />
              )}
            </DossierSection>

            <DossierSection>
              <DossierSectionHeader title="Personal Information" />
              <DossierMetaTable rows={getPersonalInfoRows(report)} />
            </DossierSection>

            <DossierSection className="border-b-0">
              <DossierSectionHeader
                title="Trade Lines / Accounts"
                description={`${report.accounts.length} account entries available for review.`}
              />
              {report.accounts.length ? (
                <AccountsList accounts={report.accounts} sourceSessionId={report.sourceSessionId} />
              ) : (
                <div className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
                  No trade lines were extracted for this report.
                </div>
              )}
            </DossierSection>
          </>
        )
      ) : null}

      {activeTab === "source" ? (
        <DossierSection className="border-b-0">
          <DossierSectionHeader
            title="Source PDF"
            description="Union of all source pages referenced by extracted report components."
          />
          <SourceReportViewer
            sessionId={report.sourceSessionId}
            pageNumbers={allSourcePages}
            title="Source Report Pages"
            description="These source pages were referenced across the extracted report components."
          />
        </DossierSection>
      ) : null}

      {advancedUiEnabled && activeTab === "json" ? (
        <DossierSection className="border-b-0">
          <DossierSectionHeader
            title="Raw JSON"
            description="Current mapped client payload for this processed credit report."
          />
          <div className="dossier-json-panel">
            <div className="dossier-json-header">
              <FileJson2 className="h-4 w-4" />
              <span>Mapped Report Payload</span>
            </div>
            <pre className="dossier-json">{JSON.stringify(report, null, 2)}</pre>
          </div>
        </DossierSection>
      ) : null}
    </div>
  );
};

export default DossierReportView;
