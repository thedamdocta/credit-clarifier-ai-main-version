import React, { useState } from "react";
import { CreditReport } from "@/lib/types/creditReport";
import { MonthlyHistoryEntry } from "@/lib/types/creditReport";
import ExtractionStatus from "./credit-report/ExtractionStatus";
import ExtractedSourceTabs from "./credit-report/source/ExtractedSourceTabs";
import SourceReportViewer from "./credit-report/source/SourceReportViewer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CreditCard, FileText, Info, Search, ShieldAlert, UserRound } from "lucide-react";
import EquifaxNewPaymentHistory from "./equifax-new/EquifaxNewPaymentHistory";
import EquifaxNewMonth24History from "./equifax-new/EquifaxNewMonth24History";
import { isNegativeAccountState } from "@/utils/accountNegativeState";
import { humanizeExtractedText } from "@/utils/formatters/accountValueFormatters";
import PublicRecordList from "@/components/credit-report/public-records/PublicRecordList";

type EquifaxNewReportConfirmation = {
  consumerName?: string;
  confirmationNumber?: string;
  reportDate?: string;
};

type EquifaxNewSummary = {
  reportDate?: string;
  averageAccountAge?: string;
  lengthOfCreditHistory?: string;
  oldestAccount?: { accountName?: string; openDate?: string };
  mostRecentAccount?: { accountName?: string; openDate?: string };
};

type EquifaxNewPersonalInformation = {
  name?: string;
  currentAddress?: string;
  socialSecurityNumber?: string;
  dateOfBirth?: string;
  formerNames?: string[];
  employmentInformation?: string[];
  consumerFileNotices?: string[];
  formerAddresses?: string[];
  formerPhoneNumbers?: string[];
  consumerStatement?: string;
};

type EquifaxNewPaymentHistory = MonthlyHistoryEntry[];

type EquifaxNewMonth24History = {
  sections?: Array<{
    key?: string;
    label?: string;
    rows?: MonthlyHistoryEntry[];
  }>;
};

type EquifaxNewNarrativeCode = {
  code?: string;
  description?: string;
};

type EquifaxNewAccount = {
  accountName?: string;
  accountNumber?: string;
  isClosed?: boolean;
  address?: string;
  phoneNumber?: string;
  owner?: string;
  loanAccountType?: string;
  status?: string;
  dateReported?: string;
  balance?: string;
  creditLimit?: string;
  highCredit?: string;
  dateOpened?: string;
  dateOfFirstDelinquency?: string;
  termsFrequency?: string;
  dateOfLastActivity?: string;
  dateMajorDelinquencyFirstReported?: string;
  monthsReviewed?: string;
  scheduledPaymentAmount?: string;
  amountPastDue?: string;
  deferredPaymentStartDate?: string;
  actualPaymentAmount?: string;
  chargeOffAmount?: string;
  balloonPaymentAmount?: string;
  dateOfLastPayment?: string;
  dateClosed?: string;
  balloonPaymentDate?: string;
  termDuration?: string;
  activityDesignator?: string;
  narrativeCodeList?: string;
  paymentHistory?: EquifaxNewPaymentHistory;
  month24History?: EquifaxNewMonth24History;
  narrativeCodes?: EquifaxNewNarrativeCode[];
  sourcePages?: number[];
};

type EquifaxNewAccountsComponent = {
  accountCount?: number;
  accounts?: EquifaxNewAccount[];
};

type EquifaxNewInquiry = {
  companyName?: string;
  addressLines?: string[];
  phoneNumber?: string;
  inquiryType?: string;
  inquiryDates?: string[];
  sourcePages?: number[];
};

type EquifaxNewInquiriesComponent = {
  inquiryCount?: number;
  inquiries?: EquifaxNewInquiry[];
};

const normalizeLines = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\n|\|/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const displayValue = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || "Not reported";
};

const valueClassName = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized ? "text-slate-900" : "text-slate-400";
};

const hasOwnField = (value: unknown, key: string) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key));

const MissingFieldValue: React.FC = () => <span className="font-medium text-red-600">Missing</span>;

