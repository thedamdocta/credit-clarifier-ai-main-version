import { enhanceCreditReportWithAI, extractSSNWithAI, parseWithAI } from './aiTextAnalysis';

export interface Account {
  accountName: string;
  accountNumber: string;
  accountType: string;
  openDate: string;
  status: string;
  balance: string | null;
  paymentHistory: string[];
  creditLimit?: string | null;
  highestBalance?: string | null;
  paymentStatus?: string;
  totalAccounts?: number;
  openAccounts?: number;
  closedAccounts?: number;
}

export interface PersonalInfo {
  name: string;
  addresses: string[];
  ssn?: string;
  dob?: string;
  employmentHistory?: string;
}

export interface CreditScore {
  score: number;
  range: string;
  provider: string;
  date: string;
}

export interface AccountSummary {
  accountType: string;
  totalAccounts: number;
  open: number;
  closed: number;
  balance: string | null;
  withBalance?: number;
  totalBalance?: string;
  available?: string;
  creditLimit?: string;
  debtToCredit?: string;
  payment?: string;
}

export interface CreditReport {
  bureau: 'Equifax' | 'Experian' | 'TransUnion' | 'Unknown';
  reportDate: string;
  personalInfo: PersonalInfo;
  accounts: Account[];
  accountSummaries?: AccountSummary[];
  inquiries: any[];
  publicRecords: any[];
  collections: any[];
  creditScores: CreditScore[];
  rawText: string;
  recentInquiry?: string;
  personalInfoItemCount?: number;
  inquiryCount?: number;
  publicRecordCount?: number;
  collectionCount?: number;
}

export const identifyBureau = (text: string): CreditReport['bureau'] => {
  const lowerText = text.toLowerCase();
  
  // Check for Equifax more explicitly - look for distinctive markers
  if (
    lowerText.includes('equifax') || 
    lowerText.includes('report confirmation') && lowerText.includes('confirmation number') ||
    lowerText.includes('report date') && lowerText.includes('credit file status')
  ) {
    console.log("Bureau identified as Equifax");
    return 'Equifax';
  } else if (lowerText.includes('experian')) {
    console.log("Bureau identified as Experian");
    return 'Experian';
  } else if (lowerText.includes('transunion')) {
    console.log("Bureau identified as TransUnion");
    return 'TransUnion';
  }
  
  console.log("Bureau couldn't be identified, marking as Unknown");
  return 'Unknown';
};

export const extractDate = (text: string): string => {
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
  
  return new Date().toLocaleDateString();
};

export const extractEquifaxAccountSummaries = (text: string): AccountSummary[] => {
  const summaries: AccountSummary[] = [];
  
  // Common account types in Equifax reports
  const accountTypes = ['Revolving', 'Installment', 'Mortgage', 'Other', 'Total'];

  // Look for the table header first - Equifax has a specific format
  const tableHeaderRegex = /Account\s+Type\s+(Total\s+Accounts)?\s*(Open)?\s*(Closed)?\s*(Balance)?/i;
  const tableHeaderMatch = text.match(tableHeaderRegex);
  
  if (tableHeaderMatch) {
    console.log("Found Equifax account summary table header");
    
    // Extract table rows
    for (const accountType of accountTypes) {
      // Look for rows that start with the account type
      // Updated to match the format: Account Type, Total Accounts, Open, Closed, Balance
      const rowRegex = new RegExp(`${accountType}\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*(?:\\$([\\.\\d,]+)|\\$0|-)?`, 'i');
      
      // Try to find the row
      const rowMatch = text.match(rowRegex);
      
      if (rowMatch) {
        console.log(`Found row for ${accountType}:`, rowMatch[0]);

        // Extract the values (with fallbacks for missing data)
        const totalAccounts = rowMatch[1] ? parseInt(rowMatch[1]) : 0;
        const openAccounts = rowMatch[2] ? parseInt(rowMatch[2]) : 0;
        const closedAccounts = rowMatch[3] ? parseInt(rowMatch[3]) : 0;
        
        // For balance, try to extract it from either pattern
        let balance: string | null = null;
        if (rowMatch[4]) {
          balance = `$${rowMatch[4]}`;
        }
        
        // Create the summary object with available data
        const summary: AccountSummary = {
          accountType,
          totalAccounts,
          open: openAccounts, 
          closed: closedAccounts,
          balance,
        };
        
        summaries.push(summary);
      } else {
        // If no match, create a default entry for this account type
        summaries.push({
          accountType,
          totalAccounts: 0,
          open: 0,
          closed: 0,
          balance: null
        });
      }
    }
  } else {
    console.log("Could not find Equifax account summary table header");
    
    // Create default entries for all account types
    accountTypes.forEach(accountType => {
      summaries.push({
        accountType,
        totalAccounts: 0,
        open: 0,
        closed: 0,
        balance: null
      });
    });
  }
  
  console.log("Extracted account summaries:", summaries);
  return summaries;
};

