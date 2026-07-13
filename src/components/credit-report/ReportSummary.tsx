
import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import ReportSummaryHeader from "./summary/ReportSummaryHeader";
import ReportSummaryContent from "./summary/ReportSummaryContent";
import ExtractedSourceTabs from "./source/ExtractedSourceTabs";

interface ReportSummaryProps {
  report: CreditReport;
}

const ReportSummary: React.FC<ReportSummaryProps> = ({ report }) => {
  return (
    <Card>
      <CardHeader>
        <ReportSummaryHeader report={report} />
      </CardHeader>
      <ExtractedSourceTabs
        sessionId={report.sourceSessionId}
        pageNumbers={report.sourceComponents?.summary?.pages}
        sourceTitle="Summary Source Pages"
        tabsClassName="mx-6 mt-5 sm:mt-6"
      >
        <ReportSummaryContent report={report} />
      </ExtractedSourceTabs>
    </Card>
  );
};

export default ReportSummary;
