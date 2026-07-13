import { CreditReport } from "@/lib/types/creditReport";

export interface SessionProgressUpdate {
  progress: number;
  stage: string;
}

interface SessionStatusResponse {
  status: string;
  sessionId: string;
  sessionStatus: string;
  progress?: SessionProgressUpdate | null;
  lastError?: string | null;
  hasResult?: boolean;
}

export interface ProcessedSessionResult {
  sessionId: string;
  report: CreditReport;
  result: Record<string, unknown>;
}

export const cleanupReportSession = async (sessionId: string, keepalive: boolean = false) => {
  try {
    await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
      keepalive,
    });
  } catch {
    // best-effort cleanup
  }
};

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

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const CHUNK_SIZE_BYTES = 512 * 1024;

const uploadPdfInChunks = async (
  sessionId: string,
  file: File,
  emitClientProgress: (update: SessionProgressUpdate) => void,
) => {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE_BYTES));
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * CHUNK_SIZE_BYTES;
    const end = Math.min(file.size, start + CHUNK_SIZE_BYTES);
    const chunk = file.slice(start, end, "application/pdf");
    const formData = new FormData();
    formData.append("chunk", chunk, file.name);
    formData.append("fileName", file.name);
    formData.append("chunkIndex", String(chunkIndex));
    formData.append("totalChunks", String(totalChunks));

    const response = await fetch(`/api/sessions/${sessionId}/upload-chunk`, {
      method: "POST",
      body: formData,
    });
    await ensureOk(response, "Failed to upload PDF to backend session.");
    await response.json().catch(() => undefined);

    const progress = 20 + Math.round(((chunkIndex + 1) / totalChunks) * 12);
    emitClientProgress({
      progress,
      stage: `Uploading PDF to backend session... (${chunkIndex + 1}/${totalChunks})`,
    });
  }
};

const waitForSessionCompletion = async (
  sessionId: string,
  onProgress?: (update: SessionProgressUpdate) => void
) => {
  while (true) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/status`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Processing session was not found.");
        }
        await sleep(400);
        continue;
      }

      const payload = (await response.json()) as SessionStatusResponse;
      if (payload?.progress && typeof payload.progress.progress === "number" && typeof payload.progress.stage === "string") {
        onProgress?.(payload.progress);
      }

      if (payload?.sessionStatus === "processed") {
        return payload;
      }

      if (payload?.sessionStatus === "failed") {
        const failureMessage = payload.lastError || "Backend processing failed.";
        throw new Error(failureMessage);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (/failed to fetch|networkerror|load failed/i.test(error.message)) {
          // Ignore transient polling failures while processing continues.
        } else {
          throw error;
        }
      }
    }

    await sleep(400);
  }
};

export const processCreditReportPdfWithSessionApi = async (
  file: File,
  onProgress?: (update: SessionProgressUpdate) => void,
  profile?: string
): Promise<ProcessedSessionResult> => {
  let sessionId: string | null = null;
  let maxProgress = 0;

  const emitClientProgress = (update: SessionProgressUpdate) => {
    const nextProgress = Number.isFinite(update.progress)
      ? Math.max(maxProgress, update.progress)
      : maxProgress;
    maxProgress = nextProgress;
    onProgress?.({
      ...update,
      progress: nextProgress,
    });
  };

  try {
    emitClientProgress({ progress: 5, stage: "Creating secure processing session..." });

    const sessionResponse = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    await ensureOk(sessionResponse, "Failed to create backend processing session.");

    const sessionPayload = await sessionResponse.json();
    sessionId = sessionPayload.sessionId;
    if (!sessionId) {
      throw new Error("API session id was not returned.");
    }

    emitClientProgress({ progress: 20, stage: "Uploading PDF to backend session..." });

    const useChunkedUpload =
      file.size > 900 * 1024 ||
      /(?:^|\.)slim\.show$/i.test(window.location.hostname) ||
      /(?:^|\.)slim\.sh$/i.test(window.location.hostname);

    if (useChunkedUpload) {
      await uploadPdfInChunks(sessionId, file, emitClientProgress);
    } else {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch(`/api/sessions/${sessionId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (uploadResponse.status === 413) {
        await uploadPdfInChunks(sessionId, file, emitClientProgress);
      } else {
        await ensureOk(uploadResponse, "Failed to upload PDF to backend session.");
      }
    }

    emitClientProgress({ progress: 22, stage: "Starting backend extraction..." });
    const processResponse = await fetch(`/api/sessions/${sessionId}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profile ? { profile } : {}),
    });
    await ensureOk(processResponse, "Backend processing failed.");
    await processResponse.json().catch(() => undefined);
    const completionPayload = await waitForSessionCompletion(sessionId, emitClientProgress);

    if ((completionPayload?.progress?.progress ?? 0) < 99) {
      emitClientProgress({ progress: 99, stage: "Collecting extracted result..." });
    }

    const resultResponse = await fetch(`/api/sessions/${sessionId}/result`, {
      method: "GET",
    });
    await ensureOk(resultResponse, "Failed to load processed extraction result.");

    const resultPayload = await resultResponse.json();

    emitClientProgress({ progress: 100, stage: "Extraction complete." });

    const report = resultPayload?.report as CreditReport | undefined;
    if (!report) {
      throw new Error("Backend result did not include a mapped credit report payload.");
    }

    return {
      sessionId,
      report,
      result: (resultPayload?.result ?? {}) as Record<string, unknown>,
    };
  } catch (error) {
    if (sessionId) {
      await cleanupReportSession(sessionId).catch(() => undefined);
    }
    throw error;
  }
};

export const cleanupEquifaxSession = cleanupReportSession;
export const processEquifaxPdfWithSessionApi = processCreditReportPdfWithSessionApi;
