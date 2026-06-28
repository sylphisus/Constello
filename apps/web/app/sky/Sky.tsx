"use client";

import { useState } from "react";

type Star = {
  x: number;
  y: number;
  mine: boolean;
  match: "exact" | "near" | null;
  groupMatchCount: number;
};
type Link = { a: number; b: number; kind: "exact" | "near" };

// White stars on a gentle dark sky; your own stars and your near-twins glow gold,
// connected by a gold pulse (the recognition — drawn from full-dim cosine, not
// pixel distance). Hover a star to read your overlap with that constellation.
export default function Sky({
  stars,
  links,
  loggedIn,
  selfHref,
}: {
  stars: Star[];
  links: Link[];
  loggedIn: boolean;
  selfHref: string | null;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 1000;
  const H = 640;
  const PAD = 44;
  const xs = stars.map((s) => s.x);
  const ys = stars.map((s) => s.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sx = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (W - 2 * PAD);
  const sy = (y: number) => PAD + ((y - minY) / (maxY - minY || 1)) * (H - 2 * PAD);

  const info = hover != null ? stars[hover] : null;
  const infoText = info
    ? info.mine
      ? "one of your collections"
      : loggedIn
        ? info.groupMatchCount > 0
          ? `${info.groupMatchCount} of your collections ${info.groupMatchCount === 1 ? "is" : "are"} nearly identical to this constellation`
          : "another collection — no near match with yours"
        : "a collection"
    : loggedIn
      ? "hover a star · gold links are your near-twins"
      : "hover a star · log in to your constellation to see your matches";

  return (
    <div className="sky">
      <svg viewBox={`0 0 ${W} ${H}`} className="sky-svg" role="img" aria-label="constellation map">
        {links.map((l, i) => (
          <line
            key={i}
            x1={sx(stars[l.a].x)}
            y1={sy(stars[l.a].y)}
            x2={sx(stars[l.b].x)}
            y2={sy(stars[l.b].y)}
            className={l.kind === "exact" ? "pulse pulse-exact" : "pulse pulse-near"}
          />
        ))}
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={sx(s.x)}
            cy={sy(s.y)}
            r={s.mine ? 5 : 3}
            className={`star${s.mine ? " star-mine" : ""}${s.match ? " star-" + s.match : ""}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
      </svg>
      <p className="sky-info">{infoText}</p>
      {selfHref && (
        <p className="sky-self">
          <a className="text-link" href={selfHref}>
            ← your constellation
          </a>
        </p>
      )}
    </div>
  );
}
