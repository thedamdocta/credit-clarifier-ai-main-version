import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mapWorkerResultToCreditReport } from "../server/resultMapper.mjs";

const ROOT = process.cwd();
const WORKER_PATH = path.resolve(ROOT, "python_worker", "main.py");
const PYTHON = process.env.PYTHON_EXECUTABLE || "python3";

const normalizeMatchText = (value) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const normalizeMaskedAccountNumber = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
const accountKey = (value) =>
  `${normalizeMatchText(value?.accountName ?? value?.header?.accountName)}::${normalizeMaskedAccountNumber(value?.accountNumber ?? value?.header?.accountNumber)}`;
const historyEvidenceHasValues = (rows) =>
  (Array.isArray(rows) ? rows : []).some((row) =>
    Object.values(row?.months ?? {}).some((cell) => {
      const normalized = String(cell?.value ?? "").replace(/\s+/g, " ").trim();
      return normalized.length > 0 && normalized !== "-";
    }),
  );
const hasTrailingCourtIdentifierWithoutReference = (record) =>
  String(record?.referenceNumber ?? "").trim().length === 0 &&
  /\bcourt\b/i.test(String(record?.court ?? "")) &&
  /\s[A-Z0-9-]*\d[A-Z0-9-]{3,}\s*$/i.test(String(record?.court ?? ""));

