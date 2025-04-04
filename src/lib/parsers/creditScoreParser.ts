import { CreditScore } from "../types/creditReport";

export const extractCreditScores = (text: string): CreditScore[] => {
  const scores: CreditScore[] = [];

  // Regex to find credit score entries
  const scoreRegex = /(\d{3,4})\s*(?:-|to)\s*\d{3,4}.*?(Equifax|Experian|TransUnion)\s*Score\s*(\d{1,2}\/\d{1,2}\/\d{4})/;
  const matches = text.matchAll(scoreRegex);

  for (const match of matches) {
    if (match && match.length > 3) {
      const scoreValue = parseInt(match[1], 10);
      const provider = match[2];
      const date = match[3];

      // Basic validation to ensure score is within a reasonable range
      if (scoreValue >= 300 && scoreValue <= 850) {
        scores.push({
          score: scoreValue,
          range: '300-850', // Default range, can be adjusted if needed
          date: date,
          type: 'FICO', // Assuming FICO score, adjust if necessary
          provider: provider
        });
      }
    }
  }
  
  return scores.map(score => ({
    score: score.score,
    range: score.range,
    date: score.date,
    type: score.type || 'Unspecified', // Add default type if not provided
    provider: score.provider
  }));
};
