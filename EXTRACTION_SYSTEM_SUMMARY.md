# Credit Report Extraction System Summary

## Summary

This application has evolved from a prototype into a profile-based credit report extraction system.

It now uses separate layout-aware extraction paths for:

- old Equifax
- new Equifax
- Experian AnnualCreditReport
- TransUnion AnnualCreditReport (landscape)

The system is built around a simple rule:

Extraction must be accurate enough for legal review, which means the system must preserve not only reported values, but also blanks, missing fields, contradictory fields, and exact source pages.

## What We Accomplished

We built a backend-first extraction system that:

- processes reports locally
- uses `gpt-oss:20b` as the local model
- avoids per-report API billing
- supports bureau/layout-specific extraction profiles
- preserves source-page attribution for attorney review
- exposes extracted results in structured UI components

Across the implemented profiles, the system now supports:

- exact account inventory detection
- cross-page section continuation handling
- account contact extraction
- account comments extraction
- payment-history rendering
- closed-account detection
- masked account-number fidelity
- source-report tabs for extracted components
- fail-closed behavior for uncertain fields

## Challenges We Solved

The main problems were not just OCR accuracy. The real challenges were document-structure problems:

1. PDF reading order is unreliable
- Text in the file is often not stored in the order humans read it.
- Adjacent columns, tables, and labels can be interleaved.

2. Credit reports are multi-page entity documents
- One account can span multiple pages.
- One inquiry section can continue across page breaks.
- A collection-like tradeline can appear inside the accounts section instead of a standalone collection section.

3. Tables are not real tables
- Payment history, 24-month history, summary blocks, and inquiry grids are often just positioned text and lines.
- Standard OCR extracts text, but does not reconstruct the real cell structure reliably enough for legal use.

4. Blanks are evidence
- Empty cells, `Not reported`, `X`, `-`, and explicit values are not interchangeable.
- In legal review, what is missing can matter as much as what is present.

5. Weak print quality matters
- Green checkmarks, tiny delinquency codes, faint symbols, and cell-level marks can be difficult to recover even when the report itself is readable to a person.

## Why Traditional PDF OCR Cannot Work Alone

Traditional OCR is useful, but it is not sufficient for this application by itself.

OCR can:

- recover words from images
- help when the PDF text layer is broken
- act as a fallback on small regions

OCR alone cannot reliably do the following:

- reconstruct table cells correctly
- preserve month-by-month structure in payment histories
- stitch one account across multiple pages
- distinguish blank evidence from lost extraction
- maintain exact source traceability for legal review
- understand bureau-specific layout differences

For this use case, OCR is one layer in the pipeline, not the pipeline itself.

## What LlamaIndex Identified

LlamaIndex’s PDF write-up correctly identifies the core document problem:

- PDFs are drawing instructions, not semantic documents.
- Reading order is heuristic.
- Tables are rarely encoded as real tables.
- Pure text extraction is not enough.
- Pure vision-model parsing is also not enough on its own.

Their conclusion is that the right approach is a hybrid system:

- text extraction
- layout detection
- visual analysis where needed
- structured output with metadata

That aligns closely with what we discovered while building this application.

Reference:

- [Why Reading PDFs is Hard](https://www.llamaindex.ai/blog/why-reading-pdfs-is-hard?utm_source=xjl&utm_medium=social)

## Where LlamaParse Helped

LlamaParse was useful as a benchmark because it showed the value of a stronger middle layer:

- page items
- layout segmentation
- table objects
- image metadata
- parse concerns

This helped confirm that the right path was not “more OCR,” but a better artifact layer between raw PDF ingestion and final extraction.

## Where LlamaParse Fell Short For Our Edge Cases

For this application, generic parsing is not enough.

The key gaps for credit-report extraction are:

1. Cross-page entity stitching
- A parser may understand a page but still fail to keep one account together across several pages.

2. Legal evidence preservation
- A field being blank, missing, or contradictory is legally meaningful.
- Generic parsing does not automatically preserve those states correctly.

3. Bureau/layout-specific meaning
- The same kind of field appears differently in old Equifax, new Equifax, Experian, and TransUnion.
- Collections can be standalone sections in one layout and account tradelines in another.

4. Attorney-facing traceability
- We need extracted values tied back to the correct source pages and, eventually, source regions.

5. Fail-closed validation
- A generic parser may return something plausible.
- This system must withhold unsafe values rather than guess.

So LlamaParse was useful for understanding the hybrid parsing problem, but it was not enough by itself for this credit-report product.

## What Makes This System Stronger

This system is stronger for this use case because it combines:

- bureau-specific profiles
- layout-aware parsing
- dual ingestion
- section-bounded extraction
- cross-page stitching
- local-model fallback only where needed
- source-page attribution
- fail-closed validation

That is materially different from:

- raw OCR-only extraction
- one large model prompt over the entire report
- screenshot-every-page parsing without structured reconstruction
- generic document-parsing systems with no bureau-specific logic

## Current Architecture Direction

The working architecture is:

1. Ingest the PDF
2. Render page images
3. Extract positioned text
4. Build section windows from layout anchors
5. Parse by component or entity
6. Stitch cross-page fragments
7. Validate against profile-specific rules
8. Map into UI components
9. Show source pages for attorney review

This is the main architectural shift:

We are no longer trying to generically “read PDFs.”
We are building evidence-grade extraction systems for specific credit report layouts.

## Why This Matters Going Forward

This changes the product direction in a meaningful way.

It means the system can become:

- local and private
- cheaper to operate
- auditable
- safer for legal workflows
- extensible to more layouts

It also creates the right foundation for future work:

- more bureau/layout profiles
- contradiction analysis across sections
- legal violation spotting
- source-linked attorney review
- stronger regression testing as more examples are added

## Important Constraint

The current reference set is strong enough to build architecture and fix major edge cases, but it is not exhaustive.

That means:

- more examples are still required
- new edge cases will continue to appear
- fixes must remain layout-driven
- regression discipline is mandatory

No parser logic should be built around:

- consumer names
- creditor names
- exact account numbers
- one-off sample wording

Instead, fixes must always be based on:

- report-native headings
- table headers
- layout geometry
- continuation behavior
- profile-specific validation rules

## Bottom Line

The biggest lesson from building this application is:

The model is not the system.

The system is:

- ingestion
- layout reconstruction
- section detection
- entity stitching
- table extraction
- evidence preservation
- validation
- source review

That is the reason the application is now much stronger than it was at the start, and it is the reason additional bureau/layout support is now practical.
