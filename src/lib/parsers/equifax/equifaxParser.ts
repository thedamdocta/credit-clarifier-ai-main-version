
import { CreditReport } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./equifaxAccountSummary";
import { extractEquifaxOtherItems } from "./equifaxOtherItems";
import { extractEquifaxSummary } from "./equifaxSummary";
import { extractDate } from "../dateParser";

export const parseEquifaxReport = async (text: string): Promise<Partial<CreditReport>> => {
  console.log("Parsing Equifax-specific report format");
  
  // Extract account summaries
  const accountSummaries = extractEquifaxAccountSummaries(text);
  console.log("Extracted account summaries:", accountSummaries);
  
  // Extract other items
  const otherItems = extractEquifaxOtherItems(text);
  console.log("Extracted other items:", otherItems);
  
  // Extract summary section data
  const summaryData = await extractEquifaxSummary(text);
  console.log("Extracted summary data:", summaryData);
  
  // Extract report date
  const reportDate = extractDate(text);
  
  // Try to extract accounts with negative information
  let accountsWithNegativeInfo = "0";
  const negativeInfoMatch = text.match(/accounts\s+with\s+negative\s+information[:\s]*(\d+)/i);
  if (negativeInfoMatch && negativeInfoMatch[1]) {
    accountsWithNegativeInfo = negativeInfoMatch[1].trim();
  }
  
  // Extract confirmation number if available
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
