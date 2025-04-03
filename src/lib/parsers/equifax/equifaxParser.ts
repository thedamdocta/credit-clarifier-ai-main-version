
import { CreditReport } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./equifaxAccountSummary";
import { extractEquifaxOtherItems } from "./equifaxOtherItems";
import { extractEquifaxSummary } from "./equifaxSummary";
import { parsingLogger } from "@/utils/parsingLogger";
import { toast } from "sonner";
import { getExtractedReportData } from "@/utils/pdf/extractText";
import { extractTableWithOpenAI } from "@/lib/ai/openai/openaiService";

export const parseEquifaxReport = async (text: string): Promise<Partial<CreditReport>> => {
  try {
    // Extract report summary (credit file status, confirmation number, etc)
    const reportSummary = await extractEquifaxSummary(text);
    
    // Extract confirmation number specifically
    const confirmationPattern = /Confirmation\s+Number\s*:?\s*#?(\d{2}-\d{7}|\w{5}-\w{5}|[A-Z0-9]{10,})/i;
    const confirmationMatch = text.match(confirmationPattern);
    
    if (confirmationMatch && confirmationMatch[1]) {
      reportSummary.confirmationNumber = confirmationMatch[1].trim();
      console.log("Found confirmation number:", reportSummary.confirmationNumber);
    }
    
    // Account summaries - use text-based extraction directly
    console.log("Using text-based account summaries extraction");
    let accountSummaries = await extractEquifaxAccountSummaries(text);
    parsingLogger.logAccountSummariesExtraction(accountSummaries);
    
    // Check if we have real data or if it's empty
    const hasRealData = accountSummaries.some(summary => 
      (summary.open && summary.open !== "0") || 
      (summary.withBalance && summary.withBalance !== "0") || 
      (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0")
    );
    
    // If text extraction failed, try to get cached data
    if (!hasRealData) {
      console.log("Text extraction did not yield real data, checking for cached data");
      const cachedReport = getExtractedReportData();
      if (cachedReport && cachedReport.accountSummaries && cachedReport.accountSummaries.length > 0) {
        const cachedHasRealData = cachedReport.accountSummaries.some(summary => 
          (summary.open && summary.open !== "0") || 
          (summary.withBalance && summary.withBalance !== "0") || 
          (summary.totalBalance && summary.totalBalance !== "$0" && summary.totalBalance !== "0")
        );
        
        if (cachedHasRealData) {
          console.log("Using cached account summaries with real data");
          accountSummaries = cachedReport.accountSummaries;
        }
      }
    }
    
    // Extract other information
    const otherItems = await extractEquifaxOtherItems(text);
    
    // Combine all extracted data
    const equifaxSpecific = {
      ...reportSummary,
      accountSummaries,
      ...otherItems,
    };
    
    return equifaxSpecific;
  } catch (error) {
    console.error("Error in Equifax-specific parsing:", error);
    return {}; // Return empty object on error
  }
};
