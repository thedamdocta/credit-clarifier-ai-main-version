
import { Entity, extractEntities } from "../../aiTextAnalysis";

export interface EquifaxSummary {
  creditFileStatus?: string;
  alertContacts?: string;
  averageAccountAge?: string;
  lengthOfCreditHistory?: string;
  accountsWithNegativeInfo?: string | number;
  oldestAccount?: {
    accountName: string;
    openDate: string;
  };
  recentAccount?: {
    accountName: string;
    openDate: string;
  };
}

export const extractEquifaxSummary = async (text: string): Promise<EquifaxSummary> => {
  const summary: EquifaxSummary = {};
  
  try {
    // Extract credit file status
    const statusPattern = /credit\s+file\s+status[:\s]*(.*?)(?:\n|$)/i;
    const statusMatch = text.match(statusPattern);
    if (statusMatch && statusMatch[1]) {
      summary.creditFileStatus = statusMatch[1].trim() || "No fraud indicator on file";
    } else {
      summary.creditFileStatus = "No fraud indicator on file";
    }
    
    // Extract alert contacts
    const alertPattern = /alert\s+contacts[:\s]*(.*?)(?:\n|$)/i;
    const alertMatch = text.match(alertPattern);
    if (alertMatch && alertMatch[1]) {
      summary.alertContacts = alertMatch[1].trim();
    } else {
      summary.alertContacts = "0 Records Found";
    }
    
    // Extract average account age
    const agePattern = /average\s+account\s+age[:\s]*(.*?)(?:\n|$)/i;
    const ageMatch = text.match(agePattern);
    if (ageMatch && ageMatch[1]) {
      summary.averageAccountAge = ageMatch[1].trim();
    }
    
    // Extract length of credit history
    const historyPattern = /length\s+of\s+credit\s+history[:\s]*(.*?)(?:\n|$)/i;
    const historyMatch = text.match(historyPattern);
    if (historyMatch && historyMatch[1]) {
      summary.lengthOfCreditHistory = historyMatch[1].trim();
    }
    
    // Extract accounts with negative information
    const negativeInfoPattern = /accounts\s+with\s+negative\s+information[:\s]*(\d+)/i;
    const negativeMatch = text.match(negativeInfoPattern);
    if (negativeMatch && negativeMatch[1]) {
      summary.accountsWithNegativeInfo = negativeMatch[1].trim();
    } else {
      summary.accountsWithNegativeInfo = "0";
    }
    
    // Use AI to extract account information if needed
    // Only use AI for complex entities like account names and dates
    try {
      const entities = await extractEntities(text);
      
      // Look for oldest account patterns
      const oldestAccountPattern = /oldest\s+account[:\s]*(.*?)(?:\n|$)/i;
      const oldestMatch = text.match(oldestAccountPattern);
      if (oldestMatch && oldestMatch[1]) {
        // Try to find account name and date in the matched text
        const accountText = oldestMatch[1].trim();
        const dateMatch = accountText.match(/\(Opened\s+(.*?)\)/i);
        
        if (dateMatch) {
          const name = accountText.replace(/\(Opened\s+.*?\)/i, '').trim();
          summary.oldestAccount = {
            accountName: name,
            openDate: dateMatch[1]
          };
        }
      }
      
      // Look for most recent account patterns
      const recentAccountPattern = /most\s+recent\s+account[:\s]*(.*?)(?:\n|$)/i;
      const recentMatch = text.match(recentAccountPattern);
      if (recentMatch && recentMatch[1]) {
        // Try to find account name and date in the matched text
        const accountText = recentMatch[1].trim();
        const dateMatch = accountText.match(/\(Opened\s+(.*?)\)/i);
        
        if (dateMatch) {
          const name = accountText.replace(/\(Opened\s+.*?\)/i, '').trim();
          summary.recentAccount = {
            accountName: name,
            openDate: dateMatch[1]
          };
        }
      }
    } catch (error) {
      console.error("Error using AI to extract account information:", error);
    }
  } catch (error) {
    console.error("Error extracting Equifax summary data:", error);
  }
  
  return summary;
};
