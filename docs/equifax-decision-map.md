---
title: "Equifax Decision Map — Phase 1 Live Run"
aliases: [equifax-decision-map, decision-map]
type: research
status: draft
tags: [type/research, topic/acquisition, topic/browser-use, topic/equifax]
created: 2026-03-25
updated: 2026-03-25
related:
  - "[[equifax-page-flow]]"
  - "[[browser-use-migration-plan]]"
  - "[[acquisition-pipeline]]"
summary: >
  Real-time decision log from Phase 1 Equifax browser-use run. Documents every page, how it was identified, what actions were taken, obstacles encountered, and solutions applied. This becomes the blueprint for the Phase 2 qwen autonomous agent.
---

# Equifax Decision Map — Phase 1 Live Run

> **This is a living log.** Each page entry documents: what we saw, how we identified it, what we did, any obstacles, and how we solved them. The autonomous agent (Phase 2) will replicate this exact decision tree.

## Run Config

- **Mode:** Headed, incognito, maximized
- **Launch command:** `AGENT_BROWSER_HEADED=true agent-browser open "https://www.annualcreditreport.com" --args "--incognito" --args "--start-maximized"`
- **Important:** Do NOT use `agent-browser set viewport` after launch — it causes the page to glitch and shift right. `--start-maximized` handles sizing on its own.
- **Handoff points:** The operator enters personal info (SSN, DOB, name, address), OTP codes, and security question answers

---

## Page 1: ACR Homepage

- **URL:** `https://www.annualcreditreport.com/index.action`
- **How identified:** URL path ends with `/index.action`, page has "Request your free credit reports" link
- **Key interactive elements:** `link "Request your free credit reports"` (appears twice — hero area and body)
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # Find: link "Request your free credit reports" [@e9 in our run]
  agent-browser click @e9
  agent-browser wait 3000
  ```
- **Result:** Navigated to landing page (`/requestReport/landingPage.action`)

## Page 2: ACR Landing Page (3 Steps Overview)

- **URL:** `https://www.annualcreditreport.com/requestReport/landingPage.action`
- **How identified:** URL path contains `/requestReport/landingPage.action`, heading "3 steps to your free online credit reports"
- **Key interactive elements:** `link "Request your credit reports"` pointing to `requestForm.action`
- **Obstacle:** `agent-browser click @ref` failed — element "blocked by another element (likely a modal or overlay)." No visible modal in screenshot. Invisible CSS overlay.
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # Find: link "Request your credit reports" [@e12 in our run, href=requestForm.action]
  # Normal click FAILS — blocked by invisible overlay
  # agent-browser click @e12  ← DO NOT USE, will fail
  agent-browser eval "document.querySelector('a[href*=\"requestForm\"]').click()"
  agent-browser wait 3000
  ```
- **Pattern for Phase 2:** Always use JS eval click for the "Request your credit reports" link on this page. The overlay is consistent.
- **Result:** Navigated to request form (`/requestReport/requestForm.action`)

## Page 3: ACR Request Form (Personal Info)

- **URL:** `https://www.annualcreditreport.com/requestReport/requestForm.action`
- **How identified:** URL path contains `/requestReport/requestForm.action`, form fields for First/Last name, DOB, SSN, Address
- **Key form fields (refs from our run):**
  - `textbox "First"` [@e9] — first name
  - `textbox "Middle initial"` [@e10] — middle initial
  - `textbox "Last"` [@e11] — last name
  - `combobox "Suffix"` [@e12] — dropdown (e.g. "Junior,Jr.,J")
  - `textbox "Birthday(MM-DD-YYYY)"` [@e25] — format: `MM-DD-YYYY`
  - `textbox "Social Security Number"` [@e28] — 9 digits, no dashes
  - `textbox "Verify Social Security Number"` [@e29] — must match
  - `textbox "Address"` [@e31] — street address
  - `textbox "Address Line 2"` [@e32] — apt/suite (optional)
  - `textbox "City"` [@e33]
  - `combobox "State"` [@e34] — select by state name (e.g. "New York")
  - `textbox "Zip"` [@e98] — 5-digit zip
  - `radio "Yes"` [@e99] / `radio "No"` [@e100] — "lived here 2+ years?" (default: Yes)
  - `button "Next"` [@e101] — submits form
