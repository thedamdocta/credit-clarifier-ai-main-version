import React, { useEffect, useRef, useState } from "react";

interface DisputeLetterPreviewFrameProps {
  srcDoc: string;
  title?: string;
}

const MIN_PREVIEW_HEIGHT = 1160;

export default function DisputeLetterPreviewFrame({
  srcDoc,
  title = "Dispute letter preview",
}: DisputeLetterPreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [frameHeight, setFrameHeight] = useState(MIN_PREVIEW_HEIGHT);

  useEffect(() => {
    setFrameHeight(MIN_PREVIEW_HEIGHT);
  }, [srcDoc]);

  useEffect(() => {
    const syncHeight = () => {
      const documentElement = iframeRef.current?.contentDocument?.documentElement;
      if (!documentElement) {
        return;
      }

      setFrameHeight(Math.max(MIN_PREVIEW_HEIGHT, Math.ceil(documentElement.scrollHeight) + 8));
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (event.data?.type !== "dispute-letter-preview-height") {
        return;
      }

      if (typeof event.data.height !== "number" || !Number.isFinite(event.data.height)) {
        return;
      }

      setFrameHeight(Math.max(MIN_PREVIEW_HEIGHT, Math.ceil(event.data.height) + 8));
    };

    window.addEventListener("message", handleMessage);

    const firstPass = window.setTimeout(syncHeight, 50);
    const secondPass = window.setTimeout(syncHeight, 250);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(firstPass);
      window.clearTimeout(secondPass);
    };
  }, [srcDoc]);

  const handleLoad = () => {
    const syncHeight = () => {
      const documentElement = iframeRef.current?.contentDocument?.documentElement;
      if (!documentElement) {
        return;
      }

      setFrameHeight(Math.max(MIN_PREVIEW_HEIGHT, Math.ceil(documentElement.scrollHeight) + 8));
    };

    window.requestAnimationFrame(syncHeight);
    window.setTimeout(syncHeight, 80);
    window.setTimeout(syncHeight, 250);
  };

  return (
    <iframe
      ref={iframeRef}
      title={title}
      srcDoc={srcDoc}
      onLoad={handleLoad}
      scrolling="no"
      className="w-full border-0 bg-transparent"
      style={{ height: `${frameHeight}px` }}
    />
  );
}
