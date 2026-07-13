
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
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";
import { devDiagnostics } from "@/lib/security/devDiagnostics";

interface EnhancedCreditAccountsProps {
  report: CreditReport;
}

const EnhancedCreditAccounts: React.FC<EnhancedCreditAccountsProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const { advancedUiEnabled } = useReportWorkspace();
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
    if (!advancedUiEnabled) {
      setShowDebugInfo(false);
    }
  }, [advancedUiEnabled]);

  useEffect(() => {
    if (report && report.reportId) {
      resetCurrentReportImage();
      
      devDiagnostics.log('New report detected, resetting extraction state:', report.reportId);
      
      setAccountSummaries([]);
      setAttemptedExtraction(false);
      setExtractionFailed(false);
      setExtractionAttempts(0);
      setUsingSampleData(false);
      setTableImageUrl(null);
      setInitialAccountDataFound(false);

      devDiagnostics.log('Auto-triggering extraction for new report on component mount');
      
      if (report.accountSummaries && report.accountSummaries.length > 0) {
        const hasRealData = report.accountSummaries.some(summary => 
          (summary.open && summary.open !== "0") || 
          (summary.withBalance && summary.withBalance !== "0") || 
          (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0"));
        
        if (hasRealData) {
          devDiagnostics.log('Report already has real account data, using it');
          handleDataExtracted(report.accountSummaries, false, false);
          setInitialAccountDataFound(true);
          return;
        } else {
          devDiagnostics.log('Report has account summaries but no real data, will attempt extraction');
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
          devDiagnostics.log('Attempting to extract table image for debug display');
          const imageUrl = await extractCreditAccountsTableImage(report);
          if (imageUrl) {
            devDiagnostics.log('Successfully extracted table image for debug display');
            setTableImageUrl(imageUrl);
          }
        } catch (error) {
          devDiagnostics.error('Error extracting table image for debug:', error);
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
    // Log all the summaries for debugging
    devDiagnostics.log('Setting account summaries:', summaries);
    
    // Check if we have real data
    const hasRealData = summaries.some(summary => 
      (summary.open && summary.open !== "0") || 
      (summary.withBalance && summary.withBalance !== "0") || 
      (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0"));
    
    if (hasRealData) {
      devDiagnostics.log("Data has real values, using extracted data");
      setAccountSummaries(summaries);
      setUsingSampleData(isSampleData);
      setExtractionFailed(failed);
    } else {
      devDiagnostics.log("Data has no real values, keeping extraction failed state");
      setExtractionFailed(true);
    }
    
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
    
    // Try handling the extraction directly with the image if available
    if (tableImageUrl && forceManual) {
      devDiagnostics.log("Using table image for direct extraction");
      extractDataFromImage(tableImageUrl);
      return;
    }
    
    import("./accounts/AccountDataExtractor").then(module => {
      if (typeof module.handleEnhancedExtraction === 'function') {
        module.handleEnhancedExtraction(extractorProps, forceManual);
      } else {
        devDiagnostics.log("Using AccountDataExtractor component method");
        const extractorComponent = <AccountDataExtractor {...extractorProps} />;
        if (extractorComponent && typeof extractorComponent.type.handleEnhancedExtraction === 'function') {
          extractorComponent.type.handleEnhancedExtraction(extractorProps, forceManual);
        } else {
          devDiagnostics.error("Could not access extraction method");
          setIsProcessing(false);
        }
      }
    }).catch(err => {
      devDiagnostics.error("Failed to import AccountDataExtractor:", err);
      setIsProcessing(false);
    });
  };

  const extractDataFromImage = async (imageUrl: string) => {
    try {
      setIsProcessing(true);
      toast.info("Extracting data from image directly...");
      
      // Add a cache-busting parameter
      const cacheBustUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      
      const tableData = await extractTableFromImage(cacheBustUrl);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        const extractedSummaries = convertTableToAccountSummaries(tableData);
        const hasRealData = extractedSummaries.some(summary => 
          (summary.open && summary.open !== "0") || 
          (summary.withBalance && summary.withBalance !== "0") || 
          (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0"));
        
        if (hasRealData) {
          devDiagnostics.log("Successfully extracted data from image directly");
          handleDataExtracted(extractedSummaries, false, false);
          toast.success("Successfully extracted data from image");
        } else {
          devDiagnostics.error("No meaningful data in extracted result");
          toast.error("No meaningful data could be extracted");
          setIsProcessing(false);
        }
      } else {
        devDiagnostics.error("Failed to extract table data");
        toast.error("Failed to extract data from image");
        setIsProcessing(false);
      }
    } catch (error) {
      devDiagnostics.error("Error extracting data from image:", error);
      toast.error("Error extracting data from image");
      setIsProcessing(false);
    }
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
          showDebugInfo={advancedUiEnabled && showDebugInfo}
          onDataExtracted={(summaries) => {
            if (summaries && summaries.length > 0) {
              handleDataExtracted(summaries, false, false);
            }
          }}
        />
        
        <AccountDataDebug
          showDebugInfo={advancedUiEnabled && showDebugInfo}
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
