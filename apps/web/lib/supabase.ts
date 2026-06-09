import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Persistence is best-effort for the prototype: if Supabase isn't configured
// yet, the reading → synthesis loop still runs and simply isn't durable. This
// lets the prototype be demonstrable with only an Anthropic key, and become
// persistent the moment the Supabase vars are filled in .env.local.

let client: SupabaseClient | null | undefined;

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.SUPABASE_URL;
  // Server-side writes use the service-role key (bypasses RLS); there is no
  // auth in the prototype.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn(
      "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — running without persistence.",
    );
    client = null;
    return client;
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return client;
}

export function isPersistenceEnabled(): boolean {
  return supabase() !== null;
}
