---
title: Dispute Generation & Evidence — Technical Reference
aliases:
  - Dispute Docs
  - Reason Engine
  - Evidence Highlighting
tags:
  - docs
  - disputes
  - fcra
  - evidence
  - letter-generation
created: 2026-03-25
description: "Canonical reference for the dispute letter generation pipeline — reason engine (45+ rules, 10 categories), letter builder (clause library, variant selection), evidence highlighting (bounding boxes), and workflow UI (6-step)."
related:
  - "[[extraction-pipeline]]"
  - "[[acquisition-pipeline]]"
  - "[[credit-clarify-gain-equity]]"
---

# Dispute Generation & Evidence — Technical Reference

> **Living doc.** Update this file whenever dispute code changes.

## Overview

The dispute pipeline takes extracted credit report data, identifies material inaccuracies, generates CFPB-standard dispute letters, and produces highlighted evidence reports.

| File | Lines | Role |
|------|-------|------|
| `src/features/dispute-letters/reasonEngine.ts` | ~7,182 | 45+ rules across 10 categories |
| `src/features/dispute-letters/types.ts` | — | All type definitions |
| `src/features/dispute-letters/api.ts` | — | API layer (draft CRUD, export, evidence) |
| `src/features/dispute-letters/components/DisputeLetterWorkflow.tsx` | — | 6-step workflow UI |
| `server/disputeLetterBuilder.mjs` | — | Server-side letter generation |
| `server/dispute_evidence_generator.py` | — | Highlighted report with bounding boxes |
| `server/dispute_highlight_validator.py` | — | Vision validation (STUBBED) |

## Data Flow

```
Extracted CreditReport
    ↓
[1] generateAccountRuleCatalog(report)
    ├── buildAccountViews() → bureau-specific account normalization
    ├── buildAccountPostureMap() → negative/positive classification
    └── Evaluate 45+ ACCOUNT_RULE_DEFINITIONS per account
    ↓
[2] generateNonAccountReasons(report, intake)
    ├── detectPublicRecordReasons()
    ├── detectConsumerInformationIndicatorReasons()
    └── detectPersonalInformationReasons()
    ↓
[3] User selects rules in workflow UI
    ↓
[4] generateDisputeReasons(report, intake, catalog, nonAccountReasons)
    → Final DisputeReason[] for letter
    ↓
[5] createDisputeLetterDraft(report, intake, reasons)
    → Letter sections + clause templates + variant selection
    ↓
[6] generateDisputeEvidence(draftId) → dispute_evidence_generator.py
    → Evidence manifest with highlight boxes per reason
    ↓
[7] generateHighlightedReportPdf(draftId)
    → Yellow-boxed report pages as evidence
    ↓
[8] exportDisputeLetterDraft(draftId)
    → DOCX + PDF + highlighted report PDF
```

## The 10 Categories

| Category | What It Detects | Rules |
|----------|----------------|-------|
| `account_identity` | Missing/conflicting account identifiers | 6 |
| `payment_history` | Payment timing, completeness, progression | 20+ |
| `balance_amount` | Balance, credit limit, charged-off inconsistencies | 5 |
| `charge_off_collection` | Charge-off/collection status defects | 2 |
| `legal_public_record` | Public records, consumer info indicators | 6 |
| `date_reporting_timeline` | Missing/conflicting dates | 6+ |
| `personal_information` | Name/address mismatches | 2 |
| `tradeline_integrity` | Cross-account consistency | — |
| `attorney_escalation` | Multiple SSNs, escalation matters | 1 |
| `report_review` | General report review requests | 1 |

## Key Rule Types (45+ total, starting line 3847)

### Identity (6 rules)
- `duplicate_conflicting_tradeline` — same masked account #, different data
- `missing_account_number` — account number empty/masked
- `missing_furnisher_identification` — no furnisher address/phone
- `missing_account_status` — status field absent
- `incomplete_original_creditor_identity` — original creditor info missing
- `student_loan_lender_identity_mismatch` — lender conflicts

### Payment History (20+ rules)
- `missing_payment_history` — no payment table
- `derogatory_status_without_monthly_support` — derogatory but no history
- `payment_history_missing_months` — gaps in monthly data
- `payment_history_24_month_past_due_conflict` — 24-month vs past-due mismatch
- `past_due_without_monthly_support` — past-due amount, no delinquent history
- `delinquency_progression_inconsistency` — non-logical escalation
- `severe_delinquency_jump_without_predecessor_support` — 90+ without prior
- `reaging_jump_after_current_reset` — delinquency after current-status reset
- `blank_gap_before_derogatory_month` — blank month(s) before derogatory
- `retroactive_derogatory_backfill_after_reporting_gap` — backfilled after gap
- `charge_off_or_collection_without_monthly_build_up` — no escalation trail
- `balance_reduction_conflicts_with_worsening_delinquency` — balance drops but delinquency worsens
- ...and more (see full catalog in reasonEngine.ts starting line 3847)

