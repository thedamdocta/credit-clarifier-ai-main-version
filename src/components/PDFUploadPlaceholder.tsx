
import React from "react";
import { Button } from "@/components/ui/button";
import { FileUp, Upload, Brain } from "lucide-react";
import { OpenAIConfigForm, canUseOpenAI } from "@/lib/ai/openai/openaiService";

interface PDFUploadPlaceholderProps {
  triggerFileInput: () => void;
  isProcessing: boolean;
}

const PDFUploadPlaceholder: React.FC<PDFUploadPlaceholderProps> = ({
  triggerFileInput,
  isProcessing
}) => {
  const [showOpenAIConfig, setShowOpenAIConfig] = React.useState(false);
  
  return (
    <>
      <Upload className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">Upload Credit Report PDF</h3>
      <p className="text-muted-foreground text-sm mt-2 mb-4 text-center">
        Drag & drop your credit report PDF here, or click to browse
      </p>
      
      <div className="flex gap-3">
        <Button 
          onClick={triggerFileInput} 
          disabled={isProcessing}
        >
          <FileUp className="mr-2 h-4 w-4" />
          Select PDF
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setShowOpenAIConfig(!showOpenAIConfig)}
        >
          <Brain className="mr-2 h-4 w-4" />
          Configure API
        </Button>
      </div>
      
      {showOpenAIConfig && (
        <div className="mt-4 p-4 border rounded-md bg-slate-50">
          <h4 className="text-sm font-medium mb-2">OpenAI API Configuration</h4>
          <OpenAIConfigForm />
        </div>
      )}
      
      <div className="mt-4 text-xs text-muted-foreground">
        Supports PDF files from Equifax, Experian, and TransUnion
      </div>
    </>
  );
};

export default PDFUploadPlaceholder;
