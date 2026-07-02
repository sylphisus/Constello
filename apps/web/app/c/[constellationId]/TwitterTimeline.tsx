"use client";

import { useEffect, useRef } from "react";

// Renders a collected X / Twitter profile inline using X's official timeline
// embed (widgets.js) — the posting-source parallel to PinterestBoard. The
// timeline renders live off the handle we already store; there's no scrape and
// nothing stored here. The hand-read still happens from the captures — this just
// keeps the artifact present beside its reading.
//
// X gates the embedded timeline to signed-in viewers (a 2023 change; the old
// widgets.js workarounds are dead), and the iframe reads that login through a
// third-party cookie — which Chrome still allows but Safari blocks and Firefox
// partitions by default. So the timeline shows for some viewers and stays blank
// for others, with nothing we can do from our page about it. The note says as
// much; the always-present "View on X" link is the floor — when the timeline is
// blank there's still a real path to the profile.
//
// widgets.js replaces the <a class="twitter-timeline"> node with its own iframe,
// mutating the DOM out from under React (same hazard as pinit.js). So the anchor
// lives in a div React owns: React only ever touches the wrapper, never the node
// X swaps out.

const WIDGETS_SRC = "https://platform.twitter.com/widgets.js";

declare global {
  interface Window {
    twttr?: { widgets: { load: (el?: HTMLElement) => void } };
  }
}

export default function TwitterTimeline({ handle }: { handle: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (window.twttr?.widgets) {
      window.twttr.widgets.load(wrap);
      return;
    }
    if (!document.querySelector(`script[src="${WIDGETS_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = WIDGETS_SRC;
      s.async = true;
      document.body.appendChild(s);
    }
    // If the script is mid-load, its own onload scan picks up this anchor.
  }, [handle]);

  return (
    <div className="twitter-timeline-embed">
      <div className="twitter-embed-frame" ref={wrapRef}>
        <a
          className="twitter-timeline"
          data-theme="dark"
          data-chrome="transparent noborders nofooter"
          data-height="520"
          href={`https://twitter.com/${handle}`}
        >
          {/* widgets.js replaces this anchor with the rendered timeline */}
        </a>
      </div>
      <p className="twitter-note">
        Don’t see posts? X only shows embedded timelines to viewers signed into
        X — sign in on your browser to load them. (This works in Chrome; Safari
        and Firefox block the embed from reading your X session, so the timeline
        stays blank there.) Either way, you can always{" "}
        <a href={`https://x.com/${handle}`} target="_blank" rel="noreferrer">
          View on X →
        </a>
      </p>
    </div>
  );
}