- **Data source (production):** Client info is pre-collected from a separate intake form in the app. The agent fills this ACR form programmatically — the client never touches ACR directly.
- **Exact commands:**
  ```
  agent-browser snapshot -i
  agent-browser fill @e9 "<FIRST_NAME>"
  agent-browser fill @e10 "A"
  agent-browser fill @e11 "Smart"
  agent-browser select @e12 "Junior,Jr.,J"
  agent-browser fill @e25 "01-30-1992"
  agent-browser fill @e28 "092801527"
  agent-browser fill @e29 "092801527"
  agent-browser fill @e31 "11 24th Street"
  agent-browser fill @e33 "Copiague"
  agent-browser select @e34 "New York"
  agent-browser fill @e98 "11726"
  # Verify with screenshot before submitting
  agent-browser screenshot --full
  agent-browser click @e101
  agent-browser wait 4000
  ```
- **Obstacle:** None — all fields accept standard fill commands without issues.
- **Result:** Navigated to bureau selection (`/requestReport/processForm.action`)

## Page 4: ACR Bureau Selection

- **URL:** `https://www.annualcreditreport.com/requestReport/processForm.action`
- **How identified:** URL contains `/processForm.action`, page shows 3 checkboxes: Equifax, Experian, TransUnion
- **Key interactive elements (refs from our run):**
  - `checkbox "Equifax"` [@e9] — check this one only
  - `checkbox "Experian"` [@e10] — leave unchecked
  - `checkbox "TransUnion"` [@e11] — leave unchecked
  - `button "Next"` [@e12] — submits selection
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # Find: checkbox "Equifax" [@e9 in our run]
  agent-browser check @e9
  agent-browser click @e12
  agent-browser wait 4000
  ```
- **Obstacle:** None — checkboxes and Next button worked normally.
- **Important:** Selecting multiple bureaus causes the site to navigate between them unpredictably. Always select ONE at a time.
- **Result:** Redirected to Equifax verification at `my.equifax.com/consumer-registration/ACR/#/verify-identity`

## Page 5: Equifax Identity Verification (Phone + Email)

