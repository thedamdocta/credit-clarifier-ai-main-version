
import { Account } from "../types/creditReport";

export const extractAccounts = (text: string): Account[] => {
  const accounts: Account[] = [];
  
  const accountSections = text.split(/(?:account|credit card|loan|mortgage)s?:?\s*#?\d+/i);
  
  accountSections.slice(1).forEach(section => {
    let accountName = '';
    // Improved account name extraction to handle names with special characters
    const nameMatch = section.match(/([A-Za-z\s\/.,]+(?:BANK|CREDIT|CARD|LOAN|MORTGAGE|FINANCE|SERVICES|LLC|INC|CORP|AMERICA|EXPRESS|DISCOVER|CAPITAL|ONE|N\.A\.))/i);
    if (nameMatch && nameMatch[1]) {
      accountName = nameMatch[1].trim();
    }
    
    if (!accountName) return;
    
    let accountNumber = '';
    const numberMatch = section.match(/account\s*#:?\s*([*x\dX-]+)/i) || 
                        section.match(/account\s*number:?\s*([*x\dX-]+)/i) ||
                        section.match(/([*x]{4,}[-\s]?\d{4})/);
    if (numberMatch && numberMatch[1]) {
      accountNumber = numberMatch[1].trim();
    }
    
    let accountType = '';
    const typeMatch = section.match(/type:?\s*([A-Za-z\s]+)/i) ||
                     section.match(/(credit card|mortgage|auto loan|student loan|personal loan)/i);
    if (typeMatch && typeMatch[1]) {
      accountType = typeMatch[1].trim();
    }
    
    let openDate = '';
    const openMatch = section.match(/(?:open|opened)(?:ed)?\s*(?:date|on):?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (openMatch && openMatch[1]) {
      openDate = openMatch[1].trim();
    }
    
    let status = '';
    const statusMatch = section.match(/status:?\s*([A-Za-z\s]+)/i) ||
                        section.match(/(open|closed|paid|charged off|collection)/i);
    if (statusMatch && statusMatch[1]) {
      status = statusMatch[1].trim();
    }
    
    let balance: string | null = null;
    const balanceMatch = section.match(/balance:?\s*\$?([\d,.]+)/i) ||
                         section.match(/(?:current|outstanding)\s*balance:?\s*\$?([\d,.]+)/i);
    if (balanceMatch && balanceMatch[1]) {
      balance = `$${balanceMatch[1].trim()}`;
    }
    
    accounts.push({
      accountName: accountName || 'Unknown',
      accountNumber: accountNumber || 'Not Found',
      accountType: accountType || 'Not Specified',
      openDate: openDate || 'Not Found',
      status: status || 'Not Specified',
      balance,
      paymentHistory: []
    });
  });
  
  return accounts;
};
