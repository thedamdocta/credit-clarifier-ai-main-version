
import React from "react";
import { CardContent } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import ReportSummaryRow from "./ReportSummaryRow";

interface ReportSummaryContentProps {
  report: CreditReport;
}

const ReportSummaryContent: React.FC<ReportSummaryContentProps> = ({ report }) => {
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
          value={report.creditFileStatus || null} 
        />
        
        <ReportSummaryRow 
          label="Alert Contacts" 
          value={report.alertContacts || null} 
          highlighted={true}
        />
        
        <ReportSummaryRow 
          label="Average Account Age" 
          value={report.averageAccountAge} 
        />
        
        <ReportSummaryRow 
          label="Length of Credit History" 
          value={report.lengthOfCreditHistory} 
          highlighted={true}
        />
        
        <ReportSummaryRow 
          label="Accounts with Negative Information" 
          value={report.accountsWithNegativeInfo ?? null} 
        />
        
        <ReportSummaryRow 
          label="Oldest Account" 
          value={
            report.oldestAccount ? 
              `${report.oldestAccount.accountName} (Opened ${report.oldestAccount.openDate})` : 
              null
          } 
          highlighted={true}
        />
        
        <ReportSummaryRow 
          label="Most Recent Account" 
          value={
            report.recentAccount ? 
              `${report.recentAccount.accountName} (Opened ${report.recentAccount.openDate})` :
              null
          } 
        />
      </div>
    </CardContent>
  );
};

export default ReportSummaryContent;
