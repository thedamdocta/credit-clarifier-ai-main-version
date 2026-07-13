---
title: "Browser Automation Pitfalls — Lessons from Phase 1"
aliases: [browser-pitfalls, automation-pitfalls]
type: research
status: draft
tags: [type/research, topic/acquisition, topic/browser-use, topic/lessons]
created: 2026-03-30
updated: 2026-03-30
related:
  - "[[equifax-decision-map]]"
  - "[[experian-decision-map]]"
  - "[[transunion-decision-map]]"
  - "[[browser-use-migration-plan]]"
summary: >
  Consolidated list of every issue hit during Phase 1 browser-use runs across all three bureaus. Documents what went wrong, why, what the fix was, and what to avoid in Phase 2.
---

# Browser Automation Pitfalls — Lessons from Phase 1

> **Purpose:** Every issue encountered during Phase 1 live runs. The Phase 2 autonomous agent must handle all of these. Read this before writing any automation code.

---

## Quick-Reference: Known Workarounds (CHECK BEFORE EVERY CLICK)

> **HARD RULE:** During live bureau runs, NEVER attempt a normal `agent-browser click` on any element listed below. Use the documented command EXACTLY. Failed clicks generate DOM events that Imperva and other bot detection systems can flag as behavioral anomalies. General fallback patterns (try click → eval if fails) are ONLY for pages not yet in the decision maps.

