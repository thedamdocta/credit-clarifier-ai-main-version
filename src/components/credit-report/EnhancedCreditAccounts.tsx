import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import CreditAccountsHeader from "./accounts/CreditAccountsHeader";
import CreditAccountsDebug from "./accounts/CreditAccountsDebug";
import CreditAccountsTable from "./accounts/CreditAccountsTable";
import { extractTableFromImage, convertTableToAccountSummaries, createSimulatedTableData } from "@/lib/ai/tableExtraction";
import { toast } from "sonner";
import { extractCreditAccountsTableImage, resetCurrentReportImage, getExtractedReportData } from "@/utils/pdf/extractText";
import { Loader2, RefreshCw, AlertCircle, Upload, Info, Image } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { parsingLogger } from "@/utils/parsingLogger";

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
          createOrderedAccountSummaries(report.accountSummaries);
          setInitialAccountDataFound(true);
          return;
        }
      }
      
      const extractionTimer = setTimeout(() => {
        handleEnhancedExtraction(false);
      }, 2000);
      
      return () => clearTimeout(extractionTimer);
    }
  }, [report?.reportId]);
  
  const createOrderedAccountSummaries = (sourceSummaries: AccountSummary[]) => {
    const orderedSummaries: AccountSummary[] = [];
    
    const summariesByType = new Map<string, AccountSummary>();
    
    if (sourceSummaries && sourceSummaries.length > 0) {
      sourceSummaries.forEach(summary => {
        if (summary.accountType) {
          summariesByType.set(summary.accountType, { ...summary });
        }
      });
    }
    
    requiredAccountTypes.forEach(accountType => {
      const existingSummary = summariesByType.get(accountType);
      
      if (existingSummary) {
        const isTotalRow = accountType.toLowerCase() === 'total';
        
        const isZeroOpen = existingSummary.open === "0" || 
                           (typeof existingSummary.open === 'string' && existingSummary.open === "0") ||
                           (typeof existingSummary.open === 'number' && existingSummary.open === 0);
        
        const isZeroWithBalance = existingSummary.withBalance === "0" || 
                                 (typeof existingSummary.withBalance === 'string' && existingSummary.withBalance === "0") ||
                                 (typeof existingSummary.withBalance === 'number' && existingSummary.withBalance === 0);
        
        orderedSummaries.push({
          ...existingSummary,
          open: isZeroOpen ? "0" : existingSummary.open !== null ? String(existingSummary.open) : null,
          withBalance: isZeroWithBalance ? "0" : existingSummary.withBalance !== null ? String(existingSummary.withBalance) : null,
          totalBalance: existingSummary.totalBalance !== null ? String(existingSummary.totalBalance) : null,
          available: existingSummary.available !== null ? String(existingSummary.available) : null,
          creditLimit: existingSummary.creditLimit !== null ? String(existingSummary.creditLimit) : null,
          payment: existingSummary.payment !== null ? String(existingSummary.payment) : null,
          debtToCredit: existingSummary.debtToCredit !== null ? String(existingSummary.debtToCredit) : null
        });
      } else {
        orderedSummaries.push({
          accountType,
          totalAccounts: null,
          open: null,
          closed: null,
          balance: null,
          withBalance: null,
          totalBalance: null,
          available: null,
          creditLimit: null,
          debtToCredit: null,
          payment: null
        });
      }
    });
    
    console.log('Setting ordered account summaries:', orderedSummaries);
    setAccountSummaries(orderedSummaries);
    
    const hasActualData = hasRealData(orderedSummaries);
    const isSampleDataDetected = isSampleData(orderedSummaries);
    
    setUsingSampleData(isSampleDataDetected || !hasActualData);
    setExtractionFailed(!hasActualData);
  };
  
  const hasRealData = (summaries: AccountSummary[]) => {
    if (!summaries || summaries.length === 0) return false;
    
    return summaries.some(summary => 
      summary.accountType.toLowerCase() !== 'total' && (
        (summary.open !== null && summary.open !== "" && summary.open !== "0") || 
        (summary.withBalance !== null && summary.withBalance !== "" && summary.withBalance !== "0") || 
        (summary.totalBalance !== null && summary.totalBalance !== "" && 
         summary.totalBalance !== "$0" && summary.totalBalance !== "0")
      )
    );
  };
  
  const isSampleData = (summaries: AccountSummary[]) => {
    if (!summaries || summaries.length === 0) return false;
    
    const hasRevolvingSample = summaries.some(s => 
      s.accountType === "Revolving" && 
      s.totalBalance === "$16,355" && 
      s.payment === "$627");
    
    const hasInstallmentSample = summaries.some(s => 
      s.accountType === "Installment" && 
      s.totalBalance === "$204,150" && 
      s.available === "$15,455");
    
    return hasRevolvingSample && hasInstallmentSample;
  };
  
  const handleEnhancedExtraction = async (forceManualExtraction: boolean = true) => {
    try {
      setIsProcessing(true);
      setExtractionFailed(false);
      setAttemptedExtraction(true);
      setExtractionAttempts(prev => prev + 1);
      
      if (forceManualExtraction) {
        setUsingSampleData(false);
      }
      
      if (forceManualExtraction) {
        toast.info("Extracting account data...");
      }
      console.log("Starting enhanced extraction process for report:", report?.reportId);
      
      if (report.accountSummaries && report.accountSummaries.length > 0) {
        const existingDataHasValues = hasRealData(report.accountSummaries);
        
        if (existingDataHasValues) {
          console.log("Using existing account data from report:", report.accountSummaries);
          createOrderedAccountSummaries(report.accountSummaries);
          setIsProcessing(false);
          if (forceManualExtraction) {
            toast.success("Using existing account data from report");
          }
          return;
        }
      }
      
      console.log("Attempting to extract table image from PDF");
      const newTableImageUrl = await extractCreditAccountsTableImage(report);
      console.log("Table image extraction result:", newTableImageUrl ? "Success" : "Failed");
      setTableImageUrl(newTableImageUrl);
      
      if (newTableImageUrl) {
        parsingLogger.logEvent('Table image extracted', { tableImageUrl: newTableImageUrl });
      }
      
      if (!newTableImageUrl) {
        console.log("No table image found, attempting text-based extraction");
        
        if (report.rawText && report.rawText.length > 0) {
          const tablePattern = /\b(account\s+type|revolving|mortgage|installment|total).+(\d+)\s+(\d+)\s+\$?([\d,]+)/i;
          if (tablePattern.test(report.rawText)) {
            if (forceManualExtraction) {
              toast.info("Attempting to extract data from report text");
            }
            
            if (report.accountSummaries && report.accountSummaries.length > 0) {
              if (hasRealData(report.accountSummaries)) {
                console.log("Using account summaries from report text:", report.accountSummaries);
                createOrderedAccountSummaries(report.accountSummaries);
                setIsProcessing(false);
                if (forceManualExtraction) {
                  toast.success("Successfully extracted account data from text");
                }
                return;
              }
            }
          }
        }
        
        const cachedData = getExtractedReportData();
        if (cachedData && cachedData.accountSummaries && hasRealData(cachedData.accountSummaries)) {
          console.log("Using account summaries from cached data");
          createOrderedAccountSummaries(cachedData.accountSummaries);
          setIsProcessing(false);
          if (forceManualExtraction) {
            toast.success("Using cached account data");
          }
          return;
        }
        
        console.log("No account data available - using empty state");
        
        const emptySummaries: AccountSummary[] = requiredAccountTypes.map(accountType => ({
          accountType,
          totalAccounts: null,
          open: null,
          closed: null,
          balance: null,
          withBalance: null,
          totalBalance: null,
          available: null,
          creditLimit: null,
          debtToCredit: null,
          payment: null
        }));
        
        createOrderedAccountSummaries(emptySummaries);
        setExtractionFailed(true);
        
        if (forceManualExtraction) {
          toast.error("No account data found. Please upload a clearer image of your credit report.");
        }
        
        setIsProcessing(false);
        return;
      }
      
      console.log("Using table image URL for extraction:", newTableImageUrl);
      
      console.log("Attempting to extract table data from image");
      const tableData = await extractTableFromImage(newTableImageUrl);
      console.log("Table extraction result:", tableData);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        console.log("Extracted table data:", tableData);
        
        const extractedSummaries = convertTableToAccountSummaries(tableData);
        console.log("Converted to account summaries:", extractedSummaries);
        
        if (extractedSummaries.length > 0 && hasRealData(extractedSummaries) && !isSampleData(extractedSummaries)) {
          console.log('Successfully extracted account summaries:', extractedSummaries);
          if (forceManualExtraction) {
            toast.success("Successfully extracted account data");
          }
          
          createOrderedAccountSummaries(extractedSummaries);
          setExtractionFailed(false);
          setUsingSampleData(false);
        } else {
          console.log("Extracted data had no meaningful values or was sample data");
          setExtractionFailed(true);
          if (forceManualExtraction) {
            toast.error("Extraction failed. Please upload a clearer image or try a different credit report.");
          }
          
          createOrderedAccountSummaries(extractedSummaries);
        }
      } else {
        console.log("Could not process table structure");
        setExtractionFailed(true);
        if (forceManualExtraction) {
          toast.error("Table extraction failed");
        }
        
        const emptySummaries: AccountSummary[] = requiredAccountTypes.map(accountType => ({
          accountType,
          totalAccounts: null,
          open: null,
          closed: null,
          balance: null,
          withBalance: null,
          totalBalance: null,
          available: null,
          creditLimit: null,
          debtToCredit: null,
          payment: null
        }));
        
        createOrderedAccountSummaries(emptySummaries);
      }
    } catch (error) {
      console.error("Error during extraction:", error);
      setExtractionFailed(true);
      if (forceManualExtraction) {
        toast.error("Error during data extraction");
      }
      
      const emptySummaries: AccountSummary[] = requiredAccountTypes.map(accountType => ({
        accountType,
        totalAccounts: null,
        open: null,
        closed: null,
        balance: null,
        withBalance: null,
        totalBalance: null,
        available: null,
        creditLimit: null,
        debtToCredit: null,
        payment: null
      }));
      
      createOrderedAccountSummaries(emptySummaries);
    } finally {
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEnhancedExtraction(true)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Extraction
              </>
            )}
          </Button>
          
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
        
        {extractionFailed && !usingSampleData && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              We couldn't extract account data from your credit report. Try uploading a clearer PDF with the account summary table clearly visible.
            </AlertDescription>
          </Alert>
        )}
        
        {usingSampleData && (
          <Alert className="mb-4 bg-amber-50 border-amber-200">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 flex items-center justify-between">
              <span>Upload a clearer credit report PDF to see your actual account data.</span>
              <Button variant="outline" size="sm" className="ml-4 bg-white" onClick={triggerPdfUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Better PDF
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {tableImageUrl && showDebugInfo && (
          <div className="mb-4 border rounded-md p-2">
            <p className="text-xs mb-1 text-muted-foreground flex items-center">
              <Image className="h-4 w-4 mr-1" />
              Extracted Table Image:
            </p>
            <AspectRatio ratio={16/9} className="bg-muted">
              <img src={tableImageUrl} alt="Extracted table" className="rounded-md object-contain w-full h-full" />
            </AspectRatio>
          </div>
        )}
        
        {showDebugInfo && (
          <div className="mb-4 p-4 border rounded bg-slate-50">
            <p className="text-xs mb-2">Debug: Extraction attempts: {extractionAttempts}</p>
            <p className="text-xs mb-2">Report ID: {report.reportId || 'None'}</p>
            <p className="text-xs mb-2">Using sample data: {usingSampleData ? 'Yes' : 'No'}</p>
            <p className="text-xs mb-2">Uploaded image found: {tableImageUrl ? 'Yes' : 'No'}</p>
            <p className="text-xs mb-2">Extraction failed: {extractionFailed ? 'Yes' : 'No'}</p>
            <p className="text-xs mb-2">Initial data found: {initialAccountDataFound ? 'Yes' : 'No'}</p>
            <p className="text-xs mb-2">Raw text length: {report.rawText ? report.rawText.length : 0} characters</p>
            <CreditAccountsDebug 
              accountSummaries={accountSummaries} 
              tableImageUrl={tableImageUrl}
            />
          </div>
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
