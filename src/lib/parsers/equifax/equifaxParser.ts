
import { CreditReport } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./equifaxAccountSummary";
import { extractEquifaxOtherItems } from "./equifaxOtherItems";
import { extractEquifaxSummary } from "./equifaxSummary";
import { parsingLogger } from "@/utils/parsingLogger";
import { extractTableFromImage, convertTableToAccountSummaries } from "../../ai/tableExtraction";

export const parseEquifaxReport = async (text: string, imageUrl?: string): Promise<Partial<CreditReport>> => {
  try {
    // Extract report summary (credit file status, confirmation number, etc)
    const reportSummary = await extractEquifaxSummary(text);
    
    // Account summaries - try image-based extraction if image URL is provided
    let accountSummaries;
    
    if (imageUrl) {
      try {
        console.log("Attempting to extract account summaries from image:", imageUrl);
        // Use image-based extraction
        const tableData = await extractTableFromImage(imageUrl);
        
        if (tableData) {
          accountSummaries = convertTableToAccountSummaries(tableData);
          console.log("Successfully extracted account summaries from image:", accountSummaries);
        } else {
          // Fall back to text-based extraction
          console.log("Image extraction failed, falling back to text extraction");
          accountSummaries = await extractEquifaxAccountSummaries(text);
        }
      } catch (error) {
        console.error("Error in image-based account summary extraction:", error);
        // Fall back to text-based extraction
        accountSummaries = await extractEquifaxAccountSummaries(text);
      }
    } else {
      // Use traditional text-based extraction if no image URL
      accountSummaries = await extractEquifaxAccountSummaries(text);
    }
    
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
