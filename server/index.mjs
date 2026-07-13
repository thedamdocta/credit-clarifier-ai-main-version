import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appConfig } from "./config.mjs";
import { SessionStore, shouldExpireSession } from "./sessionStore.mjs";
import { CreditReportAcquisitionStore } from "./creditReportAcquisitionStore.mjs";
import { runAnnualCreditReportAcquisition } from "./creditReportAcquisitionAgent.mjs";
import { runWorkerExtraction } from "./pythonWorker.mjs";
import { mapWorkerResultToCreditReport } from "./resultMapper.mjs";
import { DisputeLetterStore } from "./disputeLetterStore.mjs";
import {
  attachArtifactUrls,
  buildDisputeLetterDraft,
  updateDraftFullDocument,
  updateDraftSection,
  withRenderedPreview,
} from "./disputeLetterBuilder.mjs";

const app = express();
const sessionStore = new SessionStore(appConfig.sessionRoot);
const acquisitionStore = new CreditReportAcquisitionStore(appConfig.acquisitionRoot);
const disputeLetterStore = new DisputeLetterStore(appConfig.disputeOutputRoot);
const distDir = path.join(appConfig.repoRoot, "dist");
const distIndexPath = path.join(distDir, "index.html");
const execFileAsync = promisify(execFile);
const draftIdsByRequestKey = new Map();
const inFlightDraftCreations = new Map();
const inFlightEvidenceJobs = new Map();
// Serializes exports per draft: two concurrent exports with DIFFERENT option
// sets must not share one evidence run or interleave writes in the draft dir
// (Phase-5 panel MED-3 — runSharedJob dedupes identical work; this queues
// differing work instead).
const exportLocks = new Map();
const runExclusive = (map, key, task) => {
  const previous = map.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  map.set(
    key,
    next.catch(() => {})
  );
  return next;
};
const pendingDraftByRequestKey = new Map();

const killOrphanedAcquisitionBrowsers = async () => {
  try {
    const { stdout } = await execFileAsync("ps", ["-axo", "pid=,command="]);
    const targetFragment = `${appConfig.acquisitionRoot}${path.sep}`;
    const pids = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const firstSpace = line.indexOf(" ");
        if (firstSpace <= 0) {
          return null;
        }
        const pid = Number.parseInt(line.slice(0, firstSpace).trim(), 10);
        const command = line.slice(firstSpace + 1);
        if (!Number.isFinite(pid)) {
          return null;
        }
        if (!command.includes(targetFragment) || !command.includes("browser-profile")) {
          return null;
        }
        return pid;
      })
      .filter((pid) => Number.isFinite(pid));

    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // best effort only
      }
    }

    return pids.length;
  } catch {
    return 0;
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: appConfig.maxUploadBytes,
  },
});
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.min(appConfig.maxUploadBytes, 768 * 1024),
  },
});

app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

const componentStatusSeeds = {
  equifax_old_v1: {
    reportConfirmationDetails: "failed",
    personalInformation: "failed",
    summary: "failed",
    creditAccountsSummary: "failed",
    otherItemsSummary: "failed",
    accounts: "failed",
    collections: "failed",
    inquiries: "failed",
  },
  equifax_new_v1: {
    reportConfirmationDetails: "failed",
    summary: "failed",
    personalInformation: "failed",
    accounts: "failed",
    inquiries: "failed",
  },
  experian_acr_v1: {
    reportOverview: "failed",
    personalInformation: "failed",
    accounts: "failed",
    publicRecords: "failed",
    hardInquiries: "failed",
    softInquiries: "failed",
  },
  transunion_acr_v1: {
    reportOverview: "failed",
    personalInformation: "failed",
    adverseAccounts: "failed",
    satisfactoryAccounts: "failed",
    inquiries: "failed",
    accountReviewInquiries: "failed",
  },
};

const sendError = (res, statusCode, message, details = undefined) => {
  res.status(statusCode).json({
    status: "error",
    error: message,
    details,
  });
};

const escapeSvgAttribute = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const runSharedJob = async (jobMap, key, job) => {
  if (!key) {
    return job();
  }
  if (jobMap.has(key)) {
    return jobMap.get(key);
  }
  const promise = Promise.resolve()
    .then(job)
    .finally(() => {
      jobMap.delete(key);
    });
  jobMap.set(key, promise);
  return promise;
};

class EvidencePreparationIncompleteError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "EvidencePreparationIncompleteError";
    this.details = details;
  }
}

const normalizeReasonId = (value) => String(value ?? "").trim();

const collectSelectedReasonIds = (draft) =>
  new Set((draft?.selectedReasons ?? []).map((reason) => normalizeReasonId(reason?.id)).filter(Boolean));

const buildReasonBundleMap = (manifest) =>
  new Map((manifest?.reasons ?? []).map((bundle) => [normalizeReasonId(bundle?.reasonId), bundle]));

const collectUnreadyReasonIds = (draft) => {
  const selectedReasonIds = collectSelectedReasonIds(draft);
  const manifest = draft?.evidenceManifest;
  if (!manifest) {
    return Array.from(selectedReasonIds);
  }

  const bundleByReasonId = buildReasonBundleMap(manifest);
  return Array.from(selectedReasonIds).filter((reasonId) => {
    const bundle = bundleByReasonId.get(reasonId);
    return !bundle ||
      bundle.status !== "ready" ||
      (bundle.slides?.length ?? 0) === 0 ||
      bundle.blockedByValidation === true;
  });
};

const isHydratedEvidenceReady = (draft) => collectUnreadyReasonIds(draft).length === 0;

const resolveDraftForRequestKey = async (requestKey) => {
  if (!requestKey) {
    return null;
  }
  const draftId = draftIdsByRequestKey.get(requestKey);
  if (!draftId) {
    return null;
  }
  const draft = await disputeLetterStore.getDraft(draftId);
  if (!draft) {
    draftIdsByRequestKey.delete(requestKey);
    return null;
  }
  return draft;
};

const detectProfileFromPdf = async (uploadedFilePath, uploadedFileName = "") => {
  const fileName = String(uploadedFileName || "").toLowerCase();

  try {
    const { stdout } = await execFileAsync("pdftotext", ["-f", "1", "-l", "12", uploadedFilePath, "-"], {
      maxBuffer: 2 * 1024 * 1024,
    });
    const text = String(stdout || "").toLowerCase();

    if (
      (text.includes("personal credit report for:") &&
        (text.includes("visit transunion.com/dispute") ||
          text.includes("annualcreditreport.transunion.com/dss/disclosure.page"))) ||
      (text.includes("transunion") &&
        text.includes("credit report date") &&
        text.includes("file number:") &&
        text.includes("personal information"))
    ) {
      return "transunion_acr_v1";
    }

    if (
      text.includes("annual credit report - experian") ||
      (text.includes("experian") && text.includes("at a glance") && text.includes("hard inquiries"))
    ) {
      return "experian_acr_v1";
    }

    if (text.includes("equifax")) {
      if (
        text.includes("your credit report") &&
        text.includes("consumer file notices") &&
        text.includes("confirmation #")
      ) {
        return "equifax_new_v1";
      }
      return "equifax_old_v1";
    }
  } catch {
    // fall through to filename/default heuristics
  }

  if (fileName.includes("experian")) {
    return "experian_acr_v1";
  }
  if (fileName.includes("transunion")) {
    return "transunion_acr_v1";
  }
  if (fileName.includes("equifax")) {
    return "equifax_old_v1";
  }

  return appConfig.profileDefault;
};

const resolvePageImagePath = async (workspaceDir, pageNumber) => {
  const imagesDir = path.join(workspaceDir, "ingestion", "images");
  const entries = await fs.readdir(imagesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".png")) {
      continue;
    }
    const match = entry.name.match(/^page-(\d+)\.png$/i);
    if (!match) {
      continue;
    }
    if (Number.parseInt(match[1], 10) === pageNumber) {
      return path.join(imagesDir, entry.name);
    }
  }
  return null;
};

const getSessionOr404 = (res, sessionId) => {
  const session = sessionStore.getSession(sessionId);
  if (!session) {
    sendError(res, 404, `Session '${sessionId}' not found`);
    return null;
  }
  return session;
};

const getAcquisitionSessionOr404 = (res, sessionId) => {
  const session = acquisitionStore.getSession(sessionId);
  if (!session) {
    sendError(res, 404, `Acquisition session '${sessionId}' not found`);
    return null;
  }
  return session;
};

const trimFormValue = (value) => String(value ?? "").trim();

