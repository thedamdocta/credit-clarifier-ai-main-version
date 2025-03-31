
import { pipeline, env } from '@huggingface/transformers';

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
