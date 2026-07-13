import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const now = () => Date.now();
const execFileAsync = promisify(execFile);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ACQUISITION_BRIDGE_STORAGE_KEY = "acquisitionBridgeState";
const ACQUISITION_SESSION_CACHE_KEY = "acquisitionSessionCache";
const ACQUISITION_SESSION_SYNC_EVENT = "agentic-browser:session-sync";

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const safeRm = async (targetPath) => {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

const normalizeBureauKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const bureauDownloadUrl = (sessionId, bureau) =>
  `/api/acquisition/sessions/${encodeURIComponent(sessionId)}/reports/${encodeURIComponent(bureau)}/file`;

const normalizeApiBaseUrl = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value.replace(/\/+$/, "") : null;
const isExtensionWorkerUrl = (value) => /^(chrome|edge)-extension:\/\//i.test(String(value ?? ""));

const killChromeProcessesForUserDataDir = async (userDataDir, browserPid = null) => {
  if (!userDataDir && !browserPid) {
    return 0;
  }

  const matchingPids = new Set();
  if (Number.isFinite(browserPid)) {
    matchingPids.add(Number(browserPid));
  }

  try {
    const { stdout } = await execFileAsync("ps", ["-axo", "pid=,command="]);
    stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const firstSpace = line.indexOf(" ");
        if (firstSpace <= 0) {
          return;
        }
        const pid = Number.parseInt(line.slice(0, firstSpace).trim(), 10);
        const command = line.slice(firstSpace + 1);
        if (!Number.isFinite(pid)) {
          return;
        }
        if (userDataDir && command.includes(userDataDir)) {
          matchingPids.add(pid);
        }
      });
  } catch {
    // best-effort only
  }

  if (!matchingPids.size) {
    return 0;
  }

  for (const pid of matchingPids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // best-effort only
    }
  }

  await wait(250);

  for (const pid of matchingPids) {
    try {
      process.kill(pid, 0);
      process.kill(pid, "SIGKILL");
    } catch {
      // process already exited
    }
  }

  return matchingPids.size;
};

