import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildDefaultIntake } from "../src/features/dispute-letters/defaults.ts";
import {
  ACCOUNT_RULE_DEFINITION_COUNT,
  generateAccountRuleCatalog,
  generateDisputeReasons,
  generateNonAccountReasons,
} from "../src/features/dispute-letters/reasonEngine.ts";
import { getStrategyDemotion } from "../src/features/dispute-letters/strategyProfile.ts";
import { buildDisputeLetterDraft } from "../server/disputeLetterBuilder.mjs";
import { mapWorkerResultToCreditReport } from "../server/resultMapper.mjs";

const FIXTURE_IDS = ["equifax-old", "equifax-new", "experian", "transunion"];
const FIXTURE_ROOT = path.resolve(process.cwd(), "output", "dispute-letters", "fixtures");
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE ?? "python3";
const GENERATOR_PATH = path.resolve(process.cwd(), "server", "dispute_letter_generator.py");

let sawClear = false;
let sawNotAvailable = false;

const findRuleEntry = (group, ruleId) => group.categories.flatMap((category) => category.entries).find((entry) => entry.ruleId === ruleId);

for (const fixtureId of FIXTURE_IDS) {
  const fixtureDir = path.join(FIXTURE_ROOT, fixtureId);
  const report = JSON.parse(await fs.readFile(path.join(fixtureDir, "report.json"), "utf8"));
  const intake = buildDefaultIntake(report);
  const accountRuleCatalog = generateAccountRuleCatalog(report);
  const nonAccountReasons = generateNonAccountReasons(report, intake);
  const reasons = generateDisputeReasons(report, intake, accountRuleCatalog, nonAccountReasons);

  assert.ok(accountRuleCatalog.length > 0, `${fixtureId}: expected at least one account group`);

  for (const group of accountRuleCatalog) {
    const entryCount = group.categories.reduce((sum, category) => sum + category.entries.length, 0);
    assert.equal(entryCount, ACCOUNT_RULE_DEFINITION_COUNT, `${fixtureId}:${group.entityKey} should expose the full rule catalog`);

    const triggeredEntries = group.categories.flatMap((category) => category.entries).filter((entry) => entry.status === "triggered");
    // Strategy-demoted classes stay detected but arrive default-unchecked
    // (still selectable) regardless of account posture.
    const demotedEntries = triggeredEntries.filter((entry) => getStrategyDemotion(entry.issueType));
    for (const entry of demotedEntries) {
      assert.ok(
        !entry.selected && entry.defaultSelected === false && entry.selectable && entry.selectionBasis === "strategy_demoted",
        `${fixtureId}:${group.entityKey}:${entry.ruleId} demoted rule should be detected, unselected, selectable, and strategy_demoted`,
      );
    }
    const promotableEntries = triggeredEntries.filter((entry) => !getStrategyDemotion(entry.issueType));
    if (group.accountPosture === "negative") {
      assert.ok(promotableEntries.every((entry) => entry.selected), `${fixtureId}:${group.entityKey} negative account should default-select available rules`);
    } else {
      assert.ok(promotableEntries.every((entry) => !entry.selected), `${fixtureId}:${group.entityKey} positive account should default-unselect available rules`);
    }

    for (const entry of triggeredEntries) {
      assert.ok(entry.sourcePages.length > 0, `${fixtureId}:${group.entityKey}:${entry.ruleId} should expose source pages`);
      assert.ok(
        entry.supportingFacts.length > 0 || entry.supportingFields.length > 0 || Boolean(entry.evidence),
        `${fixtureId}:${group.entityKey}:${entry.ruleId} should expose evidence`,
      );
    }

    sawClear ||= group.categories.some((category) => category.entries.some((entry) => entry.status === "not_triggered"));
    sawNotAvailable ||= group.categories.some((category) => category.entries.some((entry) => entry.status === "insufficient_evidence"));
  }

  if (fixtureId === "experian") {
    const autoGroups = accountRuleCatalog.filter((group) =>
      /auto/i.test(`${group.accountHeading ?? ""} ${group.entityKey ?? ""}`),
    );
    assert.ok(autoGroups.length > 0, "experian: expected at least one auto tradeline group");
    assert.ok(
      autoGroups.every((group) => findRuleEntry(group, "student_loan_lender_identity_mismatch")?.status === "not_applicable"),
      "experian: auto tradelines must not be evaluated as student-loan accounts",
    );

    assert.ok(
      accountRuleCatalog.some(
        (group) => findRuleEntry(group, "student_loan_lender_identity_mismatch")?.status !== "not_applicable",
      ),
      "experian: expected at least one student-loan tradeline to remain eligible for student-loan lender review",
    );

    assert.ok(
      accountRuleCatalog.some((group) =>
        [
          "payment_history_balance_history_conflict",
          "balance_history_monthly_gap_conflict",
          "insufficient_balance_history",
          "balance_updated_timeline_conflict",
        ].some((ruleId) => findRuleEntry(group, ruleId)?.status === "triggered"),
      ),
      "experian: expected at least one tradeline to trigger a balance-history dispute",
    );
  }

  if (fixtureId === "equifax-new") {
    assert.ok(
      accountRuleCatalog.some(
        (group) => findRuleEntry(group, "incomplete_original_creditor_identity")?.status === "triggered",
      ),
      "equifax-new: expected at least one collection-style tradeline to trigger missing original-creditor identity review",
    );
  }

  const draft = buildDisputeLetterDraft({
    sessionId: report.sourceSessionId ?? report.reportId ?? fixtureId,
    report,
    intake,
    reasons,
  });

  assert.ok(draft.sections.senderBlock?.html, `${fixtureId}: sender block should be present`);
  assert.ok(draft.sections.dateBlock?.html, `${fixtureId}: date block should be present`);
  assert.ok(draft.sections.recipientBlock?.html, `${fixtureId}: recipient block should be present`);
  assert.ok(draft.sections.reportMetadataBlock?.html, `${fixtureId}: report metadata block should be present`);
  assert.ok(!draft.sections.senderBlock.html.includes("Generated on"), `${fixtureId}: sender block should not include report metadata`);
  assert.ok(!draft.sections.recipientBlock.html.includes("Generated on"), `${fixtureId}: recipient block should not include report metadata`);
  assert.ok(!draft.fullDocumentHtml.includes("<h2"), `${fixtureId}: full document should not contain headings`);
  assert.ok(!draft.fullDocumentHtml.includes("<ul"), `${fixtureId}: full document should not contain unordered lists`);
  assert.ok(!draft.fullDocumentHtml.includes("<ol"), `${fixtureId}: full document should not contain ordered lists`);

  if (draft.sections.accountDisputes.length > 0) {
    const firstAccountSection = draft.sections.accountDisputes[0];
    assert.ok(firstAccountSection.html.includes("<strong>"), `${fixtureId}: first account section should contain a bold heading`);
    assert.ok(firstAccountSection.html.includes("<br/><br/>"), `${fixtureId}: first account section should leave a line break gap before the dispute body`);
  }

  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), `dispute-${fixtureId}-`));
  try {
    const draftPath = path.join(outputDir, "draft.json");
    await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
    const exportResult = JSON.parse(
      execFileSync(PYTHON_EXECUTABLE, [GENERATOR_PATH, draftPath, "--output-dir", outputDir], {
        cwd: process.cwd(),
        encoding: "utf8",
      }),
    );
    assert.ok(exportResult.docxPath, `${fixtureId}: DOCX path should be returned`);
    assert.ok(exportResult.pdfPath, `${fixtureId}: PDF path should be returned`);
    await fs.access(exportResult.docxPath);
    await fs.access(exportResult.pdfPath);
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true });
  }
}

