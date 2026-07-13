
import { CreditReport } from "../types/creditReport";
import { devDiagnostics } from "@/lib/security/devDiagnostics";

export const identifyBureau = (text: string): CreditReport['bureau'] => {
  const lowerText = text.toLowerCase();
  
  // Check for Equifax more explicitly - look for distinctive markers
  if (
    lowerText.includes('equifax') || 
    lowerText.includes('report confirmation') && lowerText.includes('confirmation number') ||
    lowerText.includes('report date') && lowerText.includes('credit file status')
  ) {
    devDiagnostics.log("Bureau identified as Equifax");
    return 'Equifax';
  } else if (lowerText.includes('experian')) {
    devDiagnostics.log("Bureau identified as Experian");
    return 'Experian';
  } else if (lowerText.includes('transunion')) {
    devDiagnostics.log("Bureau identified as TransUnion");
    return 'TransUnion';
  }
  
  devDiagnostics.log("Bureau couldn't be identified, marking as Unknown");
  return 'Unknown';
};
