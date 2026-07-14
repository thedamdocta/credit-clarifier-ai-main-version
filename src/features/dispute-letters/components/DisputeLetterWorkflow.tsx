import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Download, FileEdit, FileImage, FileOutput, FileSearch, FileText, Layers3, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { CreditReport } from "@/lib/types/creditReport";
import { getStrategyDemotion } from "@/features/dispute-letters/strategyProfile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { buildDefaultIntake } from "../defaults";
import { generateAccountRuleCatalog, generateDisputeReasons, generateNonAccountReasons } from "../reasonEngine";
import { buildDisputeLetterLayoutCssVariables, DISPUTE_LETTER_LAYOUT } from "../../../../shared/disputeLetterLayout.mjs";
import {
  createDisputeLetterDraft,
  exportDisputeLetterDraft,
  generateDisputeEvidence,
  getDisputeLetterDraftByRequestKey,
  generateHighlightedReportPdf,
  HighlightedReportBlockedError,
  renderDisputeLetterDraft,
  updateDisputeLetterFullDocument,
  updateDisputeLetterSection,
} from "../api";
import {
  AccountRuleCatalogGroup,
  DisputeLetterDraft,
  DisputeLetterIntake,
  DisputeReason,
  DisputeReasonCategory,
  DisputeRuleEvaluation,
  ManualAccountReason,
  ReasonGroup,
} from "../types";
import DisputeEvidenceReview from "./DisputeEvidenceReview";
import { DisputeReasonEvidencePanel } from "./DisputeReasonEvidencePanel";
import DisputeLetterPreviewFrame from "./DisputeLetterPreviewFrame";
import RichTextEditor from "./RichTextEditor";
import { buildDisputeDraftSyncKey, hashDisputeDraftRequestKey } from "../bootstrap";

// Saves an artifact through the SYSTEM save dialog (operator request: the
// user chooses where each file lands). The picker must open on a fresh user
// gesture, so it is requested BEFORE fetching the bytes; browsers without
// showSaveFilePicker (e.g. Safari) fall back to a standard download.
const saveArtifactToDisk = async (url: string, suggestedName: string): Promise<"saved" | "cancelled" | "fallback"> => {
  const picker = (window as unknown as { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<any> }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker.call(window, { suggestedName });
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "cancelled";
      // any picker/stream failure degrades to a plain browser download
    }
  }
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return "fallback";
};

type WorkflowStep = "reasons" | "intake" | "sections" | "full-letter" | "evidence" | "preview";

const STEP_ORDER: Array<{ value: WorkflowStep; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "reasons", label: "Reasons", icon: FileSearch },
  { value: "intake", label: "Intake", icon: FileText },
  { value: "sections", label: "Sections", icon: Layers3 },
  { value: "full-letter", label: "Full Letter", icon: FileEdit },
  { value: "evidence", label: "Highlighted Report", icon: FileImage },
  { value: "preview", label: "Preview / Export", icon: FileOutput },
];

const mergeReasons = (previous: DisputeReason[], next: DisputeReason[]) => {
  const previousMap = new Map(previous.map((reason) => [reason.id, reason]));
  return next.map((reason) => {
    const existing = previousMap.get(reason.id);
    if (!existing) {
      return reason;
    }
    return {
      ...reason,
      selected: typeof existing.selected === "boolean" ? existing.selected : reason.selected,
      issueLabel: existing.issueLabel,
      reasonSummary: existing.reasonSummary,
      operatorNotes: existing.operatorNotes,
    };
  });
};

const mergeAccountRuleCatalog = (previous: AccountRuleCatalogGroup[], next: AccountRuleCatalogGroup[]) => {
  const previousEntries = new Map<string, DisputeRuleEvaluation>();
  for (const group of previous) {
    for (const category of group.categories) {
      for (const entry of category.entries) {
        previousEntries.set(`${group.entityKey}:${entry.ruleId}`, entry);
      }
    }
  }

  return next.map((group) => ({
    ...group,
    categories: group.categories.map((category) => ({
      ...category,
      entries: category.entries.map((entry) => {
        const existing = previousEntries.get(`${group.entityKey}:${entry.ruleId}`);
        if (!existing) {
          return entry;
        }
        const keepSelection = entry.selectable ? existing.selected : false;
        return {
          ...entry,
          selected: keepSelection,
          explanation: existing.status === "triggered" ? existing.explanation : entry.explanation,
          operatorNotes: existing.operatorNotes ?? entry.operatorNotes,
        };
      }),
    })),
  }));
};

const formatPageList = (pages: number[]) => (pages.length ? pages.join(", ") : "Not available");

const humanizeEntityType = (value: string) => value.replace(/_/g, " ");
const humanizeReasonCategory = (value?: string) => (value ? value.replace(/_/g, " ") : "uncategorized");
const humanizeSelectionBasis = (value?: string) =>
  value === "strategy_demoted" ? "demoted by strategy" : value ? value.replace(/_/g, " ") : "";

const StrategyDemotionNote = ({ issueType, selected }: { issueType: string; selected?: boolean }) => {
  const demotion = getStrategyDemotion(issueType);
  if (!demotion) {
    return null;
  }
  return (
    <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-xs leading-5 text-slate-700">
      <span className="mr-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-slate-700">§ {demotion.claimBasis}</span>
      Detected but not recommended under the current strategy: {demotion.rationale}{" "}
      {selected ? "Manually included in this letter." : "Check the box to include it anyway."}
    </p>
  );
};
const describeNonAccountGroupSubject = (entityType: string) => {
  switch (entityType) {
    case "public_record":
      return "public record";
    case "consumer_information_indicator":
      return "consumer-information indicator";
    case "personal_information":
      return "profile item";
    default:
      return humanizeEntityType(entityType);
  }
};
const describeNonAccountGroupPosture = (entityType: string) => {
  switch (entityType) {
    case "public_record":
      return "Negative public record";
    case "consumer_information_indicator":
      return "Legal reporting item";
    case "inquiry":
      return "Inquiry item";
    default:
      return "Report item";
  }
};
const countAvailableEntries = (entries: DisputeRuleEvaluation[]) => entries.filter((entry) => entry.status === "triggered").length;
const getDefaultAccountCategory = (group: AccountRuleCatalogGroup) =>
  group.categories.find((category) => category.entries.some((entry) => entry.selected))?.category ??
  group.categories.find((category) => category.entries.some((entry) => entry.status === "triggered"))?.category ??
  group.categories[0]?.category;
const buildDefaultExpandedAccountGroups = (groups: AccountRuleCatalogGroup[]) =>
  Object.fromEntries(groups.map((group) => [group.key, false]));
const buildGroupExpansionMap = (groupKeys: string[], expanded: boolean) => Object.fromEntries(groupKeys.map((key) => [key, expanded]));
const defaultRequestedAction =
  "Please conduct a full reinvestigation and correct or delete any reporting that cannot be verified as complete and accurate.";
const describeRuleStatus = (value: DisputeRuleEvaluation["status"]) => {
  switch (value) {
    case "triggered":
      return "Available";
    case "not_triggered":
      return "Clear";
    case "insufficient_evidence":
      return "Not available";
    case "not_applicable":
      return "Not applicable";
    default:
      return value;
  }
};

const extractEvidenceValue = (reason: DisputeReason, label: string) =>
  reason.evidence?.scalarComparisons?.find((entry) => entry.label === label)?.value?.trim() ?? "";

const extractSupportingFactValue = (reason: DisputeReason, prefix: string) =>
  reason.supportingFacts.find((fact) => fact.startsWith(prefix))?.slice(prefix.length).trim() ?? "";

const describePublicRecordSubject = (reason: DisputeReason) =>
  extractEvidenceValue(reason, "Court") ||
  extractSupportingFactValue(reason, "Court: ") ||
  extractEvidenceValue(reason, "Record type") ||
  extractSupportingFactValue(reason, "Record type: ") ||
  extractEvidenceValue(reason, "Summary") ||
  "PUBLIC RECORD";

const describeReasonGroup = (reason: DisputeReason) => {
  if (reason.entityType === "account") {
    return reason.entityKey.split("::")[0].toUpperCase();
  }
  if (reason.entityType === "personal_information") {
    return "PERSONAL INFORMATION";
  }
  if (reason.entityType === "public_record") {
    return describePublicRecordSubject(reason).toUpperCase();
  }
  if (reason.entityType === "consumer_information_indicator") {
    return (
      extractEvidenceValue(reason, "Indicator description") ||
      extractSupportingFactValue(reason, "Indicator description: ") ||
      "CONSUMER INFORMATION INDICATORS"
    );
  }
  if (reason.entityType === "inquiry") {
    return "INQUIRIES";
  }
  return humanizeEntityType(reason.entityType).toUpperCase();
};

const editableSectionGroups = [
  { group: "openingRequest", title: "Opening Request" },
  { group: "reinvestigationRequest", title: "Reinvestigation Request" },
  { group: "accountDisputes", title: "Account Disputes" },
  { group: "personalInformationDisputes", title: "Personal Information Disputes" },
  { group: "recordsRequest", title: "Records Request" },
  { group: "responseInstructions", title: "Response Instructions" },
  { group: "closing", title: "Closing" },
  { group: "enclosures", title: "Enclosures" },
] as const;

const ACCOUNT_CUSTOM_REASON_CATEGORIES: Array<{ value: DisputeReasonCategory; label: string }> = [
  { value: "payment_history", label: "Payment History" },
  { value: "balance_amount", label: "Balance / Amounts" },
  { value: "charge_off_collection", label: "Collection / Charge-Off" },
  { value: "legal_public_record", label: "Legal / Public Record" },
  { value: "date_reporting_timeline", label: "Status / Dates" },
  { value: "account_identity", label: "Identity" },
];

const parsePageListInput = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[^0-9]+/)
        .map((entry) => Number.parseInt(entry, 10))
        .filter((entry) => Number.isInteger(entry) && entry > 0),
    ),
  );

const isCompleteManualAccountReason = (reason: ManualAccountReason) =>
  reason.issueLabel.trim().length > 0 && reason.reasonSummary.trim().length > 0;