const FIXTURES = [
  {
    id: "equifax-old-public-records-and-other-accounts",
    profile: "equifax_old_v1",
    maxPages: 66,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "REF-I",
      "Equifax Report 2025.pdf",
    ),
    assertReport(report) {
    assert.equal(report.bureau, "Equifax");
      assert.ok(report.publicRecords.length > 0, "expected old Equifax public records to be extracted");
      assert.ok(
        report.publicRecords.some((record) => /bankrupt|judgment|lien/i.test(`${record.recordType ?? ""} ${record.summary ?? ""}`)),
        "expected old Equifax public-record records to carry a real record type or summary",
      );
      assert.ok(
        report.publicRecords.every((record) => (record.sourcePages?.length ?? 0) > 0),
        "expected old Equifax public records to preserve source pages",
      );
      assert.ok(
        !report.publicRecords.some(hasTrailingCourtIdentifierWithoutReference),
        "expected old Equifax public-record court identifiers to be split out of the court field when they look like reference numbers",
      );
      const otherAccounts = report.accounts.filter((account) =>
        /midland credit management|spring oaks capital|portfolio recovery assoc/i.test(
          `${account.accountName ?? ""} ${account.accountNumber ?? ""}`,
        ),
      );
      assert.ok(otherAccounts.length >= 3, "expected old Equifax Other Accounts tradelines to survive normalization");
      assert.ok(
        otherAccounts.every((account) => /other/i.test(account.accountType ?? "")),
        "expected old Equifax Other Accounts tradelines to keep their OTHER account type",
      );
      assert.ok(
        (report.consumerInformationIndicators?.some((indicator) =>
          /bankrupt/i.test(`${indicator.category ?? ""} ${indicator.description ?? ""}`),
        )) ?? false,
        "expected old Equifax bankruptcy-linked consumer information indicators to be preserved",
      );
    },
  },
  {
    id: "equifax-old-account-additional-information",
    profile: "equifax_old_v1",
    maxPages: 40,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "Charmetres Tillman",
      "EQ report.pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "Equifax");
      assert.ok(
        report.accounts.some((account) => (account.additionalInformation?.length ?? 0) > 0),
        "expected old Equifax account-level additional information to be preserved",
      );
    },
  },
  {
    id: "equifax-new-collections",
    profile: "equifax_new_v1",
    maxPages: 60,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "Jalen Randolph",
      "Equifax .pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "Equifax");
      assert.ok((report.collections?.length ?? 0) > 0, "expected Equifax new collections to be extracted");
      assert.ok(
        report.collections.some(
          (collection) => collection.collectionAgency || collection.originalCreditorName || collection.amount,
        ),
        "expected Equifax new collections to preserve collection fields",
      );
      assert.ok(
        report.collections.every((collection) => (collection.sourcePages?.length ?? 0) > 0),
        "expected Equifax new collections to preserve source pages",
      );
    },
  },
  {
    id: "transunion-public-records",
    profile: "transunion_acr_v1",
    maxPages: 12,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "REF-I",
      "2025  TransUnion Credit Report.pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "TransUnion");
      assert.ok(report.publicRecords.length > 0, "expected TransUnion public records to be extracted");
      assert.ok(
        report.publicRecords.some(
          (record) => record.recordType || record.court || record.referenceNumber || record.status,
        ),
        "expected TransUnion public-record fields to be structured",
      );
      assert.ok(
        report.publicRecords.some(
          (record) =>
            String(record.referenceNumber ?? "").trim().length > 0 &&
            !/\s\d{4,}[A-Z0-9\-]*$/i.test(String(record.court ?? "").trim()),
        ),
        "expected TransUnion public records to split trailing court identifiers into the reference number field",
      );
    },
  },
  {
    id: "transunion-supplemental-public-records-not-legal-public-record",
    profile: "transunion_acr_v1",
    maxPages: 89,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "Feemun Dogar",
      "_ TransUnion Credit Report.pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "TransUnion");
      assert.equal(
        report.publicRecords.length,
        0,
        "expected TransUnion supplemental residential-information disclosure not to be classified as a legal public record",
      );
    },
  },
  {
    id: "experian-public-records",
    profile: "experian_acr_v1",
    maxPages: 40,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "REF-EQOLD-A",
      " Experian.pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "Experian");
      assert.ok(report.publicRecords.length > 0, "expected Experian public records to be extracted");
      assert.ok(
        report.publicRecords.some((record) => /bankrupt/i.test(`${record.recordType ?? ""} ${record.summary ?? ""}`)),
        "expected Experian public-record extraction to preserve bankruptcy context",
      );
      assert.ok(
        !report.publicRecords.some(hasTrailingCourtIdentifierWithoutReference),
        "expected Experian public-record court identifiers to be split out of the court field when they look like reference numbers",
      );
    },
  },
  {
    id: "experian-collections",
    profile: "experian_acr_v1",
    maxPages: 40,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "REF-EX-J",
      " Experian.pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "Experian");
      assert.equal(report.collections?.length ?? 0, 0, "expected Experian collection entries to stay in Accounts instead of a separate Collections section");
      assert.ok(
        report.accounts.some((account) =>
          /collection/i.test(
            `${account.accountType ?? ""} ${account.reportingCategory ?? ""} ${account.accountName ?? ""} ${account.status ?? ""}`,
          ),
        ),
        "expected Experian collection entries to preserve collection context inside Accounts",
      );
      assert.ok(
        report.accounts.some(
          (account) =>
            /collection/i.test(
              `${account.accountType ?? ""} ${account.reportingCategory ?? ""} ${account.accountName ?? ""} ${account.status ?? ""}`,
            ) && (account.sourcePages?.length ?? 0) > 0,
        ),
        "expected Experian collection-style accounts to preserve source pages",
      );
    },
  },
  {
    id: "experian-account-history-normalization",
    profile: "experian_acr_v1",
    maxPages: 40,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "REF-EX-J",
      " Experian.pdf",
    ),
    assertReport(report, workerResult) {
      assert.equal(report.bureau, "Experian");
      const rawAccounts = Array.isArray(workerResult?.components?.accounts?.accounts)
        ? workerResult.components.accounts.accounts
        : [];
      const mappedAccounts = new Map(report.accounts.map((account) => [accountKey(account), account]));

      for (const rawAccount of rawAccounts) {
        const mappedAccount = mappedAccounts.get(accountKey(rawAccount));
        assert.ok(mappedAccount, `expected mapped Experian account for ${rawAccount?.header?.accountName ?? "unknown account"}`);

        const rawPaymentRows = Array.isArray(rawAccount?.paymentHistory?.rows) ? rawAccount.paymentHistory.rows : [];
        if (rawPaymentRows.length > 0) {
          assert.ok(
            (mappedAccount.paymentHistory?.length ?? 0) >= rawPaymentRows.length * 12,
            `expected ${rawAccount?.header?.accountName ?? "account"} to preserve payment-history rows`,
          );
        }

        if (historyEvidenceHasValues(rawAccount?._historyEvidence?.scheduledPaymentHistory)) {
          assert.ok(
            (mappedAccount.scheduledPaymentHistory?.length ?? 0) > 0,
            `expected ${rawAccount?.header?.accountName ?? "account"} to preserve scheduled payment history`,
          );
        }

        if (historyEvidenceHasValues(rawAccount?._historyEvidence?.actualPaymentHistory)) {
          assert.ok(
            (mappedAccount.actualPaymentHistory?.length ?? 0) > 0,
            `expected ${rawAccount?.header?.accountName ?? "account"} to preserve actual payment history`,
          );
        }
      }
    },
  },
  {
    id: "experian-account-additional-information",
    profile: "experian_acr_v1",
    maxPages: 40,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "REF-EX-J",
      " Experian.pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "Experian");
      assert.ok(
        report.accounts.some((account) => (account.additionalInformation?.length ?? 0) > 0),
        "expected Experian account-level additional information to be preserved",
      );
    },
  },
  {
    id: "experian-auto-lease-subtype",
    profile: "experian_acr_v1",
    maxPages: 24,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "Feemun Dogar",
      " Experian.pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "Experian");
      assert.ok(
        report.accounts.some((account) => account.accountSubtype === "Auto Lease"),
        "expected Experian auto lease tradelines to be classified as Auto Lease",
      );
    },
  },
  {
    id: "experian-rental-subtype",
    profile: "experian_acr_v1",
    maxPages: 32,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "Tammy Lawson",
      "Experian (1).pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "Experian");
      assert.ok(
        report.accounts.some((account) => account.accountSubtype === "Rental Agreement"),
        "expected Experian rental tradelines to be classified as Rental Agreement",
      );
    },
  },
  {
    id: "equifax-medical-debt-collections",
    profile: "equifax_old_v1",
    maxPages: 56,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "Marcus Harlan",
      "Equifax.pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "Equifax");
      assert.ok(
        (report.collections?.some((collection) => collection.accountSubtype === "Medical Debt")) ?? false,
        "expected Equifax medical collections to be classified as Medical Debt",
      );
    },
  },
  {
    id: "transunion-child-support-subtype",
    profile: "transunion_acr_v1",
    maxPages: 32,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "Matthew Booker",
      " TransUnion Credit Report.pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "TransUnion");
      assert.ok(
        report.accounts.some((account) => account.accountSubtype === "Child Support"),
        "expected TransUnion support tradelines to be classified as Child Support",
      );
    },
  },
  {
    id: "experian-family-support-subtype",
    profile: "experian_acr_v1",
    maxPages: 35,
    pdfPath: path.resolve(
      ROOT,
      "..",
      "credit report references",
      "more references for Annual Credit reports 2025",
      "Khatib Borders",
      "- Experian.pdf",
    ),
    assertReport(report) {
      assert.equal(report.bureau, "Experian");
      assert.ok(
        report.accounts.some((account) => account.accountSubtype === "Family Support"),
        "expected Experian support tradelines to be classified as Family Support",
      );
    },
  },
];

