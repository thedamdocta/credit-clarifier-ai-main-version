
// Empty interfaces and functions to prevent AI model loading

export interface NEREntity {
  word: string;
  entity: string;
  score: number;
}

export async function extractEntities(text: string): Promise<NEREntity[]> {
  console.log("AI text analysis disabled, returning empty results");
  return [];
}

export async function processWithAI(text: string): Promise<any> {
  console.log("AI processing disabled, returning empty results");
  return null;
}

export async function analyzeText(text: string): Promise<any> {
  console.log("AI text analysis disabled, returning empty results");
  return null;
}

export async function extractFields(text: string): Promise<any> {
  console.log("AI field extraction disabled, returning empty results");
  return {};
}
