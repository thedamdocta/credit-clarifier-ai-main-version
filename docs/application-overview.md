---
title: Application Overview — End-to-End Flow
aliases:
  - App Overview
  - Full Pipeline
  - How It Works
tags:
  - docs
  - overview
  - fcra
  - pipeline
created: 2026-03-25
description: "The canonical reference for how the entire Credit Clarify application works end-to-end — from pulling reports to mailing disputes. Every future agent reads this first to understand the full picture."
related:
  - "[[acquisition-pipeline]]"
  - "[[extraction-pipeline]]"
  - "[[dispute-generation]]"
  - "[[mailer-pipeline]]"
  - "[[credit-clarify-gain-equity]]"
---

# Application Overview — End-to-End Flow

> **Living doc.** Update this file whenever the pipeline changes. Every agent reads this first.

## What This Application Does

This is a **legal process pipeline** for consumer law attorneys. It automates the mechanical steps that precede FCRA/FDCPA litigation — acquiring credit reports, extracting data with 100% accuracy, identifying material inaccuracies, generating CFPB-standard dispute letters with highlighted evidence, and mailing everything to the bureaus.

The tool does NOT practice law. It creates the conditions. The bureaus either do their job or they don't. If they don't, the paper trail we built is what makes the attorney's case.

## The 7 Steps

### 1. ACQUIRE — Pull reports from AnnualCreditReport.com

- Consumer enters intake info (name, SSN, DOB, address)
- Gives interactive retrieval consent
- App launches isolated browser session via the acquisition agent
- Agent navigates ACR, fills the request form, selects all 3 bureaus
- Per-bureau flows handle identity verification (OTP, security questions) with user in the loop for their own credentials
- 3 PDFs (Equifax, Experian, TransUnion) get staged into the user's profile
- Consumer approves the staged reports before anything else happens

> **Source constraint:** Only reports from AnnualCreditReport.com or directly from bureaus carry cause of action. Third-party services (Credit Karma, etc.) do NOT qualify.

**Reference:** [[acquisition-pipeline]]

### 2. EXTRACT — Parse every data point with 100% accuracy

- Each bureau report is extracted separately (not merged, not compared)
- Python worker runs layout-driven geometry parsing against bureau-specific profiles
- Output: structured data per bureau — accounts, collections, public records, inquiries, personal info, payment histories
- User reviews each bureau in its own tab (Experian / Equifax / TransUnion)

> **Accuracy is non-negotiable.** Every data point must be exactly what's on the report. No approximations, no best-guesses. Legal weight depends on this.

**Reference:** [[extraction-pipeline]]

### 3. ANALYZE — Identify material inaccuracies

- Reason engine evaluates 45+ rules across 10 categories per account
- Flags payment history conflicts, balance inconsistencies, missing fields, derogatory patterns, public record issues, identity mismatches
- User selects which triggered rules to dispute (negatives auto-selected, positives opt-in)
- Can add custom reasons manually

> **Materiality matters.** Only inaccuracies that impact creditworthiness are legally actionable — not all contradictions matter.

**Reference:** [[dispute-generation]]

### 4. HIGHLIGHT — Mark evidence on original report pages

- Evidence generator draws yellow bounding boxes on the original report PDF pages
- Each box ties to a specific dispute reason and field
- This highlighted report IS the evidence — it proves "here is what YOUR report says, here is why it's wrong"
- Without it, the bureau can claim the dispute was not sufficiently specific