const isHydratedEvidenceReady = (draft?: DisputeLetterDraft | null) => {
  if (!draft?.evidenceManifest) {
    return false;
  }
  const selectedReasonIds = new Set((draft.selectedReasons ?? []).map((reason) => String(reason.id ?? "").trim()).filter(Boolean));
  const bundleByReasonId = new Map(
    (draft.evidenceManifest.reasons ?? []).map((bundle) => [String(bundle.reasonId ?? "").trim(), bundle]),
  );

  return Array.from(selectedReasonIds).every((reasonId) => {
    const bundle = bundleByReasonId.get(reasonId);
    return Boolean(bundle) &&
      bundle.status === "ready" &&
      (bundle.slides?.length ?? 0) > 0 &&
      bundle.blockedByValidation !== true;
  });
};

// Human heading for an exhibits-manifest entityKey (client-side mirror of the
// server's formatting — account keys are "NAME::number"; indicator keys carry
// internal '::' tokens that must never display raw).
const formatExhibitEntity = (entityKey?: string | null, fallback?: string | null) => {
  const parts = String(entityKey ?? "").split("::").filter(Boolean);
  if (!parts.length) return fallback || "Report-level dispute";
  const kind = parts[0].toLowerCase();
  if (kind === "consumer_information_indicator") {
    const descriptor = parts[1] && !/^\d+$/.test(parts[1]) ? parts[1] : "";
    return descriptor ? `Consumer Information Indicator — ${descriptor}` : "Consumer Information Indicator";
  }
  if (kind === "public_record") return "Public Record";
  if (kind === "report") return "Credit Report (report-level)";
  return parts[0].toUpperCase();
};

const collectGroupSourcePages = (group: AccountRuleCatalogGroup) =>
  Array.from(new Set(group.categories.flatMap((category) => category.entries.flatMap((entry) => entry.sourcePages)))).sort((left, right) => left - right);

const AUTO_SYNC_TIMEOUT_MS = 45_000;

const RuleStatusBadge = ({ entry }: { entry: DisputeRuleEvaluation }) => {
  if (entry.status === "triggered") {
    return <span className="text-xs font-medium text-slate-900">Available</span>;
  }
  if (entry.status === "not_triggered") {
    return <span className="text-xs font-medium text-slate-600">Clear</span>;
  }
  if (entry.status === "insufficient_evidence") {
    return <span className="text-xs font-medium text-slate-600">Not available</span>;
  }
  if (entry.status === "not_applicable") {
    return <span className="text-xs font-medium text-slate-600">Not applicable</span>;
  }
  return <span className="text-xs font-medium text-slate-600">Not available</span>;
};

const fullDocumentLayoutStyle = buildDisputeLetterLayoutCssVariables() as React.CSSProperties;

const updateIntakeField = <K extends keyof DisputeLetterIntake>(
  intake: DisputeLetterIntake,
  key: K,
  value: DisputeLetterIntake[K],
) => ({
  ...intake,
  [key]: value,
});

