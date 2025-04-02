
/**
 * Functions for identifying document patterns in extracted text
 */

/**
 * Identifies credit report bureau patterns in the text
 */
export const identifyDocumentPatterns = (extractedText: string) => {
  const lowercaseText = extractedText.toLowerCase();
  
  const hasEquifaxPatterns = lowercaseText.includes('equifax credit report') || 
                             lowercaseText.includes('equifax credit file');
                             
  const hasExperianPatterns = lowercaseText.includes('experian credit report') ||
                              lowercaseText.includes('experian credit score');
                              
  const hasTransUnionPatterns = lowercaseText.includes('transunion credit report') ||
                                lowercaseText.includes('transunion credit file');
  
  const hasAccountTable = lowercaseText.includes('account type') && 
                         (lowercaseText.includes('revolving') || 
                          lowercaseText.includes('installment') ||
                          lowercaseText.includes('mortgage'));
  
  return {
    hasEquifaxPatterns,
    hasExperianPatterns,
    hasTransUnionPatterns,
    hasAccountTable
  };
};
