import React from "react";
import { AccountSummary } from "@/lib/types/creditReport";
import { toast } from "sonner";

const CLIENT_AI_DISABLED_MESSAGE =
  "Remote AI extraction is disabled in Phase 0. Local-only extraction is active.";

let hasShownDisabledNotice = false;

const showDisabledNotice = () => {
  if (hasShownDisabledNotice) {
    return;
  }
  hasShownDisabledNotice = true;
  toast.info(CLIENT_AI_DISABLED_MESSAGE);
};

// Phase 0 security lock: never call external model APIs from the browser.
export const extractTableWithOpenAI = async (
  _imageUrl: string,
  _apiKey?: string
): Promise<AccountSummary[] | null> => {
  showDisabledNotice();
  return null;
};

export const OpenAIConfigForm: React.FC = () => {
  return (
    <div className="rounded-md border bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {CLIENT_AI_DISABLED_MESSAGE}
    </div>
  );
};

// Phase 0: client-side provider calls are intentionally disabled.
export const canUseOpenAI = (): boolean => false;
