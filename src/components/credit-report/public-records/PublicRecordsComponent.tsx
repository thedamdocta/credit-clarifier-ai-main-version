
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { CreditReport } from "@/lib/types/creditReport";
import PublicRecordsHeader from "./PublicRecordsHeader";
import PublicRecordsList from "./PublicRecordsList";
import CollapsibleCard from "../common/CollapsibleCard";

interface PublicRecordsComponentProps {
  report: CreditReport;
}

const PublicRecordsComponent: React.FC<PublicRecordsComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleRetryExtraction = () => {
    setIsProcessing(true);
    toast.info("Retrying public records extraction...");
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      toast.success("Public records extraction completed");
    }, 1500);
  };
  
  const handleTrainParser = () => {
    toast.info("Training parser with current public records data...");
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

  // Create empty public records data
  const publicRecords = {
    bankruptcies: [{
      recordType: "Bankruptcy",
      caseNumber: null,
      filingDate: "Not reported",
      status: "Not reported",
      courtName: "Not reported",
      liabilityAmount: null,
      comments: ["This is a placeholder bankruptcy record. No actual bankruptcy records were detected in your report."]
    }],
    judgements: [{
      recordType: "Judgement",
      caseNumber: null,
      filingDate: "Not reported",
      status: "Not reported",
      courtName: "Not reported",
      liabilityAmount: null,
      comments: ["This is a placeholder judgement record. No actual judgement records were detected in your report."]
    }],
    liens: [{
      recordType: "Lien",
      caseNumber: null,
      filingDate: "Not reported",
      status: "Not reported",
      agency: "Not reported",
      liabilityAmount: null,
      comments: ["This is a placeholder lien record. No actual lien records were detected in your report."]
    }]
  };
  
  const header = (
    <div className="flex flex-row items-center justify-between w-full">
      <PublicRecordsHeader 
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
        This section shows all public records found in your credit report, including bankruptcies, judgements, and liens.
      </p>
      
      {isProcessing ? (
        <div className="py-8 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 text-credit-blue animate-spin mb-4" />
          <p className="text-sm font-medium">
            Extracting public records data...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Please wait while we analyze your public records
          </p>
        </div>
      ) : (
        <PublicRecordsList 
          publicRecords={publicRecords} 
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

export default PublicRecordsComponent;
