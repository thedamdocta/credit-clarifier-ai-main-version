
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
const SAMPLE_ACCOUNT_DATA: AccountSummary[] = [
  {
    accountType: "Revolving",
    totalAccounts: 4,
    open: "4",
    closed: 0,
    balance: null,
    withBalance: "3",
    totalBalance: "$16,355",
    available: "$18,645",
    creditLimit: "$35,000",
    debtToCredit: "46.7%",
    payment: "$627"
  },
  {
    accountType: "Mortgage",
    totalAccounts: 1,
    open: "1",
    closed: 0,
    balance: null,
    withBalance: "1",
    totalBalance: "$245,678",
    available: "$0",
    creditLimit: "$245,678",
    debtToCredit: "100.0%",
    payment: "$1,856"
  },
  {
    accountType: "Installment",
    totalAccounts: 2,
    open: "2",
    closed: 0,
    balance: null,
    withBalance: "2",
    totalBalance: "$204,150",
    available: "$15,455",
    creditLimit: "$219,605",
    debtToCredit: "93.0%",
    payment: "$1,289"
  },
  {
    accountType: "Other",
    totalAccounts: 0,
    open: "0",
    closed: 0,
    balance: null,
    withBalance: "0",
    totalBalance: "$0",
    available: "$0",
    creditLimit: "$0",
    debtToCredit: "0.0%",
    payment: "$0"
  },
  {
    accountType: "Total",
    totalAccounts: 7,
    open: "7",
    closed: 0,
    balance: null,
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
      
      console.log("No account data available - using sample data instead of empty state");
      
      // Use sample data instead of empty data for better UX
      createOrderedAccountSummaries(SAMPLE_ACCOUNT_DATA, onDataExtracted, requiredAccountTypes, true);
      
      if (forceManualExtraction) {
        toast.warning("No real account data found. Showing sample data instead.");
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
      
      if (extractedSummaries.length > 0 && hasRealData(extractedSummaries) && !isSampleData(extractedSummaries)) {
        console.log('Successfully extracted account summaries:', extractedSummaries);
        if (forceManualExtraction) {
          toast.success("Successfully extracted account data");
        }
        
        createOrderedAccountSummaries(extractedSummaries, onDataExtracted, requiredAccountTypes);
      } else {
        console.log("Extracted data had no meaningful values - using sample data instead");
        if (forceManualExtraction) {
          toast.warning("Extraction yielded no useful data. Using sample data instead.");
        }
        
        createOrderedAccountSummaries(SAMPLE_ACCOUNT_DATA, onDataExtracted, requiredAccountTypes, true);
      }
    } else {
      console.log("Could not process table structure - using sample data");
      if (forceManualExtraction) {
        toast.warning("Table extraction failed. Using sample data.");
      }
      
      createOrderedAccountSummaries(SAMPLE_ACCOUNT_DATA, onDataExtracted, requiredAccountTypes, true);
    }
  } catch (error) {
    console.error("Error during extraction:", error);
    if (forceManualExtraction) {
      toast.error("Error during data extraction, showing sample data");
    }
    
    createOrderedAccountSummaries(SAMPLE_ACCOUNT_DATA, onDataExtracted, requiredAccountTypes, true);
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
  requiredAccountTypes: string[],
  forceSample: boolean = false
) => {
  const orderedSummaries: AccountSummary[] = [];
  
  // If we're using sample data or forcing sample data, use the SAMPLE_ACCOUNT_DATA directly
  if (forceSample || isSampleData(sourceSummaries)) {
    console.log("Using sample data for account summaries");
    
    // Map the sample data to ensure all fields are properly formatted
    requiredAccountTypes.forEach(accountType => {
      // Find the matching sample data for this account type
      const sampleData = SAMPLE_ACCOUNT_DATA.find(
        sample => sample.accountType.toLowerCase() === accountType.toLowerCase()
      );
      
      if (sampleData) {
        orderedSummaries.push({
          accountType: accountType,
          totalAccounts: sampleData.totalAccounts,
          open: sampleData.open,
          closed: sampleData.closed,
          balance: sampleData.balance,
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
          open: "0",
          closed: null,
          balance: null,
          withBalance: "0",
          totalBalance: "$0",
          available: "$0",
          creditLimit: "$0",
          debtToCredit: "0.0%",
          payment: "$0"
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
    isSampleDataDetected || !hasActualData,
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
