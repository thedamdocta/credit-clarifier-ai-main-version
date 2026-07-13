import type { CreditReport } from "@/lib/types/creditReport";
import type { SessionProgressUpdate } from "@/lib/api/equifaxSessionClient";
import { createDisputeLetterDraft, getDisputeLetterDraftByRequestKey } from "./api";
import { buildDefaultIntake } from "./defaults";
import { generateAccountRuleCatalog, generateDisputeReasons, generateNonAccountReasons } from "./reasonEngine";
import type { DisputeLetterDraft, DisputeLetterIntake, DisputeReason } from "./types";

const normalizeRequestValue = (value?: string | null) => String(value ?? "").trim();
const HYDRATED_DRAFT_LOOKUP_INTERVAL_MS = 1200;
const HYDRATED_DRAFT_LOOKUP_TIMEOUT_MS = 10 * 60 * 1000;

export const hashDisputeDraftRequestKey = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `draft-${(hash >>> 0).toString(36)}`;
};

export const buildDisputeDraftSyncKey = ({
  report,
  intake,
  reasons,
}: {
  report: CreditReport;
  intake: DisputeLetterIntake;
  reasons: DisputeReason[];
}) =>
  [
    report.sourceSessionId ?? report.reportId ?? report.fileName ?? report.bureau,
    normalizeRequestValue(intake.fullLegalName),
    normalizeRequestValue(intake.reportDate),
    ...reasons.map((reason) => reason.id).sort(),
  ].join("|");

export const buildInitialDisputePreparation = (report: CreditReport) => {
  const intake = buildDefaultIntake(report);
  const accountRuleCatalog = generateAccountRuleCatalog(report);
  const nonAccountReasons = generateNonAccountReasons(report, intake);
  const reasons = generateDisputeReasons(report, intake, accountRuleCatalog, nonAccountReasons, []);
  const syncKey = buildDisputeDraftSyncKey({ report, intake, reasons });
  return {
    intake,
    reasons,
    requestKey: hashDisputeDraftRequestKey(syncKey),
  };
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const waitForReadyHydratedDraft = async (requestKey: string) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= HYDRATED_DRAFT_LOOKUP_TIMEOUT_MS) {
    const lookedUpDraft = await getDisputeLetterDraftByRequestKey(requestKey);
    if (lookedUpDraft) {
      return lookedUpDraft;
    }
    await sleep(HYDRATED_DRAFT_LOOKUP_INTERVAL_MS);
  }

  throw new Error("The dispute workspace took too long to finish loading fully highlighted proof.");
};

export const preloadInitialDisputeWorkspace = async (
  report: CreditReport,
  onProgress?: (update: SessionProgressUpdate) => void,
): Promise<DisputeLetterDraft> => {
  onProgress?.({ progress: 76, stage: "Preparing dispute reasons..." });
  const { intake, reasons, requestKey } = buildInitialDisputePreparation(report);
  onProgress?.({ progress: 82, stage: "Building dispute draft..." });
  onProgress?.({ progress: 88, stage: "Generating highlighted source proof..." });
  onProgress?.({ progress: 94, stage: "Reviewing highlight localization..." });
  const createDraftPromise = createDisputeLetterDraft({
    sessionId: report.sourceSessionId ?? report.reportId ?? report.fileName ?? crypto.randomUUID(),
    report,
    intake,
    reasons,
    requestKey,
    hydrateEvidence: true,
  });
  const lookupDraftPromise = waitForReadyHydratedDraft(requestKey);
  const draft = await Promise.any([createDraftPromise, lookupDraftPromise]).catch((error) => {
    if (error instanceof AggregateError && error.errors.length > 0) {
      throw error.errors[0];
    }
    throw error;
  });
  onProgress?.({ progress: 99, stage: "Finalizing fully loaded dispute workspace..." });
  return draft;
};
