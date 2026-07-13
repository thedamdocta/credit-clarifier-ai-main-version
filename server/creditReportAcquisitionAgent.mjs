import fs from "node:fs/promises";
import path from "node:path";
import { appConfig } from "./config.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const escapeRegExp = (value) => String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const makeRegex = (value) => {
  if (value instanceof RegExp) {
    return value;
  }
  return new RegExp(escapeRegExp(String(value ?? "")), "i");
};

const normalizeComparableText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const normalizeBureauKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const getRequestedBureauKeys = (session) => {
  const target = normalizeBureauKey(session?.input?.targetBureau ?? "");
  if (target) {
    return [target];
  }
  return ["transunion", "equifax", "experian"];
};

const isEquifaxOnlyRun = (session) => {
  const requested = getRequestedBureauKeys(session);
  return requested.length === 1 && requested[0] === "equifax";
};

const getRequestedBureauNames = (session) =>
  getRequestedBureauKeys(session)
    .map((bureauKey) => bureauKeyToName(bureauKey))
    .filter(Boolean);

const describeRequestedBureaus = (session) => {
  const names = getRequestedBureauNames(session);
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  if (names.length > 2) {
    return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
  }
  return "the requested bureau";
};

const bureauKeyToName = (value) => {
  switch (normalizeBureauKey(value)) {
    case "transunion":
      return "TransUnion";
    case "equifax":
      return "Equifax";
    case "experian":
      return "Experian";
    default:
      return null;
  }
};

const inferBureauFromUrl = (url, fallback = null) => {
  const value = String(url ?? "").toLowerCase();
  if (value.includes("transunion")) {
    return "TransUnion";
  }
  if (value.includes("equifax")) {
    return "Equifax";
  }
  if (value.includes("experian")) {
    return "Experian";
  }
  return fallback;
};

const getUrlHostname = (url) => {
  try {
    return new URL(String(url ?? "")).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const isUnexpectedPublicBureauPage = (bureau, url) => {
  const bureauKey = normalizeBureauKey(bureau);
  const hostname = getUrlHostname(url);

  if (!hostname) {
    return false;
  }

  switch (bureauKey) {
    case "equifax":
      return /(^|\.)equifax\.com$/i.test(hostname) && hostname !== "my.equifax.com";
    case "experian":
      return /(^|\.)experian\.com$/i.test(hostname) && hostname !== "usa.experian.com";
    case "transunion":
      return /(^|\.)transunion\.com$/i.test(hostname) && hostname !== "annualcreditreport.transunion.com";
    default:
      return false;
  }
};

const guardUnexpectedPublicBureauPage = async (session, store, bureau) => {
  const page = getActivePage(session);
  if (!page) {
    return false;
  }

  const pageUrl = page.url();
  if (!isUnexpectedPublicBureauPage(bureau, pageUrl)) {
    return false;
  }

  const activeBureau = bureauKeyToName(normalizeBureauKey(bureau)) ?? bureau ?? session.currentBureau ?? "bureau";

  recordDebugEvent(
    store,
    session,
    "unexpected_public_page",
    `The browser drifted onto the public ${activeBureau} website instead of the official report flow.`,
    {
      bureau: activeBureau,
      pageUrl,
      detected: true,
    },
  );

  store.appendLog(
    session,
    `${activeBureau} opened its public marketing site instead of the official AnnualCreditReport flow. The agent will not continue on that page.`,
  );
  recordToolActivity(
    store,
    session,
    `Reject public ${activeBureau} page`,
    `This is the public ${activeBureau} site, not the official AnnualCreditReport verification or report page. The agent is pausing instead of signing up.`,
    "waiting",
    "handoff",
  );

  if (normalizeBureauKey(session?.input?.targetBureau) === normalizeBureauKey(activeBureau)) {
    throw new Error(
      `${activeBureau} opened its public website instead of the official AnnualCreditReport verification or report flow.`,
    );
  }

  await store.requestPrompt(session, {
    type: "manual_continue",
    inputType: "confirm",
    title: `Return to the official ${activeBureau} report flow`,
    description:
      `This browser page is the public ${activeBureau} website, not the AnnualCreditReport verification or report page. Do not sign up here. Return to the official report flow, then continue so the agent can resume.`,
    submitLabel: "I returned to the report flow",
    bureau: activeBureau,
    contextUrl: pageUrl,
  });

  return true;
};

const isBureauSystemErrorPage = async (page, bureau) => {
  if (!page) {
    return false;
  }

  const pageUrl = String(page.url?.() ?? "").toLowerCase();
  if (/systemerror|errorpage|technicalerror/i.test(pageUrl)) {
    return true;
  }

  const bureauKey = normalizeBureauKey(bureau);
  const pageText = await readVisiblePageText(page);
  if (!pageText) {
    return false;
  }

  switch (bureauKey) {
    case "transunion":
      return /temporarily unable to complete your request|experiencing a problem on our end|try again later/i.test(pageText);
    case "equifax":
    case "experian":
      return /unable to complete your request|try again later|something went wrong|technical issue/i.test(pageText);
    default:
      return false;
  }
};

const abortForVisibleBureauSystemError = async (session, store, bureau) => {
  const page = getActivePage(session);
  if (!page) {
    return false;
  }

  const activeBureau = bureauKeyToName(normalizeBureauKey(bureau)) ?? bureau ?? session.currentBureau ?? "bureau";
  const detected = await isBureauSystemErrorPage(page, activeBureau);
  if (!detected) {
    return false;
  }

  const pageUrl = page.url();
  recordDebugEvent(
    store,
    session,
    "bureau_system_error",
    `${activeBureau} showed a bureau error page instead of the report flow.`,
    {
      bureau: activeBureau,
      pageUrl,
      detected: true,
    },
  );
  store.appendLog(
    session,
    `${activeBureau} showed an error page instead of the report flow. The entered information may not have been accepted.`,
    "error",
  );
  recordToolActivity(
    store,
    session,
    `${activeBureau} error page detected`,
    `The visible ${activeBureau} page says the request could not be completed. The browser will stop instead of pretending the report is still available.`,
    "failed",
    "handoff",
  );

  throw new Error(
    `${activeBureau} returned an error page instead of the report. The entered information may not have been accepted. End this run and relaunch ${activeBureau} with corrected information.`,
  );
};

const isExtensionPageUrl = (url) => /^(chrome|edge)-extension:\/\//i.test(String(url ?? ""));
const isTrackablePageUrl = (url) => !isExtensionPageUrl(url);

const getActivePage = (session) => session.runtime?.page ?? null;

const coercePromptValue = (response) => {
  if (typeof response === "string") {
    return response.trim();
  }
  if (response && typeof response.value === "string") {
    return response.value.trim();
  }
  return "";
};

const normalizePageKey = (url) => {
  const value = String(url ?? "").trim();
  if (!value) {
    return "";
  }
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch {
    return value.split(/[?#]/, 1)[0].toLowerCase();
  }
};

const getContactPromptState = (session, bureau, pageUrl) => {
  session.contactPromptState ??= {};
  const bureauKey = normalizeBureauKey(bureau || session.currentBureau || "session");
  const pageKey = normalizePageKey(pageUrl);
  const previousState = session.contactPromptState[bureauKey] ?? {
    prompted: false,
    lastPhone: "",
    lastPageKey: "",
    lastSubmittedAt: null,
    silentRetryCount: 0,
    submissionCount: 0,
  };
  const nextState =
    previousState.lastPageKey && pageKey && previousState.lastPageKey !== pageKey
      ? {
          ...previousState,
          lastPageKey: pageKey,
          silentRetryCount: 0,
        }
      : {
          ...previousState,
          lastPageKey: pageKey || previousState.lastPageKey,
        };
  session.contactPromptState[bureauKey] = nextState;
  return nextState;
};

const findFirstVisibleLocator = async (locators) => {
  for (const locator of locators) {
    try {
      if ((await locator.count()) > 0 && (await locator.first().isVisible())) {
        return locator.first();
      }
    } catch {
      // ignore and keep scanning
    }
  }
  return null;
};

const waitForVisibleLocator = async (locators, { timeoutMs = 8000, intervalMs = 250 } = {}) => {
  const deadline = Date.now() + timeoutMs;
  let visible = await findFirstVisibleLocator(locators);
  while (!visible && Date.now() < deadline) {
    await wait(intervalMs);
    visible = await findFirstVisibleLocator(locators);
  }
  return visible;
};

const maybeFillField = async (page, matchers, value) => {
  if (!page || !value) {
    return false;
  }

  const patterns = matchers.map(makeRegex);
  for (const pattern of patterns) {
    const locator = await findFirstVisibleLocator([
      page.getByLabel(pattern),
      page.getByRole("textbox", { name: pattern }),
      page.getByPlaceholder(pattern),
    ]);
    if (!locator) {
      continue;
    }
    await locator.fill("");
    await locator.fill(String(value));
    return true;
  }

  return false;
};

const dismissKnownVerificationOverlays = async (page, session = null, store = null) => {
  if (!page) {
    return false;
  }

  let dismissed = false;
  let matchedBanner = null;
  let matchedSelector = null;
  const tryClose = async (locator) => {
    try {
      if ((await locator.count()) === 0 || !(await locator.first().isVisible())) {
        return false;
      }
      await locator.first().click({ timeout: 1000 }).catch(() => locator.first().click({ timeout: 1000, force: true }));
      await wait(350);
      dismissed = true;
      matchedSelector = await locator.evaluate((element) => {
        if (element instanceof HTMLElement) {
          return (
            element.getAttribute("aria-label") ||
            element.getAttribute("data-testid") ||
            element.textContent ||
            element.tagName
          );
        }
        return "unknown";
      }).catch(() => "unknown");
      return true;
    } catch {
      return false;
    }
  };

  try {
    const bodyText = await page.locator("body").innerText();
    if (/your privacy choices|powered by ketch/i.test(bodyText)) {
      matchedBanner = "ketch_privacy_choices";
      await tryClose(page.locator('button[aria-label*="close" i]'));
      await tryClose(page.locator('[role="button"][aria-label*="close" i]'));
      await tryClose(page.getByRole("button", { name: /^close$/i }));
    }
  } catch {
    // ignore body text read failures
  }

  if (session && store && (matchedBanner || dismissed)) {
    recordDebugEvent(
      store,
      session,
      "overlay_cleanup",
      dismissed
        ? "Dismissed a verification overlay before continuing."
        : "Detected a verification overlay but could not dismiss it yet.",
      {
        pageUrl: page.url(),
        matchedBanner,
        dismissed,
        matchedSelector,
      },
    );
  }

  return dismissed;
};

const maybeSelectOption = async (page, matchers, value) => {
  if (!page || !value) {
    return false;
  }

  const rawValue = String(value).trim();
  const normalizedValue = normalizeComparableText(rawValue);
  const selectSearchTerms =
    {
      jr: ["junior", "jr", "juniorjrj"],
      sr: ["senior", "sr", "seniorsrs"],
    }[normalizedValue] ??
    {
      jr: ["junior", "jr", "juniorjrj"],
      sr: ["senior", "sr", "seniorsrs"],
    }[normalizedValue.replace(/\./g, "")] ??
    [rawValue];

  const patterns = matchers.map(makeRegex);
  for (const pattern of patterns) {
    const locator = await findFirstVisibleLocator([
      page.getByLabel(pattern),
      page.getByRole("combobox", { name: pattern }),
    ]);
    if (!locator) {
      continue;
    }

    const options = await locator.evaluate((element) =>
      Array.from(element.options ?? []).map((option) => ({
        value: option.value,
        label: option.label,
        text: option.textContent ?? "",
      })),
    ).catch(() => []);

    const normalizedTerms = selectSearchTerms
      .map((term) => normalizeComparableText(term))
      .filter(Boolean);

    const findMatch = (predicate) => options.find((option) => {
      const normalizedLabel = normalizeComparableText(option.label);
      const normalizedText = normalizeComparableText(option.text);
      const normalizedOptionValue = normalizeComparableText(option.value);
      return predicate({ normalizedLabel, normalizedText, normalizedOptionValue });
    });

    const matchedOption =
      findMatch(({ normalizedLabel, normalizedText, normalizedOptionValue }) =>
        normalizedTerms.some((term) =>
          term === normalizedLabel || term === normalizedText || term === normalizedOptionValue,
        ),
      ) ??
      findMatch(({ normalizedLabel, normalizedText, normalizedOptionValue }) =>
        normalizedTerms.some((term) =>
          normalizedLabel.includes(term) || normalizedText.includes(term) || normalizedOptionValue.includes(term),
        ),
      );

    if (!matchedOption) {
      continue;
    }

    try {
      if (matchedOption.value) {
        await locator.selectOption(matchedOption.value);
      } else if (matchedOption.label) {
        await locator.selectOption({ label: matchedOption.label });
      } else {
        await locator.selectOption({ label: matchedOption.text });
      }
      return true;
    } catch {
      continue;
    }
  }

  return false;
};

const maybeCheckLabel = async (page, matcher, checked = true) => {
  if (!page) {
    return false;
  }

  const pattern = makeRegex(matcher);
  const locator = await findFirstVisibleLocator([
    page.getByLabel(pattern),
    page.getByRole("checkbox", { name: pattern }),
    page.getByRole("radio", { name: pattern }),
  ]);
  if (!locator) {
    return false;
  }

  try {
    if (checked) {
      await locator.check().catch(() => locator.click({ force: true }));
    } else {
      await locator.uncheck().catch(() => locator.click({ force: true }));
    }
    return true;
  } catch {
    return false;
  }
};

const maybeClickByText = async (page, value) => {
  if (!page) {
    return false;
  }

  await dismissKnownVerificationOverlays(page);

  const pattern = makeRegex(value);
  const clicked = await page.evaluate(({ source, flags }) => {
    const regex = new RegExp(source, flags);
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0" ||
        element.hidden
      ) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const readableText = (element) =>
      String(
        element?.textContent ||
          element?.getAttribute?.("aria-label") ||
          element?.getAttribute?.("value") ||
          "",
      )
        .replace(/\s+/g, " ")
        .trim();

    const isDisabled = (element) =>
      element instanceof HTMLElement &&
      (element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true");

    const score = (element) => {
      const tagName = element.tagName.toLowerCase();
      if (tagName === "button") return 0;
      if (tagName === "input") return 1;
      if (tagName === "a") return 2;
      if (tagName === "label") return 3;
      if (element.getAttribute("role") === "button") return 4;
      if (element.getAttribute("role") === "link") return 5;
      return 6;
    };

    const selectors = [
      "button",
      "a",
      "label",
      "input[type='button']",
      "input[type='submit']",
      "[role='button']",
      "[role='link']",
      "atlas-button",
      "atlas-radio-button",
      "[data-test-id]",
    ];

    const candidates = Array.from(document.querySelectorAll(selectors.join(",")))
      .filter((element) => visible(element) && !isDisabled(element))
      .map((element) => ({
        element,
        text: readableText(element),
        score: score(element),
      }))
      .filter(({ text }) => regex.test(text))
      .sort((left, right) => left.score - right.score);

    const target = candidates[0]?.element;
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    target.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
    target.click();
    return true;
  }, { source: pattern.source, flags: pattern.flags }).catch(() => false);

  if (!clicked) {
    return false;
  }

  await wait(750);
  return true;
};

const maybeClickLocator = async (locator) => {
  try {
    if ((await locator.count()) === 0 || !(await locator.first().isVisible())) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    await locator.first().click({ timeout: 1500 });
  } catch {
    await locator.first().click({ timeout: 1500, force: true });
  }
  await wait(750);
  return true;
};

const maybeSelectTextDeliveryMethod = async (page) => {
  if (!page) {
    return false;
  }

  await dismissKnownVerificationOverlays(page);

  const candidates = [
    page.locator('atlas-radio-button[data-test-id="CONTACT_TYPE-0"]'),
    page.locator('[data-test-id="CONTACT_TYPE-0"]'),
    page.getByRole("radio", { name: /Text Me/i }),
    page.getByLabel(/Text Me/i),
    page.getByText(/^Text Me$/i),
  ];

  for (const locator of candidates) {
    const clicked = await maybeClickLocator(locator);
    if (clicked) {
      return true;
    }
  }

  return false;
};

const runClickSequence = async (session, texts) => {
  for (const text of texts) {
    const page = getActivePage(session);
    const clicked = await maybeClickByText(page, text);
    if (clicked) {
      return true;
    }
  }
  return false;
};

const maybeFillOtpField = async (page, value) => {
  if (!value) {
    return false;
  }

  const patterns = [
    /passcode/i,
    /verification code/i,
    /one[- ]time/i,
    /otp/i,
    /security code/i,
  ];

  return maybeFillField(page, patterns, value);
};

const fillContactVerificationFields = async (page, { phone, email }, options = {}) => {
  const { session = null, store = null } = options;
  await dismissKnownVerificationOverlays(page, session, store);
  const filledEmail = await maybeFillField(
    page,
    [/Email Address/i, /^Email$/i, /Current Email/i, /Email/i],
    email,
  );
  const filledPhone = await maybeFillField(
    page,
    [/Phone Number/i, /Mobile phone number/i, /Mobile Number/i, /Cell Phone/i, /Phone/i],
    phone,
  );
  await dismissKnownVerificationOverlays(page, session, store);
  const selectedText =
    (await maybeSelectTextDeliveryMethod(page)) ||
    (await maybeCheckLabel(page, /Text Me/i, true)) ||
    (await maybeClickByText(page, "Text Me"));

  return {
    filledEmail,
    filledPhone,
    selectedText,
  };
};

const loadPlaywright = async () => {
  try {
    const { chromium } = await import("playwright-extra");
    const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
    chromium.use(StealthPlugin());
    return { chromium };
  } catch {
    throw new Error(
      "The guided acquisition screen needs the Playwright package on the backend. Run `npm install` inside `3 Bureau Extractor` before starting the browser agent.",
    );
  }
};

const prepareAppDialogPrompts = (session, store) => {
  store.setControllerState(session, {
    channel: "browser_gate",
    status: "booting",
    ready: false,
    readyAt: null,
    source: "browser-overlay",
  });
  store.appendLog(
    session,
    "The browser flow is using the controlled-browser overlay for prompts. The run will wait for the browser Get Started button before any automation begins.",
  );
  store.appendActivity(session, {
    kind: "controller",
    title: "Wait for browser start",
    detail: "The browser is open and ready. The run will stay paused until the user clicks Get Started inside the controlled browser window.",
    status: "waiting",
  });
};

const ensureExtensionBundleExists = async () => {
  const extensionDir = appConfig.agenticExtensionDist;
  const manifestPath = path.join(extensionDir, "manifest.json");
  try {
    await fs.access(manifestPath);
    return extensionDir;
  } catch {
    throw new Error(
      "The controlled-browser overlay is unavailable because the Chrome Agentic Agent extension build is missing. Run `npm run build` inside `Chrome Agentic Agent` before launching the browser.",
    );
  }
};

const waitForExtensionServiceWorker = async (context) => {
  const existingWorker = context
    .serviceWorkers()
    .find((worker) => isExtensionPageUrl(worker.url()));
  if (existingWorker) {
    return existingWorker;
  }

  try {
    const worker = await context.waitForEvent("serviceworker", { timeout: 10000 });
    return isExtensionPageUrl(worker.url()) ? worker : null;
  } catch {
    return null;
  }
};

const initializeControlledBrowserOverlay = async (context, session, store) => {
  const worker = await waitForExtensionServiceWorker(context);
  if (!worker) {
    throw new Error(
      "The remote browser launched, but the controlled-session overlay extension did not attach. End the run and relaunch after rebuilding Chrome Agentic Agent.",
    );
  }

  const apiBaseUrl = `http://${appConfig.apiHost}:${appConfig.apiPort}`;
  if (session.runtime) {
    session.runtime.extensionWorker = worker;
    session.runtime.apiBaseUrl = apiBaseUrl;
    session.runtime.connectedAt = session.runtime.connectedAt ?? new Date().toISOString();
    session.runtime.panelStatus = "ready";
  }

  await store.syncOverlaySession(session);

  store.appendLog(session, "The controlled-session browser overlay is attached.");
  store.appendActivity(session, {
    kind: "controller",
    title: "Controlled browser frame attached",
    detail: "The launched browser will show a passive controlled-session frame and wait for a Get Started click before the automation begins.",
    status: "completed",
  });
};

const recordToolActivity = (store, session, title, detail, status = "completed", kind = "tool") => {
  store.appendActivity(session, {
    kind,
    title,
    detail,
    status,
  });
};

const recordDebugEvent = (store, session, event, detail, data = null) => {
  store.appendDebugEvent(session, {
    source: "acquisition-agent",
    event,
    detail,
    data,
  });
};

const buildReportFileName = (bureauKey) =>
  `annualcreditreport-${bureauKey}-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;

const safeSegment = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "step";

const setAgentStep = (session, store, step, options = {}) => {
  const previousStep = session.currentStep;
  const nextProgress = {
    ...(typeof options.progress === "number" ? { progress: options.progress } : {}),
    ...(typeof options.stage === "string" ? { stage: options.stage } : {}),
    ...(Object.hasOwn(options, "bureau") ? { currentBureau: options.bureau ?? null } : {}),
    ...(typeof options.url === "string" || options.url === null ? { currentUrl: options.url ?? null } : {}),
    currentStep: step,
    ...(typeof options.lastAction === "string" || options.lastAction === null ? { lastAction: options.lastAction ?? null } : {}),
  };

  store.setProgress(session, nextProgress);

  if (previousStep !== step) {
    store.setProgress(session, {
      retryCount: 0,
    });
    store.setRecoveryState(session, {
      status: "idle",
      attemptCount: 0,
      lastDecision: null,
      lastSummary: null,
      screenshotPath: null,
    });
  }

  if (typeof options.mode === "string") {
    store.setControllerState(session, {
      status: options.mode,
    });
  }

  recordDebugEvent(
    store,
    session,
    "step_transition",
    previousStep === step ? `Step ${step} refreshed.` : `Step changed from ${previousStep ?? "none"} to ${step}.`,
    {
      previousStep: previousStep ?? null,
      nextStep: step,
      bureau: Object.hasOwn(options, "bureau") ? options.bureau ?? null : session.currentBureau ?? null,
      mode: typeof options.mode === "string" ? options.mode : session.controller?.status ?? null,
      stage: typeof options.stage === "string" ? options.stage : session.progress?.stage ?? null,
      progress:
        typeof options.progress === "number"
          ? options.progress
          : session.progress?.progress ?? null,
      url:
        typeof options.url === "string" || options.url === null
          ? options.url ?? null
          : session.currentUrl ?? null,
      lastAction:
        typeof options.lastAction === "string" || options.lastAction === null
          ? options.lastAction ?? null
          : session.lastAction ?? null,
    },
  );
};

const summarizeVisibleText = (value, maxLength = 2800) => {
  const normalized = String(value ?? "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
};

const readVisiblePageText = async (page) => {
  if (!page) {
    return "";
  }

  try {
    const body = await page.locator("body").innerText({ timeout: 1500 });
    return summarizeVisibleText(body);
  } catch {
    return "";
  }
};

const resolveVisibleBureau = async (session, store, fallback = null) => {
  const page = getActivePage(session);
  if (!page) {
    recordDebugEvent(store, session, "bureau_resolution", "No active page was available while resolving the visible bureau.", {
      pageUrl: null,
      resolvedBureau: fallback ?? null,
      decisionSource: "no_page",
      fallback: fallback ?? null,
    });
    return fallback;
  }

  const pageUrl = page.url();
  const urlMatch = inferBureauFromUrl(pageUrl, null);
  if (urlMatch) {
    store.setProgress(session, {
        currentBureau: urlMatch,
        currentUrl: pageUrl,
      });
    recordDebugEvent(store, session, "bureau_resolution", `Resolved the visible bureau from the URL as ${urlMatch}.`, {
      pageUrl,
      resolvedBureau: urlMatch,
      decisionSource: "url",
      fallback: fallback ?? null,
    });
    return urlMatch;
  }

  if (/annualcreditreport\.com/i.test(pageUrl)) {
    recordDebugEvent(store, session, "bureau_resolution", "Skipped body-text bureau resolution on AnnualCreditReport.com.", {
      pageUrl,
      resolvedBureau: fallback ?? null,
      decisionSource: fallback ? "annualcreditreport_fallback" : "annualcreditreport_unresolved",
      fallback: fallback ?? null,
    });
    return fallback;
  }

  try {
    const bodyText = await page.locator("body").innerText();
    if (/transunion/i.test(bodyText)) {
      store.setProgress(session, {
          currentBureau: "TransUnion",
          currentUrl: pageUrl,
        });
      recordDebugEvent(store, session, "bureau_resolution", "Resolved the visible bureau from body text as TransUnion.", {
        pageUrl,
        resolvedBureau: "TransUnion",
        decisionSource: "body_text",
        fallback: fallback ?? null,
      });
      return "TransUnion";
    }
    if (/equifax/i.test(bodyText)) {
      store.setProgress(session, {
          currentBureau: "Equifax",
          currentUrl: pageUrl,
        });
      recordDebugEvent(store, session, "bureau_resolution", "Resolved the visible bureau from body text as Equifax.", {
        pageUrl,
        resolvedBureau: "Equifax",
        decisionSource: "body_text",
        fallback: fallback ?? null,
      });
      return "Equifax";
    }
    if (/experian/i.test(bodyText)) {
      store.setProgress(session, {
          currentBureau: "Experian",
          currentUrl: pageUrl,
        });
      recordDebugEvent(store, session, "bureau_resolution", "Resolved the visible bureau from body text as Experian.", {
        pageUrl,
        resolvedBureau: "Experian",
        decisionSource: "body_text",
        fallback: fallback ?? null,
      });
      return "Experian";
    }
  } catch {
    // best effort only
  }

  if (fallback) {
    store.setProgress(session, {
      currentBureau: fallback,
      currentUrl: pageUrl,
    });
  }
  recordDebugEvent(store, session, "bureau_resolution", fallback
    ? `Falling back to ${fallback} because the bureau could not be inferred from the page.`
    : "The bureau could not be inferred from the visible page.", {
      pageUrl,
      resolvedBureau: fallback ?? null,
      decisionSource: fallback ? "fallback" : "unresolved",
      fallback: fallback ?? null,
    });
  return fallback;
};

const capturePageObservation = async (session, page, label = "page") => {
  const observationDir = path.join(session.workspaceDir, "page-observations");
  await fs.mkdir(observationDir, { recursive: true });
  const screenshotPath = path.join(
    observationDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeSegment(label)}.png`,
  );

  try {
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });
  } catch {
    // best-effort only
  }

  const pageUrl = page.url();
  const bodyText = await readVisiblePageText(page);
  const title = await page.title().catch(() => "");
  const details = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0" ||
        element.hidden
      ) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const textOf = (element) =>
      String(
        element?.textContent ||
          element?.getAttribute?.("aria-label") ||
          element?.getAttribute?.("placeholder") ||
          "",
      )
        .replace(/\s+/g, " ")
        .trim();

    const unique = (values) => Array.from(new Set(values.filter(Boolean))).slice(0, 30);

    const headings = unique(
      Array.from(document.querySelectorAll("h1, h2, h3, legend, [role='heading']"))
        .filter(isVisible)
        .map(textOf),
    );

    const buttons = unique(
      Array.from(document.querySelectorAll("button, a, [role='button'], input[type='submit'], input[type='button']"))
        .filter(isVisible)
        .map((element) => {
          if (element instanceof HTMLInputElement) {
            return textOf(element) || String(element.value ?? "").trim();
          }
          return textOf(element);
        }),
    );

    const fieldLabels = unique(
      Array.from(document.querySelectorAll("input, textarea, select"))
        .filter(isVisible)
        .map((element) => {
          const labels =
            "labels" in element && element.labels
              ? Array.from(element.labels).map((label) => textOf(label)).join(" ")
              : "";
          return [
            labels,
            element.getAttribute("aria-label") ?? "",
            element.getAttribute("placeholder") ?? "",
            element.getAttribute("name") ?? "",
            element.getAttribute("id") ?? "",
          ]
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
        }),
    );

    const radioChoices = unique(
      Array.from(document.querySelectorAll("input[type='radio']"))
        .filter(isVisible)
        .map((input) => {
          const labels =
            "labels" in input && input.labels
              ? Array.from(input.labels).map((label) => textOf(label)).join(" ")
              : "";
          return [labels, input.getAttribute("value") ?? ""].join(" ").trim();
        }),
    );

    return {
      headings,
      buttons,
      fieldLabels,
      radioChoices,
    };
  }).catch(() => ({
    headings: [],
    buttons: [],
    fieldLabels: [],
    radioChoices: [],
  }));

  return {
    pageUrl,
    host: getUrlHostname(pageUrl),
    title,
    bodyText,
    screenshotPath,
    ...details,
  };
};

