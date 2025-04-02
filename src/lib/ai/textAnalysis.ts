
import { getNER } from './modelPipelines';

export interface Entity {
  word: string;
  entity: string;
  score: number;
}

export async function extractEntities(text: string): Promise<Entity[]> {
  try {
    // Only process a limited amount of text to avoid freezing the browser
    const textToProcess = text.substring(0, 3000);
    
    const ner = await getNER();
    
    // If the model failed to load, return empty results
    if (!ner) {
      console.log("NER model not available, skipping entity extraction");
      return [];
    }
    
    // Process the text with the NER model
    const results = await ner(textToProcess, {
      aggregation_strategy: 'simple'
    });
    
    return results.map((result: any) => ({
      word: result.word,
      entity: result.entity,
      score: result.score
    }));
  } catch (error) {
    console.error("Error extracting entities:", error);
    
    // Check for network-related JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
      console.error("Network issue detected when connecting to AI service. Continuing without AI.");
    }
    
    // Return empty array to allow processing to continue
    return [];
  }
}
