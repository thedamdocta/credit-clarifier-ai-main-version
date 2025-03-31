
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { CreditReport } from "@/lib/creditReportParser";

interface ReportConfirmationProps {
  report: CreditReport;
}

const ReportConfirmation: React.FC<ReportConfirmationProps> = ({ report }) => {
  return (
    <Card>
      <CardHeader className="bg-credit-blue bg-opacity-10">
        <CardTitle className="text-credit-blue flex items-center">
          <ShieldCheck className="h-5 w-5 mr-2" />
          Report Confirmation
        </CardTitle>
        <CardDescription>
          Your Equifax credit report information
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid gap-4">
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Confirmation Number</span>
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
