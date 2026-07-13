import React from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DisputeLetterWorkflow from "@/features/dispute-letters/components/DisputeLetterWorkflow";
import { Button } from "@/components/ui/button";
import { DossierEmptyState, DossierPageHeader, DossierSection } from "@/components/dossier/DossierPrimitives";
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";
import { getReportReference } from "@/utils/reportDisplay";

const DisputePage = () => {
  const navigate = useNavigate();
  const { creditReport } = useReportWorkspace();
  const displayReportNumber = getReportReference(creditReport, "current session");

  if (!creditReport) {
    return (
      <div className="dossier-page">
        <DossierPageHeader
          compact
          eyebrow="Disputes"
          title="Dispute Letter"
          subtitle="The dispute workflow is unchanged, but it now lives inside the same dossier visual system as the rest of the app."
        />
        <DossierSection className="border-b-0">
          <DossierEmptyState
            title="No report available"
            description="Upload and process a credit report before building a dispute letter. The current dispute generation rules, editing flow, and export behavior are preserved."
            action={
              <Button type="button" className="dossier-button dossier-button-primary" onClick={() => navigate("/upload")}>
                Upload Credit Report
                <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
        </DossierSection>
      </div>
    );
  }

  return (
    <div className="dossier-page">
      <DossierPageHeader
        compact
        eyebrow="Disputes"
        title="Dispute Letter"
        subtitle={`Working against report ${displayReportNumber}.`}
      />
      <DossierSection className="border-b-0 dossier-embedded-surface">
        <DisputeLetterWorkflow report={creditReport} />
      </DossierSection>
    </div>
  );
};

export default DisputePage;