export default function DisputeLetterWorkflow({ report }: { report: CreditReport }) {
  const [activeStep, setActiveStep] = useState<WorkflowStep>("reasons");
  const [intake, setIntake] = useState<DisputeLetterIntake>(() => buildDefaultIntake(report));
  const [accountRuleCatalog, setAccountRuleCatalog] = useState<AccountRuleCatalogGroup[]>(() => generateAccountRuleCatalog(report));
  const [nonAccountReasons, setNonAccountReasons] = useState<DisputeReason[]>(() => generateNonAccountReasons(report, buildDefaultIntake(report)));
  const [customAccountReasons, setCustomAccountReasons] = useState<ManualAccountReason[]>([]);
  const [expandedAccountGroups, setExpandedAccountGroups] = useState<Record<string, boolean>>(() =>
    buildDefaultExpandedAccountGroups(generateAccountRuleCatalog(report)),
  );
  const [expandedNonAccountGroups, setExpandedNonAccountGroups] = useState<Record<string, boolean>>({});
  const [expandedNotApplicableGroups, setExpandedNotApplicableGroups] = useState<Record<string, boolean>>({});
  const [isEscalationExpanded, setIsEscalationExpanded] = useState(false);
  const [lastAutoDraftSyncKey, setLastAutoDraftSyncKey] = useState<string | null>(null);
  const [lastAutoEvidenceDraftId, setLastAutoEvidenceDraftId] = useState<string | null>(null);
  const [isAutoSyncPending, setIsAutoSyncPending] = useState(false);
  const [draft, setDraft] = useState<DisputeLetterDraft | null>(null);
  const [evidenceSelection, setEvidenceSelection] = useState({
    inlineExhibits: false,
    memorandum: false,
    highlightedReport: false,
  });
  const [exhibitNumbering, setExhibitNumbering] = useState<"numeric" | "alpha">("numeric");
  const syncedEvidenceDraftId = useRef<string | null>(null);
  // Accounts-covered summary for the memorandum preview (operator: "preview
  // and approve what accounts are on the memorandum").
  const memorandumCoverage = useMemo(() => {
    const exhibits = draft?.exhibitsManifest?.exhibits;
    if (!Array.isArray(exhibits) || !exhibits.length) {
      return [] as { label: string; exhibits: string[] }[];
    }
    const groups = new Map<string, string[]>();
    for (const exhibit of exhibits) {
      const entity = formatExhibitEntity(exhibit.entityKey, exhibit.issueLabel);
      const list = groups.get(entity) ?? [];
      list.push(String(exhibit.exhibit));
      groups.set(entity, list);
    }
    return [...groups.entries()].map(([label, exhibits]) => ({ label, exhibits }));
  }, [draft?.exhibitsManifest]);
  useEffect(() => {
    if (!draft || syncedEvidenceDraftId.current === draft.id) return;
    syncedEvidenceDraftId.current = draft.id;
    if (draft.evidenceOptions) {
      setEvidenceSelection({
        inlineExhibits: Boolean(draft.evidenceOptions.inlineExhibits),
        memorandum: Boolean(draft.evidenceOptions.memorandum),
        highlightedReport: Boolean(draft.evidenceOptions.highlightedReport),
      });
    } else if (draft.letterMode === "inline" || draft.letterMode === "memorandum") {
      // pre-Phase-5 drafts persisted only letterMode — rehydrate the checkboxes
      // from it so the previous choice is not silently dropped (panel LOW-7)
      setEvidenceSelection({
        inlineExhibits: draft.letterMode === "inline",
        memorandum: draft.letterMode === "memorandum",
        highlightedReport: false,
      });
    }
    if (draft.exhibitNumbering === "numeric" || draft.exhibitNumbering === "alpha") {
      setExhibitNumbering(draft.exhibitNumbering);
    }
  }, [draft]);
  const [isSaving, setIsSaving] = useState(false);
  const [fullDocumentHtml, setFullDocumentHtml] = useState("");
  const autoSyncStartedAtRef = useRef<number | null>(null);
  const { toast } = useToast();
  const reportResetKey = useMemo(
    () => [report.sourceSessionId ?? "", report.reportId ?? "", report.fileName ?? "", report.bureau ?? ""].join("|"),
    [report.bureau, report.fileName, report.reportId, report.sourceSessionId],
  );

  const refreshReasonCatalog = (preserveSelections = false) => {
    const nextAccountRuleCatalog = generateAccountRuleCatalog(report);
    const nextNonAccountReasons = generateNonAccountReasons(report, intake);

    setAccountRuleCatalog((current) =>
      preserveSelections ? mergeAccountRuleCatalog(current, nextAccountRuleCatalog) : nextAccountRuleCatalog,
    );
    setNonAccountReasons((current) =>
      preserveSelections ? mergeReasons(current, nextNonAccountReasons) : nextNonAccountReasons,
    );
    if (!preserveSelections) {
      setExpandedAccountGroups(buildDefaultExpandedAccountGroups(nextAccountRuleCatalog));
      setExpandedNonAccountGroups({});
      setExpandedNotApplicableGroups({});
      setIsEscalationExpanded(false);
    }
  };

  useEffect(() => {
    const defaults = buildDefaultIntake(report);
    const nextAccountRuleCatalog = generateAccountRuleCatalog(report);
    setIntake(defaults);
    setAccountRuleCatalog(nextAccountRuleCatalog);
    setNonAccountReasons(generateNonAccountReasons(report, defaults));
    setCustomAccountReasons([]);
    setExpandedAccountGroups(buildDefaultExpandedAccountGroups(nextAccountRuleCatalog));
    setExpandedNonAccountGroups({});
    setExpandedNotApplicableGroups({});
    setIsEscalationExpanded(false);
    setLastAutoEvidenceDraftId(null);
    setIsAutoSyncPending(false);
    setDraft(null);
    setFullDocumentHtml("");
    setActiveStep("reasons");
  }, [reportResetKey]);

  useEffect(() => {
    setNonAccountReasons((current) => mergeReasons(current, generateNonAccountReasons(report, intake)));
  }, [intake, report]);

  useEffect(() => {
    if (draft) {
      setFullDocumentHtml(draft.fullDocumentHtml);
    }
  }, [draft]);

  const updateAccountEvaluation = (entityKey: string, ruleId: string, patch: Partial<DisputeRuleEvaluation>) => {
    setAccountRuleCatalog((current) =>
      current.map((group) =>
        group.entityKey !== entityKey
          ? group
          : {
              ...group,
              categories: group.categories.map((category) => ({
                ...category,
                entries: category.entries.map((entry) => (
                  entry.ruleId === ruleId ? { ...entry, ...patch } : entry
                )),
              })),
            },
      ),
    );
  };

  const toggleAccountGroup = (groupKey: string) => {
    setExpandedAccountGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  };

  const addCustomAccountReason = (group: AccountRuleCatalogGroup) => {
    const sourcePages = collectGroupSourcePages(group);
    setCustomAccountReasons((current) => [
      ...current,
      {
        id: `manual-account-reason:${group.entityKey}:${crypto.randomUUID()}`,
        entityKey: group.entityKey,
        category: "payment_history",
        issueLabel: "",
        reasonSummary: "",
        sourcePages,
        operatorNotes: "",
        selected: true,
      },
    ]);
  };

  const updateCustomAccountReason = (reasonId: string, patch: Partial<ManualAccountReason>) => {
    setCustomAccountReasons((current) =>
      current.map((reason) => (reason.id === reasonId ? { ...reason, ...patch } : reason)),
    );
  };

  const removeCustomAccountReason = (reasonId: string) => {
    setCustomAccountReasons((current) => current.filter((reason) => reason.id !== reasonId));
  };

  const selectedReasons = useMemo(
    () => generateDisputeReasons(report, intake, accountRuleCatalog, nonAccountReasons, customAccountReasons),
    [accountRuleCatalog, customAccountReasons, intake, nonAccountReasons, report],
  );
  const selectedReasonIds = useMemo(
    () => new Set(selectedReasons.map((reason) => reason.id)),
    [selectedReasons],
  );
  const selectedReasonsById = useMemo(
    () => new Map(selectedReasons.map((reason) => [reason.id, reason])),
    [selectedReasons],
  );
  const draftSelectedReasonIds = useMemo(
    () => new Set((draft?.selectedReasons ?? []).map((reason) => reason.id)),
    [draft],
  );
  const evidenceBundlesByReasonId = useMemo(
    () => new Map((draft?.evidenceManifest?.reasons ?? []).map((bundle) => [bundle.reasonId, bundle])),
    [draft],
  );
  const hasDraftReasonSelectionDrift = useMemo(() => {
    if (!draft) {
      return false;
    }
    if (selectedReasonIds.size !== draftSelectedReasonIds.size) {
      return true;
    }
    for (const reasonId of selectedReasonIds) {
      if (!draftSelectedReasonIds.has(reasonId)) {
        return true;
      }
    }
    return false;
  }, [draft, draftSelectedReasonIds, selectedReasonIds]);
  const reviewItemCount = useMemo(
    () =>
      accountRuleCatalog.reduce((sum, group) => sum + group.categories.reduce((entrySum, category) => entrySum + category.entries.length, 0), 0) +
      nonAccountReasons.length +
      customAccountReasons.length,
    [accountRuleCatalog, customAccountReasons, nonAccountReasons],
  );
  const groupedReasons = useMemo(() => {
    const groups = new Map<string, ReasonGroup>();
    for (const reason of nonAccountReasons) {
      const key = `${reason.entityType}:${reason.entityKey}`;
      const existing = groups.get(key);
      if (existing) {
        existing.reasons.push(reason);
      } else {
        groups.set(key, {
          key,
          label: describeReasonGroup(reason),
          entityType: reason.entityType,
          entityKey: reason.entityKey,
          accountPosture:
            reason.entityType === "account" && reason.selectionBasis
              ? reason.selectionBasis === "negative_account"
                ? "negative"
                : reason.selectionBasis === "positive_account"
                  ? "positive"
                  : undefined
              : undefined,
          reasons: [reason],
        });
      }
    }
    return Array.from(groups.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [nonAccountReasons]);
  const nonAccountGroups = useMemo(
    () => groupedReasons.filter((group) => group.entityType !== "account" && !group.reasons.every((reason) => reason.isAttorneyEscalation)),
    [groupedReasons],
  );
  const escalationReasons = useMemo(
    () =>
      nonAccountReasons
        .filter((reason) => reason.isAttorneyEscalation)
        .sort((left, right) => left.issueLabel.localeCompare(right.issueLabel)),
    [nonAccountReasons],
  );

  useEffect(() => {
    setExpandedNonAccountGroups((current) => Object.fromEntries(nonAccountGroups.map((group) => [group.key, current[group.key] ?? false])));
  }, [nonAccountGroups]);

  const toggleNonAccountGroup = (groupKey: string) => {
    setExpandedNonAccountGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  };

  const toggleNotApplicableGroup = (groupKey: string) => {
    setExpandedNotApplicableGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  };

  const expandAllReasonGroups = () => {
    setExpandedAccountGroups(buildGroupExpansionMap(accountRuleCatalog.map((group) => group.key), true));
    setExpandedNonAccountGroups(buildGroupExpansionMap(nonAccountGroups.map((group) => group.key), true));
    setExpandedNotApplicableGroups(buildGroupExpansionMap(accountRuleCatalog.map((group) => group.key), true));
    setIsEscalationExpanded(escalationReasons.length > 0);
  };

  const collapseAllReasonGroups = () => {
    setExpandedAccountGroups(buildGroupExpansionMap(accountRuleCatalog.map((group) => group.key), false));
    setExpandedNonAccountGroups(buildGroupExpansionMap(nonAccountGroups.map((group) => group.key), false));
    setExpandedNotApplicableGroups(buildGroupExpansionMap(accountRuleCatalog.map((group) => group.key), false));
    setIsEscalationExpanded(false);
  };

  const canCreateDraft = selectedReasons.length > 0 && intake.fullLegalName.trim().length > 0 && intake.reportDate.trim().length > 0;
  const autoDraftSyncKey = useMemo(
    () => buildDisputeDraftSyncKey({ report, intake, reasons: selectedReasons }),
    [intake, report, selectedReasons],
  );
  const autoDraftRequestKey = useMemo(() => hashDisputeDraftRequestKey(autoDraftSyncKey), [autoDraftSyncKey]);
  const shouldHydrateEvidenceWithDraft = activeStep === "reasons" || activeStep === "evidence";
  const needsHydratedDraft =
    canCreateDraft &&
    (!draft || hasDraftReasonSelectionDrift || (shouldHydrateEvidenceWithDraft && !isHydratedEvidenceReady(draft)));
  const isReasonEvidenceSyncing =
    activeStep === "reasons" && needsHydratedDraft && (isAutoSyncPending || lastAutoDraftSyncKey !== autoDraftSyncKey);
  const shouldSuppressInlineProofPlaceholders = activeStep === "reasons" && isReasonEvidenceSyncing;

  const syncDraft = async ({
    navigateToSections = true,
    showToast = true,
    requireOverrideConfirmation = true,
    hydrateEvidence = false,
    requestKey,
    trackSavingState = true,
  }: {
    navigateToSections?: boolean;
    showToast?: boolean;
    requireOverrideConfirmation?: boolean;
    hydrateEvidence?: boolean;
    requestKey?: string;
    trackSavingState?: boolean;
  } = {}) => {
    if (!canCreateDraft) {
      if (showToast) {
        toast({
          title: "Draft inputs incomplete",
          description: "Select at least one dispute reason and complete the required intake fields.",
          variant: "destructive",
        });
      }
      return;
    }

    if (draft?.renderState.documentOverride && requireOverrideConfirmation) {
      const shouldRebuild = window.confirm(
        "This draft currently uses a full-document override. Rebuilding from reasons and intake will replace the edited full-document version. Continue?",
      );
      if (!shouldRebuild) {
        return;
      }
    }

    if (trackSavingState) {
      setIsSaving(true);
    }
    try {
      let nextDraft = await createDisputeLetterDraft({
        sessionId: report.sourceSessionId ?? report.reportId ?? report.fileName ?? crypto.randomUUID(),
        report,
        intake,
        reasons: selectedReasons,
        requestKey,
        hydrateEvidence,
      });
      if (hydrateEvidence) {
        setLastAutoEvidenceDraftId(nextDraft.id);
      }
      setDraft(nextDraft);
      setFullDocumentHtml(nextDraft.fullDocumentHtml);
      if (navigateToSections) {
        setActiveStep("sections");
      }
      if (showToast) {
        toast({
          title: draft ? "Draft rebuilt" : "Draft created",
          description: "The section-aware draft is ready to edit.",
        });
      }
      return nextDraft;
    } catch (error) {
      if (showToast) {
        toast({
          title: "Draft generation failed",
          description: error instanceof Error ? error.message : "Unable to create the dispute letter draft.",
          variant: "destructive",
        });
      }
      return null;
    } finally {
      if (trackSavingState) {
        setIsSaving(false);
      }
    }
  };

  const handleCreateOrRebuildDraft = async () => {
    await syncDraft({ hydrateEvidence: shouldHydrateEvidenceWithDraft });
  };

  const saveSection = async (
    group: keyof DisputeLetterDraft["sections"],
    sectionId: string,
    patch: Record<string, unknown>,
  ) => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const nextDraft = await updateDisputeLetterSection(draft.id, sectionId, { group, sectionId, patch } as never);
      setDraft(nextDraft);
      toast({
        title: "Section saved",
        description: "The structured draft has been updated.",
      });
    } catch (error) {
      toast({
        title: "Section save failed",
        description: error instanceof Error ? error.message : "Unable to save the section.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveFullDocument = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const nextDraft = await updateDisputeLetterFullDocument(draft.id, { html: fullDocumentHtml });
      setDraft(nextDraft);
      toast({
        title: "Full-letter override saved",
        description: "Exports will now use the edited full document until you rebuild from sections.",
      });
    } catch (error) {
      toast({
        title: "Full-letter save failed",
        description: error instanceof Error ? error.message : "Unable to save the full document.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const rebuildFromSections = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const nextDraft = await renderDisputeLetterDraft(draft.id, true);
      setDraft(nextDraft);
      setFullDocumentHtml(nextDraft.fullDocumentHtml);
      toast({
        title: "Draft rebuilt",
        description: "The full-letter override has been cleared and the document has been rebuilt from the structured sections.",
      });
    } catch (error) {
      toast({
        title: "Rebuild failed",
        description: error instanceof Error ? error.message : "Unable to rebuild from sections.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const refreshPreview = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const nextDraft = await renderDisputeLetterDraft(draft.id, false);
      setDraft(nextDraft);
    } catch (error) {
      toast({
        title: "Preview refresh failed",
        description: error instanceof Error ? error.message : "Unable to refresh the preview.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArtifactSave = async (url: string | null | undefined, suggestedName: string) => {
    if (!url) return;
    const result = await saveArtifactToDisk(url, suggestedName);
    if (result === "saved") {
      toast({ title: "Saved", description: suggestedName });
    }
  };

  const exportDraft = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const { draft: nextDraft, warnings } = await exportDisputeLetterDraft(draft.id, {
        ...evidenceSelection,
        exhibitNumbering,
      });
      setDraft(nextDraft);
      // one aggregated toast — TOAST_LIMIT is 1, so sequential toasts would
      // silently replace each other and hide earlier warnings (panel LOW-5)
      if (warnings.length) {
        toast({
          title: `Documents generated — ${warnings.length} note${warnings.length > 1 ? "s" : ""}`,
          description: warnings.slice(0, 4).join(" • ") + (warnings.length > 4 ? ` • +${warnings.length - 4} more` : ""),
        });
      } else {
        toast({
          title: "Artifacts generated",
          description: "The dispute letter and selected evidence documents were generated.",
        });
      }
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export the dispute letter.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const refreshEvidence = async (showToast = true) => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const nextDraft = await generateDisputeEvidence(draft.id);
      setDraft(nextDraft);
      if (showToast) {
        toast({
          title: "Evidence refreshed",
          description: "The highlighted evidence manifest was rebuilt from the original report pages.",
        });
      }
    } catch (error) {
      toast({
        title: "Evidence refresh failed",
        description: error instanceof Error ? error.message : "Unable to build the highlighted evidence manifest.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const generateHighlightedReport = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const nextDraft = await generateHighlightedReportPdf(draft.id, exhibitNumbering);
      setDraft(nextDraft);
      toast({
        title: "Highlighted report generated",
        description: "The full source report PDF with dispute highlights is ready.",
      });
    } catch (error) {
      if (error instanceof HighlightedReportBlockedError) {
        if (error.draft) {
          setDraft(error.draft);
        }
        toast({
          title: "Highlighted report blocked",
          description:
            error.unresolvedReasonIds.length > 0
              ? `${error.unresolvedReasonIds.length} selected dispute reason${error.unresolvedReasonIds.length === 1 ? "" : "s"} could not be localized precisely enough.`
              : error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Highlighted report failed",
          description: error instanceof Error ? error.message : "Unable to generate the highlighted report PDF.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!["reasons", "evidence"].includes(activeStep) || isSaving || !canCreateDraft) {
      return;
    }
    if (draft?.renderState.documentOverride) {
      return;
    }
    if (draft && !hasDraftReasonSelectionDrift) {
      return;
    }
    if (lastAutoDraftSyncKey === autoDraftSyncKey) {
      return;
    }
    setLastAutoDraftSyncKey(autoDraftSyncKey);
    setIsAutoSyncPending(true);
    autoSyncStartedAtRef.current = Date.now();
    void syncDraft({
      navigateToSections: false,
      showToast: false,
      requireOverrideConfirmation: false,
      hydrateEvidence: shouldHydrateEvidenceWithDraft,
      requestKey: autoDraftRequestKey,
      trackSavingState: false,
    }).then((nextDraft) => {
      if (!nextDraft) {
        return;
      }
      if (shouldHydrateEvidenceWithDraft && !isHydratedEvidenceReady(nextDraft)) {
        return;
      }
      autoSyncStartedAtRef.current = null;
      setIsAutoSyncPending(false);
    });
  }, [
    activeStep,
    autoDraftRequestKey,
    autoDraftSyncKey,
    canCreateDraft,
    draft,
    hasDraftReasonSelectionDrift,
    isSaving,
    lastAutoDraftSyncKey,
    shouldHydrateEvidenceWithDraft,
  ]);

  useEffect(() => {
    if (!["reasons", "evidence"].includes(activeStep) || !isAutoSyncPending || !canCreateDraft) {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const lookedUpDraft = await getDisputeLetterDraftByRequestKey(autoDraftRequestKey);
        if (!lookedUpDraft) {
          const startedAt = autoSyncStartedAtRef.current;
          if (startedAt && Date.now() - startedAt > AUTO_SYNC_TIMEOUT_MS) {
            autoSyncStartedAtRef.current = null;
            setIsAutoSyncPending(false);
            toast({
              title: "Highlighted proof is taking too long",
              description: "The dispute draft could not finish building the inline screenshot evidence. Please try the dispute page again.",
              variant: "destructive",
            });
          }
          return;
        }
        if (shouldHydrateEvidenceWithDraft && !isHydratedEvidenceReady(lookedUpDraft)) {
          return;
        }
        if (cancelled) {
          return;
        }
        setDraft(lookedUpDraft);
        setFullDocumentHtml(lookedUpDraft.fullDocumentHtml);
        if (lookedUpDraft.evidenceManifest) {
          setLastAutoEvidenceDraftId(lookedUpDraft.id);
        }
        autoSyncStartedAtRef.current = null;
        setIsAutoSyncPending(false);
      } catch {
        // Poll quietly while the server is still building the hydrated draft.
      }
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeStep, autoDraftRequestKey, canCreateDraft, isAutoSyncPending, shouldHydrateEvidenceWithDraft, toast]);

  useEffect(() => {
    if (!["reasons", "evidence"].includes(activeStep) || !draft || isSaving) {
      return;
    }
    if (draft.evidenceManifest) {
      setLastAutoEvidenceDraftId(draft.id);
      return;
    }
    if (hasDraftReasonSelectionDrift) {
      return;
    }
    if (lastAutoEvidenceDraftId === draft.id) {
      return;
    }
    setLastAutoEvidenceDraftId(draft.id);
    void refreshEvidence(false);
  }, [activeStep, draft, hasDraftReasonSelectionDrift, isSaving, lastAutoEvidenceDraftId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dispute Letter Builder</CardTitle>
          <CardDescription>
            This workflow consumes the current extracted {report.bureau} report and builds a separate dispute-letter draft without altering extraction results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 border-b border-dashed border-black/20 pb-5 text-sm text-slate-600">
            <span className="inline-flex items-center border border-black/15 px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-700">
              {report.bureau}
            </span>
            <span className="inline-flex items-center border border-black/15 px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-700">
              {report.profileId ?? "profile"}
            </span>
            <span className="inline-flex items-center border border-black/15 px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-700">
              {selectedReasons.length} selected reasons
            </span>
            {draft && <span>Draft {draft.id.slice(0, 8)}</span>}
          </div>
          {/* auto-fit: cards wrap onto extra rows rather than shrinking below a
              readable width — fixed 6-col grid clipped labels at mid-desktop
              widths (Step-6 D1, operator screenshot) */}
          <nav aria-label="Dispute workflow steps" className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-2">
            {STEP_ORDER.map(({ value, label, icon: Icon }, index) => {
              const isActive = activeStep === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-current={isActive ? "step" : undefined}
                  onClick={() => setActiveStep(value)}
                  className={cn(
                    "flex min-w-0 items-start gap-2 border px-3 py-3 text-left transition-colors",
                    isActive
                      ? "border-black bg-black text-white"
                      : "border-black/20 bg-white text-slate-700 hover:border-black/50 hover:bg-black/[0.02]",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-[0.65rem] uppercase tracking-[0.18em]",
                      isActive ? "text-white/70" : "text-slate-500",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 items-start gap-2">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-500")} />
                    <span className="min-w-0 text-sm leading-tight whitespace-normal">{label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      {draft?.renderState.documentOverride && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>This draft now uses full-document override</AlertTitle>
          <AlertDescription>
            The full document has diverged from the structured sections. Section edits are still stored, but exports will follow the full-document editor until you rebuild from sections.
          </AlertDescription>
        </Alert>
      )}

      {activeStep === "reasons" && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Review Dispute Reasons</CardTitle>
                <CardDescription>
                  Candidate reasons are generated from contradictions and incompleteness within this single bureau report. Expand only the groups you need, keep applicable disputes in the main review area, and leave non-applicable checks collapsed below.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={expandAllReasonGroups}>
                  Expand all
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAllReasonGroups}>
                  Collapse all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refreshReasonCatalog(false);
                    toast({
                      title: "Reasons re-evaluated",
                      description:
                        "The dispute rule catalog was regenerated from the current report data and reset to its default selections. Manual changes — including re-checked strategy-demoted reasons — were cleared.",
                    });
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-evaluate Reasons
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isReasonEvidenceSyncing ? (
              <div className="flex min-h-[340px] items-center justify-center rounded-lg border border-black/15 bg-[#faf8f2] px-6 py-12">
                <div className="max-w-xl text-center text-slate-700">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-500" />
                  <p className="mt-4 text-lg font-semibold text-slate-900">Preparing dispute reasons and highlighted proof</p>
                  <p className="mt-2 text-sm leading-6">
                    The dispute draft and screenshot evidence are being synchronized in one pass so the selected reasons appear with their highlighted proof at the same time.
                  </p>
                </div>
              </div>
            ) : reviewItemCount === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No candidate reasons were generated</AlertTitle>
                <AlertDescription>
                  Complete the intake step and revisit this screen if you want personal-information mismatch checks added to the candidate list.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {draft && (
                  <div className="rounded-lg border border-black/15 bg-[#faf8f2] px-4 py-4 text-sm leading-6 text-slate-700">
                    <p className="font-medium text-slate-900">Highlighted source proof now lives inline with each selected dispute.</p>
                    <p className="mt-1">
                      Review the screenshot evidence directly beneath a selected reason before the parked <span className="font-semibold text-slate-900">Disputes Not Applicable</span> section.
                    </p>
                    {hasDraftReasonSelectionDrift ? (
                      <p className="mt-2 text-slate-600">
                        You have unsaved reason changes. Rebuild the draft to sync the inline proof and highlighted-report export with the current selection set.
                      </p>
                    ) : null}
                  </div>
                )}
                {escalationReasons.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setIsEscalationExpanded((current) => !current)}
                      className="flex w-full flex-wrap items-start justify-between gap-3 border-b border-dashed border-black/15 bg-black/[0.02] px-4 py-4 text-left transition hover:bg-black/[0.04]"
                    >
                      <div className="flex items-start gap-3">
                        {isEscalationExpanded ? <ChevronDown className="mt-1 h-4 w-4 text-slate-500" /> : <ChevronRight className="mt-1 h-4 w-4 text-slate-500" />}
                        <div>
                          <h3 className="text-base font-semibold text-slate-900">Attorney Escalation</h3>
                          <p className="text-sm text-slate-600">
                            High-risk identity or reporting issues that should be reviewed separately while still remaining selectable in the normal dispute workflow.
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center border border-black/15 bg-white px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-700">
                        {escalationReasons.filter((reason) => reason.selected).length} selected
                      </span>
                    </button>
                    {isEscalationExpanded ? (
                      <div className="space-y-4 p-4">
                        {escalationReasons.map((reason) => (
                          <div key={`escalation-${reason.id}`} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={reason.selected}
                                  onCheckedChange={(checked) => {
                                    setNonAccountReasons((current) =>
                                      current.map((entry) =>
                                        entry.id === reason.id ? { ...entry, selected: checked === true } : entry,
                                      ),
                                    );
                                  }}
                                />
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{reason.issueLabel}</p>
                                  <p className="text-xs text-slate-500">
                                    {reason.component} · {humanizeEntityType(reason.entityType)} · pages {formatPageList(reason.sourcePages)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right text-xs text-slate-500">
                                <p>{reason.severity}</p>
                                <p>attorney escalation</p>
                              </div>
                            </div>
                            <div className="mt-3 text-sm text-slate-700">{reason.reasonSummary}</div>
                            {reason.selected && draft && (
                              draft.evidenceManifest && draftSelectedReasonIds.has(reason.id) ? (
                                <DisputeReasonEvidencePanel
                                  draft={draft}
                                  reason={reason}
                                  bundle={evidenceBundlesByReasonId.get(reason.id)}
                                  className="mt-4"
                                  compact
                                />
                              ) : !shouldSuppressInlineProofPlaceholders ? (
                                <div className="mt-4 rounded-lg border border-dashed border-black/15 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                                  This escalation reason is selected locally but is not part of the saved draft yet. Rebuild the draft to generate its highlighted source proof.
                                </div>
                              ) : null
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                {accountRuleCatalog.map((group) => {
                  const isExpanded = expandedAccountGroups[group.key] === true;
                  const isNotApplicableExpanded = expandedNotApplicableGroups[group.key] === true;
                  const accountCustomReasons = customAccountReasons.filter((reason) => reason.entityKey === group.entityKey);
                  const totalRuleCount = group.categories.reduce((sum, category) => sum + category.entries.length, 0);
                  const availableRuleCount = group.categories.reduce(
                    (sum, category) => sum + category.entries.filter((entry) => entry.status === "triggered").length,
                    0,
                  );
                  const selectedRuleCount = group.categories.flatMap((category) => category.entries).filter((entry) => entry.selected).length;
                  const selectedCustomCount = accountCustomReasons.filter((reason) => reason.selected && isCompleteManualAccountReason(reason)).length;
                  const selectedReasonCount = selectedRuleCount + selectedCustomCount;
                  const actionableCategories = group.categories
                    .map((category) => ({
                      ...category,
                      entries: category.entries.filter((entry) => entry.status === "triggered" || entry.selectable),
                    }))
                    .filter((category) => category.entries.length > 0);
                  const notApplicableCategories = group.categories
                    .map((category) => ({
                      ...category,
                      entries: category.entries.filter((entry) => ["not_triggered", "insufficient_evidence", "not_applicable"].includes(entry.status)),
                    }))
                    .filter((category) => category.entries.length > 0);
                  const defaultCategory =
                    actionableCategories.find((category) => category.entries.some((entry) => entry.selected))?.category ??
                    actionableCategories[0]?.category;

                  return (
                    <div key={group.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className="border-b border-dashed border-black/15 bg-black/[0.02] p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{group.label}</h3>
                            <p className="text-sm text-slate-500">
                              {totalRuleCount} possible rule checks for this account.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAccountGroup(group.key)}
                            className="inline-flex items-center justify-center gap-2 self-start border border-black/20 bg-white px-3 py-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-700 transition hover:border-black/50 hover:text-slate-900 focus:outline-none"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span>{isExpanded ? "Hide reasons" : "Review reasons"}</span>
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center border px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em]",
                              group.accountPosture === "negative"
                                ? "border-rose-300 bg-rose-50 text-rose-700"
                                : "border-emerald-300 bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {group.accountPosture === "negative" ? "Negative account" : "Positive account"}
                          </span>
                          <span className="inline-flex items-center border border-black/15 bg-white px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-700">
                            {selectedReasonCount} selected
                          </span>
                          <span className="inline-flex items-center border border-black/15 bg-white px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-700">
                            {availableRuleCount} triggered
                          </span>
                          {accountCustomReasons.length > 0 && (
                            <span className="inline-flex items-center border border-black/15 bg-white px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-700">
                              {accountCustomReasons.length} custom
                            </span>
                          )}
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="space-y-5 p-4 sm:p-5">
                          {actionableCategories.length > 0 ? (
                            <Tabs key={`${group.key}-${defaultCategory ?? "account"}`} defaultValue={defaultCategory} className="space-y-5">
                              <div className="space-y-1">
                                <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Applicable disputes</p>
                                <p className="text-sm text-slate-500">
                                  Triggered and operator-selectable reasons stay in the main review flow, even when you uncheck them.
                                </p>
                              </div>
                              <TabsList className="grid h-auto w-full grid-cols-1 gap-2 border-0 bg-transparent p-0 sm:grid-cols-2 xl:grid-cols-3">
                                {actionableCategories.map((category) => {
                                  const triggeredCount = countAvailableEntries(category.entries);
                                  return (
                                    <TabsTrigger
                                      key={`${group.key}-${category.category}`}
                                      value={category.category}
                                      className="h-auto items-start justify-between border border-black/15 px-4 py-3 text-left whitespace-normal data-[state=active]:border-black data-[state=active]:bg-black data-[state=active]:text-white"
                                    >
                                      <span className="flex min-w-0 flex-col items-start gap-1">
                                        <span className="text-sm font-medium leading-tight">{category.label}</span>
                                        <span className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-current/70">
                                          {triggeredCount} ready
                                        </span>
                                      </span>
                                    </TabsTrigger>
                                  );
                                })}
                              </TabsList>

                              {actionableCategories.map((category) => (
                                <TabsContent key={`${group.key}-${category.category}-content`} value={category.category} className="space-y-5">
                                  {shouldSuppressInlineProofPlaceholders && category.entries.some((entry) => entry.selected) ? (
                                    <div className="rounded-lg border border-dashed border-black/15 bg-[#faf8f2] px-4 py-3 text-sm leading-6 text-slate-600">
                                      The selected disputes and highlighted source proof for this category are syncing together and will appear once the saved draft is ready.
                                    </div>
                                  ) : null}
                                  {category.entries.map((entry) => {
                                    const reasonId = `${entry.ruleId}:${group.entityKey}`;
                                    const selectedReason = selectedReasonsById.get(reasonId);
                                    const draftReason = draft?.selectedReasons.find((reason) => reason.id === reasonId);
                                    const evidenceBundle = evidenceBundlesByReasonId.get(reasonId);
                                    const isDraftBackedReason = draftSelectedReasonIds.has(reasonId);
                                    const inlineReason =
                                      selectedReason ??
                                      draftReason ??
                                      ({
                                        id: reasonId,
                                        bureau: report.bureau,
                                        profileId: report.profileId,
                                        component: "accounts",
                                        entityType: "account",
                                        entityKey: group.entityKey,
                                        issueType: entry.issueType,
                                        issueLabel: entry.issueLabel,
                                        reasonSummary: entry.explanation,
                                        supportingFacts: entry.supportingFacts,
                                        supportingFields: entry.supportingFields,
                                        sourcePages: entry.sourcePages,
                                        requestedAction: entry.requestedAction ?? defaultRequestedAction,
                                        severity: entry.severity ?? "medium",
                                        category: entry.category,
                                        defaultSelected: entry.defaultSelected,
                                        selectionBasis: entry.selectionBasis,
                                        selected: entry.selected,
                                        evidence: entry.evidence,
                                        operatorNotes: entry.operatorNotes,
                                      } satisfies DisputeReason);

                                    return (
                                      <div
                                        key={entry.key}
                                        className={
                                          entry.selectionBasis === "strategy_demoted" && !entry.selected
                                            ? "rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-5 opacity-90"
                                            : "rounded-lg border border-slate-200 bg-slate-50 p-5"
                                        }
                                      >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div className="flex items-start gap-3">
                                            <Checkbox
                                              checked={entry.selected}
                                              disabled={!entry.selectable}
                                              onCheckedChange={(checked) => {
                                                updateAccountEvaluation(group.entityKey, entry.ruleId, { selected: checked === true });
                                              }}
                                            />
                                            <div>
                                              <p className="text-sm font-semibold text-slate-900">{entry.issueLabel}</p>
                                              <p className="text-xs text-slate-500">
                                                {describeRuleStatus(entry.status)} · pages {formatPageList(entry.sourcePages)}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right text-xs text-slate-500">
                                            <RuleStatusBadge entry={entry} />
                                            <p>{humanizeReasonCategory(entry.category)}</p>
                                            {entry.severity && <p>{entry.severity}</p>}
                                            {entry.selectionBasis && <p>{humanizeSelectionBasis(entry.selectionBasis)}</p>}
                                          </div>
                                        </div>
                                        {entry.selectionBasis === "strategy_demoted" && <StrategyDemotionNote issueType={entry.issueType} selected={entry.selected} />}

                                        {entry.status === "triggered" ? (
                                          <>
                                            <div className="mt-5 grid gap-5 md:grid-cols-2">
                                              <div className="space-y-2">
                                                <Label htmlFor={`summary-${group.entityKey}-${entry.ruleId}`}>Reason summary</Label>
                                                <Textarea
                                                  id={`summary-${group.entityKey}-${entry.ruleId}`}
                                                  value={entry.explanation}
                                                  onChange={(event) => {
                                                    updateAccountEvaluation(group.entityKey, entry.ruleId, { explanation: event.target.value });
                                                  }}
                                                  className="min-h-[120px]"
                                                />
                                              </div>
                                              <div className="space-y-2">
                                                <Label htmlFor={`notes-${group.entityKey}-${entry.ruleId}`}>Operator notes</Label>
                                                <Textarea
                                                  id={`notes-${group.entityKey}-${entry.ruleId}`}
                                                  value={entry.operatorNotes ?? ""}
                                                  onChange={(event) => {
                                                    updateAccountEvaluation(group.entityKey, entry.ruleId, { operatorNotes: event.target.value });
                                                  }}
                                                  placeholder="Optional note for this reason"
                                                  className="min-h-[120px]"
                                                />
                                              </div>
                                            </div>
                                            {(entry.supportingFacts.length > 0 || entry.supportingFields.length > 0) && (
                                              <div className="mt-5 space-y-4 rounded-lg bg-white p-4 text-sm text-slate-700">
                                                {entry.supportingFacts.length > 0 && (
                                                  <div>
                                                    <p className="font-medium text-slate-900">Evidence found in the report</p>
                                                    <ul className="mt-2 list-disc pl-5">
                                                      {entry.supportingFacts.map((fact, factIndex) => (
                                                        <li key={`${entry.key}-fact-${factIndex}`}>{fact}</li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                )}
                                                {entry.supportingFields.length > 0 && (
                                                  <div>
                                                    <p className="font-medium text-slate-900">Fields compared</p>
                                                    <p className="mt-2 text-sm text-slate-700">{entry.supportingFields.join(", ")}</p>
                                                  </div>
                                                )}
                                                {entry.evidence?.scalarComparisons && entry.evidence.scalarComparisons.length > 0 && (
                                                  <div>
                                                    <p className="font-medium text-slate-900">Observed values</p>
                                                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                                                      {entry.evidence.scalarComparisons.map((valueEntry, entryIndex) => (
                                                        <div key={`${entry.key}-scalar-${entryIndex}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                          <p className="text-xs uppercase tracking-wide text-slate-500">{valueEntry.label}</p>
                                                          <p className="text-sm text-slate-900">{valueEntry.value}</p>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                                {entry.evidence?.monthlyComparisons && entry.evidence.monthlyComparisons.length > 0 && (
                                                  <div>
                                                    <p className="font-medium text-slate-900">Month-by-month conflicts</p>
                                                    <div className="mt-2 space-y-2">
                                                      {entry.evidence.monthlyComparisons.map((monthEntry, entryIndex) => (
                                                        <div key={`${entry.key}-month-${entryIndex}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                          <p className="text-sm font-medium text-slate-900">{monthEntry.month}</p>
                                                          <p className="text-sm text-slate-700">{monthEntry.leftLabel}: {monthEntry.leftValue}</p>
                                                          <p className="text-sm text-slate-700">{monthEntry.rightLabel}: {monthEntry.rightValue}</p>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {entry.selected && (
                                              draft?.evidenceManifest && isDraftBackedReason ? (
                                                <DisputeReasonEvidencePanel
                                                  draft={draft}
                                                  reason={inlineReason}
                                                  bundle={evidenceBundle}
                                                  className="mt-4"
                                                  compact
                                                />
                                              ) : !shouldSuppressInlineProofPlaceholders ? (
                                                <div className="mt-4 rounded-lg border border-dashed border-black/15 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                                                  {draft
                                                    ? "This reason is selected locally but is not part of the saved draft yet. Rebuild the draft to generate its highlighted source proof and include it in the highlighted report PDF."
                                                    : "Build the saved dispute draft to generate the highlighted source proof for this dispute."}
                                                </div>
                                              ) : null
                                            )}
                                          </>
                                        ) : (
                                          <div className="mt-4 rounded-lg bg-white p-3 text-sm text-slate-700">
                                            <p>{entry.explanation}</p>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </TabsContent>
                              ))}
                            </Tabs>
                          ) : (
                            <div className="rounded-lg border border-dashed border-black/15 bg-black/[0.02] px-4 py-3 text-sm text-slate-600">
                              No applicable disputes are currently available for this tradeline.
                            </div>
                          )}

                          {notApplicableCategories.length > 0 && (
                            <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#faf8f2]">
                              <button
                                type="button"
                                onClick={() => toggleNotApplicableGroup(group.key)}
                                className="flex w-full flex-wrap items-start justify-between gap-3 border-b border-dashed border-black/15 px-4 py-4 text-left transition hover:bg-black/[0.02]"
                              >
                                <div className="flex items-start gap-3">
                                  {isNotApplicableExpanded ? <ChevronDown className="mt-1 h-4 w-4 text-slate-500" /> : <ChevronRight className="mt-1 h-4 w-4 text-slate-500" />}
                                  <div>
                                    <h4 className="text-sm font-semibold text-slate-900">Disputes Not Applicable</h4>
                                    <p className="text-sm text-slate-600">
                                      Clear, unavailable, or non-applicable checks are parked here so they stay reviewable without cluttering the active dispute flow.
                                    </p>
                                  </div>
                                </div>
                                <span className="inline-flex items-center border border-black/15 bg-white px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-700">
                                  {notApplicableCategories.reduce((sum, category) => sum + category.entries.length, 0)} checks
                                </span>
                              </button>
                              {isNotApplicableExpanded ? (
                                <div className="space-y-4 p-4">
                                  {notApplicableCategories.map((category) => (
                                    <div key={`${group.key}-${category.category}-not-applicable`} className="space-y-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <h5 className="text-sm font-semibold text-slate-900">{category.label}</h5>
                                        <span className="text-xs text-slate-500">{category.entries.length} check{category.entries.length === 1 ? "" : "s"}</span>
                                      </div>
                                      <div className="space-y-3">
                                        {category.entries.map((entry) => (
                                          <div key={`${entry.key}-not-applicable`} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                              <div>
                                                <p className="text-sm font-semibold text-slate-900">{entry.issueLabel}</p>
                                                <p className="text-xs text-slate-500">
                                                  {describeRuleStatus(entry.status)} · pages {formatPageList(entry.sourcePages)}
                                                </p>
                                              </div>
                                              <RuleStatusBadge entry={entry} />
                                            </div>
                                            <p className="mt-3 text-sm text-slate-700">{entry.explanation}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          )}

                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-semibold text-slate-900">Custom account reasons</h4>
                                <p className="text-sm text-slate-600">
                                  Add a report-supported dispute reason for this account when you want to include a custom issue in the letter.
                                </p>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => addCustomAccountReason(group)}>
                                <Plus className="h-4 w-4" />
                                Add custom reason
                              </Button>
                            </div>
                            {accountCustomReasons.length === 0 ? (
                              <div className="mt-4 text-sm text-slate-600">No custom account reasons added for this tradeline.</div>
                            ) : (
                              <div className="mt-4 space-y-4">
                                {accountCustomReasons.map((reason) => (
                                  <div key={reason.id} className="rounded-lg border border-slate-200 bg-white p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="flex items-start gap-3">
                                        <Checkbox
                                          checked={reason.selected}
                                          onCheckedChange={(checked) => {
                                            updateCustomAccountReason(reason.id, { selected: checked === true });
                                          }}
                                        />
                                        <div>
                                          <p className="text-sm font-semibold text-slate-900">{reason.issueLabel.trim() || "Custom account reason"}</p>
                                          <p className="text-xs text-slate-500">
                                            {humanizeReasonCategory(reason.category)} · pages {formatPageList(reason.sourcePages)}
                                          </p>
                                        </div>
                                      </div>
                                      <Button variant="ghost" size="sm" onClick={() => removeCustomAccountReason(reason.id)}>
                                        <Trash2 className="h-4 w-4" />
                                        Remove
                                      </Button>
                                    </div>
                                    {!isCompleteManualAccountReason(reason) && (
                                      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                        Complete the title and summary to include this custom reason in the draft.
                                      </div>
                                    )}
                                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label htmlFor={`custom-title-${reason.id}`}>Title</Label>
                                        <Input
                                          id={`custom-title-${reason.id}`}
                                          value={reason.issueLabel}
                                          onChange={(event) => {
                                            updateCustomAccountReason(reason.id, { issueLabel: event.target.value });
                                          }}
                                          placeholder="Custom dispute title"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`custom-category-${reason.id}`}>Category</Label>
                                        <Select
                                          value={reason.category}
                                          onValueChange={(value) => {
                                            updateCustomAccountReason(reason.id, { category: value as DisputeReasonCategory });
                                          }}
                                        >
                                          <SelectTrigger id={`custom-category-${reason.id}`}>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {ACCOUNT_CUSTOM_REASON_CATEGORIES.map((option) => (
                                              <SelectItem key={`${reason.id}-${option.value}`} value={option.value}>
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label htmlFor={`custom-summary-${reason.id}`}>Summary</Label>
                                        <Textarea
                                          id={`custom-summary-${reason.id}`}
                                          value={reason.reasonSummary}
                                          onChange={(event) => {
                                            updateCustomAccountReason(reason.id, { reasonSummary: event.target.value });
                                          }}
                                          placeholder="Explain the dispute reason for this account."
                                          className="min-h-[120px]"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`custom-notes-${reason.id}`}>Operator notes</Label>
                                        <Textarea
                                          id={`custom-notes-${reason.id}`}
                                          value={reason.operatorNotes ?? ""}
                                          onChange={(event) => {
                                            updateCustomAccountReason(reason.id, { operatorNotes: event.target.value });
                                          }}
                                          placeholder="Optional note for this custom reason"
                                          className="min-h-[120px]"
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                      <Label htmlFor={`custom-pages-${reason.id}`}>Source pages</Label>
                                      <Input
                                        id={`custom-pages-${reason.id}`}
                                        value={reason.sourcePages.join(", ")}
                                        onChange={(event) => {
                                          updateCustomAccountReason(reason.id, { sourcePages: parsePageListInput(event.target.value) });
                                        }}
                                        placeholder="Optional pages, e.g. 2, 4, 5"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 sm:p-5">
                          <div className="rounded-lg border border-dashed border-black/15 bg-black/[0.02] px-4 py-3 text-sm text-slate-600">
                            Open this account to review its applicable disputes, parked non-applicable checks, and any custom dispute notes.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {nonAccountGroups.map((group) => {
                  const isExpanded = expandedNonAccountGroups[group.key] === true;
                  const entityType = group.reasons[0]?.entityType ?? "report_item";
                  const selectedCount = group.reasons.filter((reason) => reason.selected).length;
                  const triggeredCount = group.reasons.length;
                  const postureLabel = describeNonAccountGroupPosture(entityType);
                  const subjectLabel = describeNonAccountGroupSubject(entityType);
                  const postureClasses =
                    entityType === "public_record"
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : "border-black/15 bg-white text-slate-700";
                  return (
                    <div key={group.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className="border-b border-dashed border-black/15 bg-black/[0.02] p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{group.label}</h3>
                            <p className="text-sm text-slate-500">
                              {triggeredCount} possible rule check{triggeredCount === 1 ? "" : "s"} for this {subjectLabel}.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleNonAccountGroup(group.key)}
                            className="inline-flex items-center justify-center gap-2 self-start border border-black/20 bg-white px-3 py-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-700 transition hover:border-black/50 hover:text-slate-900 focus:outline-none"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span>{isExpanded ? "Hide reasons" : "Review reasons"}</span>
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className={cn("inline-flex items-center border px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em]", postureClasses)}>
                            {postureLabel}
                          </span>
                          <span className="inline-flex items-center border border-black/15 bg-white px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-700">
                            {selectedCount} selected
                          </span>
                          <span className="inline-flex items-center border border-black/15 bg-white px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-700">
                            {triggeredCount} triggered
                          </span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="space-y-4 p-4 sm:p-5">
                          <div className="space-y-1">
                            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">Applicable disputes</p>
                            <p className="text-sm text-slate-500">
                              Review and edit the selected reasons for this {subjectLabel} the same way you would for an account.
                            </p>
                          </div>
                          {group.reasons.map((reason) => (
                            <div
                              key={reason.id}
                              className={
                                reason.selectionBasis === "strategy_demoted" && !reason.selected
                                  ? "rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-5 opacity-90"
                                  : "rounded-lg border border-slate-200 bg-slate-50 p-5"
                              }
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={reason.selected}
                                    onCheckedChange={(checked) => {
                                      setNonAccountReasons((current) =>
                                        current.map((entry) =>
                                          entry.id === reason.id ? { ...entry, selected: checked === true } : entry,
                                        ),
                                      );
                                    }}
                                  />
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{reason.issueLabel}</p>
                                    <p className="text-xs text-slate-500">
                                      {reason.component} · {humanizeEntityType(reason.entityType)} · pages {formatPageList(reason.sourcePages)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right text-xs text-slate-500">
                                  <p>{reason.severity}</p>
                                  {reason.category && <p>{humanizeReasonCategory(reason.category)}</p>}
                                  {reason.selectionBasis && <p>{humanizeSelectionBasis(reason.selectionBasis)}</p>}
                                </div>
                              </div>
                              {reason.selectionBasis === "strategy_demoted" && <StrategyDemotionNote issueType={reason.issueType} selected={reason.selected} />}
                              <div className="mt-5 grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor={`summary-${reason.id}`}>Reason summary</Label>
                                  <Textarea
                                    id={`summary-${reason.id}`}
                                    value={reason.reasonSummary}
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      setNonAccountReasons((current) => current.map((entry) => (entry.id === reason.id ? { ...entry, reasonSummary: nextValue } : entry)));
                                    }}
                                    className="min-h-[120px]"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`notes-${reason.id}`}>Operator notes</Label>
                                  <Textarea
                                    id={`notes-${reason.id}`}
                                    value={reason.operatorNotes ?? ""}
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      setNonAccountReasons((current) => current.map((entry) => (entry.id === reason.id ? { ...entry, operatorNotes: nextValue } : entry)));
                                    }}
                                    placeholder="Optional note for this reason"
                                    className="min-h-[120px]"
                                  />
                                </div>
                              </div>
                              {(reason.supportingFacts.length > 0 || reason.supportingFields.length > 0) && (
                                <div className="mt-5 space-y-4 rounded-lg bg-white p-4 text-sm text-slate-700">
                                  {reason.supportingFacts.length > 0 && (
                                    <div>
                                      <p className="font-medium text-slate-900">Evidence found in the report</p>
                                      <ul className="mt-2 list-disc pl-5">
                                        {reason.supportingFacts.map((fact, factIndex) => (
                                          <li key={`${reason.id}-fact-${factIndex}`}>{fact}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {reason.supportingFields.length > 0 && (
                                    <div>
                                      <p className="font-medium text-slate-900">Fields compared</p>
                                      <p className="mt-2 text-sm text-slate-700">{reason.supportingFields.join(", ")}</p>
                                    </div>
                                  )}
                                  {reason.evidence?.scalarComparisons && reason.evidence.scalarComparisons.length > 0 && (
                                    <div>
                                      <p className="font-medium text-slate-900">Observed values</p>
                                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                                        {reason.evidence.scalarComparisons.map((valueEntry, entryIndex) => (
                                          <div key={`${reason.id}-scalar-${entryIndex}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">{valueEntry.label}</p>
                                            <p className="text-sm text-slate-900">{valueEntry.value}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {reason.evidence?.monthlyComparisons && reason.evidence.monthlyComparisons.length > 0 && (
                                    <div>
                                      <p className="font-medium text-slate-900">Month-by-month conflicts</p>
                                      <div className="mt-2 space-y-2">
                                        {reason.evidence.monthlyComparisons.map((monthEntry, entryIndex) => (
                                          <div key={`${reason.id}-month-${entryIndex}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                            <p className="text-sm font-medium text-slate-900">{monthEntry.month}</p>
                                            <p className="text-sm text-slate-700">{monthEntry.leftLabel}: {monthEntry.leftValue}</p>
                                            <p className="text-sm text-slate-700">{monthEntry.rightLabel}: {monthEntry.rightValue}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {reason.selected && draft && (
                                draft.evidenceManifest && draftSelectedReasonIds.has(reason.id) ? (
                                  <DisputeReasonEvidencePanel
                                    draft={draft}
                                    reason={reason}
                                    bundle={evidenceBundlesByReasonId.get(reason.id)}
                                    className="mt-4"
                                    compact
                                  />
                                ) : !shouldSuppressInlineProofPlaceholders ? (
                                  <div className="mt-4 rounded-lg border border-dashed border-black/15 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                                    This reason is selected locally but is not part of the saved draft yet. Rebuild the draft to generate its highlighted source proof and include it in the highlighted report PDF.
                                  </div>
                                ) : null
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveStep("intake")}>Continue to Intake</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeStep === "intake" && (
        <Card>
          <CardHeader>
            <CardTitle>Letter Intake</CardTitle>
            <CardDescription>
              Confirm the consumer identity, mailing details, report metadata, and bureau recipient information before generating the draft.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["fullLegalName", "Full legal name"],
                ["dateOfBirth", "Date of birth"],
                ["socialSecurityNumber", "Social security number"],
                ["reportNumber", "Report number"],
                ["reportDate", "Report date"],
                ["letterDate", "Letter date"],
                ["certifiedMailTrackingNumber", "Certified mail tracking number"],
              ].map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    value={intake[key as keyof DisputeLetterIntake] as string}
                    onChange={(event) => setIntake((current) => updateIntakeField(current, key as keyof DisputeLetterIntake, event.target.value as never))}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["mailingAddressLine1", "Mailing address line 1"],
                ["mailingAddressLine2", "Mailing address line 2"],
                ["mailingCity", "Mailing city"],
                ["mailingState", "Mailing state"],
                ["mailingZip", "Mailing zip"],
                ["bureauRecipientName", `${report.bureau} recipient name`],
                ["bureauAddressLine1", `${report.bureau} address line 1`],
                ["bureauAddressLine2", `${report.bureau} address line 2`],
                ["bureauCity", `${report.bureau} city`],
                ["bureauState", `${report.bureau} state`],
                ["bureauZip", `${report.bureau} zip`],
              ].map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    value={intake[key as keyof DisputeLetterIntake] as string}
                    onChange={(event) => setIntake((current) => updateIntakeField(current, key as keyof DisputeLetterIntake, event.target.value as never))}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsePreference">Response preference</Label>
              <select
                id="responsePreference"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={intake.responsePreference}
                onChange={(event) => setIntake((current) => updateIntakeField(current, "responsePreference", event.target.value as never))}
              >
                <option value="mail_only">Mail only</option>
                <option value="mail_and_email">Mail and email</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="enclosures">Enclosures (one per line)</Label>
              <Textarea
                id="enclosures"
                className="min-h-[120px]"
                value={intake.enclosures.join("\n")}
                onChange={(event) =>
                  setIntake((current) => ({
                    ...current,
                    enclosures: event.target.value.split(/\n/).map((value) => value.trim()).filter(Boolean),
                  }))
                }
              />
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setActiveStep("reasons")}>Back to Reasons</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCreateOrRebuildDraft} disabled={isSaving || !canCreateDraft}>
                  {draft ? "Rebuild Draft" : "Create Draft"}
                </Button>
                <Button onClick={() => setActiveStep(draft ? "sections" : "reasons")} disabled={!draft}>Open Sections</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeStep === "sections" && (
        <Card>
          <CardHeader>
            <CardTitle>Section Editor</CardTitle>
            <CardDescription>
              Edit the structured legal sections. These edits stay in the canonical section-aware draft and can be rebuilt into the full letter at any time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!draft ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No draft yet</AlertTitle>
                <AlertDescription>Create the draft from the intake step before editing sections.</AlertDescription>
              </Alert>
            ) : (
              <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">Field-driven blocks</p>
                  <p className="mt-1">Sender, date, recipient, report metadata, and enclosures are generated from the intake form. Edit those values in the Intake step, then rebuild the draft if needed.</p>
                </div>
                {editableSectionGroups.map(({ group, title }) => {
                  const sectionGroup = draft.sections[group as keyof DisputeLetterDraft["sections"]];
                  const sections = Array.isArray(sectionGroup) ? sectionGroup : [sectionGroup];
                  if (!sections.length || sections.every((section) => !section)) {
                    return null;
                  }

                  return (
                    <div key={group} className="space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                      </div>
                      {sections.filter(Boolean).map((section) => (
                        <div key={section.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">{section.label}</p>
                              {section.reasonIds?.length ? (
                                <p className="text-xs text-slate-500">{section.reasonIds.length} linked dispute reason(s)</p>
                              ) : null}
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-600">
                              <Checkbox
                                checked={section.enabled}
                                onCheckedChange={(checked) => void saveSection(group as never, section.id, { enabled: checked === true })}
                              />
                              Include section
                            </label>
                          </div>
                          <div className="space-y-3">
                            <Input
                              value={section.title ?? ""}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setDraft((current) => {
                                  if (!current) return current;
                                  const cloned = structuredClone(current);
                                  const target = cloned.sections[group as keyof DisputeLetterDraft["sections"]];
                                  const collection = Array.isArray(target) ? target : [target];
                                  const match = collection.find((entry) => entry?.id === section.id);
                                  if (match) {
                                    match.title = nextValue;
                                  }
                                  return cloned;
                                });
                              }}
                              onBlur={(event) => void saveSection(group as never, section.id, { title: event.target.value })}
                            />
                            <RichTextEditor
                              value={section.html}
                              onChange={(nextHtml) => {
                                setDraft((current) => {
                                  if (!current) return current;
                                  const cloned = structuredClone(current);
                                  const target = cloned.sections[group as keyof DisputeLetterDraft["sections"]];
                                  const collection = Array.isArray(target) ? target : [target];
                                  const match = collection.find((entry) => entry?.id === section.id);
                                  if (match) {
                                    match.html = nextHtml;
                                  }
                                  return cloned;
                                });
                              }}
                              minHeightClassName="min-h-[220px]"
                            />
                            <div className="flex justify-end">
                              <Button onClick={() => void saveSection(group as never, section.id, { html: section.html, title: section.title, enabled: section.enabled })} disabled={isSaving}>
                                Save Section
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setActiveStep("intake")}>Back to Intake</Button>
                  <div className="flex gap-2">
                    {draft.renderState.documentOverride && (
                      <Button variant="outline" onClick={() => void rebuildFromSections()} disabled={isSaving}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Rebuild from Sections
                      </Button>
                    )}
                    <Button onClick={() => setActiveStep("full-letter")}>Open Full Letter</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeStep === "full-letter" && (
        <Card>
          <CardHeader>
            <CardTitle>Full Document Editor</CardTitle>
            <CardDescription>
              Edit the complete assembled letter in one view. Saving here activates full-document override and exports will use this version until you rebuild from the structured sections.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!draft ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No draft yet</AlertTitle>
                <AlertDescription>Create the draft before editing the full letter.</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-4 md:p-6">
                  <RichTextEditor
                    value={fullDocumentHtml}
                    onChange={setFullDocumentHtml}
                    toolbarOutside
                    className="dispute-letter-page-shell mx-auto w-full"
                    style={fullDocumentLayoutStyle}
                    minHeightClassName=""
                    contentClassName="dispute-letter-editor dispute-letter-page rounded-none border border-slate-300 px-0 py-0 [&_strong]:font-bold"
                  />
                </div>
                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setActiveStep("sections")}>Back to Sections</Button>
                  <div className="flex gap-2">
                    {draft.renderState.documentOverride && (
                      <Button variant="outline" onClick={() => void rebuildFromSections()} disabled={isSaving}>
                        Rebuild from Sections
                      </Button>
                    )}
                    <Button onClick={() => void saveFullDocument()} disabled={isSaving}>Save Full Letter</Button>
                    <Button onClick={() => setActiveStep("evidence")}>Highlighted Report</Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeStep === "evidence" && (
        <Card>
          <CardHeader>
            <CardTitle>Highlighted Report</CardTitle>
            <CardDescription>
              Refresh the shared evidence manifest and generate the separate full-report PDF with yellow dispute highlights. Detailed screenshot proof remains inline on the Reasons step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!draft ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No draft yet</AlertTitle>
                <AlertDescription>Create the draft before reviewing evidence or generating the highlighted report.</AlertDescription>
              </Alert>
            ) : (
              <>
                <DisputeEvidenceReview
                  draft={draft}
                  isBusy={isSaving}
                  onRefreshEvidence={refreshEvidence}
                  onGenerateHighlightedReport={generateHighlightedReport}
                />
                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setActiveStep("full-letter")}>Back to Full Letter</Button>
                  <Button onClick={() => setActiveStep("preview")}>Preview / Export</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeStep === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Preview / Export</CardTitle>
            <CardDescription>
              Review the formatted draft and generate DOCX and PDF artifacts. Outputs are written into the dispute-letter output folder without changing extraction results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!draft ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No draft yet</AlertTitle>
                <AlertDescription>Create the draft before using preview or export.</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="font-medium text-slate-900">Evidence package</p>
                  <p className="mt-1 text-sm text-slate-500">
                    The dispute letter always ships. Choose which evidence documents accompany it.
                  </p>
                  <div className="mt-5 space-y-4">
                    {[
                      {
                        key: "inlineExhibits" as const,
                        title: "Screenshots inside the letter",
                        description: "Each dispute section carries its highlighted report crops as numbered exhibit figures.",
                      },
                      {
                        key: "memorandum" as const,
                        title: "Evidence memorandum",
                        description: "A separate document mirroring the letter's exhibit numbering, carrying the screenshots.",
                      },
                      {
                        key: "highlightedReport" as const,
                        title: "Highlighted full report",
                        description: "The complete credit report with every disputed item marked and chip-numbered.",
                      },
                    ].map((option) => (
                      <div key={option.key} className="flex items-start gap-3">
                        <Checkbox
                          id={`evidence-${option.key}`}
                          checked={evidenceSelection[option.key]}
                          onCheckedChange={(checked) =>
                            setEvidenceSelection((current) => ({ ...current, [option.key]: checked === true }))
                          }
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5">
                          <Label htmlFor={`evidence-${option.key}`} className="cursor-pointer font-medium text-slate-900">
                            {option.title}
                          </Label>
                          <p className="text-sm leading-relaxed text-slate-500">{option.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                    <Label htmlFor="exhibit-numbering" className="text-sm font-medium text-slate-900">Exhibit numbering</Label>
                    <Select value={exhibitNumbering} onValueChange={(value) => setExhibitNumbering(value as "numeric" | "alpha")}>
                      <SelectTrigger id="exhibit-numbering" className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="numeric">Exhibit 1, 2, 3…</SelectItem>
                        <SelectItem value="alpha">Exhibit A, B, C…</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => void refreshPreview()} disabled={isSaving}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Preview
                  </Button>
                  <Button onClick={() => void exportDraft()} disabled={isSaving}>Generate Documents</Button>
                  {draft.renderState.docxUrl && (
                    <Button variant="outline" onClick={() => void handleArtifactSave(draft.renderState.docxUrl, "dispute-letter.docx")}>
                      <Download className="mr-2 h-4 w-4" />
                      Letter DOCX
                    </Button>
                  )}
                  {draft.renderState.pdfUrl && (
                    <Button variant="outline" onClick={() => void handleArtifactSave(draft.renderState.pdfUrl, "dispute-letter.pdf")}>
                      <Download className="mr-2 h-4 w-4" />
                      Letter PDF
                    </Button>
                  )}
                  {draft.renderState.memorandumDocxUrl && (
                    <Button variant="outline" onClick={() => void handleArtifactSave(draft.renderState.memorandumDocxUrl, "evidence-memorandum.docx")}>
                      <Download className="mr-2 h-4 w-4" />
                      Memorandum DOCX
                    </Button>
                  )}
                  {draft.renderState.memorandumPdfUrl && (
                    <Button variant="outline" onClick={() => void handleArtifactSave(draft.renderState.memorandumPdfUrl, "evidence-memorandum.pdf")}>
                      <Download className="mr-2 h-4 w-4" />
                      Memorandum PDF
                    </Button>
                  )}
                  {draft.renderState.highlightedReportPdfUrl && (
                    <Button variant="outline" onClick={() => void handleArtifactSave(draft.renderState.highlightedReportPdfUrl, "highlighted-report.pdf")}>
                      <Download className="mr-2 h-4 w-4" />
                      Highlighted Report
                    </Button>
                  )}
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <DisputeLetterPreviewFrame srcDoc={draft.renderState.previewHtml} />
                </div>
                {evidenceSelection.memorandum && !draft.renderState.memorandumPdfUrl && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    Generate Documents to preview the evidence memorandum here before approving it.
                  </div>
                )}
                {draft.renderState.memorandumPdfUrl && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 p-5">
                      <p className="font-medium text-slate-900">Memorandum preview</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Review and approve exactly what mails — this preview is the generated document itself.
                      </p>
                      {memorandumCoverage.length > 0 && (
                        <div className="mt-4 space-y-1.5">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Accounts covered</p>
                          {memorandumCoverage.map((entry) => (
                            <p key={entry.label} className="text-sm text-slate-700">
                              <span className="font-medium">{entry.label}</span>
                              <span className="text-slate-400">
                                {" "}— Exhibit{entry.exhibits.length > 1 ? "s" : ""} {entry.exhibits.join(", ")}
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <iframe
                      title="Evidence memorandum preview"
                      src={draft.renderState.memorandumPdfUrl}
                      className="h-[36rem] w-full"
                    />
                  </div>
                )}
                <div className="flex justify-start">
                  <Button variant="outline" onClick={() => setActiveStep("evidence")}>Back to Highlighted Report</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
