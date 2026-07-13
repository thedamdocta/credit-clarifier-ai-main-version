---
title: "Highlight & Dispute-Engine Certification"
aliases: [highlight-certification, certification-protocol]
type: subsystem
status: active
tags: [type/subsystem, topic/disputes, topic/evidence, topic/verification]
created: 2026-07-12
updated: 2026-07-13
related:
  - "[[dispute-generation]]"
  - "[[CREDIT_CLARIFY_DISPUTE_EVIDENCE_MAP]]"
summary: >
  Per-profile certification standard for the dispute-reason engine and evidence
  highlighter, the five gates each profile must pass, current certification status,
  and the tooling that runs it.
---

# Highlight & Dispute-Engine Certification

> **For cold readers:** this doc records which bureau profiles have been verified to the
> Session 21 standard (2026-07-12) and how to re-run that verification. Most likely to be
> stale: the per-profile status table — re-run the tooling rather than trusting it blind.

## The standard — five gates per profile

1. **Detection** — engine produces reasons on every on-disk report; cross-table family
   fires; zero crashes; sampled detections match the report face.
2. **Geometry** — 100% pdfBox on export boxes; 0 duplicate rects; 0 coordinate
   mismatches; off-page boxes explained.
3. **Visual** — every issue TYPE eyeballed at least once on the rendered page, both
   views. Non-negotiable: numeric gates missed three real bugs that eyes caught.
4. **In-program** — server-side generation on ≥1 report; artifacts served over the API.
5. **Sign-off** — this document updated with what was verified, when, on which reports.

**Regression rule:** any change to `reasonEngine.ts`, `dispute_evidence_generator.py`,
or `resultMapper.mjs` re-runs `tools/verification/certify-batch.py` for affected
profiles before the change is considered done.

## Tooling (`tools/verification/`)

- `evidence-harness.py` — draft↔manifest cross-check (coverage / geometry / dups /
  export). Landscape reports (TransUnion!) need `--pdf-width 792 --pdf-height 612`.
- `certify-batch.py <profileId>...` — full gate-1+2 sweep over every distinct on-disk
  report for the profiles. Writes `certification-summary.json`.
- `engine-sweep-one.mjs` + `engine-bundle-entry.ts` — headless engine runner; bundle
  with `node_modules/.bin/esbuild engine-bundle-entry.ts --bundle --format=esm
  --platform=node --alias:@=./src --outfile=<out>/engine.bundle.mjs`.

Full verification narrative: `tmp/diagnostics/highlighter-s21/FINDINGS.md`.

## Certification status (2026-07-12, Session 21)

| Profile | Gate 1 detection | Gate 2 geometry | Gate 3 visual | Gate 4 in-program | Notes |
|---|---|---|---|---|---|
| equifax_old_v1 | ✅ 12/12 reports | ✅ | ✅ 3 consumers | ✅ (twice) | Reference standard |
| experian_acr_v1 | ✅ 12/12 | ✅ 7 current-extraction reports | ✅ canonical (Vera-era) + quality-lift sample | ➖ pipeline profile-agnostic; TU/EX-specific server run pending | 5 reports have stale Mar-11 extractions (predate evidence emission) — system FAILS SAFE on them; re-extract to lift |
| transunion_acr_v1 | ✅ 9/9 | ✅ | ✅ 2 table styles → **`layout:` promoted to export grade** | ➖ same as Experian | Landscape reports need harness page dims; off-page boxes = account headers on prior page (verified legitimate) |
| equifax_new_v1 | ✅ 4/4 (after profile-precise builder routing) | ✅ measured cells (post-enhancement) | ✅ grid cells verified | ➖ | Extraction enhancement (e0ceb0b, additive, twin-run byte parity): eq-new now emits accountHistoryEvidence with per-cell bbox/pdfBBox/provenance. 21 measured boxes on the reference report (was 0). Existing sessions need re-extraction (seconds each, offline) to benefit. |

## Key decisions of record

- **Export grade is a per-box quality property** (`source` + `pdfBox`), not a route
  property. Canonical Experian path unchanged on top.
- **`layout:` (TU column-interpolated) promoted** after visual verification: TU tables
  are evenly columned, matching the interpolation's assumption. Verified on monthly
  block tables + Rating grid, REF-D TU report.
- **Blank/missing information is highlightable evidence** (measured blank cells, gap
  slots, inferred blank value regions) — FCRA incompleteness ground.
- **Gap honesty guard**: months predating a table's printed range are never
  interpolated; coverage-span disputes are a pending NEW rule (operator's presentation
  decision).

## Open items

1. ~~Coverage-span rule~~ DONE (82d2dd0): payment_history_activity_before_table_coverage,
   verified + regression-clean across 40 report-runs.
2. ~~EQ-new cell-geometry emission~~ DONE (e0ceb0b): additive, twin-run byte parity,
   measured cells verified. Roll-out = re-extract existing eq-new sessions (offline, fast).
3. Re-extract the 5 stale Mar-11 Experian sessions through the current pipeline.
4. Vocabulary additions for citation labels (dateOfFirstDelinquency, monthsReviewed,
   comments/remarks) + slide-cap review for dense bundles.
5. Gate-4 server-side run for one TU + one Experian report (pipeline already proven
   profile-agnostically on Equifax).
6. Attorney review pass before machine-generated reasons ship in letters.
7. UI `npm run build` so the served dist/ carries the engine changes.
