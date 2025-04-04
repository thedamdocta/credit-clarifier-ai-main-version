
import React, { useState, useEffect } from "react";
import { CreditReport } from "@/lib/types/creditReport";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import AccountDataDebug from "@/components/credit-report/accounts/AccountDataDebug";
import EnhancedCreditAccounts from "@/components/credit-report/EnhancedCreditAccounts";
import ReportSummary from "@/components/credit-report/ReportSummary";
import AccountsComponent from "@/components/credit-report/accounts/AccountsComponent";
import DisputeInformation from "@/components/credit-report/DisputeInformation";

// Import the Collections component
import CollectionsComponent from "./credit-report/collections/CollectionsComponent";

interface EquifaxCreditReportProps {
  report: CreditReport;
  showDebugInfo?: boolean;
}

const EquifaxCreditReport = ({ report, showDebugInfo = false }: EquifaxCreditReportProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [initialAccountDataFound, setInitialAccountDataFound] = useState(false);
  const [accountSummaries, setAccountSummaries] = useState(report?.accountSummaries || []);
  
  const handleDataExtracted = (
    summaries: any, 
    usingSample: boolean, 
    failed: boolean
  ) => {
    setAccountSummaries(summaries);
    setUsingSampleData(usingSample);
    setExtractionFailed(failed);
    setExtractionAttempts(prev => prev + 1);
  };
  
  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Equifax Credit Report</h2>
          <p className="text-muted-foreground">
            Review and manage your credit information.
          </p>
        </div>
      </div>
      
      {/* Report Content */}
      <div className="space-y-6">
        <ReportSummary report={report} />
        <EnhancedCreditAccounts report={report} />
        <AccountsComponent report={report} showDebugInfo={showDebugInfo} />
        
        {/* Add Collections component here */}
        <CollectionsComponent report={report} showDebugInfo={showDebugInfo} />
        
        <DisputeInformation />
      </div>
      
      {showDebugInfo && (
        <AccountDataDebug
          showDebugInfo={showDebugInfo}
          report={report}
          extractionAttempts={extractionAttempts}
          usingSampleData={usingSampleData}
          tableImageUrl={tableImageUrl}
          extractionFailed={extractionFailed}
          initialAccountDataFound={initialAccountDataFound}
          accountSummaries={accountSummaries}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};

export default EquifaxCreditReport;