const classifyEquifaxPage = (observation) => {
  const matchedSignals = [];
  const host = String(observation?.host ?? "").toLowerCase();
  const pageUrl = String(observation?.pageUrl ?? "").toLowerCase();
  const title = String(observation?.title ?? "").toLowerCase();
  const headings = (observation?.headings ?? []).join(" ").toLowerCase();
  const buttons = (observation?.buttons ?? []).join(" ").toLowerCase();
  const fields = (observation?.fieldLabels ?? []).join(" ").toLowerCase();
  const radioChoices = (observation?.radioChoices ?? []).join(" ").toLowerCase();
  const bodyText = String(observation?.bodyText ?? "").toLowerCase();
  const combined = [title, headings, buttons, fields, radioChoices, bodyText].join(" ");

  const push = (signal) => {
    if (!matchedSignals.includes(signal)) {
      matchedSignals.push(signal);
    }
  };

  if (/systemerror|technicalerror|errorpage/.test(pageUrl) || /temporarily unable to complete your request|unable to complete your request|something went wrong|technical issue/.test(combined)) {
    push("error_copy");
    return {
      pageType: "bureau_error_page",
      confidence: 0.99,
      matchedSignals,
      terminal: true,
    };
  }

  if (/annualcreditreport\.com/.test(host)) {
    if (/request 1,\s*2,\s*or 3 reports|pick the reports you want|equifax/.test(combined)) {
      push("acr_bureau_selection");
      return {
        pageType: "acr_select_equifax",
        confidence: 0.95,
        matchedSignals,
        terminal: false,
      };
    }

    push("acr_entry");
    return {
      pageType: "acr_entry",
      confidence: 0.9,
      matchedSignals,
      terminal: false,
    };
  }

  if (/(^|\.)equifax\.com$/.test(host) && host !== "my.equifax.com") {
    push("public_equifax_host");
    return {
      pageType: "wrong_public_page",
      confidence: 0.99,
      matchedSignals,
      terminal: true,
    };
  }

  const hasPhoneField = /mobile phone number|phone number/.test(fields) || /mobile phone number|phone number/.test(combined);
  const hasEmailField = /email address|current email|email/.test(fields) || /email address|current email/.test(combined);
  const hasOtpField = /passcode|verification code|one-time|one time|otp|security code/.test(fields);
  const hasSendCodeCopy = /send me a one-time passcode|yes,\s*send me a text|text me|call me|send code|send passcode/.test(combined);
  const hasCodeDeliveryCopy =
    /check your junk mail|check your spam|your email|email address|one[- ]time passcode|one[- ]time code|verification code|security code|we sent|send me a one[- ]time passcode|yes,\s*send me a text|text me|call me/.test(
      combined,
    );
  const hasQuestionCopy = /which of the following|select one answer|answer the following|based on your credit file|knowledge-based|identity questions?|security questions?/.test(combined);
  const hasQuestionControls = Boolean(radioChoices.trim()) || /select\b/.test(fields);
  const hasReportReadyCopy = /print credit report|credit report summary|view your credit report|download report|save report/.test(combined);
  const looksLikeMarketingPage =
    /sign up now|checking your own credit will not harm it|your credit report is locked|products & services|credit offers & more|cancel at any time/.test(
      combined,
    );

  if (host === "my.equifax.com") {
    if (looksLikeMarketingPage) {
      push("equifax_marketing_page");
      return {
        pageType: "wrong_public_page",
        confidence: 0.99,
        matchedSignals,
        terminal: true,
      };
    }

    if (/otp-verify-get-pin/.test(pageUrl)) {
      push("equifax_otp_route");
      if (hasOtpField) {
        push("otp_field");
        return {
          pageType: "equifax_enter_code",
          confidence: 0.98,
          matchedSignals,
          terminal: false,
        };
      }
      if (hasSendCodeCopy || hasCodeDeliveryCopy || hasPhoneField || hasEmailField) {
        push(hasSendCodeCopy ? "send_code_copy" : "code_delivery_copy");
        return {
          pageType: "equifax_send_code",
          confidence: 0.94,
          matchedSignals,
          terminal: false,
        };
      }

      push("otp_route_without_visible_code_or_send_step");
      return {
        pageType: "equifax_send_code",
        confidence: 0.65,
        matchedSignals,
        terminal: false,
      };
    }

    if (/verify-identity/.test(pageUrl)) {
      push("equifax_verify_identity_route");
      if (hasPhoneField && hasEmailField) {
        push("contact_fields");
        return {
          pageType: "equifax_contact",
          confidence: 0.98,
          matchedSignals,
          terminal: false,
        };
      }
      if (hasSendCodeCopy) {
        push("send_code_copy");
        return {
          pageType: "equifax_send_code",
          confidence: 0.8,
          matchedSignals,
          terminal: false,
        };
      }
      if (hasOtpField) {
        push("otp_field");
        return {
          pageType: "equifax_enter_code",
          confidence: 0.78,
          matchedSignals,
          terminal: false,
        };
      }
      if (hasQuestionCopy && hasQuestionControls) {
        push("security_question_copy");
        return {
          pageType: "equifax_security_questions",
          confidence: 0.76,
          matchedSignals,
          terminal: false,
        };
      }
    }

    if (hasReportReadyCopy) {
      push("report_ready_copy");
      return {
        pageType: "equifax_report_ready",
        confidence: 0.78,
        matchedSignals,
        terminal: false,
      };
    }
  }

  if (/print credit report|print report/.test(combined)) {
    push("print_button_copy");
    return {
      pageType: "equifax_print_entry",
      confidence: 0.78,
      matchedSignals,
      terminal: false,
    };
  }

  if (/\.pdf($|[?#])/.test(pageUrl) || /print|printable/.test(pageUrl)) {
    push("printable_url");
    return {
      pageType: "equifax_printable_view",
      confidence: 0.75,
      matchedSignals,
      terminal: false,
    };
  }

  return {
    pageType: "unexpected_screen",
    confidence: 0.15,
    matchedSignals,
    terminal: true,
  };
};

const refineEquifaxClassificationWithQuestionnaire = async (page, observation, classification) => {
  if (!page || classification?.pageType !== "equifax_security_questions") {
    return classification;
  }

  const extraction = await extractEquifaxSecurityQuestionnaire(page);
  const questions = Array.isArray(extraction?.questions) ? extraction.questions : [];
  const extractionSignals = Array.isArray(extraction?.matchedSignals) ? extraction.matchedSignals : [];
  const pageUrl = String(observation?.pageUrl ?? "").toLowerCase();
  const title = String(observation?.title ?? "").toLowerCase();
  const headings = Array.isArray(observation?.headings)
    ? observation.headings.join(" ").toLowerCase()
    : "";
  const buttons = Array.isArray(observation?.buttons)
    ? observation.buttons.join(" ").toLowerCase()
    : "";
  const fields = Array.isArray(observation?.fieldLabels)
    ? observation.fieldLabels.join(" ").toLowerCase()
    : "";
  const bodyText = String(observation?.bodyText ?? "").toLowerCase();
  const combined = [pageUrl, title, headings, buttons, fields, bodyText].join(" ");
  const matchedSignals = [...new Set([...(classification?.matchedSignals ?? []), ...extractionSignals])];
  const push = (signal) => {
    if (!matchedSignals.includes(signal)) {
      matchedSignals.push(signal);
    }
  };

  if (/otp-verify-get-pin/.test(pageUrl)) {
    if (hasOtpField) {
      push("otp_route_forced_to_enter_code");
      return {
        pageType: "equifax_enter_code",
        confidence: 0.98,
        matchedSignals,
        terminal: false,
      };
    }

    push("otp_route_forced_to_send_code");
    return {
      pageType: "equifax_send_code",
      confidence: 0.96,
      matchedSignals,
      terminal: false,
    };
  }

  if (questions.length > 0) {
    push("security_question_extraction_confirmed");
    return {
      ...classification,
      confidence: Math.max(classification?.confidence ?? 0, extraction?.confidence ?? 0),
      matchedSignals,
    };
  }

  const hasPhoneField =
    /mobile phone number|phone number/.test(fields) || /mobile phone number|phone number/.test(combined);
  const hasEmailField =
    /email address|current email|email/.test(fields) || /email address|current email/.test(combined);
  const hasOtpField = /passcode|verification code|one-time|one time|otp|security code/.test(fields);
  const hasSendCodeCopy =
    /send me a one-time passcode|yes,\s*send me a text|text me|call me|send code|send passcode/.test(combined);
  const hasCodeDeliveryCopy =
    /check your junk mail|check your spam|your email|email address|one[- ]time passcode|one[- ]time code|verification code|security code|we sent|send me a one[- ]time passcode|yes,\s*send me a text|text me|call me/.test(
      combined,
    );

  if (hasOtpField) {
    push("fallback_to_otp");
    return {
      pageType: "equifax_enter_code",
      confidence: 0.96,
      matchedSignals,
      terminal: false,
    };
  }

  if (hasSendCodeCopy || hasCodeDeliveryCopy || hasPhoneField || hasEmailField) {
    if (/verify-identity/.test(pageUrl) && hasPhoneField && hasEmailField) {
      push("fallback_to_contact");
      return {
        pageType: "equifax_contact",
        confidence: 0.92,
        matchedSignals,
        terminal: false,
      };
    }

    push("fallback_to_send_code");
    return {
      pageType: "equifax_send_code",
      confidence: 0.92,
      matchedSignals,
      terminal: false,
    };
  }

  push("security_question_extraction_empty");
  return {
    pageType: "unexpected_screen",
    confidence: Math.min(classification?.confidence ?? 0.4, 0.4),
    matchedSignals,
    terminal: true,
  };
};

const persistFailureBundle = async (session, store, tag, observation, extras = {}) => {
  const failureDir = path.join(session.workspaceDir, "failures");
  await fs.mkdir(failureDir, { recursive: true });
  const filePath = path.join(
    failureDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeSegment(tag)}.json`,
  );
  const payload = {
    tag,
    createdAt: new Date().toISOString(),
    expectedPageType: extras.expectedPageType ?? session.expectedPageType ?? null,
    observedPageType: extras.observedPageType ?? session.observedPageType ?? null,
    pageConfidence: extras.pageConfidence ?? session.pageConfidence ?? null,
    matchedSignals: extras.matchedSignals ?? session.matchedSignals ?? [],
    lastPrompt: session.pendingPrompt ?? null,
    lastAction: session.lastAction ?? null,
    observation,
    extras,
  };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8").catch(() => undefined);
  recordDebugEvent(store, session, "failure_bundle", `Persisted a failure bundle for ${tag}.`, {
    filePath,
    expectedPageType: payload.expectedPageType,
    observedPageType: payload.observedPageType,
  });
  return filePath;
};

const isBlankEquifaxObservation = (observation) => {
  if (!observation) {
    return true;
  }

  const bodyText = String(observation.bodyText ?? "").trim();
  const headings = Array.isArray(observation.headings) ? observation.headings : [];
  const buttons = Array.isArray(observation.buttons) ? observation.buttons : [];
  const fieldLabels = Array.isArray(observation.fieldLabels) ? observation.fieldLabels : [];
  const radioChoices = Array.isArray(observation.radioChoices) ? observation.radioChoices : [];
  const title = String(observation.title ?? "").trim();
  const pageUrl = String(observation.pageUrl ?? "").toLowerCase();
  const host = String(observation.host ?? "").toLowerCase();

  const looksLikeEquifaxSpaShell =
    host === "my.equifax.com" &&
    /consumer-registration\/acr\/index\.html/.test(pageUrl);

  if (!looksLikeEquifaxSpaShell) {
    return false;
  }

  return (
    bodyText.length < 25 &&
    title.toLowerCase() === "consumer registration" &&
    headings.length === 0 &&
    buttons.length === 0 &&
    fieldLabels.length === 0 &&
    radioChoices.length === 0
  );
};

const observeEquifaxPage = async (session, store, expectedPageType = null) => {
  const page = getActivePage(session);
  if (!page) {
    return {
      observation: null,
      pageType: "unexpected_screen",
      confidence: 0,
      matchedSignals: ["no_active_page"],
      terminal: true,
    };
  }

  let observation = await capturePageObservation(session, page, expectedPageType || session.currentStep || "equifax");
  let blankSpaRetryCount = 0;

  while (isBlankEquifaxObservation(observation) && blankSpaRetryCount < 4) {
    blankSpaRetryCount += 1;
    recordDebugEvent(
      store,
      session,
      "equifax_wait_for_content",
      "Equifax opened a blank registration shell, so the browser is waiting for the real verification page to hydrate before classifying it.",
      {
        expectedPageType,
        blankSpaRetryCount,
        pageUrl: observation.pageUrl,
        title: observation.title,
      },
    );
    await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => undefined);
    await page
      .waitForFunction(() => {
        const bodyText = String(document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
        if (bodyText.length > 40) {
          return true;
        }
        return Boolean(document.querySelector("input, button, select, textarea, h1, h2, h3, label"));
      }, { timeout: 2500 })
      .catch(() => undefined);
    await wait(1200);
    observation = await capturePageObservation(session, page, expectedPageType || session.currentStep || "equifax");
  }

  const initialClassification = classifyEquifaxPage(observation);
  const classification = await refineEquifaxClassificationWithQuestionnaire(
    page,
    observation,
    initialClassification,
  );
  store.setProgress(session, {
    currentBureau: "Equifax",
    currentUrl: observation.pageUrl,
    expectedPageType,
    observedPageType: classification.pageType,
    pageConfidence: classification.confidence,
    matchedSignals: classification.matchedSignals,
  });
  recordDebugEvent(
    store,
    session,
    "equifax_page_classification",
    `Observed Equifax page ${classification.pageType} with confidence ${classification.confidence.toFixed(2)}.`,
    {
      expectedPageType,
      observedPageType: classification.pageType,
      pageConfidence: classification.confidence,
      matchedSignals: classification.matchedSignals,
      pageUrl: observation.pageUrl,
      title: observation.title,
      headings: observation.headings,
      buttons: observation.buttons,
      fieldLabels: observation.fieldLabels,
      radioChoices: observation.radioChoices,
      screenshotPath: observation.screenshotPath,
      initialObservedPageType: initialClassification.pageType,
      refinedObservedPageType:
        initialClassification.pageType !== classification.pageType ? classification.pageType : null,
      blankSpaRetryCount,
    },
  );
  return {
    observation,
    ...classification,
  };
};

const extractEquifaxSecurityQuestionnaire = async (page) => {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0" ||
        element.hidden
      ) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const textOf = (element) =>
      String(
        element?.textContent ||
          element?.getAttribute?.("aria-label") ||
          element?.getAttribute?.("placeholder") ||
          "",
      )
        .replace(/\s+/g, " ")
        .trim();

    const bodyText = textOf(document.body);
    const bodyLower = bodyText.toLowerCase();
    const isOtpOrContactPage =
      /otp-verify-get-pin|one[- ]time passcode|one[- ]time code|verification code|check your junk mail|check your spam|let['’]s verify it['’]s you|valid phone number and email address|mobile phone number is required|email address is required|text me|call me|phone number|email address/.test(
        `${window.location.href.toLowerCase()} ${bodyLower}`,
      );
    const looksLikeRealQuestionPage =
      /which of the following|select one answer|answer the following|based on your credit file|knowledge[- ]based|security question|identity question/.test(
        bodyLower,
      );
    const looksLikeMarketingPage =
      /sign up now|checking your own credit will not harm it|products & services|credit offers & more|cancel at any time/.test(
        bodyLower,
      );

    if (looksLikeMarketingPage || (isOtpOrContactPage && !looksLikeRealQuestionPage)) {
      return {
        questions: [],
        confidence: 0,
        matchedSignals: [],
      };
    }

    const isQuestionPrompt = (value) =>
      typeof value === "string" &&
      /which of the following|select one answer|answer the following|based on your credit file|knowledge[- ]based|security question|identity question|\?$/.test(
        value.trim().toLowerCase(),
      ) &&
      !/email|phone|passcode|verification code|junk mail|spam|text me|call me/.test(value.trim().toLowerCase());

    const findPrompt = (element) => {
      const fieldset = element.closest("fieldset");
      const legendText = textOf(fieldset?.querySelector("legend"));
      if (legendText) {
        return legendText;
      }

      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy) {
        const label = document.getElementById(labelledBy);
        const labelText = textOf(label);
        if (labelText) {
          return labelText;
        }
      }

      if ("labels" in element && element.labels?.length) {
        const labelText = Array.from(element.labels).map((label) => textOf(label)).join(" ").trim();
        if (labelText) {
          return labelText;
        }
      }

      let current = element.closest("div, section, article");
      while (current) {
        const heading = Array.from(current.querySelectorAll("h1, h2, h3, h4, label, p, span"))
          .map((node) => textOf(node))
          .find((value) => value.length > 10 && isQuestionPrompt(value));
        if (heading) {
          return heading;
        }
        current = current.parentElement?.closest("div, section, article") ?? null;
      }

      return "";
    };

    const questions = [];
    const seen = new Set();

    const radioGroups = new Map();
    for (const input of Array.from(document.querySelectorAll("input[type='radio']"))) {
      if (!isVisible(input)) {
        continue;
      }
      const name = input.getAttribute("name") || input.getAttribute("id") || "";
      if (!name) {
        continue;
      }
      const existing = radioGroups.get(name) ?? [];
      existing.push(input);
      radioGroups.set(name, existing);
    }

    for (const [name, inputs] of radioGroups.entries()) {
      const prompt = findPrompt(inputs[0]);
      const choices = inputs
        .map((input) => {
          const labelText =
            "labels" in input && input.labels?.length
              ? Array.from(input.labels).map((label) => textOf(label)).join(" ").trim()
              : "";
          return {
            value: String(input.value ?? "").trim(),
            label: labelText || String(input.value ?? "").trim(),
          };
        })
        .filter((choice) => choice.label);
      if (!prompt || !isQuestionPrompt(prompt) || choices.length < 2) {
        continue;
      }
      const questionId = `radio:${name}`;
      if (seen.has(questionId)) {
        continue;
      }
      seen.add(questionId);
      questions.push({
        id: questionId,
        prompt,
        answerType: "choice",
        choices,
        fieldType: "radio",
        fieldName: name,
      });
    }

    for (const select of Array.from(document.querySelectorAll("select"))) {
      if (!isVisible(select)) {
        continue;
      }
      const prompt = findPrompt(select);
      const name = select.getAttribute("name") || select.getAttribute("id") || "";
      const choices = Array.from(select.options ?? [])
        .map((option) => ({
          value: String(option.value ?? "").trim(),
          label: textOf(option) || String(option.value ?? "").trim(),
        }))
        .filter((choice) => choice.label && choice.value);
      if (!prompt || !name || !isQuestionPrompt(prompt) || choices.length < 2) {
        continue;
      }
      const questionId = `select:${name}`;
      if (seen.has(questionId)) {
        continue;
      }
      seen.add(questionId);
      questions.push({
        id: questionId,
        prompt,
        answerType: "choice",
        choices,
        fieldType: "select",
        fieldName: name,
      });
    }

    return {
      questions,
      confidence: questions.length > 0 ? Math.min(0.98, 0.55 + questions.length * 0.12) : 0,
      matchedSignals: questions.map((question) => `${question.fieldType}:${question.fieldName}`),
    };
  }).catch(() => ({
    questions: [],
    confidence: 0,
    matchedSignals: [],
  }));
};

const applyEquifaxSecurityQuestionnaireAnswers = async (page, questions, answers) => {
  return page.evaluate(({ questions, answers }) => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0" ||
        element.hidden
      ) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const appliedQuestionIds = [];
    const answerMap = new Map(
      Array.isArray(answers)
        ? answers
            .map((entry) => ({
              questionId: String(entry?.questionId ?? "").trim(),
              value: String(entry?.value ?? "").trim(),
            }))
            .filter((entry) => entry.questionId && entry.value)
            .map((entry) => [entry.questionId, entry.value])
        : [],
    );

    for (const question of questions ?? []) {
      const value = answerMap.get(String(question?.id ?? ""));
      if (!value) {
        continue;
      }

      if (question.fieldType === "radio" && question.fieldName) {
        const radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${question.fieldName}"]`))
          .filter(isVisible);
        const match = radios.find((radio) => String(radio.value ?? "").trim() === value)
          ?? radios.find((radio) => {
            const labels =
              "labels" in radio && radio.labels?.length
                ? Array.from(radio.labels).map((label) => String(label.textContent ?? "").replace(/\s+/g, " ").trim()).join(" ")
                : "";
            return labels === value;
          });
        if (match) {
          match.click();
          appliedQuestionIds.push(question.id);
        }
      } else if (question.fieldType === "select" && question.fieldName) {
        const select = document.querySelector(`select[name="${question.fieldName}"], select#${question.fieldName}`);
        if (select instanceof HTMLSelectElement) {
          select.value = value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          appliedQuestionIds.push(question.id);
        }
      }
    }

    return {
      appliedQuestionIds,
      answerCount: answerMap.size,
    };
  }, {
    questions,
    answers,
  });
};

