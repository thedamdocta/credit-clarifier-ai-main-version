import React, { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const RUNTIME_ERROR_EVENT = "credit-clarifier:runtime-error";

const RuntimeFallback = () => (
  <div className="dossier-shell">
    <div className="dossier-frame">
      <div className="content">
        <main className="flex-1 overflow-y-auto">
          <div className="dossier-page">
            <section className="section border-b-0">
              <div className="mx-auto max-w-3xl rounded-2xl border border-black/15 bg-white p-8 shadow-[10px_10px_0_rgba(0,0,0,0.04)]">
                <div className="flex items-start gap-4">
                  <div className="rounded-full border border-black/15 bg-[#faf8f2] p-3">
                    <AlertTriangle className="h-6 w-6 text-slate-700" />
                  </div>
                  <div className="space-y-3">
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                      Runtime Recovery
                    </p>
                    <h1 className="font-display text-4xl tracking-[-0.05em] text-slate-950">
                      The page needs to reload
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-slate-600">
                      Something interrupted this screen. The app hid the raw error details for security, but it should not leave you on a blank page. Reload the workspace and continue from the upload or report flow.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button
                        type="button"
                        className="dossier-button dossier-button-primary"
                        onClick={() => window.location.reload()}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Reload Workspace
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="dossier-button"
                        onClick={() => window.location.assign("/upload")}
                      >
                        Go To Upload
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  </div>
);

class RenderErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch() {
    if (typeof window !== "undefined") {
      window.__CREDIT_CLARIFIER_RUNTIME_ERROR__ = true;
    }
  }

  override render() {
    if (this.state.hasError) {
      return <RuntimeFallback />;
    }
    return this.props.children;
  }
}

const readRuntimeErrorFlag = () =>
  typeof window !== "undefined" && window.__CREDIT_CLARIFIER_RUNTIME_ERROR__ === true;

const AppRuntimeBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasRuntimeError, setHasRuntimeError] = useState(readRuntimeErrorFlag);

  useEffect(() => {
    const handleRuntimeError = () => setHasRuntimeError(true);
    window.addEventListener(RUNTIME_ERROR_EVENT, handleRuntimeError);
    return () => {
      window.removeEventListener(RUNTIME_ERROR_EVENT, handleRuntimeError);
    };
  }, []);

  if (hasRuntimeError) {
    return <RuntimeFallback />;
  }

  return <RenderErrorBoundary>{children}</RenderErrorBoundary>;
};

export default AppRuntimeBoundary;
