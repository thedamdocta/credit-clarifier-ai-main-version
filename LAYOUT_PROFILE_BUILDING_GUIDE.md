# Layout Profile Building Guide

## Purpose
This document captures the extraction method that proved reliable while building `equifax_old_v1` and `experian_acr_v1`. It is a reference for the current core report families and for future layout variants that will need to be added later.

The goal is not to build a generic parser that "mostly works." The goal is to build profile-specific extraction that is:

- accurate
- source-backed
- fail-closed
- resistant to regression

## Current Scope
The current build is centered on the core bureau/report families we are actively working through now. Additional layouts and bureau variants are expected later.

Important constraint:

- the reference PDFs on disk are useful for discovery, iteration, and regression
- they are not exhaustive
- they do not represent every field, section, disclaimer, table variation, or continuation pattern that can appear in live reports

That means future patches are expected. Those patches must improve coverage without introducing sample-specific logic or regressions.

## Core Lessons Learned

### 1. Each layout is its own profile
Equifax and Experian do not differ only in labels. They differ in:

- section order
- page anchors
- card structure
- table structure
- page-break behavior
- symbol usage
- section continuation rules

A parser that works on one layout is not automatically safe for another. Each layout needs its own explicit profile rules.

### 2. Layout-first parsing works better than prompt-first parsing
The stable extraction path is:

1. render the PDF pages
2. gather positioned text
3. detect section boundaries
4. parse bounded sections deterministically
5. use the local model only when ambiguity remains

The model helps, but it is not the primary structure engine.

### 3. Cross-page continuity is one of the main failure modes
The system must assume that all of the following can continue across pages:

- personal information
- accounts
- collections
- hard inquiries
- soft inquiries
- payment history
- balance histories
- comments
- contact info

Independent page parsing is not sufficient.

### 4. Missing data is still data
Empty cells, `Not reported`, `X`, `ND`, `-`, and blank table cells are legally meaningful. They must not be silently normalized away.

### 5. Source pages must be exact
Broad extraction windows are acceptable internally, but attorney-facing source pages must point only to the real supporting pages for that component or entity.

## Standard Extraction Process For A New Layout

### Phase 1. Understand the layout
Before writing extraction logic:

1. identify the report-native top-level sections
2. identify the repeated entity sections
3. inspect section headings and stop boundaries
4. inspect how tables behave across page breaks
5. inspect how positive and negative symbols are rendered
6. inspect where narrative disclaimers appear so they are not mistaken for extracted values

### Phase 2. Freeze the contract
Before broad implementation:

1. define the JSON contract for each component
2. decide which components are report-native and which are not
3. define fail-closed behavior for missing or unsafe fields
4. define source-page expectations

This prevents UI drift and parser drift.

### Phase 3. Build section parsers one component at a time
The safest order is:

1. top-level overview / confirmation sections
2. personal information
3. entity inventory counts
4. account count accuracy as the first hard gate
5. collection count accuracy if the layout has native collections
6. account or collection details
7. payment-history and other table-heavy sections
8. inquiries
9. source-page attribution

Do not broaden too early. If account inventory is not correct, the rest of the extraction is not trustworthy. Account count accuracy must be treated as the first hard gate for every new layout profile.

### Phase 4. Verify in the browser
Do not trust backend JSON alone. Verify:

- extracted values
- component placement
- tab placement
- section wording
- source report pages
- stale-session behavior

The browser frequently exposes mapping and UI regressions that are not obvious in worker output alone.

## Key Methods That Worked

### Dual ingestion
Use both:

- positioned text from the PDF
- rendered page images

Text is usually best for structure. Images are often required for:

- symbol-heavy payment history
- checkmarks
- hard-to-read table cells
- cases where the text layer is incomplete or misordered

### Heading-bounded parsing
Each repeated entity should be parsed as a set of subsection blocks, for example:

- `Account Info`
- `Payment History`
- `Balance Histories`
- `Additional info`
- `Historical Info`
- `Contact Info`
- `Comment`

This is safer than treating the entire account as a free-form text blob.

### Row-geometry parsing
For many sections, the correct unit is a row with left and right lanes, not a paragraph. This was especially important for:

- account info
- contact info
- personal information
- inquiry cards
- table rows

### Continuation-aware section state
Once a section begins, the parser must keep collecting until the next real section boundary. This is required for multi-page entities and multi-page tables.

### Fail-closed normalization
If a field cannot be proven, it should stay unresolved or `Not reported`. The system must not let:

- labels
- disclaimers
- narrative text
- nearby section copy

leak into extracted fields.

### Source-page attribution after extraction
The system should not assume the extraction window is the final source-page list. Source pages should be narrowed to the actual pages that support the final extracted component or entity.

## Regression Discipline
Every patch must be treated as a possible regression.

That means:

1. keep a regression corpus for each profile
2. rerun the corpus after each meaningful parser change
3. verify both backend output and rendered UI
4. compare component counts and critical fields
5. confirm that source pages are still correct

Without this, one fix will silently break another section.

## Required Regression Checks

For every profile change, check at least:

- component count accuracy
- account count accuracy
- collection count accuracy if the layout has native collections
- hard vs soft inquiry separation
- payment-history row completeness
- payment-history symbol fidelity
- balance-history completeness
- contact info completeness
- comment completeness
- source-page accuracy
- stale UI or mapping regressions

## Rules For Future Patches

### Do not hardcode consumer-specific fixes
Never patch logic using:

- consumer names
- specific creditor names as a special case
- specific addresses from a reference file
- report-number specific behavior

Reference files are for discovery and regression only.

### Patch the layout rule, not the sample
If a sample reveals a failure, the correction should target:

- the section boundary rule
- the row parser
- the table parser
- the continuation rule
- the source-page inference rule

not the sample's literal values.

### Preserve legal evidence
Do not simplify away:

- blanks
- no-data symbols
- not-reported values
- truncated account numbers
- repeated account names with different masked numbers
- contradictions between sections

These are part of the legal value of the extraction.

### Expect incomplete reference coverage
The local corpus will not contain every layout variation. New live reports may introduce:

- new disclaimers
- new subsection labels
- different continuation behavior
- different symbol rendering
- additional address or contact patterns
- new report-native sections

This is normal. The system should be built so those cases can be patched safely.

## Practical Profile-Building Standard

For each new layout profile:

1. identify native sections
2. define exact JSON contracts
3. define section anchors and stop boundaries
4. build deterministic section parsers
5. use image assistance only where needed
6. attach exact source pages
7. verify in the UI with Playwright
8. add the sample to regression coverage

## Model Role
The local model is support infrastructure, not the extraction system itself.

Current operating principle:

- the parser, layout rules, table handling, source attribution, and validation do most of the work
- the local model is used as a fallback for ambiguity, not as the primary source of truth

## Long-Term Direction
As more layouts are added, the system should continue moving toward:

- stronger profile coverage
- stronger regression coverage
- stronger source-evidence binding
- stronger table-cell provenance
- safer patching without layout drift

That is the path to extraction quality that can support attorney review at scale.
