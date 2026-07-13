import React, { useMemo, useState } from "react";
import { CreditReport } from "@/lib/types/creditReport";
import ExtractionStatus from "./credit-report/ExtractionStatus";
import ExtractedSourceTabs from "./credit-report/source/ExtractedSourceTabs";
import SourceReportViewer from "./credit-report/source/SourceReportViewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, FileText, Search, Shield, UserRound } from "lucide-react";
import { inferStructuredAccountClassification } from "@/utils/accountClassification";
import { isNegativeAccountState } from "@/utils/accountNegativeState";
import { humanizeExtractedText } from "@/utils/formatters/accountValueFormatters";
import PaymentHistoryLegend, {
  collectPaymentHistoryLegendCodes,
  isRecognizedPaymentHistoryCode,
  PaymentHistoryStatusBadge,
} from "@/components/credit-report/history/PaymentHistoryLegend";
import PublicRecordList from "@/components/credit-report/public-records/PublicRecordList";

type TransUnionOverview = {
  consumerName?: string;
  fileNumber?: string;
  dateCreated?: string;
  creditReportDate?: string;
};

type TransUnionPersonalInformation = {
  name?: string;
  alsoKnownAs?: string[];
  currentAddresses?: string[];
  previousAddresses?: string[];
  addresses?: string[];
  phoneNumbers?: string[];
  employers?: string[];
  socialSecurityNumber?: string;
  dateOfBirth?: string;
};

type TransUnionHistoryRow = {
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
};

type TransUnionBalanceHistory = {
  label: string;
  rows: TransUnionHistoryRow[];
};

type TransUnionAccount = {
  accountName?: string;
  accountNumber?: string;
  accountSubtype?: string;
  reportingCategory?: string;
  legalCategory?: string;
  sectionType?: "adverse" | "satisfactory";
  isPotentiallyNegative?: boolean;
  isClosed?: boolean;
  accountInfo?: Record<string, string>;
  contactInfo?: {
    address?: string[];
    phoneNumber?: string;
  };
  paymentHistory?: TransUnionHistoryRow[];
  paymentHistoryYears?: string[];
  balanceHistories?: TransUnionBalanceHistory[];
  sourcePages?: number[];
};

type TransUnionAccountComponent = {
  accountCount?: number;
  accounts?: TransUnionAccount[];
};

type TransUnionInquiry = {
  subscriberName?: string;
  location?: string;
  requestedOn?: string;
  phoneNumber?: string;
  sourcePages?: number[];
};

type TransUnionInquiryComponent = {
  inquiryCount?: number;
  inquiries?: TransUnionInquiry[];
};

const MONTH_COLUMNS = [
  ["jan", "Jan"],
  ["feb", "Feb"],
  ["mar", "Mar"],
  ["apr", "Apr"],
  ["may", "May"],
  ["jun", "Jun"],
  ["jul", "Jul"],
  ["aug", "Aug"],
  ["sep", "Sep"],
  ["oct", "Oct"],
  ["nov", "Nov"],
  ["dec", "Dec"],
] as const;

const ACCOUNT_INFO_LABELS: Array<[string, string]> = [
  ["accountType", "Account Type"],
  ["loanType", "Loan Type"],
  ["balance", "Balance"],
  ["dateOpened", "Date Opened"],
  ["responsibility", "Responsibility"],
  ["dateUpdated", "Date Updated"],
  ["paymentReceived", "Payment Received"],
  ["lastPaymentMade", "Last Payment Made"],
  ["payStatus", "Pay Status"],
  ["terms", "Terms"],
  ["dateClosed", "Date Closed"],
  ["estimatedRemoval", "Estimated Removal"],
  ["amountPastDue", "Past Due"],
  ["monthlyPayment", "Monthly Payment"],
  ["highCredit", "High Credit"],
  ["originalCreditor", "Original Creditor"],
  ["remarks", "Remarks"],
];

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

const valueClassName = (value: string) =>
  /^(?:not reported|none|x)$/i.test(value) ? "text-slate-400" : "text-slate-900";

const hasOwnField = (value: unknown, key: string) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key));

const MissingFieldValue: React.FC = () => <span className="font-medium text-red-600">Missing</span>;

const hasReportedValue = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized !== "" && !/^(?:not reported|none)$/i.test(normalized);
};

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
        <p key={`${value}-${index}`} className={valueClassName(value)}>
          {value}
        </p>
      ))}
    </div>
  );
};

