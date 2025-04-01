
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import CreditAccountsHeader from "./accounts/CreditAccountsHeader";
import CreditAccountsDebug from "./accounts/CreditAccountsDebug";
import CreditAccountsTable from "./accounts/CreditAccountsTable";
import { Button } from "@/components/ui/button";
import { Image, RefreshCw } from "lucide-react";
import { extractTableFromImage, convertTableToAccountSummaries } from "@/lib/ai/tableExtraction";
import { toast } from "sonner";
import { extractCreditAccountsTableImage } from "@/utils/pdf/extractText";

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
  
  // Enhanced table extraction with AI
  const handleEnhancedExtraction = async () => {
    try {
      setIsProcessing(true);
      toast.info("Using enhanced AI to extract account data...");
      
      // Get the table image
      const tableImageUrl = await extractCreditAccountsTableImage(null);
      
      if (!tableImageUrl) {
        toast.error("Could not find account table image");
        setIsProcessing(false);
        return;
      }
      
      // Extract table data using our enhanced multi-AI approach
      const tableData = await extractTableFromImage(tableImageUrl);
      
      if (tableData) {
        // Convert to account summaries
        const extractedSummaries = convertTableToAccountSummaries(tableData);
        
        // Update the state
        createOrderedAccountSummaries(extractedSummaries);
        
        toast.success("Enhanced AI extraction complete!");
      } else {
        toast.error("AI extraction could not detect table structure");
      }
    } catch (error) {
      console.error("Error during enhanced extraction:", error);
      toast.error("AI extraction failed");
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
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleEnhancedExtraction}
            disabled={isProcessing}
            className="flex items-center text-xs"
          >
            {isProcessing ? (
              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Image className="mr-1 h-3 w-3" />
            )}
            {isProcessing ? "Processing..." : "Enhance With AI"}
          </Button>
        </div>
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
