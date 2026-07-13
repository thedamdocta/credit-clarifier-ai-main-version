const NOOP = () => undefined;
const RUNTIME_ERROR_EVENT = "credit-clarifier:runtime-error";

declare global {
  interface Window {
    __CREDIT_CLARIFIER_RUNTIME_ERROR__?: boolean;
  }
}

const getConsoleOverrideMethods = (): Array<keyof Console> => [
  "log",
  "info",
  "debug",
  "warn",
  "error",
  "trace",
  "dir",
  "dirxml",
  "table",
  "group",
  "groupCollapsed",
  "groupEnd",
];

export const hardenClientDiagnostics = () => {
  if (typeof window === "undefined") {
    return;
  }

  const signalRuntimeError = () => {
    window.__CREDIT_CLARIFIER_RUNTIME_ERROR__ = true;
    window.dispatchEvent(new CustomEvent(RUNTIME_ERROR_EVENT));
  };

  getConsoleOverrideMethods().forEach((method) => {
    try {
      console[method] = NOOP as Console[typeof method];
    } catch {
      // Ignore immutable console implementations.
    }
  });

  window.addEventListener("error", (event) => {
    const target = event.target;
    const isResourceLoadFailure =
      target != null &&
      target !== window &&
      !(target instanceof ErrorEvent) &&
      !("message" in event && typeof event.message === "string" && event.message.trim().length > 0);

    if (isResourceLoadFailure || !event.error) {
      return;
    }

    signalRuntimeError();
    event.preventDefault();
  });

  window.addEventListener("unhandledrejection", (event) => {
    signalRuntimeError();
    event.preventDefault();
  });
};

hardenClientDiagnostics();