const promptForEquifaxSecurityQuestionnaireIfVisible = async (session, store, bureau) => {
  const page = getActivePage(session);
  if (!page) {
    return false;
  }

  const activeBureau = (await resolveVisibleBureau(session, store, bureau)) ?? "Equifax";
  const pageUrl = page.url();
  if (/my\.equifax\.com/i.test(pageUrl) && /otp-verify-get-pin/i.test(pageUrl.toLowerCase())) {
    recordDebugEvent(
      store,
      session,
      "equifax_security_questionnaire",
      "Skipped the Equifax questionnaire prompt because the visible page is still on the OTP route.",
      {
        bureau: activeBureau,
        pageUrl,
        detected: false,
        reason: "equifax_otp_route",
      },
    );
    return false;
  }
  const extraction = await extractEquifaxSecurityQuestionnaire(page);
  if (!Array.isArray(extraction.questions) || extraction.questions.length === 0) {
    return false;
  }

  if (extraction.confidence < 0.7) {
    const observation = await capturePageObservation(session, page, "equifax-security-low-confidence");
    await persistFailureBundle(session, store, "equifax-security-low-confidence", observation, {
      bureau: activeBureau,
      questions: extraction.questions,
      matchedSignals: extraction.matchedSignals,
      pageConfidence: extraction.confidence,
      observedPageType: "equifax_security_questions",
      expectedPageType: "equifax_security_questions",
    });
    throw new Error("Equifax showed identity questions, but the answers could not be extracted confidently enough to continue.");
  }

  store.appendLog(session, `${activeBureau} identity questions were extracted for the browser prompt.`);
  recordToolActivity(
    store,
    session,
    `${activeBureau} identity questions requested`,
    "The visible Equifax questions were mirrored into the browser prompt so the user can answer them there.",
    "waiting",
    "handoff",
  );

  const response = await store.requestPrompt(session, {
    type: "security_questionnaire",
    inputType: "questionnaire",
    title: "Answer the Equifax identity questions",
    description:
      "Answer the visible Equifax identity questions here. The browser will select the same answers on the page and continue only after the required answers are supplied.",
    submitLabel: "Use these answers",
    bureau: activeBureau,
    contextUrl: page.url(),
    questions: extraction.questions,
  });

  const answers = Array.isArray(response?.answers) ? response.answers : [];
  const applied = await applyEquifaxSecurityQuestionnaireAnswers(page, extraction.questions, answers);
  if ((applied?.appliedQuestionIds?.length ?? 0) === 0) {
    const observation = await capturePageObservation(session, page, "equifax-security-apply-failed");
    await persistFailureBundle(session, store, "equifax-security-apply-failed", observation, {
      bureau: activeBureau,
      questions: extraction.questions,
      providedAnswers: answers,
      observedPageType: "equifax_security_questions",
      expectedPageType: "equifax_security_questions",
    });
    throw new Error("The Equifax identity-question answers could not be mapped back onto the visible page.");
  }

  await runClickSequence(session, ["Continue", "CONTINUE", "Submit", "VERIFY MY IDENTITY", "Verify"]);
  recordToolActivity(
    store,
    session,
    `${activeBureau} identity questions applied`,
    "The user answered the Equifax identity questions in the prompt and the agent applied those answers on the page.",
    "completed",
    "handoff",
  );
  return true;
};

