
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { CreditReport } from "@/lib/creditReportParser";

interface ReportConfirmationProps {
  report: CreditReport;
}

const ReportConfirmation: React.FC<ReportConfirmationProps> = ({ report }) => {
  // Extract the consumer name for display, ensure we only show the primary name
  const displayName = report.consumerName || 
                     (report.personalInfo?.name && report.personalInfo.name !== 'Not Found' ? 
                      report.personalInfo.name : "Not Available");
  
  return (
    <Card>
      <CardHeader className="bg-credit-blue bg-opacity-10">
        <CardTitle className="text-credit-blue flex items-center">
          <ShieldCheck className="h-5 w-5 mr-2" />
          Equifax Credit Report
        </CardTitle>
        <CardDescription>
          Report confirmation details
        </CardDescription>
      </CardHeader>
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
    </Card>
  );
};

export default ReportConfirmation;
