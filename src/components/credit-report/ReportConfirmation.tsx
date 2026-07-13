
import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/creditReportParser";
import ReportConfirmationHeader from "./confirmation/ReportConfirmationHeader";
import ReportConfirmationDetails from "./confirmation/ReportConfirmationDetails";
import ExtractedSourceTabs from "./source/ExtractedSourceTabs";

interface ReportConfirmationProps {
  report: CreditReport;
}

const ReportConfirmation: React.FC<ReportConfirmationProps> = ({ report }) => {
  return (
    <Card>
      <CardHeader className="bg-credit-blue bg-opacity-10">
        <ReportConfirmationHeader />
      </CardHeader>
      <ExtractedSourceTabs
        sessionId={report.sourceSessionId}
        pageNumbers={report.sourceComponents?.reportConfirmationDetails?.pages}
        sourceTitle="Report Confirmation Source Pages"
        tabsClassName="mx-6 mt-5 sm:mt-6"
      >
        <ReportConfirmationDetails report={report} />
      </ExtractedSourceTabs>
    </Card>
  );
};

export default ReportConfirmation;