**Reference:** [[dispute-generation#Evidence Highlighting]]

### 5. GENERATE — Build CFPB-standard dispute letter

- Letter assembled from clause library with deterministic variant selection
- Sections: opening, reinvestigation request, per-account disputes, records request, response instructions, closing, enclosures
- User can edit sections or override the full document
- Export: DOCX + PDF + highlighted report PDF

> **CFPB compliance is required.** Non-compliant letters can be dismissed by bureaus.

**Reference:** [[dispute-generation#6-Step Workflow UI]]

### 6. SEND — Mail everything to bureaus

- Package per bureau: dispute letter + highlighted report + uploaded ID documents (photo ID, proof of address)
- Sent via certified mail with return receipt (likely Lob.com or similar API)
- Tracking number feeds back into the app
- Certified mail creates legal proof of delivery
- Starts the bureau's 30-day reinvestigation clock under FCRA § 611

**Reference:** [[mailer-pipeline]]

### 7. TRACK — Monitor delivery and response window

- Tracking numbers from certified mail feed back into the app
- System monitors when each letter arrives at each CRA
- Starts the 30-day reinvestigation clock per CRA (FCRA § 611, extendable to 45 days)
- Response period countdown visible to consumer/company
- **Not yet built** — see [[product-vision]]

### 8. RESPOND — Receive and upload CRA responses

- Consumer/company uploads CRA response letters (verified mail from bureaus)
- System records what each bureau decided: corrected, deleted, verified, or no response
- **Not yet built**

### 9. COMPARE — Re-pull and diff reports month-over-month

- Consumer re-pulls fresh reports from ACR the month after disputes were sent
- System runs extraction on new reports (same pipeline, untouched)
- Compares Month 1 extraction results against Month 2 extraction results per account
- Confirms which disputed items were modified, deleted, verified, or unchanged
- **Not yet built**

### 10. RESOLVE — Generate resolution report

- Summary of what changed and what didn't across all 3 bureaus
- Next steps: re-dispute unchanged items, escalate to CFPB, attorney referral
- If bureaus failed to reinvestigate or correct → paper trail gives attorney private cause of action under FCRA § 616/617
- **Not yet built** — see [[product-vision]]

## Architecture: Acquisition Service + Processing Pipeline

> **Core principle: Build on top of extraction. Never modify how it extracts.**

See [[product-vision#Core Architectural Principle]] for the full diagram. The acquisition service (browser automation → 3 PDFs) is separate from the processing pipeline (extraction → disputes → mailing → tracking). The PDF is the boundary.

The extraction engine already processes each bureau's PDF individually. What needs building is the **orchestration wrapper** that links 3 extraction sessions together, aggregates results into a unified client view, and enables cross-bureau analysis and dispute packaging.

## Scaling Path

1. **Now:** Finishing acquisition flows — EQ and TU working, EX needs fresh client test
2. **Next:** 3-bureau orchestration — all 3 PDFs from one ACR pull fed through extraction as a connected set
3. **Then:** Full lifecycle — mailing, tracking, comparison, resolution
4. **Eventually:** Consumer-grade SaaS + Business-grade CRM — see [[product-vision]]

## Current State

| Step | Status | Notes |
|------|--------|-------|
| 1. ACQUIRE | EQ+TU working, EX needs fresh client | Active build focus — Phase 2 autonomous agent in planning |
| 2. EXTRACT | Mature (11 months, sacred) | Do NOT modify without operator's explicit approval |
| 3. ANALYZE | Built, needs legal hardening | No materiality classifier yet |
| 4. HIGHLIGHT | Built, needs improvement | Evidence validator stubbed (`NotImplementedError`) |
| 5. GENERATE | Built, needs legal hardening | No FCRA section citations, no attorney gatekeeping |
| 6. SEND | Planned, not built | See [[mailer-pipeline]] |
| 7. TRACK | Not built | Delivery tracking + response window countdown |
| 8. RESPOND | Not built | CRA response upload + recording |
| 9. COMPARE | Not built | Month-over-month report diff (re-pull → re-extract → compare) |
| 10. RESOLVE | Not built | Resolution report + next steps |

## Why This Matters

- **FCRA § 611:** Bureau must reinvestigate within 30 days of receiving a dispute
- **FCRA § 616/617:** Private cause of action when bureaus fail to correct/delete after dispute
- **FDCPA:** Additional cause of action for collection-related items
- **The tool's legal position:** We create the conditions. The bureaus either do their job or they don't. If they don't, the paper trail we built is what makes the attorney's case. We don't generate the cause of action — the bureaus' failure to act does.
