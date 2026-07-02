"use client";

import { useEffect, useRef, useState } from "react";

// Renders a collected X / Twitter profile inline using X's official timeline
// embed (widgets.js) — the posting-source parallel to PinterestBoard. The
// timeline renders live off the handle we already store; there's no scrape and
// nothing stored here. The hand-read still happens from the captures — this just
// keeps the artifact present beside its reading.
//
// X gates the embedded timeline to signed-in viewers (a 2023 change; the old
// widgets.js workarounds are dead), and the iframe reads that login through a
// third-party cookie — which Chrome still allows but Safari blocks and Firefox
// partitions by default. On top of the gate, X's syndication backend 429s
// transiently, so even a signed-in Chrome viewer sometimes gets a blank frame
// on first paint. We use the programmatic createTimeline API instead of the
// anchor scan so each attempt reports back: a blank render is retried with
// backoff (which clears the transient 429s), and only a persistent blank shows
// the sign-in note — with the always-present "View on X" link as the floor.
//
// widgets.js mutates the DOM out from under React (same hazard as pinit.js),
// so the timeline lives in a div React never writes into after mount.

const WIDGETS_SRC = "https://platform.twitter.com/widgets.js";
const RETRY_DELAYS_MS = [1500, 4000];
// When X 429s the syndication request the iframe never reports rendered and
// createTimeline's promise never settles — every attempt needs a deadline.
const ATTEMPT_TIMEOUT_MS = 8000;
// A rendered timeline with tweets is ≥ several hundred px (height cap 520);
// the gated/blank render is a sliver. Anything under this is a failed attempt.
const MIN_RENDERED_HEIGHT = 200;

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (el?: HTMLElement) => void;
        createTimeline: (
          source: { sourceType: "profile"; screenName: string },
          target: HTMLElement,
          options?: Record<string, unknown>,
        ) => Promise<HTMLElement | undefined>;
      };
    };
  }
}

let widgetsReady: Promise<void> | null = null;
function loadWidgets(): Promise<void> {
  if (window.twttr?.widgets) return Promise.resolve();
  if (!widgetsReady) {
    widgetsReady = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = WIDGETS_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        widgetsReady = null; // allow a later mount to try again
        reject(new Error("widgets.js failed to load"));
      };
      document.body.appendChild(s);
    });
  }
  return widgetsReady;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function TwitterTimeline({ handle }: { handle: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "shown" | "blank">("loading");

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let cancelled = false;

    (async () => {
      try {
        await loadWidgets();
      } catch {
        if (!cancelled) setState("blank");
        return;
      }
      for (let attempt = 0; ; attempt++) {
        if (cancelled) return;
        frame.replaceChildren();
        const el = await Promise.race([
          window
            .twttr!.widgets.createTimeline(
              { sourceType: "profile", screenName: handle },
              frame,
              {
                theme: "dark",
                chrome: "transparent noborders nofooter",
                height: 520,
                dnt: true,
              },
            )
            .catch(() => undefined),
          wait(ATTEMPT_TIMEOUT_MS).then(() => undefined),
        ]);
        // Let the iframe's resize postMessage land before measuring.
        await wait(500);
        if (cancelled) return;
        if (el && el.offsetHeight >= MIN_RENDERED_HEIGHT) {
          setState("shown");
          return;
        }
        if (attempt >= RETRY_DELAYS_MS.length) {
          setState("blank");
          return;
        }
        await wait(RETRY_DELAYS_MS[attempt]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handle]);

  return (
    <div className="twitter-timeline-embed">
      <div
        className="twitter-embed-frame"
        ref={frameRef}
        style={state === "blank" ? { display: "none" } : undefined}
      />
      {state === "loading" && (
        <p className="twitter-note">Loading posts from X…</p>
      )}
      {state === "blank" && (
        <p className="twitter-note">
          X wouldn’t show the timeline here — it only serves embeds to viewers
          signed into X on a browser that lets it check (Chrome does; Safari
          and Firefox block it), and sometimes it declines even then. You can
          always{" "}
          <a href={`https://x.com/${handle}`} target="_blank" rel="noreferrer">
            View on X →
          </a>
        </p>
      )}
    </div>
  );
}
