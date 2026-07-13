# 3 Bureau Extractor - Overhaul Plan

## Objective
Build a reliable, local-first credit report extraction system that:
- accurately parses Equifax, Experian, and TransUnion PDFs,
- stitches account data across multiple pages,
- preserves field-level source evidence (page/line),
- avoids client-side secrets and browser-to-model API calls.

## Non-Negotiables
- No model keys in frontend code.
- No direct browser calls to external model providers.
- Session-scoped processing for sensitive report data.
- Deterministic extraction contracts (strict JSON schemas).
- Every extracted field includes traceable source references.

## Target Architecture
1. Frontend uploads PDF to backend session endpoint.
2. Backend creates an isolated processing session.
3. Per-page ingest pipeline:
   - direct text extraction from PDF when available,
   - image-based extraction only for low-text or scanned pages.
4. Page-index tree generation (section + page-range mapping).
5. Retrieval per task using section ranges and neighboring pages.
6. Extractors produce normalized entities (accounts, inquiries, etc.).
7. Cross-page stitching merges fragments into canonical records.
8. Validator pass resolves conflicts and flags uncertain fields.
9. Frontend renders structured entities plus evidence links.
10. Session data auto-expires and is hard-deleted after TTL.

## Delivery Phases

### Phase 0 - Baseline and Safety (1-2 days)
- Create the new repo working branch in this copy.
- Lock sample test set from `~/Desktop/Projects/credit report references`.
- Add a baseline report with current extraction success/failure metrics.
- Remove hardcoded keys from code and disable all client-side provider calls.

### Phase 1 - Backend Session Layer (2-3 days)
- Add backend service (Node/TypeScript preferred to match project stack).
- Implement endpoints:
  - `POST /api/sessions`
  - `POST /api/sessions/:id/upload`
  - `POST /api/sessions/:id/process`
  - `GET /api/sessions/:id/result`
- Implement session storage abstraction with TTL cleanup.
- Add encryption-at-rest for temporary files if disk is used.

### Phase 2 - Page Ingest and Quality Routing (3-4 days)
- Build per-page representation:
  - text blocks with coordinates,
  - optional rendered page image,
  - text-quality score.
- Routing rule:
  - high-quality text pages -> text extractor path,
  - low-quality/scanned pages -> image extraction path.
- Save parse evidence pointers for each page block.

### Phase 3 - Page Index Retrieval (3-4 days)
- Implement PageIndex-style section tree from ingested pages.
- Add retrieval API:
  - request section (`accounts`, `collections`, `inquiries`, etc.),
  - return page ranges + neighboring context pages.
- Keep index session-scoped only.
- Track retrieval latency and token/compute footprint.

### Phase 4 - Structured Extraction + Stitching (4-6 days)
- Implement bureau-aware extractors for:
  - report metadata,
  - accounts/tradelines,
  - inquiries,
  - collections/public records,
  - personal information.
- Build stitching engine for cross-page accounts:
  - stable key = bureau + creditor + masked account + timeline hints,
  - merge rules for conflicts and missing values,
  - confidence score per merged field.
- Emit canonical JSON contracts consumed by UI.

### Phase 5 - Validation and QA Harness (3-4 days)
- Add rule-based validators:
  - date sanity,
  - money formatting,
  - impossible state checks.
- Add second-pass model validation only for low-confidence fields.
- Build regression harness over your known PDF set with scored metrics:
  - field-level precision/recall,
  - account stitching accuracy,
  - unresolved field count.

### Phase 6 - Frontend Integration Cleanup (2-3 days)
- Update frontend to consume backend result contracts only.
- Fix route and tab inconsistencies (`/reports`, `/webhooks`, `/settings`).
- Replace mock webhook behavior with real backend integration or feature-flag it off.
- Add evidence UI: click any field -> source page and line reference.

### Phase 7 - Security and Release Hardening (2-3 days)
- Key rotation and secret vault usage.
- Audit logs (redacted), rate limits, request size limits.
- Data retention controls and explicit delete-now action.
- Lint/type/test gates required for deploy.

## Initial Sprint (Start Immediately)
1. Remove client-side model calls and secrets.
2. Scaffold backend session service and upload endpoint.
3. Implement minimal page ingest for Equifax only.
4. Return extracted report metadata + source evidence.
5. Wire existing React components to new backend response.

## Definition of Done (Phase 1 MVP)
- Uploading a real Equifax PDF returns:
  - consumer identity fields,
  - report confirmation,
  - at least 90% correctly extracted account headers,
  - source evidence for each field.
- No secrets in frontend bundle.
- No browser CORS calls to model providers.
- Session cleanup confirmed by automated test.

## Open Decisions
- Backend runtime: Node/TypeScript only, or Python microservice for extraction.
- Local model runtime standard: Ollama-only or mixed runtimes.
- Confidence threshold for auto-accept vs manual review.
- Default session TTL (recommended: 60 minutes).
