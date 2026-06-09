# Constello — general text adapter (prototype)

The §6.5 catch-all adapter end to end: bring text you've kept → each piece is
read on its own (Haiku 4.5, the §6.5 reading prompt) → an essence is composed
across all of them (Sonnet 4.6, the §7 synthesis prompt). One Node per
submission; the essence is presented simply as *your essence*, never labelled by
the collection it came from.

## Run it

1. **Anthropic key** — required for any reading. Add it to the workspace-root
   `.env.local` (the app loads it via `next.config.ts`):

   ```
   ANTHROPIC_API_KEY=sk-ant-…
   ```

2. **Install & start:**

   ```
   cd apps/web
   npm install
   npm run dev          # http://localhost:3000
   ```

That's the whole loop — paste a few texts, read each, compose the essence.

## Persistence (optional)

Persistence is best-effort. Without Supabase, readings live for the session and
a small flag says so. To make them durable:

1. Create a Supabase project, open the SQL editor, run `db/migration.sql`.
2. Add to the root `.env.local`:

   ```
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role key>
   ```

Submissions, node readings, and the essence (cached on an input fingerprint)
are then stored.

## What's deliberately not here

- No embeddings / pgvector — nothing in this prototype matches or ranks, so the
  Voyage step (§6.5) is deferred until the Sky/pairwise pipeline exists.
- No auth — a single local user.
- Only the general-text adapter. The other four adapters and the Sky are out of
  scope for this prototype.

## Layout

```
apps/web/
  app/
    page.tsx                       # the whole flow (client)
    api/collections/text/route.ts  # POST a submission → one Node reading
    api/synthesis/route.ts         # POST nodes → the essence (fingerprint-cached)
  lib/
    prompts.ts                     # §6.5 reading + §7 synthesis prompts (verbatim)
    anthropic.ts  supabase.ts  types.ts
  db/migration.sql                 # Supabase schema
```