const normalizeBirthDate = (value) => {
  const trimmed = trimFormValue(value);
  if (!trimmed) {
    return "";
  }

  const delimitedMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (delimitedMatch) {
    const [, month, day, year] = delimitedMatch;
    return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year}`;
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length === 8) {
    return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
  }

  return trimmed;
};

const normalizeTargetBureau = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return ["equifax", "experian", "transunion"].includes(normalized) ? normalized : null;
};

const forcedAcquisitionTargetBureau = normalizeTargetBureau(process.env.ACQUISITION_FORCE_TARGET_BUREAU);

const normalizeAcquisitionInput = (payload = {}) => ({
  firstName: trimFormValue(payload.firstName),
  middleInitial: trimFormValue(payload.middleInitial),
  lastName: trimFormValue(payload.lastName),
  suffix: trimFormValue(payload.suffix),
  birthDate: normalizeBirthDate(payload.birthDate),
  ssn: trimFormValue(payload.ssn),
  confirmSsn: trimFormValue(payload.confirmSsn),
  email: trimFormValue(payload.email),
  phone: trimFormValue(payload.phone),
  currentAddress1: trimFormValue(payload.currentAddress1),
  currentAddress2: trimFormValue(payload.currentAddress2),
  currentCity: trimFormValue(payload.currentCity),
  currentState: trimFormValue(payload.currentState),
  currentZip: trimFormValue(payload.currentZip),
  livedAtCurrentAddressTwoYearsOrMore: payload.livedAtCurrentAddressTwoYearsOrMore !== false,
  previousAddress1: trimFormValue(payload.previousAddress1),
  previousAddress2: trimFormValue(payload.previousAddress2),
  previousCity: trimFormValue(payload.previousCity),
  previousState: trimFormValue(payload.previousState),
  previousZip: trimFormValue(payload.previousZip),
  launchConsentAccepted: payload.launchConsentAccepted === true,
  launchConsentName: trimFormValue(payload.launchConsentName),
  targetBureau: forcedAcquisitionTargetBureau ?? normalizeTargetBureau(payload.targetBureau),
  stopAfterFirstSavedReport: payload.stopAfterFirstSavedReport !== false,
});

const validateAcquisitionInput = (input) => {
  const requiredFields = [
    ["firstName", "first name"],
    ["lastName", "last name"],
    ["birthDate", "date of birth"],
    ["ssn", "social security number"],
    ["confirmSsn", "social security number confirmation"],
    ["email", "email address"],
    ["phone", "phone number"],
    ["currentAddress1", "current address"],
    ["currentCity", "current city"],
    ["currentState", "current state"],
    ["currentZip", "current ZIP code"],
  ];

  const missingFields = requiredFields
    .filter(([key]) => !trimFormValue(input[key]))
    .map(([, label]) => label);

  if (missingFields.length > 0) {
    return `Missing required fields: ${missingFields.join(", ")}.`;
  }

  if (input.ssn !== input.confirmSsn) {
    return "Social Security Number and confirmation must match.";
  }

  if (!input.livedAtCurrentAddressTwoYearsOrMore) {
    const previousRequired = [
      ["previousAddress1", "previous address"],
      ["previousCity", "previous city"],
      ["previousState", "previous state"],
      ["previousZip", "previous ZIP code"],
    ];
    const previousMissing = previousRequired
      .filter(([key]) => !trimFormValue(input[key]))
      .map(([, label]) => label);
    if (previousMissing.length > 0) {
      return `Because the current address is under two years old, fill: ${previousMissing.join(", ")}.`;
    }
  }

  if (input.launchConsentAccepted !== true) {
    return "Confirm the interactive retrieval consent before launching the remote browser session.";
  }

  if (!input.launchConsentName) {
    return "Enter the consumer's name in the launch consent gate before starting the remote browser session.";
  }

  return null;
};

const getDraftOr404 = async (res, draftId) => {
  const draft = await disputeLetterStore.getDraft(draftId);
  if (!draft) {
    sendError(res, 404, `Draft '${draftId}' not found`);
    return null;
  }
  return draft;
};

const resolveSessionContext = async (sessionId) => {
  const liveSession = sessionStore.getSession(sessionId);
  if (liveSession) {
    return liveSession;
  }

  const workspaceDir = path.join(appConfig.sessionRoot, sessionId);
  try {
    await fs.access(workspaceDir);
  } catch {
    return null;
  }

  const uploadsDir = path.join(workspaceDir, "uploads");
  let uploadedFilePath = null;
  let uploadedFileName = null;
  try {
    const uploadEntries = (await fs.readdir(uploadsDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
      .sort((left, right) => left.name.localeCompare(right.name));
    if (uploadEntries[0]) {
      uploadedFileName = uploadEntries[0].name;
      uploadedFilePath = path.join(uploadsDir, uploadEntries[0].name);
    }
  } catch {
    // best effort only
  }

  return {
    id: sessionId,
    workspaceDir,
    uploadedFileName,
    uploadedFilePath,
  };
};

const fileNameMatchKey = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const resolveFallbackSessionContextForDraft = async (draft) => {
  const expectedFileName = draft?.reportSummary?.fileName;
  const expectedKey = fileNameMatchKey(expectedFileName);
  if (!expectedKey) {
    return null;
  }

  let workspaceEntries = [];
  try {
    workspaceEntries = await fs.readdir(appConfig.sessionRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = [];
  for (const entry of workspaceEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const workspaceDir = path.join(appConfig.sessionRoot, entry.name);
    const uploadsDir = path.join(workspaceDir, "uploads");
    const resultJsonPath = path.join(workspaceDir, "outputs", "result.json");
    const imagesDir = path.join(workspaceDir, "ingestion", "images");

    try {
      await Promise.all([fs.access(resultJsonPath), fs.access(imagesDir)]);
    } catch {
      continue;
    }

    let uploadEntries = [];
    try {
      uploadEntries = (await fs.readdir(uploadsDir, { withFileTypes: true }))
        .filter((uploadEntry) => uploadEntry.isFile() && uploadEntry.name.toLowerCase().endsWith(".pdf"))
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch {
      continue;
    }

    const matchedUpload = uploadEntries.find((uploadEntry) => fileNameMatchKey(uploadEntry.name) === expectedKey);
    if (!matchedUpload) {
      continue;
    }

    const workspaceStat = await fs.stat(workspaceDir);
    candidates.push({
      id: entry.name,
      workspaceDir,
      uploadedFileName: matchedUpload.name,
      uploadedFilePath: path.join(uploadsDir, matchedUpload.name),
      mtimeMs: workspaceStat.mtimeMs,
    });
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0] ?? null;
};

const getSessionContextOr404 = async (res, sessionId) => {
  const session = await resolveSessionContext(sessionId);
  if (!session) {
    sendError(res, 404, `Session '${sessionId}' not found`);
    return null;
  }
  return session;
};

const writeHealthReadme = async () => {
  const target = path.join(appConfig.sessionRoot, ".keep");
  await fs.writeFile(target, "backend session workspace\n", "utf8");
};

const PAYMENT_HISTORY_ACCURACY_ISSUES = new Set([
  "payment_history_missing_months",
  "recent_payment_missing_when_history_implies_payment",
  "delinquency_progression_inconsistency",
  "retroactive_derogatory_backfill_after_reporting_gap",
]);

const buildReasonTypeLookup = (draft) =>
  new Map(
    (draft?.selectedReasons ?? [])
      .filter((reason) => reason && typeof reason === "object" && reason.id && reason.issueType)
      .map((reason) => [String(reason.id), String(reason.issueType)])
  );

const executeEvidenceGenerationScript = async ({
  draftPath,
  outputDir,
  session,
  highlightedReportPath = null,
  retryMode = "default",
  exhibitsDir = null,
  exhibitNumbering = null,
}) => {
  const args = [
    appConfig.disputeEvidenceScript,
    draftPath,
    "--source-pdf",
    session.uploadedFilePath,
    "--images-dir",
    path.join(session.workspaceDir, "ingestion", "images"),
    "--result-json",
    path.join(session.workspaceDir, "outputs", "result.json"),
    "--output-dir",
    outputDir,
    "--session-id",
    session.id,
    "--retry-mode",
    retryMode,
  ];

  if (highlightedReportPath) {
    args.push("--highlighted-pdf-path", highlightedReportPath);
  }
  if (exhibitsDir) {
    args.push("--exhibits-dir", exhibitsDir);
  }
  if (exhibitNumbering) {
    args.push("--exhibit-numbering", exhibitNumbering);
  }

  const { stdout } = await execFileAsync(appConfig.pythonExecutable, args, {
    cwd: appConfig.repoRoot,
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });

  return JSON.parse(String(stdout || "{}"));
};

const readPngDimensions = async (filePath) => {
  const handle = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(24);
    await handle.read(header, 0, 24, 0);
    if (header.readUInt32BE(12) !== 0x49484452) {
      return null; // not an IHDR chunk where PNG requires it
    }
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    await handle.close();
  }
};

// The persisted copy of exhibits-manifest.json gains widthPx/heightPx per slide
// (read from each PNG's IHDR) so the letter builder can emit explicit <img>
// dimensions — the preview paginator measures synchronously and would treat a
// dimension-less image as zero-height. Enrichment lives here, NOT in the
// certified evidence generator.
// A new evidence manifest supersedes every companion generated under the old
// one (Phase-5 panel HIGH): stale memorandum files are deleted and their
// renderState fields nulled wherever a fresh manifest is persisted — same
// invariant the highlighted report already follows.
const supersedeMemorandumArtifacts = async (renderState) => {
  for (const stale of [renderState?.memorandumDocxPath, renderState?.memorandumPdfPath]) {
    if (stale) {
      await fs.rm(stale, { force: true }).catch(() => {});
    }
  }
  return {
    memorandumDocxPath: null,
    memorandumDocxUrl: null,
    memorandumPdfPath: null,
    memorandumPdfUrl: null,
  };
};

const loadEnrichedExhibitsManifest = async (exhibitsDir) => {
  try {
    const raw = await fs.readFile(path.join(exhibitsDir, "exhibits-manifest.json"), "utf8");
    const manifest = JSON.parse(raw);
    for (const exhibit of manifest?.exhibits ?? []) {
      for (const slide of exhibit?.slides ?? []) {
        if (!slide?.file) continue;
        try {
          const dims = await readPngDimensions(path.join(exhibitsDir, path.basename(slide.file)));
          if (dims) {
            slide.widthPx = dims.width;
            slide.heightPx = dims.height;
          } else {
            console.warn(`[exhibits] no IHDR dims for ${slide.file} — preview pagination may misestimate its height`);
          }
        } catch (error) {
          // missing/unreadable PNG: slide stays dimension-less; renderers warn-and-skip
          console.warn(`[exhibits] could not read dims for ${slide.file}: ${String(error)}`);
        }
      }
    }
    return manifest;
  } catch {
    return null;
  }
};

const runHighlightValidation = async ({ draftPath, manifestPath, imagesDir, outputDir }) => {
  try {
    const { stdout } = await execFileAsync(
      appConfig.pythonExecutable,
      [
        appConfig.disputeHighlightValidatorScript,
        "--draft-json",
        draftPath,
        "--manifest-json",
        manifestPath,
        "--images-dir",
        imagesDir,
        "--output-dir",
        outputDir,
        "--provider",
        "auto",
      ],
      {
        cwd: appConfig.repoRoot,
        env: process.env,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    const payload = JSON.parse(String(stdout || "{}"));
    const reportPath = payload?.reportPath ? String(payload.reportPath) : null;
    let report = null;
    if (reportPath) {
      report = JSON.parse(await fs.readFile(reportPath, "utf8"));
    }
    const validatorActive = Boolean(report?.summary?.validatorModel);
    return { reportPath, report, validatorActive };
  } catch {
    return { reportPath: null, report: null, validatorActive: false };
  }
};

const structuralProblemsForBundle = (bundle, issueType) => {
  if (!PAYMENT_HISTORY_ACCURACY_ISSUES.has(issueType)) {
    return [];
  }
  const labels = new Set(
    (bundle?.slides ?? []).flatMap((slide) =>
      (slide?.highlightBoxes ?? [])
        .filter((box) => box && typeof box === "object")
        .map((box) => String(box.label ?? "").trim())
        .filter(Boolean)
    ),
  );
  switch (issueType) {
    case "payment_history_missing_months":
      return [
        ...(labels.has("Missing payment-history month") ? [] : ["missing_slot_proof_not_shown"]),
        ...(labels.has("Older reported payment-history month") || labels.has("Newer reported payment-history month")
          ? []
          : ["gap_boundary_not_shown"]),
      ];
    case "recent_payment_missing_when_history_implies_payment":
      return [
        ...(labels.has("Reported recent payment field") ? [] : ["recent_payment_field_not_shown"]),
        ...(labels.has("Latest current payment-history month") ? [] : ["recent_current_month_not_shown"]),
      ];
    case "delinquency_progression_inconsistency":
      return [
        ...(labels.has("Earlier delinquency month") ? [] : ["earlier_delinquency_month_not_shown"]),
        ...(labels.has("Later delinquency month") ? [] : ["later_delinquency_month_not_shown"]),
      ];
    case "retroactive_derogatory_backfill_after_reporting_gap":
      return [
        ...(labels.has("Blank reporting-gap month") ? [] : ["missing_slot_proof_not_shown"]),
        ...(labels.has("Later derogatory month after the gap") ? [] : ["later_derogatory_month_not_shown"]),
        ...(labels.has("Earlier reported month before the gap") ? [] : ["earlier_boundary_month_not_shown"]),
      ];
    default:
      return [];
  }
};

const bundleLooksOversized = (bundle, issueType) => {
  if (!PAYMENT_HISTORY_ACCURACY_ISSUES.has(issueType)) {
    return false;
  }
  return (bundle?.slides ?? []).some((slide) => {
    const crop = slide?.cropBox;
    const width = Number(slide?.pageImageWidth ?? 0);
    const height = Number(slide?.pageImageHeight ?? 0);
    if (!crop || !width || !height) {
      return false;
    }
    const cropAreaRatio =
      (Number(crop.width ?? 0) * Number(crop.height ?? 0)) /
      Math.max(width * height, 1);
    return cropAreaRatio > 0.28 || (slide?.highlightBoxes?.length ?? 0) > 6;
  });
};

const shouldRetryEvidenceManifest = (manifest, draft, validationReport, validatorActive) => {
  const reasonTypeById = buildReasonTypeLookup(draft);
  const validationByReasonId = new Map(
    (validationReport?.reasons ?? [])
      .filter((reason) => reason && reason.reasonId)
      .map((reason) => [String(reason.reasonId), reason]),
  );
  return (manifest?.reasons ?? []).some((bundle) => {
    const reasonId = String(bundle?.reasonId ?? "");
    const issueType = reasonTypeById.get(reasonId) ?? "";
    if (!PAYMENT_HISTORY_ACCURACY_ISSUES.has(issueType) || bundle?.resolutionMode !== "canonical") {
      return false;
    }
    const structuralProblems = structuralProblemsForBundle(bundle, issueType);
    if (structuralProblems.length > 0 || bundleLooksOversized(bundle, issueType)) {
      return true;
    }
    if (!validatorActive) {
      return false;
    }
    const validation = validationByReasonId.get(reasonId);
    return Boolean(validation && validation.verdict !== "pass");
  });
};

const annotateManifestWithValidation = ({
  manifest,
  draft,
  validationReport,
  validationReportPath,
  validatorActive,
  retryCount,
  retryMode,
}) => {
  if (!manifest) {
    return null;
  }
  const reasonTypeById = buildReasonTypeLookup(draft);
  const validationByReasonId = new Map(
    (validationReport?.reasons ?? [])
      .filter((reason) => reason && reason.reasonId)
      .map((reason) => [String(reason.reasonId), reason]),
  );

  const nextReasons = (manifest.reasons ?? []).map((bundle) => {
    const reasonId = String(bundle?.reasonId ?? "");
    const issueType = reasonTypeById.get(reasonId) ?? "";
    const validation = validationByReasonId.get(reasonId);
    const structuralProblems = structuralProblemsForBundle(bundle, issueType);
    const validatorProblems =
      validatorActive && validation
        ? (validation.problems ?? []).filter((problem) => problem !== "validator_not_configured")
        : [];
    const blockedByValidation =
      PAYMENT_HISTORY_ACCURACY_ISSUES.has(issueType) &&
      bundle?.resolutionMode === "canonical" &&
      (structuralProblems.length > 0 ||
        (validatorActive && validation && validation.verdict !== "pass"));

    return {
      ...bundle,
      status: blockedByValidation ? "unresolved" : bundle.status,
      exportGrade: blockedByValidation ? false : bundle.exportGrade,
      retryCount,
      retryMode,
      validationVerdict: validation?.verdict ?? (structuralProblems.length > 0 ? "fail" : "review"),
      validationConfidence: validation?.confidence ?? 0,
      validationProblems: [...structuralProblems, ...validatorProblems],
      blockedByValidation,
    };
  });

  const unresolvedReasonIds = nextReasons
    .filter((bundle) => bundle.status !== "ready")
    .map((bundle) => bundle.reasonId);
  const blockingUnresolvedReasonIds = nextReasons
    .filter((bundle) => bundle.requiresCanonicalProvenance && bundle.status !== "ready")
    .map((bundle) => bundle.reasonId);
  const exportableReasonIds = nextReasons
    .filter((bundle) => bundle.exportGrade)
    .map((bundle) => bundle.reasonId);

  return {
    ...manifest,
    retryMode,
    retryCount,
    validationReportPath,
    validationSummary: validationReport?.summary ?? null,
    unresolvedReasonIds,
    blockingUnresolvedReasonIds,
    exportableReasonIds,
    reasons: nextReasons,
  };
};

const runEvidenceGeneration = async (
  draft,
  { generateHighlightedReport = false, skipValidation = false, generateExhibits = false, exhibitNumbering = null } = {},
) => {
  if (!Array.isArray(draft?.selectedReasons) || draft.selectedReasons.length === 0) {
    throw new Error("Select at least one dispute reason before generating dispute evidence.");
  }

  const session =
    (await resolveSessionContext(draft.sessionId)) ??
    (await resolveFallbackSessionContextForDraft(draft));
  if (!session?.workspaceDir) {
    throw new Error(`Source session '${draft.sessionId}' could not be resolved.`);
  }

  if (!session.uploadedFilePath) {
    throw new Error("The original uploaded report PDF is not available for this draft.");
  }

  const outputDir = path.join(appConfig.disputeOutputRoot, draft.id);
  const draftPath = path.join(outputDir, "draft.json");
  const highlightedReportPath = path.join(outputDir, "highlighted-report.pdf");
  const imagesDir = path.join(session.workspaceDir, "ingestion", "images");
  const exhibitsDir = generateExhibits ? path.join(outputDir, "exhibits") : null;
  const exhibitOptions = { exhibitsDir, exhibitNumbering: exhibitNumbering ?? (generateExhibits ? "numeric" : null) };
  let retryMode = "default";
  let retryCount = 0;
  let evidenceResult = await executeEvidenceGenerationScript({
    draftPath,
    outputDir,
    session,
    retryMode,
    ...exhibitOptions,
  });

  let validationResult = skipValidation
    ? { reportPath: null, report: null, validatorActive: false }
    : await runHighlightValidation({
        draftPath,
        manifestPath: evidenceResult.manifestPath,
        imagesDir,
        outputDir: path.join(outputDir, "highlight-validation", retryMode),
      });

  if (
    retryCount < appConfig.disputeEvidenceMaxRetries &&
    shouldRetryEvidenceManifest(
      evidenceResult.manifest,
      draft,
      validationResult.report,
      validationResult.validatorActive,
    )
  ) {
    retryCount += 1;
    retryMode = "tight";
    evidenceResult = await executeEvidenceGenerationScript({
      draftPath,
      outputDir,
      session,
      retryMode,
      ...exhibitOptions,
    });
    validationResult = skipValidation
      ? { reportPath: null, report: null, validatorActive: false }
      : await runHighlightValidation({
          draftPath,
          manifestPath: evidenceResult.manifestPath,
          imagesDir,
          outputDir: path.join(outputDir, "highlight-validation", retryMode),
        });
  }

  let annotatedManifest = annotateManifestWithValidation({
    manifest: evidenceResult.manifest,
    draft,
    validationReport: validationResult.report,
    validationReportPath: validationResult.reportPath,
    validatorActive: validationResult.validatorActive,
    retryCount,
    retryMode,
  });

  if (annotatedManifest && evidenceResult.manifestPath) {
    await fs.writeFile(evidenceResult.manifestPath, JSON.stringify(annotatedManifest, null, 2), "utf8");
  }

  let highlightedReportPdfPath = null;
  const canGenerateHighlightedReport =
    (annotatedManifest?.blockingUnresolvedReasonIds?.length ?? 0) === 0 &&
    (annotatedManifest?.exportableReasonIds?.length ?? 0) > 0;

  if (generateHighlightedReport && canGenerateHighlightedReport) {
    const highlightedResult = await executeEvidenceGenerationScript({
      draftPath,
      outputDir,
      session,
      retryMode,
      highlightedReportPath,
      ...exhibitOptions,
    });
    highlightedReportPdfPath = highlightedResult.highlightedReportPdfPath ?? highlightedReportPath;
    if (annotatedManifest && evidenceResult.manifestPath) {
      await fs.writeFile(evidenceResult.manifestPath, JSON.stringify(annotatedManifest, null, 2), "utf8");
    }
  } else if (generateHighlightedReport) {
    await fs.rm(highlightedReportPath, { force: true });
  }

  return {
    ...evidenceResult,
    manifest: annotatedManifest,
    canGenerateHighlightedReport,
    highlightedReportPdfPath,
    exhibitsDir,
    validationReportPath: validationResult.reportPath,
    validationSummary: validationResult.report?.summary ?? null,
    evidenceRetryMode: retryMode,
    evidenceRetryCount: retryCount,
  };
};

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    apiPort: appConfig.apiPort,
    profileDefault: appConfig.profileDefault,
    supportedProfiles: appConfig.supportedProfiles,
    model: appConfig.ollamaModel,
    visionModel: appConfig.ollamaVisionModel,
    retentionSeconds: appConfig.retentionSeconds,
  });
});

app.post("/api/acquisition/sessions", async (req, res) => {
  const input = normalizeAcquisitionInput(req.body ?? {});
  const validationError = validateAcquisitionInput(input);
  if (validationError) {
    sendError(res, 400, validationError);
    return;
  }

  try {
    const closedSessionCount = await acquisitionStore.deleteAllSessions();
    const orphanedBrowserCount = await killOrphanedAcquisitionBrowsers();
    const session = await acquisitionStore.createSession(input);
    if (closedSessionCount > 0 || orphanedBrowserCount > 0) {
      acquisitionStore.appendLog(
        session,
        `Any previous guided browser session was closed automatically before this new launch started.`,
      );
      acquisitionStore.appendActivity(session, {
        kind: "controller",
        title: "Previous browser session closed",
        detail:
          "The backend closed the earlier guided browser session before launching this new one so the machine only runs one live browser-control session at a time.",
        status: "completed",
      });
    }
    acquisitionStore.appendActivity(session, {
      kind: "consent",
      title: "Interactive retrieval consent confirmed",
      detail: `The user approved the remote-controlled browser session and signed the launch consent as ${input.launchConsentName} before the browser was launched.`,
      status: "completed",
    });
    acquisitionStore.setProgress(session, {
      progress: 4,
      stage: "Launching a headed Chrome window in a fresh isolated session...",
      currentBureau: null,
      currentUrl: null,
    });

    res.status(201).json({
      status: "ok",
      session: acquisitionStore.serializeSession(session),
    });

    void (async () => {
      try {
        await runAnnualCreditReportAcquisition({
          session,
          store: acquisitionStore,
          input,
        });
      } catch {
        // session state already updated in the agent
      }
    })();
  } catch (error) {
    sendError(res, 500, "Failed to start the acquisition session.", String(error));
  }
});

app.get("/api/acquisition/sessions", (_req, res) => {
  const sessions = acquisitionStore.listSessions().map((session) => ({
    sessionId: session.id,
    status: session.status,
    currentBureau: session.currentBureau ?? null,
    currentStep: session.currentStep ?? "launch_browser",
    currentUrl: session.currentUrl ?? null,
    pendingPromptType: session.pendingPrompt?.type ?? null,
    pendingPromptTitle: session.pendingPrompt?.title ?? null,
    controllerStatus: session.controller?.status ?? "booting",
    updatedAt: session.updatedAt,
    debugEventCount: session.debugEvents?.length ?? 0,
    lastDebugEvent: session.debugEvents?.at?.(-1) ?? null,
  }));

  res.json({
    status: "ok",
    sessions,
  });
});

app.get("/api/acquisition/sessions/:sessionId/status", (req, res) => {
  const session = getAcquisitionSessionOr404(res, req.params.sessionId);
  if (!session) return;
  const compact = String(req.query?.compact ?? "").trim() === "1";

  res.json({
    status: "ok",
    session: compact
      ? acquisitionStore.serializeSessionCompact(session)
      : acquisitionStore.serializeSession(session),
  });
});

app.post("/api/acquisition/sessions/:sessionId/respond", (req, res) => {
  const session = getAcquisitionSessionOr404(res, req.params.sessionId);
  if (!session) return;

  const promptId = trimFormValue(req.body?.promptId);
  if (!promptId) {
    sendError(res, 400, "A promptId is required.");
    return;
  }

  try {
    acquisitionStore.respondToPrompt(session, promptId, req.body?.response ?? {});
    res.json({
      status: "ok",
      session: acquisitionStore.serializeSession(session),
    });
  } catch (error) {
    sendError(res, 409, error instanceof Error ? error.message : "The prompt could not be resolved.");
  }
});

app.post("/api/acquisition/sessions/:sessionId/browser-debug", (req, res) => {
  const session = getAcquisitionSessionOr404(res, req.params.sessionId);
  if (!session) return;

  acquisitionStore.appendDebugEvent(session, {
    source: trimFormValue(req.body?.source) || "browser-overlay",
    event: trimFormValue(req.body?.event) || "debug",
    detail: trimFormValue(req.body?.detail),
    data: req.body?.data && typeof req.body.data === "object" ? req.body.data : null,
  });

  res.json({
    status: "ok",
  });
});

app.post("/api/acquisition/sessions/:sessionId/controller-ready", (req, res) => {
  const session = getAcquisitionSessionOr404(res, req.params.sessionId);
  if (!session) return;

  const channel = trimFormValue(req.body?.channel) || "browser_gate";
  const source = trimFormValue(req.body?.source) || "browser-overlay";

  acquisitionStore.markControllerReady(session, {
    channel,
    source,
  });
  acquisitionStore.setControllerState(session, {
    status: session.status === "waiting_for_user" ? "waiting_for_user" : "driving",
  });

  res.json({
    status: "ok",
    session: acquisitionStore.serializeSession(session),
  });
});

app.get("/api/acquisition/sessions/:sessionId/reports/:bureau/file", (req, res) => {
  const session = getAcquisitionSessionOr404(res, req.params.sessionId);
  if (!session) return;

  const bureauKey = trimFormValue(req.params.bureau).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const report = session.downloadedReports.find((entry) => entry.bureauKey === bureauKey);
  if (!report?.filePath) {
    sendError(res, 404, `No downloaded report was found for '${req.params.bureau}'.`);
    return;
  }

  res.download(report.filePath, report.fileName);
});

app.delete("/api/acquisition/sessions/:sessionId", async (req, res) => {
  await acquisitionStore.deleteSession(req.params.sessionId);
  await killOrphanedAcquisitionBrowsers();
  res.status(204).send();
});

app.post("/api/sessions", async (_req, res) => {
  try {
    const session = await sessionStore.createSession();
    res.status(201).json({
      status: "ok",
      sessionId: session.id,
      createdAt: session.createdAt,
      profileDefault: appConfig.profileDefault,
    });
  } catch (error) {
    sendError(res, 500, "Failed to create session", String(error));
  }
});

app.post("/api/sessions/:sessionId/upload", upload.single("file"), async (req, res) => {
  const session = getSessionOr404(res, req.params.sessionId);
  if (!session) return;

  if (!req.file) {
    sendError(res, 400, "No file uploaded. Use form field 'file'.");
    return;
  }

  const fileName = req.file.originalname ?? "uploaded.pdf";
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    sendError(res, 400, "Only PDF files are supported.");
    return;
  }

  try {
    const filePath = await sessionStore.setUploadedFile(session, fileName, req.file.buffer);
    res.json({
      status: "ok",
      sessionId: session.id,
      uploadedFileName: fileName,
      uploadedFilePath: filePath,
      bytes: req.file.size,
    });
  } catch (error) {
    sendError(res, 500, "Failed to store uploaded PDF", String(error));
  }
});

app.post("/api/sessions/:sessionId/upload-chunk", chunkUpload.single("chunk"), async (req, res) => {
  const session = getSessionOr404(res, req.params.sessionId);
  if (!session) return;

  if (!req.file) {
    sendError(res, 400, "No chunk uploaded. Use form field 'chunk'.");
    return;
  }

  const fileName = String(req.body?.fileName ?? "").trim() || "uploaded.pdf";
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    sendError(res, 400, "Only PDF files are supported.");
    return;
  }

  const chunkIndex = Number.parseInt(String(req.body?.chunkIndex ?? ""), 10);
  const totalChunks = Number.parseInt(String(req.body?.totalChunks ?? ""), 10);
  if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || chunkIndex < 0 || totalChunks < 1 || chunkIndex >= totalChunks) {
    sendError(res, 400, "Chunk metadata is invalid.");
    return;
  }

  const uploadsDir = path.join(session.workspaceDir, "uploads");
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const targetPath = path.join(uploadsDir, safeName);

  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    if (chunkIndex === 0) {
      await fs.writeFile(targetPath, req.file.buffer);
    } else {
      try {
        await fs.access(targetPath);
      } catch {
        sendError(res, 409, "Upload chunks arrived out of order. Please retry the upload.");
        return;
      }
      await fs.appendFile(targetPath, req.file.buffer);
    }

    const progress = 5 + Math.round(((chunkIndex + 1) / totalChunks) * 15);
    if (chunkIndex === totalChunks - 1) {
      sessionStore.registerUploadedFile(session, fileName, targetPath);
      const stat = await fs.stat(targetPath);
      res.json({
        status: "ok",
        sessionId: session.id,
        uploadedFileName: fileName,
        uploadedFilePath: targetPath,
        bytes: stat.size,
        chunkIndex,
        totalChunks,
        complete: true,
      });
      return;
    }

    sessionStore.setUploadProgress(
      session,
      progress,
      `Uploading PDF to backend session... (${chunkIndex + 1}/${totalChunks})`
    );

    res.json({
      status: "ok",
      sessionId: session.id,
      uploadedFileName: fileName,
      chunkIndex,
      totalChunks,
      complete: false,
    });
  } catch (error) {
    sendError(res, 500, "Failed to store uploaded PDF chunk", String(error));
  }
});

app.post("/api/sessions/:sessionId/process", async (req, res) => {
  const session = getSessionOr404(res, req.params.sessionId);
  if (!session) return;

  if (!session.uploadedFilePath) {
    sendError(res, 400, "Upload a PDF before processing.");
    return;
  }

  const profile = req.body?.profile ?? await detectProfileFromPdf(session.uploadedFilePath, session.uploadedFileName);
  if (!appConfig.supportedProfiles.includes(profile)) {
    sendError(
      res,
      400,
      `Unsupported profile '${profile}'. Supported profiles: ${appConfig.supportedProfiles.join(", ")}`
    );
    return;
  }

  if (session.status === "processing") {
    res.status(202).json({
      status: "accepted",
      sessionId: session.id,
      profile,
      sessionStatus: session.status,
      progress: session.progress ?? null,
      deleteOnRead: appConfig.retentionSeconds === 0,
    });
    return;
  }

  sessionStore.setProcessing(session);
  const deleteOnRead = false;

  res.status(202).json({
    status: "accepted",
    sessionId: session.id,
    profile,
    sessionStatus: session.status,
    progress: session.progress ?? null,
    deleteOnRead,
  });

  void (async () => {
    try {
      const { workerOutput, logs } = await runWorkerExtraction({
        session,
        profile,
        config: appConfig,
        onProgress: (progressUpdate) => {
          sessionStore.setProgress(session, progressUpdate);
        },
      });

      const componentStatusSeed = componentStatusSeeds[profile] ?? {};
      const workerResultRaw = workerOutput.result ?? {
        components: {},
        componentStatus: componentStatusSeed,
        validationIssues: [
          {
            component: "pipeline",
            severity: "critical",
            code: "empty_worker_result",
            message: "Worker completed without a valid result payload.",
          },
        ],
        readyForAttorney: false,
        meta: {},
      };
      const mergedStatus = {
        ...componentStatusSeed,
        ...(workerResultRaw.componentStatus ?? {}),
      };
      for (const key of Object.keys(mergedStatus)) {
        if (mergedStatus[key] !== "complete") {
          mergedStatus[key] = "failed";
        }
      }

      const workerResult = {
        ...workerResultRaw,
        components: workerResultRaw.components ?? {},
        componentStatus: mergedStatus,
        validationIssues: Array.isArray(workerResultRaw.validationIssues)
          ? workerResultRaw.validationIssues
          : [],
        readyForAttorney: Boolean(workerResultRaw.readyForAttorney),
        meta: workerResultRaw.meta ?? {},
      };

      const parsedReport = mapWorkerResultToCreditReport({ session, workerResult });

      const payload = {
        sessionId: session.id,
        status: "ok",
        profile,
        result: workerResult,
        report: parsedReport,
        logs,
      };

      sessionStore.setProcessed(session, payload, { deleteOnRead });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sessionStore.setFailed(session, errorMessage);
    }
  })();
});

app.get("/api/sessions/:sessionId/status", (req, res) => {
  const session = getSessionOr404(res, req.params.sessionId);
  if (!session) return;

  res.json({
    status: "ok",
    sessionId: session.id,
    sessionStatus: session.status,
    progress: session.progress ?? null,
    lastError: session.lastError,
    uploadedFileName: session.uploadedFileName,
    hasResult: Boolean(session.result),
  });
});

app.get("/api/sessions/:sessionId/pages/:pageNumber/image", async (req, res) => {
  const session = await getSessionContextOr404(res, req.params.sessionId);
  if (!session) return;

  const pageNumber = Number.parseInt(req.params.pageNumber, 10);
  if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
    sendError(res, 400, "Page number must be a positive integer.");
    return;
  }

  try {
    const imagePath = await resolvePageImagePath(session.workspaceDir, pageNumber);
    if (!imagePath) {
      throw new Error("not found");
    }
    res.setHeader("Cache-Control", "private, max-age=60");
    res.type("png");
    res.sendFile(imagePath);
  } catch {
    sendError(res, 404, `Page image ${pageNumber} was not found for this session.`);
  }
});

app.get("/api/evidence/slide-image", async (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  const rawSlide = typeof req.query.slide === "string" ? req.query.slide : "";
  if (!sessionId || !rawSlide) {
    sendError(res, 400, "Slide image requires sessionId and slide.");
    return;
  }

  const session = await getSessionContextOr404(res, sessionId);
  if (!session) return;

  let slide;
  try {
    slide = JSON.parse(rawSlide);
  } catch {
    sendError(res, 400, "Slide payload is invalid.");
    return;
  }

  const pageNumber = Number.parseInt(String(slide?.pageNumber ?? ""), 10);
  const pageImageWidth = Number(slide?.pageImageWidth);
  const pageImageHeight = Number(slide?.pageImageHeight);
  const cropBox = slide?.cropBox ?? {};
  const highlightBoxes = Array.isArray(slide?.highlightBoxes) ? slide.highlightBoxes : [];

  if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
    sendError(res, 400, "Slide page number is invalid.");
    return;
  }

  try {
    const imagePath = await resolvePageImagePath(session.workspaceDir, pageNumber);
    if (!imagePath) {
      throw new Error("not found");
    }

    const imageBuffer = await fs.readFile(imagePath);
    const imageDataUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
    const cropWidth = Math.max(Number(cropBox.width) || 1, 1);
    const cropHeight = Math.max(Number(cropBox.height) || 1, 1);
    const cropX = Number(cropBox.x) || 0;
    const cropY = Number(cropBox.y) || 0;

    const highlightRects = highlightBoxes
      .map((box) => {
        const rectX = Math.max((Number(box?.x) || 0) - cropX, 0);
        const rectY = Math.max((Number(box?.y) || 0) - cropY, 0);
        const rectWidth = Math.max(Number(box?.width) || 0, 0);
        const rectHeight = Math.max(Number(box?.height) || 0, 0);
        return `<rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" fill="rgba(255, 235, 59, 0.42)" stroke="rgba(255, 235, 59, 0.42)" stroke-width="2" />`;
      })
      .join("");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cropWidth}" height="${cropHeight}" viewBox="0 0 ${cropWidth} ${cropHeight}">
  <image href="${escapeSvgAttribute(imageDataUrl)}" x="${-cropX}" y="${-cropY}" width="${pageImageWidth}" height="${pageImageHeight}" preserveAspectRatio="none" />
  ${highlightRects}
