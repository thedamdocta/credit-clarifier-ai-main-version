
import React from "react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { Info } from "lucide-react";
import { CreditReport } from "@/lib/types/creditReport";

interface ReportSummaryHeaderProps {
  report: CreditReport;
}

const ReportSummaryHeader: React.FC<ReportSummaryHeaderProps> = ({ report }) => {
  return (
    <>
      <CardTitle className="flex items-center">
        <Info className="h-5 w-5 mr-2" />
        1. Summary
      </CardTitle>
      <CardDescription>
        Review this summary for a quick view of key information contained in your {report.bureau} Credit Report.
      </CardDescription>
    </>
  );
};

export default ReportSummaryHeader;
