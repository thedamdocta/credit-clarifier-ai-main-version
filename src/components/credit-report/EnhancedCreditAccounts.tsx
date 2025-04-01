
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
  
  // Required account types in order
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Set up initial account summaries and try extraction on first load
  useEffect(() => {
    if (report) {
      // Reset current image state when a new report is loaded
      resetCurrentReportImage();
      
      // Use a unique identifier for the report - either reportId if available or generate one from bureau and date
      const reportIdentifier = report.reportId || 
                              `${report.bureau}-${report.reportDate}-${Date.now()}`;
      console.log('New report detected, resetting extraction state:', reportIdentifier);
      setAttemptedExtraction(false);
      setExtractionFailed(false);
      
      if (report.accountSummaries && report.accountSummaries.length > 0) {
        console.log('Using account summaries from report:', report.accountSummaries.length);
        createOrderedAccountSummaries(report.accountSummaries);
      } else {
        console.log('No account summaries found in report, triggering extraction');
        // Try extraction immediately on first load
        handleEnhancedExtraction();
      }
    }
  }, [report]);
  
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
    
    setAccountSummaries(orderedSummaries);
  };
  
  // Two-stage enhanced table extraction
  const handleEnhancedExtraction = async () => {
    try {
      setIsProcessing(true);
      setExtractionFailed(false);
      setAttemptedExtraction(true);
      toast.info("Extracting account data...");
      
      // Ensure we have a fresh extraction attempt by resetting the image URL
      resetCurrentReportImage();
      
      // Stage 1: Get the table image
      const tableImageUrl = await extractCreditAccountsTableImage(report);
      
      if (!tableImageUrl) {
        toast.error("Could not identify account table image");
        setIsProcessing(false);
        setExtractionFailed(true);
        return;
      }
      
      console.log("Using table image URL for extraction:", tableImageUrl);
      
      // Stage 2: Extract table data using template-based approach
      const tableData = await extractTableFromImage(tableImageUrl);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        // Convert to account summaries
        const extractedSummaries = convertTableToAccountSummaries(tableData);
        
        if (extractedSummaries.length > 0) {
          toast.success("Successfully extracted account data");
          // Update the state
          createOrderedAccountSummaries(extractedSummaries);
          setExtractionFailed(false);
        } else {
          toast.error("Failed to extract valid account data");
          setExtractionFailed(true);
        }
      } else {
        toast.error("Could not process table structure");
        setExtractionFailed(true);
      }
    } catch (error) {
      console.error("Error during extraction:", error);
      toast.error("Data extraction failed");
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
        
        {showDebugInfo && <CreditAccountsDebug accountSummaries={report.accountSummaries || []} />}
        
        <CreditAccountsTable accountSummaries={accountSummaries} />
      </CardContent>
    </Card>
  );
};

export default EnhancedCreditAccounts;