const requestOllamaJson = async ({ model, messages }) => {
  const response = await fetch(`${appConfig.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages,
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(payload || `Ollama request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const content = payload?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The model did not return JSON content.");
  }

  return JSON.parse(content);
};

const captureRecoverySnapshot = async (session, page, step) => {
  const recoveryDir = path.join(session.workspaceDir, "recovery");
  await fs.mkdir(recoveryDir, { recursive: true });
  const screenshotPath = path.join(
    recoveryDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeSegment(step)}.png`,
  );
  await page.screenshot({
    path: screenshotPath,
    fullPage: false,
  });
  const visibleText = await readVisiblePageText(page);

  return {
    screenshotPath,
    visibleText,
    currentUrl: page.url(),
  };
};

const analyzeRecoveryWithVision = async (snapshot, session, lastError, candidateTexts = []) => {
  const screenshotB64 = (await fs.readFile(snapshot.screenshotPath)).toString("base64");
  const prompt = {
    currentBureau: session.currentBureau,
    currentStep: session.currentStep,
    currentUrl: snapshot.currentUrl,
    lastError,
    candidateTexts,
    visibleText: snapshot.visibleText,
  };

  try {
    const parsed = await requestOllamaJson({
      model: appConfig.ollamaVisionModel,
      messages: [
        {
          role: "system",
          content:
            "You are helping a browser retrieval agent recover from UI drift on a credit-report site. Return strict JSON with keys: screenSummary, candidateLabels (array), suggestedAction (wait|scroll|retry_alternate_locator|click_candidate|ask_takeover), confidence (0-1), reasoning. Prefer visible buttons or links when they are obvious.",
        },
        {
          role: "user",
          content: `Analyze this browser screenshot and context:\n${JSON.stringify(prompt, null, 2)}`,
          images: [screenshotB64],
        },
      ],
    });

    return {
      screenSummary: String(parsed?.screenSummary ?? "").trim() || "Vision model inspected the current viewport.",
      candidateLabels: Array.isArray(parsed?.candidateLabels)
        ? parsed.candidateLabels.map((entry) => String(entry ?? "").trim()).filter(Boolean).slice(0, 6)
        : [],
      suggestedAction: String(parsed?.suggestedAction ?? "").trim(),
      confidence: Number(parsed?.confidence ?? 0),
      reasoning: String(parsed?.reasoning ?? "").trim(),
    };
  } catch (error) {
    return {
      screenSummary: snapshot.visibleText
        ? "Vision fallback used the visible page text because the local vision model did not respond."
        : "Vision fallback could not read the page automatically.",
      candidateLabels: candidateTexts.filter(Boolean).slice(0, 6),
      suggestedAction: candidateTexts.length ? "retry_alternate_locator" : "scroll",
      confidence: 0.2,
      reasoning: error instanceof Error ? error.message : String(error),
    };
  }
};

const chooseRecoveryAction = async ({ session, lastError, vision, candidateTexts = [] }) => {
  const allowlist = [
    "wait",
    "scroll",
    "retry_alternate_locator",
    "click_candidate",
    "ask_takeover",
  ];

  try {
    const parsed = await requestOllamaJson({
      model: appConfig.ollamaModel,
      messages: [
        {
          role: "system",
          content:
            "You are choosing the safest browser recovery action. Return strict JSON with keys: action, rationale, candidateLabels. action must be one of wait, scroll, retry_alternate_locator, click_candidate, ask_takeover. Prefer the smallest safe recovery step.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              currentBureau: session.currentBureau,
              currentStep: session.currentStep,
              retryCount: session.retryCount,
              lastError,
              vision,
              candidateTexts,
              allowlist,
            },
            null,
            2,
          ),
        },
      ],
    });

    const action = allowlist.includes(String(parsed?.action ?? "").trim())
      ? String(parsed.action).trim()
      : "ask_takeover";

    return {
      action,
      rationale: String(parsed?.rationale ?? "").trim() || "The local reasoning model selected a fallback action.",
      candidateLabels: Array.isArray(parsed?.candidateLabels)
        ? parsed.candidateLabels.map((entry) => String(entry ?? "").trim()).filter(Boolean).slice(0, 6)
        : [],
    };
  } catch {
    if (session.retryCount >= 2) {
      return {
        action: "ask_takeover",
        rationale: "The local reasoning model could not respond, so the agent is handing control back to the user.",
        candidateLabels: [],
      };
    }

    if (vision.suggestedAction && allowlist.includes(vision.suggestedAction)) {
      return {
        action: vision.suggestedAction,
        rationale: vision.reasoning || "The local vision model suggested the best visible fallback.",
        candidateLabels: vision.candidateLabels ?? [],
      };
    }

    return {
      action: candidateTexts.length ? "retry_alternate_locator" : "scroll",
      rationale: "The agent is using a safe heuristic fallback because model guidance was unavailable.",
      candidateLabels: candidateTexts.slice(0, 6),
    };
  }
};

const runRecoveryLoop = async (
  session,
  store,
  {
    step,
    title,
    lastError,
    candidateTexts = [],
    retryTexts = [],
    takeoverPrompt,
  },
) => {
  const page = getActivePage(session);
  if (!page) {
    return false;
  }

  const nextAttempt = (session.retryCount ?? 0) + 1;
  store.setProgress(session, {
    retryCount: nextAttempt,
  });
  store.setControllerState(session, {
    status: "recovery",
  });
  store.setRecoveryState(session, {
    status: "running",
    attemptCount: nextAttempt,
  });
  setAgentStep(session, store, step, {
    bureau: session.currentBureau,
    progress: session.progress?.progress ?? 0,
    stage: `${title} failed once. Capturing the page and planning a fallback...`,
    lastAction: title,
    mode: "recovery",
    url: page.url(),
  });
  recordToolActivity(
    store,
    session,
    `Recover ${title}`,
    `Attempt ${nextAttempt} of 2. Capturing the visible browser state before choosing the safest fallback.`,
    "running",
    "recovery",
  );
  recordDebugEvent(store, session, "recovery", `Starting recovery attempt ${nextAttempt} for ${title}.`, {
    step,
    title,
    lastError,
    candidateTexts,
    retryTexts,
    pageUrl: page.url(),
    attemptCount: nextAttempt,
  });

  const snapshot = await captureRecoverySnapshot(session, page, step);
  const vision = await analyzeRecoveryWithVision(snapshot, session, lastError, candidateTexts);
  const decision = await chooseRecoveryAction({
    session,
    lastError,
    vision,
    candidateTexts: [...candidateTexts, ...retryTexts],
  });

  store.setRecoveryState(session, {
    status: decision.action === "ask_takeover" ? "handoff" : "resolved",
    attemptCount: nextAttempt,
    lastDecision: decision.action,
    lastSummary: `${vision.screenSummary} ${decision.rationale}`.trim(),
    screenshotPath: snapshot.screenshotPath,
  });

  recordToolActivity(
    store,
    session,
    "Analyze recovery snapshot",
    `${vision.screenSummary}\nChosen fallback: ${decision.action}.\n${decision.rationale}`,
    "completed",
    "recovery",
  );
  recordDebugEvent(store, session, "recovery", `Recovery attempt ${nextAttempt} chose ${decision.action}.`, {
    step,
    title,
    lastError,
    pageUrl: page.url(),
    attemptCount: nextAttempt,
    screenshotPath: snapshot.screenshotPath,
    visionSummary: vision.screenSummary,
    decision: decision.action,
    rationale: decision.rationale,
    candidateLabels: decision.candidateLabels ?? [],
  });

  switch (decision.action) {
    case "wait":
      await wait(1500);
      break;
    case "scroll":
      await page.evaluate(() => {
        window.scrollBy({ top: Math.round(window.innerHeight * 0.6), left: 0, behavior: "auto" });
      }).catch(() => undefined);
      await wait(800);
      break;
    case "retry_alternate_locator":
      if (retryTexts.length) {
        await runClickSequence(session, retryTexts);
      }
      await wait(600);
      break;
    case "click_candidate":
      if (decision.candidateLabels.length) {
        await runClickSequence(session, decision.candidateLabels);
      } else if (candidateTexts.length) {
        await runClickSequence(session, candidateTexts);
      }
      await wait(600);
      break;
    case "ask_takeover":
    default:
      store.setControllerState(session, {
        status: "takeover",
      });
      await store.requestPrompt(session, {
        type: takeoverPrompt?.type ?? "manual_continue",
        inputType: takeoverPrompt?.inputType ?? "confirm",
        title: takeoverPrompt?.title ?? `${title} needs user takeover`,
        description:
          takeoverPrompt?.description ??
          `The site drifted during ${title}. Use the headed browser to fix the page or continue manually, then confirm from the browser prompt so the agent can resume.`,
        submitLabel: takeoverPrompt?.submitLabel ?? "Resume agent",
      });
      return true;
  }

  store.setControllerState(session, {
    status: "driving",
  });
  setAgentStep(session, store, step, {
    bureau: session.currentBureau,
    progress: session.progress?.progress ?? 0,
    stage: `Retrying ${title} after recovery attempt ${nextAttempt}...`,
    lastAction: title,
    mode: "driving",
    url: page.url(),
  });
  return true;
};

const attemptClickTextsWithRecovery = async (
  session,
  store,
  {
    step,
    title,
    texts,
    retryTexts = [],
    takeoverPrompt,
    successCheck,
  },
) => {
  let clicked = await runClickSequence(session, texts);
  recordDebugEvent(store, session, "click_sequence", clicked
    ? `Clicked one of the requested actions for ${title} without recovery.`
    : `No requested action was immediately available for ${title}.`, {
      step,
      title,
      pageUrl: session.currentUrl ?? getActivePage(session)?.url?.() ?? null,
      texts,
      retryTexts,
      clicked,
    });
  if (clicked) {
    return true;
  }

  while ((session.retryCount ?? 0) < 2) {
    const recovered = await runRecoveryLoop(session, store, {
      step,
      title,
      lastError: `The page did not expose any of these actions: ${texts.join(", ")}`,
      candidateTexts: texts,
      retryTexts,
      takeoverPrompt,
    });
    if (!recovered) {
      return false;
    }

    if (typeof successCheck === "function" && (await successCheck())) {
      return true;
    }

    clicked = await runClickSequence(session, texts);
    if (clicked) {
      return true;
    }
  }

  store.setControllerState(session, {
    status: "takeover",
  });
  store.setRecoveryState(session, {
    status: "handoff",
    attemptCount: session.retryCount ?? 2,
    lastDecision: "ask_takeover",
    lastSummary: `Two automated recovery attempts were exhausted while looking for: ${texts.join(", ")}`,
  });
  recordToolActivity(
    store,
    session,
    `Recover ${title}`,
    `Two automated recovery attempts were exhausted. The agent is handing the step back to the user.`,
    "waiting",
    "recovery",
  );
  await store.requestPrompt(session, {
    type: takeoverPrompt?.type ?? "manual_continue",
    inputType: takeoverPrompt?.inputType ?? "confirm",
    title: takeoverPrompt?.title ?? `${title} needs user takeover`,
    description:
      takeoverPrompt?.description ??
      `The site drifted during ${title}. Use the headed browser to fix the page or continue manually, then confirm from the browser prompt so the agent can resume.`,
    submitLabel: takeoverPrompt?.submitLabel ?? "Resume agent",
  });

  if (typeof successCheck === "function" && (await successCheck())) {
    recordDebugEvent(store, session, "click_sequence", `The success check passed for ${title} after user takeover.`, {
      step,
      title,
      pageUrl: session.currentUrl ?? getActivePage(session)?.url?.() ?? null,
      successSource: "success_check_after_takeover",
    });
    return true;
  }

  const finalClick = await runClickSequence(session, texts);
  recordDebugEvent(store, session, "click_sequence", finalClick
    ? `The final click sequence succeeded for ${title} after takeover.`
    : `The final click sequence still failed for ${title} after takeover.`, {
      step,
      title,
      pageUrl: session.currentUrl ?? getActivePage(session)?.url?.() ?? null,
      texts,
      retryTexts,
      clicked: finalClick,
      successSource: "final_click_after_takeover",
    });
  return finalClick;
};


const saveVisiblePageAsPdf = async (page, targetPath, { landscape = false } = {}) => {
  const client = await page.context().newCDPSession(page);
  const { data } = await client.send("Page.printToPDF", {
    landscape,
    printBackground: true,
    scale: 1,
    paperWidth: 8.5,
    paperHeight: 11,
    marginTop: 0.25,
    marginBottom: 0.25,
    marginLeft: 0.25,
    marginRight: 0.25,
  });
  await fs.writeFile(targetPath, Buffer.from(data, "base64"));
  const stat = await fs.stat(targetPath);
  return stat.size;
};

const attachPageToRuntime = (page, session, store) => {
  const runtime = session.runtime;
  if (!runtime) {
    return;
  }

  if (isTrackablePageUrl(page.url())) {
    runtime.page = page;
    recordDebugEvent(store, session, "page_attach", "Attached a new trackable page to the controlled-browser runtime.", {
      pageUrl: page.url(),
      trackable: true,
    });
  }

  page.on("console", (message) => {
    const text = String(message.text?.() ?? "").trim();
    if (!text) {
      return;
    }

    const type = String(message.type?.() ?? "log");
    const isAgenticMessage = /\[Agentic Browser debug\]|Agentic Browser content script loaded/i.test(text);
    const isRoutineAgenticNoise =
      isAgenticMessage &&
      /api-request start|api-request end|session-sync Refreshing|session-sync The controlled-browser session state refreshed successfully|session-sync rendered/i.test(
        text,
      );
    const isInterestingConsole =
      (isAgenticMessage && !isRoutineAgenticNoise) ||
      type === "error" ||
      type === "warning" ||
      /failed to load resource|acquisition|controller-ready|browser-debug/i.test(text);

    if (!isInterestingConsole) {
      return;
    }

    recordDebugEvent(store, session, "browser_console", text.slice(0, 500), {
      pageUrl: page.url(),
      type,
      text: text.slice(0, 2000),
      location: message.location?.() ?? null,
    });
  });

  page.on("pageerror", (error) => {
    recordDebugEvent(store, session, "browser_pageerror", error?.message || "A page error occurred inside the controlled browser.", {
      pageUrl: page.url(),
      stack: error?.stack ?? null,
    });
  });

  page.on("requestfailed", (request) => {
    if (!/127\.0\.0\.1:8787/i.test(request.url())) {
      return;
    }

    recordDebugEvent(store, session, "browser_requestfailed", "A controlled-browser API request failed inside the page context.", {
      pageUrl: page.url(),
      requestUrl: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText ?? null,
    });
  });

  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) {
      return;
    }
    if (!isTrackablePageUrl(page.url())) {
      return;
    }
    runtime.page = page;
    store.setProgress(session, {
      currentUrl: page.url(),
    });
    recordDebugEvent(store, session, "navigation", "The controlled browser navigated to a new main-frame page.", {
      pageUrl: page.url(),
      currentBureau: session.currentBureau ?? null,
      currentStep: session.currentStep ?? null,
    });
  });

  page.on("download", (download) => {
    const bureau = session.currentBureau;
    if (!bureau) {
      return;
    }

    void (async () => {
      try {
        const bureauKey = normalizeBureauKey(bureau);
        const fileName = buildReportFileName(bureauKey);
        const targetPath = path.join(session.reportsDir, fileName);
        await download.saveAs(targetPath);
        const stat = await fs.stat(targetPath);
        store.addDownloadedReport(session, {
          bureau,
          fileName,
          filePath: targetPath,
          sizeBytes: stat.size,
          captureMethod: "download",
        });
        store.appendLog(session, `${bureau} PDF download captured from the browser.`);
        recordDebugEvent(store, session, "download_capture", `Captured a browser download for ${bureau}.`, {
          bureau,
          pageUrl: page.url(),
          fileName,
          sizeBytes: stat.size,
        });
      } catch (error) {
        store.appendLog(
          session,
          `Failed to capture the ${bureau} download automatically: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
        recordDebugEvent(store, session, "download_capture", `Failed to capture a browser download for ${bureau}.`, {
          bureau,
          pageUrl: page.url(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  });
};

const promptToContinueInBrowser = async (session, store, title, description) => {
  store.appendLog(session, title);
  const page = getActivePage(session);
  await store.requestPrompt(session, {
    type: "manual_continue",
    inputType: "confirm",
    title,
    description,
    submitLabel: "Continue",
    bureau: session.currentBureau ?? null,
    contextUrl: page?.url?.() ?? session.currentUrl ?? null,
  });
};

const isSessionExpiredPage = async (page) => {
  if (!page) {
    return false;
  }

  if (/sessionExpired\.action/i.test(page.url())) {
    return true;
  }

  try {
    const pageText = await page.locator("body").innerText();
    return /session has expired/i.test(pageText);
  } catch {
    return false;
  }
};

const findRequestFormAnchor = async (page) =>
  waitForVisibleLocator(
    [
      page.getByLabel(/^First$/i),
      page.getByLabel(/Last/i),
      page.getByLabel(/Birthday/i),
      page.getByLabel(/Social Security Number/i),
      page.getByRole("textbox", { name: /^First$/i }),
      page.getByRole("textbox", { name: /Last/i }),
      page.getByRole("textbox", { name: /Birthday/i }),
    ],
    { timeoutMs: 5000, intervalMs: 250 },
  );

const isRequestFormReady = async (page) => {
  if (!page) {
    return false;
  }

  if (/requestForm\.action/i.test(page.url())) {
    return true;
  }

  const anchor = await findRequestFormAnchor(page);
  return Boolean(anchor);
};

const openRequestFormFromOfficialEntry = async (session, store) => {
  const page = getActivePage(session);
  if (!page) {
    throw new Error("The acquisition browser is not available.");
  }

  setAgentStep(session, store, "annualcreditreport_entry", {
    bureau: null,
    progress: 12,
    stage: "Opening AnnualCreditReport.com through the official homepage flow...",
    lastAction: "Navigate to AnnualCreditReport.com",
    mode: "driving",
    url: page.url(),
  });
  recordToolActivity(
    store,
    session,
    "Navigate to AnnualCreditReport",
    "Opening the official entry flow before any bureau-specific steps begin.",
    "running",
    "browser",
  );

  await page.goto("https://www.annualcreditreport.com/index.action", {
    waitUntil: "domcontentloaded",
  });
  await wait(1000);

  const homeStartClicked = await maybeClickByText(page, "Request your free credit reports");
  if (!homeStartClicked) {
    await page.goto("https://www.annualcreditreport.com/requestReport/landingPage.action", {
      waitUntil: "domcontentloaded",
    });
    await wait(1000);
  }

  const requestReportsClicked =
    (await maybeClickByText(page, "Request your credit reports")) ||
    (await maybeClickLocator(page.locator("#orderReport"))) ||
    (await maybeClickLocator(page.locator('a[href*="requestForm.action"]')));

  if (!requestReportsClicked) {
    await attemptClickTextsWithRecovery(session, store, {
      step: "annualcreditreport_entry",
      title: "Open AnnualCreditReport request flow",
      texts: ["Request your credit reports", "Request your free credit reports"],
      retryTexts: ["Get your free credit report", "Start request"],
      successCheck: async () => isRequestFormReady(page),
      takeoverPrompt: {
        title: "Open the AnnualCreditReport request page",
        description:
          "The homepage changed and the agent could not find the request button. Use the headed browser to open the official request flow, then continue from the browser prompt so the agent can keep going.",
      },
    });
  }

  const requestFormReady = await isRequestFormReady(page);
  if (!requestFormReady) {
    await attemptClickTextsWithRecovery(session, store, {
      step: "annualcreditreport_entry",
      title: "Open AnnualCreditReport request form",
      texts: ["Request your credit reports", "Request your free credit reports"],
      retryTexts: ["Get your free credit report", "Start request", "Next"],
      successCheck: async () => isRequestFormReady(page),
      takeoverPrompt: {
        title: "Open the request form in the browser",
        description:
          "The browser reached AnnualCreditReport.com, but the actual request form did not open yet. Use the headed browser to open the form with the personal-information fields, then continue from the browser prompt so the run can keep going.",
      },
    });
  }

  if (!(await isRequestFormReady(page))) {
    throw new Error("AnnualCreditReport.com never opened the actual request form. End the run and relaunch it.");
  }

  if (await isSessionExpiredPage(page)) {
    throw new Error("AnnualCreditReport.com expired the request session before the form could open.");
  }

  store.appendLog(session, "AnnualCreditReport.com request form opened through the normal entry flow.");
  recordToolActivity(
    store,
    session,
    "Official request flow opened",
    "The request form is open through the official AnnualCreditReport.com entry path.",
    "completed",
    "browser",
  );
};

const promptForOtpIfVisible = async (session, store, bureau) => {
  const page = getActivePage(session);
  if (!page) {
    recordDebugEvent(store, session, "otp_prompt", "Skipped OTP detection because no active page was available.", {
      bureau: bureau ?? session.currentBureau ?? null,
      pageUrl: null,
      detected: false,
    });
    return false;
  }
  const activeBureau = await resolveVisibleBureau(session, store, bureau);
  if (await guardUnexpectedPublicBureauPage(session, store, activeBureau)) {
    return true;
  }
  await abortForVisibleBureauSystemError(session, store, activeBureau);
  const pageUrl = page.url();
  const lowerPageUrl = pageUrl.toLowerCase();
  const isEquifaxOtpSendRoute =
    activeBureau === "Equifax" &&
    /my\.equifax\.com/i.test(pageUrl) &&
    /otp-verify-get-pin/i.test(lowerPageUrl);

  if (isEquifaxOtpSendRoute) {
    recordDebugEvent(store, session, "otp_prompt", "Equifax is on the send-code route.", {
      bureau: activeBureau,
      pageUrl,
      detected: true,
      route: "otp-verify-get-pin",
    });

    await dismissKnownVerificationOverlays(page, session, store);

    const clickedSendStep = await runClickSequence(session, [
      "YES, SEND ME A TEXT",
      "SEND ME A ONE-TIME PASSCODE",
      "Continue",
      "CONTINUE",
      "Text me",
      "Call me",
    ]);

    if (clickedSendStep) {
      recordDebugEvent(store, session, "otp_prompt", "The agent advanced the Equifax send-code step.", {
        bureau: activeBureau,
        pageUrl: page.url(),
        detected: true,
        route: "otp-verify-get-pin",
        clickedSendStep: true,
      });
      await wait(1500);
      await dismissKnownVerificationOverlays(page, session, store);
    }
  }

  const otpField = await waitForVisibleLocator([
    page.getByLabel(/passcode|verification code|one[- ]time|otp|security code/i),
    page.getByRole("textbox", { name: /passcode|verification code|one[- ]time|otp|security code/i }),
    page.getByPlaceholder(/passcode|verification code|one[- ]time|otp|security code/i),
    page.getByText(/enter (the )?(verification|security|pass)code/i),
  ], { timeoutMs: 20000, intervalMs: 350 });
  if (!otpField) {
    if (isEquifaxOtpSendRoute) {
      const pageText = await page.locator("body").innerText().catch(() => "");
      const looksLikeCodeDeliveryStep =
        /check your junk mail|check your spam|your email|one[- ]time passcode|one[- ]time code|text me|call me|send me a one[- ]time passcode|yes,\s*send me a text/i.test(
          pageText,
        );

      if (looksLikeCodeDeliveryStep) {
        recordDebugEvent(store, session, "otp_prompt", "Equifax is still preparing or delivering the one-time code.", {
          bureau: activeBureau,
          pageUrl: page.url(),
          detected: true,
          route: "otp-verify-get-pin",
          codeFieldVisible: false,
        });
        recordToolActivity(
          store,
          session,
          `${activeBureau} one-time code step`,
          "Equifax is preparing or sending the one-time code. The user should keep the page moving until the code-entry field is visible.",
          "waiting",
          "handoff",
        );
        await store.requestPrompt(session, {
          type: "manual_continue",
          inputType: "confirm",
          title: "Prepare the Equifax one-time code step",
          description:
            "Equifax is on the page that sends or prepares the one-time code. If the page asks you to send the code or continue, use the visible page to do that. When the actual code-entry field is visible, continue here and the browser will ask for the code.",
          submitLabel: "The code field is visible",
          bureau: activeBureau,
          contextUrl: page.url(),
        });
        return true;
      }
    }

    recordDebugEvent(store, session, "otp_prompt", `No OTP field was visible for ${activeBureau}.`, {
      bureau: activeBureau,
      pageUrl: page.url(),
      detected: false,
    });
    return false;
  }

  recordDebugEvent(store, session, "otp_prompt", `Detected an OTP field for ${activeBureau}.`, {
    bureau: activeBureau,
    pageUrl: page.url(),
    detected: true,
  });

  store.appendLog(session, `${activeBureau} requested a verification code from the user.`);
  recordToolActivity(
    store,
    session,
    `${activeBureau} verification code requested`,
    "The agent is pausing for a user-owned OTP or passcode before it can continue.",
    "waiting",
    "handoff",
  );
  recordDebugEvent(store, session, "otp_prompt", `Requesting an OTP prompt for ${activeBureau}.`, {
    bureau: activeBureau,
    pageUrl: page.url(),
    detected: true,
    decision: "request_prompt",
  });
  const response = await store.requestPrompt(session, {
    type: "otp_code",
    inputType: "text",
    title: "Enter the code sent to your phone",
    description:
      "Enter the one-time code that was sent to your phone for the visible verification page. The browser will stay paused until the code is submitted.",
    placeholder: "Enter code",
    submitLabel: "Submit code",
    bureau: activeBureau,
    contextUrl: page.url(),
  });
  const otp = coercePromptValue(response);
  if (!otp) {
    recordDebugEvent(store, session, "otp_prompt", `The ${activeBureau} OTP prompt closed without a code.`, {
      bureau: activeBureau,
      pageUrl: page.url(),
      detected: true,
      submitted: false,
    });
    throw new Error(`A ${activeBureau} passcode was required, but no code was provided.`);
  }

  const filledOtp = await maybeFillOtpField(page, otp);
  recordDebugEvent(store, session, "otp_prompt", `Applied the OTP for ${activeBureau}.`, {
    bureau: activeBureau,
    pageUrl: page.url(),
    detected: true,
    submitted: true,
    filledOtp,
    codeLength: otp.length,
  });
  recordToolActivity(
    store,
    session,
    `${activeBureau} code entered`,
    "The user provided the verification code and the agent is resuming the bureau flow.",
    "completed",
    "handoff",
  );
  await runClickSequence(session, [
    "VERIFY MY IDENTITY",
    "Verify",
    "Submit",
    "Continue",
    "CONTINUE",
  ]);
  return true;
};

const promptForSecurityQuestionsIfVisible = async (session, store, bureau) => {
  const page = getActivePage(session);
  if (!page) {
    recordDebugEvent(store, session, "security_prompt", "Skipped security-question detection because no active page was available.", {
      bureau: bureau ?? session.currentBureau ?? null,
      pageUrl: null,
      detected: false,
    });
    return false;
  }
  const activeBureau = await resolveVisibleBureau(session, store, bureau);
  if (await guardUnexpectedPublicBureauPage(session, store, activeBureau)) {
    return true;
  }
  await abortForVisibleBureauSystemError(session, store, activeBureau);
  const pageUrl = page.url();
  const lowerPageUrl = pageUrl.toLowerCase();

  if (
    activeBureau === "Equifax" &&
    /my\.equifax\.com/i.test(pageUrl) &&
    /otp-verify-get-pin/i.test(lowerPageUrl)
  ) {
    recordDebugEvent(store, session, "security_prompt", "Skipped security-question detection on the Equifax OTP route.", {
      bureau: activeBureau,
      pageUrl,
      detected: false,
      reason: "equifax_otp_route",
    });
    return false;
  }

  const contactSignals = await detectContactVerificationSignals(page);
  if (contactSignals.detected) {
    recordDebugEvent(store, session, "security_prompt", `Skipped security-question detection because ${activeBureau} is still on a contact or passcode step.`, {
      bureau: activeBureau,
      pageUrl,
      detected: false,
      reason: "contact_or_code_step",
      matchedSignals: contactSignals.matchedSignals,
      detectionSource: contactSignals.detectionSource,
    });
    return false;
  }

  const pageText = await readVisiblePageText(page);
  if (/one[- ]time passcode|one[- ]time code|passcode|verification code|send me a text|send me a one[- ]time passcode|text me|call me|check your junk mail|check your spam/i.test(pageText)) {
    recordDebugEvent(store, session, "security_prompt", `Skipped security-question detection because ${activeBureau} is still on the code-delivery or OTP step.`, {
      bureau: activeBureau,
      pageUrl,
      detected: false,
      reason: "otp_delivery_step",
    });
    return false;
  }

  const questionSignals = [
    page.getByText(/which of the following/i),
    page.getByText(/select one answer/i),
    page.getByText(/knowledge[- ]based/i),
    page.getByText(/answer the following/i),
    page.getByText(/based on your credit file/i),
  ];

  const visibleSignal = await findFirstVisibleLocator(questionSignals);
  if (!visibleSignal) {
    recordDebugEvent(store, session, "security_prompt", `No visible security questions were found for ${activeBureau}.`, {
      bureau: activeBureau,
      pageUrl: page.url(),
      detected: false,
    });
    return false;
  }

  recordDebugEvent(store, session, "security_prompt", `Detected visible security questions for ${activeBureau}.`, {
    bureau: activeBureau,
    pageUrl: page.url(),
    detected: true,
  });

  store.appendLog(session, `${activeBureau} security questions need the user.`);
  recordDebugEvent(store, session, "security_prompt", `Requesting a security-question prompt for ${activeBureau}.`, {
    bureau: activeBureau,
    pageUrl: page.url(),
    detected: true,
    decision: "request_prompt",
  });
  await store.requestPrompt(session, {
    type: "security_question",
    inputType: "confirm",
    title: "Answer the visible security questions",
    description:
      "This verification page is showing identity or security questions that only the user should answer. Answer them directly in the visible browser page, then continue once the report is ready to open or save.",
    submitLabel: "I answered the questions",
    bureau: activeBureau,
    contextUrl: page.url(),
  });
  recordToolActivity(
    store,
    session,
    `${activeBureau} security questions handed to user`,
    "The agent detected file-based or identity questions and paused instead of guessing.",
    "waiting",
    "handoff",
  );
  return true;
};

const detectContactVerificationSignals = async (page) => {
  if (!page) {
    return {
      detected: false,
      matchedSignals: [],
      detectionSource: "no_page",
    };
  }

  try {
    const visibleFieldSummary = await page.evaluate(() => {
      const isVisible = (element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const style = window.getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0" ||
          element.hidden
        ) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const inputs = Array.from(document.querySelectorAll("input, textarea, select"))
        .filter((element) => isVisible(element))
        .map((element) => {
          const labels = "labels" in element && element.labels
            ? Array.from(element.labels).map((label) => label.textContent ?? "").join(" ")
            : "";
          const describedBy =
            element instanceof HTMLElement && element.getAttribute("aria-describedby")
              ? element.getAttribute("aria-describedby")
                  .split(/\s+/)
                  .map((id) => document.getElementById(id)?.textContent ?? "")
                  .join(" ")
              : "";
          const combined = [
            labels,
            element.getAttribute?.("aria-label") ?? "",
            element.getAttribute?.("placeholder") ?? "",
            element.getAttribute?.("name") ?? "",
            element.getAttribute?.("id") ?? "",
            describedBy,
          ]
            .join(" ")
            .toLowerCase();

          return {
            tagName: element.tagName.toLowerCase(),
            type: "type" in element ? String(element.type ?? "").toLowerCase() : "",
            combined,
          };
        });

      const phoneLike = inputs.some(({ combined, type }) =>
        /phone|mobile|cell/.test(combined) || type === "tel",
      );
      const emailLike = inputs.some(({ combined, type }) =>
        /email/.test(combined) || type === "email",
      );
      const codeLike = inputs.some(({ combined, type }) =>
        /otp|passcode|verification code|security code|one[- ]time/.test(combined) || type === "number",
      );
      const visibleFieldCount = inputs.length;

      return {
        phoneLike,
        emailLike,
        codeLike,
        visibleFieldCount,
      };
    });

    const matchedSignals = [];
    if (visibleFieldSummary.phoneLike) {
      matchedSignals.push("visible_phone_field");
    }
    if (visibleFieldSummary.emailLike) {
      matchedSignals.push("visible_email_field");
    }
    if (visibleFieldSummary.codeLike) {
      matchedSignals.push("visible_code_field");
    }

    const looksLikeContactStep =
      visibleFieldSummary.phoneLike &&
      (visibleFieldSummary.emailLike || visibleFieldSummary.visibleFieldCount >= 2) &&
      !visibleFieldSummary.codeLike;

    if (looksLikeContactStep) {
      return {
        detected: true,
        matchedSignals,
        detectionSource: "visible_fields",
      };
    }
  } catch {
    // best-effort only
  }

  const signalDefinitions = [
    {
      name: "labeled_contact_field",
      locator: page.getByLabel(/Email Address|Email|Phone Number|Mobile phone number|Mobile Number|Phone/i),
    },
    {
      name: "textbox_contact_field",
      locator: page.getByRole("textbox", { name: /Email Address|Email|Phone Number|Mobile phone number|Mobile Number|Phone/i }),
    },
    {
      name: "placeholder_contact_field",
      locator: page.getByPlaceholder(/Email Address|Email|Phone Number|Mobile phone number|Mobile Number|Phone/i),
    },
    {
      name: "contact_copy",
      locator: page.getByText(/provide your current email and phone number/i),
    },
    {
      name: "verification_copy",
      locator: page.getByText(/text or call you to verify your identity/i),
    },
    {
      name: "valid_phone_email_copy",
      locator: page.getByText(/please enter a valid phone number and email address/i),
    },
    {
      name: "phone_required_copy",
      locator: page.getByText(/mobile phone number is required/i),
    },
    {
      name: "email_required_copy",
      locator: page.getByText(/email address is required/i),
    },
  ];

  const visibleContactField = await waitForVisibleLocator(signalDefinitions.map(({ locator }) => locator), {
    timeoutMs: 5000,
    intervalMs: 300,
  });

  if (visibleContactField) {
    const matchedSignals = [];
    for (const { name, locator } of signalDefinitions) {
      try {
        if ((await locator.count()) > 0 && (await locator.first().isVisible())) {
          matchedSignals.push(name);
        }
      } catch {
        // best-effort only
      }
    }
    return {
      detected: true,
      matchedSignals: matchedSignals.length ? matchedSignals : ["visible_contact_locator"],
      detectionSource: "locator",
    };
  }

  try {
    const pageText = await page.locator("body").innerText();
    const matchedSignals = [];
    if (/phone number/i.test(pageText)) {
      matchedSignals.push("body_phone_number");
    }
    if (/email/i.test(pageText)) {
      matchedSignals.push("body_email");
    }
    if (/verify your identity|we'?ll need a bit more info|text or call/i.test(pageText)) {
      matchedSignals.push("body_verification_copy");
    }
    return {
      detected: matchedSignals.includes("body_phone_number") &&
        matchedSignals.includes("body_email") &&
        matchedSignals.includes("body_verification_copy"),
      matchedSignals,
      detectionSource: "body_text",
    };
  } catch {
    return {
      detected: false,
      matchedSignals: [],
      detectionSource: "read_failed",
    };
  }
};

const promptForContactConfirmationIfVisible = async (session, store, bureau) => {
  const page = getActivePage(session);
  if (!page) {
    recordDebugEvent(store, session, "contact_prompt", "Skipped contact verification because no active page was available.", {
      bureau: bureau ?? session.currentBureau ?? null,
      pageUrl: null,
      detected: false,
      decision: "no_page",
    });
    return false;
  }
  const activeBureau = await resolveVisibleBureau(session, store, bureau);
  if (await guardUnexpectedPublicBureauPage(session, store, activeBureau)) {
    return true;
  }
  await abortForVisibleBureauSystemError(session, store, activeBureau);
  const contactState = getContactPromptState(session, activeBureau, page.url());
  const contactSignals = await detectContactVerificationSignals(page);

  recordDebugEvent(
    store,
    session,
    "contact_detection",
    contactSignals.detected
      ? `Detected contact verification signals for ${activeBureau}.`
      : `No contact verification signals were found for ${activeBureau}.`,
    {
      bureau: activeBureau,
      pageUrl: page.url(),
      detected: contactSignals.detected,
      matchedSignals: contactSignals.matchedSignals,
      detectionSource: contactSignals.detectionSource,
      contactPromptState: {
        prompted: contactState.prompted,
        silentRetryCount: contactState.silentRetryCount,
        submissionCount: contactState.submissionCount,
      },
    },
  );

  if (!contactSignals.detected) {
    return false;
  }

  const storedPhone = String(session.input?.phone ?? "").trim();
  if (contactState.prompted && storedPhone && contactState.silentRetryCount < 1) {
    contactState.silentRetryCount += 1;
    recordToolActivity(
      store,
      session,
      `Retry ${activeBureau} phone entry`,
      "The page still needs the phone number. The agent is retrying the saved number before asking the user again.",
      "running",
      "handoff",
    );
    const fillResult = await fillContactVerificationFields(page, {
      phone: storedPhone,
      email: String(session.input?.email ?? "").trim(),
    }, { session, store });

    recordDebugEvent(store, session, "contact_prompt", `Tried the silent retry path for ${activeBureau}.`, {
      bureau: activeBureau,
      pageUrl: page.url(),
      decision: "silent_retry",
      phoneLength: storedPhone.length,
      filledPhone: fillResult.filledPhone,
      filledEmail: fillResult.filledEmail,
      selectedTextMethod: fillResult.selectedText,
    });

    if (!fillResult.filledPhone) {
      recordDebugEvent(store, session, "contact_prompt", `The silent retry could not fill the ${activeBureau} phone field, so the agent is asking for manual confirmation.`, {
        bureau: activeBureau,
        pageUrl: page.url(),
        decision: "manual_continue_after_retry",
        filledPhone: fillResult.filledPhone,
        filledEmail: fillResult.filledEmail,
        selectedTextMethod: fillResult.selectedText,
      });
      await store.requestPrompt(session, {
        type: "manual_continue",
        inputType: "confirm",
        title: "Finish the visible phone field in the browser",
        description:
          "The phone field did not accept automation on this page. Enter the phone number directly on the visible browser page, then continue so the agent can move to the verification-code step.",
        submitLabel: "The phone field is ready",
        bureau: activeBureau,
        contextUrl: page.url(),
      });
    }

    return true;
  }

  recordToolActivity(
    store,
    session,
    `Pause for ${activeBureau} contact entry`,
    "The bureau is asking for contact details. The agent is pausing so the user can confirm the phone number that should be entered on the visible verification page.",
    "waiting",
    "handoff",
  );
  recordDebugEvent(store, session, "contact_prompt", `Requesting a phone-number prompt for ${activeBureau}.`, {
    bureau: activeBureau,
    pageUrl: page.url(),
    decision: "request_prompt",
    matchedSignals: contactSignals.matchedSignals,
    detectionSource: contactSignals.detectionSource,
    storedPhoneLength: storedPhone.length,
  });
  const response = await store.requestPrompt(session, {
    type: "contact_confirm",
    inputType: "text",
    title: contactState.prompted ? "Re-enter your phone number to continue" : "Enter your phone number to continue",
    description:
      "We will enter the phone number on the visible verification page, fill the saved email automatically, and then move to the one-time code step.",
    placeholder: "Phone number",
    defaultValue: storedPhone,
    submitLabel: "Use this phone number",
    bureau: activeBureau,
    contextUrl: page.url(),
  });
  const phone = coercePromptValue(response) || String(session.input?.phone ?? "").trim();
  if (!phone) {
    recordDebugEvent(store, session, "contact_prompt", `The ${activeBureau} contact prompt closed without a phone number.`, {
      bureau: activeBureau,
      pageUrl: page.url(),
      decision: "missing_phone",
    });
    throw new Error("A phone number is required before this verification step can continue.");
  }

  session.input.phone = phone;
  contactState.prompted = true;
  contactState.lastPhone = phone;
  contactState.lastSubmittedAt = new Date().toISOString();
  contactState.submissionCount += 1;
  contactState.silentRetryCount = 0;
  const fillResult = await fillContactVerificationFields(page, {
    phone,
    email: String(session.input?.email ?? "").trim(),
  }, { session, store });

  recordDebugEvent(store, session, "contact_prompt", `Filled the visible ${activeBureau} contact fields after the user submitted a phone number.`, {
    bureau: activeBureau,
    pageUrl: page.url(),
    decision: "prompt_submitted",
    phoneLength: phone.length,
    filledPhone: fillResult.filledPhone,
    filledEmail: fillResult.filledEmail,
    selectedTextMethod: fillResult.selectedText,
    matchedSignals: contactSignals.matchedSignals,
  });

  if (!fillResult.filledPhone) {
    recordDebugEvent(store, session, "contact_prompt", `The ${activeBureau} phone field still rejected automation, so the agent switched to manual continue.`, {
      bureau: activeBureau,
      pageUrl: page.url(),
      decision: "manual_continue_after_fill",
      phoneLength: phone.length,
      filledPhone: fillResult.filledPhone,
      filledEmail: fillResult.filledEmail,
      selectedTextMethod: fillResult.selectedText,
    });
    await store.requestPrompt(session, {
      type: "manual_continue",
      inputType: "confirm",
      title: "Finish the visible phone field in the browser",
      description:
        "The phone field did not accept automation on this page. Enter the phone number directly on the visible browser page, then continue so the agent can request the verification code.",
      submitLabel: "The phone field is ready",
      bureau: activeBureau,
      contextUrl: page.url(),
    });
  }

  recordToolActivity(
    store,
    session,
    `${activeBureau} contact fields prepared`,
    "The phone number was captured from the user prompt and entered into the visible verification page. The agent will now continue to the OTP step.",
    "completed",
    "handoff",
  );
  return true;
};

const shouldStopAfterFirstSavedReport = (session) => session?.input?.stopAfterFirstSavedReport !== false;

const waitForDownloadedReport = async (session, bureau, timeoutMs = 8000) => {
  const bureauKey = normalizeBureauKey(bureau);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const existingReport = session.downloadedReports.find((entry) => entry.bureauKey === bureauKey);
    if (existingReport) {
      return existingReport;
    }
    await wait(250);
  }

  return null;
};

