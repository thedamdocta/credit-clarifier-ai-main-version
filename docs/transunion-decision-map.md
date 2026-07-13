---
title: "TransUnion Decision Map — Phase 1 Live Run"
aliases: [transunion-decision-map, tu-decision-map]
type: research
status: draft
tags: [type/research, topic/acquisition, topic/browser-use, topic/transunion]
created: 2026-03-30
updated: 2026-03-30
related:
  - "[[equifax-decision-map]]"
  - "[[experian-decision-map]]"
  - "[[browser-use-migration-plan]]"
  - "[[acquisition-pipeline]]"
summary: >
  Real-time decision log from Phase 1 TransUnion browser-use run. Documents every TransUnion-specific page after ACR handoff, obstacles encountered, and solutions applied. ACR pages 1-4 are shared with Equifax and documented in equifax-decision-map.md. TransUnion report MUST be saved in landscape mode.
---

# TransUnion Decision Map — Phase 1 Live Run

> **This is a living log.** ACR pages 1-4 (Homepage → Landing → Form → Bureau Selection) are shared across all bureaus — see [[equifax-decision-map]] for those. This doc covers TransUnion-specific pages starting after bureau selection.

## Run Config

- **Mode:** Headed, incognito, maximized
- **Launch command:** `AGENT_BROWSER_HEADED=true agent-browser open "https://www.annualcreditreport.com" --args "--incognito" --args "--start-maximized"`
- **Important:** Do NOT use `agent-browser set viewport` after launch.
- **Handoff points:** OTP code entry (phone), potentially security questions
- **CRITICAL:** TransUnion report MUST be saved in **landscape mode**. The application rejects portrait TU reports. See [[#Landscape PDF Requirement]] section.

---

## ACR Bureau Selection Note

- On the ACR bureau selection page (`/requestReport/processForm.action`), the checkbox order changes based on which bureaus have already been pulled. In our run (Equifax already pulled), the order was: Experian, TransUnion, Equifax (Equifax moved to bottom).
- Select only the **TransUnion** checkbox, then click Next.

---

## Page 5-TU: TransUnion Identity Verification

- **URL:** `https://annualcreditreport.transunion.com/cvd/?enterprise=FactAct#/verifyIdentity`
- **How identified:** Domain is `annualcreditreport.transunion.com`. URL hash contains `#/verifyIdentity`. Page shows pre-verified personal info (name, DOB, SSN, address from ACR) plus email and phone fields.
- **Key difference from Equifax/Experian:** TransUnion displays the personal info that was already entered on the ACR form (read-only). It only asks for email address and phone number as NEW input.
- **Key interactive elements:**
  - `textbox "Email Address"` — client's email
  - `textbox "Phone Number"` — client's phone
  - `button "I Accept & Continue"` — submits and advances to OTP
- **Pre-verified fields shown (read-only):**
  - First Name, Middle Name, Last Name, Suffix
  - Date of Birth
  - SSN (masked: XXX-XX-XXXX)
  - Street Address, City, State, Zip Code
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # Fill email and phone fields (find by label text)
  agent-browser fill @<email_ref> "operator@example.com"
  agent-browser fill @<phone_ref> "6315386119"
  # Click "I Accept & Continue"
  agent-browser click @<accept_ref>
  agent-browser wait 5000
  ```
- **Obstacle:** None — fields and button worked normally.
- **Result:** Navigated to OTP delivery selection (`#/confirmIdentity`)

## Page 6-TU: TransUnion Confirm Identity (OTP Delivery)

- **URL:** `https://annualcreditreport.transunion.com/cvd/?enterprise=FactAct#/confirmIdentity`
- **How identified:** URL hash contains `#/confirmIdentity`. Page shows "Confirm Your Identity" heading with two delivery options.
- **Key interactive elements:**
  - `radio "Text Message"` — sends OTP via text (select this)
  - `radio "Phone call"` — alternative delivery
  - `button "Verify my identity"` — triggers OTP send
- **Production handoff:** This is where the user selects delivery method.
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # Select "Text Message" radio
  agent-browser click @<text_message_ref>
  agent-browser wait 500
  # Click "Verify my identity"
  agent-browser click @<verify_ref>
  agent-browser wait 5000
  ```
- **Note:** After clicking "Verify my identity," the page may take a few seconds to advance. Wait at least 5 seconds before re-snapshotting.
- **Result:** OTP sent to phone. Page transitions to OTP entry.

## Page 7-TU: TransUnion OTP Code Entry

- **URL:** `https://annualcreditreport.transunion.com/cvd/?enterprise=FactAct#/confirmIdentity` (same URL, page content changes)
- **How identified:** Same URL as Page 6 but now shows an OTP code entry field instead of delivery options.
- **Key interactive elements:**
  - `textbox` — OTP code entry field (may be unlabeled or labeled "Code")
  - `button "Submit"` or `button "Verify"` — submits OTP code
- **Production handoff:** **PAUSE AUTOMATION HERE.** Show dialog box asking user to check their phone and enter the OTP code. Wait for user response.
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # === HANDOFF: Wait for user to provide OTP code ===
  agent-browser fill @<code_ref> "<OTP_CODE>"
  agent-browser click @<submit_ref>
  agent-browser wait 5000
  ```
- **Result:** OTP accepted. Navigated to order complete page (`#/orderComplete`).

## Page 8-TU: TransUnion Order Complete

- **URL:** `https://annualcreditreport.transunion.com/cvd/?enterprise=FactAct#/orderComplete` OR `#/enroll-step-3`
- **How identified:** URL hash contains `#/orderComplete` OR `#/enroll-step-3`. Page shows "You are all set, the request has been processed" message with personalized greeting ("Thank you for choosing TransUnion, [Name].").
- **URL variance:** Session 7 (Test Identity A) used `#/orderComplete`. Session 10 (Test Identity B) used `#/enroll-step-3`. Both show the same content. Phase 2 agent must check for BOTH hash values.
- **Key interactive elements:**
  - `button "Continue"` — navigates to the actual credit report
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # Click Continue to view report
  agent-browser click @<continue_ref>
  agent-browser wait 5000
  ```
- **Key difference from Equifax:** Equifax goes straight from OTP to report. TransUnion has this intermediate "order complete" confirmation page.
- **Note:** Operator note: there may be additional intermediate steps between OTP verification and this page that load quickly and could be missed with long waits. Phase 2 agent should poll more frequently during this transition.
- **Screenshot:** `tmp/tu-order-complete-identityB.png` (Session 10)
- **Result:** Navigated to credit report disclosure page (`#/disclosure`).

## Page 9-TU: TransUnion Credit Report (Disclosure)

- **URL:** `https://annualcreditreport.transunion.com/cvd/?enterprise=FactAct#/disclosure`
- **How identified:** URL hash contains `#/disclosure`. Page shows "Personal Credit Report for [NAME]" with full report data.
- **Page structure:**
  - **Navigation tabs:** Credit Report, Credit Score, FAQ, Support
  - **Section links:** Personal Information, Accounts, Inquiries, Additional Information
  - **Report metadata:** File Number, Date Created
  - **"Print or Save My Report"** link — top right of report area (with printer icon)
- **Confirmed runs:**
  - Session 7 (Test Identity A): File #<redacted>, 03/30/2026
  - Session 10 (Test Identity B): File #<redacted>, 03/31/2026
- **Key interactive elements:**
  - `link "Credit Report"` [@e3] — current tab
  - `link "Credit Score"` [@e4]
  - `link "FAQ"` [@e5]
  - `link "Support"` [@e6]
  - `link "Personal Information"` [@e7] — section anchor
  - `link "Accounts"` [@e8] — section anchor
  - `link "Inquiries"` [@e9] — section anchor
  - `link "Additional Information"` [@e10] — section anchor
  - `link "Start a dispute request online"` [@e11]
  - Various `button "more View more details for..."` — per-account detail expanders
  - `button "Payment/Remarks Key"` — multiple instances
  - **"Print or Save My Report"** — NOT a standard link/button in snapshot. It's a `<p>` with class `DisclosureCategories_printCTA__rRciL` containing a `<span>` with `dataclick` attribute. Uses React click handler.
- **Report data visible:**
  - Personal Credit Report for: <CONSUMER NAME>
  - File Number: 448708763
  - Date Created: 03/30/2026
  - Personal info, accounts, inquiries, additional info sections
- **Print/Save behavior (OBSTACLE):**
  - Element: `p.DisclosureCategories_printCTA__rRciL > span[dataclick]`
  - Click via JS eval: `document.querySelector('.DisclosureCategories_printCTA__rRciL span').click()`
  - Clicking triggers `window.print()` → opens Chrome's **native print dialog** (not a web page dialog)
  - Native print dialog CANNOT be controlled by agent-browser or Playwright — it's outside the web page DOM
  - The print dialog shows 33 pages in portrait mode by default
  - User can manually change Layout to "Landscape" and Destination to "Save as PDF" in the dialog
  - **For automation: Do NOT use the site's print button.** Use CDP's `Page.printToPDF` instead (see Landscape PDF section below)

---

## Landscape PDF Requirement

> **CRITICAL:** TransUnion reports MUST be saved in landscape mode. The application rejects portrait TransUnion reports — this is a business rule, not a preference.

### Why Landscape Matters
- TransUnion's report layout has wide tables (payment history, account details) that are cut off or wrapped poorly in portrait
- The application's extraction pipeline is designed to read landscape TransUnion layout
- Portrait TransUnion reports are automatically rejected by the application

### Solution: CDP `Page.printToPDF` (NOT `window.print()`)

The existing acquisition agent (`server/creditReportAcquisitionAgent.mjs:2313`) already solves this:

```javascript
const saveVisiblePageAsPdf = async (page, targetPath, { landscape = false } = {}) => {
  const client = await page.context().newCDPSession(page);
  const { data } = await client.send("Page.printToPDF", {
    landscape,
    printBackground: true,
    scale: 1,
    paperWidth: 8.5,
    paperHeight: 11,
    marginTop: 0.25,
    // ... margins
  });
  // data is base64-encoded PDF content
  fs.writeFileSync(targetPath, Buffer.from(data, "base64"));
};

// Called with landscape: true for TransUnion:
await ensureReportSaved(session, store, activeBureau, { landscape: activeBureau === "TransUnion" });
```

### What Does NOT Work for Landscape

| Approach | Why It Fails |
|----------|-------------|
| `agent-browser pdf` command | No `--landscape` flag. Uses `page.pdf({format: 'Letter'})` with no landscape option. |
| CSS `@page { size: landscape }` injection | Playwright's `page.pdf()` ignores CSS @page rules — it uses explicit format/landscape params |
| Native Chrome print dialog | Can't be controlled by automation (native OS dialog, not web DOM) |
| Modifying `agent-browser` actions.js at runtime | Daemon caches code at startup. Edits don't take effect without restart. Restart kills the browser (pipe-based CDP). |
| Sending `landscape` field via daemon socket | Zod schema in `protocol.js` strips unknown fields |

### What DOES Work

1. **CDP `Page.printToPDF`** — Chrome DevTools Protocol command that supports `landscape: true`. Called through Playwright's `context.newCDPSession(page)`. This is what the existing agent uses.
2. **Daemon socket JSON with `landscape: true`** — **CONFIRMED WORKING (Session 10).** After patching `protocol.js` (add `landscape: z.boolean().optional()` to pdfSchema) and `actions.js` (landscape passthrough), send JSON directly to the daemon socket:
   ```bash
   echo '{"id":"landscape-1","action":"pdf","path":"/path/to/output.pdf","landscape":true}' | nc -U ~/.agent-browser/default.sock
   ```
   This produces a proper landscape PDF (792x612 points). **Must patch BEFORE daemon start** — daemon caches code at startup.
3. **Phase 2 agent** — The qwen-based autonomous agent will use CDP directly (same as existing agent), not agent-browser's `pdf` command.

### Permanent Fix for agent-browser

Files to modify:
1. **`protocol.js`** — Add `landscape: z.boolean().optional()` to `pdfSchema`
2. **`actions.js`** — Add `landscape: command.landscape ?? false` to `page.pdf()` options
3. **CLI binary** — Add `--landscape` flag parsing (requires recompiling the native binary)

Current patched state (actions.js only, not loaded by running daemon):
- `actions.js` has been edited with landscape support + format-field detection
- `protocol.js` has NOT been edited yet
- Daemon PID 82292 still runs OLD cached code

---

## Key Findings (So Far)

1. **TransUnion shows pre-verified personal info** — Unlike Equifax/Experian which only show phone/email fields, TransUnion displays the full ACR form data (name, DOB, SSN, address) as read-only, then asks for email + phone only.
2. **TransUnion has an "order complete" intermediate page** — After OTP verification, shows "You are all set" before the report. Equifax goes straight to report. URL may be `#/orderComplete` or `#/enroll-step-3` — both show same content.
3. **TransUnion OTP is same pattern as Equifax** — Text Message or Phone call radio buttons, then code entry.
4. **"Print or Save My Report" triggers native dialog** — The site uses `window.print()` which opens Chrome's native print dialog (33 pages). Cannot be controlled by automation.
5. **Landscape PDF requires CDP or patched daemon** — Must use `Page.printToPDF` with `landscape: true` via CDP session, or patched agent-browser daemon socket with `landscape: true`. Both confirmed working.
6. **`agent-browser pdf` CLI cannot do landscape** — No `--landscape` flag. But patched daemon accepts `landscape: true` via socket JSON.
7. **Bureau checkbox order changes** — Equifax moved to bottom since it was already pulled. Order: Experian, TransUnion, Equifax.
8. **"Before you leave" marketing dialog** — TransUnion shows email signup modal when user tries to leave the disclosure page. Must dismiss with Cancel, never submit.
9. **No working exit button on disclosure page** — The "Get your next report or finish" link exists in the DOM (`href=javascript:void(0)`, position 0,0) but is non-functional. Clicking it does nothing. Unlike Equifax which has a working exit button, TransUnion provides NO way to return to ACR from the report page.
10. **Must select all bureaus at once** — One-at-a-time bureau selection creates exit dead ends: Equifax → "Thank you" page (must restart), TransUnion → no exit at all. Phase 2 agent MUST select all needed bureaus on the ACR bureau selection page to avoid this.

---

## Marketing Dialogs (All Bureaus)

> **Bureaus present marketing/upsell dialogs that must be dismissed.** These are NOT page navigations — they're overlay modals that block the report. The Phase 2 agent must detect and dismiss them.

### TransUnion: "Before you leave..." Email Signup

- **Trigger:** Appears when the user attempts to navigate away from the disclosure page (e.g., clicking "Get your next report or finish" or the browser back button). Uses `beforeunload`-like behavior to intercept.
- **Content:** "Before you leave... Get smarter about your credit - sign up for TransUnion email." Offers: expert tips, trending topics, special offers on mortgages/credit cards.
- **Key elements:**
  - `h1 "Before you leave…"` — heading
  - `input "Email"` — email signup field
  - `button "GET IN THE KNOW"` — submit signup (do NOT click)
  - `a.CustomModal_closeButton__DtHcA "Cancel"` — **dismiss the dialog**
- **How to dismiss:** JS eval: `document.querySelector('.CustomModal_closeButton__DtHcA').click()`
- **Phase 2 rule:** After saving the PDF but before navigating away, check for this modal overlay. If present, click "Cancel" to dismiss. NEVER submit the email form — it would enroll the client in TransUnion marketing.
- **Screenshot:** `tmp/tu-marketing-dialog-identityB.png` (Session 10)

### General Bureau Marketing Pattern

Bureaus (TransUnion, potentially Equifax/Experian) present marketing offers, email signups, and upsell dialogs at various points in the flow. The Phase 2 agent should:
1. **Always dismiss** — click Cancel/Close/Skip/No Thanks
2. **Never submit** — don't fill marketing forms or click signup buttons
3. **Check after report save** — marketing modals commonly appear when leaving the report page

---

## Obstacles Log

| # | Page | Problem | Solution | Replicable? |
|---|------|---------|----------|-------------|
| 1 | Disclosure | "Print or Save" triggers native dialog | Use CDP `Page.printToPDF` instead of site's button | Yes — structural |
| 2 | Disclosure | agent-browser pdf has no landscape option | Use CDP directly (existing agent pattern at line 2313) | Yes — agent-browser limitation |
| 3 | Disclosure | Daemon caches code at startup | Must restart daemon to pick up edits; loses browser | Yes — architectural |
| 4 | Disclosure | "Before you leave" marketing modal blocks navigation | JS eval: `document.querySelector('.CustomModal_closeButton__DtHcA').click()` | Yes — appears on exit |

---

## Error Page: factactUserIneligible (Report Delivered Recently)

- **URL:** `https://annualcreditreport.transunion.com/cvd/?enterprise=FactAct#/factactUserIneligible`
- **How identified:** URL hash contains `#/factactUserIneligible`. Page shows "Report Delivered Recently" heading.
- **Message:** "Please wait 7 days from your previous request. Our records show that TransUnion provided you with the credit report(s) you were eligible to receive via this website. Please wait 1 week or more before returning to annualcreditreport.com to try again."
- **Alternative offered:** Link to "visit our TransUnion Service Center website" for direct request.
- **Trigger:** Attempting to pull a TransUnion report through ACR within 7 days of a previous successful pull.
- **Phase 2 rule:** Check for this page after bureau handoff. If detected, log the error and skip TransUnion for this session. Do NOT retry — the 7-day cooldown is enforced server-side.
- **Screenshot:** `tmp/tu-cooldown-error.png` (Session 8)

---

## Pages Still Needed

- **Security questions** — May appear for some users (not shown in either run)
- **Other error pages** — What happens when TransUnion can't verify identity (equivalent to Experian's preOowError)

## Resolved

- **Landscape PDF save** — ~~Blocked by 7-day cooldown~~ **CAPTURED Session 10** via daemon socket JSON with `landscape: true`. File: `tmp/transunion-identityB-2026-03-31.pdf` (35 pages, 322KB, landscape)
