
import React from "react";
import { Code, Image } from "lucide-react";
import { AccountSummary } from "@/lib/types/creditReport";

interface CreditAccountsDebugProps {
  accountSummaries: any[];
  tableImageUrl?: string | null;
}

const CreditAccountsDebug: React.FC<CreditAccountsDebugProps> = ({ accountSummaries, tableImageUrl }) => {
  // Utility function to check if a cell value exists
  const hasValue = (value: any): boolean => {
    return value !== undefined && value !== null && value !== '';
  };
  
  return (
    <div className="mb-4 p-3 bg-muted/30 rounded-md text-sm">
      <h4 className="font-medium flex items-center mb-2">
        <Code className="h-4 w-4 mr-1" />
        Debug Information
      </h4>
      <div className="space-y-2 text-xs">
        <p>Number of account summaries: {accountSummaries.length}</p>
        <p>Account types present: {accountSummaries.filter(s => hasValue(s.open) || hasValue(s.totalBalance)).map(s => s.accountType).join(', ')}</p>
        
        {tableImageUrl && (
          <div className="mt-2">
            <p className="flex items-center mb-1">
              <Image className="h-4 w-4 mr-1" />
              Table Image:
            </p>
            <div className="border rounded-md overflow-hidden">
              <img 
                src={tableImageUrl} 
                alt="Extracted account table" 
                className="w-full h-auto"
              />
            </div>
          </div>
        )}
        
        <p>Raw data sample:</p>
        <pre className="overflow-auto max-h-32 p-2 bg-muted text-[10px]">
          {JSON.stringify(accountSummaries, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default CreditAccountsDebug;
