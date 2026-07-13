import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REFERENCE_ROOT = path.resolve(
  PROJECT_ROOT,
  "..",
  "credit report references",
  "more references for Annual Credit reports 2025"
);
const DEFAULT_OUTPUT_DIR = path.resolve(PROJECT_ROOT, "tmp", "reference-audit");

const PDF_EXTENSIONS = new Set([".pdf"]);

const SECTION_DEFINITIONS = [
  { key: "accounts", patterns: [/\bcredit accounts\b/i, /\baccounts with adverse information\b/i, /\bsatisfactory accounts\b/i, /\baccounts\b/i] },
  { key: "otherAccounts", patterns: [/\bother accounts\b/i] },
  { key: "collections", patterns: [/\bcollections\b/i, /\bcollection accounts?\b/i, /\bcollection agency\b/i, /\boriginal creditor\b/i] },
  { key: "publicRecords", patterns: [/\bpublic records\b/i, /\bno public records reported\b/i] },
  { key: "consumerInformationIndicators", patterns: [/\bconsumer information indicator\b/i, /\bconsumer information indicators\b/i] },
  { key: "hardInquiries", patterns: [/\bhard inquiries\b/i, /\binquiry type\b/i] },
  { key: "softInquiries", patterns: [/\bsoft inquiries\b/i] },
  { key: "accountReviewInquiries", patterns: [/\baccount review inquiries\b/i] },
  { key: "creditReportMessages", patterns: [/\bcredit report messages\b/i] },
  { key: "additionalInformation", patterns: [/^\s*(?:\d+\.\s*)?additional information\b\s*$/i] },
  { key: "personalInformation", patterns: [/\bpersonal information\b/i, /\bnames\b/i, /\baddresses\b/i] },
  { key: "summary", patterns: [/\bsummary\b/i, /\bat a glance\b/i, /\bcredit file status\b/i] },
  { key: "bankruptcySignals", patterns: [/\bbankruptcy\b/i, /\bincluded in bankruptcy\b/i] },
  { key: "supportObligationSignals", patterns: [/\bchild support\b/i, /\bfamily support\b/i, /\balimony\b/i] },
  { key: "rentalSignals", patterns: [/\brental\b/i, /\bapartment\b/i, /\blease\b/i] },
  { key: "medicalSignals", patterns: [/\bmedical\b/i] },
];

const CURRENT_PROFILE_COVERAGE = {
  equifax_old_v1: new Set([
    "summary",
    "personalInformation",
    "accounts",
    "otherAccounts",
    "collections",
    "publicRecords",
    "bankruptcySignals",
    "medicalSignals",
    "hardInquiries",
    "softInquiries",
  ]),
  equifax_new_v1: new Set([
    "summary",
    "personalInformation",
    "accounts",
    "collections",
    "publicRecords",
    "supportObligationSignals",
    "rentalSignals",
    "medicalSignals",
    "hardInquiries",
    "softInquiries",
  ]),
  transunion_acr_v1: new Set([
    "summary",
    "personalInformation",
    "publicRecords",
    "accounts",
    "hardInquiries",
    "softInquiries",
    "accountReviewInquiries",
    "creditReportMessages",
    "additionalInformation",
    "collections",
    "consumerInformationIndicators",
    "bankruptcySignals",
    "supportObligationSignals",
    "rentalSignals",
    "medicalSignals",
  ]),
  experian_acr_v1: new Set([
    "summary",
    "personalInformation",
    "accounts",
    "publicRecords",
    "collections",
    "consumerInformationIndicators",
    "hardInquiries",
    "softInquiries",
    "bankruptcySignals",
    "supportObligationSignals",
    "rentalSignals",
    "medicalSignals",
  ]),
};

function walkFiles(rootDir) {
  const results = [];
  const queue = [rootDir];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (PDF_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

function extractPdfText(pdfPath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "reference-audit-"));
  const outputBase = path.join(tempDir, "pages");
  const result = spawnSync(
    "pdftotext",
    ["-layout", "-f", "1", "-l", "8", pdfPath, outputBase],
    { encoding: "utf8" }
  );
  const outputPath = `${outputBase}.txt`;
  let text = "";
  if (result.status === 0 && fs.existsSync(outputPath)) {
    text = fs.readFileSync(outputPath, "utf8");
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (text.trim()) {
    return text;
  }
  const fallback = spawnSync(
    "python3",
    [
      "-c",
      `
import fitz, sys
doc = fitz.open(sys.argv[1])
chunks = []
for page in doc[:8]:
    chunks.append(page.get_text("text"))
print("\\n".join(chunks))
      `.trim(),
      pdfPath,
    ],
    { encoding: "utf8" }
  );
  if (fallback.status === 0 && fallback.stdout.trim()) {
    return fallback.stdout;
  }
  return text;
}

function detectBureau(filePath, text) {
  const source = `${filePath}\n${text}`.toLowerCase();
  if (/\btransunion\b|\btrans union\b|\baccounts with adverse information\b/.test(source)) {
    return "TransUnion";
  }
  if (/\bexperian\b|\bprepared for\b|\bat a glance\b/.test(source)) {
    return "Experian";
  }
  if (/\bequifax\b|\bconsumer file notices\b|\bconfirmation #\b/.test(source)) {
    return "Equifax";
  }
  return "Unknown";
}

function detectProfile(bureau, text) {
  const lowered = text.toLowerCase();
  if (bureau === "Equifax") {
    if (lowered.includes("consumer file notices") || lowered.includes("company information")) {
      return "equifax_new_v1";
    }
    return "equifax_old_v1";
  }
  if (bureau === "Experian") {
    return "experian_acr_v1";
  }
  if (bureau === "TransUnion") {
    return "transunion_acr_v1";
  }
  return "unknown";
}

function detectSections(text) {
  const found = {};
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const definition of SECTION_DEFINITIONS) {
    if (definition.key === "additionalInformation") {
      found[definition.key] = definition.patterns.some((pattern) => lines.some((line) => pattern.test(line)));
      continue;
    }
    found[definition.key] = definition.patterns.some((pattern) => pattern.test(text));
  }
  return found;
}