const preparePrintableReport = async (session, store, bureau) => {
  const page = getActivePage(session);
  if (!page) {
    return false;
  }

  const activeBureau = (await resolveVisibleBureau(session, store, bureau)) ?? bureau;
  const candidateTexts =
    {
      TransUnion: ["Print Report", "Print", "Save Report", "View Printable Report"],
      Equifax: ["Print Credit Report", "Print Report", "Print", "Save Report", "Download Report"],
      Experian: ["Print Report", "Print", "Save Report", "Download Report"],
    }[activeBureau] ?? ["Print Report", "Print", "Save Report", "Download Report"];

  recordDebugEvent(store, session, "print_prepare", `Checking the visible ${activeBureau} report for a print or save control.`, {
    bureau: activeBureau,
    pageUrl: page.url(),
    candidateTexts,
  });

  for (const text of candidateTexts) {
    const clicked = await maybeClickByText(page, text);
    if (!clicked) {
      continue;
    }

    recordToolActivity(
      store,
      session,
      `Open ${activeBureau} print flow`,
      `The agent clicked "${text}" to move the ${activeBureau} report into a printable or downloadable view.`,
      "running",
      "browser",
    );

    recordDebugEvent(store, session, "print_prepare", `Clicked a print/save control for ${activeBureau}.`, {
      bureau: activeBureau,
      pageUrl: page.url(),
      clickedText: text,
    });

    await waitForDownloadedReport(session, activeBureau, 3000);
    return true;
  }

  recordDebugEvent(store, session, "print_prepare", `No visible print/save control was found for ${activeBureau}. The agent will fall back to saving the visible report page.`, {
    bureau: activeBureau,
    pageUrl: page.url(),
    candidateTexts,
  });
  return false;
};