| Bureau | Page | Element | DO NOT USE | USE THIS INSTEAD |
|--------|------|---------|-----------|-------------------|
| **ACR** | Landing Page | "Request your credit reports" link | `agent-browser click @ref` | `agent-browser eval "document.querySelector('a[href*=\"requestForm\"]').click()"` |
| **Experian** | Verify Identity | "Text Me" radio button | `agent-browser click @ref` | `agent-browser eval "document.querySelectorAll('input[type=\"radio\"]')[0]?.click()"` |
| **Experian** | Imperva Captcha | hCaptcha checkbox (inside nested iframes) | `agent-browser click @ref` | Mouse coordinate click — see [[#2. Iframes (Experian Imperva Captcha)]] |
| **TransUnion** | Disclosure | "Print or Save My Report" | Site's print button (triggers native dialog) | CDP `Page.printToPDF` with `landscape: true` — see [[#4. Landscape PDF (TransUnion)]] |
| **TransUnion** | Disclosure (exit) | Marketing dialog | Don't submit the form | `agent-browser eval "document.querySelector('.CustomModal_closeButton__DtHcA').click()"` |
| **Equifax** | Verify Identity | Privacy banner | Don't interact with form until dismissed | Click "close banner" button first, then **re-snapshot** (refs change) |
| **Equifax** | Report Summary | "Print Credit Report" button | Don't click while `[disabled]` | Re-snapshot until enabled, then click. PDF lands in Playwright artifacts dir. |

**How to use this table:** Before interacting with ANY element on a bureau page, scan this table for the bureau + page combination. If there's a match, use the documented command — no exceptions. If there's no match, the element is safe for normal `agent-browser click`.

---

## Tool Selection: What Works Where

| Task | Tool | Why |
|------|------|-----|
| Page navigation, form filling, snapshots | `agent-browser` | Best at understanding page structure via accessibility tree |
| Clicking elements blocked by overlays | `agent-browser eval` (JS) | Overlays block Playwright click but not JS `.click()` |
| Interacting inside iframes | `agent-browser mouse` coordinates | Snapshot can't see inside iframes; mouse clicks penetrate through |
| PDF generation (especially landscape) | CDP `Page.printToPDF` | Only method with landscape support. agent-browser pdf can't do it |
| Download path control | CDP or Playwright direct | agent-browser downloads go to temp artifacts dir with UUID names |
| Captcha image challenges | Manual handoff | No automated solution — user must solve |
| Native Chrome dialogs (print, save-as) | **Cannot be automated** | These are OS-level, outside the web page DOM |

---

## Issues by Category

### 1. Invisible Overlays (ACR + Experian)

**What happens:** `agent-browser click @ref` fails with "blocked by another element (likely a modal or overlay)." No visible overlay in screenshots.

**Where it occurs:**
- ACR landing page — "Request your credit reports" link
- Experian verify identity — "Text Me" radio button

**Fix:** Use JS eval to bypass the overlay:
```
agent-browser eval "document.querySelector('a[href*=\"requestForm\"]').click()"
agent-browser eval "document.querySelectorAll('input[type=\"radio\"]')[0]?.click()"
```

**Phase 2 rule:** When a click fails with "blocked by another element," fall back to JS eval `.click()` on the same element.

---

### 2. Iframes (Experian Imperva Captcha)

**What happens:** `agent-browser snapshot` returns the main page's accessibility tree but does NOT include content inside iframes. Cross-origin iframes (like hCaptcha) are completely invisible to snapshot and standard click commands.

**Structure encountered:**
```
Main page
  └─ iframe#main-iframe (Incapsula, same-origin)
       └─ iframe[0] (hCaptcha checkbox, cross-origin)
       └─ iframe[1] (hCaptcha challenge, cross-origin)
```

**Fix:** Calculate iframe positions and use raw mouse coordinates:
```
# 1. Get parent iframe bounds (accessible via eval on same-origin parent)
agent-browser eval "var f = document.querySelector('#main-iframe'); var d = f.contentDocument; var hcap = d.querySelectorAll('iframe')[0]; var r = hcap.getBoundingClientRect(); 'x=' + Math.round(r.x) + ' y=' + Math.round(r.y) + ' w=' + Math.round(r.width) + ' h=' + Math.round(r.height)"

# 2. Calculate target position (e.g., checkbox at left-center of iframe)
# checkbox_x = iframe_x + 30
# checkbox_y = iframe_y + (iframe_height / 2)

# 3. Click via mouse coordinates (penetrates through all iframe layers)
agent-browser mouse move <x> <y>
agent-browser mouse down
agent-browser mouse up
```

**Phase 2 rule:** When encountering iframes, use eval to get positions from the accessible parent, then mouse coordinate clicks.

---

### 3. agent-browser Daemon Code Caching

**What happens:** The agent-browser daemon (`daemon.js`) loads `actions.js` and `protocol.js` once at startup. Edits to these files have NO EFFECT until the daemon is restarted. Restarting the daemon kills the browser because they communicate via pipe (not a debugging port).

**Where this bit us:** Tried to add landscape PDF support by editing `actions.js`. The edit was correct but the running daemon used the old cached code. Couldn't restart without losing the TransUnion report page.

**Avoidance rule:** Make ALL patches to agent-browser source files BEFORE running `agent-browser open`. Once the browser is open, the daemon's behavior is locked.

---

### 4. Landscape PDF (TransUnion)

**What happens:** TransUnion reports MUST be landscape. `agent-browser pdf` has no `--landscape` flag and calls Playwright's `page.pdf({format: 'Letter'})` with no landscape option.

**What does NOT work:**
- `agent-browser pdf /path/to/file.pdf` — always portrait
- Injecting CSS `@page { size: landscape }` — Playwright ignores CSS @page rules
- Editing `actions.js` at runtime — daemon caches code (see #3)
- Passing extra fields via daemon socket — Zod schema strips unknown fields

**What DOES work:** CDP's `Page.printToPDF` with `landscape: true`:
```javascript
const cdp = await page.context().newCDPSession(page);
const { data } = await cdp.send("Page.printToPDF", {
    landscape: true,
    printBackground: true,
    scale: 1,
    paperWidth: 8.5,
    paperHeight: 11,
    marginTop: 0.25,
    marginBottom: 0.25,
    marginLeft: 0.25,
    marginRight: 0.25,
});
fs.writeFileSync(targetPath, Buffer.from(data, "base64"));
```

**Reference:** `server/creditReportAcquisitionAgent.mjs:2313` already implements this.

---

### 5. Native Chrome Dialogs

**What happens:** Certain actions (like TransUnion's "Print or Save My Report") trigger `window.print()` which opens Chrome's native print dialog. This is an OS-level window, NOT part of the web page. No automation tool can interact with it.

**Where it occurs:** TransUnion disclosure page — the print/save link uses a React click handler that calls `window.print()`.

**Avoidance rule:** NEVER rely on the site's print/save button for automated PDF capture. Use CDP `Page.printToPDF` instead, which generates the PDF in memory without opening any dialog.

---

### 6. Privacy Banners (Equifax)

**What happens:** Ketch privacy banner appears on `my.equifax.com` on first load. It overlays the form fields. Clicking form fields fails until the banner is dismissed.

**Additional issue:** After dismissing the banner, all element refs (`@e1`, `@e2`, etc.) change. The snapshot taken before dismissal has invalid refs.

**Fix:** Dismiss banner first, then re-snapshot:
```
agent-browser click @<close_banner_ref>
agent-browser snapshot -i   # re-snapshot — refs have changed!
```

**Phase 2 rule:** After ANY overlay/banner dismissal, always re-snapshot to get fresh refs.

---

### 7. Download Path Control (Equifax)

**What happens:** When Equifax's "Print Credit Report" button triggers a PDF download, Playwright saves the file to its temp artifacts directory (`/private/var/folders/.../playwright-artifacts-*/`) with a UUID filename and no extension.

**Fix for Phase 1:** Manually find and copy the file:
```bash
find /private/var/folders/ -path "*/playwright-artifacts-*" -name "*" -newer /tmp/timestamp_marker
```

**Fix for Phase 2:** Use Playwright's download API with explicit save path, or CDP to control downloads.

---

### 8. Bureau-Specific Verification Differences

| Bureau | Verification Method | Handoff Type | Radio Button Behavior |
|--------|-------------------|--------------|----------------------|
| **Equifax** | OTP code via text/call | User enters code in text field | Radio works with normal `click @ref`. Phone number radio on delivery page. |
| **Experian** | Confirmation LINK via text | User taps link on phone; page auto-advances | **Radio BLOCKED by invisible overlay** — must use JS eval: `document.querySelectorAll('input[type="radio"]')[0]?.click()`. Continue button starts `[disabled]` until radio selected. |
| **TransUnion** | OTP code via text/call | User enters code in text field | Radio works with normal `click @ref`. "Verify my identity" button starts `[disabled]` until radio selected. |

**Key differences:**
1. **Experian sends a LINK, not a code.** The agent must detect this and poll for page change instead of showing an OTP entry field.
2. **Experian's "Text Me" radio is blocked by an overlay** — always use JS eval, never attempt a normal click (failed clicks generate detectable DOM events that Imperva can flag).
3. **EQ/TU radios work normally** with standard `agent-browser click @ref`.
4. **Submit buttons on EX and TU start disabled** — they enable only after the radio is selected. Re-snapshot after radio click to get enabled button ref.

---

### 9. Page State Detection

**Issue:** Same URL can show different content (e.g., Equifax `#/otp-verify-get-pin` shows both the delivery selection AND the code entry form at different times).

**Phase 2 rule:** Always use snapshot/screenshot analysis to determine page state, not just URL matching. The qwen vision model should classify the page from its visual appearance.

---

### 10. "Learn More" / Wrong Button Clicks

**Issue:** Equifax has a "Learn more" button that navigates AWAY from the verification flow to a different page entirely. Clicking it breaks the flow.

**Phase 2 rule:** Maintain a list of FORBIDDEN elements per page (e.g., "Learn more," "Get your next report or finish" before saving). The agent must never click these.

---

### 11. Bureau Marketing Dialogs / Upsell Modals

**Issue:** Bureaus present marketing overlay modals at various points — especially when leaving the report page. TransUnion shows a "Before you leave..." email signup dialog (`Modal-module_modalOverlay`). These block navigation and the snapshot may not clearly show them since they're overlay modals, not page changes.

**Where it occurs:**
- TransUnion disclosure page — triggered on exit attempt
- Potentially Equifax/Experian at similar points (not yet confirmed)

**Fix:** Dismiss with Cancel/Close/Skip — never submit marketing forms:
```
# TransUnion
agent-browser eval "document.querySelector('.CustomModal_closeButton__DtHcA').click()"
```

**Phase 2 rule:** After saving the report PDF, before navigating away, check for marketing modals. Always click Cancel/Close/Dismiss. NEVER click signup/submit buttons — they would enroll the client in bureau marketing communications.

---

### 12. Anti-Detection Init Script Pitfalls

**Issue 1 — Don't override `navigator.plugins` with a plain array.** Real Chrome has a `PluginArray` object with 5 PDF-related plugins. Overriding it with `[1, 2, 3, 4, 5]` breaks the type check (`Plugins is of type PluginArray` → failed). Bot detection sites flag this immediately. Real Chrome already has the correct plugins — don't touch them.

**Issue 2 — `addInitScript` scripts are cumulative and permanent.** Once you add an init script via the daemon socket, it runs on every subsequent page load for the entire browser session. There is no way to remove it. If you inject a bad script, you must close and relaunch the browser. Test scripts carefully before injecting.

**Issue 3 — Playwright overrides `navigator.webdriver` AFTER `addInitScript`.** Even with `--disable-blink-features=AutomationControlled` and a custom init script that sets `navigator.webdriver = false`, Playwright's internal script runs after `addInitScript` and re-sets it to `true`. Patching on `Navigator.prototype` or `navigator` instance both get overridden. Requires a non-configurable property definition or a different interception approach.

**Phase 2 rule:** Never override browser-native objects (plugins, languages, etc.) with plain JS types. Only patch properties that are actively wrong (like `navigator.webdriver`). Test anti-detection scripts on bot.sannysoft.com before going to target sites.

---

### 13. Screenshot Accumulation Crashes Context (API 400 Error)

**What happens:** When taking many screenshots during a browser session and viewing them in conversation context, the Claude API rejects requests with: `messages.X.content.Y.image.source.base64.data: At least one of the image dimensions exceed max allowed size for many-image requests: 2000 pixels`. The session crashes and all unsaved work is lost.

**Root cause:** The API enforces a **2000px per-dimension limit on images in multi-image requests**. A single large screenshot is fine, but when many screenshots accumulate in the conversation history (e.g., 20+ full-page captures), the API treats subsequent messages as multi-image requests and enforces the stricter size limit. Browser screenshots from `agent-browser screenshot` are typically full-viewport resolution (1920x1080+), which exceeds 2000px on the width axis.

**Where it bit us:** Session 14 — test run walkthrough captured 36 screenshots. Session crashed at screenshot ~36 with the 400 error. All test run findings that hadn't been written to disk were lost.

**Prevention rules:**
1. **Save screenshots to disk, don't accumulate in context.** Use `agent-browser screenshot /path/to/file.png` to save, but do NOT read/view the image file unless you specifically need to analyze it.
2. **One screenshot in context at a time.** If you need to view a screenshot, view it, extract what you need, then move on. Don't keep multiple screenshots in the conversation.
3. **Write findings to docs incrementally.** Don't accumulate observations across 20+ screenshots and plan to write them all at the end. Write after every 3-5 screenshots. If the session crashes, only the last batch is lost.
4. **Checkpoint the .state file after every screenshot batch.** Include which screenshots have been taken and which findings have been written.

**Phase 2 rule:** The autonomous agent should save screenshots to disk for audit trails but never load them back into its own conversation context in bulk. Process one at a time if visual analysis is needed.

---

## Pre-Flight Checklist (Before Any Browser Session)

- [ ] Agent-browser patches applied BEFORE `agent-browser open` (if needed)
- [ ] Anti-detection patches verified: chromiumSwitches.js + crPage.js (see Session 11)
- [ ] Headed mode: `AGENT_BROWSER_HEADED=true`
- [ ] Real Chrome + profile: `AGENT_BROWSER_EXECUTABLE_PATH` + `--user-data-dir`
- [ ] Maximized: `--args "--start-maximized"`
- [ ] Do NOT set viewport after launch
- [ ] operator available for handoffs (OTP, captcha, security questions)
- [ ] Decision map doc open for the target bureau
- [ ] `.state` file ready for checkpointing

## Per-Page Checklist (Before EVERY Page Interaction)

- [ ] **Check the Quick-Reference Workarounds table above** for this bureau + page combination
- [ ] If the element is listed → use the documented command EXACTLY (no normal click attempts)
- [ ] If the element is NOT listed → normal `agent-browser click` is safe
- [ ] After any overlay/banner dismissal → re-snapshot before next interaction (refs change)
- [ ] After any radio button selection → re-snapshot to get enabled submit button ref
