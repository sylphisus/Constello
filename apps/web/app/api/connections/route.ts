import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import {
  listIncomingRequests,
  listSharedWithMe,
  listMyPendingRequests,
} from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET → connections panel data for the logged-in constellation: incoming
// requests to act on, who's shared with you, and how many of your own requests
// are still pending. Drives the Connections sidebar (was the /connections page).
export async function GET() {
  const me = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!me) return NextResponse.json({ loggedIn: false });

  const [incoming, shared, pending] = await Promise.all([
    listIncomingRequests(me),
    listSharedWithMe(me),
    listMyPendingRequests(me),
  ]);

  return NextResponse.json({
    loggedIn: true,
    incoming,
    shared,
    pendingCount: pending.length,
  });
}
