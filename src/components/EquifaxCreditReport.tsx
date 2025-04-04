
import React from "react";
import { CreditReport } from "@/lib/creditReportParser";
import ReportConfirmation from "./credit-report/ReportConfirmation";
import ReportSummary from "./credit-report/ReportSummary";
import OtherItems from "./credit-report/OtherItems";
import DisputeInformation from "./credit-report/DisputeInformation";
import EnhancedCreditAccounts from "./credit-report/EnhancedCreditAccounts";
import AccountsComponent from "./credit-report/accounts/AccountsComponent";
import CollectionsComponent from "./credit-report/collections/CollectionsComponent";
import PublicRecordsComponent from "./credit-report/public-records/PublicRecordsComponent";
import InquiriesComponent from "./credit-report/inquiries/InquiriesComponent";
import ContactInformation from "./credit-report/ContactInformation";

interface EquifaxCreditReportProps {
  report: CreditReport;
}

const EquifaxCreditReport: React.FC<EquifaxCreditReportProps> = ({ report }) => {
  return (
    <div className="space-y-6">
      <ReportConfirmation report={report} />
      <ContactInformation report={report} />
      <ReportSummary report={report} />
      <EnhancedCreditAccounts report={report} />
      <OtherItems report={report} />
      <AccountsComponent report={report} />
      <CollectionsComponent report={report} />
      <PublicRecordsComponent report={report} />
      <InquiriesComponent report={report} />
      <DisputeInformation />
    </div>
  );
};

export default EquifaxCreditReport;
