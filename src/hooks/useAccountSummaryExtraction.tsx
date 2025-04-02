import { useState, useEffect } from "react";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import { extractCreditAccountsTableImage } from "@/utils/pdf/core/tableExtractor";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai";
import { getExtractedReportData } from "@/utils/pdf/extractText";

interface AccountSummaryExtractionResult {
  isProcessing: boolean;
  accountSummaries: AccountSummary[];
  extractionFailed: boolean;
  attemptedExtraction: boolean;
  extractionAttempts: number;
  usingSampleData: boolean;
  initialAccountDataFound: boolean;
  tableImageUrl: string | null;
  handleEnhancedExtraction: (forceNew?: boolean) => Promise<void>;
}

interface UseAccountSummaryExtractionProps {
  report: CreditReport;
  requiredAccountTypes: string[];
}

export const useAccountSummaryExtraction = ({
  report,
  requiredAccountTypes
}: UseAccountSummaryExtractionProps): AccountSummaryExtractionResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([]);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [attemptedExtraction, setAttemptedExtraction] = useState(false);
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [initialAccountDataFound, setInitialAccountDataFound] = useState(false);
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    // Load initial account data from extracted report data
    const initialData = getExtractedReportData();
    if (initialData && initialData.accountSummaries && initialData.accountSummaries.length > 0) {
      setAccountSummaries(initialData.accountSummaries);
      setInitialAccountDataFound(true);
    }
  }, []);
  
  const handleExtractionFailure = () => {
    setExtractionFailed(true);
    setUsingSampleData(false);
    setAccountSummaries([]);
  };
  
  const handleEnhancedExtraction = async (forceNew = false) => {
    setIsProcessing(true);
    setExtractionAttempts(prev => prev + 1);
    
    try {
      // First get the table image
      const tableImageUrl = await extractCreditAccountsTableImage(report);
      setTableImageUrl(tableImageUrl || null);
      
      if (tableImageUrl) {
        // Extract table from image
        const extractedTable = await extractTableFromImage(tableImageUrl);
        
        if (extractedTable && extractedTable.rows && extractedTable.rows.length > 0) {
          // Use the AI-enhanced conversion if available
          let accountData;
          try {
            // Import the AI-enhanced conversion function
            const { convertTableToAccountSummariesWithAI } = await import('../lib/ai/tableExtraction');
            console.log('Using AI-enhanced table conversion...');
            accountData = await convertTableToAccountSummariesWithAI(extractedTable);
          } catch (error) {
            console.error('Error using AI-enhanced conversion, falling back to standard conversion:', error);
            accountData = convertTableToAccountSummaries(extractedTable);
          }
          
          // Only update if we got valid data
          if (accountData && accountData.length > 0) {
            setAccountSummaries(accountData);
            setExtractionFailed(false);
            setUsingSampleData(false);
            setInitialAccountDataFound(true);
          } else {
            handleExtractionFailure();
          }
        } else {
          handleExtractionFailure();
        }
      } else {
        handleExtractionFailure();
      }
    } catch (error) {
      console.error('Error extracting account data:', error);
      handleExtractionFailure();
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
    handleEnhancedExtraction
  };
};
