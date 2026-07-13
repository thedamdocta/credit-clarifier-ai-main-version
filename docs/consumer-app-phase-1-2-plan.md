# Consumer App Phase 1 and Phase 2 Plan

## Purpose

This document is the working reference for the current consumer app build.

The goal right now is **Part 1 only**:

- retrieve all three credit reports through the browser agent
- stage the reports into the user profile
- extract each report separately
- support dispute reasons, highlighted evidence, and letter generation on top of that foundation

The CRM / attorney product is **not** the current focus. That comes later after the consumer workflow is stable.

## Product Direction

The consumer app is being built in parts.

The intended consumer workflow is:

1. User enters intake information.
2. User gives interactive retrieval consent.
3. The app launches an isolated browser session.
4. The browser agent retrieves the reports from AnnualCreditReport.com and the bureau pages.
5. The user stays in the loop for required identity inputs such as phone, OTP, and security questions.
6. The three bureau PDFs are staged into the user profile.
7. The user approves extraction.
8. Each bureau report is extracted separately.
9. The user can review dispute reasons, highlighted evidence, and letters.

## What Already Works

The current foundation is partially in place:

- extraction already works
- dispute reasons already work, but need adjustment
- highlighted reports exist, but need significant improvement

The main priority is now the **browser retrieval agent**, because it feeds the rest of the flow.

## Current Priority

### Phase 1: Browser Retrieval Agent

This is the main build focus.

The goal of Phase 1 is to make retrieval reliable, understandable, and safe for users.

Phase 1 should deliver:

- reliable isolated browser launch
- clear user consent gate before retrieval starts
- deterministic bureau-specific flows
- clean user handoff for OTP, phone, email, and security questions
- staged PDF capture for all three bureaus
- a docked assistant that feels like a Codex-style agent, not a blind script
- recovery behavior when the website glitches or changes

### Complete Retrieval Agent Immediate Build Order

1. Docked Codex-style assistant UI
2. Bureau state machine
3. User handoff modals
4. Screenshot recovery loop
5. Final PDF staging into profile

## Phase 1 Details

### 1. Docked Codex-style assistant UI

The assistant should stay visible inside the browser session and feel like a live agent.

It should show:

- current task
- current bureau
- current mode
- recent tool calls
- what the agent is waiting on
- what the user needs to do next

The assistant should make the process feel transparent so users are not surprised when the agent pauses or asks for help.

### 2. Bureau state machine

Each bureau behaves differently, so the browser flow should not be one generic script.

The state machine should track:

- AnnualCreditReport entry steps
- TransUnion-specific steps
- Equifax-specific steps
- Experian-specific steps
- per-bureau save / completion states
- handoff states
- failure / recovery states

### 3. User handoff modals

When the bureaus require user-owned input, the agent should pause and ask clearly.

Examples:

- use saved email and phone
- enter the OTP code
- answer the security question directly on the page
- confirm the next step before continuing

These modals should make the transition between agent control and user control obvious.

### 4. Screenshot recovery loop

This is the fallback path for broken or changed pages.

The intended recovery flow is:

1. A normal deterministic action fails or confidence drops.
2. The system captures a screenshot and page context.
3. A vision-capable model reads the screenshot.
4. A reasoning layer decides the best fallback action.
5. The dock shows the thinking and tool call.
6. The agent retries or asks the user if confidence is too low.

Important note:

- `gpt-oss:20b` is the local reasoning model today.
- It is **not** the vision model.
- A separate vision-capable model will be needed for screenshot reading.

### 5. Final PDF staging into profile

The retrieval agent must end by saving the bureau PDFs into the user profile state.

That means:

- Experian PDF staged
- Equifax PDF staged
- TransUnion PDF staged
- TransUnion saved in landscape when required

Extraction should happen only after the user approves the staged reports.

## Revised Phase 2

### Phase 2: Multi-Bureau Extracted Review

Phase 2 is **not** a comparison view.

It is a clean way for the user to review all three extracted reports separately after retrieval is finished.

Phase 2 should deliver:

- extraction runs for all three reports after retrieval and approval
- each bureau stays isolated
- the profile shows three tabs:
  - Experian
  - Equifax
  - TransUnion
- each tab shows only that bureau's extracted result
- no merged comparison view
- no forced cross-bureau analysis

The purpose is simple:

- let the user inspect each bureau independently
- keep the review process clear
- prepare for dispute reasons and highlights later

## Work After Phase 2

After retrieval and multi-bureau review are stable, the next work should be:

1. dispute reason tuning
2. highlighted evidence / highlighted report rebuild
3. consumer workflow polish
4. mailing feature completion

## What Is Out Of Scope Right Now

The following is intentionally deferred:

- CRM / attorney product
- organization workflows
- doing pulls on behalf of clients at scale
- remote team operations
- full mailing automation

Those depend on the consumer retrieval flow being stable first.

## Short Summary

The current plan is:

- finish the browser retrieval agent first
- make retrieval transparent, interactive, and resilient
- stage all three PDFs into the profile
- run extraction for all three after approval
- show the extracted results in three separate bureau tabs
- improve dispute reasons and highlighted evidence after the retrieval foundation is solid