### Balance/Amounts (5 rules)
- `high_balance_not_supported_by_history`
- `payment_history_balance_history_conflict`
- `credit_limit_not_supported_by_history`
- `missing_current_balance_field`
- `insufficient_balance_history`

### Public Records (6 non-account rules)
- `public_record_duplicate_reporting` (line 6178)
- `public_record_missing_core_details` (line 6208)
- `public_record_obsolete_reporting` (line 6243)
- `public_record_restricted_or_vacated_context` (line 6273)
- `consumer_information_indicator_missing_core_details` (line 6309)
- `consumer_information_indicator_account_conflict` (line 6347)

## Rule Interface

```typescript
interface AccountRuleDefinition {          // line 402
  issueType: string;                        // Unique ID
  issueLabel: string;                       // User-facing title
  category: DisputeReasonCategory;          // One of 10 categories
  description: string;                      // What it detects
  applies: (account, report) => boolean;    // When to evaluate
  canEvaluate: (account, report) => boolean; // If evidence exists
}
```

## DisputeReason Structure

```typescript
interface DisputeReason {                   // types.ts line 121
  id: string;
  bureau: string;
  component: string;                        // "accounts" | "publicRecords" | etc.
  entityType: DisputeEntityType;
  entityKey: string;                        // Account number or record ID
  issueType: string;                        // Rule type
  issueLabel: string;                       // User-facing title
  reasonSummary: string;                    // 1-2 sentence explanation
  supportingFacts: string[];                // Evidence statements
  supportingFields: string[];               // Field names
  sourcePages: number[];                    // Report page numbers
  requestedAction: string;                  // What to do about it
  severity: "high" | "medium" | "low";
  category: DisputeReasonCategory;
  defaultSelected: boolean;                 // Auto-selected?
  selectionBasis: DisputeSelectionBasis;
  selected: boolean;                        // User's final choice
  evidence?: DisputeReasonEvidence;
  evidenceRefs?: DisputeReasonEvidenceRef[];
}
```

## Evidence Reference System

5 types of evidence references:

| Kind | Meaning | Use Case |
|------|---------|----------|
| `"field"` | Single field value | Account header, status, balance |
| `"history_cell"` | Cell in payment/balance table | "Jan 2023: 30 days late" |
| `"history_gap"` | Missing month in history | Should be there but isn't |
| `"history_latest"` | Latest month in history | Most recent activity |
| `"history_max"` | Maximum value in history | Highest balance |

Each ref includes: `refId`, `kind`, `fieldName`, `label`, `slideId`, `slideLabel`, `year?`, `month?`, `expectedValue?`

## Exported Functions

| Function | Line | Purpose |
|----------|------|---------|
| `generateAccountRuleCatalog(report)` | 7055 | Build interactive rule evaluation UI |
| `generateNonAccountReasons(report, intake)` | 7041 | Public record / personal info reasons |
| `generateDisputeReasons(report, intake, catalog, ...)` | 7126 | Final reasons for letter |

## Account View Building (Multi-Bureau)

```
buildAccountViews(report)  → line 3736
  ├── buildExperianAccountView()      → line 2690
  ├── buildEquifaxNewAccountView()    → line 2827
  ├── buildTransunionAccountView()    → line 2972
  └── buildGenericAccountView()       → line 2374
```

Each normalizes bureau-specific format into `ReasonAccountView` with unified fields, history cells, and analysis.

## Default Selection Logic (line 6508)

```
For legal/public record items:
  → defaultSelected = true if triggered

For account reasons:
  If posture = "negative":
    → selectionBasis = "negative_account"
    → defaultSelected = true if triggered
  If posture = "positive":
    → selectionBasis = "positive_account"
    → defaultSelected = false
```

## Severity & Sort Order

```typescript
severitySortRank = { high: 0, medium: 1, low: 2 }

categoryRank = {
  attorney_escalation: 0,
  payment_history: 1,
  balance_amount: 2,
  charge_off_collection: 3,
  legal_public_record: 4,
  date_reporting_timeline: 5,
  account_identity: 6,
  tradeline_integrity: 7,
  personal_information: 8,
  report_review: 9,
}
```

**Note:** Severity is assigned by category, not by materiality analysis. `legal_public_record` = "high", everything else = "medium". There is no materiality classifier yet.

## Deduplication

- `dedupeEvidenceRefs()` (line 1468) — dedup by `[refId, kind, fieldName, year, month]`
- `compactHistoryMonthKeys()` (line 682) — limit to 6 months (first 3 + last 3)
- `aggregateEvidence()` (line 6533) — merge scalar comparisons by `label:value`, cap monthly at 24

