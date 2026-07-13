import React, {
  useCallback,
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cleanupReportSession } from "@/lib/api/equifaxSessionClient";
import { CreditReport, RetrievedCreditReportAsset } from "@/lib/types/creditReport";
import { useToast } from "@/hooks/use-toast";
import { getReportReference } from "@/utils/reportDisplay";
import { devDiagnostics } from "@/lib/security/devDiagnostics";
import type { SessionProgressUpdate } from "@/lib/api/equifaxSessionClient";
import { preloadInitialDisputeWorkspace } from "@/features/dispute-letters/bootstrap";

type ProtectedDestination = "report" | "dispute";

interface ReportWorkspaceContextValue {
  creditReport: CreditReport | null;
  userProfileReports: RetrievedCreditReportAsset[];
  isProcessing: boolean;
  processingError: string | null;
  showDebugger: boolean;
  advancedUiEnabled: boolean;
  reportReference: string;
  environmentLabel: string;
  hasReport: boolean;
  hasRetrievedReports: boolean;
  setIsProcessing: (processing: boolean) => void;
  setShowDebugger: (value: boolean) => void;
  setAdvancedUiEnabled: (value: boolean) => void;
  setProcessingError: (value: string | null) => void;
  syncUserProfileReports: (
    reports: Array<
      Pick<RetrievedCreditReportAsset, "bureau" | "bureauKey" | "fileName" | "downloadUrl" | "sizeBytes" | "createdAt">
    >,
  ) => void;
  updateUserProfileReport: (bureauKey: string, patch: Partial<RetrievedCreditReportAsset>) => void;
  clearUserProfileReports: () => void;
  activateExtractedReport: (report: CreditReport) => Promise<void>;
  handlePDFUploaded: (
    file: File,
    text: string,
    parsedReport?: CreditReport,
    options?: { onProgress?: (update: SessionProgressUpdate) => void },
  ) => Promise<void>;
  handleProcessingComplete: () => void;
  refreshApp: () => void;
  requestProtectedRoute: (destination: ProtectedDestination) => boolean;
  openProtectedRoute: (destination: ProtectedDestination) => void;
}

const ReportWorkspaceContext = createContext<ReportWorkspaceContextValue | null>(null);
const WORKSPACE_REPORT_STORAGE_KEY = "credit-clarifier.active-report";
const WORKSPACE_REPORT_STORAGE_VERSION = 1;
const ADVANCED_UI_STORAGE_KEY = "credit-clarifier.advanced-ui";

const readStoredReport = (): CreditReport | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(WORKSPACE_REPORT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { version?: number; report?: CreditReport | null };
    if (parsed?.version !== WORKSPACE_REPORT_STORAGE_VERSION || !parsed.report) {
      return null;
    }

    return parsed.report;
  } catch (error) {
    devDiagnostics.warn("Failed to restore stored report workspace state.", error);
    return null;
  }
};

const writeStoredReport = (report: CreditReport | null) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!report) {
      window.sessionStorage.removeItem(WORKSPACE_REPORT_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(
      WORKSPACE_REPORT_STORAGE_KEY,
      JSON.stringify({
        version: WORKSPACE_REPORT_STORAGE_VERSION,
        report,
      }),
    );
  } catch (error) {
    devDiagnostics.warn("Failed to persist report workspace state.", error);
  }
};

const readStoredAdvancedUi = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(ADVANCED_UI_STORAGE_KEY) === "true";
  } catch (error) {
    devDiagnostics.warn("Failed to restore advanced UI preference.", error);
    return false;
  }
};

const writeStoredAdvancedUi = (enabled: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ADVANCED_UI_STORAGE_KEY, String(enabled));
  } catch (error) {
    devDiagnostics.warn("Failed to persist advanced UI preference.", error);
  }
};

const protectedRouteMeta: Record<ProtectedDestination, { title: string; missing: string }> = {
  report: {
    title: "No report available",
    missing: "Please upload a credit report first.",
  },
  dispute: {
    title: "No report available",
    missing: "Upload and process a credit report before building a dispute letter.",
  },
};

