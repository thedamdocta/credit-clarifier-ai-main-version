
import { pipeline } from '@huggingface/transformers';
import { toast } from "sonner";
import { TEXT_CLASSIFICATION_MODEL, NER_MODEL } from './config';

// Initialize model pipelines lazily
let classifierPromise: Promise<any> | null = null;
let nerPromise: Promise<any> | null = null;
let modelLoadStartTime: number | null = null;
let modelLoadingTimeoutId: NodeJS.Timeout | null = null;

// Custom error for model loading timeout
class ModelLoadingTimeoutError extends Error {
  constructor(modelType: string) {
    super(`${modelType} model loading timed out after 60 seconds`);
    this.name = 'ModelLoadingTimeoutError';
  }
}

// Helper function to log model loading durations
const logModelLoadingTime = (modelType: string, startTime: number) => {
  const duration = Date.now() - startTime;
  console.log(`${modelType} model loaded in ${(duration / 1000).toFixed(1)}s`);
  return duration;
};

// Helper function to setup model loading timeout
const setupModelLoadingTimeout = (modelType: string): Promise<never> => {
  return new Promise((_, reject) => {
    // Clear any existing timeout
    if (modelLoadingTimeoutId) {
      clearTimeout(modelLoadingTimeoutId);
    }
    
    // Set a new timeout (60 seconds)
    modelLoadingTimeoutId = setTimeout(() => {
      console.error(`${modelType} model loading timed out after 60 seconds`);
      toast.error(`${modelType} model loading timed out. Try refreshing the page.`);
      reject(new ModelLoadingTimeoutError(modelType));
    }, 60000);
  });
};

// Helper function to clear the model loading timeout
const clearModelLoadingTimeout = () => {
  if (modelLoadingTimeoutId) {
    clearTimeout(modelLoadingTimeoutId);
    modelLoadingTimeoutId = null;
  }
};

// Helper function to load the text classification model
export const getClassifier = async () => {
  if (!classifierPromise) {
    console.log('Loading text classification model...');
    const startTime = Date.now();
    modelLoadStartTime = startTime;
    
    try {
      // Create a timeout promise that will reject if the model takes too long to load
      const timeoutPromise = setupModelLoadingTimeout('Classification');
      
      // Create the pipeline promise
      const pipelinePromise = pipeline('text-classification', TEXT_CLASSIFICATION_MODEL)
        .then(model => {
          clearModelLoadingTimeout();
          logModelLoadingTime('Classification', startTime);
          return model;
        });
      
      // Race the pipeline and timeout promises
      classifierPromise = Promise.race([pipelinePromise, timeoutPromise])
        .catch(error => {
          console.error('Error loading classification model:', error);
          toast.error('Error loading text classification model. Try again with a smaller file.');
          classifierPromise = null; // Reset so we can try again
          throw error;
        });
    } catch (error) {
      console.error('Error initializing classification model pipeline:', error);
      toast.error('Failed to initialize model pipeline');
      classifierPromise = null; // Reset so we can try again
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
      // Create a timeout promise that will reject if the model takes too long to load
      const timeoutPromise = setupModelLoadingTimeout('NER');
      
      // Create the pipeline promise
      const pipelinePromise = pipeline('token-classification', NER_MODEL)
        .then(model => {
          clearModelLoadingTimeout();
          const duration = logModelLoadingTime('NER', startTime);
          return model;
        });
      
      // Race the pipeline and timeout promises
      nerPromise = Promise.race([pipelinePromise, timeoutPromise])
        .catch(error => {
          console.error('Error loading NER model:', error);
          toast.error('Error loading entity recognition model. Try again with a smaller file.');
          nerPromise = null; // Reset so we can try again
          throw error;
        });
    } catch (error) {
      console.error('Error initializing NER model pipeline:', error);
      toast.error('Failed to initialize NER pipeline');
      nerPromise = null; // Reset so we can try again
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

// Function to reset model loading state (for recovery after errors)
export const resetModelLoadingState = () => {
  classifierPromise = null;
  nerPromise = null;
  modelLoadStartTime = null;
  clearModelLoadingTimeout();
  console.log('Model loading state has been reset');
};
