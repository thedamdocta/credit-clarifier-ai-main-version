
import { pipeline } from '@huggingface/transformers';
import { toast } from "sonner";
import { TEXT_CLASSIFICATION_MODEL, NER_MODEL } from './config';

// Initialize model pipelines lazily
let classifierPromise: Promise<any> | null = null;
let nerPromise: Promise<any> | null = null;
let modelLoadStartTime: number | null = null;
let modelLoadingTimeoutId: NodeJS.Timeout | null = null;
let modelLoadingErrors: number = 0;

// Maximum number of retries before giving up
const MAX_MODEL_LOAD_RETRIES = 2;

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

// Helper function to handle model loading errors and provide fallback
const handleModelLoadingError = (error: any, modelType: string) => {
  clearModelLoadingTimeout();
  modelLoadingErrors++;
  
  console.error(`Error loading ${modelType} model:`, error);
  
  // If we've tried too many times, show toast and continue without AI
  if (modelLoadingErrors >= MAX_MODEL_LOAD_RETRIES) {
    toast.error(`Unable to load AI models. Processing without AI enhancement.`);
    return null;
  }
  
  // Show toast with retry information
  toast.error(`Error loading ${modelType} model. Will try again.`);
  
  // Return null to indicate failure but allow retries
  return null;
};

// Helper function to load the text classification model with fallbacks
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
          modelLoadingErrors = 0; // Reset error count on success
          return model;
        });
      
      // Race the pipeline and timeout promises
      classifierPromise = Promise.race([pipelinePromise, timeoutPromise])
        .catch(error => {
          // Handle specific JSON parsing errors that indicate network issues
          if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
            console.error('Network error loading classification model. The API might be unavailable.');
            toast.error('Unable to connect to AI model server. Processing without AI enhancement.');
            classifierPromise = null;
            return null;
          }
          
          const result = handleModelLoadingError(error, 'classification');
          classifierPromise = null; // Reset so we can try again
          return result;
        });
    } catch (error) {
      console.error('Error initializing classification model pipeline:', error);
      toast.error('Failed to initialize model pipeline');
      classifierPromise = null; // Reset so we can try again
      return null;
    }
  }
  return classifierPromise;
};

// Helper function to load the named entity recognition model with fallbacks
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
          modelLoadingErrors = 0; // Reset error count on success
          return model;
        });
      
      // Race the pipeline and timeout promises
      nerPromise = Promise.race([pipelinePromise, timeoutPromise])
        .catch(error => {
          // Handle specific JSON parsing errors that indicate network issues
          if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
            console.error('Network error loading NER model. The API might be unavailable.');
            toast.error('Unable to connect to AI model server. Processing without AI enhancement.');
            nerPromise = null;
            return null;
          }
          
          const result = handleModelLoadingError(error, 'NER');
          nerPromise = null; // Reset so we can try again
          return result;
        });
    } catch (error) {
      console.error('Error initializing NER model pipeline:', error);
      toast.error('Failed to initialize NER pipeline');
      nerPromise = null; // Reset so we can try again
      return null;
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
  modelLoadingErrors = 0;
  console.log('Model loading state has been reset');
};

// Function to check if we've had too many errors and should skip AI
export const shouldSkipAI = () => {
  return modelLoadingErrors >= MAX_MODEL_LOAD_RETRIES;
};
