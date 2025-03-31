
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

// Helper function to manually set account summaries from sample image data
export const setAccountSummariesFromSampleImage = (): CreditReport["accountSummaries"] => {
  return [
    {
      accountType: "Revolving",
      totalAccounts: null,
      open: "0",
      closed: null,
      balance: null,
      withBalance: "0",
      totalBalance: null,
      available: null,
      creditLimit: null,
      debtToCredit: null,
      payment: null
    },
    {
      accountType: "Mortgage",
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
    },
    {
      accountType: "Installment",
      totalAccounts: null,
      open: "2",
      closed: null,
      balance: null,
      withBalance: "2",
      totalBalance: "$31,533",
      available: "-$4,447",
      creditLimit: "$27,086",
      debtToCredit: "116.0%",
      payment: "$543"
    },
    {
      accountType: "Other",
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
    },
    {
      accountType: "Total",
      totalAccounts: null,
      open: "2",
      closed: null,
      balance: null,
      withBalance: "2",
      totalBalance: "$31,533",
      available: "-$4,447",
      creditLimit: "$27,086",
      debtToCredit: "0.0%",
      payment: "$543"
    }
  ];
};
