
import React, { useState } from "react";
import PDFUploader from "@/components/PDFUploader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Settings, AlertCircle, Brain } from "lucide-react";
import { CreditReport } from "@/lib/creditReportParser";
import CreditReportHeader from "@/components/CreditReportHeader";
import CreditScoreDisplay from "@/components/CreditScoreDisplay";
import PersonalInfoCard from "@/components/PersonalInfoCard";
import AccountsList from "@/components/AccountsList";
import WebhookManager from "@/components/WebhookManager";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [creditReport, setCreditReport] = useState<CreditReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const { toast } = useToast();
  
  const handlePDFUploaded = async (file: File, text: string, parsedReport?: CreditReport) => {
    try {
      setIsProcessing(true);
      
      if (parsedReport) {
        setCreditReport(parsedReport);
      } else {
        toast({
          title: "Using basic parsing",
          description: "AI-enhanced parsing unavailable. Using simplified extraction.",
        });
      }
      
      toast({
        title: "Credit Report Processed",
        description: isAIEnabled && parsedReport ? 
          `Successfully processed your ${parsedReport.bureau} credit report with AI analysis.` :
          `Successfully processed your credit report.`,
      });
      
      setActiveTab("report");
      
    } catch (error) {
      console.error("Error processing credit report:", error);
      toast({
        title: "Processing Error",
        description: "There was an error processing your credit report.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 md:w-[400px] mb-6">
        <TabsTrigger value="upload" className="flex items-center">
          <Upload className="mr-2 h-4 w-4" />
          Upload PDF
        </TabsTrigger>
        <TabsTrigger value="report" disabled={!creditReport} className="flex items-center">
          <FileText className="mr-2 h-4 w-4" />
          Report
        </TabsTrigger>
        <TabsTrigger value="webhooks" className="flex items-center">
          <Settings className="mr-2 h-4 w-4" />
          Webhooks
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="upload" className="mt-0">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Credit Report</CardTitle>
              <CardDescription>
                Upload a credit report PDF from Equifax, Experian, or TransUnion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center justify-end">
                <div className="flex items-center space-x-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="text-sm">AI-First Analysis</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isAIEnabled}
                      onChange={() => setIsAIEnabled(!isAIEnabled)}
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
              <PDFUploader 
                onPDFUploaded={handlePDFUploaded}
                isProcessing={isProcessing}
                useAI={isAIEnabled}
              />
            </CardContent>
          </Card>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Privacy Note</AlertTitle>
            <AlertDescription>
              Your credit report data is processed locally in your browser and is never stored on our servers.
              {isAIEnabled && " AI analysis is performed entirely on your device for maximum privacy."}
            </AlertDescription>
          </Alert>
          
          {creditReport && (
            <div className="flex justify-center">
              <Button onClick={() => setActiveTab("report")}>
                <FileText className="mr-2 h-4 w-4" />
                View Processed Report
              </Button>
            </div>
          )}
        </div>
      </TabsContent>
      
      <TabsContent value="report" className="mt-0">
        {creditReport ? (
          <div className="space-y-6">
            <CreditReportHeader report={creditReport} />
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <CreditScoreDisplay scores={creditReport.creditScores} />
              </div>
              <div>
                <PersonalInfoCard personalInfo={creditReport.personalInfo} />
              </div>
            </div>
            
            <AccountsList accounts={creditReport.accounts} />
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
  );
};

export default Index;
