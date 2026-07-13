import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

export class DisputeLetterStore {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.cache = new Map();
  }

  async init() {
    await ensureDir(this.rootDir);
  }

  draftDir(draftId) {
    return path.join(this.rootDir, draftId);
  }

  draftPath(draftId) {
    return path.join(this.draftDir(draftId), "draft.json");
  }

  async createDraft(initialDraft) {
    const id = initialDraft.id ?? randomUUID();
    const now = new Date().toISOString();
    const draft = {
      ...initialDraft,
      id,
      createdAt: initialDraft.createdAt ?? now,
      updatedAt: now,
    };

    await ensureDir(this.draftDir(id));
    await fs.writeFile(this.draftPath(id), JSON.stringify(draft, null, 2), "utf8");
    this.cache.set(id, draft);
    return draft;
  }

  async getDraft(draftId) {
    if (this.cache.has(draftId)) {
      return this.cache.get(draftId);
    }

    try {
      const raw = await fs.readFile(this.draftPath(draftId), "utf8");
      const draft = JSON.parse(raw);
      this.cache.set(draftId, draft);
      return draft;
    } catch {
      return null;
    }
  }

  async saveDraft(draft) {
    const nextDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    await ensureDir(this.draftDir(nextDraft.id));
    await fs.writeFile(this.draftPath(nextDraft.id), JSON.stringify(nextDraft, null, 2), "utf8");
    this.cache.set(nextDraft.id, nextDraft);
    return nextDraft;
  }
}
