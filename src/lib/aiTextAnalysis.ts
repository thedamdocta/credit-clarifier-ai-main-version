
import { pipeline, env } from '@huggingface/transformers';
import { CreditReport, PersonalInfo } from './creditReportParser';

// Configure environment
env.allowLocalModels = true;
env.useBrowserCache = true;

// Define the model we'll use
const TEXT_CLASSIFICATION_MODEL = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
const NER_MODEL = 'Xenova/bert-base-NER';

// Define interfaces
export interface TextClassification {
  label: string;
  score: number;
}

export interface Entity {
  entity: string;
  word: string;
  score: number;
  index: number;
  start: number;
  end: number;
}

// Initialize model pipelines lazily
let classifierPromise: Promise<any> | null = null;
let nerPromise: Promise<any> | null = null;

// Helper function to load the text classification model
export const getClassifier = async () => {
  if (!classifierPromise) {
    console.log('Loading text classification model...');
    classifierPromise = pipeline('text-classification', TEXT_CLASSIFICATION_MODEL);
  }
  return classifierPromise;
};

// Helper function to load the named entity recognition model
export const getNER = async () => {
  if (!nerPromise) {
    console.log('Loading NER model...');
    nerPromise = pipeline('token-classification', NER_MODEL);
  }
  return nerPromise;
};

// Function to analyze the sentiment of text
export const analyzeSentiment = async (text: string): Promise<TextClassification> => {
  try {
    const classifier = await getClassifier();
    const result = await classifier(text);
    return result[0];
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return { label: 'UNKNOWN', score: 0 };
  }
};

// Function to extract named entities from text
export const extractEntities = async (text: string): Promise<Entity[]> => {
  try {
    const ner = await getNER();
    return await ner(text);
  } catch (error) {
    console.error('Error extracting entities:', error);
    return [];
  }
};

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

// Enhanced name extraction with AI
export const extractNameWithAI = async (text: string): Promise<string> => {
  try {
    const entities = await extractEntities(text);
    
    // Look for person entities
    const personEntities = entities.filter(e => e.entity === 'B-PER' || e.entity === 'I-PER');
    
    if (personEntities.length > 0) {
      // Extract full name by finding consecutive person entities
      let fullName = '';
      let currentGroup: Entity[] = [];
      
      for (let i = 0; i < personEntities.length; i++) {
        const current = personEntities[i];
        if (current.entity === 'B-PER') {
          if (currentGroup.length > 0) {
            const name = currentGroup.map(e => e.word).join(' ');
            if (name.split(' ').length >= 2) {
              fullName = name;
              break;
            }
          }
          currentGroup = [current];
        } else if (current.entity === 'I-PER') {
          currentGroup.push(current);
        }
      }
      
      if (fullName && fullName.length > 2) {
        return fullName;
      }
    }
    
    // Fall back to regex-based name extraction
    const nameMatch = text.match(/name:?\s*([A-Za-z\s\.,]+)/i);
    if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 0) {
      return nameMatch[1].trim();
    }
    
    return 'Not Found';
  } catch (error) {
    console.error('Error extracting name with AI:', error);
    return 'Not Found';
  }
};

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