const ListValue: React.FC<{ values?: string[]; emptyLabel?: string }> = ({ values = [], emptyLabel = "Not reported" }) => {
  if (!values.length) {
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

const EquifaxNewAccountCard: React.FC<{
  account: EquifaxNewAccount;
  sourceSessionId?: string | null;
}> = ({ account, sourceSessionId }) => {
  const [activeTab, setActiveTab] = useState("summary");
  const hasNegativeInfo = isNegativeAccountState({
    status: account.status,
    accountType: account.loanAccountType,
    comments: [account.narrativeCodeList],
    paymentHistoryRows: account.paymentHistory,
  });
  const cardClassName = hasNegativeInfo ? "border-[#f0a8a0] bg-[#fff7f6]" : "border-black/80 bg-white";
  const titleClassName = "text-slate-900";
  const summaryRows = [
    { label: "Account Name", value: <span className={valueClassName(account.accountName)}>{displayValue(account.accountName)}</span> },
    { label: "Account Number", value: <span className={valueClassName(account.accountNumber)}>{displayValue(account.accountNumber)}</span> },
    { label: "Owner", value: <span className={valueClassName(account.owner)}>{displayValue(account.owner)}</span> },
    { label: "Loan / Account Type", value: <span className={valueClassName(account.loanAccountType)}>{displayValue(account.loanAccountType)}</span> },
    { label: "Status", value: <span className={valueClassName(account.status)}>{displayValue(account.status)}</span> },
    { label: "Date Reported", value: <span className={valueClassName(account.dateReported)}>{displayValue(account.dateReported)}</span> },
  ];
  const renderDetailValue = (label: string, value: unknown) => {
    if (label === "Balance" && !hasOwnField(account, "balance")) {
      return <MissingFieldValue />;
    }
    return <span className={valueClassName(value)}>{displayValue(value)}</span>;
  };

  const detailRows = [
    ["Address", account.address],
    ["Phone Number", account.phoneNumber],
    ["Balance", account.balance],
    ["Credit Limit", account.creditLimit],
    ["High Credit", account.highCredit],
    ["Date Opened", account.dateOpened],
    ["Date of 1st Delinquency", account.dateOfFirstDelinquency],
    ["Terms Frequency", account.termsFrequency],
    ["Date of Last Activity", account.dateOfLastActivity],
    ["Date Major Delinquency 1st Reported", account.dateMajorDelinquencyFirstReported],
    ["Months Reviewed", account.monthsReviewed],
    ["Scheduled Payment Amount", account.scheduledPaymentAmount],
    ["Actual Payment Amount", account.actualPaymentAmount],
    ["Amount Past Due", account.amountPastDue],
    ["Charge Off Amount", account.chargeOffAmount],
    ["Deferred Payment Start Date", account.deferredPaymentStartDate],
    ["Balloon Payment Amount", account.balloonPaymentAmount],
    ["Date of Last Payment", account.dateOfLastPayment],
    ["Date Closed", account.dateClosed],
    ["Balloon Payment Date", account.balloonPaymentDate],
    ["Term Duration", account.termDuration],
    ["Activity Designator", account.activityDesignator],
    ["Narrative Code(s)", account.narrativeCodeList],
  ].map(([label, value]) => ({
    label,
    value: renderDetailValue(label, value),
  }));

  const narrativeCodes = Array.isArray(account.narrativeCodes) ? account.narrativeCodes : [];

  return (
    <Card className={cardClassName}>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className={`text-xl ${titleClassName}`}>{displayValue(account.accountName)}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {displayValue(account.accountNumber)}
              </Badge>
              <Badge variant="outline">
                {humanizeExtractedText(account.status) || "Unknown Status"}
              </Badge>
              {hasNegativeInfo ? <Badge variant="destructive">Negative Account</Badge> : null}
            </div>
          </div>
          {account.isClosed ? <Badge variant="secondary">Closed</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="mb-4 max-w-full">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="payment-history">Payment History</TabsTrigger>
            <TabsTrigger value="month24-history">24 Month History</TabsTrigger>
            <TabsTrigger value="account-details">Account Details</TabsTrigger>
            <TabsTrigger value="narrative-codes">Narrative Codes</TabsTrigger>
            <TabsTrigger value="source-report">Source Report</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-0">
            <DefinitionRows rows={summaryRows} />
          </TabsContent>

          <TabsContent value="payment-history" className="mt-0">
            <EquifaxNewPaymentHistory rows={account.paymentHistory} />
          </TabsContent>

          <TabsContent value="month24-history" className="mt-0">
            <EquifaxNewMonth24History sections={account.month24History?.sections} />
          </TabsContent>

          <TabsContent value="account-details" className="mt-0">
            <DefinitionRows rows={detailRows} />
          </TabsContent>

          <TabsContent value="narrative-codes" className="mt-0">
            {narrativeCodes.length ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {narrativeCodes.map((entry, index) => (
                      <tr key={`${entry.code}-${index}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3 text-slate-900">{displayValue(entry.code)}</td>
                        <td className="px-4 py-3 text-slate-900">{displayValue(entry.description)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-400">Not reported</div>
            )}
          </TabsContent>

          <TabsContent value="source-report" className="mt-0">
            <SourceReportViewer
              sourceSessionId={sourceSessionId}
              pages={account.sourcePages ?? []}
              title="Account Source Pages"
              description="These are the report pages used for this extracted account."
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const EquifaxNewCreditReport: React.FC<{ report: CreditReport; hideExtractionStatus?: boolean }> = ({
  report,
  hideExtractionStatus = false,
}) => {
  const components = (report.components ?? {}) as Record<string, unknown>;
  const reportConfirmation = (components.reportConfirmationDetails ?? {}) as EquifaxNewReportConfirmation;
  const summary = (components.summary ?? {}) as EquifaxNewSummary;
  const personalInformation = (components.personalInformation ?? {}) as EquifaxNewPersonalInformation;
  const accountsComponent = (components.accounts ?? { accountCount: 0, accounts: [] }) as EquifaxNewAccountsComponent;
  const inquiriesComponent = (components.inquiries ?? { inquiryCount: 0, inquiries: [] }) as EquifaxNewInquiriesComponent;

  const reportConfirmationRows = [
    { label: "Consumer Name", value: <span className={valueClassName(reportConfirmation.consumerName)}>{displayValue(reportConfirmation.consumerName)}</span> },
    { label: "Confirmation Number", value: <span className={valueClassName(reportConfirmation.confirmationNumber)}>{displayValue(reportConfirmation.confirmationNumber)}</span> },
    { label: "Report Date", value: <span className={valueClassName(reportConfirmation.reportDate)}>{displayValue(reportConfirmation.reportDate)}</span> },
  ];

  const summaryRows = [
    { label: "Report Date", value: <span className={valueClassName(summary.reportDate)}>{displayValue(summary.reportDate)}</span> },
    { label: "Average Account Age", value: <span className={valueClassName(summary.averageAccountAge)}>{displayValue(summary.averageAccountAge)}</span> },
    { label: "Length of Credit History", value: <span className={valueClassName(summary.lengthOfCreditHistory)}>{displayValue(summary.lengthOfCreditHistory)}</span> },
    { label: "Oldest Account", value: <span className={valueClassName(summary.oldestAccount?.accountName)}>{summary.oldestAccount?.accountName ? `${summary.oldestAccount.accountName} | ${displayValue(summary.oldestAccount?.openDate)}` : "Not reported"}</span> },
    { label: "Most Recent Account", value: <span className={valueClassName(summary.mostRecentAccount?.accountName)}>{summary.mostRecentAccount?.accountName ? `${summary.mostRecentAccount.accountName} | ${displayValue(summary.mostRecentAccount?.openDate)}` : "Not reported"}</span> },
  ];

  const personalRows = [
    { label: "Name", value: <span className={valueClassName(personalInformation.name)}>{displayValue(personalInformation.name)}</span> },
    { label: "Current Address", value: <span className={valueClassName(personalInformation.currentAddress)}>{displayValue(personalInformation.currentAddress)}</span> },
    { label: "Social Security Number", value: <span className={valueClassName(personalInformation.socialSecurityNumber)}>{displayValue(personalInformation.socialSecurityNumber)}</span> },
    { label: "Date of Birth", value: <span className={valueClassName(personalInformation.dateOfBirth)}>{displayValue(personalInformation.dateOfBirth)}</span> },
    { label: "Former Names", value: <ListValue values={normalizeLines(personalInformation.formerNames)} /> },
    { label: "Employment Information", value: <ListValue values={normalizeLines(personalInformation.employmentInformation)} /> },
    { label: "Consumer File Notices", value: <ListValue values={normalizeLines(personalInformation.consumerFileNotices)} /> },
    { label: "Former Addresses", value: <ListValue values={normalizeLines(personalInformation.formerAddresses)} /> },
    { label: "Former Phone Numbers", value: <ListValue values={normalizeLines(personalInformation.formerPhoneNumbers)} /> },
    { label: "Consumer Statement", value: <span className={valueClassName(personalInformation.consumerStatement)}>{displayValue(personalInformation.consumerStatement)}</span> },
  ];

  const accounts = Array.isArray(accountsComponent.accounts) ? accountsComponent.accounts : [];
  const inquiries = Array.isArray(inquiriesComponent.inquiries) ? inquiriesComponent.inquiries : [];
  const publicRecords = Array.isArray(report.publicRecords) ? report.publicRecords : [];

  return (
    <div className="space-y-6">
      {!hideExtractionStatus ? <ExtractionStatus report={report} /> : null}

      <Card className="border-black/80 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-slate-900">
            <Info className="h-6 w-6 text-slate-500" />
            Report Confirmation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.reportConfirmationDetails?.pages ?? []}
            sourceTitle="Report Confirmation Source Pages"
          >
            <DefinitionRows rows={reportConfirmationRows} />
          </ExtractedSourceTabs>
        </CardContent>
      </Card>

      <Card className="border-black/80 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-slate-900">
            <ShieldAlert className="h-6 w-6 text-slate-500" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.summary?.pages ?? []}
            sourceTitle="Summary Source Pages"
          >
            <DefinitionRows rows={summaryRows} />
          </ExtractedSourceTabs>
        </CardContent>
      </Card>

      <Card className="border-black/80 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-slate-900">
            <UserRound className="h-6 w-6 text-slate-500" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.personalInformation?.pages ?? []}
            sourceTitle="Personal Information Source Pages"
          >
            <DefinitionRows rows={personalRows} />
          </ExtractedSourceTabs>
        </CardContent>
      </Card>

      <Card className="border-black/80 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-slate-900">
            <CreditCard className="h-6 w-6 text-slate-500" />
            Accounts
          </CardTitle>
          <p className="text-sm text-slate-500">
            {accountsComponent.accountCount ?? accounts.length} accounts extracted from the Equifax report.
          </p>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.accounts?.pages ?? []}
            sourceTitle="Accounts Source Pages"
          >
            <div className="space-y-4">
              {accounts.map((account, index) => (
                <EquifaxNewAccountCard
                  key={`${account.accountName}-${account.accountNumber}-${index}`}
                  account={account}
                  sourceSessionId={report.sourceSessionId}
                />
              ))}
            </div>
          </ExtractedSourceTabs>
        </CardContent>
      </Card>

      <Card className="border-black/80 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-slate-900">
            <Search className="h-6 w-6 text-slate-500" />
            Inquiries
          </CardTitle>
          <p className="text-sm text-slate-500">
            {inquiriesComponent.inquiryCount ?? inquiries.length} inquiries extracted from the Equifax report.
          </p>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.inquiries?.pages ?? []}
            sourceTitle="Inquiry Source Pages"
          >
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Inquiry Dates</th>
                    <th className="px-4 py-3 font-medium">Address</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-slate-400">No inquiry entries reported.</td>
                    </tr>
                  ) : (
                    inquiries.map((entry, index) => (
                      <tr key={`${entry.companyName}-${index}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3 text-slate-900">{displayValue(entry.companyName)}</td>
                        <td className="px-4 py-3 text-slate-900">{displayValue(entry.inquiryType)}</td>
                        <td className="px-4 py-3 text-slate-900">
                          <ListValue values={normalizeLines(entry.inquiryDates)} />
                        </td>
                        <td className="px-4 py-3 text-slate-900">
                          <ListValue values={normalizeLines(entry.addressLines)} />
                        </td>
                        <td className="px-4 py-3 text-slate-900">{displayValue(entry.phoneNumber)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ExtractedSourceTabs>
        </CardContent>
      </Card>

      <Card className="border-[#f0a8a0] bg-[#fff7f6]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-slate-900">
            <FileText className="h-6 w-6 text-slate-500" />
            Public Records
            <Badge variant="destructive">Negative Public Record</Badge>
            <Badge variant="outline">{publicRecords.length}</Badge>
          </CardTitle>
          <p className="text-sm text-slate-500">
            {publicRecords.length} public record{publicRecords.length === 1 ? "" : "s"} extracted from the Equifax report.
          </p>
        </CardHeader>
        <CardContent>
          <ExtractedSourceTabs
            sessionId={report.sourceSessionId}
            pageNumbers={report.sourceComponents?.publicRecords?.pages ?? []}
            sourceTitle="Public Records Source Pages"
          >
            <PublicRecordList records={publicRecords} />
          </ExtractedSourceTabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default EquifaxNewCreditReport;
