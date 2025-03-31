
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
    // Find the summary section based on common headers
    const summaryHeaderPatterns = [
      /summary\s+section/i,
      /credit\s+summary/i,
      /report\s+summary/i,
      /credit\s+file\s+summary/i
    ];
    
    let summarySection = '';
    let summaryFound = false;
    
    // First try to isolate the summary section
    for (const pattern of summaryHeaderPatterns) {
      const match = text.match(pattern);
      if (match) {
        // Found a summary header - extract the next ~1500 characters which should contain most summary info
        const startIndex = match.index;
        if (startIndex !== undefined) {
          const endIndex = Math.min(startIndex + 1500, text.length);
          summarySection = text.substring(startIndex, endIndex);
          summaryFound = true;
          console.log("Found summary section starting with:", match[0]);
          break;
        }
      }
    }
    
    // If no explicit summary section found, just use the first part of the document
    if (!summaryFound) {
      console.log("No explicit summary section found, using first part of document");
      summarySection = text.substring(0, Math.min(2000, text.length));
    }
    
    // Extract credit file status using regex first
    const statusRegex = /(?:credit\s+file\s+status|fraud\s+indicator)[:\s]*([^.\n]+)/i;
    const statusMatch = summarySection.match(statusRegex);
    if (statusMatch && statusMatch[1]) {
      summary.creditFileStatus = statusMatch[1].trim();
    } else {
      summary.creditFileStatus = "No fraud indicator on file";
    }
    
    // Extract alert contacts
    const alertRegex = /alert\s+contacts[:\s]*([^.\n]+)/i;
    const alertMatch = summarySection.match(alertRegex);
    if (alertMatch && alertMatch[1]) {
      summary.alertContacts = alertMatch[1].trim();
    } else {
      summary.alertContacts = "0 Records Found";
    }
    
    // Extract average account age
    const ageRegex = /average\s+(?:account\s+)?age[:\s]*([^.\n]+)/i;
    const ageMatch = summarySection.match(ageRegex);
    if (ageMatch && ageMatch[1]) {
      summary.averageAccountAge = ageMatch[1].trim();
    }
    
    // Extract length of credit history
    const historyRegex = /length\s+of\s+credit\s+history[:\s]*([^.\n]+)/i;
    const historyMatch = summarySection.match(historyRegex);
    if (historyMatch && historyMatch[1]) {
      summary.lengthOfCreditHistory = historyMatch[1].trim();
    }
    
    // Extract accounts with negative information
    const negativeInfoRegex = /accounts\s+with\s+negative\s+information[:\s]*([^.\n]+)/i;
    const negativeMatch = summarySection.match(negativeInfoRegex);
    if (negativeMatch && negativeMatch[1]) {
      const value = negativeMatch[1].trim();
      summary.accountsWithNegativeInfo = /^\d+$/.test(value) ? parseInt(value) : value;
    }
    
    // First try to extract oldest/recent account information using regex
    const oldestAccountRegex = /oldest\s+account[:\s]*([^.\n]+)/i;
    const oldestMatch = summarySection.match(oldestAccountRegex);
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
    const recentMatch = summarySection.match(recentAccountRegex);
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
    
    // Now use AI to fill in missing pieces only if needed
    const missingFields = !summary.oldestAccount || 
                         !summary.recentAccount || 
                         !summary.averageAccountAge ||
                         !summary.lengthOfCreditHistory;
                         
    if (missingFields) {
      console.log("Using AI to extract missing summary information");
      try {
        // Extract entities with AI only on the summary section
        const entities = await extractEntities(summarySection);
        
        if (entities && entities.length > 0) {
          console.log(`Found ${entities.length} entities in summary section`);
          
          // Group entities by type for easier processing
          const orgEntities = entities.filter(e => e.entity === 'B-ORG' || e.entity === 'I-ORG');
          const dateEntities = entities.filter(e => e.entity === 'B-DATE' || e.entity === 'I-DATE');
          
          // If we don't have oldest account, try to extract it with AI
          if (!summary.oldestAccount && orgEntities.length > 0) {
            // Look for organization entities near "oldest" or "first"
            for (const entity of orgEntities) {
              const contextStart = Math.max(0, entity.start - 50);
              const contextEnd = Math.min(summarySection.length, entity.end + 50);
              const context = summarySection.substring(contextStart, contextEnd).toLowerCase();
              
              if (context.includes('oldest') || context.includes('first account')) {
                // Look for a date near this entity
                const nearbyDate = findNearbyDate(entity, dateEntities, summarySection);
                if (nearbyDate) {
                  summary.oldestAccount = {
                    accountName: entity.word,
                    openDate: nearbyDate
                  };
                  console.log("AI extracted oldest account:", summary.oldestAccount);
                  break;
                }
              }
            }
          }
          
          // If we don't have most recent account, try to extract it with AI
          if (!summary.recentAccount && orgEntities.length > 0) {
            // Look for organization entities near "recent" or "newest"
            for (const entity of orgEntities) {
              const contextStart = Math.max(0, entity.start - 50);
              const contextEnd = Math.min(summarySection.length, entity.end + 50);
              const context = summarySection.substring(contextStart, contextEnd).toLowerCase();
              
              if (context.includes('recent') || context.includes('newest')) {
                // Look for a date near this entity
                const nearbyDate = findNearbyDate(entity, dateEntities, summarySection);
                if (nearbyDate) {
                  summary.recentAccount = {
                    accountName: entity.word,
                    openDate: nearbyDate
                  };
                  console.log("AI extracted most recent account:", summary.recentAccount);
                  break;
                }
              }
            }
          }
          
          // Try to extract other missing metrics if not found by regex
          if (!summary.averageAccountAge) {
            const ageContext = findEntityContextWithKeyword(entities, summarySection, ['average', 'age']);
            if (ageContext) {
              // Look for patterns like "X years Y months" in the context
              const timePattern = /(\d+)\s*(?:years?|yrs?)(?:\s*(?:and)?\s*(\d+)\s*(?:months?|mos?))?/i;
              const timeMatch = ageContext.match(timePattern);
              if (timeMatch) {
                const years = timeMatch[1];
                const months = timeMatch[2] || '0';
                summary.averageAccountAge = `${years} years ${months.trim() !== '0' ? months + ' months' : ''}`.trim();
                console.log("AI extracted average account age:", summary.averageAccountAge);
              }
            }
          }
          
          // Extract length of credit history if missing
          if (!summary.lengthOfCreditHistory) {
            const historyContext = findEntityContextWithKeyword(entities, summarySection, ['history', 'length']);
            if (historyContext) {
              // Look for time patterns
              const timePattern = /(\d+)\s*(?:years?|yrs?)(?:\s*(?:and)?\s*(\d+)\s*(?:months?|mos?))?/i;
              const timeMatch = historyContext.match(timePattern);
              if (timeMatch) {
                const years = timeMatch[1];
                const months = timeMatch[2] || '0';
                summary.lengthOfCreditHistory = `${years} years ${months.trim() !== '0' ? months + ' months' : ''}`.trim();
                console.log("AI extracted length of credit history:", summary.lengthOfCreditHistory);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error using AI to extract summary information:", error);
      }
    }

    // If we still don't have certain values, try some fallbacks
    if (!summary.oldestAccount || !summary.recentAccount) {
      // Try some common patterns for credit account mentions
      const accountPatterns = [
        /(\w+\s+(?:BANK|CREDIT|AUTO|MORTGAGE|LOAN|FINANCIAL|CAPITAL|LENDING))[^.]*?opened\s+(\w+\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/gi,
        /((?:DEPT|DEPARTMENT)\s+OF\s+(?:ED|EDUCATION))[^.]*?opened\s+(\w+\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/gi,
        /(AMERICAN\s+CREDIT)[^.]*?opened\s+(\w+\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/gi
      ];
      
      const accountMatches = [];
      for (const pattern of accountPatterns) {
        const matches = Array.from(text.matchAll(pattern));
        for (const match of matches) {
          if (match[1] && match[2]) {
            accountMatches.push({
              accountName: match[1].trim(),
              openDate: match[2].trim()
            });
          }
        }
      }
      
      // If we found any accounts this way, use them for oldest/most recent
      if (accountMatches.length > 0) {
        // Sort by date
        accountMatches.sort((a, b) => {
          const dateA = new Date(a.openDate).getTime();
          const dateB = new Date(b.openDate).getTime();
          return dateA - dateB;
        });
        
        if (!summary.oldestAccount && accountMatches.length > 0) {
          summary.oldestAccount = accountMatches[0];
        }
        
        if (!summary.recentAccount && accountMatches.length > 0) {
          summary.recentAccount = accountMatches[accountMatches.length - 1];
        }
      }
    }
  } catch (error) {
    console.error("Error extracting Equifax summary data:", error);
  }
  
  return summary;
};

// Helper function to find a date near an entity
const findNearbyDate = (entity: Entity, dateEntities: Entity[], text: string): string | undefined => {
  // First look for date entities near this entity
  for (const dateEntity of dateEntities) {
    // Check if date is within reasonable distance (100 chars)
    if (Math.abs(dateEntity.start - entity.start) < 100) {
      return dateEntity.word;
    }
  }
  
  // If no date entity found, look for date patterns in nearby text
  const contextStart = Math.max(0, entity.start - 100);
  const contextEnd = Math.min(text.length, entity.end + 100);
  const context = text.substring(contextStart, contextEnd);
  
  // Look for formatted dates
  const datePatterns = [
    /(?:Opened|opened|Open|open)\s+(\w+\s+\d{1,2},\s+\d{4})/i,
    /(?:Opened|opened|Open|open)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(\w+\s+\d{1,2},\s+\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = context.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return undefined;
};

// Helper function to find context containing specific keywords near entities
const findEntityContextWithKeyword = (entities: Entity[], text: string, keywords: string[]): string | undefined => {
  for (const entity of entities) {
    const contextStart = Math.max(0, entity.start - 100);
    const contextEnd = Math.min(text.length, entity.end + 100);
    const context = text.substring(contextStart, contextEnd).toLowerCase();
    
    if (keywords.some(keyword => context.includes(keyword.toLowerCase()))) {
      return context;
    }
  }
  
  return undefined;
};
