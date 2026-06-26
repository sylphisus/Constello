"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A reading/essence artifact, sealed in an iframe so its own `*`, `body`, and
// `:root` styles stay inside. sandbox="allow-same-origin" (no allow-scripts)
// keeps the frame on our origin so we can size it to its content — yet still
// blocks any scripts the artifact might carry. We measure from the parent and
// grow the frame to fit, so there's no scroll-within-scroll.
export default function ReadingFrame({ doc, title }: { doc: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);

  const fit = useCallback(() => {
    const body = ref.current?.contentDocument?.body;
    if (body) setHeight(body.scrollHeight);
  }, []);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    fit();
    // Re-fit after late reflows (web fonts, images) without polling forever.
    let observer: ResizeObserver | undefined;
    const body = frame.contentDocument?.body;
    if (body && "ResizeObserver" in window) {
      observer = new ResizeObserver(fit);
      observer.observe(body);
    }
    return () => observer?.disconnect();
  }, [fit, doc]);

  return (
    <iframe
      ref={ref}
      sandbox="allow-same-origin"
      srcDoc={doc}
      title={title}
      onLoad={fit}
      scrolling="no"
      style={{
        width: "100%",
        height,
        border: "none",
        background: "transparent",
        display: "block",
      }}
    />
  );
}
