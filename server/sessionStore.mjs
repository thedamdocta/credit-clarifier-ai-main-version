import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const now = () => Date.now();

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const safeRm = async (targetPath) => {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
};

export class SessionStore {
  constructor(sessionRoot) {
    this.sessionRoot = sessionRoot;
    this.sessions = new Map();
  }

  async init() {
    await ensureDir(this.sessionRoot);
  }

  async createSession() {
    const id = randomUUID();
    const workspaceDir = path.join(this.sessionRoot, id);
    await ensureDir(workspaceDir);

    const session = {
      id,
      workspaceDir,
      createdAt: now(),
      updatedAt: now(),
      status: "created",
      progress: {
        progress: 0,
        stage: "Session created.",
      },
      uploadedFileName: null,
      uploadedFilePath: null,
      result: null,
      deleteOnRead: false,
      lastError: null,
    };

    this.sessions.set(id, session);
    return session;
  }

  getSession(id) {
    return this.sessions.get(id) ?? null;
  }

  touch(session) {
    session.updatedAt = now();
  }

  async setUploadedFile(session, fileName, fileBuffer) {
    const uploadsDir = path.join(session.workspaceDir, "uploads");
    await ensureDir(uploadsDir);

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const targetPath = path.join(uploadsDir, safeName);

    await fs.writeFile(targetPath, fileBuffer);

    this.registerUploadedFile(session, fileName, targetPath);

    return targetPath;
  }

  registerUploadedFile(session, fileName, filePath) {
    session.uploadedFileName = fileName;
    session.uploadedFilePath = filePath;
    session.status = "uploaded";
    session.progress = {
      progress: 20,
      stage: "PDF uploaded to backend session.",
    };
    this.touch(session);
  }

  setUploadProgress(session, progress, stage = "Uploading PDF to backend session...") {
    session.status = "uploading";
    session.progress = {
      progress: Math.max(1, Math.min(19, Number.isFinite(progress) ? Number(progress) : 1)),
      stage,
    };
    this.touch(session);
  }

  setProcessing(session) {
    session.status = "processing";
    session.lastError = null;
    session.progress = {
      progress: Math.max(session.progress?.progress ?? 0, 22),
      stage: "Queued for backend extraction.",
    };
    this.touch(session);
  }

  setProgress(session, progressUpdate = {}) {
    const nextProgress = Number.isFinite(progressUpdate.progress)
      ? Math.max(0, Math.min(99, Number(progressUpdate.progress)))
      : session.progress?.progress ?? 0;

    session.progress = {
      ...(session.progress ?? {}),
      ...progressUpdate,
      progress: nextProgress,
      stage:
        typeof progressUpdate.stage === "string" && progressUpdate.stage.trim().length > 0
          ? progressUpdate.stage
          : session.progress?.stage ?? "Processing...",
    };
    this.touch(session);
  }

  setFailed(session, errorMessage) {
    session.status = "failed";
    session.lastError = errorMessage;
    session.progress = {
      ...(session.progress ?? {}),
      stage: "Processing failed.",
    };
    this.touch(session);
  }

  setProcessed(session, result, { deleteOnRead = false } = {}) {
    session.status = "processed";
    session.result = result;
    session.deleteOnRead = deleteOnRead;
    session.lastError = null;
    session.progress = {
      ...(session.progress ?? {}),
      progress: 100,
      stage: "Extraction complete.",
    };
    this.touch(session);
  }

  async deleteSession(id) {
    const session = this.getSession(id);
    if (!session) {
      return false;
    }

    this.sessions.delete(id);
    await safeRm(session.workspaceDir);
    return true;
  }

  listSessions() {
    return [...this.sessions.values()];
  }
}

export const shouldExpireSession = (session, retentionSeconds) => {
  if (retentionSeconds < 0) {
    return false;
  }
  const ageMs = now() - session.updatedAt;
  return ageMs > retentionSeconds * 1000;
};
