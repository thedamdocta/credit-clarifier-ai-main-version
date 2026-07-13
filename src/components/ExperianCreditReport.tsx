import React, { useState } from "react";
import { CreditReport } from "@/lib/types/creditReport";
import ExtractionStatus from "./credit-report/ExtractionStatus";
import ExtractedSourceTabs from "./credit-report/source/ExtractedSourceTabs";
import SourceReportViewer from "./credit-report/source/SourceReportViewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertCircle,
  Building2,
  Calendar,
  CreditCard,
  FileImage,
  FileText,
  Landmark,
  MessageSquare,
  Phone,
  Shield,
} from "lucide-react";
import { inferStructuredAccountClassification } from "@/utils/accountClassification";
import { isNegativeAccountState } from "@/utils/accountNegativeState";
import { humanizeExtractedText } from "@/utils/formatters/accountValueFormatters";
import PaymentHistoryLegend, {
  collectPaymentHistoryLegendCodes,
  PaymentHistoryStatusBadge,
} from "@/components/credit-report/history/PaymentHistoryLegend";
import PublicRecordList from "@/components/credit-report/public-records/PublicRecordList";

type ExperianPaymentHistoryRow = {
  year: string;
  jan?: string;
  feb?: string;
  mar?: string;
  apr?: string;
  may?: string;
  jun?: string;
  jul?: string;
  aug?: string;
  sep?: string;
  oct?: string;
  nov?: string;
  dec?: string;
};

type ExperianStructuredHistoryEvidenceCell = {
  value?: string | null;
};

type ExperianStructuredHistoryEvidenceRow = {
  year?: string | null;
  months?: Partial<Record<"jan" | "feb" | "mar" | "apr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec", ExperianStructuredHistoryEvidenceCell | undefined>>;
};

type ExperianAccount = {
  accountKey?: string;
  accountSubtype?: string;
  reportingCategory?: string;
  legalCategory?: string;
  header?: {
    accountName?: string;
    accountNumber?: string;
    isPotentiallyNegative?: boolean;
    isClosed?: boolean;
  };
  accountInfo?: Record<string, string | null>;
  paymentHistory?: {
    rows?: ExperianPaymentHistoryRow[];
    paymentStatusCodes?: Record<string, string>;
  };
  balanceHistories?: Array<Record<string, string | null>>;
  additionalInfo?: string[];
  historicalInfo?: Record<string, string | null>;
  contactInfo?: {
    address?: string[];
    phoneNumber?: string | null;
  };
  comment?: {
    current?: string[];
    previous?: string[];
  };
  _historyEvidence?: {
    scheduledPaymentHistory?: ExperianStructuredHistoryEvidenceRow[];
    actualPaymentHistory?: ExperianStructuredHistoryEvidenceRow[];
  };
  sourcePages?: number[];
};

type ExperianInquiry = {
  subscriberName?: string | null;
  inquiredOnDates?: string[];
  address?: string[];
  phoneNumber?: string | null;
  description?: string | null;
  sourcePages?: number[];
};

type ExperianCollection = {
  sourceAccountKey?: string;
  accountName?: string;
  accountNumber?: string;
  status?: string | null;
  balance?: string | null;
  originalCreditor?: string | null;
  comments?: string[];
  previousComments?: string[];
  contactInfo?: {
    address?: string[];
    phoneNumber?: string | null;
  };
  sourcePages?: number[];
};

const monthColumns = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const monthLabels: Record<(typeof monthColumns)[number], string> = {
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
};

const normalizeLines = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\n|\|/)
      .map((entry) => entry.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeHistoryCell = (value: unknown, fallback = "-") => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
};

const normalizeMonthlyRows = (rows: unknown, fallback = "-"): ExperianPaymentHistoryRow[] =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      year: normalizeHistoryCell((row as ExperianPaymentHistoryRow | undefined)?.year, ""),
      ...Object.fromEntries(
        monthColumns.map((month) => [month, normalizeHistoryCell((row as ExperianPaymentHistoryRow | undefined)?.[month], fallback)]),
      ),
    }) as ExperianPaymentHistoryRow)
    .filter((row) => row.year || monthColumns.some((month) => row[month] !== fallback));

