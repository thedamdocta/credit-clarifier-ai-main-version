---
title: "Experian Decision Map — Phase 1 Live Run"
aliases: [experian-decision-map, experian-flow]
type: research
status: draft
tags: [type/research, topic/acquisition, topic/browser-use, topic/experian]
created: 2026-03-25
updated: 2026-03-25
related:
  - "[[equifax-decision-map]]"
  - "[[browser-use-migration-plan]]"
  - "[[acquisition-pipeline]]"
summary: >
  Real-time decision log from Phase 1 Experian browser-use run. Documents every Experian-specific page after ACR handoff, obstacles encountered, and solutions applied. ACR pages 1-4 are shared with Equifax and documented in equifax-decision-map.md.
---

# Experian Decision Map — Phase 1 Live Run

> **This is a living log.** ACR pages 1-4 (Homepage → Landing → Form → Bureau Selection) are shared across all bureaus — see [[equifax-decision-map]] for those. This doc covers Experian-specific pages starting after bureau selection.

## Run Config

- **Mode:** Headed, incognito, maximized
- **Launch command:** `AGENT_BROWSER_HEADED=true agent-browser open "https://www.annualcreditreport.com" --args "--incognito" --args "--start-maximized"`
- **Important:** Do NOT use `agent-browser set viewport` after launch.
- **Handoff points:** Personal info (ACR form), confirmation link tap (phone), Imperva captcha (manual)

---

## ACR Bureau Selection Note

- On the ACR bureau selection page (`/requestReport/processForm.action`), the checkbox order changes based on which bureaus have already been pulled. If Equifax was already pulled, it moves to the bottom. Always match by **label text**, not ref number.
- Select only the **Experian** checkbox, then click Next.

---

## Page 5-EX: Experian Identity Verification (Email + Phone)

- **URL:** `https://usa.experian.com/registration/mobile-match/get-started`
- **How identified:** Domain is `usa.experian.com`. URL contains `/registration/mobile-match/get-started`. Page has email field, phone field, and "Text Me" / "Call Me" radio buttons.
- **Key interactive elements:**
  - `textbox` — Email address
  - `textbox` — Phone number
  - `radio "Text Me"` — sends confirmation **link** via text (NOT an OTP code)
  - `radio "Call Me"` — alternative delivery
  - `button "Continue"` or similar submit
- **Obstacle:** "Text Me" radio button blocked by invisible overlay — same pattern as ACR landing page.
- **Exact commands:**
  ```
  agent-browser snapshot -i
  # Fill email and phone fields with client data
  # Radio "Text Me" is BLOCKED by overlay — use JS eval:
  agent-browser eval "document.querySelectorAll('input[type=\"radio\"]')[0]?.click()"
  # Then click Continue/submit button
  agent-browser wait 5000
  ```
