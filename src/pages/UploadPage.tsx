import React from "react";
import { AlertCircle, ArrowRight, Globe, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PDFUploader from "@/components/PDFUploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DossierEmptyState,
  DossierMetaStack,
  DossierPageHeader,
  DossierSection,
  DossierSectionHeader,
} from "@/components/dossier/DossierPrimitives";
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";

const UploadPage = () => {
  const navigate = useNavigate();
  const {
    creditReport,
    environmentLabel,
    handlePDFUploaded,
    handleProcessingComplete,
    isProcessing,
    processingError,
    refreshApp,
    reportReference,
    setIsProcessing,
  } = useReportWorkspace();

  return (
    <div className="dossier-page">
      <DossierPageHeader
        compact
        eyebrow="Dashboard / Intake"
        title="Upload Credit Report"
        subtitle="Process Equifax, Experian, and TransUnion PDFs through the existing extraction pipeline, now presented in a cleaner dossier workspace."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="dossier-button" onClick={() => navigate("/acquire")}>
              <Globe className="h-4 w-4" />
              Get Reports
            </Button>
            <Button type="button" variant="outline" className="dossier-button" onClick={refreshApp}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {creditReport ? (
              <Button type="button" className="dossier-button dossier-button-primary" onClick={() => navigate("/report")}>
                View Report
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        }
      />

      <DossierSection>
        <DossierSectionHeader
          title="Processing Intake"
          description="The upload, session, polling, cleanup, and mapped report payload behavior are unchanged. This page only reframes the intake flow."
        />

        {processingError ? (
          <Alert variant="destructive" className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Processing Error</AlertTitle>
            <AlertDescription>{processingError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_380px]">
          <div className="dossier-upload-panel">
            <PDFUploader
              onPDFUploaded={handlePDFUploaded}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              onProcessingComplete={handleProcessingComplete}
            />
          </div>

          <aside className="dossier-side-panel">
            <div className="space-y-6">
              <div className="dossier-side-block">
                <div className="dossier-side-title">
                  <UploadCloud className="h-4 w-4" />
                  Current Session
                </div>
                <DossierMetaStack
                  rows={[
                    { label: "Report Reference", value: reportReference },
                    { label: "Environment", value: environmentLabel },
                    {
                      label: "Status",
                      value: processingError
                        ? "Processing blocked"
                        : isProcessing
                          ? "Processing"
                          : creditReport
                            ? "Ready"
                            : "Waiting for upload",
                    },
                  ]}
                />
              </div>

              <div className="dossier-side-block">
                <div className="dossier-side-title">
                  <ShieldCheck className="h-4 w-4" />
                  Privacy Note
                </div>
                <p className="text-sm leading-7 text-slate-600">
                  Your report is processed by the existing local backend session flow on this machine. Session cleanup,
                  retention, and API behavior remain unchanged.
                </p>
              </div>

              <div className="dossier-side-block">
                <div className="dossier-side-title">
                  <Globe className="h-4 w-4" />
                  Need to fetch reports first?
                </div>
                <p className="text-sm leading-7 text-slate-600">
                  Use the guided retrieval screen to open AnnualCreditReport.com in headed incognito mode, download all
                  three PDFs, and import them back into this extractor.
                </p>
                <div className="mt-4">
                  <Button type="button" variant="outline" className="dossier-button" onClick={() => navigate("/acquire")}>
                    Open Guided Retrieval
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </DossierSection>

      {creditReport ? (
        <DossierSection className="border-b-0">
          <DossierSectionHeader
            title="Ready for Review"
            description="A processed report is active in the workspace. Continue into the redesigned report dossier or move directly into dispute drafting."
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" className="dossier-button dossier-button-primary" onClick={() => navigate("/report")}>
              Open Report View
            </Button>
            <Button type="button" variant="outline" className="dossier-button" onClick={() => navigate("/dispute")}>
              Open Dispute Letter
            </Button>
          </div>
        </DossierSection>
      ) : (
        <DossierSection className="border-b-0">
          <DossierEmptyState
            title="A cleaner intake flow"
            description="Once a PDF is uploaded, the app will keep using the same extraction pipeline and mapped report payload. The redesign only changes the presentation and page structure."
          />
        </DossierSection>
      )}
    </div>
  );
};

export default UploadPage;
