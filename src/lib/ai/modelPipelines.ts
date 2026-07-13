
import { pipeline } from '@huggingface/transformers';
import { TEXT_CLASSIFICATION_MODEL, NER_MODEL } from './config';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

// Initialize model pipelines lazily
let classifierPromise: Promise<any> | null = null;
let nerPromise: Promise<any> | null = null;

// Helper function to load the text classification model
export const getClassifier = async () => {
  if (!classifierPromise) {
    devDiagnostics.log('Loading text classification model...');
    classifierPromise = pipeline('text-classification', TEXT_CLASSIFICATION_MODEL);
  }
  return classifierPromise;
};

// Helper function to load the named entity recognition model
export const getNER = async () => {
  if (!nerPromise) {
    devDiagnostics.log('Loading NER model...');
    nerPromise = pipeline('token-classification', NER_MODEL);
  }
  return nerPromise;
};
