
import { CreditReport } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./equifaxAccountSummary";
import { extractEquifaxOtherItems } from "./equifaxOtherItems";
import { extractEquifaxReportSummary } from "./equifaxSummary";
import { parsingLogger } from "@/utils/parsingLogger";

export const parseEquifaxReport = async (text: string): Promise<Partial<CreditReport>> => {
  try {
    // Extract report summary (credit file status, confirmation number, etc)
    const reportSummary = await extractEquifaxReportSummary(text);
    
    // Extract account summaries
    const accountSummaries = await extractEquifaxAccountSummaries(text);
    parsingLogger.logAccountSummariesExtraction(accountSummaries);
    
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
