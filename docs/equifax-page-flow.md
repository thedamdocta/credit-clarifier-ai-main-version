---
title: Equifax Page Flow — Screen-by-Screen Navigation Guide
aliases:
  - Equifax Flow
  - EQ Page Flow
  - Equifax Navigation
tags:
  - docs
  - acquisition
  - equifax
  - browser-use
  - navigation
created: 2026-03-25
description: "Page-by-page documentation of every screen the acquisition agent encounters during the Equifax credit report pull via AnnualCreditReport.com. Used by both Lumen (Phase 1) and qwen agent (Phase 2) to know what to expect and how to act at each step."
related:
  - "[[acquisition-pipeline]]"
  - "[[application-overview]]"
---

# Equifax Page Flow — Screen-by-Screen Navigation Guide

> **Living doc.** Update this file whenever new screens are discovered or flow changes are observed. This is the agent's map — if the map is wrong, the agent gets lost.

## Critical: Incognito Mode Required

**The browser MUST be launched in incognito/private mode for AnnualCreditReport.com.** Without incognito, certain buttons and navigation elements become unavailable due to the site's unusual behavior with cookies/session state. This applies to all bureaus, not just Equifax.

Launch command: `AGENT_BROWSER_HEADED=true agent-browser open "https://www.annualcreditreport.com" --args "--incognito"`

## Overview

The Equifax report pull flows through two domains:
1. **annualcreditreport.com** — Entry point, bureau selection
2. **my.equifax.com** — Identity verification, OTP, security questions, report delivery

The agent must never drift to **www.equifax.com** (marketing site) — that's the wrong domain entirely.

## Confirmed Page Flow

### Page 1: ACR Homepage
- **URL:** `annualcreditreport.com/index.action`
- **What's here:** "Request your free credit reports" entry point
- **Agent action:** Click through to start the request flow
- **Notes:** Consumer intake info (name, SSN, DOB, address) gets filled in the ACR form pages that follow

### Page 2: Bureau Selection
- **URL:** Still on `annualcreditreport.com`
- **What's here:** Three bureaus listed (Equifax, Experian, TransUnion) with checkboxes
- **Agent action:** Select only Equifax (one-at-a-time strategy). Do NOT select all three — ACR navigates randomly when multiple are selected.
- **Notes:** Current UI hardcodes Equifax selection. When all 3 are solid individually, this becomes configurable.

### Page 3: Equifax Identity Verification
- **URL:** `my.equifax.com/consumer-registration/ACR/#/verify-identity`
- **What's here:** Equifax's identity verification page. Requires phone number and email.
- **Agent action:** Fill phone number and email from consumer intake data. Click "Use this number" (or equivalent confirmation button).
- **Handoff point:** Agent fills the fields → may need user to confirm their own phone number is correct.

### Page 4: OTP Code Entry
- **URL:** `my.equifax.com/consumer-registration/ACR/#/otp-verify-get-pin`
- **What's here:** "Send me a one-time passcode" button, then a code entry field after the code is sent.
- **Agent action (two steps):**
  1. Click "SEND ME A ONE-TIME PASSCODE" button (once — do not double-click)
  2. **HANDOFF TO USER** — Pause and wait for user to enter OTP code they received via text/email
  3. After user provides code, fill the OTP field and submit
- **Critical bugs found here (Session 3):**
  - Bug 2: Three different code paths all try to click the send button
  - Bug 3: `manual_continue` returns success without collecting the actual code
  - Bug 4: `promptForOtpIfVisible` duplicates navigation the state machine already handles

### Page 5: Security Questions
- **URL:** Still on `my.equifax.com` (same SPA, different route)
- **What's here:** Identity verification security questions (e.g., "Which of the following addresses have you lived at?", "Which bank holds your mortgage?")
- **Agent action:** **HANDOFF TO USER** — These are personal knowledge questions only the consumer can answer. Agent must pause and present them to the user.
- **Known issue:** In previous runs, the agent showed the wrong prompt or covered the questions so the user couldn't answer them properly.

### Page 6: Report Ready / Printable View
- **URL:** Still on `my.equifax.com`
- **What's here:** Report is ready for viewing/download. May show a "View Report" or "Print" option.
- **Agent action:** Navigate to printable view, trigger print-to-PDF capture.
- **Notes:** This is the goal state. PDF gets staged into the user's profile for extraction.

## Known Failure Modes

### Wrong Domain Drift
- **Symptom:** Browser navigates to `www.equifax.com` (marketing/public site) instead of staying on `my.equifax.com` (consumer portal)
- **Detection:** URL check — if domain is `www.equifax.com`, stop immediately
- **Recovery:** Navigate back to the ACR flow or restart the bureau pull

### TransUnion Error Page
- **Symptom:** `annualcreditreport.transunion.com/...#/systemError` appears
- **Cause:** Bad input or ACR routing error when multiple bureaus selected
- **Bug:** Agent previously told user to "finish the report" on this error page — incorrect behavior
- **Prevention:** One-at-a-time bureau strategy eliminates this

### SPA Blank Page
- **Symptom:** `my.equifax.com` loads but shows blank content (SPA not hydrated)
- **Detection:** `observeEquifaxPage` already handles this with retry logic
- **Recovery:** Wait and re-check. The SPA eventually hydrates.

## Furthest Confirmed Path

```
ACR Homepage → Bureau Selection (Equifax only) → Verify Identity → Phone/Email → OTP Page
```

Everything after OTP is where it broke. Security questions were detected but handled incorrectly. Report ready / printable view was never reached in recent sessions.

## Phase 1 Goal (browser-use + Lumen)

Prove the complete path end-to-end:
```
ACR → Select Equifax → Verify Identity → Phone/Email → OTP (user handoff) → Security Questions (user handoff) → Report Ready → PDF Capture
```

## Phase 2 Goal (qwen2.5vl:7b autonomous agent)

Same flow, but driven by the vision model reading screenshots instead of Claude. The page flow doc stays the same — only the driver changes.
