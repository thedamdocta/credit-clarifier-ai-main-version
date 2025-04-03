import React, { useState, useEffect } from "react";
import PDFUploader from "@/components/PDFUploader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Settings, AlertCircle, RefreshCw } from "lucide-react";
import { CreditReport } from "@/lib/creditReportParser";
import CreditReportHeader from "@/components/CreditReportHeader";
import PersonalInfoCard from "@/components/PersonalInfoCard";
import AccountsList from "@/components/AccountsList";
import WebhookManager from "@/components/WebhookManager";
import { useToast } from "@/hooks/use-toast";
import EquifaxCreditReport from "@/components/EquifaxCreditReport";
import ParsingDebugger from "@/components/ParsingDebugger";
import { canUseOpenAI } from "@/lib/ai/openai/openaiService";

const Index = () => {
  const [creditReport, setCreditReport] = useState<CreditReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [showDebugger, setShowDebugger] = useState(false);
  const [openAIConfigured, setOpenAIConfigured] = useState(canUseOpenAI());
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    setOpenAIConfigured(canUseOpenAI());
  }, []);
  
  const handleTabChange = (value: string) => {
    // Prevent switching to the report tab if we're still processing
    if (value === "report" && isProcessing) {
      toast({
        title: "Still processing",
        description: "Please wait for the PDF processing to complete.",
        variant: "default"
      });
      return;
    }
    
    // Only allow switching to report tab if we have a report or processing is complete
    if (value === "report" && !creditReport && !processingComplete) {
      toast({
        title: "No report available", 
        description: "Please upload a credit report first.",
        variant: "default"
      });
      return;
    }
    
    setActiveTab(value);
  };
  
  const handlePDFUploaded = async (file: File, text: string, parsedReport?: CreditReport) => {
    try {
      setProcessingError(null);
      
      if (parsedReport) {
        // Store the parsed report
        setCreditReport(parsedReport);
        
        toast({
          title: "Credit Report Processed",
          description: parsedReport.bureau ? 
            `Successfully processed your ${parsedReport.bureau} credit report.` :
            `Successfully processed your credit report.`,
        });
      } else {
        toast({
          title: "Using basic parsing",
          description: "Using simplified extraction.",
        });
      }
    } catch (error) {
      console.error("Error processing credit report:", error);
      setProcessingError("Failed to process the credit report. Please try again.");
      toast({
        title: "Processing Error",
        description: "There was an error processing your credit report.",
        variant: "destructive",
      });
    }
  };

  const handleProcessingComplete = () => {
    setProcessingComplete(true);
    // Now that we're completely done, switch to the report tab
    setActiveTab("report");
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex justify-between items-center mb-6">
          <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
            <TabsTrigger value="upload" className="flex items-center">
              <Upload className="mr-2 h-4 w-4" />
              Upload PDF
            </TabsTrigger>
            <TabsTrigger 
              value="report" 
              disabled={!creditReport || isProcessing} 
              className="flex items-center"
            >
              <FileText className="mr-2 h-4 w-4" />
              Report {isProcessing && <span className="ml-1">Processing...</span>}
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              Webhooks
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Refresh
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowDebugger(!showDebugger)}
              className="text-xs"
            >
              {showDebugger ? "Hide Debugger" : "Show Debugger"}
            </Button>
          </div>
        </div>
        
        <TabsContent value="upload" className="mt-0">
          <div className="grid gap-6">
            {processingError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Processing Error</AlertTitle>
                <AlertDescription>
                  {processingError}
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRefresh}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Refresh Page
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle>Upload Credit Report</CardTitle>
                <CardDescription>
                  Upload a credit report PDF from Equifax, Experian, or TransUnion
                  {openAIConfigured && (
                    <span className="ml-1 text-green-600">• AI-powered extraction enabled</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PDFUploader 
                  onPDFUploaded={handlePDFUploaded}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                  onProcessingComplete={handleProcessingComplete}
                />
              </CardContent>
            </Card>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Privacy Note</AlertTitle>
              <AlertDescription>
                Your credit report data is processed locally in your browser and is never stored on our servers.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>
        
        <TabsContent value="report" className="mt-0">
          {creditReport ? (
            <div className="space-y-6">
              <CreditReportHeader report={creditReport} />
              
              {creditReport.bureau === 'Equifax' ? (
                <EquifaxCreditReport report={creditReport} />
              ) : (
                <>
                  <div className="grid gap-6 md:grid-cols-1">
                    <PersonalInfoCard personalInfo={creditReport.personalInfo} />
                  </div>
                  
                  <AccountsList accounts={creditReport.accounts} />
                </>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Report Available</h3>
                <p className="text-muted-foreground text-center mb-6">
                  Upload a credit report PDF to see the analyzed results
                </p>
                <Button onClick={() => setActiveTab("upload")}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Credit Report
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="webhooks" className="mt-0">
          <WebhookManager 
            creditReport={creditReport}
            isProcessing={isProcessing}
          />
        </TabsContent>
      </Tabs>
      
      {showDebugger && <ParsingDebugger isVisible={true} />}
    </>
  );
};

export default Index;
