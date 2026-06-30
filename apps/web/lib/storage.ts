import { AwsClient } from "aws4fetch";

// Object storage for user-submitted images (the only source whose material is
// bytes, not text). Bytes live in Cloudflare R2 — S3-compatible, CDN-fronted, no
// egress fees — so the store has no scaling cliff. The DB only ever holds a
// `storage_path`; every URL is derived through imageUrl() against one public
// base, so moving buckets later (e.g. R2 → anywhere S3-compatible) is a bucket
// copy + an env swap, never an app change.
//
// Five env vars (set in Vercel):
//   R2_ACCOUNT_ID         — the Cloudflare account id (forms the S3 endpoint)
//   R2_ACCESS_KEY_ID      — an R2 API token's access key
//   R2_SECRET_ACCESS_KEY  — …and its secret
//   R2_BUCKET             — the bucket name
//   R2_PUBLIC_BASE        — the bucket's public URL base, no trailing slash
//                           (a custom domain like https://images.constello.xyz,
//                           or the bucket's r2.dev dev URL)

const accountId = () => process.env.R2_ACCOUNT_ID ?? "";
const bucket = () => process.env.R2_BUCKET ?? "";
const publicBase = () => (process.env.R2_PUBLIC_BASE ?? "").replace(/\/+$/, "");

let client: AwsClient | null | undefined;
function r2(): AwsClient | null {
  if (client !== undefined) return client;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId() || !bucket() || !accessKeyId || !secretAccessKey || !publicBase()) {
    console.warn("[storage] R2_* env not fully set — image storage disabled.");
    client = null;
    return client;
  }
  // R2 speaks the S3 API; aws4fetch signs the request with SigV4. "auto" region
  // is what R2 expects.
  client = new AwsClient({ accessKeyId, secretAccessKey, region: "auto", service: "s3" });
  return client;
}

export function storageConfigured(): boolean {
  return r2() !== null;
}

function objectUrl(path: string): string {
  return `https://${accountId()}.r2.cloudflarestorage.com/${bucket()}/${path}`;
}

/** Put one object. Throws if storage isn't configured or R2 rejects it. */
export async function uploadImage(
  path: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const c = r2();
  if (!c) throw new Error("Image storage is not configured.");
  const res = await c.fetch(objectUrl(path), {
    method: "PUT",
    // A Uint8Array is a valid BufferSource body; the cast sidesteps a TS lib
    // mismatch over ArrayBuffer generics.
    body: body as BodyInit,
    // R2's S3 API rejects chunked uploads (411 Length Required). Next.js's
    // patched fetch reconstructs the request and drops the known body length,
    // so the PUT would otherwise go out Transfer-Encoding: chunked. Set the
    // length explicitly to force a fixed-length request. (content-length is in
    // aws4fetch's UNSIGNABLE_HEADERS, so this doesn't affect the SigV4 signature.)
    headers: { "content-type": contentType, "content-length": String(body.byteLength) },
  });
  if (!res.ok) {
    throw new Error(`R2 upload failed (${res.status}).`);
  }
}

/** Delete one object. Best-effort: a 404 (already gone) is not an error. */
export async function deleteImage(path: string): Promise<void> {
  const c = r2();
  if (!c) return;
  const res = await c.fetch(objectUrl(path), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed (${res.status}).`);
  }
}

/** The public URL the browser loads, derived from the stored path. */
export function imageUrl(path: string): string {
  return `${publicBase()}/${path}`;
}
