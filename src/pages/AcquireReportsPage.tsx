import React, { startTransition, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Download,
  FileDown,
  RefreshCw,
  StopCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DossierPageHeader,
  DossierSection,
} from "@/components/dossier/DossierPrimitives";
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";
import {
  AcquisitionSession,
  AcquisitionStartInput,
  deleteAcquisitionSession,
  getAcquisitionSessionStatus,
  respondToAcquisitionPrompt,
  startAcquisitionSession,
} from "@/lib/api/acquisitionClient";
import { processCreditReportPdfWithSessionApi } from "@/lib/api/equifaxSessionClient";

type FormState = AcquisitionStartInput;
type AcquisitionTarget = "experian" | "equifax" | "transunion" | "all";

type ImportState = {
  bureau: string | null;
  progress: number;
  stage: string;
  error: string | null;
};

const usStates = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const;

const suffixOptions = ["Jr.", "Sr.", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"] as const;
const bureauReviewOrder = [
  { key: "experian", label: "Experian" },
  { key: "equifax", label: "Equifax" },
  { key: "transunion", label: "TransUnion" },
] as const;

const acquisitionTargetOptions: Array<{ value: AcquisitionTarget; label: string; description: string }> = [
  { value: "experian", label: "Experian", description: "Current development lane. Uses the Experian confirmation-link flow." },
  { value: "equifax", label: "Equifax", description: "Previously confirmed single-bureau path." },
  { value: "transunion", label: "TransUnion", description: "Previously confirmed path. Requires landscape PDF capture." },
  { value: "all", label: "All three bureaus", description: "Selects Experian, Equifax, and TransUnion in one ACR request." },
];

const getAcquisitionTargetCopy = (target: AcquisitionTarget) =>
  acquisitionTargetOptions.find((option) => option.value === target) ?? acquisitionTargetOptions[0];

const defaultFormState: FormState = {
  firstName: "",
  middleInitial: "",
  lastName: "",
  suffix: "",
  birthDate: "",
  ssn: "",
  confirmSsn: "",
  email: "",
  phone: "",
  currentAddress1: "",
  currentAddress2: "",
  currentCity: "",
  currentState: "",
  currentZip: "",
  livedAtCurrentAddressTwoYearsOrMore: true,
  previousAddress1: "",
  previousAddress2: "",
  previousCity: "",
  previousState: "",
  previousZip: "",
  launchConsentAccepted: false,
  launchConsentName: "",
};

const acquisitionFormDraftStorageKey = "credit-clarify:acquisition-form-draft:v1";

type AcquisitionFormDraft = {
  formState?: Partial<FormState>;
  acquisitionTarget?: AcquisitionTarget;
  savedAt?: string;
};

const isAcquisitionTarget = (value: unknown): value is AcquisitionTarget =>
  value === "experian" || value === "equifax" || value === "transunion" || value === "all";

const defaultImportState: ImportState = {
  bureau: null,
  progress: 0,
  stage: "",
  error: null,
};

const formatBytes = (value: number | null) => {
  if (!value || value <= 0) {
    return "PDF ready";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const humanizeAgentIssue = (message: string | null | undefined) => {
  const value = String(message ?? "").trim();
  if (!value) {
    return null;
  }

  if (/sessionExpired\.action|session has expired/i.test(value)) {
    return "AnnualCreditReport.com reset the session before the request could continue. End the run and launch a fresh browser session.";
  }

  if (/suffix/i.test(value) && /selectoption|did not find some options|timeout/i.test(value)) {
    return "The site’s suffix field did not respond to automation. The agent can continue without suffix because that field is optional.";
  }

  if (/passcode|verification code|one-time/i.test(value)) {
    return "The agent is waiting for a verification code from the user before it can continue.";
  }

  if (/phone/i.test(value) && /required/i.test(value)) {
    return "The site needs the user’s own phone number so it can send a verification code.";
  }

  return value;
};


const AcquisitionField: React.FC<{
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, children }) => (
  <div className="space-y-2">
    <Label htmlFor={htmlFor} className="font-mono text-[0.72rem] uppercase tracking-[0.18em]">
      {label}
    </Label>
    {children}
  </div>
);

const AcquireReportsPage = () => {
  const navigate = useNavigate();
  const {
    activateExtractedReport,
    clearUserProfileReports,
    creditReport,
    isProcessing,
    setIsProcessing,
    setProcessingError,
    syncUserProfileReports,
    updateUserProfileReport,
    userProfileReports,
  } = useReportWorkspace();

  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [session, setSession] = useState<AcquisitionSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [importState, setImportState] = useState<ImportState>(defaultImportState);
  const [launchConsentOpen, setLaunchConsentOpen] = useState(false);
  const [launchConsentChecked, setLaunchConsentChecked] = useState(false);
  const [launchConsentName, setLaunchConsentName] = useState("");
  const [showPromptFallback, setShowPromptFallback] = useState(false);
  const [acquisitionTarget, setAcquisitionTarget] = useState<AcquisitionTarget>("experian");
  const [selectedReviewBureau, setSelectedReviewBureau] = useState("experian");
  const [isFormDraftLoaded, setIsFormDraftLoaded] = useState(false);
  const [savedFormDraftAt, setSavedFormDraftAt] = useState<string | null>(null);

  const sessionId = session?.sessionId ?? null;
  const stagedReportCount = userProfileReports.length;
  const hasActiveSession = Boolean(
    session && !["completed", "failed"].includes(session.status),
  );

  const formDisabled = hasActiveSession || isStarting || isEndingSession || isProcessing;

  const validationError = useMemo(() => {
    if (!formState.ssn || !formState.confirmSsn) {
      return null;
    }

    if (formState.ssn !== formState.confirmSsn) {
      return "Social Security Number and confirmation must match before you start the run.";
    }

    return null;
  }, [formState.confirmSsn, formState.ssn]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const clearSavedFormDraft = () => {
    window.localStorage.removeItem(acquisitionFormDraftStorageKey);
    setFormState(defaultFormState);
    setAcquisitionTarget("experian");
    setSavedFormDraftAt(null);
  };

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(acquisitionFormDraftStorageKey);
      if (rawDraft) {
        const draft = JSON.parse(rawDraft) as AcquisitionFormDraft;
        if (draft.formState && typeof draft.formState === "object") {
          setFormState({
            ...defaultFormState,
            ...draft.formState,
          });
        }
        if (isAcquisitionTarget(draft.acquisitionTarget)) {
          setAcquisitionTarget(draft.acquisitionTarget);
        }
        if (typeof draft.savedAt === "string") {
          setSavedFormDraftAt(draft.savedAt);
        }
      }
    } catch {
      window.localStorage.removeItem(acquisitionFormDraftStorageKey);
    } finally {
      setIsFormDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isFormDraftLoaded) {
      return;
    }

    const draft: AcquisitionFormDraft = {
      formState,
      acquisitionTarget,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(acquisitionFormDraftStorageKey, JSON.stringify(draft));
    setSavedFormDraftAt(draft.savedAt ?? null);
  }, [acquisitionTarget, formState, isFormDraftLoaded]);

  const refreshSession = async (nextSessionId: string, silent = false) => {
    if (!silent) {
      setIsRefreshing(true);
    }

    try {
      const nextSession = await getAcquisitionSessionStatus(nextSessionId);
      setSession(nextSession);
      setSessionError(nextSession.lastError ?? null);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Failed to refresh the browser session.");
    } finally {
      if (!silent) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let isCancelled = false;

    const tick = async () => {
      try {
        const nextSession = await getAcquisitionSessionStatus(sessionId);
        if (isCancelled) {
          return;
        }
        setSession(nextSession);
        setSessionError(nextSession.lastError ?? null);
      } catch (error) {
        if (!isCancelled) {
          setSessionError(error instanceof Error ? error.message : "Failed to refresh the browser session.");
        }
      }
    };

    void tick();

    if (session?.status === "completed" || session?.status === "failed") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void tick();
    }, 1500);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [session?.status, sessionId]);

  useEffect(() => {
    setPromptValue(session?.pendingPrompt?.defaultValue ?? "");
    setShowPromptFallback(false);
  }, [session?.pendingPrompt?.defaultValue, session?.pendingPrompt?.id]);

  useEffect(() => {
    const availableKey = bureauReviewOrder.find(({ key }) =>
      userProfileReports.some((report) => report.bureauKey === key),
    )?.key;

    if (availableKey && !userProfileReports.some((report) => report.bureauKey === selectedReviewBureau)) {
      setSelectedReviewBureau(availableKey);
    }
  }, [bureauReviewOrder, selectedReviewBureau, userProfileReports]);

  useEffect(() => {
    if (!session?.downloadedReports?.length) {
      return;
    }

    syncUserProfileReports(session.downloadedReports);
  }, [session?.downloadedReports, session?.updatedAt, syncUserProfileReports]);

  const handleStartSession = async (
    launchConsentAccepted = formState.launchConsentAccepted,
    launchConsentSignature = formState.launchConsentName,
  ) => {
    if (validationError) {
      setSessionError(validationError);
      return;
    }

    setIsStarting(true);
    setSessionError(null);

    try {
      const nextSession = await startAcquisitionSession({
        ...formState,
        launchConsentAccepted,
        launchConsentName: launchConsentSignature,
        targetBureau: acquisitionTarget === "all" ? undefined : acquisitionTarget,
        stopAfterFirstSavedReport: acquisitionTarget !== "all",
      });
      setFormState((current) => ({
        ...current,
        launchConsentAccepted,
        launchConsentName: launchConsentSignature,
      }));
      setSession(nextSession);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Failed to start the browser agent.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleLaunchBrowserClick = () => {
    if (validationError) {
      setSessionError(validationError);
      return;
    }

    setLaunchConsentChecked(false);
    setLaunchConsentName(
      [formState.firstName, formState.lastName].filter(Boolean).join(" ").trim(),
    );
    setLaunchConsentOpen(true);
  };

  const handleLaunchConsentConfirm = () => {
    if (!launchConsentChecked) {
      setSessionError("Confirm the interactive retrieval consent before launching the remote browser session.");
      return;
    }

    if (!launchConsentName.trim()) {
      setSessionError("Enter the consumer's name in the launch consent gate before starting the remote browser session.");
      return;
    }

    setLaunchConsentOpen(false);
    setLaunchConsentChecked(false);
    void handleStartSession(true, launchConsentName.trim());
  };

  const handlePromptSubmit = async (responseOverride?: string) => {
    if (!session?.pendingPrompt || !sessionId) {
      return;
    }

    const effectivePromptValue = (responseOverride ?? promptValue).trim();

    if (session.pendingPrompt.inputType === "text" && effectivePromptValue.length === 0) {
      setSessionError("Enter a value before submitting this prompt.");
      return;
    }

    setIsSubmittingPrompt(true);
    setSessionError(null);

    try {
      const nextSession = await respondToAcquisitionPrompt(
        sessionId,
        session.pendingPrompt.id,
        session.pendingPrompt.inputType === "text"
          ? { value: effectivePromptValue }
          : {},
      );
      setSession(nextSession);
      setPromptValue("");
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Failed to send the prompt response.");
    } finally {
      setIsSubmittingPrompt(false);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) {
      setSession(null);
      setSessionError(null);
      return;
    }

    setIsEndingSession(true);
    try {
      await deleteAcquisitionSession(sessionId);
      setSession(null);
      setSessionError(null);
      setPromptValue("");
      setImportState(defaultImportState);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Failed to end the browser session.");
    } finally {
      setIsEndingSession(false);
    }
  };

  const handleApproveExtraction = async () => {
    const pendingReports = userProfileReports.filter((report) => report.extractionStatus !== "ready");
    if (!pendingReports.length) {
      setImportState({
        bureau: "Profile",
        progress: 100,
        stage: "All staged reports have already been extracted.",
        error: null,
      });
      return;
    }

    setProcessingError(null);
    setSessionError(null);
    setIsProcessing(true);

    let failureCount = 0;

    try {
      for (let index = 0; index < pendingReports.length; index += 1) {
        const report = pendingReports[index];
        updateUserProfileReport(report.bureauKey, {
          extractionStatus: "processing",
          extractionError: null,
        });
        setImportState({
          bureau: report.bureau,
          progress: Math.round((index / pendingReports.length) * 100),
          stage: `Fetching the ${report.bureau} PDF from the profile...`,
          error: null,
        });

        try {
          const response = await fetch(report.downloadUrl);
          if (!response.ok) {
            throw new Error(`Failed to load the ${report.bureau} PDF from the staged profile.`);
          }

          const blob = await response.blob();
          const file = new File([blob], report.fileName, { type: "application/pdf" });

          const { report: parsedReport } = await processCreditReportPdfWithSessionApi(file, (update) => {
            setImportState({
              bureau: report.bureau,
              progress: Math.max(
                Math.round((index / pendingReports.length) * 100),
                Math.round(((index + update.progress / 100) / pendingReports.length) * 100),
              ),
              stage: update.stage,
              error: null,
            });
          });

          updateUserProfileReport(report.bureauKey, {
            extractionStatus: "ready",
            extractionError: null,
            extractedReport: parsedReport,
          });
        } catch (error) {
          failureCount += 1;
          const message =
            error instanceof Error ? error.message : `Failed to extract the ${report.bureau} profile report.`;
          updateUserProfileReport(report.bureauKey, {
            extractionStatus: "failed",
            extractionError: message,
          });
          setImportState({
            bureau: report.bureau,
            progress: Math.round(((index + 1) / pendingReports.length) * 100),
            stage: "",
            error: message,
          });
        }
      }
    } finally {
      setIsProcessing(false);
    }

    if (failureCount === 0) {
      setImportState({
        bureau: "Profile",
        progress: 100,
        stage: "All three staged reports were extracted successfully. Open any parsed report when you are ready.",
        error: null,
      });
    } else {
      setSessionError(`${failureCount} staged report${failureCount === 1 ? "" : "s"} failed during extraction.`);
    }
  };

  const handleOpenExtractedReport = async (bureauKey: string) => {
    const stagedReport = userProfileReports.find((report) => report.bureauKey === bureauKey);
    if (!stagedReport?.extractedReport) {
      return;
    }

    setSessionError(null);

    try {
      await activateExtractedReport(stagedReport.extractedReport);
      startTransition(() => navigate("/report"));
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Failed to open the extracted report.");
    }
  };

  const promptContextLabel = (() => {
    const prompt = session?.pendingPrompt;
    if (!prompt) {
      return null;
    }

    const segments = [];
    if (prompt.bureau) {
      segments.push(prompt.bureau);
    }

    if (prompt.contextUrl) {
      try {
        const url = new URL(prompt.contextUrl);
        segments.push(url.hostname.replace(/^www\./i, ""));
      } catch {
        segments.push(prompt.contextUrl);
      }
    }

    return segments.length ? segments.join(" / ") : null;
  })();

  return (
    <div className="dossier-page">
      <DossierPageHeader
        compact
        eyebrow="Dashboard / Guided Retrieval"
        title="Get Credit Reports"
        subtitle="Fill the intake, launch the isolated browser, stage the three bureau PDFs on the profile, and only extract them after explicit approval. The live prompts should appear inside the controlled browser window."
        actions={
          <div className="flex flex-wrap gap-3">
            {sessionId ? (
              <Button
                type="button"
                variant="outline"
                className="dossier-button"
                onClick={() => void refreshSession(sessionId)}
                disabled={isRefreshing}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Status
              </Button>
            ) : null}
            {creditReport ? (
              <Button
                type="button"
                className="dossier-button dossier-button-primary"
                onClick={() => navigate("/report")}
              >
                Open Active Report
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        }
      />

      <DossierSection>
        <div className="space-y-8">
            <div className="dossier-upload-panel space-y-8">
              <div className="space-y-6">
                <div>
                  <div className="mb-4 font-display text-[2rem] leading-none tracking-[-0.06em]">
                    User Intake
                  </div>
                  <p className="max-w-3xl text-sm leading-7 text-slate-500">
                    This information is used only for the live retrieval session. The screen does not persist it locally after the session ends.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <AcquisitionField label="First Name" htmlFor="acr-first-name">
                    <Input
                      id="acr-first-name"
                      value={formState.firstName}
                      onChange={(event) => updateField("firstName", event.target.value)}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                    />
                  </AcquisitionField>
                  <AcquisitionField label="Last Name" htmlFor="acr-last-name">
                    <Input
                      id="acr-last-name"
                      value={formState.lastName}
                      onChange={(event) => updateField("lastName", event.target.value)}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                    />
                  </AcquisitionField>
                  <AcquisitionField label="Middle Initial" htmlFor="acr-middle-initial">
                    <Input
                      id="acr-middle-initial"
                      value={formState.middleInitial}
                      onChange={(event) => updateField("middleInitial", event.target.value)}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                      maxLength={1}
                    />
                  </AcquisitionField>
                  <AcquisitionField label="Suffix" htmlFor="acr-suffix">
                    <Select
                      value={formState.suffix || "__none__"}
                      onValueChange={(value) => updateField("suffix", value === "__none__" ? "" : value)}
                      disabled={formDisabled}
                    >
                      <SelectTrigger id="acr-suffix" className="rounded-none border-black">
                        <SelectValue placeholder="Select suffix" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No suffix</SelectItem>
                        {suffixOptions.map((suffix) => (
                          <SelectItem key={suffix} value={suffix}>
                            {suffix}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AcquisitionField>
                  <AcquisitionField label="Date of Birth (MM-DD-YYYY)" htmlFor="acr-birth-date">
                    <Input
                      id="acr-birth-date"
                      value={formState.birthDate}
                      onChange={(event) => updateField("birthDate", event.target.value)}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                      placeholder="MM-DD-YYYY"
                    />
                  </AcquisitionField>
                  <AcquisitionField label="Email Address" htmlFor="acr-email">
                    <Input
                      id="acr-email"
                      type="email"
                      value={formState.email}
                      onChange={(event) => updateField("email", event.target.value)}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                    />
                  </AcquisitionField>
                  <AcquisitionField label="Social Security Number" htmlFor="acr-ssn">
                    <Input
                      id="acr-ssn"
                      value={formState.ssn}
                      onChange={(event) => updateField("ssn", event.target.value)}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                    />
                  </AcquisitionField>
                  <AcquisitionField label="Confirm Social Security Number" htmlFor="acr-confirm-ssn">
                    <Input
                      id="acr-confirm-ssn"
                      value={formState.confirmSsn}
                      onChange={(event) => updateField("confirmSsn", event.target.value)}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                    />
                  </AcquisitionField>
                  <AcquisitionField label="Phone Number" htmlFor="acr-phone">
                    <Input
                      id="acr-phone"
                      value={formState.phone}
                      onChange={(event) => updateField("phone", event.target.value)}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                    />
                  </AcquisitionField>
                </div>
              </div>

              <div className="space-y-6">
                <div className="font-display text-[2rem] leading-none tracking-[-0.06em]">
                  Current Address
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <AcquisitionField label="Address Line 1" htmlFor="acr-current-address-1">
                      <Input
                        id="acr-current-address-1"
                        value={formState.currentAddress1}
                        onChange={(event) => updateField("currentAddress1", event.target.value)}
                        disabled={formDisabled}
                        className="rounded-none border-black"
                      />
                    </AcquisitionField>
                  </div>
                  <div className="md:col-span-2">
                    <AcquisitionField label="Address Line 2" htmlFor="acr-current-address-2">
                      <Input
                        id="acr-current-address-2"
                        value={formState.currentAddress2}
                        onChange={(event) => updateField("currentAddress2", event.target.value)}
                        disabled={formDisabled}
                        className="rounded-none border-black"
                      />
                    </AcquisitionField>
                  </div>
                  <AcquisitionField label="City" htmlFor="acr-current-city">
                    <Input
                      id="acr-current-city"
                      value={formState.currentCity}
                      onChange={(event) => updateField("currentCity", event.target.value)}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                    />
                  </AcquisitionField>
                  <AcquisitionField label="State" htmlFor="acr-current-state">
                    <Select
                      value={formState.currentState || "__none__"}
                      onValueChange={(value) => updateField("currentState", value === "__none__" ? "" : value)}
                      disabled={formDisabled}
                    >
                      <SelectTrigger id="acr-current-state" className="rounded-none border-black">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select state</SelectItem>
                        {usStates.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AcquisitionField>
                  <AcquisitionField label="ZIP Code" htmlFor="acr-current-zip">
                    <Input
                      id="acr-current-zip"
                      value={formState.currentZip}
                      onChange={(event) => updateField("currentZip", event.target.value)}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                    />
                  </AcquisitionField>
                </div>

                <div className="space-y-3">
                  <div className="font-mono text-[0.72rem] uppercase tracking-[0.18em]">
                    Have you lived at this address for two years or more?
                  </div>
                  <RadioGroup
                    value={formState.livedAtCurrentAddressTwoYearsOrMore ? "yes" : "no"}
                    onValueChange={(value) => updateField("livedAtCurrentAddressTwoYearsOrMore", value === "yes")}
                    className="flex flex-col gap-3 md:flex-row"
                    disabled={formDisabled}
                  >
                    <div className="flex items-center gap-3 border border-black bg-white px-4 py-3">
                      <RadioGroupItem value="yes" id="acr-address-duration-yes" />
                      <Label htmlFor="acr-address-duration-yes">Yes, two years or more</Label>
                    </div>
                    <div className="flex items-center gap-3 border border-black bg-white px-4 py-3">
                      <RadioGroupItem value="no" id="acr-address-duration-no" />
                      <Label htmlFor="acr-address-duration-no">No, less than two years</Label>
                    </div>
                  </RadioGroup>
                </div>

                {!formState.livedAtCurrentAddressTwoYearsOrMore ? (
                  <div className="space-y-6 border border-dashed border-black bg-white p-5">
                    <div className="font-mono text-[0.72rem] uppercase tracking-[0.18em]">
                      Previous Address
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <AcquisitionField label="Previous Address Line 1" htmlFor="acr-previous-address-1">
                          <Input
                            id="acr-previous-address-1"
                            value={formState.previousAddress1}
                            onChange={(event) => updateField("previousAddress1", event.target.value)}
                            disabled={formDisabled}
                            className="rounded-none border-black"
                          />
                        </AcquisitionField>
                      </div>
                      <div className="md:col-span-2">
                        <AcquisitionField label="Previous Address Line 2" htmlFor="acr-previous-address-2">
                          <Input
                            id="acr-previous-address-2"
                            value={formState.previousAddress2}
                            onChange={(event) => updateField("previousAddress2", event.target.value)}
                            disabled={formDisabled}
                            className="rounded-none border-black"
                          />
                        </AcquisitionField>
                      </div>
                      <AcquisitionField label="Previous City" htmlFor="acr-previous-city">
                        <Input
                          id="acr-previous-city"
                          value={formState.previousCity}
                          onChange={(event) => updateField("previousCity", event.target.value)}
                          disabled={formDisabled}
                          className="rounded-none border-black"
                        />
                      </AcquisitionField>
                      <AcquisitionField label="Previous State" htmlFor="acr-previous-state">
                        <Select
                          value={formState.previousState || "__none__"}
                          onValueChange={(value) => updateField("previousState", value === "__none__" ? "" : value)}
                          disabled={formDisabled}
                        >
                          <SelectTrigger id="acr-previous-state" className="rounded-none border-black">
                            <SelectValue placeholder="Select previous state" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Select state</SelectItem>
                            {usStates.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </AcquisitionField>
                      <AcquisitionField label="Previous ZIP Code" htmlFor="acr-previous-zip">
                        <Input
                          id="acr-previous-zip"
                          value={formState.previousZip}
                          onChange={(event) => updateField("previousZip", event.target.value)}
                          disabled={formDisabled}
                          className="rounded-none border-black"
                        />
                      </AcquisitionField>
                    </div>
                  </div>
                ) : null}
              </div>

              {validationError ? (
                <Alert variant="destructive">
                  <AlertTitle>Check the SSN fields</AlertTitle>
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="rounded-none border border-black/15 bg-white/80 p-4">
                <div className="grid gap-3 md:grid-cols-[260px_1fr_auto] md:items-end">
                  <AcquisitionField label="Retrieval target" htmlFor="acr-acquisition-target">
                    <Select
                      value={acquisitionTarget}
                      onValueChange={(value) => setAcquisitionTarget(value as AcquisitionTarget)}
                      disabled={formDisabled}
                    >
                      <SelectTrigger id="acr-acquisition-target" className="rounded-none border-black">
                        <SelectValue placeholder="Select bureau" />
                      </SelectTrigger>
                      <SelectContent>
                        {acquisitionTargetOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </AcquisitionField>
                  <p className="text-sm leading-6 text-slate-500">
                    {getAcquisitionTargetCopy(acquisitionTarget).description}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 md:justify-end">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      {savedFormDraftAt ? "Draft saved locally" : "Local draft ready"}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearSavedFormDraft}
                      disabled={formDisabled}
                      className="rounded-none border-black"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </div>

              {sessionError ? (
                <Alert variant="destructive">
                  <AlertTitle>Launch issue</AlertTitle>
                  <AlertDescription>{humanizeAgentIssue(sessionError) ?? sessionError}</AlertDescription>
                </Alert>
              ) : null}

              {session?.pendingPrompt ? (
                <Alert>
                  <AlertTitle>Browser prompt is active</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      The controlled browser window is waiting for user input on the visible verification page. Use the browser dialog first.
                    </p>
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        className="dossier-button"
                        onClick={() => setShowPromptFallback(true)}
                        disabled={isSubmittingPrompt}
                      >
                        Use page fallback
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="dossier-button dossier-button-primary"
                  onClick={handleLaunchBrowserClick}
                  disabled={formDisabled || Boolean(validationError)}
                >
                  <Bot className="h-4 w-4" />
                  {isStarting ? "Launching Agent Browser..." : "Launch Agent Browser"}
                </Button>
                {sessionId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="dossier-button"
                    onClick={() => void handleEndSession()}
                    disabled={isEndingSession}
                  >
                    <StopCircle className="h-4 w-4" />
                    {isEndingSession ? "Ending Session..." : "End Session"}
                  </Button>
                ) : null}
              </div>
            </div>

            {userProfileReports.length ? (
              <div className="dossier-upload-panel space-y-6">
                <div>
                  <div className="font-display text-[2rem] leading-none tracking-[-0.06em]">
                    Profile Staging
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    This works like a CRM profile intake: the three bureau source PDFs are staged first, then extraction
                    starts only when you approve it.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className="dossier-button dossier-button-primary"
                    onClick={() => void handleApproveExtraction()}
                    disabled={isProcessing || hasActiveSession}
                  >
                    <FileDown className="h-4 w-4" />
                    Approve Extraction
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="dossier-button"
                    onClick={() => {
                      clearUserProfileReports();
                      setImportState(defaultImportState);
                    }}
                    disabled={isProcessing}
                  >
                    Clear Profile State
                  </Button>
                </div>

                <div className="grid gap-4">
                  {userProfileReports.map((report) => (
                    <div key={report.bureauKey} className="border border-black bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-slate-500">
                            {report.bureau}
                          </div>
                          <div className="mt-2 font-display text-[1.65rem] leading-none tracking-[-0.05em]">
                            {report.fileName}
                          </div>
                          <div className="mt-3 text-sm text-slate-500">{formatBytes(report.sizeBytes)}</div>
                          <div className="mt-3 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-slate-500">
                            Extraction status: {report.extractionStatus.replace(/_/g, " ")}
                          </div>
                          {report.extractionError ? (
                            <div className="mt-2 text-sm leading-6 text-red-600">{report.extractionError}</div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="dossier-button"
                            onClick={() => window.open(report.downloadUrl, "_blank", "noopener,noreferrer")}
                          >
                            <Download className="h-4 w-4" />
                            Download PDF
                          </Button>
                          <Button
                            type="button"
                            className="dossier-button dossier-button-primary"
                            onClick={() => void handleOpenExtractedReport(report.bureauKey)}
                            disabled={!report.extractedReport || isProcessing}
                          >
                            <FileDown className="h-4 w-4" />
                            Open Parsed Report
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border border-black bg-white p-5">
                  <div className="mb-4">
                    <div className="font-display text-[1.8rem] leading-none tracking-[-0.05em]">
                      Isolated Bureau Review
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-500">
                      After approval, each bureau stays separate. These tabs do not compare reports or merge data.
                    </p>
                  </div>

                  <Tabs value={selectedReviewBureau} onValueChange={setSelectedReviewBureau}>
                    <TabsList className="grid h-auto w-full grid-cols-3 gap-2 border-0 bg-transparent p-0">
                      {bureauReviewOrder.map(({ key, label }) => {
                        const report = userProfileReports.find((entry) => entry.bureauKey === key);
                        const status = report?.extractionStatus ?? "not_extracted";
                        return (
                          <TabsTrigger
                            key={key}
                            value={key}
                            className="rounded-none border border-black bg-white data-[state=active]:bg-black data-[state=active]:text-white"
                          >
                            <span className="flex flex-col items-start text-left">
                              <span>{label}</span>
                              <span className="text-[0.7rem] uppercase tracking-[0.14em] opacity-70">
                                {status.replace(/_/g, " ")}
                              </span>
                            </span>
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    {bureauReviewOrder.map(({ key, label }) => {
                      const report = userProfileReports.find((entry) => entry.bureauKey === key) ?? null;
                      const parsedReport = report?.extractedReport ?? null;
                      return (
                        <TabsContent key={`${key}-content`} value={key} className="mt-5">
                          <div className="border border-dashed border-black bg-[#fbfaf7] p-5">
                            {report ? (
                              <div className="space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div>
                                    <div className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-slate-500">
                                      {label}
                                    </div>
                                    <div className="mt-2 font-display text-[1.5rem] leading-none tracking-[-0.05em]">
                                      {report.fileName}
                                    </div>
                                    <div className="mt-3 text-sm leading-7 text-slate-500">
                                      Extraction status: {report.extractionStatus.replace(/_/g, " ")}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-3">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="dossier-button"
                                      onClick={() => window.open(report.downloadUrl, "_blank", "noopener,noreferrer")}
                                    >
                                      <Download className="h-4 w-4" />
                                      Download PDF
                                    </Button>
                                    <Button
                                      type="button"
                                      className="dossier-button dossier-button-primary"
                                      onClick={() => void handleOpenExtractedReport(report.bureauKey)}
                                      disabled={!parsedReport || isProcessing}
                                    >
                                      <ArrowRight className="h-4 w-4" />
                                      Open Parsed Report
                                    </Button>
                                  </div>
                                </div>

                                {report.extractionError ? (
                                  <div className="text-sm leading-7 text-red-600">{report.extractionError}</div>
                                ) : null}

                                {parsedReport ? (
                                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="border border-black bg-white p-4">
                                      <div className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
                                        Report Date
                                      </div>
                                      <div className="mt-2 text-sm leading-7 text-slate-700">
                                        {parsedReport.reportDate || "Not available"}
                                      </div>
                                    </div>
                                    <div className="border border-black bg-white p-4">
                                      <div className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
                                        Accounts
                                      </div>
                                      <div className="mt-2 text-sm leading-7 text-slate-700">
                                        {parsedReport.accounts?.length ?? 0}
                                      </div>
                                    </div>
                                    <div className="border border-black bg-white p-4">
                                      <div className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
                                        Inquiries
                                      </div>
                                      <div className="mt-2 text-sm leading-7 text-slate-700">
                                        {parsedReport.inquiries?.length ?? 0}
                                      </div>
                                    </div>
                                    <div className="border border-black bg-white p-4">
                                      <div className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">
                                        Collections
                                      </div>
                                      <div className="mt-2 text-sm leading-7 text-slate-700">
                                        {parsedReport.collections?.length ?? 0}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-sm leading-7 text-slate-500">
                                    {report.extractionStatus === "pending_approval"
                                      ? "This staged report is waiting on Approve Extraction."
                                      : report.extractionStatus === "processing"
                                        ? "This bureau is being extracted right now."
                                        : report.extractionStatus === "failed"
                                          ? "This bureau failed during extraction. Fix the issue and rerun extraction when ready."
                                          : "No parsed report is available yet."}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm leading-7 text-slate-500">
                                {label} has not been staged yet. The tab remains isolated so the user can review each bureau separately once it is available.
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </div>

                {importState.bureau || importState.stage || importState.error ? (
                  <div className="space-y-3 border border-dashed border-black bg-white p-5">
                    <div className="font-mono text-[0.72rem] uppercase tracking-[0.18em]">
                      {importState.bureau ? `Extracting ${importState.bureau}` : "Profile Extraction"}
                    </div>
                    <div className="text-sm leading-7 text-slate-600">
                      {importState.error || importState.stage}
                    </div>
                    <Progress value={importState.progress} className="h-2 rounded-none bg-slate-200" />
                  </div>
                ) : null}
              </div>
            ) : null}
        </div>
      </DossierSection>

      <Dialog open={Boolean(session?.pendingPrompt) && showPromptFallback} onOpenChange={setShowPromptFallback}>
        <DialogContent
          className="rounded-none border-black bg-[#fbfaf7]"
        >
          <DialogHeader>
            <div className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-slate-500">
              Page Fallback
            </div>
            <DialogTitle>{session?.pendingPrompt?.title || "User input required"}</DialogTitle>
            <DialogDescription className="text-sm leading-7 text-slate-600">
              {session?.pendingPrompt?.description} Use this fallback only if the controlled browser dialog does not appear.
            </DialogDescription>
          </DialogHeader>

          {session?.pendingPrompt?.inputType === "text" ? (
            <div className="space-y-2">
              <Label
                htmlFor="acr-prompt-response"
                className="font-mono text-[0.72rem] uppercase tracking-[0.18em]"
              >
                Response
              </Label>
              <Input
                id="acr-prompt-response"
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                className="rounded-none border-black bg-white"
                placeholder={session.pendingPrompt.placeholder || "Enter response"}
              />
            </div>
          ) : null}

          {promptContextLabel ? (
            <div className="border border-black bg-white px-4 py-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-slate-500">
              Browser page: {promptContextLabel}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              className="dossier-button dossier-button-primary"
              onClick={() => void handlePromptSubmit()}
              disabled={isSubmittingPrompt}
            >
              {isSubmittingPrompt
                ? "Submitting..."
                : session?.pendingPrompt?.submitLabel || "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={launchConsentOpen} onOpenChange={setLaunchConsentOpen}>
        <DialogContent className="rounded-none border-black">
          <DialogHeader>
            <DialogTitle>Start interactive retrieval session</DialogTitle>
            <DialogDescription>
              This launches a remote-controlled isolated browser session and keeps the user prompts inside that browser window whenever phone, OTP, or security-question input is required.
            </DialogDescription>
          </DialogHeader>

          <div className="border border-black bg-[#fbfaf7] p-4 text-sm leading-7 text-slate-700">
            <div className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-slate-500">
              Required Notice
            </div>
            <p className="mt-2">
              THIS NOTICE IS REQUIRED BY LAW. Read more at{" "}
              <a
                href="https://www.consumerfinance.gov/learnmore"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                consumerfinance.gov/learnmore
              </a>
              .
            </p>
            <p className="mt-2">
              You have the right to a free credit report from{" "}
              <a
                href="https://www.annualcreditreport.com"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                AnnualCreditReport.com
              </a>
              {" "}or 877-322-8228, the only authorized source under federal law.
            </p>
          </div>

          <label className="flex items-start gap-3 border border-black bg-[#fbfaf7] p-4 text-sm leading-7 text-slate-600">
            <Checkbox
              checked={launchConsentChecked}
              onCheckedChange={(checked) => setLaunchConsentChecked(checked === true)}
            />
            <span>
              I instruct this application to use the official AnnualCreditReport.com process to obtain my credit reports in an isolated browser session. I understand the browser agent will keep control until my own input is required, and the bureau PDFs will be staged before extraction is approved.
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="acr-launch-consent-name" className="font-mono text-[0.72rem] uppercase tracking-[0.18em]">
              Electronic Signature
            </Label>
            <Input
              id="acr-launch-consent-name"
              value={launchConsentName}
              onChange={(event) => setLaunchConsentName(event.target.value)}
              className="rounded-none border-black"
              placeholder="Type the consumer's full name"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none border-black"
              onClick={() => setLaunchConsentOpen(false)}
              disabled={isStarting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="dossier-button dossier-button-primary"
              onClick={() => void handleLaunchConsentConfirm()}
              disabled={!launchConsentChecked || isStarting}
            >
              {isStarting ? "Launching Agent Browser..." : "Launch Browser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcquireReportsPage;
