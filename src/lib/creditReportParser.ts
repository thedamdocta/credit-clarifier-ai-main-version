
export interface Account {
  accountName: string;
  accountNumber: string;
  accountType: string;
  openDate: string;
  status: string;
  balance: string;
  paymentHistory: string[];
  creditLimit?: string;
  highestBalance?: string;
  paymentStatus?: string;
}

export interface PersonalInfo {
  name: string;
  addresses: string[];
  ssn?: string;
  dob?: string;
}

export interface CreditScore {
  score: number;
  range: string;
  provider: string;
  date: string;
}

export interface CreditReport {
  bureau: 'Equifax' | 'Experian' | 'TransUnion' | 'Unknown';
  reportDate: string;
  personalInfo: PersonalInfo;
  accounts: Account[];
  inquiries: any[];
  publicRecords: any[];
  collections: any[];
  creditScores: CreditScore[];
  rawText: string;
}

export const identifyBureau = (text: string): CreditReport['bureau'] => {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('equifax')) {
    return 'Equifax';
  } else if (lowerText.includes('experian')) {
    return 'Experian';
  } else if (lowerText.includes('transunion')) {
    return 'TransUnion';
  }
  
  return 'Unknown';
};

export const extractDate = (text: string): string => {
  // Common date formats in credit reports
  const datePatterns = [
    /report date:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /date issued:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /as of:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return new Date().toLocaleDateString(); // Default to current date if not found
};

export const extractPersonalInfo = (text: string): PersonalInfo => {
  // Basic extraction of name
  let name = '';
  const nameMatch = text.match(/name:?\s*([A-Za-z\s\.,]+)/i);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
  }
  
  // Extract addresses
  const addresses: string[] = [];
  const addressSections = text.match(/address(?:es)?:?(?:\s*\w+)?:?\s*([A-Za-z0-9\s\.,#\-]+)/ig);
  
  if (addressSections) {
    addressSections.forEach(section => {
      const addressLine = section.replace(/address(?:es)?:?(?:\s*\w+)?:?\s*/i, '').trim();
      if (addressLine) {
        addresses.push(addressLine);
      }
    });
  }
  
  // Extract SSN (with masking for privacy)
  let ssn: string | undefined;
  const ssnMatch = text.match(/ssn:?\s*(?:xxx-xx-|[*]{5})(\d{4})/i);
  if (ssnMatch && ssnMatch[1]) {
    ssn = `XXX-XX-${ssnMatch[1]}`;
  }
  
  // Extract DOB
  let dob: string | undefined;
  const dobMatch = text.match(/(?:date of birth|dob|birth date):?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (dobMatch && dobMatch[1]) {
    dob = dobMatch[1];
  }
  
  return {
    name: name || 'Not Found',
    addresses: addresses.length ? addresses : ['Not Found'],
    ssn,
    dob
  };
};

export const extractCreditScores = (text: string): CreditScore[] => {
  const scores: CreditScore[] = [];
  
  // Common patterns for credit scores
  const scorePatterns = [
    /(?:fico|credit|vantage)\s*score:?\s*(\d{3})/i,
    /score:?\s*(\d{3})/i,
    /(\d{3})\s*(?:fico|credit|vantage)\s*score/i
  ];
  
  for (const pattern of scorePatterns) {
    const matches = text.matchAll(new RegExp(pattern, 'gi'));
    for (const match of matches) {
      if (match && match[1]) {
        const score = parseInt(match[1], 10);
        // Only add valid credit scores (typically between 300-850)
        if (score >= 300 && score <= 850) {
          const provider = text.includes('FICO') ? 'FICO' : 
                         text.includes('VantageScore') ? 'VantageScore' : 'Unknown';
          
          scores.push({
            score,
            range: '300-850',
            provider,
            date: extractDate(text)
          });
        }
      }
    }
  }
  
  return scores;
};

export const extractAccounts = (text: string): Account[] => {
  const accounts: Account[] = [];
  
  // Simplified account extraction - this would need to be much more sophisticated in a real app
  // Looking for common account indicators
  const accountSections = text.split(/(?:account|credit card|loan|mortgage)s?:?\s*#?\d+/i);
  
  accountSections.slice(1).forEach(section => {
    // Extract account name
    let accountName = '';
    const nameMatch = section.match(/([A-Za-z\s]+(?:BANK|CREDIT|CARD|LOAN|MORTGAGE|FINANCE|SERVICES|LLC|INC|CORP|AMERICA|EXPRESS|DISCOVER|CAPITAL|ONE))/i);
    if (nameMatch && nameMatch[1]) {
      accountName = nameMatch[1].trim();
    }
    
    // Skip if we couldn't find a creditor name
    if (!accountName) return;
    
    // Extract account number (usually masked)
    let accountNumber = '';
    const numberMatch = section.match(/account\s*#:?\s*([*x\dX-]+)/i) || 
                        section.match(/account\s*number:?\s*([*x\dX-]+)/i) ||
                        section.match(/([*x]{4,}[-\s]?\d{4})/); // Masked format like ****1234
    if (numberMatch && numberMatch[1]) {
      accountNumber = numberMatch[1].trim();
    }
    
    // Extract account type
    let accountType = '';
    const typeMatch = section.match(/type:?\s*([A-Za-z\s]+)/i) ||
                     section.match(/(credit card|mortgage|auto loan|student loan|personal loan)/i);
    if (typeMatch && typeMatch[1]) {
      accountType = typeMatch[1].trim();
    }
    
    // Extract open date
    let openDate = '';
    const openMatch = section.match(/(?:open|opened)(?:ed)?\s*(?:date|on):?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (openMatch && openMatch[1]) {
      openDate = openMatch[1].trim();
    }
    
    // Extract status
    let status = '';
    const statusMatch = section.match(/status:?\s*([A-Za-z\s]+)/i) ||
                        section.match(/(open|closed|paid|charged off|collection)/i);
    if (statusMatch && statusMatch[1]) {
      status = statusMatch[1].trim();
    }
    
    // Extract balance
    let balance = '';
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
      balance: balance || 'Not Found',
      paymentHistory: [] // Simplified - would need more complex parsing
    });
  });
  
  return accounts;
};

export const parseCreditReport = (text: string): CreditReport => {
  const bureau = identifyBureau(text);
  const reportDate = extractDate(text);
  const personalInfo = extractPersonalInfo(text);
  const accounts = extractAccounts(text);
  const creditScores = extractCreditScores(text);
  
  return {
    bureau,
    reportDate,
    personalInfo,
    accounts,
    inquiries: [], // Would need more complex parsing
    publicRecords: [], // Would need more complex parsing
    collections: [], // Would need more complex parsing
    creditScores,
    rawText: text
  };
};
