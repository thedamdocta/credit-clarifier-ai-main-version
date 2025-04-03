
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
      const existingDataHasValues = hasRealData(report.accountSummaries);
      
      if (existingDataHasValues) {
        console.log("Using existing account data from report:", report.accountSummaries);
        createOrderedAccountSummaries(report.accountSummaries, onDataExtracted, requiredAccountTypes);
        setIsProcessing(false);
        if (forceManualExtraction) {
          toast.success("Using existing account data from report");
        }
        return;
      }
    }
    
    const newTableImageUrl = await extractCreditAccountsTableImage(report);
    
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
              createOrderedAccountSummaries(report.accountSummaries, onDataExtracted, requiredAccountTypes);
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
        createOrderedAccountSummaries(cachedData.accountSummaries, onDataExtracted, requiredAccountTypes);
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
      
      createOrderedAccountSummaries(emptySummaries, onDataExtracted, requiredAccountTypes);
      
      if (forceManualExtraction) {
        toast.error("No account data found. Please upload a clearer image of your credit report.");
      }
      
      setIsProcessing(false);
      return;
    }
    
    console.log("Using table image URL for extraction:", newTableImageUrl);
    
    const tableData = await extractTableFromImage(newTableImageUrl);
    
    if (tableData && tableData.rows && tableData.rows.length > 0) {
      console.log("Extracted table data:", tableData);
      
      const extractedSummaries = convertTableToAccountSummaries(tableData);
      
      if (extractedSummaries.length > 0 && hasRealData(extractedSummaries) && !isSampleData(extractedSummaries)) {
        console.log('Successfully extracted account summaries:', extractedSummaries);
        if (forceManualExtraction) {
          toast.success("Successfully extracted account data");
        }
        
        createOrderedAccountSummaries(extractedSummaries, onDataExtracted, requiredAccountTypes);
      } else {
        console.log("Extracted data had no meaningful values or was sample data");
        if (forceManualExtraction) {
          toast.error("Extraction failed. Please upload a clearer image or try a different credit report.");
        }
        
        createOrderedAccountSummaries(extractedSummaries, onDataExtracted, requiredAccountTypes);
      }
    } else {
      console.log("Could not process table structure");
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
      
      createOrderedAccountSummaries(emptySummaries, onDataExtracted, requiredAccountTypes);
    }
  } catch (error) {
    console.error("Error during extraction:", error);
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
    
    createOrderedAccountSummaries(emptySummaries, onDataExtracted, requiredAccountTypes);
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

const createOrderedAccountSummaries = (
  sourceSummaries: AccountSummary[],
  onDataExtracted: (summaries: AccountSummary[], usingSampleData: boolean, failed: boolean) => void,
  requiredAccountTypes: string[]
) => {
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
  
  const hasActualData = hasRealData(orderedSummaries);
  const isSampleDataDetected = isSampleData(orderedSummaries);
  
  onDataExtracted(
    orderedSummaries, 
    isSampleDataDetected || !hasActualData,
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
