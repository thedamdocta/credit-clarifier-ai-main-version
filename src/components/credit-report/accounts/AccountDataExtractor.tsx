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

// Sample account data with actual values for demonstration purposes
const SAMPLE_ACCOUNT_DATA = [
  {
    accountType: "Revolving",
    open: "4",
    withBalance: "3",
    totalBalance: "$16,355",
    available: "$18,645",
    creditLimit: "$35,000",
    debtToCredit: "46.7%",
    payment: "$627"
  },
  {
    accountType: "Mortgage",
    open: "1",
    withBalance: "1",
    totalBalance: "$245,678",
    available: "$0",
    creditLimit: "$245,678",
    debtToCredit: "100.0%",
    payment: "$1,856"
  },
  {
    accountType: "Installment",
    open: "2",
    withBalance: "2",
    totalBalance: "$204,150",
    available: "$15,455",
    creditLimit: "$219,605",
    debtToCredit: "93.0%",
    payment: "$1,289"
  },
  {
    accountType: "Other",
    open: "0",
    withBalance: "0",
    totalBalance: "$0",
    available: "$0",
    creditLimit: "$0",
    debtToCredit: "0.0%",
    payment: "$0"
  },
  {
    accountType: "Total",
    open: "7",
    withBalance: "6",
    totalBalance: "$466,183",
    available: "$34,100",
    creditLimit: "$500,283",
    debtToCredit: "93.2%",
    payment: "$3,772"
  }
];

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
      
      console.log("No account data available - extraction failed");
      
      // Don't use sample data, show empty data instead
      const emptyData = createEmptyAccountSummaries(requiredAccountTypes);
      onDataExtracted(emptyData, false, true);
      
      if (forceManualExtraction) {
        toast.error("Failed to extract account data. Please try uploading a clearer PDF.");
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
        console.log("Extracted data had no meaningful values - extraction failed");
        if (forceManualExtraction) {
          toast.error("Extraction yielded no useful data. Try uploading a clearer PDF.");
        }
        
        // Don't use sample data, show empty data
        const emptyData = createEmptyAccountSummaries(requiredAccountTypes);
        onDataExtracted(emptyData, false, true);
      }
    } else {
      console.log("Could not process table structure - extraction failed");
      if (forceManualExtraction) {
        toast.error("Table extraction failed. Try uploading a clearer PDF.");
      }
      
      // Don't use sample data, show empty data
      const emptyData = createEmptyAccountSummaries(requiredAccountTypes);
      onDataExtracted(emptyData, false, true);
    }
  } catch (error) {
    console.error("Error during extraction:", error);
    if (forceManualExtraction) {
      toast.error("Error during data extraction");
    }
    
    // Don't use sample data, show empty data
    const emptyData = createEmptyAccountSummaries(requiredAccountTypes);
    onDataExtracted(emptyData, false, true);
  } finally {
    setIsProcessing(false);
  }
};

// Helper function to create empty account summaries
const createEmptyAccountSummaries = (accountTypes: string[]): AccountSummary[] => {
  return accountTypes.map(accountType => ({
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
  requiredAccountTypes: string[],
  forceSample: boolean = false
) => {
  const orderedSummaries: AccountSummary[] = [];
  
  // If we're using sample data or forcing sample data, use the SAMPLE_ACCOUNT_DATA directly
  if (forceSample || isSampleData(sourceSummaries)) {
    console.log("Using sample data for account summaries");
    // Don't use sample data as requested by the user
    // Instead create empty summaries
    if (!forceSample) {
      const emptyData = createEmptyAccountSummaries(requiredAccountTypes);
      onDataExtracted(emptyData, false, true);
      return;
    }
    
    // This code should not run as we're avoiding sample data
    requiredAccountTypes.forEach(accountType => {
      const sampleData = SAMPLE_ACCOUNT_DATA.find(
        sample => sample.accountType.toLowerCase() === accountType.toLowerCase()
      );
      
      if (sampleData) {
        orderedSummaries.push({
          accountType: accountType,
          totalAccounts: null,
          open: sampleData.open,
          closed: null,
          balance: null,
          withBalance: sampleData.withBalance,
          totalBalance: sampleData.totalBalance,
          available: sampleData.available,
          creditLimit: sampleData.creditLimit,
          debtToCredit: sampleData.debtToCredit,
          payment: sampleData.payment
        });
      } else {
        // Fallback for any missing account types
        orderedSummaries.push({
          accountType: accountType,
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
    
    onDataExtracted(orderedSummaries, true, false);
    return;
  }

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
  const isSampleDataDetected = isSampleData(orderedSummaries) || forceSample;
  
  onDataExtracted(
    orderedSummaries, 
    isSampleDataDetected, 
    !hasActualData && !isSampleDataDetected
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
