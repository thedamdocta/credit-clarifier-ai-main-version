
import { CreditReport } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./equifaxAccountSummary";
import { extractEquifaxOtherItems } from "./equifaxOtherItems";
import { extractEquifaxSummary } from "./equifaxSummary";
import { extractDate } from "../dateParser";

export const parseEquifaxReport = async (text: string): Promise<Partial<CreditReport>> => {
  console.log("Parsing Equifax-specific report format");
  
  // First extract the summary data which will use targeted regex processing
  const summaryData = await extractEquifaxSummary(text);
  console.log("Extracted summary data:", summaryData);
  
  // Extract account summaries using AI-enhanced methods
  const accountSummaries = await extractEquifaxAccountSummaries(text);
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
  const confirmationPatterns = [
    /report\s+confirmation(?:\s*number)?[:\s]*(\d{9,10})(?:\s|$|\n)/i,
    /confirmation\s+number[:\s]*(\d{9,10})(?:\s|$|\n)/i
  ];
  
  for (const pattern of confirmationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      confirmationNumber = match[1].trim();
      console.log("Found report confirmation number:", confirmationNumber);
      break;
    }
  }
  
  // If still not found, look for standalone 9-10 digit number near beginning
  if (!confirmationNumber) {
    const headerSection = text.substring(0, 2000);
    const standaloneMatch = headerSection.match(/^\s*(\d{9,10})\s*$/m);
    if (standaloneMatch && standaloneMatch[1]) {
      confirmationNumber = standaloneMatch[1].trim();
      console.log("Found standalone confirmation number:", confirmationNumber);
    }
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
    creditFileStatus: summaryData.creditFileStatus || "No fraud indicator on file",
    alertContacts: summaryData.alertContacts || "0 Records Found",
    averageAccountAge: summaryData.averageAccountAge,
    lengthOfCreditHistory: summaryData.lengthOfCreditHistory,
    accountsWithNegativeInfo,
    oldestAccount: summaryData.oldestAccount,
    recentAccount: summaryData.recentAccount,
    confirmationNumber,
    statementCount,
    consumerName: otherItems.consumerName || summaryData.consumerName
  };
};
