
import React from "react";
import { CreditReport } from "@/lib/creditReportParser";
import ReportConfirmation from "./credit-report/ReportConfirmation";
import PersonalInformation from "./credit-report/PersonalInformation";
import ReportSummary from "./credit-report/ReportSummary";
import OtherItems from "./credit-report/OtherItems";
import CreditAccounts from "./credit-report/CreditAccounts";
import AccountsComponent from "./credit-report/accounts/AccountsComponent";
import CollectionsComponent from "./credit-report/collections/CollectionsComponent";
import InquiriesComponent from "./credit-report/inquiries/InquiriesComponent";
import ExtractionStatus from "./credit-report/ExtractionStatus";
import PublicRecordList from "@/components/credit-report/public-records/PublicRecordList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Shield } from "lucide-react";

interface EquifaxCreditReportProps {
  report: CreditReport;
  hideExtractionStatus?: boolean;
}

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

const ListValue: React.FC<{ values?: string[]; emptyLabel?: string }> = ({ values = [], emptyLabel = "Not reported" }) => {
  if (!values.length) {
    return <span className="text-slate-400">{emptyLabel}</span>;
  }

  return (
    <div className="space-y-1">
      {values.map((value, index) => (
        <p key={`${value}-${index}`} className="text-slate-900">
          {value}
        </p>
      ))}
    </div>
  );
};

const ConsumerInformationIndicatorList: React.FC<{
  indicators: NonNullable<CreditReport["consumerInformationIndicators"]>;
}> = ({ indicators }) => {
  if (!indicators.length) {
    return <span className="text-slate-400">No consumer-information indicators extracted.</span>;
  }

  return (
    <div className="space-y-4">
      {indicators.map((indicator, index) => (
        <div
          key={`${indicator.code ?? indicator.description}-${index}`}
          className="rounded-lg border border-[#f0a8a0] bg-[#fff7f6] p-4"
        >
          <DefinitionRows
            rows={[
              { label: "Code", value: <span className="text-slate-900">{indicator.code ?? "Not reported"}</span> },
              { label: "Description", value: <span className="text-slate-900">{indicator.description}</span> },
              { label: "Category", value: <span className="text-slate-900">{indicator.category ?? "Not reported"}</span> },
              { label: "Linked Account", value: <span className="text-slate-900">{indicator.linkedAccountName ?? "Not reported"}</span> },
              { label: "Linked Account Number", value: <span className="text-slate-900">{indicator.linkedAccountNumber ?? "Not reported"}</span> },
            ]}
          />
        </div>
      ))}
    </div>
  );
};

const EquifaxCreditReport: React.FC<EquifaxCreditReportProps> = ({ report, hideExtractionStatus = false }) => {
  const publicRecords = Array.isArray(report.publicRecords) ? report.publicRecords : [];
  const consumerInformationIndicators = Array.isArray(report.consumerInformationIndicators)
    ? report.consumerInformationIndicators
    : [];

  return (
    <div className="space-y-6">
      {!hideExtractionStatus ? <ExtractionStatus report={report} /> : null}
      <ReportConfirmation report={report} />
      <PersonalInformation report={report} />
      <ReportSummary report={report} />
      <CreditAccounts report={report} />
      <OtherItems report={report} />
      {publicRecords.length ? (
        <Card className="border-[#f0a8a0] bg-[#fff7f6]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
              <FileText className="h-5 w-5 text-slate-500" />
              <span>Public Records</span>
              <Badge variant="destructive">Negative Public Record</Badge>
              <Badge variant="outline">{publicRecords.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PublicRecordList records={publicRecords} />
          </CardContent>
        </Card>
      ) : null}
      {consumerInformationIndicators.length ? (
        <Card className="border-[#f0a8a0] bg-[#fff7f6]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
              <Shield className="h-5 w-5 text-slate-500" />
              <span>Consumer Information Indicators</span>
              <Badge variant="outline">{consumerInformationIndicators.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConsumerInformationIndicatorList indicators={consumerInformationIndicators} />
          </CardContent>
        </Card>
      ) : null}
      <AccountsComponent report={report} />
      <CollectionsComponent report={report} />
      <InquiriesComponent report={report} />
    </div>
  );
};

export default EquifaxCreditReport;
