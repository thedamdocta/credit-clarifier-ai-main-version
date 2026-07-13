import React from "react";
import { ArrowRight, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DossierReportView from "@/components/dossier/DossierReportView";
import { DossierEmptyState, DossierPageHeader, DossierSection } from "@/components/dossier/DossierPrimitives";
import { Button } from "@/components/ui/button";
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";

const ReportPage = () => {
  const navigate = useNavigate();
  const { creditReport, refreshApp } = useReportWorkspace();

  if (!creditReport) {
    return (
      <div className="dossier-page">
        <DossierPageHeader
          compact
          eyebrow="Reports"
          title="Credit Report"
          subtitle="The report dossier becomes active once a PDF is processed through the existing extraction flow."
        />
        <DossierSection className="border-b-0">
          <DossierEmptyState
            title="No report available"
            description="Upload and process a credit report first. The redesigned report page preserves the existing report and source PDF utilities once data is available."
            action={
              <div className="flex flex-wrap gap-3">
                <Button type="button" className="dossier-button dossier-button-primary" onClick={() => navigate("/upload")}>
                  Upload Credit Report
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" className="dossier-button" onClick={() => navigate("/settings")}>
                  <Settings2 className="h-4 w-4" />
                  Open Settings
                </Button>
              </div>
            }
          />
        </DossierSection>
      </div>
    );
  }

  return (
    <DossierReportView
      report={creditReport}
      onRefresh={refreshApp}
      onOpenSettings={() => navigate("/settings")}
      onDownload={() => undefined}
    />
  );
};

export default ReportPage;
