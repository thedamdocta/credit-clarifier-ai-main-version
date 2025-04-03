
import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount, formatPercentageValue } from "@/utils/formatters/accountValueFormatters";
import { AlertCircle, Info, Upload, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isZeroValue, formatValueForDisplay, parseFlexibleValue, parseNumericValue, parseCurrencyValue, parsePercentageValue, trainParser } from "@/lib/ai/table/valueParser";
import useTrainingExamples from "@/hooks/useTrainingExamples";
import { canUseOpenAI } from "@/lib/ai/openai/openaiService";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
  onRequestUpload?: () => void;
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ 
  accountSummaries,
  onRequestUpload 
}) => {
  console.log("Table rendering with account summaries:", accountSummaries);
  const [stableData, setStableData] = useState<AccountSummary[]>(accountSummaries);
  const { addTrainingExamples, isTraining, examples, resetTrainingExamples } = useTrainingExamples();
  
  useEffect(() => {
    if (accountSummaries && accountSummaries.length > 0) {
      const newDataHasRealValues = accountSummaries.some(summary => 
        ((summary.open !== null && summary.open !== "" && summary.open !== "0") || 
         (summary.withBalance !== null && summary.withBalance !== "" && summary.withBalance !== "0") || 
         (summary.totalBalance !== null && summary.totalBalance !== "" && summary.totalBalance !== "$0")) &&
         summary.accountType.toLowerCase() !== "total"
      );
      
      const currentDataHasNoValues = !stableData || stableData.length === 0 || !stableData.some(summary => 
        (summary.open !== null && summary.open !== "" && summary.open !== "0") || 
        (summary.withBalance !== null && summary.withBalance !== "" && summary.withBalance !== "0") ||
        (summary.totalBalance !== null && summary.totalBalance !== "" && summary.totalBalance !== "$0")
      );
      
      if (currentDataHasNoValues || newDataHasRealValues) {
        console.log("Updating stable data with new account summaries that have real values");
        setStableData(accountSummaries);
      } else {
        console.log("Keeping existing stable data as it has better values than new data");
      }
    }
  }, [accountSummaries]);
  
  const summariesToDisplay = stableData && stableData.length > 0 ? stableData : accountSummaries;
  
  const isSampleData = false;
  
  const hasNoData = !summariesToDisplay || summariesToDisplay.length === 0 || summariesToDisplay.every(summary =>
    (summary.open === null || summary.open === "") && 
    (summary.withBalance === null || summary.withBalance === "") && 
    (summary.totalBalance === null || summary.totalBalance === "" || summary.totalBalance === "$0")
  );
  
  const renderCellValue = (fieldName: string, value: any, formatter: (value: any) => string) => {
    if (typeof value === 'string' && value.trim() !== '') {
      if ((fieldName === 'totalBalance' || fieldName === 'available' || 
          fieldName === 'creditLimit' || fieldName === 'payment') && 
          !value.includes('$') && value !== '-') {
        const parsedValue = parseCurrencyValue(value);
        if (parsedValue) {
          return formatter(parsedValue);
        }
      } else if (fieldName === 'debtToCredit' && !value.includes('%') && value !== '-') {
        const parsedValue = parsePercentageValue(value);
        if (parsedValue) {
          return formatter(parsedValue);
        }
      }
    }
    
    if (value === null || value === undefined || value === '') {
      return "-";
    }
    
    if (isZeroValue(value)) {
      if (fieldName === 'debtToCredit') return "0.0%";
      if (fieldName === 'totalBalance' || fieldName === 'available' || 
          fieldName === 'creditLimit' || fieldName === 'payment') return "$0";
      return "0";
    }
    
    return formatter(value);
  };

  const handleTrainWithCurrentData = () => {
    if (!summariesToDisplay || summariesToDisplay.length === 0) return;
    
    const validSummaries = summariesToDisplay.filter(summary => 
      (summary.open !== null && summary.open !== "") || 
      (summary.withBalance !== null && summary.withBalance !== "") ||
      (summary.totalBalance !== null && summary.totalBalance !== "")
    );
    
    if (validSummaries.length > 0) {
      console.log("Training with current displayed data:", validSummaries);
      addTrainingExamples(validSummaries);
    }
  };
  
  return (
    <div>
      {hasNoData && (
        <Alert className="mb-4 bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 flex items-center justify-between">
            <span>We couldn't extract account data from your credit report. Try uploading a clearer PDF with the account summary table clearly visible.</span>
            {onRequestUpload && (
              <Button variant="outline" size="sm" className="ml-4 bg-white" onClick={onRequestUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Better PDF
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex justify-end mb-2">
        {!hasNoData && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleTrainWithCurrentData}
            disabled={isTraining}
          >
            <Save className="h-4 w-4 mr-2" />
            {isTraining ? 'Training...' : 'Train Parser with This Data'}
          </Button>
        )}
      </div>

      {examples && examples.length > 0 && (
        <div className="mb-2 flex justify-end">
          <p className="text-xs text-muted-foreground mr-2">
            {examples.length} training examples stored
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 text-xs"
            onClick={resetTrainingExamples}
          >
            Reset
          </Button>
        </div>
      )}
      
      <Table>
        <TableHeader>
          <TableRow className="bg-muted">
            <TableHead>Account Type</TableHead>
            <TableHead>Open</TableHead>
            <TableHead>With Balance</TableHead>
            <TableHead>Total Balance</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Credit Limit</TableHead>
            <TableHead>Debt-to-Credit</TableHead>
            <TableHead>Payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summariesToDisplay.map((summary) => (
            <TableRow 
              key={`account-summary-${summary.accountType}`}
              className={summary.accountType === 'Total' ? 'bg-muted/30 font-medium' : ''}
            >
              <TableCell className="font-medium">
                {summary.accountType}
              </TableCell>
              <TableCell>{renderCellValue('open', summary.open, formatAccountValue)}</TableCell>
              <TableCell>{renderCellValue('withBalance', summary.withBalance, formatAccountValue)}</TableCell>
              <TableCell>{renderCellValue('totalBalance', summary.totalBalance, formatDollarAmount)}</TableCell>
              <TableCell>{renderCellValue('available', summary.available, formatDollarAmount)}</TableCell>
              <TableCell>{renderCellValue('creditLimit', summary.creditLimit, formatDollarAmount)}</TableCell>
              <TableCell>{renderCellValue('debtToCredit', summary.debtToCredit, formatPercentageValue)}</TableCell>
              <TableCell>{renderCellValue('payment', summary.payment, formatDollarAmount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CreditAccountsTable;
