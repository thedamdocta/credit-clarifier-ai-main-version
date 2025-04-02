
// Stub implementations to prevent AI model loading

export const extractSSNWithAI = async (text: string): Promise<string | undefined> => {
  console.log("AI extraction disabled, using regex fallback only");
  // Only use regex fallback
  const ssnMatch = text.match(/ssn:?\s*(?:xxx-xx-|[*]{5}|[*]{3}-[*]{2}-)(\d{4})/i);
  if (ssnMatch && ssnMatch[1]) {
    return `XXX-XX-${ssnMatch[1]}`;
  }
  return undefined;
};

export const extractNameWithAI = async (text: string): Promise<string | undefined> => {
  console.log("AI name extraction disabled");
  return undefined;
};

export const identifyBureauWithAI = async (text: string): Promise<'Equifax' | 'Experian' | 'TransUnion' | 'Unknown'> => {
  console.log("AI bureau identification disabled, using text matching only");
  // Only use simple text matching
  const lowerText = text.toLowerCase();
  if (lowerText.includes('equifax')) return 'Equifax';
  if (lowerText.includes('experian')) return 'Experian';
  if (lowerText.includes('transunion')) return 'TransUnion';
  return 'Unknown';
};
