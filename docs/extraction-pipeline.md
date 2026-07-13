---
title: Extraction Pipeline — Technical Reference
aliases:
  - Extraction Docs
  - PDF Parsing
  - Python Worker
tags:
  - docs
  - extraction
  - pdf-parsing
  - sacred
created: 2026-03-25
description: "Canonical reference for the credit report extraction pipeline — layout-driven geometry parsing, bureau profiles, OCR fallback, payment history detection. SACRED: 11 months of work, do NOT modify without operator's explicit approval."
related:
  - "[[acquisition-pipeline]]"
  - "[[dispute-generation]]"
  - "[[credit-clarify-gain-equity]]"
---

# Extraction Pipeline — Technical Reference

> **SACRED CODE.** 11 months of work. Do NOT modify without operator's explicit approval and careful discussion. This doc is for understanding, not for planning changes.

> **Living doc.** Update this file whenever extraction code changes (with operator's approval).

## Overview

Layout-driven geometry parsing system that extracts structured data from credit report PDFs. Uses spatial analysis of text bounding boxes rather than regex/text matching.

| File | Lines | Role |
|------|-------|------|
| `python_worker/main.py` | ~7,447 | Core extraction engine |
| `python_worker/equifax_new_profile.py` | — | Equifax new layout helpers |
| `python_worker/experian_profile.py` | — | Experian layout helpers |
| `python_worker/transunion_profile.py` | — | TransUnion layout helpers |
| `python_worker/profiles/*.json` | — | Bureau-specific extraction configs |
| `server/pythonWorker.mjs` | ~87 | Express → Python subprocess |
| `server/resultMapper.mjs` | ~1,266 | Python output → frontend model |

## Architecture

```
PDF Input
    ↓
[1] pdftotext -bbox-layout → XML with text bounding boxes
[2] pdftoppm 300 DPI → page images
[3] OCR fallback (Tesseract) — if text layer < 120 chars/page
    ↓
[4] Layout parsing — XML geometry → blocks → rows → tables
    ↓
[5] Bureau profile → section anchoring → page window selection
    ↓
[6] Account/Collection/Public Record extraction from tables
[7] Payment history cell analysis (OCR + green checkmark detection)
    ↓
[8] Source page attribution
    ↓
JSON output (componentized, with metadata + evidence)
```

## Core Data Structure: PageArtifact

```python
@dataclass
class PageArtifact:         # line 124
    page_number: int         # 1-indexed
    text_layer: str          # Extracted text from PDF
    ocr_text: str            # Tesseract fallback
    fused_text: str          # Combined text_layer + ocr_text
    image_path: str          # Rendered PNG at 300 DPI
    text_quality: float      # len(text_layer) / 1800 (0.0-1.0)
    layout_blocks: List      # XML-parsed text blocks with bbox
    layout_rows: List        # Grouped blocks into rows
    layout_items: List       # Typed items (header/text/table/footer)
    layout_tables: List      # Extracted structured tables
    parse_concerns: List     # Warnings/issues detected
```

## Stage 1: Bbox Layout Extraction

```
load_bbox_layout_pages(xml_path)  → line 864
```

Parses `pdftotext -bbox-layout` XML output. Each page yields blocks with bounding boxes:

```xml
<page width="612" height="792">
  <block bbox="10 20 600 780">
    <line>
      <word xMin="10" yMin="20" xMax="50" yMax="35">TEXT</word>
    </line>
  </block>
</page>
```

## Stage 2: Row Grouping

```
group_blocks_into_rows(blocks)  → line 445
```

**Algorithm:**
1. Sort blocks by (yMin, xMin)
2. For each block, find matching row by **vertical center alignment**
   - Tolerance: `max(4.5, min(height, row["height"]) * 0.85)` points
   - Matches within last 6 rows (spatial locality)
3. Merge into row, update centerY and bbox

**Output per row:**
```python
{
    "rowIndex": int,
    "bbox": {"xMin", "yMin", "xMax", "yMax", "width", "height"},
    "centerY": float,
    "blocks": [...],
    "text": "merged row text",
    "blockCount": int,
    "bigGapCount": int,      # blocks with 24+ point gap
    "numericCount": int,     # blocks containing digits/$/%
}
```

## Stage 3: Table Detection

```
is_table_like_row(row)  → line 606
build_table_from_rows(page_number, table_index, rows, title, heading_trail)  → line 639
```

**Heuristics for table detection:**
- ≥2 cells required
- Month header pattern ("Year Jan Feb...") → always table
- ≥4 blocks → likely table
- Known label score > 0 (e.g., "Account Type", "Date Reported")
- bigGapCount ≥1 + numericCount ≥1 → likely table
- bigGapCount ≥2 → likely table

**Column detection** via `cluster_column_positions()`:
- Collect all block xMin positions
- Cluster within 18 points
- Centroid of each cluster = column position

**Table classification** (line 709):
- `"grid"` — month header detected (payment history)
- `"keyValue"` — 2 or 4 columns (label-value pairs)
- `"table"` — everything else

## Bureau Profile System

**Location:** `python_worker/profiles/{profile_id}.json`

**Supported profiles** (line 62): `equifax_old_v1`, `equifax_new_v1`, `experian_acr_v1`, `transunion_acr_v1`

**Structure:**
```json
{
  "id": "equifax_new_v1",
  "name": "Equifax AnnualCreditReport New Layout",
  "sectionAnchors": {
    "reportConfirmationDetails": ["credit report", "confirmation #"],
    "summary": ["summary", "average account age"],
    "personalInformation": ["personal information"],
    "accounts": ["credit accounts", "payment history", "24 month history"],
    "inquiries": ["company information", "inquiry type"]
  },
  "retrieval": { "includeNeighbors": false },
  "requiredComponents": ["reportConfirmationDetails", "summary", ...]
}
```

### Page Selection via Profiles

```
select_pages_for_component(component_name, page_artifacts, page_tree, keywords)  → line 1367
```

1. Match section anchors (keywords) to PageIndex tree titles
2. Collect candidate pages from matching sections
3. Fallback: scan full fused_text for keywords
4. Fallback: all pages
5. Optional neighbor expansion (prev/next page)
6. Extended window for accounts/inquiries

## Text Layer vs OCR Fusion

```python
if len(text_layer) < 120:           # line 1114 — OCR trigger
    ocr_text = tesseract_ocr(image_path, ocr_out)
fused_text = text_layer + "\n" + ocr_text  # line 1121
```

Tesseract config: `--oem 1 --psm 6` (legacy + neural, single block)

## Payment History Cell Detection

### Green Checkmark Detection

```
detect_green_checkmark(crop)  → line 2025
```

1. Convert to RGB, thumbnail to 96x48 px
2. Scan for green dominance: `green >= 105 AND green >= red+15 AND green >= blue+15`
3. Validate bounding box: min 6 pixels, width/height ≥10%, coverage 0.2%-18%

### OCR Payment History Cell

```
ocr_payment_history_cell(page, crop_box_pdf)  → line 2066
```

Returns `(normalized_value, raw_ocr_text, source)`:
1. Scale PDF bbox to image pixels
2. Crop image → check for green checkmark → return "OK" if found
3. Grayscale + autocontrast + 5x upscale + threshold at 170
4. Tesseract PSM 10 (digits only), whitelist: `0-9A-Z`
5. `normalize_payment_history_code(raw_text)`

### Payment History from Rows

```
payment_history_from_rows_with_evidence(page_artifacts, rows)  → line 2505
```

1. Find month header row (year + 12 months)
2. Extract cell text/bboxes per year row
3. Enrich blank cells with image OCR + checkmark detection
4. Returns: `payment_history[]`, `pseudo_table`, `evidence_rows[]`

## Status Code Normalization

```
normalize_payment_history_code()  → line 1994
```

| Raw | Normalized | Meaning |
|-----|-----------|---------|
| "OK", "0K", "DK", "GK" | "OK" | Payment on time |
| "CO", "CO*" | "CO" | Charge-off |
| "COL", "COLL*" | "COL" | Collection |
| "3", "30" | "30" | 30 days late |
| "6", "60" | "60" | 60 days late |
| "9", "90" | "90" | 90 days late |
| blank | "-" | No data |

## Account Extraction

### Key-Value Pair Extraction

```
key_value_entries_from_row(row)  → line 1711
```

Scans row cells for label-value pairs using `KNOWN_PAIR_LABELS` (line 368). 50+ field mappings in `ACCOUNT_PAIR_FIELD_MAP` (line 314).

### Account Merging

```
merge_account_records(primary, fallback)  → line 1827
```

- Protected fields (blank/explicit_not_reported) keep primary
- History fields: primary wins if meaningful, fallback fills empty
- Merges `_fieldStates` and `_sourcePages` from both

## Evidence Tracking

Each payment history cell captures:
```python
{
    "text": str,          # Normalized code
    "rawText": str,       # OCR output
    "boxes": List[Dict],  # Text block bboxes
    "bbox": Dict,         # Computed cell bbox
    "source": str,        # "layout_row" | "image_crop" | "image_checkmark"
    "state": str,         # "reported" | "blank" | "explicit_not_reported"
}
```

## Express Integration (pythonWorker.mjs)

```
runWorkerExtraction({ session, profile, config, onProgress })  → line 8
```

1. Spawn: `python main.py --session-id --input-pdf --output-json --profile ...`
2. Parse `__PROGRESS__` lines from stdout → `onProgress(payload)`
3. Wait for exit code 0
4. Read output JSON
5. Return `{ workerOutput, logs: { stdout, stderr } }`

## Result Mapping (resultMapper.mjs)

```
mapWorkerResultToCreditReport(workerResult, profileId)  → line 1254
```

Routes by profile:
- `equifax_new_v1` → `mapEquifaxNewResultToCreditReport()` (line 1017)
- `experian_acr_v1` → `mapExperianResultToCreditReport()`
- `transunion_acr_v1` → `mapTransunionResultToCreditReport()`
- default → `mapEquifaxResultToCreditReport()`

Enrichments: `inferAccountSubtype()`, `enrichAccount()` — detect auto lease, child support, medical debt, etc.

## Worker Output JSON Structure

```json
{
  "status": "ok" | "error",
  "profile": "equifax_new_v1",
  "components": {
    "reportConfirmationDetails": { ... },
    "personalInformation": { ... },
    "accounts": { "accounts": [...] },
    "collections": { "collections": [...] },
    "publicRecords": { "records": [...] },
    "inquiries": { "hardInquiries": [...], "softInquiries": [...] }
  },
  "componentStatus": { /* per component */ },
  "meta": {
    "componentSources": { "accounts": { "pages": [1, 2, 3] } },
    "accountSources": [{ "accountName": "...", "pages": [1, 2] }],
    "accountHistoryEvidence": [{ "accountName": "...", "fields": { "paymentHistory": [...] } }]
  }
}
```

## Critical Geometry Thresholds

```python
Row grouping tolerance:    max(4.5, min(height, row["height"]) * 0.85)
Column clustering:         18.0 points
Text quality:              len(text_layer) / 1800.0
OCR trigger:               len(text_layer) < 120
Green checkmark:           green >= 105, coverage 0.2%-18%
```

## Key Constants

- `MONTH_COLUMNS` (line 290): `["year", "jan", "feb", ..., "dec"]`
- `ACCOUNT_PAIR_FIELD_MAP` (line 314): 50+ field label→key mappings
- `COLLECTION_FIELD_MAP` (line 340): 14 collection-specific mappings
- `ACCOUNT_CURRENCY_FIELDS` (line 349): fields requiring currency parsing
- `STATUS_CODES` (line 27): code → human-readable description

## Awareness Notes

> These are observations, NOT action items. Do NOT modify without operator's approval.

- `normalize_account_scalar_value()` defaults blank fields to `"Not reported"` — same string whether report says "Not Reported", cell is blank, or extraction failed
- OCR failures in payment history cells return `"-"` (dash) — no distinction between blank cell and OCR failure
- TypeScript frontend parsers (`accountsParser.ts`, etc.) are regex-based fallbacks — NOT used when Python backend is active
- `verify_extraction.py` checks if values appear SOMEWHERE in PDF, not whether they're in the correct field/cell