## 6-Step Workflow UI

| Step | Key | Purpose |
|------|-----|---------|
| 1 | `reasons` | View triggered rules, select/deselect, add custom reasons |
| 2 | `intake` | Consumer info (name, SSN, address), bureau recipient, enclosures |
| 3 | `sections` | Edit individual letter sections (opening, disputes, closing, etc.) |
| 4 | `full-letter` | Rich text editor for entire letter (overrides sections) |
| 5 | `evidence` | Generate + review highlighted evidence slides |
| 6 | `preview` | Preview letter + export (DOCX, PDF, highlighted report PDF) |

### Section Types

8 letter sections: `openingRequest`, `reinvestigationRequest`, `accountDisputes` (per account), `personalInformationDisputes`, `recordsRequest`, `responseInstructions`, `closing`, `enclosures`

### Manual Account Reasons

Users can add custom reasons via the workflow:
```typescript
{
  id: `manual-account-reason:${entityKey}:${uuid}`,
  entityKey, category: "payment_history",
  issueLabel: "", reasonSummary: "", selected: true
}
```

## API Layer (api.ts)

| Endpoint | Function | Line | Purpose |
|----------|----------|------|---------|
| `POST /api/dispute-drafts` | `createDisputeLetterDraft()` | 39 | Create draft |
| `GET /api/dispute-drafts/lookup` | `getDisputeLetterDraftByRequestKey()` | 49 | Retrieve by key |
| `PATCH .../sections/{id}` | `updateDisputeLetterSection()` | 58 | Edit section |
| `PATCH .../full-document` | `updateDisputeLetterFullDocument()` | 72 | Replace letter |
| `POST .../render` | `renderDisputeLetterDraft()` | 85 | Generate HTML/DOCX/PDF |
| `POST .../export` | `exportDisputeLetterDraft()` | 95 | Final export |
| `POST .../evidence` | `generateDisputeEvidence()` | 104 | Find evidence on pages |
| `POST .../highlighted-report` | `generateHighlightedReportPdf()` | 113 | Create highlighted PDF |

## Server-Side Letter Builder (disputeLetterBuilder.mjs)

### Clause Library

Pre-written templates with 2-3 variants each:
- `openingRequest` — "I am formally requesting..." / "I am requesting..."
- `reinvestigationRequest` — "I recently accessed..." / "After accessing..."
- `recordsRequest` — bulleted list of what to send post-investigation
- `responseInstructions` — configurable by `responsePreference` (mail_only / mail_and_email)
- `closing` — "Thank you in advance..." / "Thank you for your prompt attention..."
- **3 body templates** for reason paragraphs

### Variant Selection (line 149)

Deterministic: `sha1(seed + ":" + clauseKey)` → index into variant array. Same inputs = same variant.

## Evidence Highlighting (dispute_evidence_generator.py)

### Pipeline

1. Load manifest + draft JSON → map reasonId → reason
2. For each reason's `evidenceRefs`:
   - Locate page by `slideId`
   - Use `kind` (field, history_cell, etc.) to find evidence location
   - OCR/text match to validate
3. Create `DisputeEvidenceSlide`:
   ```python
   { id, pageNumber, label, confidence, pageImageWidth, pageImageHeight,
     cropBox, highlightBoxes: [{ x, y, width, height, label, confidence }] }
   ```
4. Output `DisputeEvidenceManifest` with status per reason

### Drawing (line 57)

```python
draw_highlighted_slide(page_image_path, slide, full_page_output, crop_output)
```

Yellow highlight boxes (RGB 255, 235, 59), 4-pixel stroke width. Saves both full-page and cropped versions.

## Evidence Validation (dispute_highlight_validator.py)

### Status: STUBBED

`VisionValidator.validate_reason()` raises `NotImplementedError`. Two implementations exist but neither is connected:

- `OpenAIVisionValidator` (line 101) — GPT-4 vision
- `OllamaVisionValidator` (line 191) — local Ollama

`ValidationResult`: `{ verdict: "pass"|"review"|"fail", confidence, rationale, problems }`

## Gaps (Legal Hardening Needed)

1. **No materiality classifier** — all rule violations treated equally. No distinction between clearly material (impacts creditworthiness) and immaterial (timing field discrepancy)
2. **No FCRA section citations** — letters say "Fair Credit Reporting Act" generically, never cite § 611, § 613, § 616, § 617
3. **Evidence validator stubbed** — no automated check that highlights match cited fields
4. **No attorney gatekeeping** — auto-generated reasons pre-selected by default, no mandatory lawyer review
5. **No consumer attestation** — letters lack verification statement
6. **Dispute specificity** — some reasons are generic contradiction descriptions, not specific allegations of creditworthiness impact