- **URL:** `https://my.equifax.com/consumer-registration/ACR/#/verify-identity`
- **How identified:** Domain is `my.equifax.com` (NOT www.equifax.com — that's the marketing site). URL hash contains `#/verify-identity`. Page has "Mobile phone number" and "Email address" fields.
- **Key interactive elements:**
  - `button "close banner"` — Ketch privacy banner overlay. Dismiss first.
  - `textbox "Mobile phone number"` — client's phone for OTP delivery
  - `textbox "Email address"` — client's email
  - `button "Continue"` — submits and triggers OTP send
  - `button "Get your next report or finish"` — skip/exit button (do NOT click)
  - `button "Learn more"` — **DANGER: navigates away from verification flow to wrong page. NEVER click this.**
  - `link "request your free Equifax credit report"` — alternate entry (do NOT click)
- **Privacy banner:** Ketch privacy banner appears on first load. Must be dismissed via "close banner" button before interacting with form fields.
- **Data source (production):** Phone and email come from client intake form, same as personal info.
- **Exact commands (so far):**
  ```
  agent-browser snapshot -i
  # Find: button "close banner" [@e1 in our run]
  agent-browser click @e1
  # Now fill phone and email:
  # agent-browser fill @e8 "<phone>"
  # agent-browser fill @e9 "<email>"
  # agent-browser click @e10   # Continue button
  # agent-browser wait 4000
  ```
- **Exact commands (complete):**
  ```
  agent-browser snapshot -i
  # Find: button "close banner" [@e1 in our run]
  agent-browser click @e1
  # Re-snapshot — refs change after banner dismissed!
  agent-browser snapshot -i
  # Find: textbox "Mobile phone number" [@e5], textbox "Email address" [@e6], button "Continue" [@e7]
  agent-browser fill @e5 "6315386119"
  agent-browser fill @e6 "operator@example.com"
  # Verify with screenshot before continuing
  agent-browser screenshot
  agent-browser click @e7
  agent-browser wait 5000
  ```
- **Important:** Refs change after dismissing the privacy banner. Always re-snapshot after banner close.
- **Production handoff:** Phone number comes from a dialog box that pauses automation and asks the user. Email is already collected from intake form.
- **Result:** Navigated to OTP delivery selection (`#/otp-verify-get-pin`)

## Page 6: Equifax OTP Delivery Selection

- **URL:** `https://my.equifax.com/consumer-registration/ACR/#/otp-verify-get-pin`
- **How identified:** URL hash contains `#/otp-verify-get-pin`. Page shows phone number ending in masked digits with radio button, and "Send me a one-time code" button.
- **Key interactive elements (refs from our run):**
  - `radio "Your mobile phone number ending in •••-•••-6119"` [@e4] — select delivery method
  - `button "Send me a one-time code"` [@e5] — triggers OTP send to selected phone
  - `button "Get your next report or finish"` [@e2] — do NOT click
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # Find: radio with phone number [@e4], button "Send me a one-time code" [@e5]
  agent-browser click @e4
  agent-browser wait 500
  agent-browser click @e5
  agent-browser wait 5000
  ```
- **Obstacle:** None — radio and button worked normally.
- **Note:** Page warns "You do not have access to your credit report after closing your browser. Please prepare to review, save or print your credit report."
- **Result:** OTP sent to phone. Page transitions to OTP entry field.

## Page 7: Equifax OTP Code Entry

- **URL:** `https://my.equifax.com/consumer-registration/ACR/#/otp-verify-get-pin` (same URL, page content changes)
- **How identified:** Same URL as Page 6 but now shows an unlabeled text input field and Continue button (no more radio/send button).
- **Key interactive elements (refs from our run):**
  - `textbox` [@e4] — unlabeled OTP entry field (no placeholder text visible in snapshot)
  - `button "Continue"` [@e5] — submits OTP code
  - `button "Get your next report or finish"` [@e2] — do NOT click
- **Production handoff:** **PAUSE AUTOMATION HERE.** Show dialog box asking user to check their phone and enter the OTP code. Wait for user response before filling field and clicking Continue.
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # Find: textbox [@e4] (unlabeled), button "Continue" [@e5]
  # === HANDOFF: Wait for user to provide OTP code ===
  agent-browser fill @e4 "<OTP_CODE>"
  agent-browser click @e5
  agent-browser wait 5000
  ```
- **Result:** OTP accepted. Navigated directly to credit report summary (`#/credit-report/summary`). **No security questions were shown this run.**

## Page 8: Equifax Credit Report Summary

- **URL:** `https://my.equifax.com/consumer-registration/ACR/#/credit-report/summary`
- **How identified:** URL hash contains `#/credit-report/summary`. Page shows "Your Equifax credit report" heading with report date, left sidebar with section navigation.
- **Key interactive elements (refs from our run):**
  - `button "Summary"` [@e4] — current view
  - `button "Credit Accounts"` [@e5], `button "Revolving Accounts"` [@e6], `button "Mortgage Accounts"` [@e7], `button "Installment Accounts"` [@e8], `button "Open Lines"` [@e9]
  - `button "Consumer Statements"` [@e10], `button "Personal Information"` [@e11], `button "Inquiries"` [@e12], `button "Public Records"` [@e13], `button "Collections"` [@e14]
  - `button "Your Rights"` [@e15], `button "Dispute"` [@e16], `button "Products for You"` [@e17]
  - `button "Print Credit Report"` [@e18] — **initially disabled**, becomes enabled after page fully loads
  - `button "Get your next report or finish"` [@e2] — do NOT click until report is saved
- **Report data visible in summary:**
  - Report Date: March 30, 2026
  - Consumer File Notices: FILE_BLOCKED_FOR_PROMOTIONAL_PURPOSES
  - Average Account Age: 6 Years, 6 Months
  - Length of Credit History: 15 Years, 6 Months
  - Oldest Account: NELNET LOAN SERVICING | Sep 2010
  - Most Recent Account: MIDLAND CREDIT MANAGEMENT | May 2024
- **Print button behavior (OBSTACLE — UNRESOLVED):**
  - Button is initially `[disabled]` on page load — must wait for it to become enabled (re-snapshot to check)
  - Clicking the button does NOT trigger `window.print()`, does NOT open a new tab, does NOT navigate
  - Button has class `print-btn efx-type-link` — Angular component
  - The button may need a longer wait, may trigger an async PDF generation, or may open a print dialog that Playwright intercepts
  - **TODO:** The site's Print button may generate a printable view that Playwright's headless print intercepts as a file. In our Playwright-based browser, this creates an "odd file" instead of showing print options.
  - **Fallback tested:** `agent-browser pdf "/path/to/report.pdf"` works but only captures the currently visible section (e.g. Summary). A full report PDF would need all sections expanded or the site's own printable view.
  - **RESOLVED:** The button DOES download a PDF (14 pages, ~195 KB). Playwright saves it to its temp artifacts dir (`/private/var/folders/.../playwright-artifacts-*/`) with a UUID filename and no extension. The file IS a valid PDF (version 1.4).
  - **Production fix:** Use `agent-browser download @e18 "/path/to/report.pdf"` or set `--download-path` flag to control where the PDF lands. Alternatively, find the file in Playwright's artifacts dir and copy it.
  - **Artifacts path pattern:** `/private/var/folders/.../playwright-artifacts-*/`
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # Wait for Print button to become enabled (initially disabled)
  # Re-snapshot until button "Print Credit Report" no longer shows [disabled]
  agent-browser click @e18   # Print Credit Report
  # UNRESOLVED: button click doesn't produce visible result
  # Fallback: agent-browser pdf "/path/to/report.pdf"
  ```
- **Result:** *(in progress — print button behavior needs investigation)*

---

## Error Page: Report Already Received

- **URL:** `https://my.equifax.com/consumer-registration/ACR/#/credit-report-error`
- **How identified:** URL hash contains `#/credit-report-error`. Page shows exclamation icon with "Report already received" heading.
- **Message:** "Based on our records you recently received your free Equifax Credit Report. You therefore are not currently eligible for another free Equifax Credit Report through annualcreditreport.com at this time."
- **When it appears:** After verify-identity step if the consumer has already pulled their Equifax report within the current eligibility window.
- **Key interactive elements:**
  - `button "Get your next report or finish"` [@e2] — navigate to next bureau or exit
  - `link "Contact us"` [@e3]
- **Phase 2 handling:** Agent must detect this page (URL hash check) and report back to the app that the report is unavailable. Do NOT retry — it will keep hitting this page until the eligibility window resets.

## Error Page: System Error (Processing Issue)

- **URL:** `https://my.equifax.com/consumer-registration/ACR/#/system-error`
- **How identified:** URL hash contains `#/system-error`. Page shows exclamation icon with "We've experienced an issue processing your request" heading.
- **Message:** "We're sorry, we are unable to process your request at this time. Please call our Customer Care team at 888-EQUIFAX Mon-Fri 9am-9pm ET and Sat-Sun 9am-6pm ET."
- **When it appears:** After clicking Continue on verify-identity page. Possible causes:
  - Session timeout (browser navigated away during the flow)
  - Equifax server-side issue
  - Info mismatch that Equifax can't resolve programmatically
- **Key interactive elements:**
  - `button "Get your next report or finish"` [@e2] — navigate to next bureau or exit
  - `link "Contact us"` [@e3]
- **Phase 2 handling:** Agent must detect this page (URL hash check for `#/system-error`). If it occurs, retry from the beginning (fresh ACR session). If persistent across retries, report the error and skip Equifax.
- **Screenshot:** `tmp/eq-processing-error-identityB.png` (Session 9)

---

## Key Findings

1. **Security questions were NOT shown** — Previous runs hit security questions after OTP. This run went straight from OTP to report. May be session/cookie dependent or device recognition.
2. **Print button is problematic** — The SPA's print button doesn't behave like a standard link/button. Needs deeper investigation (network monitoring, Angular event handlers, or direct PDF save).
3. **The entire flow from ACR homepage to credit report took ~10 pages with 2 handoffs** (phone number and OTP code).
4. **Incognito mode is required** — without it, buttons/navigation break.
5. **Landing page has invisible overlay** — must use JS eval click to get past it.
6. **Privacy banner appears on Equifax domain** — dismiss before interacting with form fields. Refs change after dismissal.

---

## Obstacles Log

| # | Page | Problem | Solution | Replicable? |
|---|------|---------|----------|-------------|
| 1 | Landing Page | Link click blocked by invisible overlay | JS eval: `document.querySelector('a[href*="requestForm"]').click()` | Yes — consistent behavior |
| 2 | Equifax Verify Identity | Ketch privacy banner blocks form fields | Click "close banner" button first | Yes — appears on first load |
