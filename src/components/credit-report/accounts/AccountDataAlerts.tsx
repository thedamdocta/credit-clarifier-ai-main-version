
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface AccountDataAlertsProps {
  extractionFailed: boolean;
  usingSampleData: boolean;
  onRequestUpload?: () => void;
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
        <AlertDescription className="flex items-center justify-between">
          <span>We couldn't extract account data from your credit report. Try uploading a clearer PDF with the account summary table clearly visible.</span>
          {onRequestUpload && (
            <Button variant="outline" size="sm" className="ml-4 bg-white" onClick={onRequestUpload}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Better PDF
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  
  if (usingSampleData) {
    return (
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Showing sample account data because we couldn't extract actual data from your PDF.</span>
          {onRequestUpload && (
            <Button variant="outline" size="sm" className="ml-4" onClick={onRequestUpload}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Better PDF
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  
  return null;
};

export default AccountDataAlerts;
