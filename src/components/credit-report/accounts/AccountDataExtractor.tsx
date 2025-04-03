
import React, { useState } from "react";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { toast } from "sonner";
import { extractCreditAccountsTableImage, resetCurrentReportImage, getExtractedReportData } from "@/utils/pdf/extractText";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

interface AccountDataExtractorProps {
  report: CreditReport;
  onDataExtracted: (accountSummaries: AccountSummary[], usingSampleData: boolean, failed: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

// Export the enhanced extraction function to be called directly
export const handleEnhancedExtraction = async (
  props: AccountDataExtractorProps,
  forceManualExtraction: boolean = true
) => {
  const { report, onDataExtracted, setIsProcessing } = props;
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  try {
    setIsProcessing(true);
    
    if (forceManualExtraction) {
      toast.info("Extracting account data...");
    }
    console.log("Starting enhanced extraction process for report:", report?.reportId);
    
    if (report.accountSummaries && report.accountSummaries.length > 0) {
      console.log("Checking existing account summaries:", report.accountSummaries);
      const existingDataHasValues = hasRealData(report.accountSummaries);
      
      if (existingDataHasValues) {
        console.log("Using existing account data from report:", report.accountSummaries);
        createOrderedAccountSummaries(report.accountSummaries, onDataExtracted, requiredAccountTypes);
        setIsProcessing(false);
        if (forceManualExtraction) {
          toast.success("Using existing account data from report");
        }
        return;
      } else {
        console.log("Existing account data has no real values, proceeding with extraction");
      }
    } else {
      console.log("No existing account data in report, proceeding with extraction");
    }
    
    console.log("Attempting to extract table image from report");
    const newTableImageUrl = await extractCreditAccountsTableImage(report);
    
    if (!newTableImageUrl) {
      console.log("No table image found, attempting text-based extraction");
      
      if (report.rawText && report.rawText.length > 0) {
        console.log("Checking raw text for table patterns");
        const tablePattern = /\b(account\s+type|revolving|mortgage|installment|total).+(\d+)\s+(\d+)\s+\$?([\d,]+)/i;
        if (tablePattern.test(report.rawText)) {
          console.log("Found table pattern in raw text");
          if (forceManualExtraction) {
            toast.info("Attempting to extract data from report text");
          }
          
          if (report.accountSummaries && report.accountSummaries.length > 0) {
            if (hasRealData(report.accountSummaries)) {
              console.log("Using account summaries from report text:", report.accountSummaries);
              createOrderedAccountSummaries(report.accountSummaries, onDataExtracted, requiredAccountTypes);
              setIsProcessing(false);
              if (forceManualExtraction) {
                toast.success("Successfully extracted account data from text");
              }
              return;
            }
          }
        } else {
          console.log("No table pattern found in raw text");
        }
      }
      
      console.log("Checking for cached report data");
      const cachedData = getExtractedReportData();
      if (cachedData && cachedData.accountSummaries && hasRealData(cachedData.accountSummaries)) {
        console.log("Using account summaries from cached data:", cachedData.accountSummaries);
        createOrderedAccountSummaries(cachedData.accountSummaries, onDataExtracted, requiredAccountTypes);
        setIsProcessing(false);
        if (forceManualExtraction) {
          toast.success("Using cached account data");
        }
        return;
      }
      
      console.log("No account data available - using empty data");
      
      // Create empty data structure instead of sample data
      const emptyData = requiredAccountTypes.map(type => ({
        accountType: type,
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
      
      onDataExtracted(emptyData, false, true);
      
      if (forceManualExtraction) {
        toast.warning("No account data found in the report. Please try uploading a better PDF or retry extraction.");
      }
      
      setIsProcessing(false);
      return;
    }
    
    console.log("Using table image URL for extraction:", newTableImageUrl);
    
    const tableData = await extractTableFromImage(newTableImageUrl);
    console.log("Table extraction result:", tableData);
    
    if (tableData && tableData.rows && tableData.rows.length > 0) {
      console.log("Extracted table data:", tableData);
      
      const extractedSummaries = convertTableToAccountSummaries(tableData);
      console.log("Converted to account summaries:", extractedSummaries);
      
      if (extractedSummaries.length > 0 && hasRealData(extractedSummaries)) {
        console.log('Successfully extracted account summaries:', extractedSummaries);
        if (forceManualExtraction) {
          toast.success("Successfully extracted account data");
        }
        
        createOrderedAccountSummaries(extractedSummaries, onDataExtracted, requiredAccountTypes);
      } else {
        console.log("Extracted data had no meaningful values - using empty data");
        
        // Create empty data structure instead of sample data
        const emptyData = requiredAccountTypes.map(type => ({
          accountType: type,
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
        
        onDataExtracted(emptyData, false, true);
        
        if (forceManualExtraction) {
          toast.warning("Extraction yielded no useful data. Please try uploading a better PDF.");
        }
      }
    } else {
      console.log("Could not process table structure - using empty data");
      
      // Create empty data structure instead of sample data
      const emptyData = requiredAccountTypes.map(type => ({
        accountType: type,
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
      
      onDataExtracted(emptyData, false, true);
      
      if (forceManualExtraction) {
        toast.warning("Table extraction failed. Please try uploading a better PDF.");
      }
    }
  } catch (error) {
    console.error("Error during extraction:", error);
    
    // Create empty data structure instead of sample data
    const emptyData = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'].map(type => ({
      accountType: type,
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
    
    onDataExtracted(emptyData, false, true);
    
    if (forceManualExtraction) {
      toast.error("Error during data extraction");
    }
  } finally {
    setIsProcessing(false);
  }
};

// Helper functions
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

const createOrderedAccountSummaries = (
  sourceSummaries: AccountSummary[],
  onDataExtracted: (summaries: AccountSummary[], usingSampleData: boolean, failed: boolean) => void,
  requiredAccountTypes: string[],
  forceSample: boolean = false
) => {
  const orderedSummaries: AccountSummary[] = [];
  
  // Original logic for non-sample data
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
  
  const hasActualData = hasRealData(orderedSummaries);
  
  onDataExtracted(
    orderedSummaries, 
    false,
    !hasActualData
  );
};

const AccountDataExtractor: React.FC<AccountDataExtractorProps> = (props) => {
  const { isProcessing } = props;
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleEnhancedExtraction(props, true)}
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
  );
};

export default AccountDataExtractor;
