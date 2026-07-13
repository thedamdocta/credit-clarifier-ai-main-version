import React, { useState, useEffect, useRef } from "react";
import PDFUploader from "@/components/PDFUploader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Settings, AlertCircle, RefreshCw, Code, FilePenLine } from "lucide-react";
import { CreditReport } from "@/lib/creditReportParser";
import CreditReportHeader from "@/components/CreditReportHeader";
import PersonalInfoCard from "@/components/PersonalInfoCard";
import AccountsList from "@/components/AccountsList";
import WebhookManager from "@/components/WebhookManager";
import { useToast } from "@/hooks/use-toast";
import EquifaxCreditReport from "@/components/EquifaxCreditReport";
import EquifaxNewCreditReport from "@/components/EquifaxNewCreditReport";
import ExperianCreditReport from "@/components/ExperianCreditReport";
import TransUnionCreditReport from "@/components/TransUnionCreditReport";
import ParsingDebugger from "@/components/ParsingDebugger";
import { NodeEditor } from "@/features/node-editor/components/NodeEditor";
import { cleanupReportSession } from "@/lib/api/equifaxSessionClient";
import DisputeLetterWorkflow from "@/features/dispute-letters/components/DisputeLetterWorkflow";
import { devDiagnostics } from "@/lib/security/devDiagnostics";

const Index = () => {
  const [creditReport, setCreditReport] = useState<CreditReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [showDebugger, setShowDebugger] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const { toast } = useToast();
  const lastAnnouncedReportIdRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  
  const handleTabChange = (value: string) => {
    if (value === "report" && isProcessing) {
      toast({
        title: "Still processing",
        description: "Please wait for the PDF processing to complete.",
        variant: "default"
      });
      return;
    }
    
    if (value === "report" && !creditReport) {
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
        setCreditReport(parsedReport);
      } else {
        toast({
          title: "Using basic parsing",
          description: "Using simplified extraction.",
        });
      }
    } catch (error) {
      devDiagnostics.error("Error processing credit report:", error);
      setProcessingError("Failed to process the credit report. Please try again.");
      toast({
        title: "Processing Error",
        description: "There was an error processing your credit report.",
        variant: "destructive",
      });
    }
  };

  const handleProcessingComplete = () => {
    setIsProcessing(false);
  };
  
  useEffect(() => {
    if (creditReport && !isProcessing) {
      const reportIdentity = creditReport.reportId ?? creditReport.fileName ?? "report";
      if (lastAnnouncedReportIdRef.current === reportIdentity) {
        return;
      }
      lastAnnouncedReportIdRef.current = reportIdentity;
      setActiveTab("report");
      toast({
        title: "Credit Report Ready",
        description: creditReport.bureau
          ? `Your ${creditReport.bureau} credit report is ready to view.`
          : "Your credit report is ready to view.",
      });
    }
  }, [creditReport, isProcessing, toast]);

  useEffect(() => {
      const nextSessionId = creditReport?.sourceSessionId ?? null;
      const previousSessionId = activeSessionIdRef.current;
      if (previousSessionId && previousSessionId !== nextSessionId) {
      void cleanupReportSession(previousSessionId);
      }
    activeSessionIdRef.current = nextSessionId;
  }, [creditReport?.sourceSessionId]);

  useEffect(() => {
    return () => {
      const sessionId = activeSessionIdRef.current;
      if (sessionId) {
        void cleanupReportSession(sessionId, true);
      }
    };
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex justify-between items-center mb-6">
          <TabsList className="grid w-full grid-cols-5 md:w-[620px]">
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
            <TabsTrigger
              value="dispute"
              disabled={!creditReport || isProcessing}
              className="flex items-center"
            >
              <FilePenLine className="mr-2 h-4 w-4" />
              Dispute Letter
            </TabsTrigger>
            <TabsTrigger value="developer" className="flex items-center">
              <Code className="mr-2 h-4 w-4" />
              Developer
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
                Your credit report is processed by a local backend session on this machine. Session data follows the configured retention policy and can be deleted via session cleanup.
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>
        
        <TabsContent value="report" className="mt-0">
          {creditReport ? (
            <div className="space-y-6">
              <CreditReportHeader report={creditReport} />
              
              {creditReport.profileId === 'equifax_new_v1' ? (
                <EquifaxNewCreditReport report={creditReport} />
              ) : creditReport.profileId === 'equifax_old_v1' ? (
                <EquifaxCreditReport report={creditReport} />
              ) : creditReport.profileId === 'experian_acr_v1' || creditReport.bureau === 'Experian' ? (
                <ExperianCreditReport report={creditReport} />
              ) : creditReport.profileId === 'transunion_acr_v1' || creditReport.bureau === 'TransUnion' ? (
                <TransUnionCreditReport report={creditReport} />
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

        <TabsContent value="dispute" className="mt-0">
          {creditReport ? (
            <DisputeLetterWorkflow report={creditReport} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No report available</CardTitle>
                <CardDescription>Upload and process a credit report before building a dispute letter.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="mt-0">
          <WebhookManager
            creditReport={creditReport}
            isProcessing={isProcessing}
          />
        </TabsContent>

        <TabsContent value="developer" className="mt-0 h-screen">
          <div className="h-[calc(100vh-120px)]">
            <NodeEditor />
          </div>
        </TabsContent>
      </Tabs>

      {showDebugger && <ParsingDebugger isVisible={true} />}
    </>
  );
};

export default Index;
