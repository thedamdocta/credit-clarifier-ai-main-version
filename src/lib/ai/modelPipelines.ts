
// Empty model pipelines file to prevent any AI model loading
export const skipAIProcessing = true;

// Function stubs to prevent errors
export const isModelLoading = (): boolean => false;
export const getModelLoadingDuration = (): number => 0;
export const shouldSkipAI = (): boolean => true;
export const resetModelLoadingState = (): void => {};
export const resetSkipAIFlag = (): void => {};
export const getNER = async () => null;
export const getTextClassifier = async () => null;
export const preloadAIModels = async (): Promise<void> => {};

// Empty declarations for type compatibility
export const loadedModels = {
  ner: false,
  classifier: false
};

// Global declaration for cached models
declare global {
  interface Window {
    __cachedNERModel: any;
    __cachedClassifierModel: any;
    gc?: () => void;
  }
  
  interface Navigator {
    gpu?: {
      requestAdapter: () => Promise<any>;
    }
    deviceMemory?: number;
  }
  
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    }
  }
}
