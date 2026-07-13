import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const API_BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:8787";
const OUTPUT_ROOT = path.resolve(process.cwd(), "output", "dispute-letters", "fixtures");

const samples = [
  {
    id: "equifax-old",
    filePath: "~/credit clarify - gain equity/credit report references/REF-EQOLD-D.pdf",
  },
  {
    id: "equifax-new",
    filePath: "~/credit clarify - gain equity/credit report references/TEST-ID-A-EQNEW.pdf",
  },
  {
    id: "experian",
    filePath: "~/credit clarify - gain equity/credit report references/REF-EX-D.pdf",
  },
  {
    id: "transunion",
    filePath: "~/credit clarify - gain equity/credit report references/TEST-ID-A-TU.pdf",
  },
];

const buildDraftInputs = async (report) => {
  const helperPath = path.resolve(process.cwd(), "scripts", "dispute_reason_snapshot.ts");
  const response = spawnSync("npx", ["-y", "tsx", helperPath], {
    cwd: process.cwd(),
    input: JSON.stringify(report),
    encoding: "utf8",
  });

  if (response.status !== 0) {
    throw new Error(response.stderr || response.stdout || "Unable to generate dispute draft inputs.");
  }

  return JSON.parse(response.stdout || "{}");
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    throw new Error(payload.error || payload.details || payload.raw || `${response.status} ${response.statusText}`);
  }
  return payload;
};

const processReport = async (filePath) => {
  const session = await requestJson(`${API_BASE}/api/sessions`, { method: "POST" });
  const sessionId = session.sessionId;
  const fileBuffer = await fs.readFile(filePath);
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer], { type: "application/pdf" }), path.basename(filePath));
  await requestJson(`${API_BASE}/api/sessions/${sessionId}/upload`, { method: "POST", body: formData });
  await requestJson(`${API_BASE}/api/sessions/${sessionId}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  for (;;) {
    const status = await requestJson(`${API_BASE}/api/sessions/${sessionId}/status`);
    if (status.sessionStatus === "processed") break;
    if (status.sessionStatus === "failed") {
      throw new Error(status.lastError || `Processing failed for ${filePath}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const result = await requestJson(`${API_BASE}/api/sessions/${sessionId}/result`);
  return { sessionId, result };
};

const copyArtifactIfPresent = async (sourcePath, destinationPath) => {
  if (!sourcePath) return null;
  await fs.copyFile(sourcePath, destinationPath);
  return destinationPath;
};

const buildFixture = async (sample) => {
  const { sessionId, result } = await processReport(sample.filePath);
  const report = result.report;
  const { intake, accountRuleCatalog, nonAccountReasons, reasons } = await buildDraftInputs(report);
  const draftPayload = await requestJson(`${API_BASE}/api/dispute-drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, report, intake, reasons }),
  });
  const draft = draftPayload.draft;

  const exportPayload = await requestJson(`${API_BASE}/api/dispute-drafts/${draft.id}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const exportedDraft = exportPayload.draft;

  const sampleDir = path.join(OUTPUT_ROOT, sample.id);
  await fs.mkdir(sampleDir, { recursive: true });
  await fs.writeFile(path.join(sampleDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(path.join(sampleDir, "intake.json"), JSON.stringify(intake, null, 2), "utf8");
  await fs.writeFile(path.join(sampleDir, "accountRuleCatalog.json"), JSON.stringify(accountRuleCatalog, null, 2), "utf8");
  await fs.writeFile(path.join(sampleDir, "nonAccountReasons.json"), JSON.stringify(nonAccountReasons, null, 2), "utf8");
  await fs.writeFile(path.join(sampleDir, "reasons.json"), JSON.stringify(reasons, null, 2), "utf8");
  await fs.writeFile(path.join(sampleDir, "draft.json"), JSON.stringify(exportedDraft, null, 2), "utf8");

  const docxCopy = await copyArtifactIfPresent(exportedDraft.renderState?.docxPath, path.join(sampleDir, `${sample.id}.docx`));
  const pdfCopy = await copyArtifactIfPresent(exportedDraft.renderState?.pdfPath, path.join(sampleDir, `${sample.id}.pdf`));

  return {
    id: sample.id,
    filePath: sample.filePath,
    bureau: report.bureau,
    profileId: report.profileId,
    accountCount: Array.isArray(report.accounts) ? report.accounts.length : 0,
    inquiryCount: Array.isArray(report.inquiries) ? report.inquiries.length : 0,
    selectedReasonCount: reasons.filter((reason) => reason.selected).length,
    draftId: draft.id,
    docxPath: docxCopy,
    pdfPath: pdfCopy,
  };
};

const main = async () => {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    apiBase: API_BASE,
    samples: [],
  };

  for (const sample of samples) {
    // eslint-disable-next-line no-console
    console.log(`Generating dispute artifacts for ${sample.id}...`);
    const result = await buildFixture(sample);
    manifest.samples.push(result);
  }

  const manifestPath = path.join(OUTPUT_ROOT, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote manifest to ${manifestPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