</svg>`;

    res.setHeader("Cache-Control", "private, max-age=60");
    res.type("image/svg+xml");
    res.send(svg);
  } catch {
    sendError(res, 404, `Highlighted slide image for page ${pageNumber} was not found for this session.`);
  }
});

app.get("/api/sessions/:sessionId/result", async (req, res) => {
  const session = getSessionOr404(res, req.params.sessionId);
  if (!session) return;

  if (!session.result) {
    sendError(res, 404, "No processed result available for this session.");
    return;
  }

  const responsePayload = session.result;
  res.json(responsePayload);
});

app.post("/api/dispute-drafts", async (req, res) => {
  const { sessionId, report, intake, reasons, requestKey, hydrateEvidence } = req.body ?? {};
  if (!sessionId || !report || !intake || !Array.isArray(reasons)) {
    sendError(res, 400, "Draft creation requires sessionId, report, intake, and reasons.");
    return;
  }

  try {
    const normalizedRequestKey = typeof requestKey === "string" ? requestKey.trim() : "";
    const shouldHydrateEvidence = hydrateEvidence === true;
    // Create the draft synchronously (with dedup), then run evidence generation as a
    // background job so the HTTP request returns immediately. The frontend polls
    // GET /api/dispute-drafts/lookup?requestKey=... and resolves once the background
    // job sets draftIdsByRequestKey. This avoids proxy timeout for long AI inference.
    const draftCreation = await runSharedJob(inFlightDraftCreations, normalizedRequestKey, async () => {
      const existingDraft = await resolveDraftForRequestKey(normalizedRequestKey);
      if (existingDraft && (!shouldHydrateEvidence || isHydratedEvidenceReady(existingDraft))) {
        return { draft: existingDraft, reused: true, evidenceReady: true };
      }

      // Also check pendingDraftByRequestKey to avoid creating a duplicate draft
      // while evidence is still running in the background from a prior call.
      const pendingDraft = pendingDraftByRequestKey.get(normalizedRequestKey);

      const draft =
        existingDraft ??
        pendingDraft ??
        (await disputeLetterStore.createDraft(buildDisputeLetterDraft({ sessionId, report, intake, reasons })));

      if (!shouldHydrateEvidence) {
        if (normalizedRequestKey) {
          draftIdsByRequestKey.set(normalizedRequestKey, draft.id);
        }
        return { draft, reused: Boolean(existingDraft || pendingDraft), evidenceReady: true };
      }

      // Track this draft as pending so future calls use it instead of creating a new one.
      if (normalizedRequestKey && !pendingDraft) {
        pendingDraftByRequestKey.set(normalizedRequestKey, draft);
      }

      // Fire evidence generation as a background job (non-blocking).
      // inFlightEvidenceJobs deduplicates concurrent requests for the same draft.
      const bgJobKey = `${draft.id}:bg-evidence`;
      if (!inFlightEvidenceJobs.has(bgJobKey)) {
        const bgJob = Promise.resolve()
          .then(async () => {
            const evidenceResult = await runEvidenceGeneration(draft, {
              generateHighlightedReport: false,
              skipValidation: false,
            });
            const hydratedDraft = await disputeLetterStore.saveDraft({
              ...draft,
              evidenceManifest: evidenceResult.manifest ?? null,
              renderState: {
                ...draft.renderState,
                highlightedReportPdfPath: null,
                highlightedReportPdfUrl: null,
                ...(await supersedeMemorandumArtifacts(draft.renderState)),
                evidenceGeneratedAt: evidenceResult.manifest?.generatedAt ?? new Date().toISOString(),
              },
            });
            if (draft.renderState?.highlightedReportPdfPath) {
              await fs.rm(draft.renderState.highlightedReportPdfPath, { force: true }).catch(() => {});
            }
            // Register the draft regardless of whether all evidence bundles are
            // fully resolved — the UI surfaces warnings for partial evidence.
            // This prevents the lookup from timing out when some items can't be
            // localized in the PDF.
            if (normalizedRequestKey) {
              draftIdsByRequestKey.set(normalizedRequestKey, hydratedDraft.id);
            }
          })
          .catch((bgErr) => {
            console.error("[dispute-drafts] Background evidence generation failed:", String(bgErr));
          })
          .finally(() => {
            inFlightEvidenceJobs.delete(bgJobKey);
            if (normalizedRequestKey) {
              pendingDraftByRequestKey.delete(normalizedRequestKey);
            }
          });
        inFlightEvidenceJobs.set(bgJobKey, bgJob);
      }

      // Return immediately — evidence not yet ready. Frontend polls the lookup endpoint.
      return { draft, reused: Boolean(existingDraft || pendingDraft), evidenceReady: false };
    });

    if (!draftCreation.evidenceReady) {
      throw new EvidencePreparationIncompleteError(
        "Highlighted source proof is not fully ready yet. The upload will stay on the processing step until every selected reason has a finalized proof bundle.",
        {
          draftId: draftCreation.draft.id,
          unresolvedReasonIds: collectUnreadyReasonIds(draftCreation.draft),
        },
      );
    }

    res.status(draftCreation.reused ? 200 : 201).json({
      status: "ok",
      draft: attachArtifactUrls(draftCreation.draft),
    });
  } catch (error) {
    if (error instanceof EvidencePreparationIncompleteError) {
      sendError(res, 409, error.message, error.details);
      return;
    }
    sendError(res, 500, "Failed to create dispute letter draft", String(error));
  }
});

app.get("/api/dispute-drafts/lookup", async (req, res) => {
  const requestKey = typeof req.query?.requestKey === "string" ? req.query.requestKey.trim() : "";
  if (!requestKey) {
    sendError(res, 400, "Draft lookup requires requestKey.");
    return;
  }

  try {
    const draft = await resolveDraftForRequestKey(requestKey);
    if (!draft) {
      res.json({
        status: "ok",
        ready: false,
        draft: null,
      });
      return;
    }

    res.json({
      status: "ok",
      ready: true,
      draft: attachArtifactUrls(draft),
    });
  } catch (error) {
    sendError(res, 500, "Failed to look up dispute letter draft", String(error));
  }
});

app.get("/api/dispute-drafts/:draftId", async (req, res) => {
  const draft = await getDraftOr404(res, req.params.draftId);
  if (!draft) return;

  res.json({
    status: "ok",
    draft: attachArtifactUrls(draft),
  });
});

app.patch("/api/dispute-drafts/:draftId/sections/:sectionId", async (req, res) => {
  const draft = await getDraftOr404(res, req.params.draftId);
  if (!draft) return;

  const { group, patch } = req.body ?? {};
  if (!group || !patch || typeof patch !== "object") {
    sendError(res, 400, "Section update requires group and patch.");
    return;
  }

  try {
    const nextDraft = updateDraftSection(draft, group, req.params.sectionId, patch);
    const savedDraft = await disputeLetterStore.saveDraft(nextDraft);
    res.json({
      status: "ok",
      draft: attachArtifactUrls(savedDraft),
    });
  } catch (error) {
    sendError(res, 400, "Failed to update draft section", String(error));
  }
});

app.patch("/api/dispute-drafts/:draftId/full-document", async (req, res) => {
  const draft = await getDraftOr404(res, req.params.draftId);
  if (!draft) return;

  const html = req.body?.html;
  if (typeof html !== "string") {
    sendError(res, 400, "Full document update requires html.");
    return;
  }

  try {
    const nextDraft = updateDraftFullDocument(draft, html);
    const savedDraft = await disputeLetterStore.saveDraft(nextDraft);
    res.json({
      status: "ok",
      draft: attachArtifactUrls(savedDraft),
    });
  } catch (error) {
    sendError(res, 400, "Failed to update full document draft", String(error));
  }
});

app.post("/api/dispute-drafts/:draftId/render", async (req, res) => {
  const draft = await getDraftOr404(res, req.params.draftId);
  if (!draft) return;

  const rebuildFromSections = Boolean(req.body?.rebuildFromSections);

  try {
    const nextDraft = withRenderedPreview(draft, { rebuildFromSections });
    const savedDraft = await disputeLetterStore.saveDraft(nextDraft);
    res.json({
      status: "ok",
      draft: attachArtifactUrls(savedDraft),
    });
  } catch (error) {
    sendError(res, 500, "Failed to render draft preview", String(error));
  }
});

app.post("/api/dispute-drafts/:draftId/evidence", async (req, res) => {
  const draft = await getDraftOr404(res, req.params.draftId);
  if (!draft) return;

  try {
    const persisted = await runSharedJob(inFlightEvidenceJobs, `${draft.id}:evidence`, async () => {
      const evidenceResult = await runEvidenceGeneration(draft, { generateHighlightedReport: false });
      const memoRevocation = await supersedeMemorandumArtifacts(draft.renderState);
      const nextDraft = {
        ...draft,
        evidenceManifest: evidenceResult.manifest ?? null,
        // Evidence regen without exhibits makes any persisted exhibits manifest
        // stale (numbering/content may no longer match) — drop it; the next
        // mode-aware export regenerates it (panel F3).
        exhibitsManifest: null,
        renderState: {
          ...draft.renderState,
          highlightedReportPdfPath: null,
          highlightedReportPdfUrl: null,
          ...memoRevocation,
          evidenceGeneratedAt: evidenceResult.manifest?.generatedAt ?? new Date().toISOString(),
        },
      };
      if (draft.renderState?.highlightedReportPdfPath) {
        await fs.rm(draft.renderState.highlightedReportPdfPath, { force: true });
      }
      return disputeLetterStore.saveDraft(nextDraft);
    });
    res.json({
      status: "ok",
      draft: attachArtifactUrls(persisted),
    });
  } catch (error) {
    sendError(res, 500, "Failed to generate dispute evidence", String(error));
  }
});

app.post("/api/dispute-drafts/:draftId/highlighted-report", async (req, res) => {
  const draft = await getDraftOr404(res, req.params.draftId);
  if (!draft) return;

  try {
    if (req.body?.exhibitNumbering !== undefined && !["numeric", "alpha"].includes(req.body.exhibitNumbering)) {
      return sendError(res, 400, "exhibitNumbering must be numeric | alpha.");
    }
    // The UI passes its CURRENT numbering selection so a numeric→alpha flip
    // in the evidence panel is honored here too (Phase-5 panel LOW-6); the
    // draft's persisted style remains the fallback (panel F9).
    const requestedChipNumbering =
      typeof req.body?.exhibitNumbering === "string" ? req.body.exhibitNumbering : null;
    const chipNumbering = requestedChipNumbering ?? draft.exhibitNumbering ?? null;
    const result = await runSharedJob(inFlightEvidenceJobs, `${draft.id}:highlighted-report`, async () => {
      const evidenceResult = await runEvidenceGeneration(draft, {
        generateHighlightedReport: true,
        exhibitNumbering: chipNumbering,
      });
      const memoRevocation = await supersedeMemorandumArtifacts(draft.renderState);
      const blockingUnresolvedReasonIds = evidenceResult.manifest?.blockingUnresolvedReasonIds ?? [];
      if (!evidenceResult.canGenerateHighlightedReport || blockingUnresolvedReasonIds.length > 0) {
        const nextDraft = await disputeLetterStore.saveDraft({
          ...draft,
          evidenceManifest: evidenceResult.manifest ?? null,
          exhibitsManifest: null,
          ...(requestedChipNumbering ? { exhibitNumbering: requestedChipNumbering } : {}),
          renderState: {
            ...draft.renderState,
            highlightedReportPdfPath: null,
            highlightedReportPdfUrl: null,
            ...memoRevocation,
            evidenceGeneratedAt: evidenceResult.manifest?.generatedAt ?? new Date().toISOString(),
          },
        });
        return {
          blocked: true,
          blockingUnresolvedReasonIds,
          unresolvedReasonIds: evidenceResult.manifest?.unresolvedReasonIds ?? [],
          draft: nextDraft,
        };
      }

      const nextDraft = {
        ...draft,
        evidenceManifest: evidenceResult.manifest ?? null,
        exhibitsManifest: null,
        ...(requestedChipNumbering ? { exhibitNumbering: requestedChipNumbering } : {}),
        renderState: {
          ...draft.renderState,
          highlightedReportPdfPath: evidenceResult.highlightedReportPdfPath ?? null,
          highlightedReportPdfUrl: null,
          ...memoRevocation,
          evidenceGeneratedAt: evidenceResult.manifest?.generatedAt ?? new Date().toISOString(),
        },
      };
      const persisted = await disputeLetterStore.saveDraft(nextDraft);
      return {
        blocked: false,
        draft: persisted,
      };
    });

    if (result.blocked) {
      res.status(409).json({
        status: "error",
        error: "Highlighted report generation is blocked until every canonical Phase 1 dispute is localized accurately.",
        details: {
          unresolvedReasonIds: result.blockingUnresolvedReasonIds,
          allUnresolvedReasonIds: result.unresolvedReasonIds,
          draft: attachArtifactUrls(result.draft),
        },
      });
      return;
    }

    res.json({
      status: "ok",
      draft: attachArtifactUrls(result.draft),
    });
  } catch (error) {
    sendError(res, 500, "Failed to generate highlighted report PDF", String(error));
  }
});

app.post("/api/dispute-drafts/:draftId/export", async (req, res) => {
  const draft = await getDraftOr404(res, req.params.draftId);
  if (!draft) return;

  try {
    if (req.body?.letterMode !== undefined && typeof req.body.letterMode !== "string") {
      return sendError(res, 400, "letterMode must be a string (inline | memorandum | none).");
    }
    if (req.body?.exhibitNumbering !== undefined && typeof req.body.exhibitNumbering !== "string") {
      return sendError(res, 400, "exhibitNumbering must be a string (numeric | alpha).");
    }
    for (const flag of ["inlineExhibits", "memorandum", "highlightedReport"]) {
      if (req.body?.[flag] !== undefined && typeof req.body[flag] !== "boolean") {
        return sendError(res, 400, `${flag} must be a boolean.`);
      }
    }
    const requestedMode = typeof req.body?.letterMode === "string" ? req.body.letterMode : null;
    const requestedNumbering = typeof req.body?.exhibitNumbering === "string" ? req.body.exhibitNumbering : null;
    if (requestedMode !== null && !["inline", "memorandum", "none"].includes(requestedMode)) {
      return sendError(res, 400, `Unknown letterMode '${requestedMode}' — expected inline | memorandum | none.`);
    }
    if (requestedNumbering !== null && !["numeric", "alpha"].includes(requestedNumbering)) {
      return sendError(res, 400, `Unknown exhibitNumbering '${requestedNumbering}' — expected numeric | alpha.`);
    }

    await runExclusive(exportLocks, draft.id, async () => {
    const workingDraft = structuredClone(draft);
    // Evidence-package model (operator, Session 23): the letter always ships;
    // the user picks any combination of three evidence outputs — screenshots
    // inline in the letter, the separate memorandum, and the highlighted
    // report. letterMode remains as the letter-decoration contract (inline =
    // figures, memorandum = "(See Exhibit N)" refs) and as API back-compat.
    const anyFlagProvided = ["inlineExhibits", "memorandum", "highlightedReport"].some(
      (flag) => typeof req.body?.[flag] === "boolean"
    );
    const priorOptions = workingDraft.evidenceOptions ?? {
      inlineExhibits: workingDraft.letterMode === "inline",
      memorandum: workingDraft.letterMode === "memorandum",
      highlightedReport: false,
    };
    let evidenceOptions;
    if (anyFlagProvided) {
      evidenceOptions = {
        inlineExhibits: req.body?.inlineExhibits ?? priorOptions.inlineExhibits ?? false,
        memorandum: req.body?.memorandum ?? priorOptions.memorandum ?? false,
        highlightedReport: req.body?.highlightedReport ?? priorOptions.highlightedReport ?? false,
      };
    } else if (requestedMode !== null) {
      evidenceOptions = {
        inlineExhibits: requestedMode === "inline",
        memorandum: requestedMode === "memorandum",
        highlightedReport: priorOptions.highlightedReport ?? false,
      };
    } else {
      evidenceOptions = { ...priorOptions };
    }
    workingDraft.evidenceOptions = evidenceOptions;
    workingDraft.letterMode = evidenceOptions.inlineExhibits
      ? "inline"
      : evidenceOptions.memorandum
        ? "memorandum"
        : null;
    if (requestedNumbering !== null) {
      workingDraft.exhibitNumbering = requestedNumbering;
    }

    const outputDir = path.join(appConfig.disputeOutputRoot, workingDraft.id);
    const exhibitsDir = path.join(outputDir, "exhibits");
    const exportWarnings = [];
    let exportEvidenceRan = false;

    // Evidence outputs need fresh exhibits (manifest has no freshness fields —
    // the only sound policy is regenerate-immediately-before-render, same draft).
    const wantsExhibits = evidenceOptions.inlineExhibits || evidenceOptions.memorandum;
    const wantsAnyEvidence = wantsExhibits || evidenceOptions.highlightedReport;
    let exhibitsManifestForMemo = null;
    if (wantsAnyEvidence) {
      if (workingDraft.renderState?.documentOverride) {
        exportWarnings.push(
          "full-document override active — evidence outputs were not generated; re-render from sections to use them"
        );
      } else {
        let evidenceResult = null;
        try {
          // Own job key: sharing `${id}:evidence` with POST /evidence lets the
          // two flows steal each other's results across incompatible options
          // (panel finding F2).
          // operator's consistency ruling (Session 23): letter exhibits meet the
          // SAME validation bar as the highlighted report — the export runs
          // full validation like every other evidence path (no skipValidation),
          // and the freshness gate below then blocks exhibits exactly when the
          // certified report would be blocked.
          evidenceResult = await runSharedJob(inFlightEvidenceJobs, `${workingDraft.id}:export-evidence`, () =>
            runEvidenceGeneration(workingDraft, {
              generateExhibits: wantsExhibits,
              generateHighlightedReport: evidenceOptions.highlightedReport,
              exhibitNumbering: workingDraft.exhibitNumbering ?? "numeric",
            })
          );
        } catch (error) {
          evidenceResult = null;
          exportWarnings.push(
            `evidence generation failed — letter rendered without evidence outputs: ${String(error)}`
          );
        }
        // The manifest is validator-annotated (same path as POST /evidence),
        // so persisting it keeps the draft's validation state consistent —
        // and, matching every other path that persists a new manifest, any
        // PREVIOUSLY certified highlighted report is revoked (rulings-panel
        // F1). When this run itself produced a highlighted report, that fresh
        // PDF is coherent with THIS manifest and becomes the certified one.
        if (evidenceResult?.manifest) {
          exportEvidenceRan = true;
          workingDraft.evidenceManifest = evidenceResult.manifest;
          const freshHighlightedPath = evidenceResult.highlightedReportPdfPath ?? null;
          const oldHighlightedPath = workingDraft.renderState?.highlightedReportPdfPath;
          if (oldHighlightedPath && oldHighlightedPath !== freshHighlightedPath) {
            await fs.rm(oldHighlightedPath, { force: true });
          }
          workingDraft.renderState = {
            ...workingDraft.renderState,
            highlightedReportPdfPath: freshHighlightedPath,
            highlightedReportPdfUrl: null,
            evidenceGeneratedAt: evidenceResult.manifest?.generatedAt ?? new Date().toISOString(),
          };
          if (evidenceOptions.highlightedReport && !freshHighlightedPath) {
            exportWarnings.push(
              "highlighted report was requested but generation is blocked for this draft (unresolved dispute localization)"
            );
          }
        }
        // Blocked run = the on-disk exhibits dir was NOT regenerated by Python
        // (its can_generate gate) — loading it would inject STALE evidence into
        // a mailed document (panel finding F1, HIGH). Inject nothing instead.
        const exhibitsFresh =
          wantsExhibits && Boolean(evidenceResult) && evidenceResult.canGenerateHighlightedReport !== false;
        const exhibitsManifest = exhibitsFresh ? await loadEnrichedExhibitsManifest(exhibitsDir) : null;
        exhibitsManifestForMemo = exhibitsManifest;
        if (exhibitsManifest) {
          workingDraft.exhibitsManifest = exhibitsManifest;
          if (Array.isArray(exhibitsManifest.warnings) && exhibitsManifest.warnings.length) {
            exportWarnings.push(...exhibitsManifest.warnings);
          }
          const sectionReasonIds = new Set(
            ["accountDisputes", "personalInformationDisputes"].flatMap((group) =>
              (workingDraft.sections?.[group] ?? [])
                .filter((section) => section.enabled)
                .flatMap((section) => section.reasonIds ?? [])
            )
          );
          const orphanExhibits = (exhibitsManifest.exhibits ?? []).filter(
            (exhibit) => !sectionReasonIds.has(exhibit.reasonId)
          );
          for (const orphan of orphanExhibits) {
            exportWarnings.push(
              `Exhibit ${orphan.exhibit} (${orphan.issueLabel ?? orphan.reasonId}) has no corresponding letter section — it appears in the memorandum and report chips only`
            );
          }
        } else {
          workingDraft.exhibitsManifest = null;
          // Exhibit-flavored warnings only apply when exhibits were requested
          // (Phase-5 panel LOW-4: a successful highlighted-only export must
          // not claim exhibit generation failed).
          if (wantsExhibits && evidenceResult && evidenceResult.canGenerateHighlightedReport === false) {
            exportWarnings.push(
              "evidence generation is blocked for this draft — exhibits were not regenerated; letter rendered without exhibit figures/references"
            );
          } else if (wantsExhibits && evidenceResult) {
            exportWarnings.push(
              "exhibit generation produced no manifest — letter rendered without exhibit figures/references"
            );
          }
        }
      }
    }

    const refreshedDraft = withRenderedPreview(workingDraft);
    const savedDraft = await disputeLetterStore.saveDraft(refreshedDraft);
    const draftPath = path.join(appConfig.disputeOutputRoot, savedDraft.id, "draft.json");
    const generatorArgs = [appConfig.disputeGeneratorScript, draftPath, "--output-dir", outputDir];
    if (savedDraft.letterMode === "inline") {
      generatorArgs.push("--exhibits-dir", exhibitsDir);
    }
    const { stdout } = await execFileAsync(appConfig.pythonExecutable, generatorArgs, {
      cwd: appConfig.repoRoot,
      env: process.env,
    });
    const exportResult = JSON.parse(String(stdout || "{}"));
    if (Array.isArray(exportResult.warnings) && exportResult.warnings.length) {
      exportWarnings.push(...exportResult.warnings);
    }

    // Memorandum (separate evidence document): generated from the SAME saved
    // draft.json + fresh exhibits as the letter, so letter/memo numbering can
    // never disagree. Any previously generated memorandum is superseded the
    // moment a new evidence run happened (same coherence invariant as the
    // highlighted report).
    let memorandumDocxPath = null;
    let memorandumPdfPath = null;
    if (exportEvidenceRan) {
      for (const stale of [savedDraft.renderState?.memorandumDocxPath, savedDraft.renderState?.memorandumPdfPath]) {
        if (stale) {
          await fs.rm(stale, { force: true });
        }
      }
    }
    if (evidenceOptions.memorandum) {
      if (exhibitsManifestForMemo) {
        try {
          const { stdout: memoStdout } = await execFileAsync(
            appConfig.pythonExecutable,
            [appConfig.disputeMemorandumScript, draftPath, "--exhibits-dir", exhibitsDir, "--output-dir", outputDir],
            { cwd: appConfig.repoRoot, env: process.env, maxBuffer: 16 * 1024 * 1024 }
          );
          const memoResult = JSON.parse(String(memoStdout || "{}"));
          memorandumDocxPath = memoResult.docxPath ?? null;
          memorandumPdfPath = memoResult.pdfPath ?? null;
          if (Array.isArray(memoResult.warnings) && memoResult.warnings.length) {
            exportWarnings.push(...memoResult.warnings);
          }
          if (memorandumDocxPath && !memorandumPdfPath) {
            exportWarnings.push("memorandum PDF unavailable (PDF renderer not installed) — DOCX was generated");
          }
        } catch (error) {
          exportWarnings.push(`memorandum generation failed: ${String(error)}`);
        }
      } else {
        exportWarnings.push(
          "memorandum was requested but exhibits are unavailable for this draft — memorandum not generated"
        );
      }
    }
    // Merge onto a FRESH read: a PATCH landing during the evidence/letter run
    // must not be silently reverted by this whole-object save (panel F6). Only
    // export-owned fields are overlaid; if sections changed mid-export, the
    // rendered letter lags them — surface that as draftDirty + a warning.
    const latestDraft = (await disputeLetterStore.getDraft(savedDraft.id)) ?? savedDraft;
    const sectionsChangedMidExport = JSON.stringify(latestDraft.sections) !== JSON.stringify(savedDraft.sections);
    if (sectionsChangedMidExport) {
      exportWarnings.push(
        "draft sections changed while the export was running — the exported letter reflects the pre-change sections; re-export to pick them up"
      );
    }
    // Letter-only re-export: the letter was regenerated with no fresh evidence
    // run, so companions generated under the PREVIOUS letter can no longer be
    // trusted to mirror it — supersede them (Phase-5 panel MED-2).
    let letterOnlySupersede = {};
    if (!exportEvidenceRan) {
      const staleState = latestDraft.renderState ?? {};
      const hadCompanions =
        staleState.memorandumDocxPath ||
        staleState.memorandumPdfPath ||
        staleState.highlightedReportPdfPath ||
        latestDraft.exhibitsManifest;
      if (hadCompanions) {
        for (const stale of [staleState.memorandumDocxPath, staleState.memorandumPdfPath, staleState.highlightedReportPdfPath]) {
          if (stale) {
            await fs.rm(stale, { force: true }).catch(() => {});
          }
        }
        letterOnlySupersede = {
          highlightedReportPdfPath: null,
          highlightedReportPdfUrl: null,
          memorandumDocxPath: null,
          memorandumDocxUrl: null,
          memorandumPdfPath: null,
          memorandumPdfUrl: null,
        };
        exportWarnings.push(
          "previously generated evidence documents were superseded by this letter re-export — re-select evidence outputs to regenerate them"
        );
      }
    }
    const nextDraft = {
      ...latestDraft,
      letterMode: savedDraft.letterMode ?? null,
      exhibitNumbering: savedDraft.exhibitNumbering ?? null,
      evidenceOptions: savedDraft.evidenceOptions ?? null,
      exhibitsManifest: exportEvidenceRan ? savedDraft.exhibitsManifest ?? null : null,
      // evidenceManifest/evidenceGeneratedAt are export-owned ONLY when this
      // export actually ran an evidence job — otherwise a POST /evidence
      // landing mid-export must win (rulings-panel F5).
      evidenceManifest: exportEvidenceRan
        ? savedDraft.evidenceManifest ?? null
        : latestDraft.evidenceManifest ?? null,
      fullDocumentHtml: savedDraft.fullDocumentHtml,
      renderState: {
        ...latestDraft.renderState,
        previewHtml: savedDraft.renderState.previewHtml,
        lastGeneratedFromSectionsAt: savedDraft.renderState.lastGeneratedFromSectionsAt,
        evidenceGeneratedAt: exportEvidenceRan
          ? savedDraft.renderState.evidenceGeneratedAt ?? null
          : latestDraft.renderState?.evidenceGeneratedAt ?? null,
        // coherence must survive this merge — never resurrect artifacts
        // certified under a superseded manifest from a concurrent snapshot;
        // fresh artifacts from THIS run take their place
        ...(exportEvidenceRan
          ? {
              highlightedReportPdfPath: savedDraft.renderState.highlightedReportPdfPath ?? null,
              highlightedReportPdfUrl: null,
              memorandumDocxPath,
              memorandumPdfPath,
              memorandumDocxUrl: null,
              memorandumPdfUrl: null,
            }
          : letterOnlySupersede),
        docxPath: exportResult.docxPath ?? null,
        pdfPath: exportResult.pdfPath ?? null,
        draftDirty: sectionsChangedMidExport ? true : latestDraft.renderState?.draftDirty ?? false,
      },
    };
    const persisted = await disputeLetterStore.saveDraft(nextDraft);
    res.json({
      status: "ok",
      draft: attachArtifactUrls(persisted),
      exportResult,
      warnings: exportWarnings,
    });
    });
  } catch (error) {
    sendError(res, 500, "Failed to export dispute letter artifacts", String(error));
  }
});

app.get("/api/dispute-drafts/:draftId/artifacts/exhibits/:fileName", async (req, res) => {
  const draft = await getDraftOr404(res, req.params.draftId);
  if (!draft) return;

  const fileName = path.basename(req.params.fileName);
  const targetPath = path.join(appConfig.disputeOutputRoot, draft.id, "exhibits", fileName);
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isFile()) {
      throw new Error("not a file");
    }
    res.setHeader("Cache-Control", "private, max-age=60");
    res.sendFile(targetPath);
  } catch {
    sendError(res, 404, `Exhibit '${fileName}' not found for draft '${draft.id}'.`);
  }
});

app.get("/api/dispute-drafts/:draftId/artifacts/:fileName", async (req, res) => {
  const draft = await getDraftOr404(res, req.params.draftId);
  if (!draft) return;

  const fileName = path.basename(req.params.fileName);
  const targetPath = path.join(appConfig.disputeOutputRoot, draft.id, fileName);
  try {
    await fs.access(targetPath);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.sendFile(targetPath);
  } catch {
    sendError(res, 404, `Artifact '${fileName}' not found for draft '${draft.id}'.`);
  }
});

app.delete("/api/sessions/:sessionId", async (req, res) => {
  await sessionStore.deleteSession(req.params.sessionId);
  res.status(204).send();
});

app.get("/api/sessions", (_req, res) => {
  const sessions = sessionStore.listSessions().map((session) => ({
    id: session.id,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    uploadedFileName: session.uploadedFileName,
    hasResult: Boolean(session.result),
  }));

  res.json({ status: "ok", sessions });
});

app.use(express.static(distDir));

app.get(/^(?!\/api).*/, async (_req, res) => {
  try {
    await fs.access(distIndexPath);
    res.sendFile(distIndexPath);
  } catch {
    res.status(503).send("Frontend build not found. Run npm run build.");
  }
});

const startSweeper = () => {
  if (appConfig.retentionSeconds <= 0) return;

  const intervalMs = 30_000;
  setInterval(async () => {
    const sessions = sessionStore.listSessions();
    const expired = sessions.filter((session) => shouldExpireSession(session, appConfig.retentionSeconds));
    for (const session of expired) {
      await sessionStore.deleteSession(session.id);
    }
  }, intervalMs).unref();
};

const bootstrap = async () => {
  await sessionStore.init();
  await acquisitionStore.init();
  await disputeLetterStore.init();
  await writeHealthReadme();
  startSweeper();

  app.listen(appConfig.apiPort, appConfig.apiHost, () => {
    console.log(`[equifax-api] listening on http://${appConfig.apiHost}:${appConfig.apiPort}`);
  });
};

bootstrap().catch(() => {
  console.error("Failed to start Equifax API server");
  process.exitCode = 1;
});
