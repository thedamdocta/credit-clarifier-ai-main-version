
import { CreditReport } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./equifaxAccountSummary";
import { extractEquifaxOtherItems } from "./equifaxOtherItems";
import { extractEquifaxSummary } from "./equifaxSummary";
import { parsingLogger } from "@/utils/parsingLogger";
import { toast } from "sonner";

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
    const accountSummaries = await extractEquifaxAccountSummaries(text);
    
    // Look for Total row, Installment row and Other row values using specific patterns
    // This improves accuracy for these special rows
    const enhancedAccountSummaries = accountSummaries.map(summary => {
      if (summary.accountType === "Total") {
        // Look for explicit Total row pattern in text
        const totalRowPattern = /total\s+(\d+)\s+(\d+)\s+\$?([\d,]+)/i;
        const match = text.match(totalRowPattern);
        if (match) {
          return {
            ...summary,
            open: match[1],
            withBalance: match[2],
            totalBalance: `$${match[3]}`
          };
        }
      } 
      else if (summary.accountType === "Other") {
        // Look for explicit Other row pattern in text
        const otherRowPattern = /other\s+(\d+)\s+(\d+)/i;
        const match = text.match(otherRowPattern);
        if (match) {
          return {
            ...summary,
            open: match[1],
            withBalance: match[2]
          };
        }
      }
      return summary;
    });
    
    parsingLogger.logAccountSummariesExtraction(enhancedAccountSummaries);
    
    // Extract other information
    const otherItems = await extractEquifaxOtherItems(text);
    
    // Combine all extracted data
    const equifaxSpecific = {
      ...reportSummary,
      accountSummaries: enhancedAccountSummaries,
      ...otherItems,
    };
    
    return equifaxSpecific;
  } catch (error) {
    console.error("Error in Equifax-specific parsing:", error);
    return {}; // Return empty object on error
  }
};