const ensureReportSaved = async (session, store, bureau, { landscape = false, captureMethod = "fallback_pdf" } = {}) => {
  const activeBureau = (await resolveVisibleBureau(session, store, bureau)) ?? bureau;
  const bureauKey = normalizeBureauKey(activeBureau);
  const existingReport = session.downloadedReports.find((entry) => entry.bureauKey === bureauKey);
  if (existingReport) {
    return existingReport;
  }

  const page = getActivePage(session);
  if (!page) {
    throw new Error(`The ${activeBureau} report could not be saved because the browser page is unavailable.`);
  }

  setAgentStep(session, store, "save_pdf", {
    bureau: activeBureau,
    progress: session.progress?.progress ?? 0,
    stage: `Saving the ${activeBureau} report as a PDF...`,
    lastAction: `Save ${activeBureau} report`,
    mode: "driving",
    url: page.url(),
  });
  const fileName = buildReportFileName(bureauKey);
  const targetPath = path.join(session.reportsDir, fileName);
  const downloadedReport = await waitForDownloadedReport(session, activeBureau, 2500);
  if (downloadedReport) {
    if (!downloadedReport.captureMethod) {
      downloadedReport.captureMethod = "download";
    }
    recordToolActivity(
      store,
      session,
      `${activeBureau} PDF download captured`,
      `The browser download flow produced the ${activeBureau} PDF without needing a print-to-PDF fallback.`,
      "completed",
      "download",
    );
    return downloadedReport;
  }
  const sizeBytes = await saveVisiblePageAsPdf(page, targetPath, { landscape });
  store.addDownloadedReport(session, {
    bureau: activeBureau,
    fileName,
    filePath: targetPath,
    sizeBytes,
    captureMethod,
  });
  store.appendLog(session, `${activeBureau} report saved to PDF${landscape ? " in landscape mode" : ""}.`);
  recordToolActivity(
    store,
    session,
    `Save ${activeBureau} report`,
    `${activeBureau} was captured as a PDF${landscape ? " in landscape mode" : ""} and staged on the profile.`,
    "completed",
    "download",
  );
  return session.downloadedReports.find((entry) => entry.bureauKey === bureauKey) ?? null;
};

const returnToAnnualCreditReport = async (session, store, bureau) => {
  const activeBureau = (await resolveVisibleBureau(session, store, bureau)) ?? bureau;
  setAgentStep(session, store, "return_to_hub", {
    bureau: activeBureau,
    progress: session.progress?.progress ?? 0,
    stage: `Returning to AnnualCreditReport.com after ${activeBureau}...`,
    lastAction: `Return from ${activeBureau}`,
    mode: "driving",
  });
  recordToolActivity(
    store,
    session,
    `Return from ${activeBureau}`,
    "Moving back to AnnualCreditReport.com to continue the next bureau step.",
    "running",
    "browser",
  );
  await attemptClickTextsWithRecovery(session, store, {
    step: "return_to_hub",
    title: `Return from ${activeBureau}`,
    texts: [
      "Get your next report or finish",
      "RETURN TO ANNUALCREDITREPORT.COM",
      "Get your next credit report",
    ],
    retryTexts: ["Finish", "Continue"],
    takeoverPrompt: {
      title: `Return to AnnualCreditReport.com after ${activeBureau}`,
      description:
        `Use the headed browser to return from ${activeBureau} back to AnnualCreditReport.com, then continue from the browser prompt when the next-report screen is ready.`,
    },
  });

  const page = getActivePage(session);
  if (!page || !/annualcreditreport\.com/i.test(page.url())) {
    await promptToContinueInBrowser(
      session,
      store,
      `Return to AnnualCreditReport.com after ${activeBureau}`,
      `Use the headed browser to return to AnnualCreditReport.com and open the next credit report. Once the next-report screen is ready, continue from the browser prompt.`,
    );
  }
};

