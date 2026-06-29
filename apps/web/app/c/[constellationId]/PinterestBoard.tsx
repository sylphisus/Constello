"use client";

import { useEffect, useRef } from "react";

// Renders a collected Pinterest board inline using Pinterest's official embed
// widget (pinit.js) — Route A of "scroll collected boards without leaving
// Constello". The board renders live from Pinterest off the board URL we already
// store on the pending entry; there's no scrape and no stored pins. The hand-read
// still happens from screenshots — this just keeps the artifact itself present on
// the page, beside its reading.
//
// pinit.js replaces the <a data-pin-do> node with its own rendered <span>/iframe.
// That mutates the DOM out from under React, so the anchor is wrapped in a div
// React owns: React only ever touches the wrapper, never the node Pinterest swaps
// out (otherwise an unmount throws removeChild on a node that's already gone).

const PINIT_SRC = "https://assets.pinterest.com/js/pinit.js";

declare global {
  interface Window {
    PinUtils?: { build: () => void };
  }
}

export default function PinterestBoard({ href }: { href: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const anchor = wrap?.querySelector<HTMLAnchorElement>("a[data-pin-do]");
    if (!anchor) return;

    // Fit the board to the column it sits in (clamped to a legible range). Set
    // before build() runs — pinit.js reads the attribute when it renders.
    const width = Math.max(240, Math.min(700, wrap?.clientWidth ?? 600));
    anchor.setAttribute("data-pin-board-width", String(width));

    if (window.PinUtils) {
      window.PinUtils.build();
      return;
    }
    if (!document.querySelector(`script[src="${PINIT_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = PINIT_SRC;
      s.async = true;
      document.body.appendChild(s);
    }
    // If the script is mid-load, its own onload scan picks up this anchor.
  }, [href]);

  return (
    <div className="pinterest-board" ref={wrapRef}>
      <a
        data-pin-do="embedBoard"
        data-pin-scale-height="320"
        data-pin-scale-width="80"
        href={href}
      >
        {/* pinit.js replaces this anchor with the rendered board */}
      </a>
    </div>
  );
}
