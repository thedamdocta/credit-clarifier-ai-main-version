
import { CreditReport } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./equifaxAccountSummary";
import { extractEquifaxOtherItems } from "./equifaxOtherItems";
import { extractEquifaxSummary } from "./equifaxSummary";
import { extractDate } from "../dateParser";

export const parseEquifaxReport = async (text: string): Promise<Partial<CreditReport>> => {
  console.log("Parsing Equifax-specific report format");
  
  // First extract the summary data which will use targeted AI processing
  const summaryData = await extractEquifaxSummary(text);
  console.log("Extracted summary data:", summaryData);
  
  // Extract account summaries using traditional methods
  const accountSummaries = extractEquifaxAccountSummaries(text);
  console.log("Extracted account summaries:", accountSummaries);
  
  // Extract other items using traditional methods
  const otherItems = extractEquifaxOtherItems(text);
  console.log("Extracted other items:", otherItems);
  
  // Extract report date - use our improved date parser
  const reportDate = extractDate(text);
  console.log("Extracted report date:", reportDate);
  
  // Try to extract accounts with negative information if not already in summary
  let accountsWithNegativeInfo = summaryData.accountsWithNegativeInfo || "0";
  if (!summaryData.accountsWithNegativeInfo) {
    const negativeInfoMatch = text.match(/accounts\s+with\s+negative\s+information[:\s]*(\d+)/i);
    if (negativeInfoMatch && negativeInfoMatch[1]) {
      accountsWithNegativeInfo = negativeInfoMatch[1].trim();
    }
  }
  
  // Extract confirmation number if available and not already found
  let confirmationNumber;
  const confirmationMatch = text.match(/confirmation\s+number[:\s]*(\d+)/i);
  if (confirmationMatch && confirmationMatch[1]) {
    confirmationNumber = confirmationMatch[1].trim();
  }
  
  // Extract statement count
  let statementCount = 0;
  const statementMatch = text.match(/statement[:\s]*(\d+)(?:\s*Records?)?\s*Found/i);
  if (statementMatch && statementMatch[1]) {
    statementCount = parseInt(statementMatch[1]);
  }
  
  return {
    bureau: 'Equifax',
    reportDate,
    accountSummaries,
    ...otherItems,
    ...summaryData,
    accountsWithNegativeInfo,
    confirmationNumber,
    statementCount
  };
};
