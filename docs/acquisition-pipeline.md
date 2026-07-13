---
title: Acquisition Pipeline — Technical Reference
aliases:
  - Acquisition Docs
  - Report Pulling
  - ACR Agent
tags:
  - docs
  - acquisition
  - browser-automation
  - credit-report
created: 2026-03-25
description: "Canonical reference for the credit report acquisition pipeline — browser automation agent, session store, and React UI. Covers full Equifax state machine, semi-automated TU/EX flows, recovery system, and Chrome extension integration."
related:
  - "[[extraction-pipeline]]"
  - "[[dispute-generation]]"
  - "[[credit-clarify-gain-equity]]"
---

# Acquisition Pipeline — Technical Reference

> **Living doc.** Update this file whenever acquisition code changes.

## Overview

The acquisition pipeline retrieves annual credit reports from AnnualCreditReport.com via browser automation. Three files make up the system:

| File | Lines | Role |
|------|-------|------|
| `server/creditReportAcquisitionAgent.mjs` | ~4,323 | Browser automation agent |
| `server/creditReportAcquisitionStore.mjs` | ~903 | Session lifecycle & state |
| `src/pages/AcquireReportsPage.tsx` | ~1,320 | React UI |

**Stack:** Playwright (browser), Chrome extension (overlay UI), Ollama (vision/reasoning recovery), Express (API)

## Entry Point

```
runAnnualCreditReportAcquisition({ session, store, input })  → line 4198
```

**Flow:**
1. Load Playwright → launch persistent Chrome context with extension
2. Navigate to annualcreditreport.com
3. Wait for controller ready signal (user clicks "Get Started")
4. `fillRequestForm()` → SSN, name, address, DOB (line 3986)
5. `selectAllReports()` → check bureau boxes (line 4115)
6. `runPendingBureauFlows()` → dispatch per-bureau handlers (line 3489)

## Bureau Dispatch

```
runPendingBureauFlows()  → line 3489
  Max 6 dispatch passes. Each pass:
  1. getRemainingBureauKeys() → which bureaus haven't been downloaded
  2. openNextBureauIfNeeded() → navigate back to ACR if needed
  3. inferBureauFromUrl() → detect which bureau page we're on
  4. Call handler: completeTransUnion / completeEquifax / completeExperian
  5. Check if report saved → if stopAfterFirstSavedReport, return
```

**Flow handlers map** (line 3510):
```javascript
const flowHandlers = {
  transunion: completeTransUnion,   // SEMI-AUTOMATED
  equifax: completeEquifax,         // FULLY AUTOMATED
  experian: completeExperian,       // SEMI-AUTOMATED
};
```

## Equifax State Machine (Fully Automated)

```
completeEquifax()  → line 3652
```

10-pass observation loop. Each pass:

1. **Observe** → `observeEquifaxPage()` (line 1457)
   - `capturePageObservation()` → screenshot + headings/buttons/fields/radios
   - `classifyEquifaxPage()` → 10+ page types with confidence scores (line 1095)
   - Refine with `extractEquifaxSecurityQuestionnaire()` if applicable

2. **Act** based on `pageType`:

| Page Type | Action | Line |
|-----------|--------|------|
| `equifax_contact` | Prompt for phone/email, click "SEND ME ONE-TIME PASSCODE" | 3708 |
| `equifax_send_code` | Click "YES, SEND ME A TEXT" | 3765 |
| `equifax_enter_code` | Prompt for OTP, fill field, click verify | 3803 |
| `equifax_security_questions` | Prompt for questionnaire answers, auto-fill | 3827 |
| `equifax_report_ready` / `equifax_print_entry` | Open print flow | 3851 |
| `equifax_printable_view` | Save PDF → `ensureReportSaved()` | 3876 |
| `wrong_public_page` / `bureau_error_page` / `unexpected_screen` | Fail with error | 3897 |

### Page Classification (line 1095)

