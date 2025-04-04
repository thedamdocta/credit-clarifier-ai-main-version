
import { CreditScore } from "../types/creditReport";
import { extractDate } from "./dateParser";

export const extractCreditScores = (text: string): CreditScore[] => {
  const scores: CreditScore[] = [];
  
  const scorePatterns = [
    /(?:fico|credit|vantage)\s*score:?\s*(\d{3})/i,
    /score:?\s*(\d{3})/i,
    /(\d{3})\s*(?:fico|credit|vantage)\s*score/i
  ];
  
  for (const pattern of scorePatterns) {
    const matches = text.matchAll(new RegExp(pattern, 'gi'));
    for (const match of matches) {
      if (match && match[1]) {
        const score = parseInt(match[1], 10);
        if (score >= 300 && score <= 850) {
          const provider = text.includes('FICO') ? 'FICO' : 
                         text.includes('VantageScore') ? 'VantageScore' : 'Unknown';
          
          scores.push({
            score,
            range: '300-850',
            provider,
            date: extractDate(text)
          });
        }
      }
    }
  }
  
  return scores;
};
