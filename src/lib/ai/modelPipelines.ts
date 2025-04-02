
import { pipeline } from '@huggingface/transformers';
import { toast } from "sonner";
import { TEXT_CLASSIFICATION_MODEL, NER_MODEL } from './config';

// Initialize model pipelines lazily
let classifierPromise: Promise<any> | null = null;
let nerPromise: Promise<any> | null = null;
let modelLoadStartTime: number | null = null;

// Helper function to log model loading durations
const logModelLoadingTime = (modelType: string, startTime: number) => {
  const duration = Date.now() - startTime;
  console.log(`${modelType} model loaded in ${(duration / 1000).toFixed(1)}s`);
  return duration;
};

// Helper function to load the text classification model
export const getClassifier = async () => {
  if (!classifierPromise) {
    console.log('Loading text classification model...');
    const startTime = Date.now();
    modelLoadStartTime = startTime;
    
    try {
      classifierPromise = pipeline('text-classification', TEXT_CLASSIFICATION_MODEL)
        .then(model => {
          logModelLoadingTime('Classification', startTime);
          return model;
        })
        .catch(error => {
          console.error('Error loading classification model:', error);
          toast.error('Error loading text classification model');
          throw error;
        });
    } catch (error) {
      console.error('Error initializing classification model pipeline:', error);
      toast.error('Failed to initialize model pipeline');
      throw error;
    }
  }
  return classifierPromise;
};

// Helper function to load the named entity recognition model
export const getNER = async () => {
  if (!nerPromise) {
    console.log('Loading NER model...');
    const startTime = Date.now();
    modelLoadStartTime = startTime;
    
    try {
      nerPromise = pipeline('token-classification', NER_MODEL)
        .then(model => {
          const duration = logModelLoadingTime('NER', startTime);
          // If loading takes too long, warn the user
          if (duration > 30000) {
            console.warn('NER model loading took longer than expected');
          }
          return model;
        })
        .catch(error => {
          console.error('Error loading NER model:', error);
          toast.error('Error loading entity recognition model');
          throw error;
        });
    } catch (error) {
      console.error('Error initializing NER model pipeline:', error);
      toast.error('Failed to initialize NER pipeline');
      throw error;
    }
  }
  return nerPromise;
};

// Function to check if model loading is in progress
export const isModelLoading = () => {
  return (classifierPromise !== null || nerPromise !== null) && modelLoadStartTime !== null;
};

// Function to get model loading duration in seconds
export const getModelLoadingDuration = () => {
  if (!modelLoadStartTime) return 0;
  return Math.floor((Date.now() - modelLoadStartTime) / 1000);
};