`classifyEquifaxPage(observation)` returns `{ pageType, confidence, matchedSignals, terminal }`.

Signal-based classification using URL patterns, visible headings, field labels, and button text. 40+ classifiers with confidence scores (0.15–0.99). Examples:
- `/otp-verify-get-pin` + OTP field → `equifax_enter_code` (0.98)
- `/verify-identity` + phone + email → `equifax_contact` (0.98)
- Report-ready copy anywhere → `equifax_report_ready` (0.78)
- `.pdf` in URL → `equifax_printable_view` (0.75)

## TransUnion Flow (Semi-Automated)

```
completeTransUnion()  → line 3574
```

1. Guard checks: unexpected public page, system error
2. `promptForContactConfirmationIfVisible()` → phone/email
3. Click sequence: "I ACCEPT & CONTINUE", "AGREE AND SEND PASSCODE", "CONTINUE"
4. Retry contact if needed
5. `promptForOtpIfVisible()` → OTP code
6. `promptForSecurityQuestionsIfVisible()` → user answers in browser
7. **Manual handoff** → `promptToContinueInBrowser()` — user finishes remaining steps
8. `preparePrintableReport()` → `ensureReportSaved()` in **landscape** mode
9. Return to ACR if more bureaus needed

## Experian Flow (Semi-Automated)

```
completeExperian()  → line 3910
```

Similar to TransUnion. Clicks "CONTINUE", "VERIFY MY IDENTITY", "Text Me". Same manual handoff pattern.

## User Handoff / Prompt System

When the agent needs user input:

```javascript
store.requestPrompt(session, {
  type,        // "manual_continue" | "otp_code" | "contact_confirm" | "security_question" | "security_questionnaire"
  inputType,   // "confirm" | "text" | "select" | "radio"
  title, description, placeholder, defaultValue, submitLabel,
  choices, questions,
  bureau, contextUrl
})
```

This sets `session.status = "waiting_for_user"` and returns a Promise that resolves when `respondToPrompt()` is called.

**UI polling** (every 1500ms) detects `session.pendingPrompt` and shows the appropriate dialog.

### Prompt Types

| Type | Input | Use Case |
|------|-------|----------|
| `contact_confirm` | text (phone) | Phone/email verification |
| `otp_code` | text | One-time passcode |
| `security_question` | confirm | User answers visible questions in browser |
| `security_questionnaire` | text (JSON) | Equifax auto-fill questionnaire |
| `manual_continue` | confirm | Agent paused, user resumes |

## Recovery System

When `attemptClickTextsWithRecovery()` fails:

```
runRecoveryLoop()  → line 2063
  1. captureRecoverySnapshot() → screenshot + visible text
  2. analyzeRecoveryWithVision() → Ollama vision model analyzes screenshot
     Returns: screenSummary, candidateLabels, suggestedAction, confidence
  3. chooseRecoveryAction() → Ollama reasoning model picks action
  4. Execute:
     - "wait" → 1500ms pause
     - "scroll" → window.scrollBy() 60% viewport
     - "retry_alternate_locator" → try alternative button texts
     - "click_candidate" → try vision-suggested labels
     - "ask_takeover" → open manual_continue prompt
```

**Fallback:** If retryCount >= 2 and models fail, forces user takeover.

## Report Capture

```
ensureReportSaved()  → line 3337
  1. page.pdf() with landscape option if needed
  2. Save to session.reportsDir as CreditReport-{Bureau}-{UUID}.pdf
  3. store.addDownloadedReport({ bureau, fileName, filePath, sizeBytes, ... })
```

## Session Store

**`CreditReportAcquisitionStore`** (line 109)

### Session Lifecycle

