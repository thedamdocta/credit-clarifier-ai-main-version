
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
        <div className="flex justify-between items-center w-full">
          <AlertDescription>
            We couldn't extract account data from your credit report. Try uploading a clearer PDF with the account summary table clearly visible.
          </AlertDescription>
          {onRequestUpload && (
            <Button variant="destructive" size="sm" onClick={onRequestUpload} className="ml-4">
              <Upload className="h-4 w-4 mr-2" />
              Upload Better PDF
            </Button>
          )}
        </div>
      </Alert>
    );
  }
  
  if (usingSampleData) {
    return (
      <Alert variant="warning" className="mb-4 bg-amber-50 text-amber-800 border-amber-200">
        <AlertCircle className="h-4 w-4" />
        <div className="flex justify-between items-center w-full">
          <AlertDescription>
            Using sample data. Upload a clearer credit report or table image to see your actual data.
          </AlertDescription>
          {onRequestUpload && (
            <Button variant="outline" size="sm" onClick={onRequestUpload} className="ml-4 border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200">
              <Upload className="h-4 w-4 mr-2" />
              Upload Better PDF
            </Button>
          )}
        </div>
      </Alert>
    );
  }
  
  return null;
};

export default AccountDataAlerts;