const collectPublicRecordSourcePages = (report: CreditReport) => {
  const componentPages = report.sourceComponents?.publicRecords?.pages ?? [];
  if (componentPages.length > 0) {
    return componentPages;
  }
  return Array.from(
    new Set(
      (Array.isArray(report.publicRecords) ? report.publicRecords : []).flatMap((record) => record.sourcePages ?? []),
    ),
  ).sort((left, right) => left - right);
};

const renderHistoryValue = (value: string) => {
  const normalized = String(value ?? "").trim() || "---";
  const tone = /^(?:---|not reported)$/i.test(normalized) ? "text-slate-400" : /^(?:30|60|90|120|COL|C\/O|VS|RPO)$/i.test(normalized) ? "text-red-600" : "text-slate-900";
  return <span className={tone}>{normalized}</span>;
};

const HistoryTable: React.FC<{
  title: string;
  rows: TransUnionHistoryRow[];
  emptyLabel?: string;
  usePaymentStatusLegend?: boolean;
}> = ({ title, rows, emptyLabel = "Not reported", usePaymentStatusLegend = false }) => {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-400">
        {title}: {emptyLabel}
      </div>
    );
  }

  const legendCodes = usePaymentStatusLegend
    ? collectPaymentHistoryLegendCodes(rows.flatMap((row) => MONTH_COLUMNS.map(([key]) => row[key as keyof TransUnionHistoryRow])))
    : [];

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {usePaymentStatusLegend ? (
        <PaymentHistoryLegend
          codes={legendCodes}
          helperText="This TransUnion payment-history legend now follows the same styling as the rest of the app: green is current, red is derogatory, and gray is missing or unavailable."
        />
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-3 py-2 font-medium">Year</th>
              {MONTH_COLUMNS.map(([, label]) => (
                <th key={label} className="px-3 py-2 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} className="border-b border-slate-100 last:border-b-0">
                <td className="px-3 py-2 font-semibold text-slate-900">{row.year}</td>
                {MONTH_COLUMNS.map(([key]) => (
                  <td key={`${row.year}-${key}`} className="px-3 py-2">
                    {usePaymentStatusLegend && isRecognizedPaymentHistoryCode(row[key as keyof TransUnionHistoryRow])
                      ? <PaymentHistoryStatusBadge value={row[key as keyof TransUnionHistoryRow]} />
                      : renderHistoryValue(String(row[key as keyof TransUnionHistoryRow] ?? "---"))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const InquiryTable: React.FC<{ title: string; entries: TransUnionInquiry[] }> = ({ title, entries }) => (
  <div className="space-y-3">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-4 py-3 font-medium">Subscriber</th>
            <th className="px-4 py-3 font-medium">Requested On</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium">Phone</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-slate-400">No inquiry entries reported.</td>
            </tr>
          ) : (
            entries.map((entry, index) => (
              <tr key={`${entry.subscriberName}-${entry.requestedOn}-${index}`} className="border-b border-slate-100 last:border-b-0">
                <td className="px-4 py-3 text-slate-900">{entry.subscriberName || "Not reported"}</td>
                <td className="px-4 py-3 text-slate-900">{entry.requestedOn || "Not reported"}</td>
                <td className="px-4 py-3 text-slate-900">{entry.location || "Not reported"}</td>
                <td className="px-4 py-3 text-slate-900">{entry.phoneNumber || "Not reported"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const TransUnionAccountCard: React.FC<{
  account: TransUnionAccount;
  sourceSessionId?: string | null;
}> = ({ account, sourceSessionId }) => {
  const [activeTab, setActiveTab] = useState("summary");
  const info = account.accountInfo ?? {};
  const contact = account.contactInfo ?? {};
  const inferredClassification = inferStructuredAccountClassification([
    account.accountSubtype,
    account.reportingCategory,
    account.legalCategory,
    account.accountName,
    account.accountNumber,
    info.accountType,
    info.loanType,
    info.payStatus,
    info.remarks,
  ]);
  const resolvedSubtype = account.accountSubtype ?? inferredClassification.accountSubtype ?? "Not reported";
  const resolvedReportingCategory = account.reportingCategory ?? inferredClassification.reportingCategory ?? "Not reported";
  const resolvedLegalCategory = account.legalCategory ?? inferredClassification.legalCategory ?? "Not reported";
  const isNegativeAccount = isNegativeAccountState({
    explicitNegative: account.isPotentiallyNegative,
    reportingCategory: resolvedReportingCategory,
    legalCategory: resolvedLegalCategory,
    status: info.payStatus,
    accountStatus: info.accountStatus,
    accountType: info.accountType,
    loanType: info.loanType,
    creditorClassification: info.creditorClassification,
    comments: [info.remarks],
    paymentHistoryRows: account.paymentHistory,
  });
  const formatStructuredValue = (value: string) => humanizeExtractedText(value).trim() || "Not reported";
  const summaryRows = [
    { label: "Account Name", value: <span className={valueClassName(account.accountName ?? "Not reported")}>{account.accountName ?? "Not reported"}</span> },
    { label: "Account Number", value: <span className={valueClassName(account.accountNumber ?? "Not reported")}>{account.accountNumber ?? "Not reported"}</span> },
    { label: "Account Type", value: <span className={valueClassName(info.accountType ?? "Not reported")}>{info.accountType ?? "Not reported"}</span> },
    { label: "Subtype", value: <span className={valueClassName(resolvedSubtype)}>{formatStructuredValue(resolvedSubtype)}</span> },
    { label: "Reporting Category", value: <span className={valueClassName(resolvedReportingCategory)}>{formatStructuredValue(resolvedReportingCategory)}</span> },
    { label: "Legal Category", value: <span className={valueClassName(resolvedLegalCategory)}>{formatStructuredValue(resolvedLegalCategory)}</span> },
    { label: "Pay Status", value: <span className={valueClassName(info.payStatus ?? "Not reported")}>{info.payStatus ?? "Not reported"}</span> },
  ];
  const labelFor = (key: string, fallback: string) => String(info[`${key}DisplayLabel`] ?? fallback);
  const accountInfoRows = ACCOUNT_INFO_LABELS.map(([key, label]) => ({
    label,
    value:
      key === "balance" && !hasOwnField(info, key)
        ? <MissingFieldValue />
        : <span className={valueClassName(info[key] || "Not reported")}>{info[key] || "Not reported"}</span>,
  }));

  const creditLimitValue = hasReportedValue(info.creditLimit)
    ? info.creditLimit
    : hasReportedValue(info.creditLimitHistory)
      ? info.creditLimitHistory
      : "Not reported";
  const creditLimitLabel = hasReportedValue(info.creditLimit)
    ? labelFor("creditLimit", "Credit Limit")
    : hasReportedValue(info.creditLimitHistory)
      ? labelFor("creditLimitHistory", "Credit Limit (Hist.)")
      : "Credit Limit";

  const highBalanceLabel = labelFor("highBalance", "High Balance");
  const highBalanceValue = info.highBalance ?? "Not reported";

  const adaptiveRows = [
    {
      label: creditLimitLabel,
      value: <span className={valueClassName(creditLimitValue)}>{creditLimitValue}</span>,
    },
    {
      label: highBalanceLabel,
      value: <span className={valueClassName(highBalanceValue)}>{highBalanceValue}</span>,
    },
  ];

  const classificationRows = [
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
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-slate-900">
          <CreditCard className="h-5 w-5 text-slate-500" />
          <span>{account.accountName ?? "Not reported"}</span>
          <Badge variant="outline">{account.accountNumber ?? "Not reported"}</Badge>
          {isNegativeAccount ? <Badge variant="destructive">Negative Account</Badge> : null}
          {account.isClosed ? <Badge variant="secondary">Closed</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 max-w-full">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="account-info">Account Info</TabsTrigger>
            <TabsTrigger value="payment-history">Payment History</TabsTrigger>
            <TabsTrigger value="balance-histories">Balance Histories</TabsTrigger>
            <TabsTrigger value="contact-info">Contact Info</TabsTrigger>
            <TabsTrigger value="source-report">Source Report</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <DefinitionRows rows={summaryRows} />
          </TabsContent>

          <TabsContent value="account-info">
            <DefinitionRows rows={[...classificationRows, ...accountInfoRows.slice(0, 11), ...adaptiveRows, ...accountInfoRows.slice(11)]} />
          </TabsContent>

          <TabsContent value="payment-history">
            <HistoryTable
              title="Payment History"
              rows={Array.isArray(account.paymentHistory) ? account.paymentHistory : []}
              usePaymentStatusLegend
            />
          </TabsContent>

          <TabsContent value="balance-histories">
            <div className="space-y-4">
              {(Array.isArray(account.balanceHistories) ? account.balanceHistories : []).length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-400">No balance history tables were extracted.</div>
              ) : (
                (account.balanceHistories as TransUnionBalanceHistory[]).map((history) => (
                  <HistoryTable key={history.label} title={history.label} rows={history.rows} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="contact-info">
            <DefinitionRows
              rows={[
                { label: "Address", value: <ListValue values={normalizeLines(contact.address)} /> },
                { label: "Phone Number", value: <span className={valueClassName(contact.phoneNumber ?? "Not reported")}>{contact.phoneNumber ?? "Not reported"}</span> },
              ]}
            />
          </TabsContent>

          <TabsContent value="source-report">
            <SourceReportViewer
              title={`${account.accountName ?? "Account"} Source Pages`}
              description="These are the report pages linked to this extracted TransUnion account."
              pages={account.sourcePages ?? []}
              sourceSessionId={sourceSessionId}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const AccountSection: React.FC<{
  title: string;
  description: string;
  accountsComponent: TransUnionAccountComponent;
  pageNumbers?: number[];
  sourceSessionId?: string | null;
}> = ({ title, description, accountsComponent, pageNumbers, sourceSessionId }) => (
  <Card className="border-black/80 bg-white">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-xl">
        <CreditCard className="h-5 w-5 text-slate-500" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      <ExtractedSourceTabs
        extractedContent={<p className="text-sm text-slate-600">{accountsComponent.accountCount ?? 0} accounts extracted from this TransUnion section.</p>}
        sourceContent={
          <SourceReportViewer
            title={`${title} Source Pages`}
            description={description}
            pages={pageNumbers ?? []}
            sourceSessionId={sourceSessionId}
          />
        }
      />

      <div className="space-y-6">
        {(Array.isArray(accountsComponent.accounts) ? accountsComponent.accounts : []).map((account, index) => (
          <TransUnionAccountCard
            key={`${account.accountName}-${account.accountNumber}-${index}`}
            account={account}
            sourceSessionId={sourceSessionId}
          />
        ))}
      </div>
    </CardContent>
  </Card>
);

const TransUnionCreditReport: React.FC<{ report: CreditReport; hideExtractionStatus?: boolean }> = ({
  report,
  hideExtractionStatus = false,
}) => {
  const components = report.components ?? {};
  const overview = (components.reportOverview ?? {}) as TransUnionOverview;
  const personal = (components.personalInformation ?? {}) as TransUnionPersonalInformation;
  const adverseAccounts = (components.adverseAccounts ?? { accountCount: 0, accounts: [] }) as TransUnionAccountComponent;
  const satisfactoryAccounts = (components.satisfactoryAccounts ?? { accountCount: 0, accounts: [] }) as TransUnionAccountComponent;
  const inquiries = (components.inquiries ?? { inquiryCount: 0, inquiries: [] }) as TransUnionInquiryComponent;
  const accountReviewInquiries = (components.accountReviewInquiries ?? { inquiryCount: 0, inquiries: [] }) as TransUnionInquiryComponent;
  const visibleInquiryComponent =
    (accountReviewInquiries.inquiryCount ?? 0) > 0 ||
    (Array.isArray(accountReviewInquiries.inquiries) && accountReviewInquiries.inquiries.length > 0)
      ? accountReviewInquiries
      : inquiries;
  const visibleInquiryPages =
    visibleInquiryComponent === accountReviewInquiries
      ? report.sourceComponents?.accountReviewInquiries?.pages ?? []
      : report.sourceComponents?.inquiries?.pages ?? [];
  const publicRecords = Array.isArray(report.publicRecords) ? report.publicRecords : [];
  const publicRecordSourcePages = collectPublicRecordSourcePages(report);
  const totalAccounts = useMemo(
    () => (adverseAccounts.accountCount ?? 0) + (satisfactoryAccounts.accountCount ?? 0),
    [adverseAccounts.accountCount, satisfactoryAccounts.accountCount]
  );

  return (
    <div className="space-y-6">
      {!hideExtractionStatus ? <ExtractionStatus report={report} /> : null}

      <Card className="border-black/80 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-slate-500" />
            Report Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            extractedContent={
              <DefinitionRows
                rows={[
                  { label: "Consumer Name", value: <span className={valueClassName(overview.consumerName ?? "Not reported")}>{overview.consumerName ?? "Not reported"}</span> },
                  { label: "File Number", value: <span className={valueClassName(overview.fileNumber ?? "Not reported")}>{overview.fileNumber ?? "Not reported"}</span> },
                  { label: "Date Created", value: <span className={valueClassName(overview.dateCreated ?? "Not reported")}>{overview.dateCreated ?? "Not reported"}</span> },
                  { label: "Credit Report Date", value: <span className={valueClassName(overview.creditReportDate ?? "Not reported")}>{overview.creditReportDate ?? "Not reported"}</span> },
                  { label: "Total Accounts", value: <span className="text-slate-900">{totalAccounts}</span> },
                ]}
              />
            }
            sourceContent={
              <SourceReportViewer
                title="Report Overview Source Pages"
                description="These are the report pages used for the extracted TransUnion overview details."
                pages={report.sourceComponents?.reportOverview?.pages ?? []}
                sourceSessionId={report.sourceSessionId}
              />
            }
          />
        </CardContent>
      </Card>

      <Card className="border-black/80 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserRound className="h-5 w-5 text-slate-500" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            extractedContent={
              <DefinitionRows
                rows={[
                  { label: "Name", value: <span className={valueClassName(personal.name ?? "Not reported")}>{personal.name ?? "Not reported"}</span> },
                  { label: "Also Known As", value: <ListValue values={normalizeLines(personal.alsoKnownAs)} /> },
                  { label: "Current Addresses", value: <ListValue values={normalizeLines(personal.currentAddresses)} /> },
                  { label: "Previous Addresses", value: <ListValue values={normalizeLines(personal.previousAddresses)} /> },
                  { label: "Phone Numbers", value: <ListValue values={normalizeLines(personal.phoneNumbers)} /> },
                  { label: "Employers", value: <ListValue values={normalizeLines(personal.employers)} /> },
                  { label: "Social Security Number", value: <span className={valueClassName(personal.socialSecurityNumber ?? "Not reported")}>{personal.socialSecurityNumber ?? "Not reported"}</span> },
                  { label: "Date of Birth", value: <span className={valueClassName(personal.dateOfBirth ?? "Not reported")}>{personal.dateOfBirth ?? "Not reported"}</span> },
                ]}
              />
            }
            sourceContent={
              <SourceReportViewer
                title="Personal Information Source Pages"
                description="These are the report pages used for the extracted TransUnion personal information."
                pages={report.sourceComponents?.personalInformation?.pages ?? []}
                sourceSessionId={report.sourceSessionId}
              />
            }
          />
        </CardContent>
      </Card>

      <AccountSection
        title="Accounts with Adverse Information"
        description="These are the report pages linked to the adverse TransUnion accounts section."
        accountsComponent={adverseAccounts}
        pageNumbers={report.sourceComponents?.adverseAccounts?.pages}
        sourceSessionId={report.sourceSessionId}
      />

      <AccountSection
        title="Satisfactory Accounts"
        description="These are the report pages linked to the satisfactory TransUnion accounts section."
        accountsComponent={satisfactoryAccounts}
        pageNumbers={report.sourceComponents?.satisfactoryAccounts?.pages}
        sourceSessionId={report.sourceSessionId}
      />

      <Card className="border-black/80 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Search className="h-5 w-5 text-slate-500" />
            Inquiries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            extractedContent={
              <InquiryTable
                title="Inquiries"
                entries={Array.isArray(visibleInquiryComponent.inquiries) ? visibleInquiryComponent.inquiries : []}
              />
            }
            sourceContent={
              <SourceReportViewer
                title="Inquiries Source Pages"
                description="These are the report pages linked to the TransUnion inquiries section."
                pages={visibleInquiryPages}
                sourceSessionId={report.sourceSessionId}
              />
            }
          />
        </CardContent>
      </Card>

      <Card className="border-[#f0a8a0] bg-[#fff7f6]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-slate-500" />
            Public Records
            <Badge variant="destructive">Negative Public Record</Badge>
            <Badge variant="outline">{publicRecords.length}</Badge>
          </CardTitle>
          <p className="text-sm text-slate-500">
            {publicRecords.length} public record{publicRecords.length === 1 ? "" : "s"} extracted from this TransUnion report.
          </p>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            extractedContent={<PublicRecordList records={publicRecords} />}
            sourceContent={
              <SourceReportViewer
                title="Public Records Source Pages"
                description="These are the report pages linked to the extracted TransUnion public records."
                pages={publicRecordSourcePages}
                sourceSessionId={report.sourceSessionId}
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default TransUnionCreditReport;
