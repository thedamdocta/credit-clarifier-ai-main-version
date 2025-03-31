
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
  
  // IMPROVED EXTRACTION FOR MOST RECENT INQUIRY
  
  // Step 1: Find the exact location of "Most Recent Inquiry" text
  const inquiryHeadingIndex = text.indexOf('Most Recent Inquiry');
  
  if (inquiryHeadingIndex >= 0) {
    // Get a chunk of text after the heading (large enough to capture the content)
    const chunkSize = 800; // Larger chunk to ensure we capture the content
    const textChunk = text.substring(inquiryHeadingIndex, inquiryHeadingIndex + chunkSize);
    
    // Pattern 1: Look for common credit bureau inquiry formats with dates
    const creditBureauPatterns = [
      /CIC\/[A-Z]+\s+RPTS\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
      /EQUIFAX\s+(?:INFORMATION\s+SERVICES|INC).*?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
      /EXPERIAN.*?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
      /TRANSUNION.*?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
      /[A-Z][A-Z0-9\s\/.,()&'"-]{2,50}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
    ];
    
    // Try each pattern on the chunk
    for (const pattern of creditBureauPatterns) {
      const match = textChunk.match(pattern);
      if (match && match[0]) {
        recentInquiry = match[0].trim();
        break;
      }
    }
    
    // Pattern 2: If still not found, try looking for the line after the heading
    if (!recentInquiry) {
      // Split the chunk into lines
      const lines = textChunk.split(/\n|\r\n?/);
      
      // Find the line with "Most Recent Inquiry"
      let headingLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Most Recent Inquiry')) {
          headingLineIndex = i;
          break;
        }
      }
      
      if (headingLineIndex >= 0) {
        // Check the heading line itself for content after the heading
        const headingLine = lines[headingLineIndex];
        const contentAfterHeading = headingLine.replace(/.*Most\s+Recent\s+Inquiry[:\s]*/i, '').trim();
        
        if (contentAfterHeading && contentAfterHeading.length > 5 && contentAfterHeading.length < 100) {
          recentInquiry = contentAfterHeading;
        }
        // If nothing on the heading line, check the next line
        else if (headingLineIndex + 1 < lines.length) {
          const nextLine = lines[headingLineIndex + 1].trim();
          if (nextLine && !nextLine.startsWith('Public Records') && nextLine.length < 100) {
            recentInquiry = nextLine;
          }
        }
      }
    }
    
    // Pattern 3: Last resort - any text with a date pattern near "Most Recent Inquiry"
    if (!recentInquiry) {
      const datePattern = /([A-Za-z0-9\s\/.,()&'"-]{3,50}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i;
      const dateMatch = textChunk.match(datePattern);
      if (dateMatch && dateMatch[1]) {
        recentInquiry = dateMatch[1].trim();
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
