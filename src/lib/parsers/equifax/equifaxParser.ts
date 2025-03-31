
import { CreditReport } from "../../types/creditReport";
import { extractEquifaxAccountSummaries } from "./equifaxAccountSummary";
import { extractEquifaxOtherItems } from "./equifaxOtherItems";

export const parseEquifaxReport = async (text: string): Promise<Partial<CreditReport>> => {
  console.log("Parsing Equifax-specific report format");
  
  // Extract account summaries
  const accountSummaries = extractEquifaxAccountSummaries(text);
  console.log("Extracted account summaries:", accountSummaries);
  
  // Extract other items
  const otherItems = extractEquifaxOtherItems(text);
  console.log("Extracted other items:", otherItems);
  
  return {
    bureau: 'Equifax',
    accountSummaries,
    ...otherItems
  };
};
