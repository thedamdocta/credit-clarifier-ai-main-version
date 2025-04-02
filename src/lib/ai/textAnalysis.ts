
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
