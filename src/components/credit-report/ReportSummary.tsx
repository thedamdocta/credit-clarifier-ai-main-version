
import React from "react";
import { CreditReport } from "@/lib/types/creditReport";
import ReportSummaryHeader from "./summary/ReportSummaryHeader";
import ReportSummaryContent from "./summary/ReportSummaryContent";
import CollapsibleCard from "./common/CollapsibleCard";

interface ReportSummaryProps {
  report: CreditReport;
}

const ReportSummary: React.FC<ReportSummaryProps> = ({ report }) => {
  const header = <ReportSummaryHeader report={report} />;

  return (
    <CollapsibleCard header={header}>
      <ReportSummaryContent report={report} />
    </CollapsibleCard>
  );
};

export default ReportSummary;