assert.ok(sawClear, "expected at least one Clear rule outcome across fixtures");
assert.ok(sawNotAvailable, "expected at least one Not available rule outcome across fixtures");

const syntheticEquifaxNewReport = mapWorkerResultToCreditReport({
  session: {
    id: "synthetic-equifax-new-mapper",
    uploadedFileName: "synthetic-equifax-new.pdf",
  },
  workerResult: {
    profile: "equifax_new_v1",
    meta: {
      profileId: "equifax_new_v1",
    },
    components: {
      reportConfirmationDetails: {},
      summary: {},
      personalInformation: {},
      inquiries: { inquiryCount: 0, inquiries: [] },
      accounts: {
        accountCount: 1,
        accounts: [
          {
            accountName: "GENERIC ACCOUNT",
            accountNumber: "*1234",
            loanAccountType: "FHA Real Estate Mortgage",
            dateOpened: "01/01/2020",
            status: "Pays As Agreed",
            balance: "$100,000",
            scheduledPaymentAmount: "$2,000",
            actualPaymentAmount: "$2,125",
            dateOfLastPayment: "01/15/2025",
            dateOfLastActivity: "01/31/2025",
            termDuration: "30 Years",
            termsFrequency: "Monthly",
            monthsReviewed: "24",
            dateOfFirstDelinquency: "",
            month24History: { sections: [] },
            sourcePages: [1],
          },
        ],
      },
    },
    componentStatus: {},
    validationIssues: [],
    readyForAttorney: false,
  },
});

const mappedSyntheticEquifaxNewAccount = syntheticEquifaxNewReport.accounts[0];
assert.equal(
  mappedSyntheticEquifaxNewAccount.monthlyPayment,
  "$2,000",
  "equifax-new mapper should preserve scheduledPaymentAmount as monthlyPayment",
);
assert.equal(
  mappedSyntheticEquifaxNewAccount.paymentAmount,
  "$2,000",
  "equifax-new mapper should preserve scheduledPaymentAmount as paymentAmount",
);
assert.equal(
  mappedSyntheticEquifaxNewAccount.recentPayment,
  "$2,125",
  "equifax-new mapper should preserve actualPaymentAmount as recentPayment",
);
assert.equal(
  mappedSyntheticEquifaxNewAccount.actualPaymentAmount,
  "$2,125",
  "equifax-new mapper should preserve actualPaymentAmount",
);
assert.equal(
  mappedSyntheticEquifaxNewAccount.terms,
  "30 Years",
  "equifax-new mapper should preserve termDuration as terms",
);
assert.equal(
  mappedSyntheticEquifaxNewAccount.termFrequency,
  "Monthly",
  "equifax-new mapper should preserve termsFrequency",
);
assert.equal(
  mappedSyntheticEquifaxNewAccount.monthsReviewed,
  "24",
  "equifax-new mapper should preserve monthsReviewed",
);

console.log("Dispute fixture assertions passed.");
