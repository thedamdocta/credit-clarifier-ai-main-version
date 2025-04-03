
import React from "react";
import { CreditReport } from "@/lib/creditReportParser";
import ReportConfirmation from "./credit-report/ReportConfirmation";
import ReportSummary from "./credit-report/ReportSummary";
import OtherItems from "./credit-report/OtherItems";
import DisputeInformation from "./credit-report/DisputeInformation";
import EnhancedCreditAccounts from "./credit-report/EnhancedCreditAccounts";
import AccountsComponent from "./credit-report/accounts/AccountsComponent";

interface EquifaxCreditReportProps {
  report: CreditReport;
}

const EquifaxCreditReport: React.FC<EquifaxCreditReportProps> = ({ report }) => {
  return (
    <div className="space-y-6">
      <ReportConfirmation report={report} />
      <ReportSummary report={report} />
      <EnhancedCreditAccounts report={report} />
      <OtherItems report={report} />
      <AccountsComponent report={report} />
      <DisputeInformation />
    </div>
  );
};

export default EquifaxCreditReport;
