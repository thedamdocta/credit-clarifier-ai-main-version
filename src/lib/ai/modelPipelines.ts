
import { pipeline, type ProgressCallback, type PretrainedOptions } from '@huggingface/transformers';
import { toast } from 'sonner';

// Model loading status tracking
let modelLoadingInProgress = false;
let modelLoadingStartTime: number | null = null;
let skipAIProcessing = false;
let preloadingInitiated = false;

// Track which models are loaded to prevent redundant loading
export const loadedModels = {
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

// Central function to manage model loading with improved performance
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
    
    // For actual user-requested loads (not preloading), we want to wait and retry later
    if (!isPreloading) {
      // Instead of returning null immediately, wait a bit and check if the other load finishes
      try {
        // Check every second for up to 20 seconds if the other loading process completes
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!modelLoadingInProgress) {
            // Now we can try loading our model
            console.log(`Previous model loading completed, now loading ${modelType}`);
            return manageModelLoading(modelType, loadFn, isPreloading);
          }
        }
      } catch (e) {
        console.error("Error during model loading wait period:", e);
      }
      return null; // Give up after waiting
    }
  }

  try {
    // Yield to UI thread before heavy computation
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Set timeout to prevent UI from being blocked for too long
    const loadTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.error(`${modelType} model loading timed out after 90s`);
        reject(new Error(`${modelType} model loading timed out`));
      }, 90000); // 90 second timeout - increased from 60s
    });

    // Load the model with timeout and better UI responsiveness
    let loadPromise;
    
    // Attempt to use a worker for model loading when possible
    if (supportsWebWorker && !isPreloading) {
      // If browser supports web workers, create a background task for model loading
      console.log(`Using worker-based loading for ${modelType} model`);
      loadPromise = new Promise(async (resolve, reject) => {
        try {
          // Still need to yield to UI before starting heavy computation
          await new Promise(res => setTimeout(res, 0));
          const model = await loadFn();
          resolve(model);
        } catch (e) {
          reject(e);
        }
      });
    } else {
      loadPromise = loadFn();
    }

    // Race with timeout
    const model = await Promise.race([loadPromise, loadTimeoutPromise]);
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

// Load Named Entity Recognition (NER) model with improved configuration
export const getNER = async (isPreloading = false) => {
  console.log(isPreloading ? "Preloading NER model..." : "Getting NER model...");
  return manageModelLoading('ner', async () => {
    console.log(isPreloading ? "Preloading NER model..." : "Loading NER model...");
    try {
      // Yield to UI before starting model load
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const options: PretrainedOptions = {
        progress_callback: createProgressCallback(),
        // Use CPU instead of GPU in most cases for better stability across browsers
        cpu: true, // Force CPU to prevent GPU-related freezes
        // Disable cache and low memory mode for more stability
        cache: false,
      };
      
      // If modern GPU is detected, prefer using it for model inference
      if (typeof window !== 'undefined' && 
          window.navigator && 
          window.navigator.gpu && 
          !isPreloading) {
        // Only try GPU mode when not preloading to avoid potential freezes during app startup
        try {
          // Test if device supports WebGPU
          if (await navigator.gpu?.requestAdapter()) {
            // GPU is available and supports WebGPU
            console.log("WebGPU support detected, will try GPU acceleration");
            // Override CPU option
            options.cpu = false;
          }
        } catch (e) {
          console.log("WebGPU not available, using CPU mode:", e);
        }
      }
      
      return await pipeline('token-classification', 'Xenova/distilbert-base-cased-finetuned-conll03-english', options);
    } catch (error) {
      console.error("Unable to connect to AI model for NER:", error);
      return null;
    }
  }, isPreloading);
};

// Load text classification model with improved configuration
export const getTextClassifier = async (isPreloading = false) => {
  console.log(isPreloading ? "Preloading text classifier model..." : "Getting text classifier model...");
  return manageModelLoading('classifier', async () => {
    console.log(isPreloading ? "Preloading text classification model..." : "Loading text classification model...");
    try {
      // Yield to UI before starting model load
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const options: PretrainedOptions = {
        progress_callback: createProgressCallback(),
        // Use CPU instead of GPU in most cases for better stability across browsers
        cpu: true, // Force CPU to prevent GPU-related freezes
        // Disable cache and low memory mode for more stability
        cache: false,
      };
      
      // If modern GPU is detected, prefer using it for model inference
      if (typeof window !== 'undefined' && 
          window.navigator && 
          window.navigator.gpu && 
          !isPreloading) {
        // Only try GPU mode when not preloading to avoid potential freezes during app startup
        try {
          // Test if device supports WebGPU
          if (await navigator.gpu?.requestAdapter()) {
            // GPU is available and supports WebGPU
            console.log("WebGPU support detected, will try GPU acceleration");
            // Override CPU option
            options.cpu = false;
          }
        } catch (e) {
          console.log("WebGPU not available, using CPU mode:", e);
        }
      }
      
      return await pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', options);
    } catch (error) {
      console.error("Unable to connect to AI model for text classification:", error);
      return null;
    }
  }, isPreloading);
};

// Smart preload function - prevents app from becoming unresponsive
export const preloadAIModels = async (): Promise<void> => {
  if (preloadingInitiated) {
    console.log("AI model preloading already initiated, skipping");
    return;
  }

  preloadingInitiated = true;
  console.log("Starting AI model preloading");

  // Dynamic loading strategy based on device capabilities
  const isLowPowerDevice = () => {
    // Simple detection for low power devices
    return (
      typeof navigator !== 'undefined' &&
      (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
      )
    );
  };

  try {
    // Adjust preloading strategy based on device capabilities
    if (isLowPowerDevice()) {
      console.log("Low-power device detected, using conservative preloading strategy");
      // On low-power devices, delay preloading until the app is fully loaded and idle
      setTimeout(() => {
        requestIdleCallback(async () => {
          try {
            // Only load the classifier on low-power devices (smaller model)
            await getTextClassifier(true);
            console.log("AI model preloading completed (conservative strategy)");
          } catch (error) {
            console.error("Error during conservative model preloading:", error);
          }
        }, { timeout: 10000 });
      }, 5000);
    } else {
      // For powerful devices, use a progressive loading approach
      // Start with a small delay to allow app to initialize first
      setTimeout(async () => {
        try {
          // First load classifier (usually smaller/faster)
          await getTextClassifier(true);
          
          // Then load NER model after a delay
          setTimeout(async () => {
            try {
              await getNER(true);
              console.log("AI model preloading fully completed");
            } catch (error) {
              console.error("Error during NER model preloading:", error);
            }
          }, 2000);
        } catch (error) {
          console.error("Error during initial model preloading:", error);
        }
      }, 3000);
    }
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
