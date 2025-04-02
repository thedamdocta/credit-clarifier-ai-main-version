
import { extractEntities, NEREntity } from './textAnalysis';
import { extractNameWithAI } from './personalInfoExtraction';

// Enhanced SSN extraction using NLP
export const extractSSNWithAI = async (text: string): Promise<string | undefined> => {
  try {
    // First try regex-based approach (for speed)
    const ssnMatch = text.match(/ssn:?\s*(?:xxx-xx-|[*]{5}|[*]{3}-[*]{2}-)(\d{4})/i);
    if (ssnMatch && ssnMatch[1]) {
      return `XXX-XX-${ssnMatch[1]}`;
    }
    
    // Use NER to find potential SSN-like patterns
    const entities = await extractEntities(text);
    
    // Look for ID numbers (which might be SSNs)
    for (const entity of entities) {
      if (entity.entity.includes('ID') || entity.word.match(/\d{3}-\d{2}-\d{4}/)) {
        const possibleSSN = entity.word;
        // Mask the SSN for privacy
        if (possibleSSN.match(/\d{3}-\d{2}-\d{4}/)) {
          return `XXX-XX-${possibleSSN.slice(-4)}`;
        }
      }
    }
    
    return undefined;
  } catch (error) {
    console.error('Error extracting SSN with AI:', error);
    return undefined;
  }
};

// Re-export extractNameWithAI for backward compatibility
export { extractNameWithAI };

// Extract bureau information using AI
export const identifyBureauWithAI = async (text: string): Promise<'Equifax' | 'Experian' | 'TransUnion' | 'Unknown'> => {
  try {
    const entities = await extractEntities(text);
    
    // Look for organization entities that might match credit bureaus
    const orgEntities = entities.filter(e => e.entity === 'B-ORG' || e.entity === 'I-ORG');
    
    for (const entity of orgEntities) {
      const word = entity.word.toLowerCase();
      if (word.includes('equifax')) return 'Equifax';
      if (word.includes('experian')) return 'Experian';
      if (word.includes('transunion')) return 'TransUnion';
    }
    
    // Fall back to simple text matching
    const lowerText = text.toLowerCase();
    if (lowerText.includes('equifax')) return 'Equifax';
    if (lowerText.includes('experian')) return 'Experian';
    if (lowerText.includes('transunion')) return 'TransUnion';
    
    return 'Unknown';
  } catch (error) {
    console.error('Error identifying bureau with AI:', error);
    return 'Unknown';
  }
};
