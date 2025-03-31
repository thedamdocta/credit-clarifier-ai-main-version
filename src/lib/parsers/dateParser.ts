
export const extractDate = (text: string): string => {
  const datePatterns = [
    /report date:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /report date:?\s*(\w+\s+\d{1,2},\s+\d{4})/i,
    /date issued:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /date issued:?\s*(\w+\s+\d{1,2},\s+\d{4})/i,
    /as of:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /as of:?\s*(\w+\s+\d{1,2},\s+\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{2})/
  ];
  
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
  
  return new Date().toLocaleDateString();
};
