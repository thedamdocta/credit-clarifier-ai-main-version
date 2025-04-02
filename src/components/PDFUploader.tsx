
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePDFUpload } from "@/hooks/usePDFUpload";
import PDFUploadPlaceholder from "./PDFUploadPlaceholder";
import PDFProgressDisplay from "./PDFProgressDisplay";
import ExtractionProcessLog from "./credit-report/ExtractionProcessLog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info, CheckCircle } from "lucide-react";
import { isModelLoading, getModelLoadingDuration, loadedModels } from "@/lib/ai/modelPipelines";

interface PDFUploaderProps {
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  isProcessing: boolean;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ onPDFUploaded, isProcessing: parentIsProcessing }) => {
  const [showProcessLog, setShowProcessLog] = useState(false);
  const [showStartupInfo, setShowStartupInfo] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [hasShownLargeFileWarning, setHasShownLargeFileWarning] = useState(false);
  
  const {
    isDragging,
    uploadProgress,
    currentFile,
    isProcessing: localIsProcessing,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    triggerFileInput
  } = usePDFUpload({ 
    onPDFUploaded, 
    useAI: true,
    useImageExtraction: true
  });
  
  // Combine both processing states
  const combinedIsProcessing = parentIsProcessing || localIsProcessing;

  // Check if we should show the AI loading warning
  useEffect(() => {
    const checkIfModelLoading = () => {
      if (isModelLoading()) {
        // Only show the startup info on first load
        if (!showStartupInfo) {
          setShowStartupInfo(true);
        }
      } else if (typeof loadedModels === 'object' && (loadedModels.ner || loadedModels.classifier)) {
        // If at least one model is loaded
        setModelsReady(true);
        // After 3 seconds, hide the startup info if it was showing (reduced from 5s)
        if (showStartupInfo) {
          setTimeout(() => setShowStartupInfo(false), 3000);
        }
      }
    };
    
    // Check initially
    checkIfModelLoading();
    
    // And then every 2 seconds (reduced from every 1s to reduce overhead)
    const interval = setInterval(checkIfModelLoading, 2000);
    return () => clearInterval(interval);
  }, [showStartupInfo]);

  // Show process log when processing starts
  React.useEffect(() => {
    if (combinedIsProcessing) {
      setShowProcessLog(true);
      
      // Show large file warning if current file is large
      if (currentFile && currentFile.size > 20 * 1024 * 1024 && !hasShownLargeFileWarning) {
        setHasShownLargeFileWarning(true);
      }
    } else {
      // Reset large file warning status when not processing
      setHasShownLargeFileWarning(false);
    }
  }, [combinedIsProcessing, currentFile]);

  // Function to determine if we should show the large file warning
  const shouldShowLargeFileWarning = () => {
    return (
      combinedIsProcessing && 
      uploadProgress >= 40 && 
      uploadProgress < 95 && 
      currentFile && 
      currentFile.size > 20 * 1024 * 1024
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {showStartupInfo && (
        <Alert variant={modelsReady ? "default" : "default"} 
               className={modelsReady ? "bg-green-50 border-green-200 mb-4" : "bg-blue-50 border-blue-200 mb-4"}>
          {modelsReady ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <Info className="h-4 w-4 text-blue-500" />
          )}
          <AlertDescription className={modelsReady ? "text-green-800" : "text-blue-800"}>
            {modelsReady ? (
              <>
                <p className="font-medium">AI models loaded successfully</p>
                <p className="text-sm">The application is ready for PDF processing with enhanced AI capabilities.</p>
              </>
            ) : (
              <>
                <p className="font-medium">AI models loading in background</p>
                <p className="text-sm">
                  AI models are being downloaded (~15-60MB) in the background. 
                  This may take 30-60 seconds, but will be faster on subsequent uses.
                </p>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      <div
        className={cn(
          "pdf-drop-area flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg",
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300",
          combinedIsProcessing && "opacity-50 cursor-not-allowed"
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
          disabled={combinedIsProcessing}
        />
        
        {currentFile && uploadProgress > 0 ? (
          <PDFProgressDisplay 
            file={currentFile} 
            progress={uploadProgress} 
          />
        ) : (
          <PDFUploadPlaceholder 
            triggerFileInput={triggerFileInput} 
            isProcessing={combinedIsProcessing}
          />
        )}
      </div>
      
      {shouldShowLargeFileWarning() && (
        <Alert variant="warning" className="bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-800">
            This is a large PDF file. Processing may take several minutes and might appear to freeze temporarily.
            Please be patient and avoid clicking during processing.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Always show process log when processing is active, or if it was previously shown */}
      <ExtractionProcessLog isVisible={combinedIsProcessing || showProcessLog} />
    </div>
  );
};

export default PDFUploader;
