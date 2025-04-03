
import React, { useState } from "react";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import { Loader2, Maximize2 } from "lucide-react";

interface AccountDataDebugProps {
  showDebugInfo: boolean;
  report: CreditReport;
  extractionAttempts: number;
  usingSampleData: boolean;
  tableImageUrl: string | null;
  extractionFailed: boolean;
  initialAccountDataFound: boolean;
  accountSummaries: AccountSummary[];
  isProcessing: boolean;
}

const AccountDataDebug: React.FC<AccountDataDebugProps> = ({
  showDebugInfo,
  report,
  extractionAttempts,
  usingSampleData,
  tableImageUrl,
  extractionFailed,
  initialAccountDataFound,
  accountSummaries,
  isProcessing
}) => {
  const [expandedImage, setExpandedImage] = useState(false);

  // Utility function to check if account summaries contain real data
  const hasRealData = (summaries: AccountSummary[] | undefined): boolean => {
    if (!summaries || summaries.length === 0) return false;
    
    return summaries.some(summary => 
      summary.open !== null || 
      summary.withBalance !== null || 
      summary.totalBalance !== null ||
      summary.available !== null ||
      summary.creditLimit !== null
    );
  };

  if (!showDebugInfo) {
    return null;
  }

  return (
    <div className="border rounded p-4 mt-4 bg-gray-50">
      <h4 className="text-sm font-bold mb-2">Account Data Debug Information</h4>
      
      <div className="mb-2">
        <span className="font-semibold">Report ID:</span> {report?.reportId || 'N/A'}
      </div>
      
      <div className="mb-2">
        <span className="font-semibold">Extraction Attempts:</span> {extractionAttempts}
      </div>
      
      <div className="mb-2">
        <span className="font-semibold">Using Sample Data:</span> {usingSampleData ? 'Yes' : 'No'}
      </div>
      
      <div className="mb-2">
        <span className="font-semibold">Table Image URL Available:</span> {tableImageUrl ? 'Yes' : 'No'}
      </div>
      
      {tableImageUrl && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Table Image:</span>
            <button 
              onClick={() => setExpandedImage(!expandedImage)} 
              className="text-xs flex items-center text-blue-600 hover:text-blue-800"
            >
              <Maximize2 className="h-3 w-3 mr-1" />
              {expandedImage ? "Reduce Size" : "Maximize"}
            </button>
          </div>
          <div className={expandedImage ? "border p-2 bg-white" : ""}>
            <img 
              src={tableImageUrl} 
              alt="Extracted Table" 
              className="max-w-full border rounded"
              style={{ 
                maxHeight: expandedImage ? '600px' : '300px', 
                objectFit: 'contain',
                width: expandedImage ? '100%' : 'auto'
              }}
            />
          </div>
        </div>
      )}
      
      <div className="mb-2">
        <span className="font-semibold">Extraction Failed:</span> {extractionFailed ? 'Yes' : 'No'}
      </div>
      
      <div className="mb-2">
        <span className="font-semibold">Initial Account Data Found:</span> {initialAccountDataFound ? 'Yes' : 'No'}
      </div>
      
      <div className="mb-2">
        <span className="font-semibold">Account Summaries Count:</span> {accountSummaries?.length || 0}
      </div>
      
      <div className="mb-2">
        <span className="font-semibold">Is Processing:</span> {isProcessing ? 'Yes' : 'No'}
      </div>
      
      {isProcessing && (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Extracting account data...
        </div>
      )}
      
      {/* Only show the report account summaries if they have real data */}
      {report?.accountSummaries && hasRealData(report.accountSummaries) && (
        <div className="mt-4">
          <h5 className="text-xs font-bold mb-2">Initial Report Account Data:</h5>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
            {JSON.stringify(report.accountSummaries, null, 2)}
          </pre>
        </div>
      )}
      
      {/* Always show the current account summaries */}
      {accountSummaries && accountSummaries.length > 0 && (
        <div className="mt-4">
          <h5 className="text-xs font-bold mb-2">Current Account Summaries:</h5>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
            {JSON.stringify(accountSummaries, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AccountDataDebug;
