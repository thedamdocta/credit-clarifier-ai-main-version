import React, { useEffect, useMemo, useRef } from "react";
import { ArrowRight, Bug, Cable, Settings2, Workflow } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import WebhookManager from "@/components/WebhookManager";
import ParsingDebugger from "@/components/ParsingDebugger";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DossierPageHeader, DossierSection, DossierSectionHeader } from "@/components/dossier/DossierPrimitives";
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";
import { NodeEditor } from "@/features/node-editor/components/NodeEditor";

const settingsSections = [
  { key: "integrations", label: "Integrations", icon: Cable },
  { key: "diagnostics", label: "Diagnostics", icon: Bug },
  { key: "developer", label: "Developer Tools", icon: Workflow },
] as const;

const SettingsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { creditReport, isProcessing, advancedUiEnabled, setAdvancedUiEnabled } = useReportWorkspace();
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const activeSection = useMemo(() => {
    const requested = searchParams.get("section");
    return settingsSections.find((section) => section.key === requested)?.key ?? "integrations";
  }, [searchParams]);

  useEffect(() => {
    const element = sectionRefs.current[activeSection];
    if (!element) {
      return;
    }

    window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [activeSection]);

  const jumpToSection = (section: (typeof settingsSections)[number]["key"]) => {
    setSearchParams({ section });
  };

  return (
    <div className="dossier-page">
      <DossierPageHeader
        compact
        eyebrow="Settings"
        title="Operational Tools"
        subtitle="Advanced integrations, diagnostics, and developer tooling have been moved out of the core workflow. Their underlying behavior is unchanged."
        actions={
          creditReport ? (
            <Button type="button" className="dossier-button dossier-button-primary" onClick={() => navigate("/report")}>
              Return to Report
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null
        }
      />

      <DossierSection>
        <DossierSectionHeader
          title="Section Index"
          description="The utilities below keep the same capabilities as before; they are simply consolidated here so the primary workflow stays focused."
        />
        <div className="dossier-settings-nav">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.key}
                type="button"
                className={activeSection === section.key ? "dossier-settings-link active" : "dossier-settings-link"}
                onClick={() => jumpToSection(section.key)}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </div>
        <div className="mt-6 rounded-lg border border-black/15 bg-black/[0.02] px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="font-display text-xl tracking-[-0.03em] text-slate-900">Advanced UI Visibility</h3>
              <p className="text-sm text-slate-600">
                Controls whether developer-facing surfaces like inline debug toggles and raw JSON are exposed in the main application.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
                {advancedUiEnabled ? "Visible" : "Hidden"}
              </span>
              <Switch checked={advancedUiEnabled} onCheckedChange={setAdvancedUiEnabled} aria-label="Toggle advanced UI visibility" />
            </div>
          </div>
        </div>
      </DossierSection>

      <DossierSection className="dossier-settings-section">
        <div
          ref={(element) => {
            sectionRefs.current.integrations = element;
          }}
        >
          <DossierSectionHeader
            title="Integrations"
            description="Existing inbound and outbound webhook behavior, URLs, and send actions are preserved."
          />
          <WebhookManager creditReport={creditReport} isProcessing={isProcessing} />
        </div>
      </DossierSection>

      <DossierSection className="dossier-settings-section">
        <div
          ref={(element) => {
            sectionRefs.current.diagnostics = element;
          }}
        >
          <DossierSectionHeader
            title="Diagnostics"
            description="The parser debugger remains available for monitoring report extraction and validation details."
          />
          <div className="dossier-embedded-surface">
            <ParsingDebugger renderFloatingTrigger={false} />
          </div>
        </div>
      </DossierSection>

      <DossierSection className="border-b-0 dossier-settings-section">
        <div
          ref={(element) => {
            sectionRefs.current.developer = element;
          }}
        >
          <DossierSectionHeader
            title="Developer Tools"
            description="The node editor and pipeline tooling keep the same execution, save, import, and export behavior."
          />
          <div className="dossier-developer-surface">
            <NodeEditor className="h-[78vh] min-h-[820px]" />
          </div>
        </div>
      </DossierSection>
    </div>
  );
};

export default SettingsPage;
