
import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import ReportSummaryHeader from "./summary/ReportSummaryHeader";
import ReportSummaryContent from "./summary/ReportSummaryContent";

interface ReportSummaryProps {
  report: CreditReport;
}

const ReportSummary: React.FC<ReportSummaryProps> = ({ report }) => {
  return (
    <Card>
      <CardHeader>
        <ReportSummaryHeader report={report} />
      </CardHeader>
      <ReportSummaryContent report={report} />
    </Card>
  );
};

export default ReportSummary;
