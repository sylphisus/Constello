import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import {
  listIncomingRequests,
  listSharedWithMe,
  listMyPendingRequests,
} from "@/lib/share";
import Connections from "./Connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manage who can see you and who you can see. Lives off the (private) constellation
// page so it's self-contained. Requires being logged in — the session is your
// identity. Requests/shares are initiated from the sky; this is where you act on them.
export default async function ConnectionsPage() {
  const me = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!me) {
    return (
      <main className="wrap">
        <div className="mark">
          <h1>Connections</h1>
          <p>log in to your constellation first</p>
        </div>
        <p className="framing">
          Open your constellation — your link, or by re-entering one of your
          collections — to log in, then come back here.
        </p>
      </main>
    );
  }

  const [incoming, shared, pending] = await Promise.all([
    listIncomingRequests(me),
    listSharedWithMe(me),
    listMyPendingRequests(me),
  ]);

  return <Connections incoming={incoming} shared={shared} pendingCount={pending.length} />;
}
