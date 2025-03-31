
import React from "react";
import { CardContent } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import AIAnalysisSection from "./AIAnalysisSection";
import AIAnalysisAccountTable from "./AIAnalysisAccountTable";

interface AIAnalysisContentProps {
  report: CreditReport;
}

const AIAnalysisContent: React.FC<AIAnalysisContentProps> = ({ report }) => {
  // Calculate total accounts from account summaries if available
  const totalAccounts = report.accountSummaries?.find(summary => summary.accountType === 'Total')?.totalAccounts || 0;
  
  return (
    <CardContent className="space-y-4 pt-4">
      <div className="grid gap-4">
        <AIAnalysisSection title="Detected Bureau">
          <pre className="bg-slate-100 p-2 rounded text-sm">{report.bureau}</pre>
        </AIAnalysisSection>
        
        <AIAnalysisSection title="Detected Report Date">
          <pre className="bg-slate-100 p-2 rounded text-sm">{report.reportDate}</pre>
        </AIAnalysisSection>
        
        <AIAnalysisSection title="Detected Personal Information">
          <pre className="bg-slate-100 p-2 rounded text-sm whitespace-pre-wrap">
            {JSON.stringify(report.personalInfo, null, 2)}
          </pre>
        </AIAnalysisSection>
        
        {report.accountSummaries && report.accountSummaries.length > 0 && (
          <AIAnalysisSection title="Detected Account Summaries (8x5 Table)">
            <AIAnalysisAccountTable accountSummaries={report.accountSummaries} />
          </AIAnalysisSection>
        )}

        <AIAnalysisSection title="Number of Accounts Detected">
          <pre className="bg-slate-100 p-2 rounded text-sm">
            {report.accounts.length} (Individual accounts) / {totalAccounts} (From summary)
          </pre>
          {report.accounts.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-medium">First Account Sample</h4>
              <pre className="bg-slate-100 p-2 rounded text-sm whitespace-pre-wrap">
                {JSON.stringify(report.accounts[0], null, 2)}
              </pre>
            </div>
          )}
        </AIAnalysisSection>

        {report.bureau === 'Equifax' && (
          <AIAnalysisSection title="Equifax-Specific Data">
            <div className="grid gap-2">
              <div>
                <h4 className="text-sm font-medium">Personal Info Items</h4>
                <pre className="bg-slate-100 p-2 rounded text-sm">{report.personalInfoItemCount || 0} Items Found</pre>
              </div>
              <div>
                <h4 className="text-sm font-medium">Inquiries</h4>
                <pre className="bg-slate-100 p-2 rounded text-sm">{report.inquiryCount || 0} Inquiries Found</pre>
              </div>
              <div>
                <h4 className="text-sm font-medium">Most Recent Inquiry</h4>
                <pre className="bg-slate-100 p-2 rounded text-sm">{report.recentInquiry || 'None'}</pre>
              </div>
              <div>
                <h4 className="text-sm font-medium">Public Records</h4>
                <pre className="bg-slate-100 p-2 rounded text-sm">{report.publicRecordCount || 0} Records Found</pre>
              </div>
              <div>
                <h4 className="text-sm font-medium">Collections</h4>
                <pre className="bg-slate-100 p-2 rounded text-sm">{report.collectionCount || 0} Collections Found</pre>
              </div>
            </div>
          </AIAnalysisSection>
        )}
      </div>
    </CardContent>
  );
};

export default AIAnalysisContent;
