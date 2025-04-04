
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { CreditReport } from "@/lib/types/creditReport";
import InquiriesHeader from "./InquiriesHeader";
import InquiriesList from "./InquiriesList";
import CollapsibleCard from "../common/CollapsibleCard";

interface InquiriesComponentProps {
  report: CreditReport;
}

const InquiriesComponent: React.FC<InquiriesComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleRetryExtraction = () => {
    setIsProcessing(true);
    toast.info("Retrying inquiries extraction...");
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      toast.success("Inquiries extraction completed");
    }, 1500);
  };
  
  const handleTrainParser = () => {
    toast.info("Training parser with current inquiries data...");
    // Add training logic here in the future
  };
  
  const triggerPdfUpload = () => {
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    } else {
      toast.warning("PDF upload button not found. Please use the upload button in the navigation bar.");
    }
  };

  // Default empty inquiries if none exist in the report
  const hardInquiries = report.inquiries && report.inquiries.filter(inq => inq.type === 'hard') || [];
  const softInquiries = report.inquiries && report.inquiries.filter(inq => inq.type === 'soft') || [];
  
  const header = (
    <div className="flex flex-row items-center justify-between w-full">
      <InquiriesHeader 
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
        This section shows all inquiries found in your credit report, including hard inquiries that may impact your credit score and soft inquiries which don't affect your score.
      </p>
      
      {isProcessing ? (
        <div className="py-8 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 text-credit-blue animate-spin mb-4" />
          <p className="text-sm font-medium">
            Extracting inquiries data...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Please wait while we analyze your inquiry records
          </p>
        </div>
      ) : (
        <InquiriesList 
          hardInquiries={hardInquiries}
          softInquiries={softInquiries}
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

export default InquiriesComponent;
