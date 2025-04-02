
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePDFUpload } from "@/hooks/usePDFUpload";
import PDFUploadPlaceholder from "./PDFUploadPlaceholder";
import PDFProgressDisplay from "./PDFProgressDisplay";
import ExtractionProcessLog from "./credit-report/ExtractionProcessLog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info, CheckCircle, Settings } from "lucide-react";
import { isModelLoading, getModelLoadingDuration, loadedModels } from "@/lib/ai/modelPipelines";
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
  const [modelsReady, setModelsReady] = useState(false);
  const [hasShownLargeFileWarning, setHasShownLargeFileWarning] = useState(false);
  const [useAI, setUseAI] = useState(false); // Disabled by default for better performance
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
    useAI, // Pass the AI toggle state
    useImageExtraction // Pass image extraction toggle state
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
        // After 3 seconds, hide the startup info if it was showing
        if (showStartupInfo) {
          setTimeout(() => setShowStartupInfo(false), 3000);
        }
      }
    };
    
    // Only check if AI is enabled
    if (useAI) {
      // Check initially
      checkIfModelLoading();
      
      // And then every 3 seconds (reduced from every 2s)
      const interval = setInterval(checkIfModelLoading, 3000);
      return () => clearInterval(interval);
    }
  }, [showStartupInfo, useAI]);

  // Show process log when processing starts
  React.useEffect(() => {
    if (combinedIsProcessing) {
      setShowProcessLog(true);
      
      // Show large file warning if current file is large
      if (currentFile && currentFile.size > 15 * 1024 * 1024 && !hasShownLargeFileWarning) { // Reduced from 20MB to 15MB
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
      currentFile.size > 15 * 1024 * 1024 // Reduced from 20MB to 15MB
    );
  };

  // Toggle performance mode
  const togglePerformanceMode = (checked: boolean) => {
    setUseAI(!checked);
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
              <Label htmlFor="performance-mode">Performance Mode</Label>
              <p className="text-xs text-muted-foreground">
                Disable AI features for faster processing
              </p>
            </div>
            <Switch
              id="performance-mode"
              checked={!useAI}
              onCheckedChange={togglePerformanceMode}
            />
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
          
          <Alert variant="default" className="bg-blue-50 border-blue-200 py-2">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-xs text-blue-800">
              Performance mode is recommended for large PDF files.
            </AlertDescription>
          </Alert>
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
      
      {showStartupInfo && useAI && (
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
                  Consider enabling Performance Mode for faster processing.
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
            This is a large PDF file. Processing may take several minutes.
            Consider enabling Performance Mode in settings for faster processing.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Always show process log when processing is active, or if it was previously shown */}
      <ExtractionProcessLog isVisible={combinedIsProcessing || showProcessLog} />
    </div>
  );
};

export default PDFUploader;
