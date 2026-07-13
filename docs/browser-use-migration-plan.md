---
title: "Browser-Use Migration Plan — Acquisition Agent"
aliases: [browser-use-migration, phase-plan, acquisition-migration]
type: research
status: draft
tags: [type/research, topic/acquisition, topic/browser-use, topic/migration]
created: 2026-03-25
updated: 2026-03-25
related:
  - "[[acquisition-pipeline]]"
  - "[[equifax-page-flow]]"
  - "[[consumer-app-phase-1-2-plan]]"
  - "[[application-overview]]"
summary: >
  Three-phase plan to replace the 4,300-line blind Playwright acquisition agent with browser-use visual automation. Phase 1: Lumen proves Equifax flow. Phase 2: qwen2.5vl:7b autonomous agent. Phase 3: TransUnion and Experian.
---

# Browser-Use Migration Plan — Acquisition Agent

## Why We're Migrating

The current acquisition agent (`creditReportAcquisitionAgent.mjs`, 4,300 lines) uses blind Playwright selectors — it pattern-matches labels and text without ever seeing the page. This creates fundamental fragility:

- When Equifax changes any UI element, it breaks silently
- The agent can't distinguish between similar-looking pages
- OTP handoff bugs stem from the agent not understanding page state
- 5 specific bugs identified in Session 3, all rooted in the agent's inability to see

**browser-use solves the perception problem** — visual understanding means the agent can adapt to UI changes, detect unexpected states, and make contextual decisions like a human would.

## The Three Phases

### Phase 1: Lumen Proves the Flow (Claude + browser-use)

**Goal:** Demonstrate that browser-use can navigate the complete Equifax flow end-to-end, from ACR homepage through to PDF capture.

**How it works:**
1. Lumen (Claude) drives the browser using `agent-browser` commands
2. Run in **headed mode** (`AGENT_BROWSER_HEADED=true`) so operator can see and assist with handoffs
3. Navigate each page of the Equifax flow as documented in [[equifax-page-flow]]
4. At handoff points (OTP code entry, security questions), operator provides input
5. Document every decision: what was seen, what was clicked, why, what happened

**What Phase 1 produces:**
- **A decision map** — a complete record of every page encountered, what visual cues identified each page, what actions were taken, and what transitions resulted
- **Handoff protocol** — exactly when and how to pause for human input (OTP, security questions)
- **Failure recovery patterns** — what wrong-page states look like and how to recover
- **Field identification patterns** — how each form field appears visually and how to fill it
- **Timing/wait patterns** — how long SPAs take to render, when to re-snapshot

This decision map is the critical Phase 1→2 bridge. It transforms "a human figured it out" into "here's the logic tree an autonomous agent needs."

### Phase 2: qwen2.5vl:7b Autonomous Agent

**Goal:** Program a server-side agent that uses qwen2.5vl:7b (local Ollama vision model) to replicate what Lumen did in Phase 1 — autonomously, without Claude.

**How it works:**
1. Take the decision map from Phase 1
2. Encode each decision point as a vision prompt: "Given this screenshot, what page are you on? What should you do?"
3. qwen2.5vl:7b analyzes screenshots and returns structured decisions
4. The agent code translates decisions into browser actions
5. Handoff points still pause for human input (OTP, security questions are inherently human steps)

**Why qwen2.5vl:7b:**
- Free — runs locally via Ollama, no API costs
- Already downloaded (6GB, verified)
- 7B parameters — small enough for real-time inference on operator's machine
- Vision capable — can analyze screenshots and understand page layouts

**What Phase 2 produces:**
- A standalone agent that can navigate Equifax autonomously
- Server-side code (replaces the relevant portions of `creditReportAcquisitionAgent.mjs`)
- Vision prompt templates for each page type
- Confidence thresholds for when to proceed vs. pause for human review

### Phase 3: TransUnion and Experian

**Goal:** Apply the same browser-use → autonomous agent pattern to TransUnion and Experian flows.

**How it works:**
1. Run Phase 1 again for each bureau — Lumen navigates their verification flows
2. Each bureau has different pages, different form fields, different verification methods
3. The decision map structure is the same; the content differs per bureau
4. Encode each bureau's decision map into qwen vision prompts
5. Result: three bureau-specific agents sharing the same architecture

**What's different per bureau:**
- **Equifax:** OTP + security questions (most complex flow)
- **TransUnion:** Different verification method (TBD — currently semi-automated with manual handoff)
- **Experian:** Different verification method (TBD — currently semi-automated with manual handoff)

**The architecture is the same:** screenshot → vision model → page classification → action → re-screenshot. Only the page definitions and action maps change.

## Phase Dependencies

```
Phase 1 (Lumen + browser-use)
    │
    ├── OUTPUT: Decision map, handoff protocol, failure patterns
    │
    ▼
Phase 2 (qwen2.5vl:7b autonomous agent)
    │
    ├── INPUT: Decision map from Phase 1
    ├── OUTPUT: Standalone Equifax agent + vision prompt templates
    │
    ▼
Phase 3 (TU + EX)
    │
    ├── INPUT: Architecture from Phase 2 + new Phase 1 runs for each bureau
    └── OUTPUT: Three-bureau autonomous acquisition
```

## Current Status

- **Phase 1:** Ready to start. Server running (:8787/:8080). [[equifax-page-flow]] documented. browser-use installed. Headed mode confirmed.
- **Phase 2:** Blocked on Phase 1. qwen2.5vl:7b downloaded and verified (6GB).
- **Phase 3:** Blocked on Phase 2. TU/EX page flows not yet documented.

## Critical: Incognito Mode Required

**AnnualCreditReport.com MUST be opened in incognito mode.** Without it, certain buttons and navigation elements become unavailable due to the site's unusual cookie/session behavior. This is a hard requirement — do NOT use a persistent browser profile for ACR navigation.

Launch command: `AGENT_BROWSER_HEADED=true agent-browser open "https://www.annualcreditreport.com" --args "--incognito" --args "--start-maximized"`

**Do NOT** use `agent-browser set viewport` after launch — it causes the page to glitch and shift right. `--start-maximized` handles sizing on its own.

## Pre-Flight Checklist (Phase 1)

- [x] App server running (API :8787, Vite :8080)
- [x] browser-use skill installed globally
- [x] Equifax page flow documented ([[equifax-page-flow]])
- [x] qwen2.5vl:7b downloaded for Phase 2
- [x] Headed mode requirement documented
- [x] Incognito mode requirement documented
- [ ] Study acquisition agent code for field/button details at each Equifax page
- [ ] operator available to provide OTP code and security question answers
- [ ] Run live browser-use Equifax flow with operator watching

## Known Bugs to Fix (Regardless of Migration)

These bugs exist in the current agent and affect the session infrastructure used by both old and new approaches:

1. **Session-sync deadlock (CRITICAL)** — `requestPrompt()` deferred promise blocks session status endpoint. Must fix in `creditReportAcquisitionStore.mjs`.
2. **Double send-code clicking** — Both `equifax_contact` and `equifax_send_code` states click "SEND ME A ONE-TIME PASSCODE"
3. **manual_continue returns true without OTP** — State machine thinks OTP was handled when it wasn't
4. **Duplicated send-code logic** — `promptForOtpIfVisible` duplicates navigation the state machine handles
5. ~~Missing Ollama vision model~~ — Fixed: `qwen2.5vl:7b` pulled and verified
