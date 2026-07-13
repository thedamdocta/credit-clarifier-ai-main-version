import {
  CreateDisputeLetterDraftRequest,
  DisputeLetterDraft,
  UpdateDisputeLetterFullDocumentRequest,
  UpdateDisputeLetterSectionRequest,
} from "./types";

export class HighlightedReportBlockedError extends Error {
  draft?: DisputeLetterDraft;
  unresolvedReasonIds: string[];

  constructor(message: string, unresolvedReasonIds: string[], draft?: DisputeLetterDraft) {
    super(message);
    this.name = "HighlightedReportBlockedError";
    this.unresolvedReasonIds = unresolvedReasonIds;
    this.draft = draft;
  }
}

const ensureOk = async (response: Response, fallbackMessage: string) => {
  if (response.ok) {
    return response.json();
  }

  try {
    const payload = await response.json();
    if (typeof payload?.error === "string") {
      throw new Error(payload.error);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }

  throw new Error(fallbackMessage);
};

export const createDisputeLetterDraft = async (payload: CreateDisputeLetterDraftRequest) => {
  const response = await fetch("/api/dispute-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await ensureOk(response, "Failed to create dispute letter draft.");
  return json.draft as DisputeLetterDraft;
};

export const getDisputeLetterDraftByRequestKey = async (requestKey: string) => {
  const response = await fetch(`/api/dispute-drafts/lookup?requestKey=${encodeURIComponent(requestKey)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const json = await ensureOk(response, "Failed to look up dispute letter draft.");
  return (json.draft as DisputeLetterDraft | null) ?? null;
};

export const updateDisputeLetterSection = async (
  draftId: string,
  sectionId: string,
  payload: UpdateDisputeLetterSectionRequest,
) => {
  const response = await fetch(`/api/dispute-drafts/${draftId}/sections/${sectionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await ensureOk(response, "Failed to update dispute letter section.");
  return json.draft as DisputeLetterDraft;
};

export const updateDisputeLetterFullDocument = async (
  draftId: string,
  payload: UpdateDisputeLetterFullDocumentRequest,
) => {
  const response = await fetch(`/api/dispute-drafts/${draftId}/full-document`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await ensureOk(response, "Failed to update full dispute letter draft.");
  return json.draft as DisputeLetterDraft;
};

export const renderDisputeLetterDraft = async (draftId: string, rebuildFromSections = false) => {
  const response = await fetch(`/api/dispute-drafts/${draftId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rebuildFromSections }),
  });
  const json = await ensureOk(response, "Failed to render dispute letter preview.");
  return json.draft as DisputeLetterDraft;
};

export interface ExportEvidenceSelection {
  inlineExhibits: boolean;
  memorandum: boolean;
  highlightedReport: boolean;
  exhibitNumbering: "numeric" | "alpha";
}

export const exportDisputeLetterDraft = async (draftId: string, selection?: ExportEvidenceSelection) => {
  const response = await fetch(`/api/dispute-drafts/${draftId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: selection ? JSON.stringify(selection) : undefined,
  });
  const json = await ensureOk(response, "Failed to export dispute letter artifacts.");
  const warnings = Array.isArray(json.warnings) ? (json.warnings as string[]) : [];
  return { draft: json.draft as DisputeLetterDraft, warnings };
};

export const generateDisputeEvidence = async (draftId: string) => {
  const response = await fetch(`/api/dispute-drafts/${draftId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const json = await ensureOk(response, "Failed to generate dispute evidence.");
  return json.draft as DisputeLetterDraft;
};

export const generateHighlightedReportPdf = async (draftId: string) => {
  const response = await fetch(`/api/dispute-drafts/${draftId}/highlighted-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (response.ok) {
    const json = await response.json();
    return json.draft as DisputeLetterDraft;
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 409) {
    throw new HighlightedReportBlockedError(
      typeof payload?.error === "string" ? payload.error : "Highlighted report generation is blocked.",
      Array.isArray(payload?.details?.unresolvedReasonIds) ? payload.details.unresolvedReasonIds : [],
      payload?.details?.draft as DisputeLetterDraft | undefined,
    );
  }

  if (typeof payload?.error === "string") {
    throw new Error(payload.error);
  }

  throw new Error("Failed to generate highlighted report PDF.");
};