```
createSession(input)     → line 121  | Status: "created"
  ├→ id: UUID
  ├→ workspaceDir: rootDir/id
  ├→ reportsDir: workspaceDir/reports
  ├→ status: "created" → "running" → "waiting_for_user" → "completed" | "failed"
  ├→ progress: { progress: 0-100, stage: "..." }
  ├→ downloadedReports: []
  ├→ pendingPrompt: null
  └→ controller: { channel: "browser_gate", status: "booting", ready: false }

setProgress(session, update)     → line 528  | Clamps 0-100, updates all state fields
setCompleted(session, stage)     → line 755  | Status → "completed", progress → 100
setFailed(session, errorMessage) → line 773  | Status → "failed"
deleteSession(id)                → line 787  | Kill browser, cleanup files
```

### Chrome Extension Sync

```
queueOverlaySync(session)  → line 198
  1. Resolve extension service worker
  2. Compute signature hash of key session fields
  3. If changed:
     - Set chrome.storage.local with bridge state + session cache
     - Dispatch CustomEvent "agentic-browser:session-sync" on active page
```

### Debug Logging

```
workspace/
  {sessionId}/
    reports/              ← Downloaded PDFs
    page-observations/    ← Screenshots from observation loop
  _debug/
    {sessionId}.jsonl     ← All logs, debug events, activities
```

## React UI (AcquireReportsPage.tsx)

### Key State

| Variable | Purpose |
|----------|---------|
| `formState` | User intake form (SSN, name, address, DOB, email, phone) |
| `session` | Active acquisition session from API |
| `promptValue` | Current prompt text input |
| `importState` | PDF extraction progress |
| `launchConsentOpen` | Consent dialog visibility |

### Data Flow

1. User fills intake form → `formState`
2. Clicks "Get Started" → consent dialog → `handleLaunchConsentConfirm()`
3. `handleStartSession()` → `startAcquisitionSession` API
4. Polling effect: `getAcquisitionSessionStatus` every 1500ms
5. Agent requests prompt → `session.pendingPrompt` → dialog appears
6. User responds → `handlePromptSubmit()` → `respondToAcquisitionPrompt`
7. Reports download → effect syncs to `userProfileReports`
8. User clicks extract → `handleApproveExtraction()` → PDF processing
9. Extract complete → "Open Report" → navigates to `/report`

### Hardcoded Constraints (Current)

```javascript
targetBureau: "equifax"             // line 354 — EQUIFAX ONLY
stopAfterFirstSavedReport: true     // line 355 — STOPS AFTER FIRST
```

## Form Filling Utilities

| Function | Line | Purpose |
|----------|------|---------|
| `maybeFillField(page, matchers, value)` | 302 | Fill input by label/placeholder pattern |
| `maybeSelectOption(page, matchers, value)` | 390 | Select dropdown option |
| `maybeCheckLabel(page, matcher, checked)` | 470 | Check/uncheck checkbox or radio |
| `maybeClickByText(page, value)` | 497 | Click button/link by text |
| `maybeFillOtpField(page, value)` | 645 | Fill OTP code input |
| `fillContactVerificationFields(page, {phone, email})` | 661 | Fill phone + email |
| `fillRequestForm(session, store, input)` | 3986 | Fill entire ACR request form |

## Error Detection

| Function | Line | Purpose |
|----------|------|---------|
| `isBureauSystemErrorPage(page, bureau)` | 154 | Detect error pages by URL + text |
| `isUnexpectedPublicBureauPage(bureau, url)` | 76 | Guard against drifting to public bureau sites |
| `isSessionExpiredPage(page)` | 2471 | Detect expired ACR session |

## What's Missing (Future Work)

1. **TransUnion/Experian full automation** — need state machines like Equifax
2. **Multi-bureau UI** — remove hardcoded `targetBureau: "equifax"`
3. **Multi-report runs** — remove `stopAfterFirstSavedReport: true`
4. **Chain-of-custody audit trail** — no tamper-proof link from timestamp → source → consumer
5. **PDF validation** — no check that downloaded file is a valid credit report
6. **Session persistence** — in-memory only, lost on server restart
7. **Rate-limit handling** — if ACR returns 429, session dies
