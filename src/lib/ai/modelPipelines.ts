
import { pipeline } from '@huggingface/transformers';
import { TEXT_CLASSIFICATION_MODEL, NER_MODEL } from './config';

// Initialize model pipelines lazily
let classifierPromise: Promise<any> | null = null;
let nerPromise: Promise<any> | null = null;

// Helper function to load the text classification model
export const getClassifier = async () => {
  if (!classifierPromise) {
    console.log('Loading text classification model...');
    classifierPromise = pipeline({
      task: 'text-classification',
      model: TEXT_CLASSIFICATION_MODEL
    });
  }
  return classifierPromise;
};

// Helper function to load the named entity recognition model
export const getNER = async () => {
  if (!nerPromise) {
    console.log('Loading NER model...');
    nerPromise = pipeline({
      task: 'token-classification',
      model: NER_MODEL
    });
  }
  return nerPromise;
};
