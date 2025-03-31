
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
  
  // Look for address sections in the text
  // First, try to find specific address blocks
  const addressBlocks = text.match(/(?:address|residence|location)(?:es)?:?(?:\s*\w+)?:?\s*([A-Za-z0-9\s\.,#\-]+(?:\n[A-Za-z0-9\s\.,#\-]+)*)/ig);
  
  if (addressBlocks) {
    addressBlocks.forEach(block => {
      const addressLine = block.replace(/(?:address|residence|location)(?:es)?:?(?:\s*\w+)?:?\s*/i, '').trim();
      if (addressLine && addressLine.length > 5) { // Basic validation
        addresses.push(addressLine);
      }
    });
  }
  
  // Also look for address patterns (street numbers, common street suffixes)
  const addressPatterns = [
    /(\d+\s+[A-Za-z]+\s+(?:ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|RD|ROAD|DR|DRIVE|LN|LANE|CT|COURT|CIR|CIRCLE|WAY|TER|TERRACE|PL|PLACE)\.?\s+(?:[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?|[A-Za-z\s]+))/ig,
    /(?:CURRENT|FORMER)\s+(?:[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+)?(\d+\s+[A-Za-z\s\.]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/ig
  ];
  
  for (const pattern of addressPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].trim().length > 8) {
        const addr = match[0].trim();
        if (!addresses.some(a => a.includes(addr))) {
          addresses.push(addr);
        }
      }
    }
  }
  
  // Additional information often found in address sections
  // For opt-out information
  const optOutMatch = text.match(/(?:opt[\s-]out|do not contact)(?:\s+[^\.]+)(?:\s+\d{1,3}[\s-]\d{3}[\s-]\d{3}[\s-]\d{4})/i);
  if (optOutMatch && optOutMatch[0]) {
    addresses.push(optOutMatch[0].trim());
  }
  
  // For report provider information
  const reporterMatch = text.match(/(?:reported|provided)\s+(?:by|to)\s+[^\.]+/i);
  if (reporterMatch && reporterMatch[0]) {
    addresses.push(reporterMatch[0].trim());
  }
  
  // Extract SSN (with masking for privacy)
  let ssn: string | undefined;
  const ssnMatch = text.match(/ssn:?\s*(?:xxx-xx-|[*]{5}|[*]{3}-[*]{2}-)(\d{4})/i);
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
