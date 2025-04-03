import React, { useState } from "react";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { toast } from "sonner";
import { extractCreditAccountsTableImage, resetCurrentReportImage, getExtractedReportData } from "@/utils/pdf/extractText";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { extractTableWithOpenAI, canUseOpenAI } from "@/lib/ai/openai/openaiService";

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
    
    // Check if we already have valid data in the report
    if (report.accountSummaries && report.accountSummaries.length > 0) {
      const existingDataHasValues = hasRealData(report.accountSummaries);
      
      if (existingDataHasValues) {
        console.log("Using existing account data from report:", report.accountSummaries);
        createOrderedAccountSummaries(report.accountSummaries, onDataExtracted, requiredAccountTypes, false);
        setIsProcessing(false);
        if (forceManualExtraction) {
          toast.success("Using existing account data from report");
        }
        return;
      }
    }
    
    // Get the table image - this is where many errors happen
    try {
      const newTableImageUrl = await extractCreditAccountsTableImage(report);
      
      if (newTableImageUrl) {
        console.log("Using table image URL for extraction:", newTableImageUrl);

        // For regular image URLs (not data: URLs), proceed with OpenAI extraction
        if (!newTableImageUrl.startsWith('data:')) {
          // First try OpenAI extraction if available (highest quality results)
          if (canUseOpenAI()) {
            console.log("Attempting extraction with OpenAI");
            
            try {
              const openAIResults = await extractTableWithOpenAI(newTableImageUrl);
              
              if (openAIResults && openAIResults.length > 0 && hasRealData(openAIResults)) {
                console.log("Successfully extracted data with OpenAI:", openAIResults);
                if (forceManualExtraction) {
                  toast.success("Successfully extracted account data with AI");
                }
                
                createOrderedAccountSummaries(openAIResults, onDataExtracted, requiredAccountTypes, false);
                setIsProcessing(false);
                return;
              } else {
                console.log("OpenAI extraction failed or returned no real data, falling back to local extraction");
              }
            } catch (error) {
              console.error("Error during OpenAI extraction:", error);
              toast.error("OpenAI extraction failed. Trying alternative method...");
            }
          }
        } else {
          console.error("Cannot use data URL directly with OpenAI API. Need to convert it first.");
        }
        
        // Fall back to local table extraction
        try {
          const tableData = await extractTableFromImage(newTableImageUrl);
          
          if (tableData && tableData.rows && tableData.rows.length > 0) {
            console.log("Extracted table data:", tableData);
            
            const extractedSummaries = convertTableToAccountSummaries(tableData);
            
            if (extractedSummaries.length > 0 && hasRealData(extractedSummaries)) {
              console.log('Successfully extracted account summaries:', extractedSummaries);
              if (forceManualExtraction) {
                toast.success("Successfully extracted account data");
              }
              
              createOrderedAccountSummaries(extractedSummaries, onDataExtracted, requiredAccountTypes, false);
              setIsProcessing(false);
              return;
            }
          }
        } catch (error) {
          console.error("Error during local table extraction:", error);
        }
      } else {
        console.error("Could not extract table image from report");
        toast.error("Could not extract table image from report");
      }
    } catch (imageError) {
      console.error("Error extracting table image:", imageError);
      toast.error("Error extracting table image from report");
    }
    
    console.log("Image extraction failed, attempting text-based extraction");
    
    if (report.rawText && report.rawText.length > 0) {
      const tablePattern = /\b(account\s+type|revolving|mortgage|installment|total).+(\d+)\s+(\d+)\s+\$?([\d,]+)/i;
      if (tablePattern.test(report.rawText)) {
        if (forceManualExtraction) {
          toast.info("Attempting to extract data from report text");
        }
        
        if (report.accountSummaries && report.accountSummaries.length > 0) {
          if (hasRealData(report.accountSummaries)) {
            console.log("Using account summaries from report text:", report.accountSummaries);
            createOrderedAccountSummaries(report.accountSummaries, onDataExtracted, requiredAccountTypes, false);
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
      createOrderedAccountSummaries(cachedData.accountSummaries, onDataExtracted, requiredAccountTypes, false);
      setIsProcessing(false);
      if (forceManualExtraction) {
        toast.success("Using cached account data");
      }
      return;
    }
    
    console.log("No account data available - extraction failed");
    
    // Return empty data with extraction failed flag
    const emptyData = createEmptyAccountSummaries(requiredAccountTypes);
    onDataExtracted(emptyData, false, true);
    
    if (forceManualExtraction) {
      toast.error("Failed to extract account data. Please try uploading a clearer PDF.");
    }
    
    setIsProcessing(false);
  } catch (error) {
    console.error("Error during extraction:", error);
    if (forceManualExtraction) {
      toast.error("Error during data extraction");
    }
    
    // Don't use sample data, show empty data
    const emptyData = createEmptyAccountSummaries(requiredAccountTypes);
    onDataExtracted(emptyData, false, true);
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
    forceSample, 
    !hasActualData && !forceSample
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
