// Notion database collection adapter.
//
// A Notion database is a person's own structured world — what they decided was
// worth tracking, and the columns they decided it by. Reading it requires their
// grant (lib/notion-oauth.ts); Notion's consent screen lets them choose exactly
// which databases the integration sees. We pull the granted databases' rows
// once and discard the token. The formatter is pure.
//
// In the manual alpha a collection is one entry → one reading, so all granted
// databases are formatted into a single entry (like Pinterest's boards).

const API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// Caps so one connect stays a bounded handful of requests / a bounded entry.
const MAX_DATABASES = 10;
const MAX_PAGES_PER_DB = 50;

export interface NotionPage {
  title: string;
  /** Non-title properties rendered as "Name: value" lines. */
  props: string[];
}

export interface NotionDatabase {
  title: string;
  description: string | null;
  pages: NotionPage[];
}

export interface NotionData {
  workspaceName: string | null;
  databases: NotionDatabase[];
}

// ── Fetch ──────────────────────────────────────────────────────────────────────

async function notion(
  token: string,
  path: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = str(json.message) || `Notion request failed (${res.status}).`;
    throw new Error(`Notion: ${msg}`);
  }
  return json;
}

export async function fetchNotion(
  token: string,
  workspaceName: string | null,
): Promise<NotionData> {
  // Find the databases the person shared with the integration.
  const search = await notion(token, "/search", {
    filter: { value: "database", property: "object" },
    page_size: MAX_DATABASES,
  });
  const dbItems = asArray(search.results).slice(0, MAX_DATABASES);

  const databases: NotionDatabase[] = await Promise.all(
    dbItems.map(async (db) => {
      const id = str(db.id);
      const title = richText(db.title) || "Untitled database";
      const description = richText(db.description) || null;

      let pages: NotionPage[] = [];
      try {
        const q = await notion(token, `/databases/${id}/query`, {
          page_size: MAX_PAGES_PER_DB,
        });
        pages = asArray(q.results).slice(0, MAX_PAGES_PER_DB).map(parsePage);
      } catch {
        // One database failing shouldn't sink the whole import.
      }
      return { title, description, pages };
    }),
  );

  return { workspaceName, databases };
}

// A page's properties are a map of name → typed value object. Pull the title
// property out as the page's name and render the rest as readable lines.
function parsePage(page: Record<string, unknown>): NotionPage {
  const properties = (page.properties as Record<string, unknown>) ?? {};
  let title = "";
  const props: string[] = [];
  for (const [name, value] of Object.entries(properties)) {
    const prop = value as Record<string, unknown>;
    if (prop?.type === "title") {
      title = richText(prop.title);
      continue;
    }
    const text = propToText(prop);
    if (text) props.push(`${name}: ${text}`);
  }
  return { title: title || "(untitled)", props };
}

// Render one typed Notion property value as plain text. Covers the property
// types that actually carry a person's signal; anything unrecognized is skipped.
function propToText(prop: Record<string, unknown>): string {
  switch (prop?.type) {
    case "rich_text":
      return richText(prop.rich_text);
    case "number":
      return prop.number == null ? "" : String(prop.number);
    case "select":
      return str((prop.select as Record<string, unknown>)?.name);
    case "status":
      return str((prop.status as Record<string, unknown>)?.name);
    case "multi_select":
      return asArray(prop.multi_select).map((o) => str(o.name)).filter(Boolean).join(", ");
    case "date": {
      const d = prop.date as Record<string, unknown> | null;
      if (!d) return "";
      return [str(d.start), str(d.end)].filter(Boolean).join(" → ");
    }
    case "checkbox":
      return prop.checkbox ? "yes" : "no";
    case "url":
      return str(prop.url);
    case "email":
      return str(prop.email);
    case "phone_number":
      return str(prop.phone_number);
    default:
      return "";
  }
}

// Notion title/description/rich_text are arrays of rich-text objects; the plain
// text lives under `plain_text` on each segment.
function richText(v: unknown): string {
  return asArray(v).map((seg) => str(seg.plain_text)).join("").trim();
}
function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// ── Format ───────────────────────────────────────────────────────────────────

/** Pure: normalized data → the entry text the reading is drawn from. */
export function formatNotion(data: NotionData): { label: string; rawText: string } {
  const workspace = data.workspaceName ?? "Notion";
  const lines: string[] = [`Notion databases from the "${workspace}" workspace.`];

  for (const db of data.databases) {
    lines.push("", `Database: ${db.title} (${db.pages.length} entries)`);
    if (db.description) lines.push(`  ${db.description}`);
    for (const page of db.pages) {
      lines.push(`  - ${page.title}${page.props.length ? ` — ${page.props.join("; ")}` : ""}`);
    }
  }

  return { label: `Notion · ${workspace}`, rawText: lines.join("\n") };
}
