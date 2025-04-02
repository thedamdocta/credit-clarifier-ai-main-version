
// PDF document loading functionality
import { toast } from "sonner";

// Maximum file size that triggers a warning (in MB)
const LARGE_FILE_THRESHOLD = 40;

// Function to read a file as an ArrayBuffer with Promise and timeout protection
export async function readFileAsArrayBuffer(file: File): Promise<Uint8Array> {
  // For extremely large files, show an immediate warning
  if (file.size > 100 * 1024 * 1024) { // 100MB
    toast.warning("This file is very large and may take a while to process", { duration: 8000 });
  }
  
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    
    // Add timeout to prevent freezing on large files
    const timeout = setTimeout(() => {
      fileReader.abort();
      reject(new Error("File reading timed out - file may be too large"));
    }, 90000); // 90 second timeout for very large files
    
    // Add progress tracking for large files
    if (file.size > 20 * 1024 * 1024) { // 20MB
      fileReader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          if (percent % 20 === 0) { // Log every 20%
            console.log(`Reading file: ${percent}% complete`);
            
            // Yield to UI thread on progress updates
            setTimeout(() => {}, 0);
          }
        }
      };
    }
    
    fileReader.onload = function() {
      clearTimeout(timeout);
      resolve(new Uint8Array(this.result as ArrayBuffer));
    };
    
    fileReader.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Error reading the file."));
    };
    
    // For larger files, use a different strategy to avoid blocking the UI
    if (file.size > 50 * 1024 * 1024) { // 50MB
      // Give the browser a moment to prepare
      setTimeout(() => {
        fileReader.readAsArrayBuffer(file);
      }, 100);
    } else {
      fileReader.readAsArrayBuffer(file);
    }
  });
}

// Function to load a PDF document from array buffer with timeout protection
export async function loadPdfDocument(
  typedarray: Uint8Array, 
  fileSizeMB: number
): Promise<any> {
  // Add another delay to prevent UI freezing before heavy PDF parsing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  try {
    // Dynamically load PDF.js library
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    // Optimized loading options for very large PDFs
    const loadingOptions = {
      data: typedarray,
      // For very large PDFs, use additional optimization options
      ...(fileSizeMB > 50 ? { 
        disableFontFace: true,
        nativeImageDecoderSupport: 'none',
        ignoreErrors: true,
        isEvalSupported: false,
        cMapPacked: false
      } : {})
    };
    
    // Create a more responsive loading process with yields to the UI thread
    const loadingPromise = pdfjsLib.getDocument(loadingOptions).promise;
    
    // For very large PDFs, add progress monitoring
    if (fileSizeMB > 50) {
      const startTime = Date.now();
      
      // Check progress every second without blocking UI
      const progressChecker = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed % 5 === 0) { // Log every 5 seconds
          console.log(`PDF loading in progress: ${elapsed}s elapsed`);
          
          // For very long loads, show reassurance toast
          if (elapsed === 30) {
            toast.info("Still loading large PDF, please wait...", { duration: 5000 });
          }
        }
      }, 1000);
      
      try {
        const result = await Promise.race([
          loadingPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("PDF loading timeout")), 120000)) // 2 minute timeout
        ]);
        clearInterval(progressChecker);
        return result;
      } catch (error) {
        clearInterval(progressChecker);
        throw error;
      }
    } else {
      // For smaller files, use a simpler approach
      return await Promise.race([
        loadingPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("PDF loading timeout")), 60000)) // 1 minute timeout
      ]);
    }
  } catch (error) {
    console.error("Error loading PDF:", error);
    throw error;
  }
}

// Function to check if a file is large and show a warning if needed
export function checkFileSizeAndWarn(file: File): number {
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > LARGE_FILE_THRESHOLD) {
    console.log(`Large PDF detected (${fileSizeMB.toFixed(1)}MB). Optimizing processing...`);
    toast.info(`Large PDF detected (${fileSizeMB.toFixed(1)}MB). Processing might take longer.`, {
      duration: 5000,
    });
  }
  return fileSizeMB;
}
