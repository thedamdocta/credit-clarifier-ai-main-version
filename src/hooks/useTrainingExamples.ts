
import { useState, useEffect } from 'react';
import { trainParser } from '@/lib/ai/table/valueParser';
import { AccountSummary } from '@/lib/types/creditReport';
import { toast } from 'sonner';

/**
 * Custom hook to manage training examples for the OCR parser
 * This hook allows the app to learn from known good examples to improve OCR accuracy
 */
export const useTrainingExamples = () => {
  const [examples, setExamples] = useState<AccountSummary[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainedAt, setTrainedAt] = useState<Date | null>(null);
  
  // Load persisted training examples on mount
  useEffect(() => {
    const storedExamples = localStorage.getItem('ocr_training_examples');
    if (storedExamples) {
      try {
        const parsed = JSON.parse(storedExamples);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExamples(parsed);
          console.log(`Loaded ${parsed.length} persisted training examples`);
        }
      } catch (e) {
        console.error('Failed to parse stored training examples', e);
      }
    }
  }, []);

  /**
   * Add new training examples to improve OCR accuracy
   * @param newExamples Array of account summaries to use as training examples
   * @param showToast Whether to show a toast notification (default: true)
   */
  const addTrainingExamples = (newExamples: AccountSummary[], showToast: boolean = true) => {
    if (!newExamples || newExamples.length === 0) return;
    
    setIsTraining(true);
    
    try {
      // Filter out examples with no real data
      const validExamples = newExamples.filter(ex => 
        (ex.open !== null && ex.open !== '') ||
        (ex.withBalance !== null && ex.withBalance !== '') ||
        (ex.totalBalance !== null && ex.totalBalance !== '')
      );
      
      if (validExamples.length === 0) {
        console.log('No valid training examples found');
        if (showToast) {
          toast.warning('No valid training data found in this example');
        }
        setIsTraining(false);
        return;
      }
      
      console.log(`Adding ${validExamples.length} valid training examples`);
      
      // Update state to include new examples
      setExamples(prev => {
        const combined = [...prev];
        let newAdditions = 0;
        
        // Only add examples that aren't already in the list
        validExamples.forEach(ex => {
          if (!combined.some(e => e.accountType === ex.accountType && 
                              e.open === ex.open && 
                              e.totalBalance === ex.totalBalance)) {
            combined.push(ex);
            newAdditions++;
          }
        });
        
        // Persist to localStorage
        if (newAdditions > 0) {
          localStorage.setItem('ocr_training_examples', JSON.stringify(combined));
        }
        
        return combined;
      });
      
      // Train the parser with these new examples
      trainParser(validExamples);
      setTrainedAt(new Date());
      
      console.log('Training complete');
      if (showToast) {
        toast.success(`Successfully trained with ${validExamples.length} examples`);
      }
    } catch (error) {
      console.error('Error adding training examples:', error);
      if (showToast) {
        toast.error('Error training the OCR system');
      }
    } finally {
      setIsTraining(false);
    }
  };
  
  /**
   * Reset all training examples and clear the training data
   */
  const resetTrainingExamples = () => {
    localStorage.removeItem('ocr_training_examples');
    setExamples([]);
    setTrainedAt(null);
    toast.info('Training data has been reset');
  };

  return {
    examples,
    isTraining,
    trainedAt,
    addTrainingExamples,
    resetTrainingExamples
  };
};

export default useTrainingExamples;
