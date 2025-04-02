
import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import { toast } from "sonner";
import CreditAccountsHeader from "./accounts/CreditAccountsHeader";
import CreditAccountsTable from "./accounts/CreditAccountsTable";
import { useAccountSummaryExtraction } from "@/hooks/useAccountSummaryExtraction";
import AccountAlerts from "./accounts/AccountAlerts";
import TableImageDisplay from "./accounts/TableImageDisplay";
import AccountsDebugInfo from "./accounts/AccountsDebugInfo";
import AccountExtractionButtons from "./accounts/AccountExtractionButtons";

interface EnhancedCreditAccountsProps {
  report: CreditReport;
}

const EnhancedCreditAccounts: React.FC<EnhancedCreditAccountsProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  const {
    isProcessing,
    accountSummaries,
    extractionFailed,
    attemptedExtraction,
    extractionAttempts,
    usingSampleData,
    initialAccountDataFound,
    tableImageUrl,
    handleEnhancedExtraction
  } = useAccountSummaryExtraction({
    report,
    requiredAccountTypes
  });
  
  const triggerPdfUpload = () => {
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    } else {
      toast.warning("PDF upload button not found. Please use the upload button in the navigation bar.");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CreditAccountsHeader 
          showDebugInfo={showDebugInfo} 
          toggleDebug={() => setShowDebugInfo(!showDebugInfo)} 
        />
        
        <AccountExtractionButtons 
          isProcessing={isProcessing}
          onExtract={() => handleEnhancedExtraction(true)}
          onUpload={triggerPdfUpload}
        />
      </CardHeader>
      <CardContent>
        <p className="mb-4">Your credit report includes information about activity on your credit accounts that may affect your credit score and rating.</p>
        
        <AccountAlerts 
          extractionFailed={extractionFailed}
          usingSampleData={usingSampleData}
          onUploadClick={triggerPdfUpload}
        />
        
        {tableImageUrl && showDebugInfo && (
          <TableImageDisplay tableImageUrl={tableImageUrl} />
        )}
        
        {showDebugInfo && (
          <AccountsDebugInfo 
            accountSummaries={accountSummaries}
            extractionAttempts={extractionAttempts}
            reportId={report.reportId}
            usingSampleData={usingSampleData}
            tableImageUrl={tableImageUrl}
            extractionFailed={extractionFailed}
            initialDataFound={initialAccountDataFound}
            rawTextLength={report.rawText ? report.rawText.length : 0}
          />
        )}
        
        <CreditAccountsTable 
          accountSummaries={accountSummaries} 
          onRequestUpload={triggerPdfUpload}
        />
      </CardContent>
    </Card>
  );
};

export default EnhancedCreditAccounts;
