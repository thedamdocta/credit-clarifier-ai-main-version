
import { pipeline, type ProgressCallback, type PretrainedOptions } from '@huggingface/transformers';
import { toast } from 'sonner';

// Model loading status tracking
let modelLoadingInProgress = false;
let modelLoadingStartTime: number | null = null;
let skipAIProcessing = false;
let preloadingInitiated = false;

// Track which models are loaded to prevent redundant loading
const loadedModels = {
  ner: false,
  classifier: false
};

// Get model loading status
export const isModelLoading = (): boolean => modelLoadingInProgress;
export const getModelLoadingDuration = (): number => {
  return modelLoadingStartTime ? Math.floor((Date.now() - modelLoadingStartTime) / 1000) : 0;
};
export const shouldSkipAI = (): boolean => skipAIProcessing;
export const resetModelLoadingState = (): void => {
  modelLoadingInProgress = false;
  modelLoadingStartTime = null;
  // Don't reset skipAIProcessing here - it should persist
};

// Reset skip AI flag - added to allow retrying AI after failures
export const resetSkipAIFlag = (): void => {
  skipAIProcessing = false;
  console.log("AI processing has been re-enabled");
};

// Web Worker detection
const supportsWebWorker = typeof window !== 'undefined' && typeof Worker !== 'undefined';

// Central function to manage model loading
const manageModelLoading = async (modelType: string, loadFn: () => Promise<any>, isPreloading = false): Promise<any | null> => {
  // If we've decided to skip AI, return null immediately
  if (skipAIProcessing && !isPreloading) {
    console.log(`Skipping ${modelType} model loading due to previous errors`);
    return null;
  }

  // Check if model is already loaded
  if (modelType === 'ner' && loadedModels.ner) {
    console.log(`${modelType} model already loaded, reusing`);
    return window.__cachedNERModel;
  } else if (modelType === 'classifier' && loadedModels.classifier) {
    console.log(`${modelType} model already loaded, reusing`);
    return window.__cachedClassifierModel;
  }

  // Set loading status (don't show UI indicators if preloading)
  if (!modelLoadingInProgress) {
    modelLoadingInProgress = true;
    modelLoadingStartTime = Date.now();
    console.log(`${isPreloading ? 'Preloading' : 'Loading'} ${modelType} model...`);
  } else {
    console.log(`Another model is ${isPreloading ? 'preloading' : 'loading'}, will load ${modelType} after completion`);
    if (!isPreloading) {
      return null; // Don't queue up multiple actual loads, let the caller retry later
    }
  }

  try {
    // Yield to UI thread before heavy computation
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Set timeout to prevent UI from being blocked for too long
    const loadTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.error(`${modelType} model loading timed out after 60s`);
        reject(new Error(`${modelType} model loading timed out`));
      }, 60000); // 60 second timeout
    });

    // Load the model with timeout
    const model = await Promise.race([loadFn(), loadTimeoutPromise]);
    console.log(`${modelType} model loaded successfully after ${getModelLoadingDuration()} seconds`);
    
    // Mark this model as loaded
    if (modelType === 'ner') {
      loadedModels.ner = true;
      if (window) window.__cachedNERModel = model;
    } else if (modelType === 'classifier') {
      loadedModels.classifier = true;
      if (window) window.__cachedClassifierModel = model;
    }
    
    return model;
  } catch (error) {
    console.error(`Error loading ${modelType} model:`, error);
    if (!isPreloading) {
      skipAIProcessing = true; // Skip future AI processing if loading fails but only for actual processing, not preloading
      
      // Show a toast when model loading fails during actual processing
      toast.error(`Failed to load AI model. Using simplified processing instead. Try refreshing the page to retry.`, {
        duration: 8000,
      });
    } else {
      console.log(`Model preloading failed for ${modelType}, will try again during actual processing`);
    }
    
    return null;
  } finally {
    modelLoadingInProgress = false;
    modelLoadingStartTime = null;
  }
};

// Custom progress callback to handle the new interface
const createProgressCallback = (): ProgressCallback => {
  return (info) => {
    // Access the progress value safely using type narrowing
    if ('status' in info && info.status === 'progress') {
      const progress = ('value' in info && typeof info.value === 'number') ? info.value : 0;
      console.log(`Model loading progress: ${Math.round(progress * 100)}%`);
      
      // Yield to main thread every few progress updates to keep UI responsive
      if (Math.round(progress * 100) % 10 === 0) {
        setTimeout(() => {}, 0);
      }
    }
  };
};

// Load Named Entity Recognition (NER) model
export const getNER = async (isPreloading = false) => {
  console.log(isPreloading ? "Preloading NER model..." : "Getting NER model...");
  return manageModelLoading('ner', async () => {
    console.log(isPreloading ? "Preloading NER model..." : "Loading NER model...");
    try {
      // Yield to UI before starting model load
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const options: PretrainedOptions = {
        progress_callback: createProgressCallback(),
        // Use CPU instead of GPU for better stability across browsers
        // This can be important for preventing browser freezes
      };
      
      return await pipeline('token-classification', 'Xenova/distilbert-base-cased-finetuned-conll03-english', options);
    } catch (error) {
      console.error("Unable to connect to AI model for NER:", error);
      return null;
    }
  }, isPreloading);
};

// Load text classification model
export const getTextClassifier = async (isPreloading = false) => {
  console.log(isPreloading ? "Preloading text classifier model..." : "Getting text classifier model...");
  return manageModelLoading('classifier', async () => {
    console.log(isPreloading ? "Preloading text classification model..." : "Loading text classification model...");
    try {
      // Yield to UI before starting model load
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const options: PretrainedOptions = {
        progress_callback: createProgressCallback(),
        // Use CPU instead of GPU for better stability across browsers
      };
      
      return await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', options);
    } catch (error) {
      console.error("Unable to connect to AI model for text classification:", error);
      return null;
    }
  }, isPreloading);
};

// Preload models function - can be called early in the app lifecycle
export const preloadAIModels = async (): Promise<void> => {
  if (preloadingInitiated) {
    console.log("AI model preloading already initiated, skipping");
    return;
  }

  preloadingInitiated = true;
  console.log("Starting AI model preloading");

  try {
    // Start preloading the models in the background
    // Use a slight delay to allow the app to initialize first
    setTimeout(async () => {
      try {
        // Load models in sequence to avoid overwhelming the browser
        await getNER(true);
        // Small delay between models
        await new Promise(resolve => setTimeout(resolve, 500));
        await getTextClassifier(true);
        console.log("AI model preloading completed");
      } catch (error) {
        console.error("Error during model preloading:", error);
      }
    }, 2000);
  } catch (error) {
    console.error("Failed to initialize model preloading:", error);
  }
};

// Add global declaration for cached models
declare global {
  interface Window {
    __cachedNERModel: any;
    __cachedClassifierModel: any;
    gc?: () => void;
  }
}
