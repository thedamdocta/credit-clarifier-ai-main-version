
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import CreditAccountsHeader from "./accounts/CreditAccountsHeader";
import CreditAccountsDebug from "./accounts/CreditAccountsDebug";
import CreditAccountsTable from "./accounts/CreditAccountsTable";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { toast } from "sonner";
import { extractCreditAccountsTableImage, resetCurrentReportImage } from "@/utils/pdf/extractText";
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
      
      // Ensure we always trigger a fresh extraction for the current report
      // Add a slight delay to ensure DOM is ready with any uploaded images
      setTimeout(() => {
        handleEnhancedExtraction();
      }, 500);
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
        orderedSummaries.push(existingSummary);
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
      
      toast.info("Extracting account data...");
      
      // Stage 1: Get the table image - this now always gets the latest image
      const tableImageUrl = await extractCreditAccountsTableImage(report);
      
      if (!tableImageUrl) {
        console.error("Could not identify account table image");
        toast.error("Could not identify account table image");
        setIsProcessing(false);
        setExtractionFailed(true);
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
          console.error("Failed to extract valid account data");
          toast.error("Failed to extract valid account data");
          setExtractionFailed(true);
          
          // Create empty account summaries with just the account types
          createOrderedAccountSummaries([]);
        }
      } else {
        console.error("Could not process table structure from image");
        toast.error("Could not process table structure");
        setExtractionFailed(true);
        
        // Create empty account summaries with just the account types
        createOrderedAccountSummaries([]);
      }
    } catch (error) {
      console.error("Error during extraction:", error);
      toast.error("Data extraction failed");
      setExtractionFailed(true);
      
      // Create empty account summaries with just the account types
      createOrderedAccountSummaries([]);
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
        
        {showDebugInfo && (
          <div className="mb-4 p-4 border rounded bg-slate-50">
            <p className="text-xs mb-2">Debug: Extraction attempts: {extractionAttempts}</p>
            <p className="text-xs mb-2">Report ID: {report.reportId || 'None'}</p>
            <CreditAccountsDebug accountSummaries={report.accountSummaries || []} />
          </div>
        )}
        
        <CreditAccountsTable accountSummaries={accountSummaries} />
      </CardContent>
    </Card>
  );
};

export default EnhancedCreditAccounts;
