-- Constello — manual alpha schema (branch: alpha-manual-readings).
-- Run once in the Supabase SQL editor for the project.
-- No auth/RLS: server writes with the service-role key; /admin is gated in-app.
--
-- Model: a person IS a constellation. No chosen names. A constellation is
-- identified by its uuid (stable URL) and, once it has been read, by an
-- embedding-derived `signature` (the live "shape"; null until the first reading
-- is fulfilled + embedded). Readings and essences are model-authored markdown
-- artifacts (self-contained worlds), stored whole and rendered as-is.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- One per person/world. signature is null until the first reading is embedded.
create table if not exists constellations (
  id          uuid primary key default gen_random_uuid(),
  signature   text,
  created_at  timestamptz not null default now()
);

-- Every signature a constellation has ever had → the constellation, so an old
-- link never 404s: it forwards to the constellation's current shape.
create table if not exists signature_history (
  signature        text primary key,
  constellation_id uuid not null references constellations(id) on delete cascade,
  created_at       timestamptz not null default now()
);
create index if not exists signature_history_constellation_idx
  on signature_history(constellation_id);

-- One collection the person submitted. The act of including it is the signal.
-- "pending" = an entry with no reading row yet (Ethan fulfills by hand).
-- `source` is the collection type: 'text' (pasted/uploaded writing), 'lastfm',
-- 'twitter', or 'pinterest'. The non-text sources are fetched from an API and
-- formatted into raw_text by an adapter (lib/collections/*); the reading is
-- still by hand.
create table if not exists entries (
  id                uuid primary key default gen_random_uuid(),
  constellation_id  uuid not null references constellations(id) on delete cascade,
  source            text not null default 'text',
  label             text not null default '',
  raw_text          text not null,
  created_at        timestamptz not null default now()
);
-- `create table if not exists` above won't add columns to a table that already
-- exists, so add `source` explicitly for DBs created before this column did.
alter table entries add column if not exists source text not null default 'text';
create index if not exists entries_constellation_idx on entries(constellation_id);

-- A collection is global-unique by its identity, so the same one never spawns a
-- second constellation (the app routes a duplicate to the existing one; these
-- are the DB backstop against the race window). The identity mirrors
-- lib/collections/entries.findDuplicateEntry: the API sources (lastfm, twitter)
-- carry it in their deterministic label, matched case-insensitively; text has no
-- reliable label, so the pasted body is the identity (md5 keeps the index within
-- btree's row-size limit). Assumes no pre-existing duplicates in the table.
create unique index if not exists entries_label_uniq
  on entries (source, lower(label))
  where source in ('lastfm', 'twitter', 'pinterest');
create unique index if not exists entries_text_uniq
  on entries (md5(raw_text))
  where source = 'text';

-- One reading per entry. `artifact` is the model-authored markdown world.
-- `embedding` is the voyage-4-large vector of that artifact (the "world"), the
-- per-reading signal the constellation signature is derived from. We embed the
-- READING, never the raw entry (the furniture). Null until the artifact is
-- embedded; best-effort, so a reading can exist without it.
create table if not exists readings (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null unique references entries(id) on delete cascade,
  artifact    text not null,
  embedding   vector(1024),
  created_at  timestamptz not null default now()
);
-- For DBs created before the embedding column existed.
alter table readings add column if not exists embedding vector(1024);

-- The cross-entry essence: one current artifact per constellation (upserted).
create table if not exists essences (
  id                uuid primary key default gen_random_uuid(),
  constellation_id  uuid not null unique references constellations(id) on delete cascade,
  artifact          text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- How to reach a constellation when its reading lands. Inbound-first where it
-- can be: the iMessage handle is captured when the person texts our line (the
-- text is the consent), email is opted in from the constellation page, the
-- twitter handle doubles as a contact from the X tab. `verified` is true once
-- we've actually seen the person on that channel (always true for inbound-
-- captured iMessage). Private channels carry the bearer link; see lib/notify.
create table if not exists contacts (
  id                uuid primary key default gen_random_uuid(),
  constellation_id  uuid not null references constellations(id) on delete cascade,
  channel           text not null check (channel in ('email', 'imessage', 'twitter', 'discord')),
  address           text not null,
  verified          boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (constellation_id, channel, address)
);
create index if not exists contacts_constellation_idx on contacts(constellation_id);
-- `create table if not exists` won't widen the check on an already-created table,
-- so re-assert it explicitly to add 'discord' (a public @mention channel) for DBs
-- that predate it.
alter table contacts drop constraint if exists contacts_channel_check;
alter table contacts add constraint contacts_channel_check
  check (channel in ('email', 'imessage', 'twitter', 'discord'));

-- One row per notification actually sent → idempotency. `ref` is the entry_id
-- for a reading or the constellation_id for an essence; the unique constraint is
-- what lets notifyReadingReady run on every save without re-sending.
create table if not exists notifications (
  id                uuid primary key default gen_random_uuid(),
  constellation_id  uuid not null references constellations(id) on delete cascade,
  contact_id        uuid not null references contacts(id) on delete cascade,
  kind              text not null check (kind in ('reading', 'essence')),
  ref               text not null,
  channel           text not null,
  created_at        timestamptz not null default now(),
  unique (contact_id, kind, ref)
);
