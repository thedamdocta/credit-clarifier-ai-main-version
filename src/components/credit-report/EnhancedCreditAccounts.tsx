
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import CreditAccountsHeader from "./accounts/CreditAccountsHeader";
import CreditAccountsTable from "./accounts/CreditAccountsTable";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resetCurrentReportImage, getExtractedReportData, extractCreditAccountsTableImage } from "@/utils/pdf/extractText";

import AccountDataExtractor from "./accounts/AccountDataExtractor";
import TableImageDisplay from "./accounts/TableImageDisplay";
import AccountDataAlerts from "./accounts/AccountDataAlerts";
import AccountDataDebug from "./accounts/AccountDataDebug";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";

interface EnhancedCreditAccountsProps {
  report: CreditReport;
}

const EnhancedCreditAccounts: React.FC<EnhancedCreditAccountsProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([]);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [attemptedExtraction, setAttemptedExtraction] = useState(false);
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [initialAccountDataFound, setInitialAccountDataFound] = useState(false);
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);

  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];

  useEffect(() => {
    if (report && report.reportId) {
      resetCurrentReportImage();
      
      console.log('New report detected, resetting extraction state:', report.reportId);
      
      setAccountSummaries([]);
      setAttemptedExtraction(false);
      setExtractionFailed(false);
      setExtractionAttempts(0);
      setUsingSampleData(false);
      setTableImageUrl(null);
      setInitialAccountDataFound(false);

      console.log('Auto-triggering extraction for new report on component mount');
      
      if (report.accountSummaries && report.accountSummaries.length > 0) {
        const hasRealData = report.accountSummaries.some(summary => 
          (summary.open && summary.open !== "0") || 
          (summary.withBalance && summary.withBalance !== "0") || 
          (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0"));
        
        if (hasRealData) {
          console.log('Report already has real account data, using it');
          handleDataExtracted(report.accountSummaries, false, false);
          setInitialAccountDataFound(true);
          return;
        } else {
          console.log('Report has account summaries but no real data, will attempt extraction');
        }
      }
      
      setIsProcessing(true);
      
      const extractionTimer = setTimeout(() => {
        triggerExtraction(false);
      }, 500);
      
      return () => clearTimeout(extractionTimer);
    }
  }, [report?.reportId]);

  useEffect(() => {
    async function loadTableImage() {
      if (report && !tableImageUrl) {
        try {
          console.log('Attempting to extract table image for debug display');
          const imageUrl = await extractCreditAccountsTableImage(report);
          if (imageUrl) {
            console.log('Successfully extracted table image for debug display');
            setTableImageUrl(imageUrl);
            
            // Try to extract data from the image directly
            if (accountSummaries.length === 0 || extractionFailed) {
              console.log("Attempting direct extraction from table image");
              const tableData = await extractTableFromImage(imageUrl);
              if (tableData && tableData.rows && tableData.rows.length > 0) {
                const extractedSummaries = convertTableToAccountSummaries(tableData);
                if (extractedSummaries.length > 0) {
                  const hasRealData = extractedSummaries.some(summary => 
                    (summary.open && summary.open !== "0") || 
                    (summary.withBalance && summary.withBalance !== "0") || 
                    (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0"));
                    
                  if (hasRealData) {
                    console.log("Successfully extracted data from table image directly");
                    handleDataExtracted(extractedSummaries, false, false);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error extracting table image for debug:', error);
        }
      }
    }
    
    loadTableImage();
  }, [report, tableImageUrl]);

  const handleDataExtracted = (
    summaries: AccountSummary[], 
    isSampleData: boolean,
    failed: boolean
  ) => {
    console.log('Setting account summaries:', summaries);
    setAccountSummaries(summaries);
    setUsingSampleData(isSampleData);
    setExtractionFailed(failed);
    setAttemptedExtraction(true);
    
    setTimeout(() => {
      setIsProcessing(false);
    }, 500);
  };

  const triggerExtraction = (forceManual: boolean) => {
    setExtractionAttempts(prev => prev + 1);
    setAttemptedExtraction(true);
    
    if (!isProcessing) {
      setIsProcessing(true);
    }
    
    const extractorProps = {
      report,
      onDataExtracted: handleDataExtracted,
      isProcessing,
      setIsProcessing
    };
    
    import("./accounts/AccountDataExtractor").then(module => {
      if (typeof module.handleEnhancedExtraction === 'function') {
        module.handleEnhancedExtraction(extractorProps, forceManual);
      } else {
        console.log("Using AccountDataExtractor component method");
        const extractorComponent = <AccountDataExtractor {...extractorProps} />;
        if (extractorComponent && typeof extractorComponent.type.handleEnhancedExtraction === 'function') {
          extractorComponent.type.handleEnhancedExtraction(extractorProps, forceManual);
        } else {
          console.error("Could not access extraction method");
          setIsProcessing(false);
        }
      }
    }).catch(err => {
      console.error("Failed to import AccountDataExtractor:", err);
      setIsProcessing(false);
    });
  };

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
        
        <div className="flex gap-2">
          <AccountDataExtractor
            report={report}
            onDataExtracted={handleDataExtracted}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
          />
          
          <Button
            variant="default"
            size="sm"
            onClick={triggerPdfUpload}
            disabled={isProcessing}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Better PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Your credit report includes information about activity on your credit accounts that may affect your credit score and rating.</p>
        
        <AccountDataAlerts 
          extractionFailed={extractionFailed} 
          usingSampleData={usingSampleData}
          onRequestUpload={triggerPdfUpload}
        />
        
        <TableImageDisplay 
          imageUrl={tableImageUrl} 
          showDebugInfo={showDebugInfo} 
        />
        
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
        
        {isProcessing ? (
          <div className="py-8 flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 text-credit-blue animate-spin mb-4" />
            <p className="text-sm font-medium">
              Extracting account data...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Please wait while we analyze your credit accounts
            </p>
          </div>
        ) : (
          <CreditAccountsTable 
            accountSummaries={accountSummaries} 
            onRequestUpload={triggerPdfUpload}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedCreditAccounts;
