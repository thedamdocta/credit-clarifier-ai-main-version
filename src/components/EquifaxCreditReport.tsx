import React, { useState, useEffect } from "react";
import { CreditReport } from "@/lib/types/creditReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useDebouncedValue } from "@mantine/hooks";
import { 
  CreditCard, 
  FileText, 
  Settings, 
  AlertCircle, 
  Loader2,
  Bug,
  ImagePlus,
  RefreshCw
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { OpenAIConfigForm } from "@/lib/ai/openai/openaiService";
import AccountDataDebug from "@/components/credit-report/accounts/AccountDataDebug";
import EnhancedCreditAccounts from "@/components/credit-report/accounts/EnhancedCreditAccounts";
import AccountsComponent from "@/components/AccountsList";
import DisputeInformation from "@/components/DisputeInformation";

// Import the new CollectionsComponent
import CollectionsComponent from "./credit-report/collections/CollectionsComponent";

interface EquifaxCreditReportProps {
  report: CreditReport;
  showDebugInfo: boolean;
}

const EquifaxCreditReport = ({ report, showDebugInfo }: EquifaxCreditReportProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [initialAccountDataFound, setInitialAccountDataFound] = useState(false);
  const [accountSummaries, setAccountSummaries] = useState(report?.accountSummaries || []);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [debouncedApiKey] = useDebouncedValue(apiKey, 500);
  
  useEffect(() => {
    localStorage.setItem('openai_api_key', apiKey);
  }, [debouncedApiKey]);
  
  const handleDataExtracted = (
    summaries: any, 
    usingSample: boolean, 
    failed: boolean
  ) => {
    setAccountSummaries(summaries);
    setUsingSampleData(usingSample);
    setExtractionFailed(failed);
    setExtractionAttempts(prev => prev + 1);
  };
  
  return (
    
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Equifax Credit Report</h2>
          <p className="text-muted-foreground">
            Review and manage your credit information.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(!isSettingsOpen)}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>
      
      <Accordion type="single" collapsible value={isSettingsOpen ? "settings" : ""} className="mb-4">
        <AccordionItem value="settings">
          <AccordionTrigger>Credit Report Settings</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="openai_api_key" className="text-right">
                  OpenAI API Key
                </Label>
                <div className="col-span-2">
                  <OpenAIConfigForm />
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="debug_mode" className="text-right">
                  Enable Debug Mode
                </Label>
                <div className="col-span-2 flex items-center">
                  <Switch id="debug_mode" checked={showDebugInfo} />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Show debug information for development purposes.
                  </span>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {/* Render the components in order */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList>
          <TabsTrigger value="summary">
            <FileText className="mr-2 h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <CreditCard className="mr-2 h-4 w-4" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="inquiries">
            <Search className="mr-2 h-4 w-4" />
            Inquiries
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertCircle className="mr-2 h-4 w-4" />
            Alerts
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary">
          <div className="space-y-4">
            <p>This is a summary of your credit report.</p>
            {/* Add summary content here */}
          </div>
        </TabsContent>
        
        <TabsContent value="accounts">
          {/* Account tabs section */}
          <div className="space-y-6">
            <EnhancedCreditAccounts report={report} showDebugInfo={showDebugInfo} />
            <AccountsComponent report={report} showDebugInfo={showDebugInfo} />
            
            {/* Add Collections component here - between Accounts and Dispute Information */}
            <CollectionsComponent report={report} showDebugInfo={showDebugInfo} />
            
            <DisputeInformation report={report} showDebugInfo={showDebugInfo} />
          </div>
        </TabsContent>
        
        <TabsContent value="inquiries">
          <div className="space-y-4">
            <p>This section displays recent inquiries on your credit report.</p>
            {/* Add inquiries content here */}
          </div>
        </TabsContent>
        
        <TabsContent value="alerts">
          <div className="space-y-4">
            <p>This section displays any alerts or notifications related to your credit report.</p>
            {/* Add alerts content here */}
          </div>
        </TabsContent>
      </Tabs>
      
      {showDebugInfo && (
        <AccountDataDebug
          showDebugInfo={showDebugInfo}
          report={report}
          extractionAttempts={extractionAttempts}
          usingSampleData={usingSampleData}
          tableImageUrl={tableImageUrl}
          extractionFailed={extractionFailed}
          initialAccountDataFound={initialAccountDataFound}
          accountSummaries={accountSummaries}
          isProcessing={isProcessing}
        />
      )}
    </div>
    
  );
};

export default EquifaxCreditReport;
