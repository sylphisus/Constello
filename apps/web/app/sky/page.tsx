import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { buildSky } from "@/lib/sky";
import Sky from "./Sky";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The public sky: every collection is a star (1 collection = 1 star). Anyone can
// look; constellations stay private (no links into anyone's page). When you're
// logged in, your near-twins light up gold and you can read, per star, how many
// of your collections are nearly identical to that constellation — recognition
// without exposing the page.
export default async function SkyPage() {
  const viewer = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  const sky = await buildSky(viewer);
  if (!sky) {
    return (
      <main className="wrap">
        <p className="error">Persistence not configured.</p>
      </main>
    );
  }

  // Strip raw constellation ids before sending to the client; attach only the
  // viewer-relative count so other people's identities never reach the browser.
  const stars = sky.stars.map((s) => ({
    x: s.x,
    y: s.y,
    mine: s.mine,
    match: s.match,
    groupMatchCount: sky.matchCountByConstellation[s.constellationId] ?? 0,
  }));

  return (
    <main className="wrap">
      <div className="mark">
        <h1>The sky</h1>
        <p>
          {sky.stars.length} {sky.stars.length === 1 ? "star" : "stars"} · 1 collection = 1 star
        </p>
      </div>

      {sky.stars.length === 0 ? (
        <p className="framing">No stars yet — the sky fills as readings land.</p>
      ) : (
        <Sky
          stars={stars}
          links={sky.links}
          loggedIn={Boolean(viewer)}
          selfHref={viewer ? `/c/${viewer}` : null}
        />
      )}
    </main>
  );
}
