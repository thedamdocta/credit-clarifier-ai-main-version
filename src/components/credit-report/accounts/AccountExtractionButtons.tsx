
import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Upload, Crop } from "lucide-react";

interface AccountExtractionButtonsProps {
  isProcessing: boolean;
  onExtract: () => void;
  onUpload: () => void;
}

const AccountExtractionButtons: React.FC<AccountExtractionButtonsProps> = ({
  isProcessing,
  onExtract,
  onUpload
}) => {
  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onExtract}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Extraction
            </>
          )}
        </Button>
        
        <Button
          variant="default"
          size="sm"
          onClick={onUpload}
          disabled={isProcessing}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload Better PDF
        </Button>
      </div>
      
      {isProcessing && (
        <p className="text-xs text-muted-foreground">
          Extracting account data...
        </p>
      )}
    </div>
  );
};

export default AccountExtractionButtons;