export const ReportWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const restoredReportRef = useRef<CreditReport | null>(readStoredReport());
  const [creditReport, setCreditReport] = useState<CreditReport | null>(restoredReportRef.current);
  const [userProfileReports, setUserProfileReports] = useState<RetrievedCreditReportAsset[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);
  const [advancedUiEnabled, setAdvancedUiEnabled] = useState(readStoredAdvancedUi);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const lastAnnouncedReportIdRef = useRef<string | null>(
    restoredReportRef.current?.reportId ?? restoredReportRef.current?.fileName ?? null,
  );
  const activeSessionIdRef = useRef<string | null>(restoredReportRef.current?.sourceSessionId ?? null);

  const handlePDFUploaded = useCallback(async (
    _file: File,
    _text: string,
    parsedReport?: CreditReport,
    options?: { onProgress?: (update: SessionProgressUpdate) => void },
  ) => {
    try {
      setProcessingError(null);
      if (parsedReport) {
        options?.onProgress?.({ progress: 72, stage: "Preparing report workspace..." });
        await preloadInitialDisputeWorkspace(parsedReport, options?.onProgress);
        options?.onProgress?.({ progress: 100, stage: "Workspace ready." });
        setCreditReport(parsedReport);
      } else {
        toast({
          title: "Using basic parsing",
          description: "Using simplified extraction.",
          variant: "default",
        });
      }
    } catch (error) {
      devDiagnostics.error("Error processing credit report:", error);
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Failed to process the credit report. Please try again.";
      setProcessingError(message);
      toast({
        title: "Processing Error",
        description: message,
        variant: "destructive",
      });
      throw error instanceof Error ? error : new Error(message);
    }
  }, [toast]);

  const handleProcessingComplete = useCallback(() => {
    setIsProcessing(false);
  }, []);

  const syncUserProfileReports = useCallback((
    reports: Array<
      Pick<RetrievedCreditReportAsset, "bureau" | "bureauKey" | "fileName" | "downloadUrl" | "sizeBytes" | "createdAt">
    >,
  ) => {
    setUserProfileReports((current) =>
      reports.map((report) => {
        const existing = current.find((entry) => entry.bureauKey === report.bureauKey);
        return {
          ...report,
          extractionStatus: existing?.extractionStatus ?? "pending_approval",
          extractionError: existing?.extractionError ?? null,
          extractedReport: existing?.extractedReport ?? null,
        };
      }),
    );
  }, []);

  const updateUserProfileReport = useCallback((bureauKey: string, patch: Partial<RetrievedCreditReportAsset>) => {
    setUserProfileReports((current) =>
      current.map((report) =>
        report.bureauKey === bureauKey
          ? {
              ...report,
              ...patch,
            }
          : report,
      ),
    );
  }, []);

  const clearUserProfileReports = useCallback(() => {
    setUserProfileReports((current) => {
      current.forEach((report) => {
        const sessionId = report.extractedReport?.sourceSessionId;
        if (sessionId && sessionId !== creditReport?.sourceSessionId) {
          void cleanupReportSession(sessionId);
        }
      });
      return [];
    });
  }, [creditReport?.sourceSessionId]);

  const activateExtractedReport = useCallback(async (report: CreditReport) => {
    setIsProcessing(true);
    setProcessingError(null);

    try {
      await preloadInitialDisputeWorkspace(report);
      setCreditReport(report);
    } catch (error) {
      devDiagnostics.error("Error activating extracted report:", error);
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Failed to open the extracted credit report.";
      setProcessingError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const requestProtectedRoute = useCallback((destination: ProtectedDestination) => {
    if (isProcessing) {
      toast({
        title: "Still processing",
        description: "Please wait for the PDF processing to complete.",
        variant: "default",
      });
      return false;
    }

    if (!creditReport) {
      const routeMeta = protectedRouteMeta[destination];
      toast({
        title: routeMeta.title,
        description: routeMeta.missing,
        variant: "default",
      });
      return false;
    }

    return true;
  }, [creditReport, isProcessing, toast]);

  const openProtectedRoute = useCallback((destination: ProtectedDestination) => {
    if (!requestProtectedRoute(destination)) {
      return;
    }

    const nextPath = destination === "report" ? "/report" : "/dispute";
    startTransition(() => navigate(nextPath));
  }, [navigate, requestProtectedRoute]);

  useEffect(() => {
    if (!creditReport || isProcessing) {
      return;
    }

    const reportIdentity = creditReport.reportId ?? creditReport.fileName ?? "report";
    if (lastAnnouncedReportIdRef.current === reportIdentity) {
      return;
    }

    lastAnnouncedReportIdRef.current = reportIdentity;
    toast({
      title: "Credit Report Ready",
      description: creditReport.bureau
        ? `Your ${creditReport.bureau} credit report is ready to view.`
        : "Your credit report is ready to view.",
    });

    if (location.pathname === "/" || location.pathname === "/upload" || location.pathname === "/reports/upload") {
      startTransition(() => navigate("/report"));
    }
  }, [creditReport, isProcessing, location.pathname, navigate, toast]);

  useEffect(() => {
    const nextSessionId = creditReport?.sourceSessionId ?? null;
    const previousSessionId = activeSessionIdRef.current;
    if (previousSessionId && previousSessionId !== nextSessionId) {
      void cleanupReportSession(previousSessionId);
    }
    activeSessionIdRef.current = nextSessionId;
  }, [creditReport?.sourceSessionId]);

  useEffect(() => {
    writeStoredReport(creditReport);
  }, [creditReport]);

  useEffect(() => {
    writeStoredAdvancedUi(advancedUiEnabled);
    if (!advancedUiEnabled) {
      setShowDebugger(false);
    }
  }, [advancedUiEnabled]);

  const value = useMemo<ReportWorkspaceContextValue>(
    () => ({
      creditReport,
      userProfileReports,
      isProcessing,
      processingError,
      showDebugger,
      advancedUiEnabled,
      reportReference:
        getReportReference(creditReport, "No active report"),
      environmentLabel: import.meta.env.MODE === "production" ? "Production" : "Development",
      hasReport: Boolean(creditReport),
      hasRetrievedReports: userProfileReports.length > 0,
      setIsProcessing,
      setShowDebugger,
      setAdvancedUiEnabled,
      setProcessingError,
      syncUserProfileReports,
      updateUserProfileReport,
      clearUserProfileReports,
      activateExtractedReport,
      handlePDFUploaded,
      handleProcessingComplete,
      refreshApp: () => window.location.reload(),
      requestProtectedRoute,
      openProtectedRoute,
    }),
    [
      creditReport,
      userProfileReports,
      handlePDFUploaded,
      handleProcessingComplete,
      isProcessing,
      openProtectedRoute,
      processingError,
      requestProtectedRoute,
      advancedUiEnabled,
      showDebugger,
      syncUserProfileReports,
      updateUserProfileReport,
      clearUserProfileReports,
      activateExtractedReport,
    ],
  );

  return <ReportWorkspaceContext.Provider value={value}>{children}</ReportWorkspaceContext.Provider>;
};

export const useReportWorkspace = () => {
  const context = useContext(ReportWorkspaceContext);
  if (!context) {
    throw new Error("useReportWorkspace must be used within a ReportWorkspaceProvider");
  }
  return context;
};
