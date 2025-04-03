
import React from "react";
import { CardContent } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import ReportSummaryRow from "./ReportSummaryRow";

interface ReportSummaryContentProps {
  report: CreditReport;
}

const ReportSummaryContent: React.FC<ReportSummaryContentProps> = ({ report }) => {
  // Debug logging for report data
  React.useEffect(() => {
    console.log("Summary component received report with account summaries:", report.accountSummaries?.length);
    console.log("Raw account summaries in report:", JSON.stringify(report.accountSummaries));
    
    // Log when this component renders
    console.log("ReportSummaryContent rendering with reportDate:", report.reportDate);
  }, [report]);
  
  return (
    <CardContent>
      <div className="grid gap-3">
        <ReportSummaryRow 
          label="Report Date" 
          value={report.reportDate} 
          highlighted={true}
        />
        
        <ReportSummaryRow 
          label="Credit File Status" 
          value={report.creditFileStatus || "No fraud indicator on file"} 
        />
        
        <ReportSummaryRow 
          label="Alert Contacts" 
          value={report.alertContacts || "0 Records Found"} 
          highlighted={true}
        />
        
        <ReportSummaryRow 
          label="Average Account Age" 
          value={report.averageAccountAge || "Not available"} 
        />
        
        <ReportSummaryRow 
          label="Length of Credit History" 
          value={report.lengthOfCreditHistory || "Not available"} 
          highlighted={true}
        />
        
        <ReportSummaryRow 
          label="Accounts with Negative Information" 
          value={report.accountsWithNegativeInfo || "0"} 
        />
        
        <ReportSummaryRow 
          label="Oldest Account" 
          value={
            report.oldestAccount ? 
              `${report.oldestAccount.accountName} (Opened ${report.oldestAccount.openDate})` : 
              "Not available"
          } 
          highlighted={true}
        />
        
        <ReportSummaryRow 
          label="Most Recent Account" 
          value={
            report.recentAccount ? 
              `${report.recentAccount.accountName} (Opened ${report.recentAccount.openDate})` :
              "Not available"
          } 
        />
        
        <ReportSummaryRow 
          label="Confirmation Number" 
          value={report.confirmationNumber || "Not available"} 
          highlighted={true}
        />
        
        <ReportSummaryRow 
          label="Consumer Name" 
          value={report.personalInfo?.name || report.consumerName || "Not available"} 
        />
      </div>
    </CardContent>
  );
};

export default ReportSummaryContent;
