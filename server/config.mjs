import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolvePythonExecutable = () => {
  if (process.env.PYTHON_EXECUTABLE) {
    return process.env.PYTHON_EXECUTABLE;
  }

  const condaPrefix = process.env.CONDA_PREFIX;
  if (condaPrefix) {
    const condaPython = path.join(condaPrefix, "bin", "python");
    if (fs.existsSync(condaPython)) {
      return condaPython;
    }
  }

  return "python3";
};

export const appConfig = {
  repoRoot,
  apiPort: toNumber(process.env.API_PORT, 8787),
  apiHost: process.env.API_HOST ?? "127.0.0.1",
  maxUploadBytes: toNumber(process.env.MAX_UPLOAD_BYTES, 40 * 1024 * 1024),
  maxPdfPages: toNumber(process.env.MAX_PDF_PAGES, 240),
  sessionRoot: process.env.SESSION_ROOT ?? path.join(repoRoot, "tmp", "backend-sessions"),
  acquisitionRoot: process.env.ACQUISITION_ROOT ?? path.join(repoRoot, "tmp", "acquisition-sessions"),
  retentionSeconds: toNumber(process.env.REPORT_RETENTION_SECONDS, 0),
  profileDefault: process.env.REPORT_PROFILE_DEFAULT ?? "equifax_old_v1",
  workerScript: process.env.WORKER_SCRIPT ?? path.join(repoRoot, "python_worker", "main.py"),
  disputeGeneratorScript:
    process.env.DISPUTE_GENERATOR_SCRIPT ?? path.join(repoRoot, "server", "dispute_letter_generator.py"),
  disputeEvidenceScript:
    process.env.DISPUTE_EVIDENCE_SCRIPT ?? path.join(repoRoot, "server", "dispute_evidence_generator.py"),
  disputeHighlightValidatorScript:
    process.env.DISPUTE_HIGHLIGHT_VALIDATOR_SCRIPT ?? path.join(repoRoot, "server", "dispute_highlight_validator.py"),
  disputeEvidenceMaxRetries: toNumber(process.env.DISPUTE_EVIDENCE_MAX_RETRIES, 1),
  pythonExecutable: resolvePythonExecutable(),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "gpt-oss:20b",
  ollamaVisionModel: process.env.OLLAMA_VISION_MODEL ?? "qwen2.5vl:7b",
  agenticExtensionRoot:
    process.env.AGENTIC_EXTENSION_ROOT ?? path.join(process.env.HOME ?? path.resolve(repoRoot, "..", ".."), "Chrome Agentic Agent"),
  agenticExtensionDist:
    process.env.AGENTIC_EXTENSION_DIST ??
    path.join(
      process.env.AGENTIC_EXTENSION_ROOT ?? path.join(process.env.HOME ?? path.resolve(repoRoot, "..", ".."), "Chrome Agentic Agent"),
      ".output",
      "chrome-mv3",
    ),
  pageIndexRoot:
    process.env.PAGEINDEX_ROOT ?? path.resolve(repoRoot, "..", "PageIndex"),
  disputeOutputRoot:
    process.env.DISPUTE_OUTPUT_ROOT ?? path.join(repoRoot, "output", "dispute-letters"),
  supportedProfiles: ["equifax_old_v1", "equifax_new_v1", "experian_acr_v1", "transunion_acr_v1"],
};
