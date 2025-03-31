
import React from "react";
import { CreditReport } from "@/lib/creditReportParser";
import ReportConfirmation from "./credit-report/ReportConfirmation";
import ReportSummary from "./credit-report/ReportSummary";
import CreditAccounts from "./credit-report/CreditAccounts";
import OtherItems from "./credit-report/OtherItems";
import DisputeInformation from "./credit-report/DisputeInformation";

interface EquifaxCreditReportProps {
  report: CreditReport;
}

const EquifaxCreditReport: React.FC<EquifaxCreditReportProps> = ({ report }) => {
  return (
    <div className="space-y-6">
      <ReportConfirmation report={report} />
      <ReportSummary report={report} />
      <CreditAccounts report={report} />
      <OtherItems report={report} />
      <DisputeInformation />
    </div>
  );
};

export default EquifaxCreditReport;
