
export const extractEquifaxOtherItems = (text: string): {
  inquiryCount: number;
  recentInquiry: string;
  publicRecordCount: number;
  collectionCount: number;
  personalInfoItemCount: number;
  statementCount?: number;
} => {
  // Default values
  let inquiryCount = 0;
  let recentInquiry = '';
  let publicRecordCount = 0;
  let collectionCount = 0;
  let personalInfoItemCount = 0;
  let statementCount = 0;
  
  // Extract inquiry count
  const inquiryMatch = text.match(/(?:Credit )?Inquiries[:\s]+(\d+)(?:\s*Inquiries?| Records?| Record)?\s*Found/i);
  if (inquiryMatch && inquiryMatch[1]) {
    inquiryCount = parseInt(inquiryMatch[1]);
  }
  
  // Extract most recent inquiry - search with multiple patterns
  // Pattern 1: Look for a pattern like "Most Recent Inquiry: COMPANY NAME (CODE) Date"
  const recentInquiryMatch = text.match(/Most\s+Recent\s+Inquiry[:\s]+([^\n]+?)(?:\n|$)/i);
  if (recentInquiryMatch && recentInquiryMatch[1]) {
    const inquiryText = recentInquiryMatch[1].trim();
    // Only use the inquiry if it's not too long (likely not the whole report)
    if (inquiryText.length < 100) {
      recentInquiry = inquiryText;
    }
  }
  
  // Pattern 2: Look for the inquiry directly after the "Most Recent Inquiry" text
  if (!recentInquiry) {
    const mostRecentInquiryLinePattern = /Most\s+Recent\s+Inquiry.*?(?:\n|\r\n?)([A-Z][A-Z0-9/\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i;
    const lineMatch = text.match(mostRecentInquiryLinePattern);
    if (lineMatch && lineMatch[1]) {
      recentInquiry = lineMatch[1].trim();
    }
  }
  
  // Pattern 3: Look for company name with date format
  if (!recentInquiry) {
    const dateFormatPattern = /([A-Z][A-Z0-9\s\/.]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i;
    const dateMatch = text.match(dateFormatPattern);
    if (dateMatch && dateMatch[1] && dateMatch[1].length < 100) {
      recentInquiry = dateMatch[1].trim();
    }
  }
  
  // Alternative pattern for Equifax specific format
  if (!recentInquiry) {
    const equifaxInquiryPattern = /(EQUIFAX\s+INC\s+\(\d+\)\s+\w+\s+\d+,\s+\d{4})/i;
    const equifaxMatch = text.match(equifaxInquiryPattern);
    if (equifaxMatch && equifaxMatch[1]) {
      recentInquiry = equifaxMatch[1].trim();
    }
  }
  
  // Extract public records count
  const publicRecordMatch = text.match(/Public\s+Records[:\s]+(\d+)(?:\s*Records?)?\s*Found/i);
  if (publicRecordMatch && publicRecordMatch[1]) {
    publicRecordCount = parseInt(publicRecordMatch[1]);
  }
  
  // Extract collections count
  const collectionsMatch = text.match(/Collections[:\s]+(\d+)(?:\s*Collections?)?\s*Found/i);
  if (collectionsMatch && collectionsMatch[1]) {
    collectionCount = parseInt(collectionsMatch[1]);
  }
  
  // Extract personal information item count
  const personalInfoMatch = text.match(/Personal\s+Information[:\s]+(\d+)(?:\s*Items?)?\s*Found/i);
  if (personalInfoMatch && personalInfoMatch[1]) {
    personalInfoItemCount = parseInt(personalInfoMatch[1]);
  }
  
  // Extract statement count with improved pattern
  const statementMatch = text.match(/(?:Consumer\s*)?Statements?\s*:?\s*(\d+)(?:\s*Statement|Statements|Record|Records)?\s*Found/i);
  if (statementMatch && statementMatch[1]) {
    statementCount = parseInt(statementMatch[1]);
  }
  
  return {
    inquiryCount,
    recentInquiry,
    publicRecordCount,
    collectionCount,
    personalInfoItemCount,
    statementCount
  };
};
