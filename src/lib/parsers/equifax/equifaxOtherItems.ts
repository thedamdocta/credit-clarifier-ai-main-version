
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
  
  // Extract most recent inquiry - use multiple patterns with improved approach
  
  // Pattern 1: Look for the line containing "Most Recent Inquiry" and capture everything until the end of line
  const recentInquiryLineMatch = text.match(/Most\s+Recent\s+Inquiry.*?:?\s*([^\n]+?)(?:\n|$)/i);
  if (recentInquiryLineMatch && recentInquiryLineMatch[1]) {
    // Clean the captured text - remove "Most Recent Inquiry" if it's still there and trim
    let inquiryText = recentInquiryLineMatch[1].trim();
    inquiryText = inquiryText.replace(/^Most\s+Recent\s+Inquiry[:\s]*/i, '');
    
    // Only use the inquiry if it's not too long (likely not the whole report) and contains meaningful data
    if (inquiryText.length < 100 && inquiryText.length > 5) {
      recentInquiry = inquiryText;
    }
  }
  
  // Pattern 2: Look for content after "Most Recent Inquiry" that matches typical inquiry format
  if (!recentInquiry) {
    const inquiryPattern = /Most\s+Recent\s+Inquiry.*?(?:\n|\r\n?)[\s:]*([A-Z][A-Z0-9\s\/.,()&-]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i;
    const match = text.match(inquiryPattern);
    if (match && match[1]) {
      recentInquiry = match[1].trim();
    }
  }
  
  // Pattern 3: Try to find date-based patterns that likely represent inquiries
  if (!recentInquiry) {
    // This pattern looks for company name format followed by a date
    const companyDatePattern = /([A-Z][A-Z0-9\s\/.,()&-]{2,}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i;
    
    // Find the nearest such pattern after "Most Recent Inquiry"
    const inquiryIndex = text.indexOf("Most Recent Inquiry");
    if (inquiryIndex >= 0) {
      // Search in the next 500 characters after "Most Recent Inquiry"
      const searchText = text.substring(inquiryIndex, inquiryIndex + 500);
      const dateMatch = searchText.match(companyDatePattern);
      if (dateMatch && dateMatch[1] && dateMatch[1].length < 100) {
        recentInquiry = dateMatch[1].trim();
      }
    }
  }
  
  // Pattern 4: Try specific credit bureau formats
  if (!recentInquiry) {
    const creditBureauPatterns = [
      /(CIC\/[A-Z]+\s+RPTS\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
      /(EQUIFAX\s+(?:INFORMATION\s+SERVICES|INC).*?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
      /(EXPERIAN.*?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
      /(TRANSUNION.*?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i
    ];
    
    for (const pattern of creditBureauPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        recentInquiry = match[1].trim();
        break;
      }
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
