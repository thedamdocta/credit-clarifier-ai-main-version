
import { CreditReport } from "../types/creditReport";

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