const runWorker = async ({ id, profile, pdfPath, maxPages = 300 }) => {
  await fs.access(pdfPath);

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `reference-extraction-${id}-`));
  const sessionId = randomUUID();
  const sessionDir = path.join(tempRoot, "session");
  const outputJson = path.join(tempRoot, "result.json");

  try {
    execFileSync(
      PYTHON,
      [
        WORKER_PATH,
        "--session-id",
        sessionId,
        "--session-dir",
        sessionDir,
        "--input-pdf",
        pdfPath,
        "--output-json",
        outputJson,
        "--profile",
        profile,
        "--ollama-base-url",
        "http://127.0.0.1:11434",
        "--model",
        "unused-layout-profile",
        "--max-pages",
        String(maxPages),
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const payload = JSON.parse(await fs.readFile(outputJson, "utf8"));
    assert.equal(payload.status, "ok", `${id}: worker returned non-ok status`);
    const workerResult = payload.result;

    const report = mapWorkerResultToCreditReport({
      session: {
        id: sessionId,
        uploadedFileName: path.basename(pdfPath),
      },
      workerResult,
    });

    return { workerResult, report, outputJson };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

const main = async () => {
  const summaries = [];

  for (const fixture of FIXTURES) {
    console.error(`checking ${fixture.id}...`);
    const { workerResult, report } = await runWorker(fixture);
    fixture.assertReport(report, workerResult);
    console.error(`checked ${fixture.id}`);

    summaries.push({
      id: fixture.id,
      profile: fixture.profile,
      bureau: report.bureau,
      accountCount: report.accounts.length,
      collectionCount: report.collections?.length ?? 0,
      publicRecordCount: report.publicRecords.length,
      consumerInformationIndicatorCount: report.consumerInformationIndicators?.length ?? 0,
      componentStatus: workerResult.componentStatus,
    });
  }

  console.log(JSON.stringify({ fixtureCount: FIXTURES.length, summaries }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
