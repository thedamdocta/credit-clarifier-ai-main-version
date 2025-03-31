
export const extractDate = (text: string): string => {
  // First look for explicit report dates with clear labeling
  const reportDatePattern = /report\s+date\s*:?\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})(?:\s|$)/i;
  const reportDateMatch = text.match(reportDatePattern);
  
  if (reportDateMatch && reportDateMatch[1]) {
    return reportDateMatch[1].trim();
  }
  
  // Try looking for date specifically in header with page numbers
  const pageHeaderPattern = /Page\s+\d+\s+of\s+\d+\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})(?:\s|$)/i;
  const pageHeaderMatch = text.match(pageHeaderPattern);
  
  if (pageHeaderMatch && pageHeaderMatch[1]) {
    return pageHeaderMatch[1].trim();
  }
  
  // Look for specific pattern with name and pipe delimiter
  const nameWithDatePattern = /REF-D\s+REF-D\s+\|\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})(?:\s|$)/i;
  const nameWithDateMatch = text.match(nameWithDatePattern);
  
  if (nameWithDateMatch && nameWithDateMatch[1]) {
    return nameWithDateMatch[1].trim();
  }
  
  // Try numeric date formats with explicit label
  const numericDatePattern = /report\s+date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})(?:\s|$)/i;
  const numericDateMatch = text.match(numericDatePattern);
  
  if (numericDateMatch && numericDateMatch[1]) {
    return numericDateMatch[1].trim();
  }
  
  // Fall back to looking for any month/day/year pattern in first 1000 chars
  // But limit the match to only the date itself with explicit ending
  const headerSection = text.substring(0, 1000);
  const anyMonthPattern = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})(?:\s|$)/i;
  const anyMonthMatch = headerSection.match(anyMonthPattern);
  
  if (anyMonthMatch && anyMonthMatch[1]) {
    return anyMonthMatch[1].trim();
  }
  
  // Last resort: return today's date
  return new Date().toLocaleDateString();
};
