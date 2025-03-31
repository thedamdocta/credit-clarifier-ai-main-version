
import { CreditReport } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./equifaxAccountSummary";
import { extractEquifaxOtherItems } from "./equifaxOtherItems";
import { extractEquifaxSummary } from "./equifaxSummary";

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
  
  return {
    bureau: 'Equifax',
    accountSummaries,
    ...otherItems,
    ...summaryData
  };
};
