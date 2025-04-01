
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import CreditAccountsHeader from "./accounts/CreditAccountsHeader";
import CreditAccountsDebug from "./accounts/CreditAccountsDebug";
import CreditAccountsTable from "./accounts/CreditAccountsTable";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { toast } from "sonner";
import { extractCreditAccountsTableImage } from "@/utils/pdf/extractText";
import { Loader2 } from "lucide-react";

interface EnhancedCreditAccountsProps {
  report: CreditReport;
}

const EnhancedCreditAccounts: React.FC<EnhancedCreditAccountsProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([]);
  
  // Required account types in order
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Set up initial account summaries
  useEffect(() => {
    if (report.accountSummaries && report.accountSummaries.length > 0) {
      createOrderedAccountSummaries(report.accountSummaries);
    } else {
      // Auto-trigger enhanced extraction if no account summaries exist
      handleEnhancedExtraction();
    }
  }, [report]);
  
  // Create properly ordered account summaries with empty values for missing types
  const createOrderedAccountSummaries = (sourceSummaries: AccountSummary[]) => {
    const orderedSummaries: AccountSummary[] = [];
    
    // First create a map of existing account summaries by type
    const summariesByType = new Map<string, AccountSummary>();
    
    if (sourceSummaries && sourceSummaries.length > 0) {
      sourceSummaries.forEach(summary => {
        if (summary.accountType) {
          // Preserve all existing data including null values
          summariesByType.set(summary.accountType, { ...summary });
        }
      });
    }
    
    // Then create our final list in the required order, creating empty entries for missing types
    requiredAccountTypes.forEach(accountType => {
      const existingSummary = summariesByType.get(accountType);
      
      if (existingSummary) {
        orderedSummaries.push(existingSummary);
      } else {
        // Create default entry with null values for missing account types
        orderedSummaries.push({
          accountType,
          totalAccounts: null,
          open: null,
          closed: null,
          balance: null,
          withBalance: null,
          totalBalance: null,
          available: null,
          creditLimit: null,
          debtToCredit: null,
          payment: null
        });
      }
    });
    
    setAccountSummaries(orderedSummaries);
  };
  
  // Enhanced table extraction - now with better error handling and retry option
  const handleEnhancedExtraction = async () => {
    try {
      setIsProcessing(true);
      toast.info("Extracting credit account data...");
      
      // Get the table image
      const tableImageUrl = await extractCreditAccountsTableImage(null);
      
      if (!tableImageUrl) {
        toast.error("Could not process account table data");
        setIsProcessing(false);
        return;
      }
      
      // Extract table data using our enhanced approach
      const tableData = await extractTableFromImage(tableImageUrl);
      
      if (tableData && tableData.rows && tableData.rows.length > 0) {
        // Convert to account summaries
        const extractedSummaries = convertTableToAccountSummaries(tableData);
        
        if (extractedSummaries.length > 0) {
          toast.success("Successfully extracted account data");
          // Update the state
          createOrderedAccountSummaries(extractedSummaries);
        } else {
          toast.error("Failed to extract valid account data");
        }
      } else {
        toast.error("Could not process table structure");
      }
    } catch (error) {
      console.error("Error during extraction:", error);
      toast.error("Data extraction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CreditAccountsHeader 
          showDebugInfo={showDebugInfo} 
          toggleDebug={() => setShowDebugInfo(!showDebugInfo)} 
        />
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleEnhancedExtraction}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>Retry Extraction</>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Your credit report includes information about activity on your credit accounts that may affect your credit score and rating.</p>
        
        {showDebugInfo && <CreditAccountsDebug accountSummaries={report.accountSummaries || []} />}
        
        <CreditAccountsTable accountSummaries={accountSummaries} />
      </CardContent>
    </Card>
  );
};

export default EnhancedCreditAccounts;
