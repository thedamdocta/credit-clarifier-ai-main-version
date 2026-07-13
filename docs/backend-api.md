---
title: Backend API Reference
aliases:
  - backend-api
  - api-reference
  - server-reference
tags:
  - docs
  - backend
  - api
  - express
created: 2026-03-25
description: >
  Complete technical reference for the Express backend API server powering the
  3 Bureau Extractor. Covers every route, the session store lifecycle,
  configuration loading, the Python worker subprocess interface, and the
  result mapper that transforms worker output into the frontend credit-report
  model.
related:
  - "[[extraction-pipeline]]"
  - "[[acquisition-pipeline]]"
  - "[[dispute-generation]]"
---

> **Living doc.** Update this file whenever backend code changes.

---

# Backend API Reference

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Configuration (`server/config.mjs`)](#configuration)
3. [Session Store (`server/sessionStore.mjs`)](#session-store)
4. [Python Worker (`server/pythonWorker.mjs`)](#python-worker)
5. [Result Mapper (`server/resultMapper.mjs`)](#result-mapper)
6. [Express Server (`server/index.mjs`)](#express-server)
   - [Middleware](#middleware)
   - [Extraction Session Routes](#extraction-session-routes)
   - [Acquisition Session Routes](#acquisition-session-routes)
   - [Dispute Draft Routes](#dispute-draft-routes)
   - [Evidence & Export Routes](#evidence--export-routes)
   - [Utility Routes](#utility-routes)
   - [SPA Fallback & Static Files](#spa-fallback--static-files)
7. [Error Envelope](#error-envelope)
8. [Startup & Shutdown](#startup--shutdown)

---

## Architecture Overview

The backend is a single Express process (`server/index.mjs`) that:

- Accepts PDF uploads for credit-report extraction.
- Spawns a Python subprocess to run the extraction pipeline.
- Maps raw Python output to a normalized credit-report model the frontend consumes.
- Manages guided browser-based acquisition sessions (AnnualCreditReport.com).
- Manages dispute-letter drafting, evidence generation, and export.
- Serves the Vite-built SPA from `dist/`.

All state is held **in-memory** via `Map`-backed stores (`SessionStore`, `CreditReportAcquisitionStore`, `DisputeLetterStore`). Workspace directories under `tmp/` provide durable file storage for uploads, outputs, and dispute artifacts.

---

## Configuration

**File:** `server/config.mjs`

Configuration is resolved once at module load via the exported `appConfig` object. Every value is sourced from environment variables with sensible defaults.

### Config Values

| Key | Env Var | Default | Description |
|---|---|---|---|
| `repoRoot` | -- | `path.resolve(__dirname, "..")` | Absolute path to the project root. Computed from the config file's location. |
| `apiPort` | `API_PORT` | `8787` | TCP port the Express server listens on. |
| `apiHost` | `API_HOST` | `127.0.0.1` | Bind address. |
| `maxUploadBytes` | `MAX_UPLOAD_BYTES` | `40 * 1024 * 1024` (40 MB) | Maximum size for a single full-file upload. |
| `maxPdfPages` | `MAX_PDF_PAGES` | `240` | Cap passed to the Python worker's `--max-pages` flag. |
| `sessionRoot` | `SESSION_ROOT` | `<repoRoot>/tmp/backend-sessions` | Root directory for extraction session workspaces. |
| `acquisitionRoot` | `ACQUISITION_ROOT` | `<repoRoot>/tmp/acquisition-sessions` | Root directory for acquisition session workspaces. |
| `retentionSeconds` | `REPORT_RETENTION_SECONDS` | `0` (no automatic expiry) | Seconds after `updatedAt` before a session is eligible for sweeper cleanup. `0` disables sweeping. |
| `profileDefault` | `REPORT_PROFILE_DEFAULT` | `equifax_old_v1` | Fallback extraction profile when auto-detection cannot determine the bureau. |
| `workerScript` | `WORKER_SCRIPT` | `<repoRoot>/python_worker/main.py` | Path to the Python extraction worker entry point. |
| `disputeGeneratorScript` | `DISPUTE_GENERATOR_SCRIPT` | `<repoRoot>/server/dispute_letter_generator.py` | Script that renders dispute letter DOCX/PDF exports. |
| `disputeEvidenceScript` | `DISPUTE_EVIDENCE_SCRIPT` | `<repoRoot>/server/dispute_evidence_generator.py` | Script that generates evidence slide bundles. |
| `disputeHighlightValidatorScript` | `DISPUTE_HIGHLIGHT_VALIDATOR_SCRIPT` | `<repoRoot>/server/dispute_highlight_validator.py` | Script that validates highlight accuracy on evidence slides. |
| `disputeEvidenceMaxRetries` | `DISPUTE_EVIDENCE_MAX_RETRIES` | `1` | Maximum automatic retries for evidence generation (switches to `tight` mode on retry). |
| `pythonExecutable` | `PYTHON_EXECUTABLE` | Auto-resolved (see below) | Path to the Python interpreter. |
| `ollamaBaseUrl` | `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama inference server URL. |
| `ollamaModel` | `OLLAMA_MODEL` | `gpt-oss:20b` | Primary LLM model tag for text extraction. |
| `ollamaVisionModel` | `OLLAMA_VISION_MODEL` | `qwen2.5vl:7b` | Vision model tag (surfaced in `/api/health`). |
| `agenticExtensionRoot` | `AGENTIC_EXTENSION_ROOT` | `$HOME/Chrome Agentic Agent` | Root of the Chrome Agentic Agent extension source. |
| `agenticExtensionDist` | `AGENTIC_EXTENSION_DIST` | `<agenticExtensionRoot>/.output/chrome-mv3` | Built extension dist directory. |
| `pageIndexRoot` | `PAGEINDEX_ROOT` | `<repoRoot>/../PageIndex` | Root of the PageIndex service used during extraction. |
| `disputeOutputRoot` | `DISPUTE_OUTPUT_ROOT` | `<repoRoot>/output/dispute-letters` | Root directory for dispute letter draft storage and export artifacts. |
| `supportedProfiles` | -- | `["equifax_old_v1", "equifax_new_v1", "experian_acr_v1", "transunion_acr_v1"]` | Hard-coded list of valid extraction profile IDs. |

### Python Executable Resolution (line 14-28)

The `resolvePythonExecutable()` function applies this precedence:

1. `process.env.PYTHON_EXECUTABLE` -- if set, used as-is.
2. `$CONDA_PREFIX/bin/python` -- if `CONDA_PREFIX` is set and that binary exists.
3. `"python3"` -- fallback to PATH lookup.

---

## Session Store

**File:** `server/sessionStore.mjs`

### Class: `SessionStore`

An in-memory `Map<string, Session>` backed store. Each session gets a UUID and a workspace directory on disk.

#### Constructor (line 20)

```js
new SessionStore(sessionRoot: string)
```

Creates the store. `sessionRoot` is the parent directory where per-session workspace folders are created.

#### Methods

| Method | Line | Signature | Description |
|---|---|---|---|
| `init()` | 25 | `async init()` | Ensures `sessionRoot` exists on disk (`mkdir -p`). |
| `createSession()` | 29 | `async createSession() => Session` | Generates a UUID, creates `<sessionRoot>/<uuid>/`, returns a new session in `created` status. |
| `getSession(id)` | 55 | `getSession(id) => Session \| null` | Retrieves session from the in-memory map. |
| `touch(session)` | 59 | `touch(session)` | Updates `session.updatedAt` to `Date.now()`. |
| `setUploadedFile(session, fileName, fileBuffer)` | 63 | `async` | Writes the buffer to `<workspace>/uploads/<safeName>`, calls `registerUploadedFile`. Returns the file path. |
| `registerUploadedFile(session, fileName, filePath)` | 77 | sync | Sets `uploadedFileName`, `uploadedFilePath`, status `"uploaded"`, progress `20`. |
| `setUploadProgress(session, progress, stage)` | 88 | sync | Sets status `"uploading"`, clamps progress to `[1, 19]`. Used during chunked uploads. |
| `setProcessing(session)` | 97 | sync | Sets status `"processing"`, clears `lastError`, sets progress to at least `22`. |
| `setProgress(session, progressUpdate)` | 107 | sync | Merges `progressUpdate` into `session.progress`. Clamps progress `[0, 99]`. |
| `setFailed(session, errorMessage)` | 124 | sync | Sets status `"failed"`, stores error string in `lastError`. |
| `setProcessed(session, result, opts)` | 134 | sync | Sets status `"processed"`, stores result payload, progress `100`. Accepts `{ deleteOnRead }` option. |
| `deleteSession(id)` | 147 | `async` | Removes from map, recursively deletes workspace directory. Returns boolean. |
| `listSessions()` | 158 | `listSessions() => Session[]` | Returns all sessions as an array. |

#### Session State Shape (line 34-49)

```ts
{
  id: string;              // UUID
  workspaceDir: string;    // Absolute path
  createdAt: number;       // epoch ms
  updatedAt: number;       // epoch ms
  status: "created" | "uploading" | "uploaded" | "processing" | "processed" | "failed";
  progress: {
    progress: number;      // 0-100
    stage: string;         // human-readable description
  };
  uploadedFileName: string | null;
  uploadedFilePath: string | null;
  result: object | null;   // full extraction result payload
  deleteOnRead: boolean;
  lastError: string | null;
}
```

#### Status Lifecycle

```
created  -->  uploading  -->  uploaded  -->  processing  -->  processed
                                                  \-->  failed
```

- `created` -- session just initialized, no file yet.
- `uploading` -- chunked upload in progress (progress 1-19).
- `uploaded` -- PDF fully received (progress 20).
- `processing` -- extraction worker running (progress 22-99).
- `processed` -- extraction complete (progress 100), result payload stored.
- `failed` -- extraction error, `lastError` populated.

#### Expiration (line 163-169)

```js
shouldExpireSession(session, retentionSeconds) => boolean
```

Returns `true` when `(Date.now() - session.updatedAt) > retentionSeconds * 1000`. A negative `retentionSeconds` disables expiry entirely.

#### Session Sweeper (index.mjs, line 1779-1790)

When `retentionSeconds > 0`, a 30-second `setInterval` (unref'd) calls `shouldExpireSession` on every session and deletes expired ones.

---

## Python Worker

**File:** `server/pythonWorker.mjs`

### Exported Function: `runWorkerExtraction` (line 8)

```ts
runWorkerExtraction({
  session: Session,
  profile: string,
  config: AppConfig,
  onProgress: (update: ProgressPayload) => void,
}) => Promise<{ workerOutput: object, logs: { stdout: string, stderr: string } }>
```

#### What It Does

1. Creates `<session.workspaceDir>/outputs/` if missing.
2. Spawns the Python worker as a child process with these CLI arguments:

| Flag | Value |
|---|---|
| (positional) | `config.workerScript` |
| `--session-id` | `session.id` |
| `--session-dir` | `session.workspaceDir` |
| `--input-pdf` | `session.uploadedFilePath` |
| `--output-json` | `<workspaceDir>/outputs/result.json` |
| `--profile` | `profile` |
| `--ollama-base-url` | `config.ollamaBaseUrl` |
| `--model` | `config.ollamaModel` |
| `--max-pages` | `config.maxPdfPages` (stringified) |
| `--pageindex-root` | `config.pageIndexRoot` |

3. Environment inherits `process.env` plus:
   - `PYTHONUNBUFFERED=1`
   - `PYTHONIOENCODING=utf-8`

4. Reads `result.json` from disk after the process exits.
5. Validates `workerOutput.status === "ok"`.

#### Progress Parsing (line 104-120)

The worker writes progress updates to **stdout** using a line protocol:

```
__PROGRESS__{"progress": 45, "stage": "Extracting accounts..."}
```

Lines prefixed with `__PROGRESS__` are parsed as JSON and forwarded to `onProgress()`. All other stdout lines are collected into the `logs.stdout` string. Malformed progress lines are logged with a `[progress-parse-error]` prefix.

#### Error Handling

1. **Non-zero exit code** (line 143-149): Throws with stderr and stdout attached.
2. **Spawn failure** (line 135-137): Throws `"Failed to start worker process"`.
3. **Structured error recovery** (line 48-61): On any process error, attempts to read `result.json` and re-throw the worker's own error message if `status !== "ok"` and an `error` field exists. This provides cleaner error messages when the Python worker writes a partial output before crashing.
4. **Invalid JSON** (line 70-72): Throws `"Worker did not produce valid JSON output"`.
5. **Worker-reported failure** (line 74-78): Throws `"Worker reported failure: <error>"`.

### Internal: `runCommand` (line 89-153)

Low-level process spawner. Returns `{ stdout, stderr }` on exit code 0. Uses line-buffered stdout parsing to handle `__PROGRESS__` protocol lines in real time.

---

## Result Mapper

**File:** `server/resultMapper.mjs`

### Exported Function: `mapWorkerResultToCreditReport` (line 1254)

```ts
mapWorkerResultToCreditReport({
  session: Session,
  workerResult: WorkerOutput,
}) => CreditReport
```

Dispatches to a profile-specific mapper based on `workerResult.meta.profileId` or `workerResult.profile`:

| Profile ID | Mapper Function | Line |
|---|---|---|
| `equifax_old_v1` (default) | `mapEquifaxResultToCreditReport` | 656 |
| `equifax_new_v1` | `mapEquifaxNewResultToCreditReport` | 1017 |
| `experian_acr_v1` | `mapExperianResultToCreditReport` | 853 |
| `transunion_acr_v1` | `mapTransunionResultToCreditReport` | 1161 |

### Common Output Shape (CreditReport)

All four mappers produce the same top-level structure:

```ts
{
  bureau: string;                    // "Equifax" | "Experian" | "TransUnion"
  profileId: string;                 // e.g. "equifax_old_v1"
  reportDate: string;
  personalInfo: {
    name: string;
    addresses: string[];
    currentAddresses: string[];
    previousAddresses: string[];
    ssn?: string;
    socialSecurityNumbers: string[];
    dob?: string;
    employmentHistory?: string;
  };
  accounts: EnrichedAccount[];
  collections: EnrichedCollection[];
  accountSummaries: object[];
  inquiries: LegacyInquiry[];
  publicRecords: NormalizedPublicRecord[];
  consumerInformationIndicators: Indicator[];
  creditScores: [];                  // always empty (placeholder)
  rawText: string;
  reportId: string;                  // session UUID
  fileName: string;
  confirmationNumber: string | null;
  consumerName: string | null;
  inquiryCount: number;
  publicRecordCount: number;
  collectionCount: number;
  componentStatus: Record<string, "complete" | "failed">;
  validationIssues: ValidationIssue[];
  readyForAttorney: boolean;
  components: object;                // raw worker components pass-through
  sourceSessionId: string;
  sourceComponents: Record<string, { pages: number[] }>;
  inquiryBuckets?: {
    hardInquiries: LegacyInquiry[];
    softInquiries: LegacyInquiry[];
    hardInquiryCount: number;
    softInquiryCount: number;
  };
}
```

### Key Internal Functions

| Function | Line | Purpose |
|---|---|---|
| `normalizeArray(value)` | 1 | Coerces strings (split on `\n`, `;`, `\|`) or arrays to `string[]`. |
| `normalizeUniqueStrings(value)` | 12 | Deduplicates an array of strings (case-insensitive). |
| `uniquePositiveNumbers(value)` | 30 | Extracts unique positive integers from an array. |
| `accountKey(value)` | 51 | Builds a `"name::number"` composite key for account deduplication/matching. |
| `buildComponentSourceMap(pageWindows)` | 54 | Converts `meta.componentSources` into `{ componentName: { pages: number[] } }`. |
| `attachAccountSources(accounts, sources, fallbackPages, historyEvidence)` | 76 | Matches `meta.accountSources` page numbers to accounts by composite key. Also attaches `paymentHistoryYears` from evidence. |
| `attachCollectionSources(collections, sources, fallbackPages)` | 113 | Matches `meta.collectionSources` page numbers to collections by composite key. |
| `enrichAccount(account, reportingCategory)` | 227 | Infers `accountSubtype`, `reportingCategory`, `legalCategory`, and other classification fields. |
| `enrichCollection(collection)` | 245 | Applies subtype inference and forces `reportingCategory: "collection"`. |
| `inferAccountSubtype(account)` | 173 | Pattern-matches account context text against rules for Auto Lease, Child Support, Family Support, Medical Debt, Rental Agreement. |
| `inferReportingCategory(account, fallback)` | 207 | Returns `"collection"` if keywords match, otherwise the fallback. |
| `inferLegalCategory(account)` | 219 | Detects `"bankruptcy"` from context, otherwise defers to subtype inference. |
| `normalizePublicRecordEntry(entry, fallbackPages)` | 497 | Parses structured detail labels from public record text, extracts fields like court, referenceNumber, dateFiled, etc. |
| `buildConsumerInformationIndicators(rawIndicators, accounts, fallbackPages, publicRecords)` | 587 | Aggregates consumer information indicators from explicit indicators, account-level fields, and bankruptcy public records. |
| `deriveCollectionsFromAccounts(accounts)` | 373 | Extracts collection-category accounts into a standalone collections array (used by TransUnion mapper). |
| `mergeCollections(...groups)` | 405 | Deduplicates collections across multiple sources by composite identity key. |
| `extractMonthlyHistoryRows(value, fallback)` | 303 | Normalizes payment history into year-keyed rows with jan-dec columns. |
| `historyRowsFromDatedEntries(entries, valueKey, fallback)` | 354 | Converts dated entries (e.g., `{ date: "May 2024", balance: "$500" }`) into monthly history rows. |
| `historyRowsFromEvidence(value, fallback)` | 314 | Converts evidence-format history (nested `months` object) to standard rows. |
| `flattenMonthlyHistoryRows(rows, fallback)` | 327 | Flattens year-keyed rows into a single flat `paymentHistory[]` array plus `paymentHistoryYears[]`. |

### Bureau-Specific Mappers

#### Equifax Old (`mapEquifaxResultToCreditReport`, line 656)

Reads components: `reportConfirmationDetails`, `personalInformation`, `summary`, `otherItemsSummary`, `accounts`, `collections`, `inquiries`, `publicRecords`, `consumerInformationIndicators`.

- Splits inquiries into hard/soft from `inquiriesContainer.hardInquiries` / `softInquiries`.
- Attaches source page numbers via `meta.accountSources` and `meta.collectionSources`.

#### Equifax New (`mapEquifaxNewResultToCreditReport`, line 1017)

Reads components: `reportConfirmationDetails`, `summary`, `personalInformation`, `accounts`, `collections`, `publicRecords`, `inquiries`.

- Uses `mapEquifaxNewRawAccountToLegacy` (line 929) to normalize the different field naming convention in new-format Equifax reports.
- Extracts 24-month history sections (`balance`, `creditLimit`, `pastDueAmount`) from `account.month24History.sections`.
- Uses `mapEquifaxNewInquiryToLegacy` (line 984) for inquiry normalization.

#### Experian ACR (`mapExperianResultToCreditReport`, line 853)

Reads components: `reportOverview`, `personalInformation`, `accounts`, `publicRecords`, `hardInquiries`, `softInquiries`.

- Uses `mapExperianRawAccountToLegacy` (line 786) for account field mapping.
- Extracts balance history from dated `balanceHistories` entries.
- Collections array is always empty (`[]`) because Experian ACR embeds collection entries inside the accounts component.
- Uses `mapExperianInquiriesToLegacy` (line 770) for inquiry normalization.

#### TransUnion ACR (`mapTransunionResultToCreditReport`, line 1161)

Reads components: `reportOverview`, `personalInformation`, `adverseAccounts`, `satisfactoryAccounts`, `collections`, `publicRecords`, `inquiries`, `accountReviewInquiries`.

- Merges adverse and satisfactory account arrays into a single `accounts` list.
- Uses `mapTransunionRawAccountToLegacy` (line 1109) for account field mapping.
- Derives implicit collections from accounts via `deriveCollectionsFromAccounts` (line 373), then merges with explicit collections.
- Merges `accounts` source page windows from `adverseAccounts` and `satisfactoryAccounts` when no unified `accounts` source exists.

---

## Express Server

**File:** `server/index.mjs`

### Middleware

#### JSON Body Parser (line 85)

```js
app.use(express.json({ limit: "2mb" }));
```

#### CORS (line 86-97)

Permissive CORS on every response:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`
- `OPTIONS` requests return `204` immediately.

#### Multer Upload Handlers (line 72-83)

Two multer instances using in-memory storage:

| Name | Field | Max Size |
|---|---|---|
| `upload` | `file` | `appConfig.maxUploadBytes` (default 40 MB) |
| `chunkUpload` | `chunk` | `min(maxUploadBytes, 768 KB)` |

### Extraction Session Routes

| Method | Path | Handler Line | Description |
|---|---|---|---|
| `POST` | `/api/sessions` | 1081 | Create a new extraction session |
| `POST` | `/api/sessions/:sessionId/upload` | 1095 | Upload full PDF in one request |
| `POST` | `/api/sessions/:sessionId/upload-chunk` | 1124 | Upload a PDF chunk (chunked upload) |
| `POST` | `/api/sessions/:sessionId/process` | 1200 | Start extraction processing |
| `GET` | `/api/sessions/:sessionId/status` | 1309 | Poll session status and progress |
| `GET` | `/api/sessions/:sessionId/result` | 1414 | Retrieve extraction result |
| `GET` | `/api/sessions/:sessionId/pages/:pageNumber/image` | 1324 | Get a rendered page image (PNG) |
| `DELETE` | `/api/sessions/:sessionId` | 1750 | Delete session and workspace |
| `GET` | `/api/sessions` | 1755 | List all sessions |

#### `POST /api/sessions` (line 1081)

Creates a new session via `sessionStore.createSession()`.

**Response** `201`:
```json
{
  "status": "ok",
  "sessionId": "<uuid>",
  "createdAt": 1711324800000,
  "profileDefault": "equifax_old_v1"
}
```

#### `POST /api/sessions/:sessionId/upload` (line 1095)

Accepts a single PDF via `multipart/form-data` field `file`.

**Validation:**
- Session must exist (404).
- File must be present (400).
- File must end in `.pdf` (400).

**Response** `200`:
```json
{
  "status": "ok",
  "sessionId": "<uuid>",
  "uploadedFileName": "report.pdf",
  "uploadedFilePath": "/abs/path/to/file.pdf",
  "bytes": 1234567
}
```

#### `POST /api/sessions/:sessionId/upload-chunk` (line 1124)

Chunked upload for large PDFs. Each chunk is sent as `multipart/form-data` field `chunk`.

**Required body fields:** `fileName`, `chunkIndex` (0-based), `totalChunks`.

**Behavior:**
- `chunkIndex === 0`: creates/overwrites the target file.
- `chunkIndex > 0`: appends to existing file (409 if file missing, indicating out-of-order).
- `chunkIndex === totalChunks - 1`: registers the file as uploaded, returns `complete: true`.
- Intermediate chunks: returns `complete: false` and reports upload progress (5-20%).

#### `POST /api/sessions/:sessionId/process` (line 1200)

Triggers extraction. Auto-detects the bureau profile from the PDF content (`detectProfileFromPdf`, line 217) unless `profile` is provided in the request body.

**Profile Auto-Detection (line 217-270):**
Uses `pdftotext` (first 12 pages) to match known text patterns:
1. TransUnion: "personal credit report for:" + "visit transunion.com/dispute" or matching file/credit-report headers.
2. Experian: "annual credit report - experian" or "experian" + "at a glance" + "hard inquiries".
3. Equifax New: "equifax" + "your credit report" + "consumer file notices" + "confirmation #".
4. Equifax Old: any remaining "equifax" match.
5. Falls back to filename heuristics, then `appConfig.profileDefault`.

**Behavior:**
- If already `processing`, returns `202` with current progress (idempotent).
- Otherwise sets status to `processing`, returns `202`, then runs extraction asynchronously.
- On success: stores result via `sessionStore.setProcessed()`.
- On failure: stores error via `sessionStore.setFailed()`.

**Response** `202`:
```json
{
  "status": "accepted",
  "sessionId": "<uuid>",
  "profile": "equifax_old_v1",
  "sessionStatus": "processing",
  "progress": { "progress": 22, "stage": "Queued for backend extraction." },
  "deleteOnRead": false
}
```

#### `GET /api/sessions/:sessionId/status` (line 1309)

Polling endpoint for session progress.

**Response** `200`:
```json
{
  "status": "ok",
  "sessionId": "<uuid>",
  "sessionStatus": "processing",
  "progress": { "progress": 55, "stage": "Extracting accounts..." },
  "lastError": null,
  "uploadedFileName": "report.pdf",
  "hasResult": false
}
```

#### `GET /api/sessions/:sessionId/result` (line 1414)

Returns the full extraction result payload. Returns 404 if processing is not yet complete.

**Response** `200`: The full result object as stored by `setProcessed`.

#### `GET /api/sessions/:sessionId/pages/:pageNumber/image` (line 1324)

Serves a rendered page image PNG from `<workspace>/ingestion/images/page-<N>.png`.

**Response:** `image/png` with `Cache-Control: private, max-age=60`.

#### `DELETE /api/sessions/:sessionId` (line 1750)

Deletes session and its workspace directory. Returns `204`.

#### `GET /api/sessions` (line 1755)

Lists all active sessions.

**Response** `200`:
```json
{
  "status": "ok",
  "sessions": [
    {
      "id": "<uuid>",
      "status": "processed",
      "createdAt": 1711324800000,
      "updatedAt": 1711324900000,
      "uploadedFileName": "report.pdf",
      "hasResult": true
    }
  ]
}
```

---

### Acquisition Session Routes

These routes manage guided browser-based credit report retrieval from AnnualCreditReport.com.

| Method | Path | Handler Line | Description |
|---|---|---|---|
| `POST` | `/api/acquisition/sessions` | 910 | Launch a new acquisition session |
| `GET` | `/api/acquisition/sessions` | 969 | List all acquisition sessions |
| `GET` | `/api/acquisition/sessions/:sessionId/status` | 990 | Get acquisition session status |
| `POST` | `/api/acquisition/sessions/:sessionId/respond` | 1003 | Respond to a pending prompt |
| `POST` | `/api/acquisition/sessions/:sessionId/browser-debug` | 1024 | Log a browser debug event |
| `POST` | `/api/acquisition/sessions/:sessionId/controller-ready` | 1040 | Signal browser controller readiness |
| `GET` | `/api/acquisition/sessions/:sessionId/reports/:bureau/file` | 1061 | Download an acquired report PDF |
| `DELETE` | `/api/acquisition/sessions/:sessionId` | 1075 | Delete acquisition session |

#### `POST /api/acquisition/sessions` (line 910)

Creates and launches a new acquisition session. Validates consumer PII input fields.

**Required fields:** `firstName`, `lastName`, `birthDate`, `ssn`, `confirmSsn`, `email`, `phone`, `currentAddress1`, `currentCity`, `currentState`, `currentZip`, `launchConsentAccepted` (must be `true`), `launchConsentName`.

**Optional fields:** `middleInitial`, `suffix`, `currentAddress2`, `livedAtCurrentAddressTwoYearsOrMore` (default `true`), previous address fields (required if current address is < 2 years), `targetBureau` (equifax|experian|transunion), `stopAfterFirstSavedReport`.

**Behavior:**
- Deletes all existing acquisition sessions.
- Kills orphaned browser processes (`killOrphanedAcquisitionBrowsers`, line 33-70).
- Creates session and fires off `runAnnualCreditReportAcquisition()` asynchronously.

**Response** `201`:
```json
{
  "status": "ok",
  "session": { /* serialized acquisition session */ }
}
```

#### `GET /api/acquisition/sessions/:sessionId/status` (line 990)

Returns session status. Supports `?compact=1` for a lighter payload.

#### `POST /api/acquisition/sessions/:sessionId/respond` (line 1003)

Responds to a pending interactive prompt (e.g., security questions). Requires `promptId` and `response` in the body.

#### `GET /api/acquisition/sessions/:sessionId/reports/:bureau/file` (line 1061)

Downloads the acquired PDF for a specific bureau. The `:bureau` parameter is normalized (lowercased, non-alphanumeric stripped).

---

### Dispute Draft Routes

| Method | Path | Handler Line | Description |
|---|---|---|---|
| `POST` | `/api/dispute-drafts` | 1427 | Create or reuse a dispute letter draft |
| `GET` | `/api/dispute-drafts/lookup` | 1502 | Look up a draft by request key |
| `GET` | `/api/dispute-drafts/:draftId` | 1530 | Get a draft by ID |
| `PATCH` | `/api/dispute-drafts/:draftId/sections/:sectionId` | 1540 | Update a section of the draft |
| `PATCH` | `/api/dispute-drafts/:draftId/full-document` | 1562 | Replace the full document HTML |
| `POST` | `/api/dispute-drafts/:draftId/render` | 1584 | Render draft preview |

#### `POST /api/dispute-drafts` (line 1427)

Creates a new dispute letter draft or reuses an existing one matched by `requestKey`.

**Required body fields:** `sessionId`, `report`, `intake`, `reasons` (array).

**Optional body fields:** `requestKey` (idempotency key), `hydrateEvidence` (boolean -- if `true`, runs evidence generation inline).

**Deduplication:** Uses `runSharedJob` (line 150-164) to coalesce concurrent requests with the same `requestKey`. The `draftIdsByRequestKey` in-memory map (line 29) caches the mapping.

**Evidence hydration:** When `hydrateEvidence: true`, the endpoint generates evidence bundles and validates them. If any selected reasons have unresolved evidence, it throws `EvidencePreparationIncompleteError` (line 166-172), returning a `409` with `unresolvedReasonIds` in details.

**Response:** `201` (new) or `200` (reused).

#### `GET /api/dispute-drafts/lookup` (line 1502)

Looks up a draft by `?requestKey=...`. Returns `{ ready: false, draft: null }` if not found.

#### `PATCH /api/dispute-drafts/:draftId/sections/:sectionId` (line 1540)

Updates a specific section of the draft. Requires `group` and `patch` (object) in the body.

#### `PATCH /api/dispute-drafts/:draftId/full-document` (line 1562)

Replaces the full HTML document content. Requires `html` (string) in the body.

#### `POST /api/dispute-drafts/:draftId/render` (line 1584)

Renders the draft preview. Optional body `{ rebuildFromSections: true }` to rebuild from section data.

---

### Evidence & Export Routes

| Method | Path | Handler Line | Description |
|---|---|---|---|
| `POST` | `/api/dispute-drafts/:draftId/evidence` | 1602 | Generate evidence bundles |
| `POST` | `/api/dispute-drafts/:draftId/highlighted-report` | 1633 | Generate highlighted report PDF |
| `POST` | `/api/dispute-drafts/:draftId/export` | 1699 | Export draft to DOCX/PDF |
| `GET` | `/api/dispute-drafts/:draftId/artifacts/:fileName` | 1735 | Download an export artifact |
| `GET` | `/api/evidence/slide-image` | 1347 | Render an evidence slide image (SVG) |

#### `POST /api/dispute-drafts/:draftId/evidence` (line 1602)

Generates evidence slide bundles for the draft's selected dispute reasons. Uses `runSharedJob` to prevent duplicate concurrent runs per draft.

Internally calls `runEvidenceGeneration` (line 783-896), which:
1. Resolves the source session context and original PDF.
2. Runs `dispute_evidence_generator.py` via `executeEvidenceGenerationScript` (line 556).
3. Optionally retries in `tight` mode if `shouldRetryEvidenceManifest` determines the output has structural or validation problems.
4. Runs `dispute_highlight_validator.py` to validate highlight accuracy.
5. Annotates the manifest with validation results (`annotateManifestWithValidation`, line 713).

#### `POST /api/dispute-drafts/:draftId/highlighted-report` (line 1633)

Generates a highlighted PDF version of the original credit report with evidence annotations. Returns `409` if blocking unresolved reasons exist.

#### `POST /api/dispute-drafts/:draftId/export` (line 1699)

Exports the draft as DOCX and/or PDF by calling `dispute_letter_generator.py`.

**Response** `200`:
```json
{
  "status": "ok",
  "draft": { /* with updated renderState.docxPath / pdfPath */ },
  "exportResult": { "docxPath": "...", "pdfPath": "..." }
}
```

#### `GET /api/dispute-drafts/:draftId/artifacts/:fileName` (line 1735)

Serves a static file from the draft's output directory. File name is `path.basename()`-sanitized.

#### `GET /api/evidence/slide-image` (line 1347)

Renders an evidence slide as an SVG image. Composes the page image with highlight overlay rectangles.

**Query parameters:**
- `sessionId` -- source extraction session.
- `slide` -- JSON-encoded slide descriptor with `pageNumber`, `pageImageWidth`, `pageImageHeight`, `cropBox`, `highlightBoxes`.

**Response:** `image/svg+xml` with `Cache-Control: private, max-age=60`.

---

### Utility Routes

| Method | Path | Handler Line | Description |
|---|---|---|---|
| `GET` | `/api/health` | 898 | Health check / config summary |

#### `GET /api/health` (line 898)

**Response** `200`:
```json
{
  "status": "ok",
  "apiPort": 8787,
  "profileDefault": "equifax_old_v1",
  "supportedProfiles": ["equifax_old_v1", "equifax_new_v1", "experian_acr_v1", "transunion_acr_v1"],
  "model": "gpt-oss:20b",
  "visionModel": "qwen2.5vl:7b",
  "retentionSeconds": 0
}
```

---

### SPA Fallback & Static Files

#### Static File Serving (line 1768)

```js
app.use(express.static(distDir));
```

Serves the Vite production build from `<repoRoot>/dist/`.

#### SPA Catch-All (line 1770-1777)

```js
app.get(/^(?!\/api).*/, ...)
```

Any `GET` request not starting with `/api` is served `dist/index.html` for client-side routing. Returns `503` with `"Frontend build not found. Run npm run build."` if the index file does not exist.

---

## Error Envelope

All error responses use a consistent shape produced by `sendError` (line 135-141):

```json
{
  "status": "error",
  "error": "Human-readable error message",
  "details": { /* optional structured details */ }
}
```

The HTTP status code is set per-call. Common codes used:

| Status | Meaning |
|---|---|
| `400` | Bad request / validation failure |
| `404` | Session or draft not found |
| `409` | Conflict (out-of-order chunks, evidence not ready, prompt resolution conflict) |
| `500` | Internal server error |
| `503` | Frontend build not found (SPA fallback only) |

---

## Startup & Shutdown

### Bootstrap (line 1792-1807)

```js
const bootstrap = async () => {
  await sessionStore.init();
  await acquisitionStore.init();
  await disputeLetterStore.init();
  await writeHealthReadme();
  startSweeper();
  app.listen(appConfig.apiPort, appConfig.apiHost, ...);
};
```

1. Initializes all three stores (ensures workspace root directories exist).
2. Writes a `.keep` sentinel file to `sessionRoot`.
3. Starts the session sweeper interval (if `retentionSeconds > 0`).
4. Binds Express to `apiHost:apiPort`.

### Component Status Seeds (line 99-133)

When the Python worker returns without a result, the server uses profile-specific "seed" objects to populate `componentStatus`. Each component starts as `"failed"` and is overridden to `"complete"` only if the worker explicitly reports success:

| Profile | Components |
|---|---|
| `equifax_old_v1` | reportConfirmationDetails, personalInformation, summary, creditAccountsSummary, otherItemsSummary, accounts, collections, inquiries |
| `equifax_new_v1` | reportConfirmationDetails, summary, personalInformation, accounts, inquiries |
| `experian_acr_v1` | reportOverview, personalInformation, accounts, publicRecords, hardInquiries, softInquiries |
| `transunion_acr_v1` | reportOverview, personalInformation, adverseAccounts, satisfactoryAccounts, inquiries, accountReviewInquiries |

### In-Memory State Maps (line 29-31)

| Map | Purpose |
|---|---|
| `draftIdsByRequestKey` | Caches `requestKey -> draftId` for dispute draft deduplication. |
| `inFlightDraftCreations` | Coalesces concurrent `POST /api/dispute-drafts` calls with the same request key. |
| `inFlightEvidenceJobs` | Coalesces concurrent evidence/highlighted-report generation per draft. |
