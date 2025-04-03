
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Info, Upload } from "lucide-react";

interface AccountDataAlertsProps {
  extractionFailed: boolean;
  usingSampleData: boolean;
  onRequestUpload: () => void;
}

const AccountDataAlerts: React.FC<AccountDataAlertsProps> = ({
  extractionFailed,
  usingSampleData,
  onRequestUpload
}) => {
  if (!extractionFailed && !usingSampleData) return null;
  
  if (extractionFailed && !usingSampleData) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          We couldn't extract account data from your credit report. Try uploading a clearer PDF with the account summary table clearly visible.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (usingSampleData) {
    return (
      <Alert className="mb-4 bg-amber-50 border-amber-200">
        <Info className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 flex items-center justify-between">
          <span>Upload a clearer credit report PDF to see your actual account data.</span>
          <Button variant="outline" size="sm" className="ml-4 bg-white" onClick={onRequestUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Better PDF
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  
  return null;
};

export default AccountDataAlerts;
