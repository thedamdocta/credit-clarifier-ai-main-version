
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
