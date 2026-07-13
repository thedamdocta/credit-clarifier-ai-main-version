---
title: "Evidence Exhibit Builder — Plan"
aliases: [exhibit-builder, evidence-exhibits-plan, memorandum-plan]
type: plan
status: approved-scope
tags: [type/plan, topic/disputes, topic/evidence, topic/letters]
created: 2026-07-13
updated: 2026-07-13
related:
  - "[[highlight-certification]]"
  - "[[dispute-generation]]"
  - "[[CREDIT_CLARIFY_DISPUTE_EVIDENCE_MAP]]"
summary: >
  Approved scope for the evidence packaging layer: per-dispute screenshot exhibits,
  inline-letter vs letter+memorandum output modes, and the numbered full-report —
  three deliverables per case, never either/or. Geometry/rendering already certified;
  this is assembly, persistence, and letter integration.
---

# Evidence Exhibit Builder — Plan

> **For cold readers:** the highlighting/screenshot *accuracy* layer was certified in
> Session 21 ([[highlight-certification]]). This plan covers the missing *packaging*
> layer only. Most likely to be stale: phase status at the bottom.

## The two concepts (operator's ideal)

1. **Whole report highlighted** per the dispute engine's findings — sent as evidence
   with every case.
2. **Per-dispute screenshots** — one or MULTIPLE crops, possibly from different pages,
   compiled per dispute, each clearly shown and stated.

Both are equally important for the same case and must NEVER be an either/or choice.

## Decisions of record (operator, 2026-07-13)

1. **Selection**: the dispute-reason selector shows the screenshot(s) per dispute;
   reasons user-selected OR auto-selected. *(Selection UI + per-reason crops already
   exist in the review flow — verify visibility at selection time, no rebuild.)*
2. **Two letter output modes (user option):**
   - **Mode A — Inline**: highlighted screenshots injected under each dispute reason
     inside the letter document itself.
   - **Mode B — Letter + Memorandum**: clean dispute letter, plus a second document —
     a **Memorandum** describing each dispute, numbered to match the letter exactly,
     carrying the screenshots.
3. **Full highlighted report** is produced alongside EITHER mode, always.
4. **Numbering**: user's choice of `Exhibit 1, 2, 3…` or `Exhibit A, B, C…`.
   An exhibit may contain multiple screenshots.
5. **Scope**: export-grade disputes only (same legal bar as the highlighted report).
6. **Full-report number chips**: yes — each highlight gets a small tag keyed to its
   exhibit number so the bureau maps every mark to its dispute.

## Deliverables per case

| Artifact | Mode A (inline) | Mode B (letter+memo) |
|---|---|---|
| `dispute-letter.pdf/.docx` | with embedded evidence figures under each dispute | clean, with "(See Exhibit N)" references |
| `evidence-memorandum.pdf` | — | numbered mirror of the letter with descriptions + screenshots |
| `highlighted-report.pdf` | always, with exhibit-number chips | always, with exhibit-number chips |

## Architecture (assembly on certified geometry — zero new geometry)

- **Crop renderer (Python, dispute_evidence_generator.py)**: PIL crop of the 300-DPI
  page images + translucent rect draw using the SAME manifest boxes the certified
  views use; feeds both inline-letter figures and the memorandum. PIL + fitz already
  in use there (highlighted-report renderer is the sibling code path).
- **Exhibit numbering map**: derived from the draft's letter sections
  (`sections.accountDisputes[].reasonIds`) so numbers match the letter's dispute
  order; style (`123` / `ABC`) is a parameter.
- **Memorandum generator**: new document assembled in the letter-generator family
  (python-docx / PDF like dispute_letter_generator.py): case header, per-exhibit
  section = exhibit number + dispute statement (issueLabel + reasonSummary +
  requestedAction) + screenshots + "Source: Credit report, page N" citations.
- **Letter builder (disputeLetterBuilder.mjs + dispute_letter_generator.py)**:
  Mode A injects figure blocks under each dispute section (preview HTML + DOCX
  `add_picture` + PDF); Mode B adds "(See Exhibit N)" to each dispute section.
- **Full-report chips**: render_highlighted_report_pdf gains an exhibit-number map;
  draws a small chip at each box (skip identity/context boxes — already excluded).
- **Server**: export endpoint accepts `{letterMode: "inline"|"memorandum",
  exhibitNumbering: "numeric"|"alpha"}`; runEvidenceGeneration writes crops dir +
  memorandum; renderState gains exhibit/memorandum paths; artifacts route serves all
  (it already serves any file in the draft dir).
- **UI**: export step gains the two toggles (letter mode, numbering style) + buttons
  for Memorandum and Highlighted Report next to the letter downloads.

## Phases with verification gates

| # | Work | Gate |
|---|---|---|
| 1 | Crop renderer → persisted per-dispute PNGs (+ exhibit map incl. numbering styles) | render reference draft; eyeball every dispute's crops |
| 2 | Memorandum generator (Mode B document) | letter↔memo numbering agreement; visual read of full memo |
| 3 | Letter Mode A (inline figures) + Mode B refs | preview HTML + PDF + DOCX all carry figures/refs correctly |
| 4 | Full-report exhibit chips | visual on 3+ pages; chips match memo numbers |
| 5 | Server params + renderState + UI toggles | in-program: full flow through the API + UI |
| 6 | Certification addendum: exhibit gate per profile | certify-batch extension over the 4 profiles |

Standing rules: export-grade only; all artifacts live in the draft dir (PII-fenced
from git); dense disputes may exceed the 5-slide cap — lift/paginate for exhibits;
crops at print resolution (300 DPI source images).

## Status

- 2026-07-13: Scope approved by operator (decisions above).
- 2026-07-13: Phase 1 (exhibit renderer + numbering map) DONE — panel-reviewed, 18741e5.
- 2026-07-13: Phase 2 (Memorandum DOCX+PDF) + Phase 4 (report chips) DONE — panel-reviewed
  (QC FAIL on an EXTRACTION-layer data bug, escalated to operator; all builder-layer findings
  fixed and verified), 498877f.
- 2026-07-13 (Session 23): Phase 3 (letter modes) DONE — 7eeb1f1 + panel fixes 9f79658.
  Design record: `tmp/diagnostics/phase3-letter-modes/design.md` (D1-D10). Panel: testing
  PASS 7/7 (alpha E2E, letter↔memo agreement, missing-PNG degradation, traversal,
  concurrency); audit PASS-W-F (all findings fixed incl. HIGH stale-manifest gate); QC
  FAIL→fixed→visually re-verified (per-slide pagination w/ server-side pre-scaled dims,
  heading keep-with-next, orphan-caption suppression). OPEN operator DECISIONS: (1)
  consumer_information_indicator disputes have NO letter section (pre-existing; Exhibit-28
  class warns at export) — add one? (2) must letter exhibits meet the highlighted-report
  validator bar (ties to parked vision-validator activation)? Phases 5 (server/UI toggles —
  chips-numbering F9 already threaded), 6 (certification exhibit gate) pending.
