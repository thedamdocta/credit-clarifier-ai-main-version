
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { usePDFUpload } from "@/hooks/usePDFUpload";
import PDFUploadPlaceholder from "./PDFUploadPlaceholder";
import PDFProgressDisplay from "./PDFProgressDisplay";
import ExtractionProcessLog from "./credit-report/ExtractionProcessLog";

interface PDFUploaderProps {
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  isProcessing: boolean;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ onPDFUploaded, isProcessing: parentIsProcessing }) => {
  const [showProcessLog, setShowProcessLog] = useState(false);
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

  // Show process log when processing starts
  React.useEffect(() => {
    if (combinedIsProcessing) {
      setShowProcessLog(true);
    }
  }, [combinedIsProcessing]);

  return (
    <div className="w-full max-w-3xl mx-auto">
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
      
      {/* Always show process log when processing is active */}
      {(showProcessLog || combinedIsProcessing) && (
        <ExtractionProcessLog isVisible={true} />
      )}
    </div>
  );
};

export default PDFUploader;
