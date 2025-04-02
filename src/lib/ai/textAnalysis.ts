
import { getNER } from './modelPipelines';

// Renamed to NEREntity to avoid conflicts
export interface NEREntity {
  word: string;
  entity: string;
  score: number;
}

export async function extractEntities(text: string): Promise<NEREntity[]> {
  try {
    // Skip processing if text is empty or undefined
    if (!text || text.length === 0) {
      console.log("Empty text provided to extractEntities, skipping");
      return [];
    }
    
    // Only process a limited amount of text to avoid freezing the browser
    const textToProcess = text.substring(0, 3000);
    
    console.log(`Extracting entities from text (${textToProcess.length} chars)`);
    const startTime = performance.now();
    
    // Yield to UI thread before heavy AI processing
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Get model (will use already loaded model if available)
    const ner = await getNER();
    
    // If the model failed to load, return empty results
    if (!ner) {
      console.log("NER model not available, skipping entity extraction");
      return [];
    }
    
    // Yield again to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Process the text with the NER model
    const results = await ner(textToProcess, {
      aggregation_strategy: 'simple'
    });
    
    const endTime = performance.now();
    console.log(`Entity extraction completed in ${Math.round(endTime - startTime)}ms, found ${results.length} entities`);
    
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