const normalizeStructuredHistoryRows = (rows: unknown, fallback = "-"): ExperianPaymentHistoryRow[] =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      year: normalizeHistoryCell((row as ExperianStructuredHistoryEvidenceRow | undefined)?.year, ""),
      ...Object.fromEntries(
        monthColumns.map((month) => [
          month,
          normalizeHistoryCell((row as ExperianStructuredHistoryEvidenceRow | undefined)?.months?.[month]?.value, fallback),
        ]),
      ),
    }) as ExperianPaymentHistoryRow)
    .filter((row) => row.year || monthColumns.some((month) => row[month] !== fallback));

const hasReportedMonthlyRows = (rows: ExperianPaymentHistoryRow[], fallback = "-") =>
  rows.some((row) => monthColumns.some((month) => (row[month] ?? fallback) !== fallback));

const ExperianMonthlyHistoryTable: React.FC<{
  title: string;
  rows: ExperianPaymentHistoryRow[];
  valueRenderer?: (value: string) => React.ReactNode;
}> = ({ title, rows, valueRenderer }) => (
  <div className="space-y-3">
    <div className="text-sm font-semibold text-slate-900">{title}</div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Year</TableHead>
          {monthColumns.map((month) => (
            <TableHead key={month}>{monthLabels[month]}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${title}-${row.year}`}>
            <TableCell className="font-semibold">{row.year || "Unknown"}</TableCell>
            {monthColumns.map((month) => {
              const value = String(row[month] ?? "-");
              return (
                <TableCell key={`${title}-${row.year}-${month}`} className="align-top">
                  {valueRenderer ? valueRenderer(value) : <span className={valueClassName(value)}>{value}</span>}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const normalizeObjectEntries = (value: unknown): Array<[string, string]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value as Record<string, unknown>)
    .map(([key, raw]) => [key, String(raw ?? "").replace(/\s+/g, " ").trim()] as [string, string])
    .filter(([, raw]) => raw.length > 0);
};

const formatLabel = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const valueClassName = (value: string) =>
  /^(?:not reported|none|no public records reported\.?|x)$/i.test(value) ? "text-slate-400" : "text-slate-900";

const hasOwnField = (value: unknown, key: string) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key));

const MissingFieldValue: React.FC = () => <span className="font-medium text-red-600">Missing</span>;

const DefinitionRows: React.FC<{ rows: Array<{ label: string; value: React.ReactNode }> }> = ({ rows }) => (
  <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
    {rows.map((row) => (
      <div key={row.label} className="grid gap-3 px-4 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
        <div className="text-sm font-semibold text-slate-900">{row.label}</div>
        <div className="text-sm leading-6">{row.value}</div>
      </div>
    ))}
  </div>
);

const ListValue: React.FC<{ values: string[]; emptyLabel?: string }> = ({ values, emptyLabel = "Not reported" }) => {
  if (values.length === 0) {
    return <span className="text-slate-400">{emptyLabel}</span>;
  }
  return (
    <div className="space-y-1">
      {values.map((value, index) => (
        <p key={`${value}-${index}`} className={valueClassName(value)}>{value}</p>
      ))}
    </div>
  );
};

const ExperianAccountCard: React.FC<{
  account: ExperianAccount;
  sourceSessionId?: string | null;
}> = ({ account, sourceSessionId }) => {
  const [activeTab, setActiveTab] = useState("summary");
  const accountName = account.header?.accountName ?? account.accountInfo?.accountName ?? "Not reported";
  const accountNumber = account.header?.accountNumber ?? account.accountInfo?.accountNumber ?? "Not reported";
  const isPotentiallyNegative = Boolean(account.header?.isPotentiallyNegative);
  const isClosed = Boolean(account.header?.isClosed);
  const accountInfoEntries = normalizeObjectEntries(account.accountInfo);
  const hasExplicitBalanceField = hasOwnField(account.accountInfo, "balance");
  const normalizedAccountInfoKeys = new Set(accountInfoEntries.map(([label]) => label));
  const accountInfoRows = accountInfoEntries.map(([label, value]) => ({
    label: formatLabel(label),
    value: <span className={valueClassName(value)}>{value}</span>,
  }));
  if (!hasExplicitBalanceField) {
    accountInfoRows.push({
      label: "Balance",
      value: <MissingFieldValue />,
    });
  } else if (!normalizedAccountInfoKeys.has("balance")) {
    accountInfoRows.push({
      label: "Balance",
      value: <span className="text-slate-400">Not reported</span>,
    });
  }
  const additionalInfoEntries = normalizeLines(account.additionalInfo);
  const historicalEntries = normalizeObjectEntries(account.historicalInfo);
  const currentComments = normalizeLines(account.comment?.current);
  const previousComments = normalizeLines(account.comment?.previous);
  const contactAddress = normalizeLines(account.contactInfo?.address);
  const paymentHistoryRows = normalizeMonthlyRows(account.paymentHistory?.rows, "X");
  const paymentHistoryLegendCodes = collectPaymentHistoryLegendCodes(
    paymentHistoryRows.flatMap((row) => monthColumns.map((month) => row[month]))
  );
  const scheduledPaymentHistoryRows = normalizeStructuredHistoryRows(account._historyEvidence?.scheduledPaymentHistory);
  const actualPaymentHistoryRows = normalizeStructuredHistoryRows(account._historyEvidence?.actualPaymentHistory);
  const hasPaymentStatusHistory = paymentHistoryRows.length > 0;
  const hasScheduledPaymentHistory = hasReportedMonthlyRows(scheduledPaymentHistoryRows);
  const hasActualPaymentHistory = hasReportedMonthlyRows(actualPaymentHistoryRows);
  const inferredClassification = inferStructuredAccountClassification([
    account.accountSubtype,
    account.reportingCategory,
    account.legalCategory,
    accountName,
    accountNumber,
    account.accountInfo?.accountType,
    account.accountInfo?.loanType,
    account.accountInfo?.status,
    account.additionalInfo,
    account.comment?.current,
    account.comment?.previous,
  ]);
  const resolvedSubtype = account.accountSubtype ?? inferredClassification.accountSubtype ?? "Not reported";
  const resolvedReportingCategory = account.reportingCategory ?? inferredClassification.reportingCategory ?? "Not reported";
  const resolvedLegalCategory = account.legalCategory ?? inferredClassification.legalCategory ?? "Not reported";
  const isNegativeAccount = isNegativeAccountState({
    explicitNegative: isPotentiallyNegative,
    reportingCategory: resolvedReportingCategory,
    legalCategory: resolvedLegalCategory,
    status: account.accountInfo?.status,
    accountStatus: account.accountInfo?.accountStatus,
    accountType: account.accountInfo?.accountType,
    loanType: account.accountInfo?.loanType,
    creditorClassification: account.accountInfo?.creditorClassification,
    comments: [...currentComments, ...previousComments, ...additionalInfoEntries],
    paymentHistoryRows,
    paymentStatusCodes: account.paymentHistory?.paymentStatusCodes,
  });
  const formatStructuredValue = (value: string) => humanizeExtractedText(value).trim() || "Not reported";
  const summaryRows = [
    { label: "Account Name", value: <span className={valueClassName(accountName)}>{accountName}</span> },
    { label: "Account Number", value: <span className={valueClassName(accountNumber)}>{accountNumber}</span> },
    {
      label: "Account Type",
      value: (
        <span className={valueClassName(account.accountInfo?.accountType ?? "Not reported")}>
          {account.accountInfo?.accountType ?? "Not reported"}
        </span>
      ),
    },
    {
      label: "Subtype",
      value: (
        <span className={valueClassName(resolvedSubtype)}>
          {formatStructuredValue(resolvedSubtype)}
        </span>
      ),
    },
    {
      label: "Reporting Category",
      value: (
        <span className={valueClassName(resolvedReportingCategory)}>
          {formatStructuredValue(resolvedReportingCategory)}
        </span>
      ),
    },
    {
      label: "Legal Category",
      value: (
        <span className={valueClassName(resolvedLegalCategory)}>
          {formatStructuredValue(resolvedLegalCategory)}
        </span>
      ),
    },
  ];

  const accountClassificationRows = [
    {
      label: "Subtype",
      value: <span className={valueClassName(resolvedSubtype)}>{formatStructuredValue(resolvedSubtype)}</span>,
    },
    {
      label: "Reporting Category",
      value: <span className={valueClassName(resolvedReportingCategory)}>{formatStructuredValue(resolvedReportingCategory)}</span>,
    },
    {
      label: "Legal Category",
      value: <span className={valueClassName(resolvedLegalCategory)}>{formatStructuredValue(resolvedLegalCategory)}</span>,
    },
  ];

  return (
    <Card className={isNegativeAccount ? "border-[#f0a8a0] bg-[#fff7f6]" : "border-black/80 bg-white"}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-slate-900">
              <CreditCard className="h-5 w-5 text-slate-500" />
              <span>{accountName}</span>
              <Badge variant="outline">{accountNumber}</Badge>
              {isClosed ? <Badge variant="secondary">Closed</Badge> : null}
              {isNegativeAccount ? <Badge variant="destructive">Negative Account</Badge> : null}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 max-w-full">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="account-info">Account Info</TabsTrigger>
            <TabsTrigger value="payment-history">Payment History</TabsTrigger>
            <TabsTrigger value="balance-histories">Balance Histories</TabsTrigger>
            <TabsTrigger value="additional-info">Additional Info</TabsTrigger>
            <TabsTrigger value="historical-info">Historical Info</TabsTrigger>
            <TabsTrigger value="contact-info">Contact Info</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="source-report">Source Report</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <DefinitionRows rows={summaryRows} />
          </TabsContent>

          <TabsContent value="account-info">
            <DefinitionRows
              rows={accountInfoRows.length > 0
                ? [...accountClassificationRows, ...accountInfoRows]
                : [{ label: "Account Info", value: <span className="text-slate-400">Not reported</span> }]}
            />
          </TabsContent>

          <TabsContent value="payment-history">
            {hasPaymentStatusHistory || hasScheduledPaymentHistory || hasActualPaymentHistory ? (
              <div className="space-y-8">
                {hasPaymentStatusHistory ? (
                  <div className="space-y-4">
                    <PaymentHistoryLegend
                      codes={paymentHistoryLegendCodes}
                      helperText="The same status styling is used across the app: green is current, red is derogatory, and gray is missing, unavailable, closed, or not yet rated."
                    />
                    <ExperianMonthlyHistoryTable
                      title="Payment Status History"
                      rows={paymentHistoryRows}
                      valueRenderer={(value) => <PaymentHistoryStatusBadge value={String(value ?? "X")} />}
                    />
                  </div>
                ) : null}

                {hasScheduledPaymentHistory ? (
                  <ExperianMonthlyHistoryTable
                    title="Scheduled Payment History"
                    rows={scheduledPaymentHistoryRows}
                  />
                ) : null}

                {hasActualPaymentHistory ? (
                  <ExperianMonthlyHistoryTable
                    title="Actual Payment History"
                    rows={actualPaymentHistoryRows}
                  />
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                Payment history was not extracted for this account.
              </div>
            )}
          </TabsContent>

          <TabsContent value="balance-histories">
            {Array.isArray(account.balanceHistories) && account.balanceHistories.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(account.balanceHistories[0]).map((key) => (
                      <TableHead key={key}>{formatLabel(key)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.balanceHistories.map((entry, index) => (
                    <TableRow key={`balance-${index}`}>
                      {Object.keys(account.balanceHistories?.[0] ?? {}).map((key) => {
                        const value = String(entry[key] ?? "Not reported");
                        return (
                          <TableCell key={`${index}-${key}`} className={valueClassName(value)}>
                            {value}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                No balance histories were extracted for this account.
              </div>
            )}
          </TabsContent>

          <TabsContent value="additional-info">
            <DefinitionRows
              rows={[
                {
                  label: "Details",
                  value: <ListValue values={additionalInfoEntries} />,
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="historical-info">
            <DefinitionRows
              rows={historicalEntries.length > 0
                ? historicalEntries.map(([label, value]) => ({
                    label: formatLabel(label),
                    value: <span className={valueClassName(value)}>{value}</span>,
                  }))
                : [{ label: "Historical Info", value: <span className="text-slate-400">Not reported</span> }]}
            />
          </TabsContent>

          <TabsContent value="contact-info">
            <DefinitionRows
              rows={[
                {
                  label: "Address",
                  value: <ListValue values={contactAddress} />,
                },
                {
                  label: "Phone Number",
                  value: <span className={valueClassName(account.contactInfo?.phoneNumber ?? "Not reported")}>{account.contactInfo?.phoneNumber ?? "Not reported"}</span>,
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="comments">
            <DefinitionRows
              rows={[
                {
                  label: "Current",
                  value: <ListValue values={currentComments} />,
                },
                {
                  label: "Previous",
                  value: <ListValue values={previousComments} />,
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="source-report">
            {activeTab === "source-report" ? (
              <SourceReportViewer
                sessionId={sourceSessionId}
                pageNumbers={account.sourcePages}
                title={`${accountName} Source Pages`}
                description="These are the report pages used to extract this Experian account. A page may appear in more than one account or component when the report continues a section across pages."
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const ExperianCollectionCard: React.FC<{
  entry: ExperianCollection;
  sourceSessionId?: string | null;
}> = ({ entry, sourceSessionId }) => {
  const [activeTab, setActiveTab] = useState("summary");
  const accountName = entry.accountName ?? "Not reported";
  const accountNumber = entry.accountNumber ?? "Not reported";
  const currentComments = normalizeLines(entry.comments);
  const previousComments = normalizeLines(entry.previousComments);
  const contactAddress = normalizeLines(entry.contactInfo?.address);

  return (
    <Card className="border-black/80 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-slate-900">
          <Landmark className="h-5 w-5 text-slate-500" />
          <span>{accountName}</span>
          <Badge variant="outline">{accountNumber}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 max-w-full">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="details">Collection Details</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="source-report">Source Report</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <DefinitionRows
              rows={[
                { label: "Account Name", value: <span className={valueClassName(accountName)}>{accountName}</span> },
                { label: "Account Number", value: <span className={valueClassName(accountNumber)}>{accountNumber}</span> },
                { label: "Status", value: <span className={valueClassName(entry.status ?? "Not reported")}>{entry.status ?? "Not reported"}</span> },
                { label: "Balance", value: <span className={valueClassName(entry.balance ?? "Not reported")}>{entry.balance ?? "Not reported"}</span> },
                { label: "Original Creditor", value: <span className={valueClassName(entry.originalCreditor ?? "Not reported")}>{entry.originalCreditor ?? "Not reported"}</span> },
              ]}
            />
          </TabsContent>

          <TabsContent value="details">
            <DefinitionRows
              rows={[
                { label: "Contact Address", value: <ListValue values={contactAddress} /> },
                {
                  label: "Phone Number",
                  value: <span className={valueClassName(entry.contactInfo?.phoneNumber ?? "Not reported")}>{entry.contactInfo?.phoneNumber ?? "Not reported"}</span>,
                },
                {
                  label: "Source Account Key",
                  value: <span className={valueClassName(entry.sourceAccountKey ?? "Not reported")}>{entry.sourceAccountKey ?? "Not reported"}</span>,
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="comments">
            <DefinitionRows
              rows={[
                { label: "Current", value: <ListValue values={currentComments} /> },
                { label: "Previous", value: <ListValue values={previousComments} /> },
              ]}
            />
          </TabsContent>

          <TabsContent value="source-report">
            {activeTab === "source-report" ? (
              <SourceReportViewer
                sessionId={sourceSessionId}
                pageNumbers={entry.sourcePages}
                title={`${accountName} Source Pages`}
                description="These are the report pages used to support this Experian collection entry. Collection tradelines are preserved in Accounts and also shown here in Collections."
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const ExperianCreditReport: React.FC<{ report: CreditReport; hideExtractionStatus?: boolean }> = ({
  report,
  hideExtractionStatus = false,
}) => {
  const components = (report.components ?? {}) as Record<string, any>;
  const reportOverview = components.reportOverview ?? {};
  const personalInformation = components.personalInformation ?? {};
  const accountsComponent = components.accounts ?? { accountCount: 0, accounts: [] };
  const publicRecords = Array.isArray(report.publicRecords) ? report.publicRecords : [];
  const hardInquiries = components.hardInquiries ?? { inquiryCount: 0, inquiries: [] };
  const softInquiries = components.softInquiries ?? { inquiryCount: 0, inquiries: [] };

  const overviewRows = [
    { label: "Consumer Name", value: reportOverview.consumerName ?? "Not reported" },
    { label: "Date Generated", value: reportOverview.dateGenerated ?? "Not reported" },
    { label: "Report Number", value: reportOverview.reportNumber ?? "Not reported" },
    { label: "At-a-Glance", value: `${reportOverview.atAGlance?.accountCount ?? 0} Accounts, ${reportOverview.atAGlance?.publicRecordCount ?? 0} Public Records, ${reportOverview.atAGlance?.hardInquiryCount ?? 0} Hard Inquiries` },
    { label: "Personal Information Counts", value: `${reportOverview.personalInfoCounts?.nameCount ?? 0} Names, ${reportOverview.personalInfoCounts?.addressCount ?? 0} Addresses, ${reportOverview.personalInfoCounts?.employerCount ?? 0} Employers, ${reportOverview.personalInfoCounts?.personalStatementCount ?? 0} Personal Statements, ${reportOverview.personalInfoCounts?.otherRecordCount ?? 0} Other Records` },
  ];

  return (
    <div className="space-y-6">
      {!hideExtractionStatus ? <ExtractionStatus report={report} /> : null}

      <Card className="border-black/80 bg-white">
        <CardHeader>
          <CardTitle>Report Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.reportOverview?.pages}
            sourceTitle="Report Overview Source Pages"
            sourceDescription="These report pages support the extracted Experian overview and At-a-Glance data."
            tabsClassName="mb-4"
          >
            <DefinitionRows
              rows={overviewRows.map((row) => ({
                ...row,
                value: <span className={valueClassName(String(row.value))}>{row.value}</span>,
              }))}
            />
          </ExtractedSourceTabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.personalInformation?.pages}
            sourceTitle="Personal Information Source Pages"
            sourceDescription="These report pages support the extracted Experian personal information section."
            tabsClassName="mb-4"
          >
            <DefinitionRows
              rows={[
                { label: "Names", value: <ListValue values={normalizeLines(personalInformation.names)} /> },
                { label: "Addresses", value: <ListValue values={normalizeLines(personalInformation.addresses)} /> },
                { label: "Year of Birth", value: <span className={valueClassName(personalInformation.yearOfBirth ?? "Not reported")}>{personalInformation.yearOfBirth ?? "Not reported"}</span> },
                { label: "Phone Numbers", value: <ListValue values={normalizeLines(personalInformation.phoneNumbers)} /> },
                { label: "Employers", value: <ListValue values={normalizeLines(personalInformation.employers)} /> },
                { label: "Personal Statements", value: <ListValue values={normalizeLines(personalInformation.personalStatements)} /> },
                { label: "Other Records", value: <ListValue values={normalizeLines(personalInformation.otherRecords)} /> },
              ]}
            />
          </ExtractedSourceTabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.accounts?.pages}
            sourceTitle="Accounts Source Pages"
            sourceDescription="These report pages support the extracted Experian accounts section."
            tabsClassName="mb-4"
          >
            <div className="space-y-2 text-sm text-slate-500">
              <p>{accountsComponent.accountCount ?? 0} account entries extracted from the Experian Annual Credit Report layout.</p>
            </div>
          </ExtractedSourceTabs>

          <div className="space-y-4">
            {(Array.isArray(accountsComponent.accounts) ? accountsComponent.accounts : []).map((account: ExperianAccount, index: number) => (
              <ExperianAccountCard
                key={`${account.accountKey ?? account.header?.accountName ?? "account"}-${index}`}
                account={account}
                sourceSessionId={report.sourceSessionId}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#f0a8a0] bg-[#fff7f6]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <span>Public Records</span>
            <Badge variant="destructive">Negative Public Record</Badge>
            <Badge variant="outline">{String(publicRecords.length)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.publicRecords?.pages}
            sourceTitle="Public Records Source Pages"
            sourceDescription="These report pages support the extracted Experian public records section."
            tabsClassName="mb-4"
          >
            <DefinitionRows
              rows={[
                {
                  label: "Public Record Count",
                  value: <span className={valueClassName(String(publicRecords.length))}>{String(publicRecords.length)}</span>,
                },
              ]}
            />
            <div className="mt-4">
              <PublicRecordList records={publicRecords} />
            </div>
          </ExtractedSourceTabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hard Inquiries</CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.hardInquiries?.pages}
            sourceTitle="Hard Inquiries Source Pages"
            sourceDescription="These report pages support the extracted hard inquiry cards."
            tabsClassName="mb-4"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subscriber</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(hardInquiries.inquiries) ? hardInquiries.inquiries : []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-slate-400">No hard inquiries extracted</TableCell>
                  </TableRow>
                ) : (
                  (hardInquiries.inquiries as ExperianInquiry[]).map((entry, index) => (
                    <TableRow key={`hard-${index}`}>
                      <TableCell>{entry.subscriberName ?? "Not reported"}</TableCell>
                      <TableCell><ListValue values={normalizeLines(entry.inquiredOnDates)} /></TableCell>
                      <TableCell><ListValue values={[...normalizeLines(entry.address), ...(entry.phoneNumber ? [entry.phoneNumber] : [])]} /></TableCell>
                      <TableCell className={valueClassName(entry.description ?? "Not reported")}>{entry.description ?? "Not reported"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ExtractedSourceTabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Soft Inquiries</CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.softInquiries?.pages}
            sourceTitle="Soft Inquiries Source Pages"
            sourceDescription="These report pages support the extracted soft inquiry cards."
            tabsClassName="mb-4"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subscriber</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(softInquiries.inquiries) ? softInquiries.inquiries : []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-slate-400">No soft inquiries extracted</TableCell>
                  </TableRow>
                ) : (
                  (softInquiries.inquiries as ExperianInquiry[]).map((entry, index) => (
                    <TableRow key={`soft-${index}`}>
                      <TableCell>{entry.subscriberName ?? "Not reported"}</TableCell>
                      <TableCell><ListValue values={normalizeLines(entry.inquiredOnDates)} /></TableCell>
                      <TableCell><ListValue values={[...normalizeLines(entry.address), ...(entry.phoneNumber ? [entry.phoneNumber] : [])]} /></TableCell>
                      <TableCell className={valueClassName(entry.description ?? "Not reported")}>{entry.description ?? "Not reported"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ExtractedSourceTabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExperianCreditReport;
