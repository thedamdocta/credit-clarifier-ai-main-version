
import { useState, useEffect } from "react";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import { toast } from "sonner";
import { extractCreditAccountsTableImage, resetCurrentReportImage, getExtractedReportData } from "@/utils/pdf/extractText";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { parsingLogger } from "@/utils/parsingLogger";

interface UseAccountSummaryExtractionProps {
  report: CreditReport;
  requiredAccountTypes: string[];
}

export const useAccountSummaryExtraction = ({ report, requiredAccountTypes }: UseAccountSummaryExtractionProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([]);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [attemptedExtraction, setAttemptedExtraction] = useState(false);
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [initialAccountDataFound, setInitialAccountDataFound] = useState(false);
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);
  
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
        const hasRealData = hasRealAccountData(report.accountSummaries);
        
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
    
    const hasActualData = hasRealAccountData(orderedSummaries);
    const isSampleDataDetected = isSampleData(orderedSummaries);
    
    setUsingSampleData(isSampleDataDetected || !hasActualData);
    setExtractionFailed(!hasActualData);
  };
  
  const hasRealAccountData = (summaries: AccountSummary[]) => {
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
        const existingDataHasValues = hasRealAccountData(report.accountSummaries);
        
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
              if (hasRealAccountData(report.accountSummaries)) {
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
        if (cachedData && cachedData.accountSummaries && hasRealAccountData(cachedData.accountSummaries)) {
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
        
        if (extractedSummaries.length > 0 && hasRealAccountData(extractedSummaries) && !isSampleData(extractedSummaries)) {
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
  
  return {
    isProcessing,
    accountSummaries,
    extractionFailed,
    attemptedExtraction,
    extractionAttempts,
    usingSampleData,
    initialAccountDataFound,
    tableImageUrl,
    handleEnhancedExtraction,
  };
};
