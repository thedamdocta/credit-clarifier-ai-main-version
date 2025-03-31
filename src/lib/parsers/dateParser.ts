
export const extractDate = (text: string): string => {
  // Define an array of patterns to try, in order of preference
  const datePatterns = [
    // Look for explicit report dates first with month names (Dec 27, 2024)
    /report\s+date\s*:?\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i,
    
    // Look for numeric formats (MM/DD/YYYY)
    /report\s+date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    
    // More general date formats near "Report Date" text
    /Report\s+Date.*?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i,
    
    // Then try date issued patterns
    /date\s+issued\s*:?\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i,
    /date\s+issued\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    
    // Then try as of dates
    /as\s+of\s*:?\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i,
    /as\s+of\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    
    // Look for REF-D | Dec 27, 2024 pattern (common in Equifax reports)
    /(?:REF-D|REF-D)\s+REF-D\s+\|\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i,
    
    // Newly added: look for date near the top of the document with "Page X of Y" pattern
    /Page\s+\d+\s+of\s+\d+\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i,
    
    // Finally, try any dates in specific formats as a fallback
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i
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
      return match[1].trim();
    }
  }
  
  // If no date found in header, try the entire document
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // If all else fails, look for any date with common Equifax report format
  const equifaxDatePattern = /EQUIFAX\s+INC\s+\(\d+\)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})/i;
  const equifaxMatch = text.match(equifaxDatePattern);
  if (equifaxMatch && equifaxMatch[1]) {
    return equifaxMatch[1].trim();
  }
  
  // Last resort: return today's date
  return new Date().toLocaleDateString();
};
