
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
  
  // Required account types in order
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Set up initial account summaries and try extraction on first load
  useEffect(() => {
    if (report && report.reportId) {
      // Always reset current image state when a new report is loaded
      resetCurrentReportImage();
      
      // This is a new report, so reset all extraction state
      console.log('New report detected, resetting extraction state:', report.reportId);
      
      // Check if report already has account summaries
      if (report.accountSummaries && report.accountSummaries.length > 0) {
        console.log('Using account summaries from report object:', report.accountSummaries);
        const hasActualData = report.accountSummaries.some(summary => 
          (summary.open !== null && summary.open !== "") || 
          (summary.withBalance !== null && summary.withBalance !== "") || 
          (summary.totalBalance !== null && summary.totalBalance !== "")
        );
        
        if (hasActualData) {
          console.log('Report has actual data, using it');
          createOrderedAccountSummaries(report.accountSummaries);
          setAttemptedExtraction(true);
          setExtractionFailed(false);
          setUsingSampleData(false);
          return;
        } else {
          console.log('Report has account summaries but no actual data');
        }
      }
      
      // Reset states for new report
      setAccountSummaries([]);
      setAttemptedExtraction(false);
      setExtractionFailed(false);
      setExtractionAttempts(0);
      setUsingSampleData(false);
      
      // Added explicit log to see when extraction is triggered
      console.log('Auto-triggering extraction for new report on component mount');
      
      // Ensure we always trigger a fresh extraction for the current report
      // Add a slight delay to ensure DOM is ready with any uploaded images
      const extractionTimer = setTimeout(() => {
        handleEnhancedExtraction();
      }, 1000); // Increased delay to 1000ms to ensure DOM is fully loaded
      
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
          open: existingSummary.open === 0 || existingSummary.open === "0" ? "0" : 
                existingSummary.open !== null ? String(existingSummary.open) : null,
          withBalance: existingSummary.withBalance === 0 || existingSummary.withBalance === "0" ? "0" : 
                      existingSummary.withBalance !== null ? String(existingSummary.withBalance) : null,
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
      
      // Check if we already have extracted data in the report
      if (report.accountSummaries && report.accountSummaries.length > 0) {
        const hasActualData = report.accountSummaries.some(summary => 
          (summary.open !== null && summary.open !== "") || 
          (summary.withBalance !== null && summary.withBalance !== "") || 
          (summary.totalBalance !== null && summary.totalBalance !== "")
        );
        
        if (hasActualData) {
          console.log("Using account summaries with actual data from report object:", report.accountSummaries);
          createOrderedAccountSummaries(report.accountSummaries);
          setIsProcessing(false);
          toast.success("Using provided account data");
          return;
        } else {
          console.log("Report has account summaries but no actual data, continuing extraction");
        }
      }
      
      // Check if we have extracted data in our global cache
      const cachedData = getExtractedReportData();
      if (cachedData && cachedData.accountSummaries && cachedData.accountSummaries.length > 0) {
        const hasActualData = cachedData.accountSummaries.some(summary => 
          (summary.open !== null && summary.open !== "") || 
          (summary.withBalance !== null && summary.withBalance !== "") || 
          (summary.totalBalance !== null && summary.totalBalance !== "")
        );
        
        if (hasActualData) {
          console.log("Using account summaries with actual data from cached data:", cachedData.accountSummaries);
          createOrderedAccountSummaries(cachedData.accountSummaries);
          setIsProcessing(false);
          toast.success("Using extracted account data");
          return;
        } else {
          console.log("Cached data has account summaries but no actual data, continuing extraction");
        }
      }
      
      // Stage 1: Get the table image - this now always gets the latest image
      const tableImageUrl = await extractCreditAccountsTableImage(report);
      
      if (!tableImageUrl) {
        console.log("No table image found - using original report data");
        
        // If the report has account summaries, use those
        if (report.accountSummaries && report.accountSummaries.length > 0) {
          console.log("Using account summaries from report:", report.accountSummaries);
          createOrderedAccountSummaries(report.accountSummaries);
          setIsProcessing(false);
          toast.success("Using report's account data");
          return;
        }
        
        // Last resort - use the sample data
        console.log("No account data available - using sample data");
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
        
        setIsProcessing(false);
        return;
      }
      
      console.log("Using table image URL for extraction:", tableImageUrl);
      
      // Stage 2: Extract table data using template-based approach
      const tableData = await extractTableFromImage(tableImageUrl);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        console.log("Extracted table data:", tableData);
        
        // Convert to account summaries
        const extractedSummaries = convertTableToAccountSummaries(tableData);
        
        if (extractedSummaries.length > 0) {
          console.log('Successfully extracted account summaries:', extractedSummaries);
          toast.success("Successfully extracted account data");
          
          // Update the state
          createOrderedAccountSummaries(extractedSummaries);
          setExtractionFailed(false);
        } else {
          console.log("Failed to extract valid account data - trying report data");
          
          // Try to use data from the report object first
          if (report.accountSummaries && report.accountSummaries.length > 0) {
            createOrderedAccountSummaries(report.accountSummaries);
            toast.info("Using report's account data");
          } else {
            // Last resort - use sample data
            const tableData = createSimulatedTableData(false);
            if (tableData) {
              const sampleSummaries = convertTableToAccountSummaries(tableData);
              createOrderedAccountSummaries(sampleSummaries);
              setUsingSampleData(true);
              toast.info("Using sample account data (extraction failed)");
            }
          }
        }
      } else {
        console.log("Could not process table structure - trying report data");
        
        // Try to use data from the report object first
        if (report.accountSummaries && report.accountSummaries.length > 0) {
          createOrderedAccountSummaries(report.accountSummaries);
          toast.info("Using report's account data");
        } else {
          // Last resort - use sample data
          const tableData = createSimulatedTableData(false);
          if (tableData) {
            const sampleSummaries = convertTableToAccountSummaries(tableData);
            createOrderedAccountSummaries(sampleSummaries);
            setUsingSampleData(true);
            toast.info("Using sample account data (extraction failed)");
          }
        }
      }
    } catch (error) {
      console.error("Error during extraction:", error);
      
      // Try to use data from the report object first
      if (report.accountSummaries && report.accountSummaries.length > 0) {
        createOrderedAccountSummaries(report.accountSummaries);
        toast.warning("Using report's account data due to extraction error");
      } else {
        // Last resort - use sample data
        const tableData = createSimulatedTableData(false);
        if (tableData) {
          const sampleSummaries = convertTableToAccountSummaries(tableData);
          createOrderedAccountSummaries(sampleSummaries);
          setUsingSampleData(true);
          toast.error("Using sample data due to extraction error");
        }
      }
      
      setExtractionFailed(true);
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
              Table extraction failed. You can retry the extraction or manually enter the data.
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
        
        {showDebugInfo && (
          <div className="mb-4 p-4 border rounded bg-slate-50">
            <p className="text-xs mb-2">Debug: Extraction attempts: {extractionAttempts}</p>
            <p className="text-xs mb-2">Report ID: {report.reportId || 'None'}</p>
            <p className="text-xs mb-2">Using sample data: {usingSampleData ? 'Yes' : 'No'}</p>
            <p className="text-xs mb-2">Uploaded image found: {attemptedExtraction ? 'Yes' : 'Not tried yet'}</p>
            <CreditAccountsDebug accountSummaries={report.accountSummaries || []} />
          </div>
        )}
        
        <CreditAccountsTable accountSummaries={accountSummaries} />
      </CardContent>
    </Card>
  );
};

export default EnhancedCreditAccounts;
