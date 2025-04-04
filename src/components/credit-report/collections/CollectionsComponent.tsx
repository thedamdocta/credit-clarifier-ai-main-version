
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { CreditReport, Collection } from "@/lib/types/creditReport";
import CollectionsHeader from "./CollectionsHeader";
import CollectionsList from "./CollectionsList";
import CollapsibleCard from "../common/CollapsibleCard";

interface CollectionsComponentProps {
  report: CreditReport;
}

const CollectionsComponent: React.FC<CollectionsComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleRetryExtraction = () => {
    setIsProcessing(true);
    toast.info("Retrying collections extraction...");
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      toast.success("Collections extraction completed");
    }, 1500);
  };
  
  const handleTrainParser = () => {
    toast.info("Training parser with current collections data...");
    // Add training logic here
  };
  
  const triggerPdfUpload = () => {
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    } else {
      toast.warning("PDF upload button not found. Please use the upload button in the navigation bar.");
    }
  };

  // Use collections if they exist, otherwise an empty array
  const collections = report.collections && report.collections.length > 0 
    ? report.collections 
    : [];
  
  const pdfAvailable = report && report.rawText && report.rawText.length > 0;
  
  const header = (
    <div className="flex flex-row items-center justify-between w-full">
      <CollectionsHeader 
        showDebugInfo={showDebugInfo} 
        toggleDebug={() => setShowDebugInfo(!showDebugInfo)} 
      />
      
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetryExtraction}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry Extraction
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={triggerPdfUpload}
          disabled={isProcessing}
        >
          <Upload className="h-4 w-4 mr-1" />
          Upload Better PDF
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrainParser}
          disabled={isProcessing}
        >
          <Save className="h-4 w-4 mr-1" />
          Train Parser
        </Button>
      </div>
    </div>
  );

  const content = (
    <>
      <p className="mb-4">
        This section shows all collection accounts found in your credit report, including agency information and collection details.
      </p>
      
      {!pdfAvailable && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700">
            No PDF data available. Please upload a credit report PDF to view collection accounts.
          </p>
        </div>
      )}
      
      {isProcessing ? (
        <div className="py-8 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 text-credit-blue animate-spin mb-4" />
          <p className="text-sm font-medium">
            Extracting collection data...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Please wait while we analyze your collection accounts
          </p>
        </div>
      ) : (
        <CollectionsList 
          collections={collections} 
          showDebugInfo={showDebugInfo} 
        />
      )}
    </>
  );
  
  return (
    <CollapsibleCard header={header}>
      {content}
    </CollapsibleCard>
  );
};

export default CollectionsComponent;
