
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePDFUpload } from "@/hooks/usePDFUpload";
import PDFUploadPlaceholder from "./PDFUploadPlaceholder";
import PDFProgressDisplay from "./PDFProgressDisplay";
import ExtractionProcessLog from "./credit-report/ExtractionProcessLog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info, CheckCircle, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PDFUploaderProps {
  onPDFUploaded: (file: File, text: string, parsedReport?: any) => void;
  isProcessing: boolean;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ onPDFUploaded, isProcessing: parentIsProcessing }) => {
  const [showProcessLog, setShowProcessLog] = useState(false);
  const [showStartupInfo, setShowStartupInfo] = useState(false);
  const [modelsReady, setModelsReady] = useState(true); // Always set to true
  const [hasShownLargeFileWarning, setHasShownLargeFileWarning] = useState(false);
  const [useAI, setUseAI] = useState(false); // Always disabled
  const [showSettings, setShowSettings] = useState(false);
  const [useImageExtraction, setUseImageExtraction] = useState(true);
  
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
    useAI: false, // Always pass false
    useImageExtraction
  });
  
  // Combine both processing states
  const combinedIsProcessing = parentIsProcessing || localIsProcessing;

  // Show process log when processing starts
  React.useEffect(() => {
    if (combinedIsProcessing) {
      setShowProcessLog(true);
      
      // Show large file warning if current file is large
      if (currentFile && currentFile.size > 15 * 1024 * 1024 && !hasShownLargeFileWarning) {
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
      currentFile.size > 15 * 1024 * 1024
    );
  };

  // Toggle performance mode
  const togglePerformanceMode = (checked: boolean) => {
    // Do nothing - AI is always disabled
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {showSettings && (
        <div className="bg-muted/30 rounded-lg p-4 border space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium flex items-center">
              <Settings className="h-4 w-4 mr-2" /> Performance Settings
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
              Hide
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="image-extraction">Image Extraction</Label>
              <p className="text-xs text-muted-foreground">
                Extract images from PDF pages
              </p>
            </div>
            <Switch
              id="image-extraction"
              checked={useImageExtraction}
              onCheckedChange={(checked) => setUseImageExtraction(checked)}
            />
          </div>
        </div>
      )}
      
      {!showSettings && (
        <div className="flex justify-end mb-1">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="flex items-center gap-1">
            <Settings className="h-3.5 w-3.5" /> 
            <span className="text-xs">Performance Settings</span>
          </Button>
        </div>
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
            This is a large PDF file. Processing may take several minutes.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Always show process log when processing is active, or if it was previously shown */}
      <ExtractionProcessLog isVisible={combinedIsProcessing || showProcessLog} />
    </div>
  );
};

export default PDFUploader;