export const extractEquifaxOtherItems = (text: string): {
  inquiryCount: number;
  recentInquiry: string;
  publicRecordCount: number;
  collectionCount: number;
  personalInfoItemCount: number;
} => {
  // Default values
  let inquiryCount = 0;
  let recentInquiry = '';
  let publicRecordCount = 0;
  let collectionCount = 0;
  let personalInfoItemCount = 0;
  
  // Extract inquiry count
  const inquiryMatch = text.match(/(?:Credit )?Inquiries[:\s]+(\d+)(?:\s*Inquiries?| Records?| Record)?\s*Found/i);
  if (inquiryMatch && inquiryMatch[1]) {
    inquiryCount = parseInt(inquiryMatch[1]);
  }
  
  // Extract most recent inquiry
  const recentInquiryMatch = text.match(/Most Recent Inquiry[:\s]+(.*?)(?:\n|$)/i);
  if (recentInquiryMatch && recentInquiryMatch[1]) {
    recentInquiry = recentInquiryMatch[1].trim();
  }
  
  // Extract public records count
  const publicRecordMatch = text.match(/Public Records[:\s]+(\d+)(?:\s*Records?)?\s*Found/i);
  if (publicRecordMatch && publicRecordMatch[1]) {
    publicRecordCount = parseInt(publicRecordMatch[1]);
  }
  
  // Extract collections count
  const collectionsMatch = text.match(/Collections[:\s]+(\d+)(?:\s*Collections?)?\s*Found/i);
  if (collectionsMatch && collectionsMatch[1]) {
    collectionCount = parseInt(collectionsMatch[1]);
  }
  
  // Extract personal information item count
  const personalInfoMatch = text.match(/Personal Information[:\s]+(\d+)(?:\s*Items?)?\s*Found/i);
  if (personalInfoMatch && personalInfoMatch[1]) {
    personalInfoItemCount = parseInt(personalInfoMatch[1]);
  }
  
  return {
    inquiryCount,
    recentInquiry,
    publicRecordCount,
    collectionCount,
    personalInfoItemCount
  };
};

