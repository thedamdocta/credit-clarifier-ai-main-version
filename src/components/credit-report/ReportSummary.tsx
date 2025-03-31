
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { CreditReport } from "@/lib/creditReportParser";

interface ReportSummaryProps {
  report: CreditReport;
}

const ReportSummary: React.FC<ReportSummaryProps> = ({ report }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Info className="h-5 w-5 mr-2" />
          1. Summary
        </CardTitle>
        <CardDescription>
          Review this summary for a quick view of key information contained in your Equifax Credit Report.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="flex justify-between items-center bg-muted/20 p-2">
            <span className="font-medium">Report Date</span>
            <span>{report.reportDate || "Not Available"}</span>
          </div>
          
          <div className="flex justify-between items-center p-2">
            <span className="font-medium">Credit File Status</span>
            <span>{report.creditFileStatus || "No fraud indicator on file"}</span>
          </div>
          
          <div className="flex justify-between items-center bg-muted/20 p-2">
            <span className="font-medium">Alert Contacts</span>
            <span>{report.alertContacts || "0 Records Found"}</span>
          </div>
          
          <div className="flex justify-between items-center p-2">
            <span className="font-medium">Average Account Age</span>
            <span>{report.averageAccountAge || "Not Available"}</span>
          </div>
          
          <div className="flex justify-between items-center bg-muted/20 p-2">
            <span className="font-medium">Length of Credit History</span>
            <span>{report.lengthOfCreditHistory || "Not Available"}</span>
          </div>
          
          <div className="flex justify-between items-center p-2">
            <span className="font-medium">Accounts with Negative Information</span>
            <span>{report.accountsWithNegativeInfo || "0"}</span>
          </div>
          
          <div className="flex justify-between items-center bg-muted/20 p-2">
            <span className="font-medium">Oldest Account</span>
            <span>
              {report.oldestAccount ? 
                `${report.oldestAccount.accountName} (Opened ${report.oldestAccount.openDate})` : 
                "Not Available"}
            </span>
          </div>
          
          <div className="flex justify-between items-center p-2">
            <span className="font-medium">Most Recent Account</span>
            <span>
              {report.recentAccount ? 
                `${report.recentAccount.accountName} (Opened ${report.recentAccount.openDate})` :
                "Not Available"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportSummary;
