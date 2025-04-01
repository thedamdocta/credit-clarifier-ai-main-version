
import { CreditReport } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./equifaxAccountSummary";
import { extractEquifaxOtherItems } from "./equifaxOtherItems";
import { extractEquifaxSummary } from "./equifaxSummary";
import { parsingLogger } from "@/utils/parsingLogger";
import { extractTableFromImage, convertTableToAccountSummaries } from "../../ai/tableExtraction";
import { toast } from "sonner";

export const parseEquifaxReport = async (text: string, imageUrl?: string): Promise<Partial<CreditReport>> => {
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
    
    // Account summaries - try multi-method approach if image URL is provided
    let accountSummaries;
    
    if (imageUrl) {
      try {
        console.log("Attempting enhanced account summaries extraction from image:", imageUrl);
        
        // Use our multi-method extraction
        const tableData = await extractTableFromImage(imageUrl);
        
        if (tableData) {
          accountSummaries = convertTableToAccountSummaries(tableData);
          console.log("Successfully extracted account summaries:", accountSummaries);
          toast.success("Successfully extracted table data");
        } else {
          // Fall back to text-based extraction
          console.log("Enhanced image extraction failed, falling back to text extraction");
          accountSummaries = await extractEquifaxAccountSummaries(text);
        }
      } catch (error) {
        console.error("Error in account summary extraction:", error);
        toast.error("Data extraction error - using fallback method");
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