const getRemainingBureauKeys = (session) => {
  const completed = new Set((session.downloadedReports ?? []).map((entry) => normalizeBureauKey(entry?.bureauKey ?? entry?.bureau)));
  return getRequestedBureauKeys(session).filter((bureauKey) => !completed.has(bureauKey));
};

const findOpenRequestedBureauPage = async (session, store, remainingBureauKeys, timeoutMs = 0) => {
  const runtime = session.runtime;
  const deadline = Date.now() + timeoutMs;

  do {
    const pages = runtime?.context?.pages?.() ?? [];
    for (const candidate of pages) {
      const pageUrl = candidate.url();
      if (!isTrackablePageUrl(pageUrl)) {
        continue;
      }

      const bureau = inferBureauFromUrl(pageUrl, null);
      const bureauKey = normalizeBureauKey(bureau);
      if (!bureauKey || !remainingBureauKeys.includes(bureauKey)) {
        continue;
      }

      if (runtime) {
        runtime.page = candidate;
      }
      await candidate.bringToFront().catch(() => undefined);
      store.setProgress(session, {
        currentBureau: bureau,
        currentUrl: pageUrl,
      });
      recordDebugEvent(store, session, "bureau_dispatch", `Found the open ${bureau} page before clicking the next-bureau control.`, {
        pageUrl,
        remainingBureauKeys,
      });
      return bureau;
    }

    if (Date.now() >= deadline) {
      break;
    }
    await wait(250);
  } while (true);

  return null;
};

const openNextBureauIfNeeded = async (session, store, remainingBureauKeys) => {
  const openRequestedBureau = await findOpenRequestedBureauPage(session, store, remainingBureauKeys, 10000);
  if (openRequestedBureau) {
    return openRequestedBureau;
  }

  const page = getActivePage(session);
  if (!page) {
    return null;
  }

  const pageUrl = page.url();
  const visibleBureau = await resolveVisibleBureau(session, store, null);
  if (visibleBureau && remainingBureauKeys.includes(normalizeBureauKey(visibleBureau))) {
    return visibleBureau;
  }

  if (/annualcreditreport\.com/i.test(pageUrl)) {
    recordDebugEvent(
      store,
      session,
      "bureau_dispatch",
      "The session is back on AnnualCreditReport.com, so the agent is opening the next available bureau page.",
      {
        pageUrl,
        remainingBureauKeys,
      },
    );
    await attemptClickTextsWithRecovery(session, store, {
      step: "bureau_selection",
      title: "Open the next available bureau page",
      texts: [
        "Get your next report or finish",
        "Get your next credit report",
        "Continue",
        "Next",
      ],
      retryTexts: ["Review your reports online", "Return to AnnualCreditReport.com"],
      takeoverPrompt: {
        title: "Open the next bureau page in the browser",
        description:
          "The agent is back on AnnualCreditReport.com and needs the next bureau page to open. Use the headed browser to move into the next bureau, then continue from the browser prompt.",
      },
    });
    return resolveVisibleBureau(session, store, null);
  }

  return visibleBureau;
};

const runPendingBureauFlows = async (session, store) => {
  const flowHandlers = {
    transunion: completeTransUnion,
    equifax: completeEquifax,
    experian: completeExperian,
  };

  const maxFlowPasses = 6;
  for (let pass = 0; pass < maxFlowPasses; pass += 1) {
    const remainingBureauKeys = getRemainingBureauKeys(session);
    if (!remainingBureauKeys.length) {
      recordDebugEvent(store, session, "bureau_dispatch", "All requested bureau flows have been completed.", {
        completedBureauKeys: (session.downloadedReports ?? []).map((entry) => normalizeBureauKey(entry?.bureauKey ?? entry?.bureau)),
        pass,
      });
      return;
    }

    const visibleBureau = await openNextBureauIfNeeded(session, store, remainingBureauKeys);
    const visibleBureauKey = normalizeBureauKey(visibleBureau);
    const fallbackBureau = bureauKeyToName(remainingBureauKeys[0]);
    const handler =
      flowHandlers[visibleBureauKey] ??
      (fallbackBureau ? flowHandlers[normalizeBureauKey(fallbackBureau)] : null);

    recordDebugEvent(
      store,
      session,
      "bureau_dispatch",
      handler
        ? `Dispatching the next bureau flow as ${bureauKeyToName(visibleBureauKey) ?? fallbackBureau}.`
        : "The agent could not determine which bureau flow to run next.",
      {
        pass,
        pageUrl: getActivePage(session)?.url() ?? null,
        visibleBureau: visibleBureau ?? null,
        visibleBureauKey: visibleBureauKey || null,
        fallbackBureau,
        remainingBureauKeys,
      },
    );

    if (!handler) {
      throw new Error("The browser opened a bureau page, but the agent could not determine which bureau flow to run next.");
    }

    const downloadedBefore = (session.downloadedReports ?? []).length;
    await handler(session, store);
    const downloadedAfter = (session.downloadedReports ?? []).length;

    if (downloadedAfter <= downloadedBefore) {
      recordDebugEvent(
        store,
        session,
        "bureau_dispatch",
        "A bureau flow returned without saving a new report PDF. The agent will try to continue, but this indicates the visible flow may not have finished cleanly.",
        {
          pass,
          visibleBureau: visibleBureau ?? null,
          downloadedBefore,
          downloadedAfter,
          remainingBureauKeys: getRemainingBureauKeys(session),
        },
      );
    } else if (shouldStopAfterFirstSavedReport(session)) {
      recordDebugEvent(
        store,
        session,
        "bureau_dispatch",
        "Stopping after the first successfully saved bureau report for the current test run.",
        {
          pass,
          visibleBureau: visibleBureau ?? null,
          downloadedBefore,
          downloadedAfter,
          savedBureaus: (session.downloadedReports ?? []).map((entry) => normalizeBureauKey(entry?.bureauKey ?? entry?.bureau)),
        },
      );
      return;
    }
  }

  throw new Error("The browser cycled through too many bureau dispatch attempts without finishing all three reports.");
};

const completeTransUnion = async (session, store) => {
  const activeBureau = (await resolveVisibleBureau(session, store, "TransUnion")) ?? "TransUnion";
  if (await guardUnexpectedPublicBureauPage(session, store, activeBureau)) {
    return;
  }
  await abortForVisibleBureauSystemError(session, store, activeBureau);
  setAgentStep(session, store, "transunion_flow", {
    bureau: activeBureau,
    progress: 38,
    stage: `Working through ${activeBureau} verification...`,
    lastAction: `Start ${activeBureau} bureau flow`,
    mode: "driving",
  });
  recordToolActivity(
    store,
    session,
    `Start ${activeBureau} bureau flow`,
    `Preparing the ${activeBureau} contact, verification, and report-capture sequence.`,
    "running",
  );
  store.appendLog(
    session,
    `${activeBureau} usually asks for an email address, a phone number, and then a verification code. I will capture the phone number, fill the visible page, and then pause for the OTP.`,
  );
  await promptForContactConfirmationIfVisible(session, store, activeBureau);
  recordToolActivity(
    store,
    session,
    `Resume after ${activeBureau} contact entry`,
    `The user finished the ${activeBureau} contact step and the agent is advancing to the OTP request.`,
  );
  await attemptClickTextsWithRecovery(session, store, {
    step: "transunion_flow",
    title: "Advance through TransUnion contact verification",
    texts: [
      "I ACCEPT & CONTINUE",
      "AGREE AND SEND PASSCODE",
      "CONTINUE",
    ],
    retryTexts: ["Continue", "Verify my identity"],
  });
  if (await promptForContactConfirmationIfVisible(session, store, activeBureau)) {
    recordToolActivity(
      store,
      session,
      `${activeBureau} contact validation retry`,
      `The ${activeBureau} contact page still needed a phone number, so the agent reopened the user prompt and is trying the submit step again.`,
      "running",
      "handoff",
    );
    await attemptClickTextsWithRecovery(session, store, {
      step: "transunion_flow",
      title: `Retry ${activeBureau} contact verification`,
      texts: ["I ACCEPT & CONTINUE", "AGREE AND SEND PASSCODE", "CONTINUE", "Continue"],
      retryTexts: ["Verify my identity"],
    });
  }
  await abortForVisibleBureauSystemError(session, store, activeBureau);
  if (await promptForOtpIfVisible(session, store, activeBureau)) {
    return;
  }
  if (await promptForSecurityQuestionsIfVisible(session, store, activeBureau)) {
    return;
  }
  await promptToContinueInBrowser(
    session,
    store,
    `Finish the ${activeBureau} report in the browser`,
    `The agent is paused while you review the headed browser. If ${activeBureau} asks extra verification questions, answer them there. When the full report is visible, continue and the app will save it as a PDF${activeBureau === "TransUnion" ? " in landscape mode" : ""}.`,
  );
  await preparePrintableReport(session, store, activeBureau);
  await ensureReportSaved(session, store, activeBureau, { landscape: activeBureau === "TransUnion" });
  if (shouldStopAfterFirstSavedReport(session)) {
    return;
  }
  await returnToAnnualCreditReport(session, store, activeBureau);
};

const completeEquifax = async (session, store) => {
  const activeBureau = (await resolveVisibleBureau(session, store, "Equifax")) ?? "Equifax";
  const failForUnexpectedEquifaxScreen = async (classification, observation, message) => {
    await persistFailureBundle(session, store, safeSegment(classification.pageType || "unexpected"), observation, {
      bureau: activeBureau,
      expectedPageType: session.expectedPageType ?? null,
      observedPageType: classification.pageType,
      pageConfidence: classification.confidence,
      matchedSignals: classification.matchedSignals,
      terminal: classification.terminal,
      currentStep: session.currentStep ?? null,
      currentUrl: observation.pageUrl,
    });
    throw new Error(message);
  };

  const maxPasses = 10;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const expectedPageType = session.expectedPageType ?? "equifax_contact";
    const equifaxObservation = await observeEquifaxPage(session, store, expectedPageType);
    const { observation } = equifaxObservation;
    const classification = equifaxObservation;
    const page = getActivePage(session);

    if (!page) {
      throw new Error("The Equifax browser page is no longer available.");
    }

    if (classification.pageType === "wrong_public_page") {
      await failForUnexpectedEquifaxScreen(
        classification,
        observation,
        "Equifax opened its public website instead of the official AnnualCreditReport verification flow.",
      );
    }

    if (classification.pageType === "bureau_error_page") {
      await failForUnexpectedEquifaxScreen(
        classification,
        observation,
        "Equifax returned an error page instead of the report flow. End this run and relaunch Equifax with corrected information.",
      );
    }

    recordToolActivity(
      store,
      session,
      `Observe Equifax page (${classification.pageType})`,
      `The browser classified the visible Equifax screen as ${classification.pageType} with ${Math.round(
        (classification.confidence ?? 0) * 100,
      )}% confidence.`,
      "running",
      "browser",
    );

    switch (classification.pageType) {
      case "equifax_contact": {
        setAgentStep(session, store, "equifax_contact", {
          bureau: activeBureau,
          progress: 54,
          stage: "Preparing the Equifax phone and email step...",
          lastAction: "Collect Equifax phone number",
          mode: "waiting_for_user",
          url: observation.pageUrl,
        });
        store.setProgress(session, {
          expectedPageType: "equifax_contact",
          observedPageType: classification.pageType,
          pageConfidence: classification.confidence,
          matchedSignals: classification.matchedSignals,
        });
        const prompted = await promptForContactConfirmationIfVisible(session, store, activeBureau);
        if (!prompted) {
          await failForUnexpectedEquifaxScreen(
            classification,
            observation,
            "Equifax is on the contact page, but the contact prompt could not be opened.",
          );
        }

        const pageAfterPrompt = getActivePage(session);
        const pageAfterPromptUrl = String(pageAfterPrompt?.url?.() ?? "").toLowerCase();
        if (/otp-verify-get-pin/.test(pageAfterPromptUrl)) {
          recordDebugEvent(
            store,
            session,
            "equifax_contact",
            "The Equifax page already advanced to the OTP route after the phone handoff, so the agent is skipping the contact-page Continue click.",
            {
              pageUrl: pageAfterPromptUrl,
              expectedPageType: "equifax_send_code",
            },
          );
          store.setProgress(session, {
            expectedPageType: "equifax_send_code",
          });
          await wait(1200);
          continue;
        }

        await attemptClickTextsWithRecovery(session, store, {
          step: "equifax_send_code",
          title: "Advance through the Equifax contact step",
          texts: ["SEND ME A ONE-TIME PASSCODE", "YES, SEND ME A TEXT", "CONTINUE", "Continue", "Text me"],
          retryTexts: ["Call me"],
        });
        store.setProgress(session, {
          expectedPageType: "equifax_send_code",
        });
        await wait(1500);
        continue;
      }

      case "equifax_send_code": {
        setAgentStep(session, store, "equifax_send_code", {
          bureau: activeBureau,
          progress: 60,
          stage: "Requesting the Equifax one-time code...",
          lastAction: "Send Equifax code",
          mode: "driving",
          url: observation.pageUrl,
        });
        const clickedSendCode = await runClickSequence(session, [
          "YES, SEND ME A TEXT",
          "SEND ME A ONE-TIME PASSCODE",
          "Text me",
          "CONTINUE",
          "Continue",
        ]);
        if (!clickedSendCode) {
          await failForUnexpectedEquifaxScreen(
            classification,
            observation,
            "Equifax is on the send-code step, but the code-delivery controls were not clickable.",
          );
        }
        recordToolActivity(
          store,
          session,
          "Request Equifax one-time code",
          "The agent advanced the Equifax flow into the one-time code step.",
          "completed",
          "browser",
        );
        store.setProgress(session, {
          expectedPageType: "equifax_enter_code",
        });
        await wait(2000);
        continue;
      }

      case "equifax_enter_code": {
        setAgentStep(session, store, "equifax_enter_code", {
          bureau: activeBureau,
          progress: 68,
          stage: "Waiting for the Equifax one-time code...",
          lastAction: "Collect Equifax OTP",
          mode: "waiting_for_user",
          url: observation.pageUrl,
        });
        const handledOtp = await promptForOtpIfVisible(session, store, activeBureau);
        if (!handledOtp) {
          await failForUnexpectedEquifaxScreen(
            classification,
            observation,
            "Equifax is on the one-time code step, but the OTP prompt could not be opened.",
          );
        }
        store.setProgress(session, {
          expectedPageType: null,
        });
        await wait(2000);
        continue;
      }

      case "equifax_security_questions": {
        setAgentStep(session, store, "equifax_security_questions", {
          bureau: activeBureau,
          progress: 74,
          stage: "Waiting for Equifax identity-question answers...",
          lastAction: "Collect Equifax security answers",
          mode: "waiting_for_user",
          url: observation.pageUrl,
        });
        const handledQuestions = await promptForEquifaxSecurityQuestionnaireIfVisible(session, store, activeBureau);
        if (!handledQuestions) {
          await failForUnexpectedEquifaxScreen(
            classification,
            observation,
            "Equifax showed identity questions, but the questionnaire prompt could not be opened.",
          );
        }
        store.setProgress(session, {
          expectedPageType: null,
        });
        await wait(2500);
        continue;
      }

      case "equifax_report_ready":
      case "equifax_print_entry": {
        setAgentStep(session, store, "equifax_print_entry", {
          bureau: activeBureau,
          progress: 84,
          stage: "Opening the Equifax print flow...",
          lastAction: "Open Print Credit Report",
          mode: "driving",
          url: observation.pageUrl,
        });
        const prepared = await preparePrintableReport(session, store, activeBureau);
        store.setProgress(session, {
          expectedPageType: prepared ? "equifax_printable_view" : "equifax_print_entry",
        });
        await wait(prepared ? 2500 : 1200);
        if (!prepared) {
          await failForUnexpectedEquifaxScreen(
            classification,
            observation,
            "Equifax reached the report step, but the real print flow did not open. The run stopped instead of saving a non-print page as the report.",
          );
        }
        continue;
      }

      case "equifax_printable_view": {
        setAgentStep(session, store, "equifax_save_pdf", {
          bureau: activeBureau,
          progress: 92,
          stage: "Saving the Equifax report PDF...",
          lastAction: "Save Equifax PDF",
          mode: "driving",
          url: observation.pageUrl,
        });
        await ensureReportSaved(session, store, activeBureau, { captureMethod: "print_view_pdf" });
        store.setProgress(session, {
          expectedPageType: "equifax_done",
          observedPageType: "equifax_done",
        });
        if (shouldStopAfterFirstSavedReport(session)) {
          return;
        }
        await returnToAnnualCreditReport(session, store, activeBureau);
        return;
      }

      case "unexpected_screen":
      default:
        await failForUnexpectedEquifaxScreen(
          classification,
          observation,
          `The Equifax flow reached an unexpected screen (${classification.pageType || "unknown"}).`,
        );
    }
  }

  throw new Error("The Equifax flow exceeded the maximum number of page transitions without finishing.");
};

