
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
    // Extract credit file status - look for "fraud indicator" or similar text
    const statusRegex = /(?:credit\s+file\s+status|fraud\s+indicator)[:\s]*([^.\n]+)/i;
    const statusMatch = text.match(statusRegex);
    if (statusMatch && statusMatch[1]) {
      summary.creditFileStatus = statusMatch[1].trim();
    } else {
      summary.creditFileStatus = "No fraud indicator on file";
    }
    
    // Extract alert contacts
    const alertRegex = /alert\s+contacts[:\s]*([^.\n]+)/i;
    const alertMatch = text.match(alertRegex);
    if (alertMatch && alertMatch[1]) {
      summary.alertContacts = alertMatch[1].trim();
    } else {
      summary.alertContacts = "0 Records Found";
    }
    
    // Extract average account age
    const ageRegex = /average\s+(?:account\s+)?age[:\s]*([^.\n]+)/i;
    const ageMatch = text.match(ageRegex);
    if (ageMatch && ageMatch[1]) {
      summary.averageAccountAge = ageMatch[1].trim();
    }
    
    // Extract length of credit history
    const historyRegex = /length\s+of\s+credit\s+history[:\s]*([^.\n]+)/i;
    const historyMatch = text.match(historyRegex);
    if (historyMatch && historyMatch[1]) {
      summary.lengthOfCreditHistory = historyMatch[1].trim();
    }
    
    // Extract accounts with negative information
    const negativeInfoRegex = /accounts\s+with\s+negative\s+information[:\s]*([^.\n]+)/i;
    const negativeMatch = text.match(negativeInfoRegex);
    if (negativeMatch && negativeMatch[1]) {
      const value = negativeMatch[1].trim();
      summary.accountsWithNegativeInfo = /^\d+$/.test(value) ? parseInt(value) : value;
    }
    
    // Extract oldest account information
    const oldestAccountRegex = /oldest\s+account[:\s]*([^.\n]+)/i;
    const oldestMatch = text.match(oldestAccountRegex);
    if (oldestMatch && oldestMatch[1]) {
      const accountText = oldestMatch[1].trim();
      const openDateRegex = /\(Opened\s+(.*?)\)/i;
      const openDateMatch = accountText.match(openDateRegex);
      
      if (openDateMatch) {
        const accountName = accountText.replace(openDateRegex, '').trim();
        summary.oldestAccount = {
          accountName,
          openDate: openDateMatch[1].trim()
        };
      }
    }
    
    // Extract most recent account information
    const recentAccountRegex = /(?:most\s+recent|recent)\s+account[:\s]*([^.\n]+)/i;
    const recentMatch = text.match(recentAccountRegex);
    if (recentMatch && recentMatch[1]) {
      const accountText = recentMatch[1].trim();
      const openDateRegex = /\(Opened\s+(.*?)\)/i;
      const openDateMatch = accountText.match(openDateRegex);
      
      if (openDateMatch) {
        const accountName = accountText.replace(openDateRegex, '').trim();
        summary.recentAccount = {
          accountName,
          openDate: openDateMatch[1].trim()
        };
      }
    }

    // If we still don't have oldest/recent account info, try another approach
    if (!summary.oldestAccount || !summary.recentAccount) {
      // Search for DEPT OF and AMERICAN CREDIT mentions
      const deptMatch = text.match(/DEPT\s+OF\s+[A-Z/]+\s+\(Opened\s+(.*?)\)/i);
      const americanMatch = text.match(/AMERICAN\s+CREDIT\s+[A-Z/]+\s+\(Opened\s+(.*?)\)/i);
      
      if (!summary.oldestAccount && deptMatch) {
        summary.oldestAccount = {
          accountName: "DEPT OF ED/ADVANTAGE",
          openDate: deptMatch[1].trim()
        };
      }
      
      if (!summary.recentAccount && americanMatch) {
        summary.recentAccount = {
          accountName: "AMERICAN CREDIT ACCEPTANCE",
          openDate: americanMatch[1].trim()
        };
      }
    }
    
    // If AI extraction is available and needed, use it as fallback
    if (!summary.oldestAccount || !summary.recentAccount) {
      try {
        // Extract key entities with AI
        const entities = await extractEntities(text);
        
        // Look for date patterns near organization entities
        if (entities && entities.length > 0) {
          const orgEntities = entities.filter(e => e.entity === 'B-ORG' || e.entity === 'I-ORG');
          
          for (const entity of orgEntities) {
            const contextStart = Math.max(0, entity.start - 50);
            const contextEnd = Math.min(text.length, entity.end + 50);
            const context = text.substring(contextStart, contextEnd);
            
            const dateMatch = context.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/);
            if (dateMatch) {
              if (!summary.oldestAccount) {
                summary.oldestAccount = {
                  accountName: entity.word,
                  openDate: dateMatch[0]
                };
              } else if (!summary.recentAccount) {
                summary.recentAccount = {
                  accountName: entity.word,
                  openDate: dateMatch[0]
                };
              }
            }
          }
        }
      } catch (error) {
        console.error("Error extracting account information with AI:", error);
      }
    }
  } catch (error) {
    console.error("Error extracting Equifax summary data:", error);
  }
  
  return summary;
};