- **Key difference from Equifax:** No privacy banner on Experian (unlike Equifax's Ketch banner).
- **Result:** Navigated to check-device page.

## Page 6-EX: Experian Check Device (Confirmation Link)

- **URL:** `https://usa.experian.com/registration/mobile-match/check-device`
- **How identified:** URL contains `/registration/mobile-match/check-device`. Page instructs user to check their phone.
- **Key difference from Equifax:** Experian sends a **confirmation LINK** via text, not an OTP code. The user must tap the link on their phone. The page auto-advances after the link is tapped.
- **Production handoff:** **PAUSE AUTOMATION HERE.** Notify user: "Check your phone. Experian sent a link via text. Tap the link to verify." Then poll the page for changes.
- **Obstacle:** After link is tapped, Imperva hCaptcha may intercept before Experian loads.
- **Result:** After link tap → may redirect to Imperva captcha OR directly to Experian report.

## Page 7-EX: Imperva hCaptcha Security Check

- **URL:** `usa.experian.com` (with Incapsula resource parameters in the iframe)
- **How identified:** Page shows `#main-iframe` containing Incapsula content with nested hCaptcha iframes. Heading: "Additional security check is required." Powered by Imperva.
- **Page structure:**
  - Main page contains `iframe#main-iframe` (Incapsula wrapper, same origin)
  - Inside main-iframe: 2 nested iframes from `newassets.hcaptcha.com` (cross-origin)
    - iframe 0: `title="Widget containing checkbox for hCaptcha security challenge"` — the "I am human" checkbox
    - iframe 1: `title="hCaptcha challenge"` — the image challenge grid
- **Obstacle:** `agent-browser snapshot` does NOT see inside iframes. `agent-browser click` with @refs won't work. The `frame` command exists but `snapshot` still doesn't capture iframe content after switching.
- **Solution — Mouse coordinate click through nested iframes:**
  ```
  # 1. Get main iframe position (should be fullscreen at 0,0)
  agent-browser eval "JSON.stringify(document.querySelector('#main-iframe').getBoundingClientRect())"

  # 2. Get hCaptcha checkbox iframe position INSIDE the main iframe
  agent-browser eval "var f = document.querySelector('#main-iframe'); var d = f.contentDocument; var hcap = d.querySelectorAll('iframe')[0]; var r = hcap.getBoundingClientRect(); 'x=' + Math.round(r.x) + ' y=' + Math.round(r.y) + ' w=' + Math.round(r.width) + ' h=' + Math.round(r.height)"

  # 3. Calculate checkbox position (left side of widget, ~30px from left edge, vertically centered)
  # checkbox_x = iframe_x + 30
  # checkbox_y = iframe_y + (iframe_height / 2)

  # 4. Click via mouse coordinates (penetrates through nested iframes)
  agent-browser mouse move <checkbox_x> <checkbox_y>
  agent-browser mouse down
  agent-browser mouse up
  agent-browser wait 2000
  ```
- **After checkbox click:** hCaptcha presents an image challenge (e.g. "Select objects that can be played to create music"). This is a **manual handoff** — user must solve it.
- **Production handoff:** **PAUSE AUTOMATION HERE.** Notify user: "Imperva security check appeared. Please solve the captcha in the browser." Then poll page URL until it changes from the captcha page.
- **Detection polling:**
  ```
  # Poll every 5 seconds — check if URL still contains captcha indicators
  agent-browser eval "window.location.href"
  # If URL no longer contains "acr/process" or Incapsula params → captcha solved
  ```
- **Result:** After captcha solved → redirects to Experian verification result (success or error).

---

## Error Page: Identity Verification Failed

- **URL:** `https://usa.experian.com/acr/preOowError`
- **How identified:** URL path contains `/acr/preOowError`. Page shows pink/magenta banner: "We weren't able to verify your identity."
- **Message:** "This is usually because your information has recently changed, you don't have enough credit history, or the information was entered incorrectly."
- **When it appears:** After identity verification fails. Possible causes:
  - Incorrect personal info entered on ACR form (name, DOB, SSN, address mismatch)
  - Insufficient credit history
  - Imperva flagged the session as suspicious
- **Key interactive elements:**
  - `button "Get your next report or finish"` [@e1] — navigate to next bureau or exit
  - `link "Contact us"` [@e2]
  - `link "click here to try again."` [@e3] — re-attempt verification (goes back to ACR form)
  - `button "Upload documents"` [@e4] — upload proof of identity (5-7 day processing)
  - `link "Phone Number"` [@e5] — (877) 322-8228
  - `link "Download and Mail in PDF form"` [@e6] — mail-in option
- **Three fallback options displayed:**
  1. **Upload Proof of Identity** — Driver's License, Social Security Card, Birth Certificate. Report mailed after 5-7 days.
  2. **Request by Phone** — (877) 322-8228, 24/7
  3. **Request by Mail** — Download PDF form, mail to Experian PO Box 2002, Allen, TX 75013
- **Phase 2 handling:** Agent must detect this page (URL path check for `preOowError`) and report back to the app that verification failed. Offer "try again" option. Do NOT auto-retry without user confirmation — may lock the account.

---

## Key Findings (So Far)

1. **Experian uses confirmation LINK, not OTP code** — fundamentally different handoff from Equifax. User taps link on phone instead of entering a code.
2. **Imperva hCaptcha may appear** — not always, but when it does, it's a manual handoff. Mouse coordinates work through nested iframes.
3. **No privacy banner on Experian** — unlike Equifax's Ketch banner.
4. **"Text Me" radio blocked by overlay** — same pattern as ACR landing page. Use JS eval.
5. **Bureau checkbox order changes** — already-pulled bureaus move to bottom on ACR selection page.
6. **Identity verification can fail** — `preOowError` page shown when personal info doesn't match Experian's records.

---

## Obstacles Log

| # | Page | Problem | Solution | Replicable? |
|---|------|---------|----------|-------------|
| 1 | Verify Identity | "Text Me" radio blocked by overlay | JS eval: `document.querySelectorAll('input[type="radio"]')[0]?.click()` | Yes — consistent |
| 2 | Imperva Captcha | Snapshot doesn't see inside iframes | Calculate iframe positions via eval + mouse coordinate click | Yes — structural |
| 3 | Imperva Captcha | hCaptcha image challenge | Manual handoff — user must solve | Always manual |

---

## Pages Still Needed

- **Experian Credit Report page** — not yet reached (blocked by verification error on this run due to incorrect info)
- **Experian PDF download** — method TBD (may differ from Equifax's print button)
- **Security questions** — may or may not appear on Experian (unknown)
