import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import CreditAccountsHeader from "./accounts/CreditAccountsHeader";
import CreditAccountsTable from "./accounts/CreditAccountsTable";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resetCurrentReportImage, getExtractedReportData } from "@/utils/pdf/extractText";
import { Progress } from "@/components/ui/progress";

import AccountDataExtractor from "./accounts/AccountDataExtractor";
import TableImageDisplay from "./accounts/TableImageDisplay";
import AccountDataAlerts from "./accounts/AccountDataAlerts";
import AccountDataDebug from "./accounts/AccountDataDebug";

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
  const [extractionProgress, setExtractionProgress] = useState(0);

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
      setExtractionProgress(0);

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
      
      startProgressAnimation();
      
      const extractionTimer = setTimeout(() => {
        triggerExtraction(false);
      }, 500);
      
      return () => clearTimeout(extractionTimer);
    }
  }, [report?.reportId]);

  const startProgressAnimation = () => {
    setExtractionProgress(0);
    const interval = setInterval(() => {
      setExtractionProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        
        if (prev < 30) return prev + 2;
        if (prev < 60) return prev + 1;
        if (prev < 80) return prev + 0.5;
        return prev + 0.2;
      });
    }, 200);

    return () => clearInterval(interval);
  };

  const getProgressMessage = (progress: number) => {
    if (progress < 30) return "Initializing credit account extraction...";
    if (progress < 60) return "Processing account details...";
    if (progress < 80) return "Analyzing credit data...";
    if (progress < 95) return "Finalizing account information...";
    if (progress < 100) return "Almost done...";
    return "Processing complete!";
  };

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
    
    setExtractionProgress(100);
    
    setTimeout(() => {
      setIsProcessing(false);
    }, 500);
  };

  const triggerExtraction = (forceManual: boolean) => {
    setExtractionAttempts(prev => prev + 1);
    setAttemptedExtraction(true);
    
    if (!isProcessing) {
      setIsProcessing(true);
      startProgressAnimation();
    }
    
    import("./accounts/AccountDataExtractor").then(module => {
      const extractor = new module.default({
        report,
        onDataExtracted: handleDataExtracted,
        isProcessing,
        setIsProcessing
      });
      
      if (typeof extractor.handleEnhancedExtraction === 'function') {
        extractor.handleEnhancedExtraction(forceManual);
      } else {
        console.error("Could not access extraction method");
        setIsProcessing(false);
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
            <div className="w-full max-w-md space-y-4">
              <Progress value={extractionProgress} className="h-2" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {getProgressMessage(extractionProgress)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(extractionProgress)}% Complete
                </p>
              </div>
            </div>
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
