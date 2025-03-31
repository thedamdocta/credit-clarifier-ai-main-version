
export const extractDate = (text: string): string => {
  // Define an array of patterns to try, in order of preference
  const datePatterns = [
    // Look for explicit report dates first
    /report date:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /report date:?\s*(\w+\s+\d{1,2},\s+\d{4})/i,
    
    // Then try date issued patterns
    /date issued:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /date issued:?\s*(\w+\s+\d{1,2},\s+\d{4})/i,
    
    // Then try as of dates
    /as of:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /as of:?\s*(\w+\s+\d{1,2},\s+\d{4})/i,
    
    // Then look for dates near "report" or "credit report"
    /(?:report|credit report).*?(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(?:report|credit report).*?(\w+\s+\d{1,2},\s+\d{4})/i,
    
    // Finally, try any dates in specific formats as a fallback
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{2})/,
    /(\w+\s+\d{1,2},\s+\d{4})/i
  ];
  
  // Try to isolate the header section for more accurate date extraction
  let headerSection = '';
  const headerEndKeywords = ['summary', 'personal information', 'credit score', 'accounts'];
  
  // Get first ~1000 characters which typically include header information
  const firstSection = text.substring(0, Math.min(1000, text.length));
  
  // Find where the header section likely ends
  for (const keyword of headerEndKeywords) {
    const keywordIndex = firstSection.toLowerCase().indexOf(keyword);
    if (keywordIndex > 100) { // Ensure we don't cut off too early
      headerSection = firstSection.substring(0, keywordIndex);
      break;
    }
  }
  
  // If we couldn't determine header bounds, just use the first section
  if (!headerSection) {
    headerSection = firstSection;
  }
  
  // First try to find dates in the header section
  for (const pattern of datePatterns) {
    const match = headerSection.match(pattern);
    if (match && match[1]) {
      // Format the date if it's in MM/DD/YY format to MM/DD/YYYY
      if (match[1].match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
        const parts = match[1].split('/');
        const year = parseInt(parts[2]);
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        return `${parts[0]}/${parts[1]}/${fullYear}`;
      }
      return match[1];
    }
  }
  
  // If no date found in header, try the entire document
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Format the date if it's in MM/DD/YY format to MM/DD/YYYY
      if (match[1].match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
        const parts = match[1].split('/');
        const year = parseInt(parts[2]);
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        return `${parts[0]}/${parts[1]}/${fullYear}`;
      }
      return match[1];
    }
  }
  
  // If all else fails, return today's date
  return new Date().toLocaleDateString();
};
