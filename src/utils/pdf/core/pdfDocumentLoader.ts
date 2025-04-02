
// PDF document loading functionality
import { toast } from "sonner";

// Maximum file size that triggers a warning (in MB)
const LARGE_FILE_THRESHOLD = 40; // Increased from 20 to 40 MB

// Function to read a file as an ArrayBuffer with Promise and timeout protection
export async function readFileAsArrayBuffer(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    
    // Add timeout to prevent freezing on large files
    const timeout = setTimeout(() => {
      fileReader.abort();
      reject(new Error("File reading timed out - file may be too large"));
    }, 90000); // Increased from 60s to 90s for larger files
    
    fileReader.onload = function() {
      clearTimeout(timeout);
      resolve(new Uint8Array(this.result as ArrayBuffer));
    };
    
    fileReader.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Error reading the file."));
    };
    
    fileReader.readAsArrayBuffer(file);
  });
}

// Function to load a PDF document from array buffer with timeout protection
export async function loadPdfDocument(
  typedarray: Uint8Array, 
  fileSizeMB: number
): Promise<any> {
  // Add another delay to prevent UI freezing before heavy PDF parsing
  await new Promise(resolve => setTimeout(resolve, 50));
  
  try {
    // Dynamically load PDF.js library
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    // Optimized loading options for very large PDFs
    const loadingOptions = {
      data: typedarray,
      // For very large PDFs, use additional optimization options
      ...(fileSizeMB > 100 ? { 
        workerPort: null, 
        cMapPacked: false,
        disableFontFace: true
      } : {})
    };
    
    // Wrap the PDF loading in a promise with a timeout
    return await Promise.race([
      pdfjsLib.getDocument(loadingOptions).promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("PDF loading timeout")), 120000)) // Increased to 120s
    ]);
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