export const extractPersonalInfo = async (text: string): Promise<PersonalInfo> => {
  let name = '';
  const nameMatch = text.match(/name:?\s*([A-Za-z\s\.,]+)/i);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
  }
  
  const addresses: string[] = [];
  
  const addressBlocks = text.match(/(?:address|residence|location)(?:es)?:?(?:\s*\w+)?:?\s*([A-Za-z0-9\s\.,#\-]+(?:\n[A-Za-z0-9\s\.,#\-]+)*)/ig);
  
  if (addressBlocks) {
    addressBlocks.forEach(block => {
      const addressLine = block.replace(/(?:address|residence|location)(?:es)?:?(?:\s*\w+)?:?\s*/i, '').trim();
      if (addressLine && addressLine.length > 5) {
        addresses.push(addressLine);
      }
    });
  }
  
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
  
  let ssn: string | undefined;
  try {
    ssn = await extractSSNWithAI(text);
  } catch (error) {
    console.error("Error extracting SSN with AI:", error);
    const ssnMatch = text.match(/ssn:?\s*(?:xxx-xx-|[*]{5}|[*]{3}-[*]{2}-)(\d{4})/i);
    if (ssnMatch && ssnMatch[1]) {
      ssn = `XXX-XX-${ssnMatch[1]}`;
    }
  }
  
  let dob: string | undefined;
  const dobMatch = text.match(/(?:date of birth|dob|birth date):?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (dobMatch && dobMatch[1]) {
    dob = dobMatch[1];
  }
  
  let employmentHistory: string | undefined;
  const employmentPatterns = [
    /(?:employer|employment):?\s*([^\.]+)/i,
    /(?:employer|employment)\s*history:?\s*([^\.]+)/i,
    /(?:reported|current)\s*employer:?\s*([^\.]+)/i
  ];
  
  for (const pattern of employmentPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      employmentHistory = match[1].trim();
      break;
    }
  }
  
  return {
    name: name || 'Not Found',
    addresses: addresses.length ? addresses : ['Not Found'],
    ssn,
    dob,
    employmentHistory
  };
};

export const extractCreditScores = (text: string): CreditScore[] => {
  const scores: CreditScore[] = [];
  
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
  
  const accountSections = text.split(/(?:account|credit card|loan|mortgage)s?:?\s*#?\d+/i);
  
  accountSections.slice(1).forEach(section => {
    let accountName = '';
    const nameMatch = section.match(/([A-Za-z\s]+(?:BANK|CREDIT|CARD|LOAN|MORTGAGE|FINANCE|SERVICES|LLC|INC|CORP|AMERICA|EXPRESS|DISCOVER|CAPITAL|ONE))/i);
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

export const parseCreditReport = async (text: string, useAIFirst = true): Promise<CreditReport> => {
  // Identify bureau first to determine parsing approach
  const bureau = identifyBureau(text);
  console.log(`Identified bureau: ${bureau}`);
  
  // If AI-first approach is enabled, try that first
  if (useAIFirst) {
    try {
      console.log("Using AI-first approach for parsing credit report...");
      
      // Get initial AI parsing results
      const aiResults = await parseWithAI(text);
      console.log("AI initial parsing complete");
      
      // Extract additional information using traditional methods
      const accounts = extractAccounts(text);
      const creditScores = extractCreditScores(text);
      
      // Initialize a combined report
      let combinedReport: CreditReport = {
        bureau: aiResults.bureau || bureau,
        reportDate: aiResults.reportDate || extractDate(text),
        personalInfo: aiResults.personalInfo || await extractPersonalInfo(text),
        accounts,
        inquiries: [],
        publicRecords: [],
        collections: [],
        creditScores,
        rawText: text
      };
      
      // Add bureau-specific processing
      if (bureau === 'Equifax') {
        const equifaxSpecific = await parseEquifaxReport(text);
        combinedReport = {
          ...combinedReport,
          ...equifaxSpecific
        };
      }
      
      console.log("AI-first parsing complete");
      return combinedReport;
    } catch (error) {
      console.error("Error in AI-first parsing approach:", error);
      console.log("Falling back to traditional parsing...");
    }
  }
  
  // Traditional parsing approach (used as fallback or if AI-first is disabled)
  const reportDate = extractDate(text);
  const personalInfo = await extractPersonalInfo(text);
  const accounts = extractAccounts(text);
  const creditScores = extractCreditScores(text);
  
  // Initialize report with basic information
  let initialReport: CreditReport = {
    bureau,
    reportDate,
    personalInfo,
    accounts,
    inquiries: [],
    publicRecords: [],
    collections: [],
    creditScores,
    rawText: text
  };
  
  // Add bureau-specific processing
  if (bureau === 'Equifax') {
    const equifaxSpecific = await parseEquifaxReport(text);
    initialReport = {
      ...initialReport,
      ...equifaxSpecific
    };
  }
  
  try {
    const enhancedReport = await enhanceCreditReportWithAI(text, initialReport);
    return enhancedReport;
  } catch (error) {
    console.error("Error enhancing report with AI:", error);
    return initialReport;
  }
};
