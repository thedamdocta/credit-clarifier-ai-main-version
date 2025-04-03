
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface AccountDataAlertsProps {
  extractionFailed: boolean;
  usingSampleData: boolean;
}

const AccountDataAlerts: React.FC<AccountDataAlertsProps> = ({
  extractionFailed,
  usingSampleData
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
  
  return null;
};

export default AccountDataAlerts;
