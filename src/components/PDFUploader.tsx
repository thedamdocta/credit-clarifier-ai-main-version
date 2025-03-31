
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileUp, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCreditReport } from "@/lib/creditReportParser";

interface PDFUploaderProps {
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  isProcessing: boolean;
  useAI: boolean;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ onPDFUploaded, isProcessing, useAI }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processPDF = async (file: File) => {
    try {
      setCurrentFile(file);
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + 5;
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 100);

      // Load the PDF.js library dynamically
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      
      // Read the PDF file
      const fileReader = new FileReader();
      
      fileReader.onload = async function() {
        const typedarray = new Uint8Array(this.result as ArrayBuffer);
        
        try {
          // Load the PDF document
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          
          // Extract text from all pages
          let extractedText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items
              .map((item: any) => item.str)
              .join(' ');
            extractedText += pageText + ' ';
          }
          
          // Show appropriate processing toast
          if (useAI) {
            toast.info("Processing with AI analysis...");
          } else {
            toast.info("Processing credit report...");
          }
          
          // Parse the report with or without AI-first approach
          try {
            const parsedReport = await parseCreditReport(extractedText, useAI);
            
            clearInterval(progressInterval);
            setUploadProgress(100);

            // Pass the extracted text, file, and parsed report to the parent component
            onPDFUploaded(file, extractedText, parsedReport);
            
            if (useAI) {
              toast.success("PDF successfully processed with AI analysis!");
            } else {
              toast.success("PDF successfully processed!");
            }
          } catch (error) {
            console.error("Error in processing:", error);
            // Fall back to basic processing
            onPDFUploaded(file, extractedText);
            toast.success("PDF processed (analysis unavailable)");
          }
          
          // Reset progress after a delay
          setTimeout(() => {
            setUploadProgress(0);
          }, 1000);
          
        } catch (error) {
          console.error("Error processing PDF:", error);
          toast.error("Failed to process PDF. Please try another file.");
          clearInterval(progressInterval);
          setUploadProgress(0);
        }
      };

      fileReader.onerror = () => {
        toast.error("Error reading the file.");
        clearInterval(progressInterval);
        setUploadProgress(0);
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error in PDF processing:", error);
      toast.error("An error occurred while processing the PDF.");
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        processPDF(file);
      } else {
        toast.error("Please upload a PDF file.");
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processPDF(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        className={cn(
          "pdf-drop-area flex flex-col items-center justify-center",
          isDragging && "active"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept=".pdf"
          className="hidden"
          disabled={isProcessing}
        />
        
        {currentFile && uploadProgress > 0 ? (
          <div className="w-full space-y-4">
            <div className="flex items-center space-x-3">
              <File className="h-10 w-10 text-credit-blue" />
              <div className="flex-1">
                <p className="text-sm font-medium">{currentFile.name}</p>
                <p className="text-xs text-muted-foreground">{Math.round(currentFile.size / 1024)} KB</p>
              </div>
            </div>
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {uploadProgress < 100 ? 
                (useAI ? "Processing PDF with AI..." : "Processing PDF...") : 
                "PDF processed successfully!"}
            </p>
          </div>
        ) : (
          <>
            <Upload className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Upload Credit Report PDF</h3>
            <p className="text-muted-foreground text-sm mt-2 mb-4 text-center">
              Drag & drop your credit report PDF here, or click to browse
            </p>
            <Button 
              onClick={triggerFileInput} 
              disabled={isProcessing}
              className="mt-2"
            >
              <FileUp className="mr-2 h-4 w-4" />
              Select PDF
            </Button>
            <div className="mt-4 text-xs text-muted-foreground">
              Supports PDF files from Equifax, Experian, and TransUnion
              {useAI && " with AI analysis"}
            </div>
          </>
        )}
      </div>
    </div>
  );

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        processPDF(file);
      } else {
        toast.error("Please upload a PDF file.");
      }
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processPDF(e.target.files[0]);
    }
  }

  function triggerFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }
};

export default PDFUploader;
