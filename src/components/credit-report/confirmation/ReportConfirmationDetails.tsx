
import React from "react";
import { CardContent } from "@/components/ui/card";
import { CreditReport } from "@/lib/creditReportParser";

interface ReportConfirmationDetailsProps {
  report: CreditReport;
}

const ReportConfirmationDetails: React.FC<ReportConfirmationDetailsProps> = ({ report }) => {
  // Only use the primary name from the Name row in the Personal Information section
  const displayName = report.consumerName || 
                     (report.personalInfo?.name && report.personalInfo.name !== 'Not Found' ? 
                      report.personalInfo.name : "Not Available");
  
  return (
    <CardContent className="pt-4">
      <div className="grid gap-4">
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-medium">Consumer Name</span>
          <span className="text-muted-foreground">
            {displayName}
          </span>
        </div>
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-medium">Report Confirmation</span>
          <span className="text-muted-foreground">{report.confirmationNumber || "Not Available"}</span>
        </div>
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-medium">Report Date</span>
          <span className="text-muted-foreground">{report.reportDate || "Not Available"}</span>
        </div>
      </div>
    </CardContent>
  );
};

export default ReportConfirmationDetails;
