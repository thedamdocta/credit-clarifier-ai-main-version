import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildDefaultIntake } from "../src/features/dispute-letters/defaults.ts";
import {
  generateAccountRuleCatalog,
  generateDisputeReasons,
  generateNonAccountReasons,
} from "../src/features/dispute-letters/reasonEngine.ts";
import { buildDisputeLetterDraft } from "../server/disputeLetterBuilder.mjs";

const FIXTURE_IDS = ["equifax-old", "equifax-new", "experian", "transunion"];
const FIXTURE_ROOT = path.resolve(process.cwd(), "output", "dispute-letters", "fixtures");
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE ?? "python3";
const GENERATOR_PATH = path.resolve(process.cwd(), "server", "dispute_letter_generator.py");

const refreshFixture = async (fixtureId) => {
  const fixtureDir = path.join(FIXTURE_ROOT, fixtureId);
  const report = JSON.parse(await fs.readFile(path.join(fixtureDir, "report.json"), "utf8"));
  const intake = buildDefaultIntake(report);
  const accountRuleCatalog = generateAccountRuleCatalog(report);
  const nonAccountReasons = generateNonAccountReasons(report, intake);
  const reasons = generateDisputeReasons(report, intake, accountRuleCatalog, nonAccountReasons);
  const draft = buildDisputeLetterDraft({
    sessionId: report.sourceSessionId ?? report.reportId ?? fixtureId,
    report,
    intake,
    reasons,
  });

  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), `refresh-dispute-${fixtureId}-`));
  try {
    const draftPath = path.join(outputDir, "draft.json");
    await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
    const exportResult = JSON.parse(
      execFileSync(PYTHON_EXECUTABLE, [GENERATOR_PATH, draftPath, "--output-dir", outputDir], {
        cwd: process.cwd(),
        encoding: "utf8",
      }),
    );

    const docxPath = path.join(fixtureDir, `${fixtureId}.docx`);
    const pdfPath = path.join(fixtureDir, `${fixtureId}.pdf`);
    await fs.copyFile(exportResult.docxPath, docxPath);
    await fs.copyFile(exportResult.pdfPath, pdfPath);

    draft.renderState.docxPath = docxPath;
    draft.renderState.pdfPath = pdfPath;
    draft.renderState.docxUrl = null;
    draft.renderState.pdfUrl = null;

    await fs.writeFile(path.join(fixtureDir, "intake.json"), JSON.stringify(intake, null, 2), "utf8");
    await fs.writeFile(path.join(fixtureDir, "accountRuleCatalog.json"), JSON.stringify(accountRuleCatalog, null, 2), "utf8");
    await fs.writeFile(path.join(fixtureDir, "nonAccountReasons.json"), JSON.stringify(nonAccountReasons, null, 2), "utf8");
    await fs.writeFile(path.join(fixtureDir, "reasons.json"), JSON.stringify(reasons, null, 2), "utf8");
    await fs.writeFile(path.join(fixtureDir, "draft.json"), JSON.stringify(draft, null, 2), "utf8");
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true });
  }
};

for (const fixtureId of FIXTURE_IDS) {
  await refreshFixture(fixtureId);
  console.log(`Refreshed dispute fixture outputs for ${fixtureId}`);
}
