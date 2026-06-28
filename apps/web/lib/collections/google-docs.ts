// Google Docs collection adapter.
//
// A Google Doc is a piece of a person's own writing — it reads in the same
// register as the general-text source, just fetched natively. Reading someone's
// doc requires their grant, so (like Pinterest) there's no public-by-id fetch:
// the client runs the Google Picker, the person picks a doc, and we receive a
// short-lived access token + the doc id. We pull the text once and discard the
// token; the formatter is pure and provider-agnostic.

const DRIVE = "https://www.googleapis.com/drive/v3";

export interface GoogleDocData {
  title: string;
  text: string;
}

// ── Fetch ──────────────────────────────────────────────────────────────────────
// Token-scoped: the Picker hands the browser an OAuth token, which the route
// forwards here for a single pull. We never store it.

async function driveGet(token: string, path: string): Promise<Response> {
  const res = await fetch(`${DRIVE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let msg = `Google request failed (${res.status}).`;
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      if (json.error?.message) msg = `Google: ${json.error.message}`;
    } catch {
      // non-JSON error body; keep the status message
    }
    throw new Error(msg);
  }
  return res;
}

export async function fetchGoogleDoc(token: string, docId: string): Promise<GoogleDocData> {
  // Name first (a doc's title is itself a signal the person chose).
  const meta = (await (await driveGet(token, `/files/${docId}?fields=name`)).json()) as {
    name?: string;
  };
  // Export the doc as plain text — faithful to the writing, drops only styling.
  const text = await (
    await driveGet(token, `/files/${docId}/export?mimeType=text/plain`)
  ).text();

  return { title: (meta.name ?? "Untitled").trim() || "Untitled", text };
}

// ── Format ───────────────────────────────────────────────────────────────────

/** Pure: doc data → the entry text the reading is drawn from. */
export function formatGoogleDoc(data: GoogleDocData): { label: string; rawText: string } {
  const lines = [`Google Doc "${data.title}".`, "", data.text.trim()];
  return { label: `Google Doc · ${data.title}`, rawText: lines.join("\n") };
}
