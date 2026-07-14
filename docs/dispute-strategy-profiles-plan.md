---
title: "Dispute Strategy Profiles — Demotion Layer Plan"
aliases: [strategy-profiles, demotion-plan, claim-basis-tagging]
type: plan
status: queued
tags: [type/plan, topic/disputes, topic/strategy, topic/fcra]
created: 2026-07-13
updated: 2026-07-13
related:
  - "[[evidence-exhibit-builder-plan]]"
  - "[[dispute-generation]]"
summary: >
  Queued (operator, Session 23): separate dispute DETECTION from dispute
  STRATEGY. Demoted reason classes stay fully detected but arrive unchecked
  and unhighlighted; a data-driven strategy profile decides defaults. First
  demotions: incomplete-payment family and account-identifier truncation
  (1681g/discovery-dependent classes). Foundation for per-firm strategy and
  the eventual NL dispute-search assistant.
---

# Dispute Strategy Profiles — Demotion Layer

> **Priority: operator-designated "important for the final build."** Queued
> behind Session-23 closure (exhibit crop finalization + history scrub).

## Legal rationale (operator, Session 23)

Case law has split dispute classes by statutory home and provability:

- **§ 1681i / § 1681e(b) material — the go-to disputes.** Facially impossible
  data on the report itself: delinquency sequences like `30, blank, 90,
  blank, CO` (progression requires intermediate steps; a charge-off does not
  materialize from blank months). Self-proving from the document; a bureau
  that "verifies" one has certified an impossibility — strong reinvestigation
  record, forces deletions.
- **§ 1681g material — weak as letter disputes.** "Incomplete" claims
  (missing payment-history months, missing fields): the consumer disclosure
  is a condensed rendering of the file, so incompleteness on the consumer
  copy does not prove the file (or what is furnished to lenders) is wrong.
  Bureaus stamp them "verified"; proof requires ACDV / furnished-data
  discovery in litigation. These are litigation-stage disclosure claims, not
  reinvestigation triggers.

Same reasoning applies to the account-identifier truncation class: available
as a claim, but no ruling changed the face-of-report weakness — demote.

## Mechanism (settled with operator)

**Demotion is a DEFAULT-SELECTION policy, not a detection change.** The
engine keeps detecting everything (detection stays certified; twin-run
discipline unchanged). Demoted classes arrive UNCHECKED by default. Because
highlights, exhibits, memorandum entries, and letter sections all flow from
the selected set, an unchecked reason produces no highlight/exhibit/letter
text automatically — no changes to the evidence or letter layers. Manual
re-check by the attorney restores the full treatment (highlight + exhibit +
memo numbering) for that case.

Design decisions:
1. **Demotion list lives in DATA, not code** — a strategy-profile file
   listing demoted `issueType`s, each with statutory tag (e.g. `1681g`) and
   one-line rationale ("proof requires ACDV discovery; weak as
   reinvestigation dispute"). This file IS the first firm-strategy profile;
   per-firm profiles are later just different files. Case-law shifts become
   data edits, not engine changes.
2. **UI treatment**: demoted reasons visible in the Reasons step — unchecked,
   subdued, rationale shown ("detected-with-reasoning looks like counsel;
   detected-but-silent looks like a bug").
3. **Existing drafts untouched**: defaults apply at draft creation, never
   retroactively to made selections.
4. **v1: demoted-unselected reasons are fully absent downstream** (letter,
   highlights, exhibits, memorandum). A future "discovery candidates"
   appendix for attorneys is an open operator decision.

## v1 scope

Demote (detected, default-unchecked, rationale shown):
- Incomplete-payment family: `missing_payment_history`,
  `payment_history_missing_months`,
  `payment_history_incomplete_since_open_date` (exact list to be confirmed
  against the taxonomy at build time; include remaining "missing months/
  history" variants after review with operator).
- Account-identifier truncation family (`missing_account_number` class —
  confirm exact issueTypes at build time).

NOT in v1: full statutory tagging of all ~60 issueTypes, per-firm profile
UI, discovery-memo track, NL dispute search. Those build on this mechanism.

## Verification plan (same rigor as Session-23 changes)

Detection untouched ⇒ cheap certification:
1. Backup tag before change.
2. Twin-run all sessions: detected reason sets must be IDENTICAL; only
   default-selection sets may differ, and only by the demoted classes.
3. One end-to-end draft: demoted reasons absent from letter/exhibits/memo by
   default; manually re-checked demoted reason flows into letter, highlight,
   exhibit, and memo numbering correctly.
4. 3-agent panel (audit / testing / QC) before close.

## Long-term direction (operator vision, recorded Session 23)

1. Software auto-finds the BEST disputes (scoring: statutory basis,
   provability-from-face, deletion likelihood, litigation value — weighted by
   firm profile).
2. Attorney types a dispute hypothesis; AI maps it to the structured
   extraction, locates instances WITH page/box provenance (certified
   geometry as the hallucination firewall — nothing ungrounded ships), and
   flags strategy fit ("found, but 1681g-class: requires ACDV discovery").
Detection stays deterministic; AI translates and retrieves; strategy is
data. This demotion layer is the seed of that system.