const completeExperian = async (session, store) => {
  const activeBureau = (await resolveVisibleBureau(session, store, "Experian")) ?? "Experian";
  if (await guardUnexpectedPublicBureauPage(session, store, activeBureau)) {
    return;
  }
  await abortForVisibleBureauSystemError(session, store, activeBureau);
  setAgentStep(session, store, "experian_flow", {
    bureau: activeBureau,
    progress: 84,
    stage: `Working through ${activeBureau} verification...`,
    lastAction: `Start ${activeBureau} bureau flow`,
    mode: "driving",
  });
  recordToolActivity(
    store,
    session,
    `Start ${activeBureau} bureau flow`,
    `Preparing the ${activeBureau} identity-question and report-capture sequence.`,
    "running",
  );
  store.appendLog(
    session,
    `${activeBureau} can ask for a phone number, a verification code, and then identity questions. I will capture the phone number first, pause for the OTP, and only hand over the browser for the visible security questions.`,
  );
  const clickedExperianStart = await runClickSequence(session, [
    "Get Started",
    "GET STARTED",
    "Start",
    "Continue",
  ]);
  if (clickedExperianStart) {
    recordDebugEvent(store, session, "experian_start", "Advanced past the Experian mobile-match start screen.", {
      pageUrl: getActivePage(session)?.url() ?? null,
    });
    await wait(2500);
  }
  await promptForContactConfirmationIfVisible(session, store, activeBureau);
  recordToolActivity(
    store,
    session,
    `Resume after ${activeBureau} contact entry`,
    `The user finished the ${activeBureau} contact step and the agent is advancing to the OTP request.`,
  );
  await attemptClickTextsWithRecovery(session, store, {
    step: "experian_flow",
    title: "Advance through Experian contact verification",
    texts: ["CONTINUE", "Continue", "VERIFY MY IDENTITY", "Text Me"],
    retryTexts: ["Call Me", "Verify"],
  });
  if (await promptForContactConfirmationIfVisible(session, store, activeBureau)) {
    recordToolActivity(
      store,
      session,
      `${activeBureau} contact validation retry`,
      `The ${activeBureau} contact page still needed a phone number, so the agent reopened the user prompt and is trying the submit step again.`,
      "running",
      "handoff",
    );
    await attemptClickTextsWithRecovery(session, store, {
      step: "experian_flow",
      title: `Retry ${activeBureau} contact verification`,
      texts: ["CONTINUE", "Continue", "VERIFY MY IDENTITY", "Text Me"],
      retryTexts: ["Call Me", "Verify"],
    });
  }
  const contactSignalsAfterRetry = await detectContactVerificationSignals(getActivePage(session));
  if (contactSignalsAfterRetry.detected) {
    await store.requestPrompt(session, {
      type: "manual_continue",
      inputType: "confirm",
      title: "Finish Experian contact verification in the browser",
      description:
        "Experian still shows the contact-verification step after the saved phone and email were entered. Complete any visible validation, choose the text option if needed, and continue from the browser prompt so the agent can watch for the code step.",
      submitLabel: "The contact step is complete",
      bureau: activeBureau,
      contextUrl: getActivePage(session)?.url() ?? null,
    });
  }
  await abortForVisibleBureauSystemError(session, store, activeBureau);
  if (await promptForOtpIfVisible(session, store, activeBureau)) {
    return;
  }
  if (await promptForSecurityQuestionsIfVisible(session, store, activeBureau)) {
    return;
  }
  await promptToContinueInBrowser(
    session,
    store,
    `Finish the ${activeBureau} report in the browser`,
    `Answer any visible identity questions directly in the headed browser. When the full ${activeBureau} report is visible, continue and the app will save it as a PDF.`,
  );
  await preparePrintableReport(session, store, activeBureau);
  await ensureReportSaved(session, store, activeBureau);
  if (shouldStopAfterFirstSavedReport(session)) {
    return;
  }
  if (getRemainingBureauKeys(session).length) {
    await returnToAnnualCreditReport(session, store, activeBureau);
  }
};

const fillRequestForm = async (session, store, input) => {
  const page = getActivePage(session);
  if (!page) {
    throw new Error("The request form could not be opened.");
  }

  const populateFormFields = async () => {
    const requestFormVisible = await isRequestFormReady(page);
    if (!requestFormVisible) {
      throw new Error("The AnnualCreditReport request form is not visible yet.");
    }

    setAgentStep(session, store, "request_form", {
      progress: 18,
      stage: "Filling the AnnualCreditReport.com request form...",
      lastAction: "Fill request form",
      mode: "driving",
      url: page.url(),
    });
    recordToolActivity(
      store,
      session,
      "Fill intake form",
      "Completing the AnnualCreditReport request form with the saved consumer profile details.",
      "running",
    );
    await maybeFillField(page, [/First/i], input.firstName);
    await maybeFillField(page, [/Middle initial/i], input.middleInitial);
    await maybeFillField(page, [/Last/i], input.lastName);
    const suffixSelected = await maybeSelectOption(page, [/Suffix/i], input.suffix);
    if (input.suffix && !suffixSelected) {
      store.appendLog(
        session,
        "The site did not accept the suffix automatically. Continuing without it because that field is optional.",
        "warning",
      );
    }
    await maybeFillField(page, [/Birthday/i], input.birthDate);
    await maybeFillField(page, [/Social Security Number/i], input.ssn);
    await maybeFillField(page, [/Verify Social Security Number/i], input.confirmSsn);
    await maybeFillField(page, [/^Address$/i], input.currentAddress1);
    await maybeFillField(page, [/Address Line 2/i], input.currentAddress2);
    await maybeFillField(page, [/City/i], input.currentCity);
    await maybeSelectOption(page, [/State/i], input.currentState);
    await maybeFillField(page, [/Zip/i], input.currentZip);

    if (input.livedAtCurrentAddressTwoYearsOrMore) {
      await maybeCheckLabel(page, /Yes/i, true);
    } else {
      await maybeCheckLabel(page, /No/i, true);
      await wait(500);
      const previousAddressResults = await Promise.all([
        maybeFillField(page, [/Previous Address/i, /Prior Address/i], input.previousAddress1),
        maybeFillField(page, [/Previous City/i, /Prior City/i], input.previousCity),
        maybeSelectOption(page, [/Previous State/i, /Prior State/i], input.previousState),
        maybeFillField(page, [/Previous Zip/i, /Prior Zip/i], input.previousZip),
      ]);
      const previousAddressFilled = previousAddressResults.some(Boolean);

      if (!previousAddressFilled) {
        await promptToContinueInBrowser(
          session,
          store,
          "Review the previous-address fields",
          "This request needs a previous address because the user has lived at the current address for less than two years. Use the headed browser to confirm those fields are filled correctly, then continue from the browser prompt.",
        );
      }
    }
    recordToolActivity(
      store,
      session,
      "AnnualCreditReport request form filled",
      "The primary request form is complete and ready for submission.",
    );
  };

  await openRequestFormFromOfficialEntry(session, store);
  await populateFormFields();
  await attemptClickTextsWithRecovery(session, store, {
    step: "request_form",
    title: "Submit request form",
    texts: ["Next"],
    retryTexts: ["Continue", "Submit"],
    successCheck: async () => {
      const activePage = getActivePage(session);
      return Boolean(activePage && !/requestForm|landingPage/i.test(activePage.url()));
    },
    takeoverPrompt: {
      title: "Submit the request form manually",
      description:
        "The form looks complete, but the agent could not find the Next button. Use the headed browser to submit the request form, then continue from the browser prompt so the run can continue.",
    },
  });

  if (await isSessionExpiredPage(page)) {
    store.appendLog(
      session,
      "AnnualCreditReport.com expired the request after the first submit. Restarting the request flow once.",
      "error",
    );
    await openRequestFormFromOfficialEntry(session, store);
    await populateFormFields();
    await attemptClickTextsWithRecovery(session, store, {
      step: "request_form",
      title: "Submit request form after session reset",
      texts: ["Next"],
      retryTexts: ["Continue", "Submit"],
      successCheck: async () => {
        const activePage = getActivePage(session);
        return Boolean(activePage && !/requestForm|landingPage/i.test(activePage.url()));
      },
    });
  }

  if (await isSessionExpiredPage(page)) {
    throw new Error(
      "AnnualCreditReport.com expired the request session immediately after submission. End this run and launch it again.",
    );
  }

  const requestedBureauDescription = describeRequestedBureaus(session);
  setAgentStep(session, store, "bureau_selection", {
    progress: 28,
    stage: `Selecting ${requestedBureauDescription}...`,
    lastAction: `Select ${requestedBureauDescription}`,
    mode: "driving",
    url: page.url(),
  });
};

const selectAllReports = async (session, store) => {
  const page = getActivePage(session);
  if (!page) {
    throw new Error("The bureau-selection step is not available.");
  }

  const requestedBureauKeys = getRequestedBureauKeys(session);
  const requestedBureauNames = getRequestedBureauNames(session);
  const requestedBureauDescription = describeRequestedBureaus(session);
  setAgentStep(session, store, "bureau_selection", {
    bureau: null,
    progress: 30,
    stage: `Selecting ${requestedBureauDescription}...`,
    lastAction: `Select ${requestedBureauDescription}`,
    mode: "driving",
    url: page.url(),
  });
  recordToolActivity(
    store,
    session,
    `Select ${requestedBureauDescription}`,
    `Checking ${requestedBureauDescription} before the run moves into the bureau-specific verification flow.`,
    "running",
  );
  let foundAnyCheckbox = false;
  for (const bureauName of requestedBureauNames) {
    foundAnyCheckbox = (await maybeCheckLabel(page, makeRegex(bureauName), true)) || foundAnyCheckbox;
  }

  if (!foundAnyCheckbox) {
    const candidateTexts = [...requestedBureauNames, "Next", "Continue"];
    const recovered = await runRecoveryLoop(session, store, {
      step: "bureau_selection",
      title: `Select ${requestedBureauDescription}`,
      lastError: `The ${requestedBureauDescription} checkbox was not visible on the selection page.`,
      candidateTexts,
      retryTexts: requestedBureauNames,
      takeoverPrompt: {
        title: `Select ${requestedBureauDescription} in the browser`,
        description: `The selection page did not expose the ${requestedBureauDescription} checkbox cleanly. Use the headed browser to choose ${requestedBureauDescription}, then continue from the browser prompt.`,
      },
    });
    if (recovered) {
      for (const bureauName of requestedBureauNames) {
        await maybeCheckLabel(page, makeRegex(bureauName), true);
      }
      await attemptClickTextsWithRecovery(session, store, {
        step: "bureau_selection",
        title: `Continue after selecting ${requestedBureauDescription}`,
        texts: ["Next", "Continue"],
        retryTexts: ["Submit"],
      });
    }
  } else {
    for (const bureauName of requestedBureauNames) {
      await maybeCheckLabel(page, makeRegex(bureauName), true);
    }
    await attemptClickTextsWithRecovery(session, store, {
      step: "bureau_selection",
      title: `Continue after selecting ${requestedBureauDescription}`,
      texts: ["Next", "Continue"],
      retryTexts: ["Submit"],
    });
  }
  recordToolActivity(
    store,
    session,
    `${requestedBureauDescription} selected`,
    `The run is ready to move from AnnualCreditReport.com into the ${requestedBureauDescription} verification flow.`,
  );
};

export const runAnnualCreditReportAcquisition = async ({ session, store, input }) => {
  const { chromium } = await loadPlaywright();

  let browser = null;
  try {
    const extensionPath = await ensureExtensionBundleExists();
    setAgentStep(session, store, "launch_browser", {
      bureau: null,
      progress: 4,
      stage: "Launching a headed Chrome window in a fresh isolated session...",
      lastAction: "Launch isolated browser session",
      mode: "booting",
    });
    recordToolActivity(
      store,
      session,
      "Launch isolated browser session",
      "Starting the headed remote browser session in a fresh isolated profile.",
      "running",
      "browser",
    );
    const userDataDir = path.join(session.workspaceDir, "browser-profile");
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        "--window-size=1440,960",
        "--disable-features=LocalNetworkAccessForWorkers,LocalNetworkAccessForWorkersWarningOnly,LocalNetworkAccessForNavigations,LocalNetworkAccessForNavigationsWarningOnly,LocalNetworkAccessForSubframeNavigations,LocalNetworkAccessForSubframeNavigationsWarningOnly,LocalNetworkAccessForFencedFrameNavigations,LocalNetworkAccessForFencedFrameNavigationsWarningOnly",
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      acceptDownloads: true,
      viewport: null,
      locale: "en-US",
      colorScheme: "light",
      slowMo: 100,
    });
    browser = context.browser();
    const browserProcess = browser?.process?.() ?? null;

    const page = context.pages().find((candidate) => !isExtensionPageUrl(candidate.url())) ?? await context.newPage();
    await page.bringToFront();

    store.attachRuntime(session, {
      browser,
      browserProcess,
      browserPid: Number.isFinite(browserProcess?.pid) ? Number(browserProcess.pid) : null,
      context,
      page,
      userDataDir,
      apiBaseUrl: `http://${appConfig.apiHost}:${appConfig.apiPort}`,
      connectedAt: new Date().toISOString(),
      panelStatus: "awaiting_connection",
      extensionWorker: null,
      overlaySyncScheduled: false,
      overlaySyncQueued: false,
      lastOverlaySyncSignature: null,
    });
    attachPageToRuntime(page, session, store);
    await initializeControlledBrowserOverlay(context, session, store);

    await page.goto("https://www.annualcreditreport.com/index.action", {
      waitUntil: "domcontentloaded",
    }).catch(() => undefined);
    await page.bringToFront().catch(() => undefined);
    prepareAppDialogPrompts(session, store);
    setAgentStep(session, store, "annualcreditreport_entry", {
      bureau: null,
      progress: 5,
      stage: "The browser is open and waiting for the user to start the controlled session...",
      lastAction: "Open AnnualCreditReport.com",
      mode: "booting",
      url: page.url(),
    });
    store.setProgress(session, {
      progress: 7,
      stage: "The browser is ready. Click Get Started inside the browser window when you want the automation to begin.",
      currentStep: "annualcreditreport_entry",
    });
    await store.waitForControllerReady(session);
    store.setProgress(session, {
      progress: 10,
      stage: "The controlled browser session has started. Opening the official AnnualCreditReport flow...",
      currentStep: "annualcreditreport_entry",
    });
    recordToolActivity(
      store,
      session,
      "Controlled browser session started",
      "The user clicked Get Started in the browser, so the agent is beginning the AnnualCreditReport flow.",
      "completed",
      "controller",
    );

    context.on("page", async (newPage) => {
      attachPageToRuntime(newPage, session, store);
      await newPage.waitForLoadState("domcontentloaded").catch(() => undefined);
      if (!isTrackablePageUrl(newPage.url())) {
        return;
      }
      await newPage.bringToFront().catch(() => undefined);
      store.appendLog(session, `Browser opened a new page for ${session.currentBureau ?? "the session"}.`);
      store.setProgress(session, { currentUrl: newPage.url() });
    });

    await fillRequestForm(session, store, input);
    await selectAllReports(session, store);
    await runPendingBureauFlows(session, store);

    const capturedCount = session.downloadedReports?.length ?? 0;
    if (shouldStopAfterFirstSavedReport(session)) {
      const savedBureau = session.downloadedReports?.[0]?.bureau ?? "the completed bureau";
      store.setCompleted(session, `${savedBureau} is ready for import into the extractor.`);
      store.appendLog(session, `The run stopped after saving the first completed bureau report: ${savedBureau}.`);
    } else {
      store.setCompleted(session, "All three credit reports are ready for import into the extractor.");
      store.appendLog(session, `The run captured ${capturedCount} report PDF${capturedCount === 1 ? "" : "s"}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    store.setFailed(session, message);
    store.appendLog(session, `Acquisition failed: ${message}`, "error");
    throw error;
  } finally {
    await store.closeRuntime(session);
  }
};