// AI-first approach to extract personal information
export const extractPersonalInfoWithAI = async (text: string): Promise<PersonalInfo> => {
  try {
    // Extract entities with AI
    const entities = await extractEntities(text);
    
    // Extract name with AI
    const name = await extractNameWithAI(text);
    
    // Extract addresses
    const addresses: string[] = [];
    
    // Look for location entities
    const locEntities = entities.filter(e => e.entity === 'B-LOC' || e.entity === 'I-LOC');
    
    // Group consecutive location entities
    let currentAddress: string[] = [];
    for (let i = 0; i < locEntities.length; i++) {
      if (locEntities[i].entity === 'B-LOC') {
        if (currentAddress.length > 0) {
          addresses.push(currentAddress.join(' '));
          currentAddress = [];
        }
        currentAddress.push(locEntities[i].word);
      } else if (locEntities[i].entity === 'I-LOC') {
        currentAddress.push(locEntities[i].word);
      }
    }
    
    if (currentAddress.length > 0) {
      addresses.push(currentAddress.join(' '));
    }
    
    // Fall back to regex for addresses if none found
    if (addresses.length === 0) {
      const addressPatterns = [
        /(\d+\s+[A-Za-z]+\s+(?:ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|RD|ROAD|DR|DRIVE|LN|LANE|CT|COURT|CIR|CIRCLE|WAY|TER|TERRACE|PL|PLACE)\.?\s+(?:[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?|[A-Za-z\s]+))/ig,
        /(?:CURRENT|FORMER)\s+(?:[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+)?(\d+\s+[A-Za-z\s\.]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/ig
      ];
      
      for (const pattern of addressPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].trim().length > 8) {
            const addr = match[0].trim();
            if (!addresses.some(a => a.includes(addr))) {
              addresses.push(addr);
            }
          }
        }
      }
    }
    
    // Extract SSN using AI
    const ssn = await extractSSNWithAI(text);
    
    // Extract DOB with regex (AI models are typically not good at date formats)
    let dob: string | undefined;
    const dobMatch = text.match(/(?:date of birth|dob|birth date):?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (dobMatch && dobMatch[1]) {
      dob = dobMatch[1];
    }
    
    // Extract employment information
    let employmentHistory: string | undefined;
    
    // Look for employment-related entities
    const employmentEntities = entities.filter(e => {
      const word = e.word.toLowerCase();
      return word.includes('employ') || word.includes('work') || word.includes('job');
    });
    
    if (employmentEntities.length > 0) {
      // Find sentences containing these entities
      const textLines = text.split(/[\r\n.]+/);
      for (const line of textLines) {
        if (employmentEntities.some(e => line.toLowerCase().includes(e.word.toLowerCase()))) {
          employmentHistory = line.trim();
          break;
        }
      }
    }
    
    // Fall back to regex for employment info if none found
    if (!employmentHistory) {
      const employmentPatterns = [
        /(?:employer|employment):?\s*([^\.]+)/i,
        /(?:employer|employment)\s*history:?\s*([^\.]+)/i,
        /(?:reported|current)\s*employer:?\s*([^\.]+)/i
      ];
      
      for (const pattern of employmentPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          employmentHistory = match[1].trim();
          break;
        }
      }
    }
    
    return {
      name: name || 'Not Found',
      addresses: addresses.length ? addresses : ['Not Found'],
      ssn,
      dob,
      employmentHistory
    };
  } catch (error) {
    console.error('Error extracting personal info with AI:', error);
    
    // Fall back to basic extraction
    const name = text.match(/name:?\s*([A-Za-z\s\.,]+)/i)?.[1]?.trim() || 'Not Found';
    
    return {
      name,
      addresses: ['Not Found'],
      ssn: undefined,
      dob: undefined,
      employmentHistory: undefined
    };
  }
};

// AI-first approach for credit report parsing
export const parseWithAI = async (text: string): Promise<Partial<CreditReport>> => {
  try {
    console.log("Beginning AI-first parsing of credit report...");
    
    // Identify the credit bureau
    const bureau = await identifyBureauWithAI(text);
    console.log(`AI identified bureau: ${bureau}`);
    
    // Extract report date (using regex as dates are better handled this way)
    const datePatterns = [
      /report date:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /date issued:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /as of:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/
    ];
    
    let reportDate = new Date().toLocaleDateString();
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        reportDate = match[1];
        break;
      }
    }
    
    // Extract personal information using AI
    const personalInfo = await extractPersonalInfoWithAI(text);
    console.log("AI extracted personal info");
    
    // Return partial report with AI-extracted information
    return {
      bureau,
      reportDate,
      personalInfo,
      rawText: text
    };
  } catch (error) {
    console.error("Error in AI-first parsing:", error);
    return {
      bureau: 'Unknown',
      reportDate: new Date().toLocaleDateString(),
      personalInfo: {
        name: 'Not Found',
        addresses: ['Not Found']
      },
      rawText: text
    };
  }
};

// Enhance credit report parsing with AI
export const enhanceCreditReportWithAI = async (text: string, partialReport: any) => {
  try {
    // Extract entities with AI
    const entities = await extractEntities(text);
    
    // Analyze sections for better classification
    const enhancedReport = { ...partialReport };
    
    // Improve personal information extraction
    if (enhancedReport.personalInfo) {
      // Look for potential name entities
      const personEntities = entities.filter(e => e.entity === 'B-PER' || e.entity === 'I-PER');
      if (personEntities.length > 0) {
        // Extract full name by finding consecutive person entities
        let fullName = '';
        let currentGroup = [];
        
        for (let i = 0; i < personEntities.length; i++) {
          const current = personEntities[i];
          if (current.entity === 'B-PER') {
            if (currentGroup.length > 0) {
              const name = currentGroup.map(e => e.word).join(' ');
              if (name.split(' ').length >= 2) {
                fullName = name;
                break;
              }
            }
            currentGroup = [current];
          } else if (current.entity === 'I-PER') {
            currentGroup.push(current);
          }
        }
        
        if (fullName && fullName.length > 2) {
          enhancedReport.personalInfo.name = fullName;
        }
      }
    }
    
    return enhancedReport;
  } catch (error) {
    console.error('Error enhancing credit report with AI:', error);
    return partialReport;
  }
};
