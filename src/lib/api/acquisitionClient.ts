export interface AcquisitionPromptChoice {
  value: string;
  label: string;
}

export interface AcquisitionPromptQuestionChoice {
  value: string;
  label: string;
}

export interface AcquisitionPromptQuestion {
  id: string;
  prompt: string;
  answerType: "single_choice" | "text";
  choices?: AcquisitionPromptQuestionChoice[];
  placeholder?: string;
}

export interface AcquisitionPrompt {
  id: string;
  type:
    | "contact_confirm"
    | "otp_code"
    | "security_question"
    | "security_questionnaire"
    | "manual_continue";
  inputType: "confirm" | "text" | "choice";
  title: string;
  description: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  choices?: AcquisitionPromptChoice[];
  questions?: AcquisitionPromptQuestion[];
  bureau?: string | null;
  contextUrl?: string | null;
  createdAt: string;
}

export interface AcquiredReport {
  bureau: string;
  bureauKey: string;
  fileName: string;
  sizeBytes: number | null;
  createdAt: string;
  downloadUrl: string;
  captureMethod?: "download" | "print_view_pdf" | "fallback_pdf";
}

export interface AcquisitionLogEntry {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

export interface AcquisitionActivityEntry {
  id: string;
  kind: string;
  title: string;
  detail: string;
  status: string;
  createdAt: string;
}

export interface AcquisitionControllerState {
  channel: string;
  status: "booting" | "driving" | "waiting_for_user" | "recovery" | "takeover" | "completed" | "failed";
  ready: boolean;
  readyAt: string | null;
  source: string | null;
  lastChangedAt: string;
}

export interface AcquisitionRecoveryState {
  status: "idle" | "running" | "resolved" | "handoff";
  attemptCount: number;
  lastDecision: string | null;
  lastSummary: string | null;
  screenshotPath: string | null;
  updatedAt: string;
}

export interface AcquisitionSession {
  sessionId: string;
  status: "created" | "running" | "waiting_for_user" | "completed" | "failed";
  controlMode: AcquisitionControllerState["status"];
  progress: {
    progress: number;
    stage: string;
  };
  currentBureau: string | null;
  currentStep: string;
  currentUrl: string | null;
  lastAction: string | null;
  retryCount: number;
  expectedPageType?: string | null;
  observedPageType?: string | null;
  pageConfidence?: number | null;
  matchedSignals?: string[];
  recoveryState: AcquisitionRecoveryState;
  pendingPrompt: AcquisitionPrompt | null;
  downloadedReports: AcquiredReport[];
  controller: AcquisitionControllerState;
  activities: AcquisitionActivityEntry[];
  lastError: string | null;
  logs: AcquisitionLogEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface AcquisitionStartInput {
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix: string;
  birthDate: string;
  ssn: string;
  confirmSsn: string;
  email: string;
  phone: string;
  currentAddress1: string;
  currentAddress2: string;
  currentCity: string;
  currentState: string;
  currentZip: string;
  livedAtCurrentAddressTwoYearsOrMore: boolean;
  previousAddress1: string;
  previousAddress2: string;
  previousCity: string;
  previousState: string;
  previousZip: string;
  launchConsentAccepted: boolean;
  launchConsentName: string;
  targetBureau?: string;
  stopAfterFirstSavedReport?: boolean;
}

const ensureOk = async (response: Response, fallbackMessage: string) => {
  if (response.ok) {
    return;
  }

  let message = fallbackMessage;
  try {
    const payload = await response.json();
    if (typeof payload?.error === "string") {
      message = payload.error;
    }
  } catch {
    // keep fallback
  }

  throw new Error(message);
};

const readSessionResponse = async (response: Response, fallbackMessage: string): Promise<AcquisitionSession> => {
  await ensureOk(response, fallbackMessage);
  const payload = await response.json();
  return payload.session as AcquisitionSession;
};

export const startAcquisitionSession = async (input: AcquisitionStartInput) => {
  const response = await fetch("/api/acquisition/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return readSessionResponse(response, "Failed to start the guided retrieval session.");
};

export const getAcquisitionSessionStatus = async (sessionId: string) => {
  const response = await fetch(`/api/acquisition/sessions/${sessionId}/status`, {
    method: "GET",
    cache: "no-store",
  });

  return readSessionResponse(response, "Failed to refresh the acquisition session.");
};

export const respondToAcquisitionPrompt = async (
  sessionId: string,
  promptId: string,
  responseValue: Record<string, unknown> = {},
) => {
  const response = await fetch(`/api/acquisition/sessions/${sessionId}/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      promptId,
      response: responseValue,
    }),
  });

  return readSessionResponse(response, "Failed to submit the browser prompt response.");
};

export const deleteAcquisitionSession = async (sessionId: string) => {
  const response = await fetch(`/api/acquisition/sessions/${sessionId}`, {
    method: "DELETE",
  });

  await ensureOk(response, "Failed to end the acquisition session.");
};