export class CreditReportAcquisitionStore {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.debugDir = path.join(rootDir, "_debug");
    this.sessions = new Map();
  }

  async init() {
    await ensureDir(this.rootDir);
    await ensureDir(this.debugDir);
  }

  async createSession(input) {
    const id = randomUUID();
    const workspaceDir = path.join(this.rootDir, id);
    const reportsDir = path.join(workspaceDir, "reports");
    await ensureDir(reportsDir);

    const session = {
      id,
      workspaceDir,
      reportsDir,
      debugLogPath: path.join(this.debugDir, `${id}.jsonl`),
      createdAt: now(),
      updatedAt: now(),
      status: "created",
      progress: {
        progress: 0,
        stage: "Session created.",
      },
      currentBureau: null,
      currentStep: "launch_browser",
      currentUrl: null,
      expectedPageType: null,
      observedPageType: null,
      pageConfidence: null,
      matchedSignals: [],
      lastAction: null,
      retryCount: 0,
      recoveryState: {
        status: "idle",
        attemptCount: 0,
        lastDecision: null,
        lastSummary: null,
        screenshotPath: null,
        updatedAt: new Date().toISOString(),
      },
      downloadedReports: [],
      contactPromptState: {},
      pendingPrompt: null,
      promptDeferred: null,
      promptCounter: 0,
      lastError: null,
      cancelled: false,
      logs: [],
      debugEvents: [],
      activities: [],
      activityCounter: 0,
      controller: {
        channel: "browser_gate",
        status: "booting",
        ready: false,
        readyAt: null,
        source: null,
        lastChangedAt: new Date().toISOString(),
      },
      controllerDeferred: null,
      input,
      runtime: null,
    };

    this.sessions.set(id, session);
    this.appendLog(session, "Acquisition session created.");
    return session;
  }

  getSession(id) {
    return this.sessions.get(id) ?? null;
  }

  listSessions() {
    return [...this.sessions.values()];
  }

  touch(session) {
    session.updatedAt = now();
    this.queueOverlaySync(session);
  }

  queueOverlaySync(session) {
    const runtime = session?.runtime;
    if (!runtime?.extensionWorker || runtime.overlaySyncScheduled) {
      if (runtime) {
        runtime.overlaySyncQueued = true;
      }
      return;
    }

    runtime.overlaySyncScheduled = true;
    void Promise.resolve().then(async () => {
      try {
        do {
          runtime.overlaySyncQueued = false;
          await this.syncOverlaySession(session);
        } while (runtime.overlaySyncQueued);
      } finally {
        runtime.overlaySyncScheduled = false;
        if (runtime.overlaySyncQueued) {
          this.queueOverlaySync(session);
        }
      }
    });
  }

  async syncOverlaySession(session) {
    const runtime = session?.runtime;
    const apiBaseUrl = normalizeApiBaseUrl(runtime?.apiBaseUrl);
    if (!runtime?.context || !apiBaseUrl) {
      return false;
    }

    const resolveWorker = async () => {
      const context = runtime.context;
      const knownWorker = runtime.extensionWorker;
      if (knownWorker && isExtensionWorkerUrl(knownWorker.url?.() ?? knownWorker.url)) {
        return knownWorker;
      }

      const existingWorker = context
        .serviceWorkers()
        .find((candidate) => isExtensionWorkerUrl(candidate.url()));
      if (existingWorker) {
        runtime.extensionWorker = existingWorker;
        return existingWorker;
      }

      try {
        const nextWorker = await context.waitForEvent("serviceworker", { timeout: 1500 });
        if (nextWorker && isExtensionWorkerUrl(nextWorker.url())) {
          runtime.extensionWorker = nextWorker;
          return nextWorker;
        }
      } catch {
        // best-effort only
      }

      return null;
    };

    let worker = await resolveWorker();

    const bridgeKey = `${apiBaseUrl}|${session.id}`;
    const compactSession = this.serializeSessionCompact(session);
    const signature = JSON.stringify({
      bridgeKey,
      updatedAt: compactSession.updatedAt,
      status: compactSession.status,
      controlMode: compactSession.controlMode,
      currentBureau: compactSession.currentBureau,
      currentStep: compactSession.currentStep,
      promptId: compactSession.pendingPrompt?.id ?? null,
      promptType: compactSession.pendingPrompt?.type ?? null,
      promptContextUrl: compactSession.pendingPrompt?.contextUrl ?? null,
      controllerStatus: compactSession.controller?.status ?? null,
      controllerReady: compactSession.controller?.ready ?? false,
      lastError: compactSession.lastError ?? null,
    });

    if (runtime.lastOverlaySyncSignature === signature) {
      return true;
    }

    const evaluatePayload = {
      bridgeStorageKey: ACQUISITION_BRIDGE_STORAGE_KEY,
      bridgeState: {
        sessionId: session.id,
        apiBaseUrl,
        connectedAt: runtime.connectedAt ?? new Date().toISOString(),
        source: "credit-report-acquisition",
        panelStatus: runtime.panelStatus ?? "ready",
      },
      cacheKey: ACQUISITION_SESSION_CACHE_KEY,
      cachePayload: {
        bridgeKey,
        cachedAt: Date.now(),
        session: compactSession,
      },
      syncEventName: ACQUISITION_SESSION_SYNC_EVENT,
    };

    const pushToWorker = async (targetWorker) =>
      targetWorker.evaluate(
        async ({ bridgeState, cacheKey, cachePayload, bridgeStorageKey }) => {
          await chrome.storage.local.set({
            [bridgeStorageKey]: bridgeState,
            [cacheKey]: cachePayload,
          });
        },
        evaluatePayload,
      );

    const pushToPage = async (targetPage) =>
      targetPage.evaluate(
        ({ bridgeState, cachePayload, syncEventName }) => {
          window.dispatchEvent(
            new CustomEvent(syncEventName, {
              detail: {
                bridgeState,
                cachePayload,
              },
            }),
          );
        },
        evaluatePayload,
      );

    let pushedToWorker = false;
    if (worker) {
      try {
        await pushToWorker(worker);
        pushedToWorker = true;
      } catch (error) {
        this.appendDebugEvent(session, {
          source: "overlay-sync",
          event: "worker_retry",
          detail: "Retrying the overlay push after the stored extension worker failed.",
          data: {
            sessionId: session.id,
            error: error instanceof Error ? error.message : String(error),
            promptType: compactSession.pendingPrompt?.type ?? null,
            currentStep: compactSession.currentStep,
          },
        });
        runtime.extensionWorker = null;
        worker = await resolveWorker();
        if (worker) {
          try {
            await pushToWorker(worker);
            pushedToWorker = true;
          } catch (retryError) {
            this.appendDebugEvent(session, {
              source: "overlay-sync",
              event: "worker_retry_failed",
              detail: "The overlay session push failed even after replacing the extension worker.",
              data: {
                sessionId: session.id,
                promptType: compactSession.pendingPrompt?.type ?? null,
                currentStep: compactSession.currentStep,
                error: retryError instanceof Error ? retryError.message : String(retryError),
              },
            });
          }
        }
      }
    }

    let pushedToPage = false;
    if (runtime.page && typeof runtime.page.url === "function") {
      try {
        await pushToPage(runtime.page);
        pushedToPage = true;
      } catch (error) {
        this.appendDebugEvent(session, {
          source: "overlay-sync",
          event: "page_push_failed",
          detail: "The overlay session could not be pushed directly into the active browser page.",
          data: {
            sessionId: session.id,
            pageUrl: runtime.page.url(),
            promptType: compactSession.pendingPrompt?.type ?? null,
            currentStep: compactSession.currentStep,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    if (!pushedToWorker && !pushedToPage) {
      this.appendDebugEvent(session, {
        source: "overlay-sync",
        event: "worker_missing",
        detail: "The overlay session could not be pushed because neither the extension worker nor the active browser page accepted the update.",
        data: {
          sessionId: session.id,
          apiBaseUrl,
          pageUrl: runtime.page?.url?.() ?? null,
          promptType: compactSession.pendingPrompt?.type ?? null,
          currentStep: compactSession.currentStep,
        },
      });
      return false;
    }

    runtime.lastOverlaySyncSignature = signature;
    return true;
  }

  appendLog(session, message, level = "info") {
    const entry = {
      id: `${session.id}-log-${session.logs.length + 1}-${Date.now()}`,
      level,
      message,
      createdAt: new Date().toISOString(),
    };
    session.logs = [...session.logs.slice(-39), entry];
    this.touch(session);
    void this.persistSessionEvent(session, "log", entry);
    return entry;
  }

  appendDebugEvent(session, event = {}) {
    const entry = {
      id: `${session.id}-debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: typeof event.source === "string" ? event.source : "system",
      event: typeof event.event === "string" ? event.event : "debug",
      detail: typeof event.detail === "string" ? event.detail : "",
      data: event.data && typeof event.data === "object" ? event.data : null,
      createdAt: new Date().toISOString(),
    };
    session.debugEvents = [...(session.debugEvents ?? []).slice(-79), entry];
    session.updatedAt = now();
    void this.persistSessionEvent(session, "debug", entry);
    return entry;
  }

  appendActivity(session, activity = {}) {
    const entry = {
      id: `${session.id}-activity-${++session.activityCounter}-${Date.now()}`,
      kind: typeof activity.kind === "string" ? activity.kind : "system",
      title: typeof activity.title === "string" ? activity.title : "Agent step",
      detail: typeof activity.detail === "string" ? activity.detail : "",
      status: typeof activity.status === "string" ? activity.status : "info",
      createdAt: new Date().toISOString(),
    };
    session.activities = [...session.activities.slice(-39), entry];
    this.touch(session);
    void this.persistSessionEvent(session, "activity", entry);
    return entry;
  }

  async persistSessionEvent(session, kind, entry) {
    if (!session?.debugLogPath) {
      return;
    }

    const payload = JSON.stringify({
      kind,
      sessionId: session.id,
      createdAt: new Date().toISOString(),
      entry,
    });

    try {
      await fs.appendFile(session.debugLogPath, `${payload}\n`, "utf8");
    } catch {
      // best-effort debug persistence only
    }
  }

  setControllerState(session, controllerUpdate = {}) {
    session.controller = {
      ...(session.controller ?? {
        channel: "browser_gate",
        status: "booting",
        ready: false,
        readyAt: null,
        source: null,
      }),
      ...controllerUpdate,
      ready:
        typeof controllerUpdate.ready === "boolean"
          ? controllerUpdate.ready
          : session.controller?.ready ?? false,
      readyAt:
        controllerUpdate.readyAt === null || typeof controllerUpdate.readyAt === "string"
          ? controllerUpdate.readyAt
          : session.controller?.readyAt ?? null,
      lastChangedAt: new Date().toISOString(),
    };
    this.touch(session);
    return session.controller;
  }

  waitForControllerReady(session) {
    if (session.controller?.ready) {
      return Promise.resolve(session.controller);
    }

    if (!session.controllerDeferred) {
      session.controllerDeferred = createDeferred();
    }

    return session.controllerDeferred.promise;
  }

  markControllerReady(session, controllerUpdate = {}) {
    const readyAt = new Date().toISOString();
    this.setControllerState(session, {
      status: session.pendingPrompt ? "waiting_for_user" : "driving",
      ready: true,
      readyAt,
      ...controllerUpdate,
    });
    this.appendLog(session, "The user started the controlled browser session.");
    this.appendActivity(session, {
      kind: "controller",
      title: "Controlled browser session started",
      detail: "The user confirmed that the controlled browser session can begin moving.",
      status: "completed",
    });

    if (session.controllerDeferred) {
      session.controllerDeferred.resolve(session.controller);
      session.controllerDeferred = null;
    }

    return session.controller;
  }

  setProgress(session, progressUpdate = {}) {
    const nextProgress = Number.isFinite(progressUpdate.progress)
      ? Math.max(0, Math.min(100, Number(progressUpdate.progress)))
      : session.progress?.progress ?? 0;

    session.progress = {
      ...(session.progress ?? {}),
      ...progressUpdate,
      progress: nextProgress,
      stage:
        typeof progressUpdate.stage === "string" && progressUpdate.stage.trim().length > 0
          ? progressUpdate.stage
          : session.progress?.stage ?? "Working...",
    };

    if (typeof progressUpdate.currentBureau === "string" || progressUpdate.currentBureau === null) {
      session.currentBureau = progressUpdate.currentBureau ?? null;
    }

    if (typeof progressUpdate.currentStep === "string" && progressUpdate.currentStep.trim().length > 0) {
      session.currentStep = progressUpdate.currentStep;
    }

    if (typeof progressUpdate.currentUrl === "string" || progressUpdate.currentUrl === null) {
      session.currentUrl = progressUpdate.currentUrl ?? null;
    }

    if (typeof progressUpdate.expectedPageType === "string" || progressUpdate.expectedPageType === null) {
      session.expectedPageType = progressUpdate.expectedPageType ?? null;
    }

    if (typeof progressUpdate.observedPageType === "string" || progressUpdate.observedPageType === null) {
      session.observedPageType = progressUpdate.observedPageType ?? null;
    }

    if (Number.isFinite(progressUpdate.pageConfidence)) {
      session.pageConfidence = Math.max(0, Math.min(1, Number(progressUpdate.pageConfidence)));
    } else if (progressUpdate.pageConfidence === null) {
      session.pageConfidence = null;
    }

    if (Array.isArray(progressUpdate.matchedSignals)) {
      session.matchedSignals = progressUpdate.matchedSignals
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
    }

    if (typeof progressUpdate.lastAction === "string" || progressUpdate.lastAction === null) {
      session.lastAction = progressUpdate.lastAction ?? null;
    }

    if (Number.isFinite(progressUpdate.retryCount)) {
      session.retryCount = Math.max(0, Number(progressUpdate.retryCount));
    }

    if (session.status !== "waiting_for_user") {
      session.status = nextProgress >= 100 ? "completed" : "running";
    }

    this.touch(session);
  }

  setRecoveryState(session, recoveryUpdate = {}) {
    session.recoveryState = {
      ...(session.recoveryState ?? {
        status: "idle",
        attemptCount: 0,
        lastDecision: null,
        lastSummary: null,
        screenshotPath: null,
      }),
      ...recoveryUpdate,
      updatedAt: new Date().toISOString(),
    };
    this.touch(session);
    return session.recoveryState;
  }

  async requestPrompt(session, prompt) {
    if (session.pendingPrompt && session.promptDeferred) {
      session.promptDeferred.reject(new Error("A new prompt replaced the previous pending prompt."));
      session.pendingPrompt = null;
      session.promptDeferred = null;
    }

    const promptId = `${session.id}-prompt-${++session.promptCounter}`;
    const deferred = createDeferred();

    session.pendingPrompt = {
      id: promptId,
      type: prompt.type ?? "manual_continue",
      inputType: prompt.inputType ?? "confirm",
      title: prompt.title ?? "Continue in browser",
      description: prompt.description ?? "",
      placeholder: prompt.placeholder ?? "",
      defaultValue: prompt.defaultValue ?? "",
      submitLabel: prompt.submitLabel ?? (prompt.inputType === "text" ? "Submit" : "Continue"),
      choices: Array.isArray(prompt.choices) ? prompt.choices : [],
      questions: Array.isArray(prompt.questions) ? prompt.questions : [],
      bureau: prompt.bureau ?? session.currentBureau ?? null,
      contextUrl: prompt.contextUrl ?? session.currentUrl ?? null,
      createdAt: new Date().toISOString(),
    };
    session.promptDeferred = deferred;
    session.status = "waiting_for_user";
    this.setControllerState(session, {
      status:
        prompt.type === "security_question" || prompt.type === "security_questionnaire"
          ? "takeover"
          : "waiting_for_user",
    });
    this.appendLog(session, `Waiting for the user: ${session.pendingPrompt.title}`);
    this.appendActivity(session, {
      kind: "prompt",
      title: session.pendingPrompt.title,
      detail: session.pendingPrompt.description,
      status: "waiting",
    });
    this.touch(session);

    return deferred.promise.finally(() => {
      if (session.pendingPrompt?.id === promptId) {
        session.pendingPrompt = null;
      }
      session.promptDeferred = null;
      if (session.status === "waiting_for_user") {
        session.status = "running";
      }
      if (session.controller?.ready) {
        this.setControllerState(session, {
          status: "driving",
        });
      }
      this.touch(session);
    });
  }

  respondToPrompt(session, promptId, response) {
    if (!session.pendingPrompt || session.pendingPrompt.id !== promptId || !session.promptDeferred) {
      throw new Error("The requested prompt is no longer active.");
    }

    const promptTitle = session.pendingPrompt.title;
    const deferred = session.promptDeferred;
    session.pendingPrompt = null;
    session.promptDeferred = null;
    session.status = "running";
    if (session.controller?.ready) {
      this.setControllerState(session, {
        status: "driving",
      });
    }
    this.appendLog(session, `The user responded to: ${promptTitle}`);
    this.touch(session);
    deferred.resolve(response);
  }

  attachRuntime(session, runtime) {
    session.runtime = runtime;
    this.touch(session);
  }

  async closeRuntime(session) {
    const runtime = session.runtime;
    session.runtime = null;

    if (!runtime) {
      return;
    }

    const browserProcess = runtime.browserProcess ?? null;
    const browserPid =
      Number.isFinite(runtime.browserPid) ? Number(runtime.browserPid) :
      Number.isFinite(browserProcess?.pid) ? Number(browserProcess.pid) :
      null;
    const userDataDir = typeof runtime.userDataDir === "string" ? runtime.userDataDir : null;

    try {
      await runtime.context?.close?.();
    } catch {
      // best-effort cleanup
    }

    try {
      await runtime.browser?.close?.();
    } catch {
      // best-effort cleanup
    }

    try {
      browserProcess?.kill?.("SIGTERM");
    } catch {
      // best-effort cleanup
    }

    const killedProcessCount = await killChromeProcessesForUserDataDir(userDataDir, browserPid);
    if (killedProcessCount > 0) {
      this.appendLog(
        session,
        `Closed ${killedProcessCount} browser process${killedProcessCount === 1 ? "" : "es"} tied to this guided session.`,
      );
    }
  }

  addDownloadedReport(session, report) {
    const bureauKey = normalizeBureauKey(report?.bureau);
    const nextReport = {
      bureau: report.bureau,
      bureauKey,
      fileName: report.fileName,
      filePath: report.filePath,
      sizeBytes: report.sizeBytes ?? null,
      createdAt: report.createdAt ?? new Date().toISOString(),
      downloadUrl: bureauDownloadUrl(session.id, bureauKey),
      captureMethod: report.captureMethod ?? null,
    };

    const existingIndex = session.downloadedReports.findIndex((entry) => entry.bureauKey === bureauKey);
    if (existingIndex >= 0) {
      session.downloadedReports[existingIndex] = nextReport;
    } else {
      session.downloadedReports.push(nextReport);
    }

    this.touch(session);
  }

  setCompleted(session, stage = "All three reports are ready.") {
    session.status = "completed";
    session.progress = {
      ...(session.progress ?? {}),
      progress: 100,
      stage,
    };
    session.lastError = null;
    session.currentStep = "run_complete";
    this.setControllerState(session, {
      status: "completed",
    });
    this.setRecoveryState(session, {
      status: "idle",
    });
    this.touch(session);
  }

  setFailed(session, errorMessage) {
    session.status = "failed";
    session.lastError = errorMessage;
    session.progress = {
      ...(session.progress ?? {}),
      stage: "Acquisition failed.",
    };
    session.currentStep = "run_failed";
    this.setControllerState(session, {
      status: "failed",
    });
    this.touch(session);
  }

  async deleteSession(id) {
    const session = this.getSession(id);
    if (!session) {
      return false;
    }

    session.cancelled = true;

    if (session.promptDeferred) {
      session.promptDeferred.reject(new Error("The acquisition session was cancelled."));
      session.promptDeferred = null;
      session.pendingPrompt = null;
    }

    if (session.controllerDeferred) {
      session.controllerDeferred.reject(new Error("The acquisition session was cancelled."));
      session.controllerDeferred = null;
    }

    await this.closeRuntime(session);
    this.sessions.delete(id);
    await safeRm(session.workspaceDir);
    return true;
  }

  async deleteAllSessions() {
    const sessionIds = [...this.sessions.keys()];
    for (const sessionId of sessionIds) {
      await this.deleteSession(sessionId);
    }
    return sessionIds.length;
  }

  serializeSession(session) {
    return {
      sessionId: session.id,
      status: session.status,
      controlMode: session.controller?.status ?? "booting",
      progress: session.progress ?? { progress: 0, stage: "Session created." },
      currentBureau: session.currentBureau,
      currentStep: session.currentStep ?? "launch_browser",
      currentUrl: session.currentUrl,
      expectedPageType: session.expectedPageType ?? null,
      observedPageType: session.observedPageType ?? null,
      pageConfidence: session.pageConfidence ?? null,
      matchedSignals: Array.isArray(session.matchedSignals) ? session.matchedSignals : [],
      lastAction: session.lastAction,
      retryCount: session.retryCount ?? 0,
      recoveryState: session.recoveryState ?? {
        status: "idle",
        attemptCount: 0,
        lastDecision: null,
        lastSummary: null,
        screenshotPath: null,
        updatedAt: new Date().toISOString(),
      },
      pendingPrompt: session.pendingPrompt,
      downloadedReports: session.downloadedReports.map((report) => ({
        bureau: report.bureau,
        bureauKey: report.bureauKey,
        fileName: report.fileName,
        sizeBytes: report.sizeBytes,
        createdAt: report.createdAt,
        downloadUrl: report.downloadUrl,
        captureMethod: report.captureMethod ?? null,
      })),
      controller: session.controller,
      activities: session.activities.slice(-25),
      debugEvents: (session.debugEvents ?? []).slice(-40),
      lastError: session.lastError,
      logs: session.logs.slice(-25),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  serializeSessionCompact(session) {
    return {
      sessionId: session.id,
      status: session.status,
      controlMode: session.controller?.status ?? "booting",
      progress: session.progress ?? { progress: 0, stage: "Session created." },
      currentBureau: session.currentBureau,
      currentStep: session.currentStep ?? "launch_browser",
      currentUrl: session.currentUrl,
      expectedPageType: session.expectedPageType ?? null,
      observedPageType: session.observedPageType ?? null,
      pageConfidence: session.pageConfidence ?? null,
      matchedSignals: Array.isArray(session.matchedSignals) ? session.matchedSignals : [],
      lastAction: session.lastAction,
      retryCount: session.retryCount ?? 0,
      recoveryState: session.recoveryState ?? {
        status: "idle",
        attemptCount: 0,
        lastDecision: null,
        lastSummary: null,
        screenshotPath: null,
        updatedAt: new Date().toISOString(),
      },
      pendingPrompt: session.pendingPrompt,
      downloadedReports: session.downloadedReports.map((report) => ({
        bureau: report.bureau,
        bureauKey: report.bureauKey,
        fileName: report.fileName,
        sizeBytes: report.sizeBytes,
        createdAt: report.createdAt,
        downloadUrl: report.downloadUrl,
        captureMethod: report.captureMethod ?? null,
      })),
      controller: session.controller,
      activities: session.activities.slice(-8),
      lastError: session.lastError,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
