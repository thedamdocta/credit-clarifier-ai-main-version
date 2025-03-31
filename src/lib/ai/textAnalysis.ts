
import { getClassifier, getNER } from './modelPipelines';
import { TextClassification, Entity } from './types';

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
