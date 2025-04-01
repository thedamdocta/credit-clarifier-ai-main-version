
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
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);
  
  // Required account types in order
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Set up initial account summaries and try extraction on first load
  useEffect(() => {
    if (report && report.reportId) {
      // Always reset current image state when a new report is loaded
      resetCurrentReportImage();
      
      // This is a new report, so reset all extraction state
      console.log('New report detected, resetting extraction state:', report.reportId);
      
      // Reset states for new report
      setAccountSummaries([]);
      setAttemptedExtraction(false);
      setExtractionFailed(false);
      setExtractionAttempts(0);
      setUsingSampleData(false);
      setTableImageUrl(null);
      
      // Added explicit log to see when extraction is triggered
      console.log('Auto-triggering extraction for new report on component mount');
      
      // Ensure we always trigger a fresh extraction for the current report
      // Add a slight delay to ensure DOM is ready with any uploaded images
      const extractionTimer = setTimeout(() => {
        handleEnhancedExtraction();
      }, 1500); // Increased delay to 1500ms to ensure DOM is fully loaded
      
      // Clear the timer on cleanup
      return () => clearTimeout(extractionTimer);
    }
  }, [report?.reportId]); // Only trigger when reportId changes to ensure it's a truly new report
  
  // Create properly ordered account summaries with empty values for missing types
  const createOrderedAccountSummaries = (sourceSummaries: AccountSummary[]) => {
    const orderedSummaries: AccountSummary[] = [];
    
    // First create a map of existing account summaries by type
    const summariesByType = new Map<string, AccountSummary>();
    
    if (sourceSummaries && sourceSummaries.length > 0) {
      sourceSummaries.forEach(summary => {
        if (summary.accountType) {
          // Preserve all existing data including null values
          summariesByType.set(summary.accountType, { ...summary });
        }
      });
    }
    
    // Then create our final list in the required order, creating empty entries for missing types
    requiredAccountTypes.forEach(accountType => {
      const existingSummary = summariesByType.get(accountType);
      
      if (existingSummary) {
        // Fix: Ensure consistent string type for all fields that might be compared
        // Convert all numeric values to strings to avoid type comparison errors
        orderedSummaries.push({
          ...existingSummary,
          // Handling specific case for the type comparison errors
          // Consistently convert all values to strings if they exist, or null if they don't
          open: existingSummary.open === "0" || (existingSummary.open !== null && existingSummary.open !== undefined && existingSummary.open.toString() === "0") ? 
                "0" : existingSummary.open !== null ? String(existingSummary.open) : null,
          withBalance: existingSummary.withBalance === "0" || (existingSummary.withBalance !== null && existingSummary.withBalance !== undefined && existingSummary.withBalance.toString() === "0") ? 
                      "0" : existingSummary.withBalance !== null ? String(existingSummary.withBalance) : null,
          totalBalance: existingSummary.totalBalance !== null ? 
                       String(existingSummary.totalBalance) : null,
          available: existingSummary.available !== null ? 
                   String(existingSummary.available) : null,
          creditLimit: existingSummary.creditLimit !== null ? 
                     String(existingSummary.creditLimit) : null,
          payment: existingSummary.payment !== null ? 
                 String(existingSummary.payment) : null,
          debtToCredit: existingSummary.debtToCredit !== null ?
                       String(existingSummary.debtToCredit) : null
        });
      } else {
        // Create default entry with null values for missing account types
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
  };
  
  // Check if account summaries have actual data
  const hasActualData = (summaries: AccountSummary[]) => {
    if (!summaries || summaries.length === 0) return false;
    
    return summaries.some(summary => 
      (summary.open !== null && summary.open !== "") || 
      (summary.withBalance !== null && summary.withBalance !== "") || 
      (summary.totalBalance !== null && summary.totalBalance !== ""));
  };
  
  // Two-stage enhanced table extraction
  const handleEnhancedExtraction = async () => {
    try {
      setIsProcessing(true);
      setExtractionFailed(false);
      setAttemptedExtraction(true);
      setExtractionAttempts(prev => prev + 1);
      setUsingSampleData(false);
      
      toast.info("Extracting account data...");
      console.log("Starting enhanced extraction process for report:", report?.reportId);
      
      // Stage 1: Get the table image 
      const newTableImageUrl = await extractCreditAccountsTableImage(report);
      setTableImageUrl(newTableImageUrl);
      
      if (!newTableImageUrl) {
        console.log("No table image found, attempting text-based extraction");
        
        // Check if the report has text-based data we can parse
        if (report.rawText && report.rawText.length > 0) {
          // Look for credit account table patterns in the text
          const tablePattern = /\b(account\s+type|revolving|mortgage|installment|total).+(\d+)\s+(\d+)\s+\$[\d,]+/i;
          if (tablePattern.test(report.rawText)) {
            toast.info("Attempting to extract data from report text");
            
            // Parse existing report account summaries if available
            if (report.accountSummaries && report.accountSummaries.length > 0) {
              if (hasActualData(report.accountSummaries)) {
                console.log("Using account summaries from report text:", report.accountSummaries);
                createOrderedAccountSummaries(report.accountSummaries);
                setIsProcessing(false);
                toast.success("Successfully extracted account data from text");
                return;
              }
            }
          }
        }
        
        // If we couldn't get data from the text, check for cached data
        const cachedData = getExtractedReportData();
        if (cachedData && cachedData.accountSummaries && hasActualData(cachedData.accountSummaries)) {
          console.log("Using account summaries from cached data");
          createOrderedAccountSummaries(cachedData.accountSummaries);
          setIsProcessing(false);
          toast.success("Using cached account data");
          return;
        }
        
        // Last resort - use sample data in development mode only
        if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
          console.log("No account data available - using sample data for development");
          const tableData = createSimulatedTableData(false);
          if (tableData) {
            const sampleSummaries = convertTableToAccountSummaries(tableData);
            createOrderedAccountSummaries(sampleSummaries);
            setUsingSampleData(true);
            toast.info("Using sample account data (no image found)");
          } else {
            setExtractionFailed(true);
            toast.error("Failed to extract account data");
          }
        } else {
          // In production, don't show sample data
          console.log("No account data available in production - showing extraction failed");
          setExtractionFailed(true);
          toast.error("No account data found in this report");
        }
        
        setIsProcessing(false);
        return;
      }
      
      console.log("Using table image URL for extraction:", newTableImageUrl);
      
      // Stage 2: Extract table data using template-based approach
      const tableData = await extractTableFromImage(newTableImageUrl);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        console.log("Extracted table data:", tableData);
        
        // Convert to account summaries
        const extractedSummaries = convertTableToAccountSummaries(tableData);
        
        if (extractedSummaries.length > 0 && hasActualData(extractedSummaries)) {
          console.log('Successfully extracted account summaries:', extractedSummaries);
          toast.success("Successfully extracted account data");
          
          // Update the state
          createOrderedAccountSummaries(extractedSummaries);
          setExtractionFailed(false);
          setUsingSampleData(false);
        } else {
          console.log("Extracted data had no meaningful values");
          setExtractionFailed(true);
          toast.error("No valid account data could be extracted");
        }
      } else {
        console.log("Could not process table structure");
        setExtractionFailed(true);
        toast.error("Table extraction failed");
      }
    } catch (error) {
      console.error("Error during extraction:", error);
      setExtractionFailed(true);
      toast.error("Error during data extraction");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CreditAccountsHeader 
          showDebugInfo={showDebugInfo} 
          toggleDebug={() => setShowDebugInfo(!showDebugInfo)} 
        />
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleEnhancedExtraction}
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
              {attemptedExtraction ? "Retry Extraction" : "Extract Data"}
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Your credit report includes information about activity on your credit accounts that may affect your credit score and rating.</p>
        
        {extractionFailed && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No account data was found in your credit report. You can retry the extraction or upload a clearer image of your account summary table.
            </AlertDescription>
          </Alert>
        )}
        
        {usingSampleData && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Using sample data. Upload a table image or retry extraction to see actual data.
            </AlertDescription>
          </Alert>
        )}
        
        {tableImageUrl && showDebugInfo && (
          <div className="mb-4">
            <p className="text-xs mb-1">Extracted Table Image:</p>
            <AspectRatio ratio={16/9} className="bg-muted">
              <img src={tableImageUrl} alt="Extracted table" className="rounded-md object-cover w-full h-full" />
            </AspectRatio>
          </div>
        )}
        
        {showDebugInfo && (
          <div className="mb-4 p-4 border rounded bg-slate-50">
            <p className="text-xs mb-2">Debug: Extraction attempts: {extractionAttempts}</p>
            <p className="text-xs mb-2">Report ID: {report.reportId || 'None'}</p>
            <p className="text-xs mb-2">Using sample data: {usingSampleData ? 'Yes' : 'No'}</p>
            <p className="text-xs mb-2">Uploaded image found: {tableImageUrl ? 'Yes' : 'No'}</p>
            <p className="text-xs mb-2">Raw text length: {report.rawText ? report.rawText.length : 0} characters</p>
            <CreditAccountsDebug accountSummaries={report.accountSummaries || []} />
          </div>
        )}
        
        <CreditAccountsTable accountSummaries={accountSummaries} />
      </CardContent>
    </Card>
  );
};

export default EnhancedCreditAccounts;
