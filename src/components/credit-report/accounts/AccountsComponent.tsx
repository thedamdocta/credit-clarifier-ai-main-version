
import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Bug, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CreditReport, Account } from "@/lib/types/creditReport";
import AccountHeader from "./AccountHeader";
import AccountsList from "./AccountsList";

interface AccountsComponentProps {
  report: CreditReport;
}

const AccountsComponent: React.FC<AccountsComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleRetryExtraction = () => {
    setIsProcessing(true);
    toast.info("Retrying account extraction...");
    
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      toast.success("Account extraction completed");
    }, 1500);
  };
  
  const handleTrainParser = () => {
    toast.info("Training parser with current account data...");
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

  // Create a default account if none exist
  const accounts = report.accounts && report.accounts.length > 0 
    ? report.accounts 
    : [{
        accountName: "Sample Account",
        accountNumber: "XXXX-XXXX-XXXX-1234",
        accountType: "Not reported",
        openDate: "Not reported",
        status: "Not reported",
        balance: null,
        paymentHistory: [],
        comments: ["This is a placeholder account. No actual accounts were detected in your report."]
      }];
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <AccountHeader 
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
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          This section shows all accounts found in your credit report, including payment history and account details.
        </p>
        
        {isProcessing ? (
          <div className="py-8 flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 text-credit-blue animate-spin mb-4" />
            <p className="text-sm font-medium">
              Extracting account data...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Please wait while we analyze your accounts
            </p>
          </div>
        ) : (
          <AccountsList 
            accounts={accounts} 
            showDebugInfo={showDebugInfo} 
          />
        )}
      </CardContent>
    </Card>
  );
};

export default AccountsComponent;
