
import { useState, useEffect } from 'react';
import { trainParser } from '@/lib/ai/table/valueParser';
import { AccountSummary } from '@/lib/types/creditReport';

/**
 * Custom hook to manage training examples for the OCR parser
 * This hook allows the app to learn from known good examples to improve OCR accuracy
 */
export const useTrainingExamples = () => {
  const [examples, setExamples] = useState<AccountSummary[]>([]);
  const [isTraining, setIsTraining] = useState(false);

  /**
   * Add new training examples to improve OCR accuracy
   * @param newExamples Array of account summaries to use as training examples
   */
  const addTrainingExamples = (newExamples: AccountSummary[]) => {
    if (!newExamples || newExamples.length === 0) return;
    
    setIsTraining(true);
    
    try {
      // Filter out examples with no real data
      const validExamples = newExamples.filter(ex => 
        (ex.open !== null && ex.open !== '') ||
        (ex.withBalance !== null && ex.withBalance !== '') ||
        (ex.totalBalance !== null && ex.totalBalance !== '')
      );
      
      console.log(`Adding ${validExamples.length} valid training examples`);
      
      // Update state to include new examples
      setExamples(prev => {
        const combined = [...prev];
        
        // Only add examples that aren't already in the list
        validExamples.forEach(ex => {
          if (!combined.some(e => e.accountType === ex.accountType && 
                              e.open === ex.open && 
                              e.totalBalance === ex.totalBalance)) {
            combined.push(ex);
          }
        });
        
        return combined;
      });
      
      // Train the parser with these new examples
      trainParser(validExamples);
      
      console.log('Training complete');
    } catch (error) {
      console.error('Error adding training examples:', error);
    } finally {
      setIsTraining(false);
    }
  };

  return {
    examples,
    isTraining,
    addTrainingExamples
  };
};

export default useTrainingExamples;
