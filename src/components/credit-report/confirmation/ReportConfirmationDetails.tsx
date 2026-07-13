
import React from "react";
import { CardContent } from "@/components/ui/card";
import { CreditReport } from "@/lib/creditReportParser";
import { isNotReportedValue } from "@/utils/formatters/accountValueFormatters";

interface ReportConfirmationDetailsProps {
  report: CreditReport;
}

const ReportConfirmationDetails: React.FC<ReportConfirmationDetailsProps> = ({ report }) => {
  // Only use the primary name from the Name row in the Personal Information section
  const displayName = report.consumerName || 
                     (report.personalInfo?.name && report.personalInfo.name !== 'Not Found' ? 
                      report.personalInfo.name : "Not reported");
  
  return (
    <CardContent className="pt-4">
      <div className="grid gap-4">
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-medium">Consumer Name</span>
          <span className={isNotReportedValue(displayName) ? "text-slate-400" : "text-muted-foreground"}>
            {displayName}
          </span>
        </div>
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-medium">Report Confirmation</span>
          <span className={isNotReportedValue(report.confirmationNumber || "Not reported") ? "text-slate-400" : "text-muted-foreground"}>
            {report.confirmationNumber || "Not reported"}
          </span>
        </div>
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-medium">Report Date</span>
          <span className={isNotReportedValue(report.reportDate || "Not reported") ? "text-slate-400" : "text-muted-foreground"}>
            {report.reportDate || "Not reported"}
          </span>
        </div>
      </div>
    </CardContent>
  );
};

export default ReportConfirmationDetails;