function determinePriority(sectionKey) {
  if (["otherAccounts", "collections", "publicRecords", "consumerInformationIndicators"].includes(sectionKey)) {
    return "critical";
  }
  if (["supportObligationSignals", "rentalSignals", "medicalSignals", "bankruptcySignals"].includes(sectionKey)) {
    return "high";
  }
  return "medium";
}

function buildAuditRows(pdfPath, bureau, profileId, sections) {
  const currentCoverage = CURRENT_PROFILE_COVERAGE[profileId] ?? new Set();
  return Object.entries(sections)
    .filter(([, present]) => present)
    .map(([sectionKey]) => ({
      file: path.relative(PROJECT_ROOT, pdfPath),
      bureau,
      profileId,
      section: sectionKey,
      currentlyExtracted: currentCoverage.has(sectionKey),
      currentlyNormalized: currentCoverage.has(sectionKey),
      currentlyVisible: currentCoverage.has(sectionKey),
      currentlyUsableByDisputes: currentCoverage.has(sectionKey),
      priority: determinePriority(sectionKey),
    }));
}

function summarizeByProfile(rows) {
  const summary = {};
  for (const row of rows) {
    const bucket = (summary[row.profileId] ??= {
      files: 0,
      sectionsDetected: {},
      missingSections: {},
    });
    bucket.sectionsDetected[row.section] = (bucket.sectionsDetected[row.section] ?? 0) + 1;
    if (!row.currentlyExtracted) {
      bucket.missingSections[row.section] = (bucket.missingSections[row.section] ?? 0) + 1;
    }
  }
  return summary;
}

function renderMarkdown(rows, summary, scannedFileCount) {
  const lines = [];
  lines.push("# Cross-Bureau Reference Gap Audit");
  lines.push("");
  lines.push(`- Scanned PDF reports: ${scannedFileCount}`);
  lines.push(`- Missing section rows: ${rows.filter((row) => !row.currentlyExtracted).length}`);
  lines.push("");
  lines.push("## By Profile");
  lines.push("");
  for (const [profileId, bucket] of Object.entries(summary)) {
    lines.push(`### ${profileId}`);
    lines.push("");
    const missingSections = Object.entries(bucket.missingSections).sort((a, b) => b[1] - a[1]);
    if (missingSections.length === 0) {
      lines.push("- No missing sections detected from the scanned references.");
      lines.push("");
      continue;
    }
    for (const [section, count] of missingSections) {
      lines.push(`- ${section}: ${count} reference hits not covered by the current extractor`);
    }
    lines.push("");
  }
  lines.push("## Missing Section Rows");
  lines.push("");
  lines.push("| Bureau | Profile | Section | Priority | File |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const row of rows.filter((entry) => !entry.currentlyExtracted)) {
    lines.push(`| ${row.bureau} | ${row.profileId} | ${row.section} | ${row.priority} | ${row.file} |`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const referenceRoot = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_REFERENCE_ROOT;
  const outputDir = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUTPUT_DIR;
  fs.mkdirSync(outputDir, { recursive: true });

  const pdfFiles = walkFiles(referenceRoot);
  const auditRows = [];
  const fileSummaries = [];

  for (const pdfPath of pdfFiles) {
    const text = extractPdfText(pdfPath);
    const bureau = detectBureau(pdfPath, text);
    const profileId = detectProfile(bureau, text);
    const sections = detectSections(text);
    fileSummaries.push({
      file: path.relative(PROJECT_ROOT, pdfPath),
      bureau,
      profileId,
      sections,
    });
    auditRows.push(...buildAuditRows(pdfPath, bureau, profileId, sections));
  }

  const summary = summarizeByProfile(auditRows);
  const jsonPayload = {
    generatedAt: new Date().toISOString(),
    scannedFileCount: pdfFiles.length,
    referenceRoot,
    fileSummaries,
    rows: auditRows,
    summary,
  };

  fs.writeFileSync(
    path.join(outputDir, "reference-gap-audit.json"),
    JSON.stringify(jsonPayload, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(outputDir, "reference-gap-audit.md"),
    renderMarkdown(auditRows, summary, pdfFiles.length),
    "utf8"
  );

  console.log(`Wrote audit for ${pdfFiles.length} PDF reports to ${outputDir}`);
}

main();
