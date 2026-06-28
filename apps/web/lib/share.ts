// Sharing + view-requests. A constellation is private (lib/auth); a share opens
// it to one other constellation. The recognition path is: meet a near-twin on the
// sky → request to see them (which shares yours first, the reciprocity rule) →
// they're notified → they grant → you can open them. Voluntary shares skip the
// request. See migration.sharing.sql.

import { supabase } from "./supabase";

type DB = NonNullable<ReturnType<typeof supabase>>;

/** Can the viewer open this constellation? (owner, or has been granted access.) */
export async function canView(viewerId: string | null, ownerId: string): Promise<boolean> {
  if (!viewerId) return false;
  if (viewerId === ownerId) return true;
  const db = supabase();
  if (!db) return false;
  const { data } = await db
    .from("shares")
    .select("grantor_id")
    .eq("grantor_id", ownerId)
    .eq("grantee_id", viewerId)
    .maybeSingle();
  return Boolean(data);
}

/** grantor opens themselves to grantee. Idempotent. */
async function share(db: DB, grantorId: string, granteeId: string) {
  await db
    .from("shares")
    .upsert({ grantor_id: grantorId, grantee_id: granteeId }, { onConflict: "grantor_id,grantee_id" });
}

/** A voluntary share: open mine to them. Caller sends the 'share' notification. */
export async function createShare(grantorId: string, granteeId: string): Promise<boolean> {
  const db = supabase();
  if (!db || grantorId === granteeId) return false;
  await share(db, grantorId, granteeId);
  return true;
}

/** Request to see target: share mine to them (reciprocity, silent) + log the
 *  request. Caller sends only the 'request' notification (no double-notify). */
export async function createRequest(requesterId: string, targetId: string): Promise<boolean> {
  const db = supabase();
  if (!db || requesterId === targetId) return false;
  await share(db, requesterId, targetId); // the required reciprocal — no notification
  await db
    .from("view_requests")
    .upsert({ requester_id: requesterId, target_id: targetId }, { onConflict: "requester_id,target_id" });
  return true;
}

/** Grant a request: open mine to the requester and clear the pending request.
 *  Granting is itself a share, so the caller sends them the 'share' notification. */
export async function grantRequest(ownerId: string, requesterId: string): Promise<boolean> {
  const db = supabase();
  if (!db) return false;
  await share(db, ownerId, requesterId);
  await db
    .from("view_requests")
    .delete()
    .eq("requester_id", requesterId)
    .eq("target_id", ownerId);
  return true;
}

export interface Peer {
  id: string;
  signature: string | null;
}

// Pending requests to see ME (each requester has already shared theirs, so I can
// open them — hence the signature for a link).
export async function listIncomingRequests(ownerId: string): Promise<Peer[]> {
  const db = supabase();
  if (!db) return [];
  const { data } = await db
    .from("view_requests")
    .select("requester:constellations!view_requests_requester_id_fkey(id, signature)")
    .eq("target_id", ownerId);
  return (data ?? [])
    .map((r) => (Array.isArray(r.requester) ? r.requester[0] : r.requester) as Peer | null)
    .filter((p): p is Peer => Boolean(p));
}

// Constellations that have shared themselves with ME — the ones I can open.
export async function listSharedWithMe(viewerId: string): Promise<Peer[]> {
  const db = supabase();
  if (!db) return [];
  const { data } = await db
    .from("shares")
    .select("grantor:constellations!shares_grantor_id_fkey(id, signature)")
    .eq("grantee_id", viewerId);
  return (data ?? [])
    .map((r) => (Array.isArray(r.grantor) ? r.grantor[0] : r.grantor) as Peer | null)
    .filter((p): p is Peer => Boolean(p));
}

// My outstanding requests that haven't been granted yet (no reverse share exists).
export async function listMyPendingRequests(requesterId: string): Promise<string[]> {
  const db = supabase();
  if (!db) return [];
  const { data: reqs } = await db
    .from("view_requests")
    .select("target_id")
    .eq("requester_id", requesterId);
  const targets = (reqs ?? []).map((r) => r.target_id as string);
  if (!targets.length) return [];
  // Drop any the target has already granted (a share grantor=target, grantee=me).
  const { data: granted } = await db
    .from("shares")
    .select("grantor_id")
    .eq("grantee_id", requesterId)
    .in("grantor_id", targets);
  const grantedSet = new Set((granted ?? []).map((g) => g.grantor_id as string));
  return targets.filter((t) => !grantedSet.has(t));
}
