-- Constello — manual alpha schema (branch: alpha-manual-readings).
-- Run once in the Supabase SQL editor for the project.
-- No auth/RLS: server writes with the service-role key; /admin is gated in-app.
--
-- Model: a person IS a constellation. No chosen names. A constellation is
-- identified by its uuid (stable URL) and, once it has been read, by an
-- embedding-derived `signature` (the live "shape"; null until the first reading
-- is fulfilled + embedded). Readings and essences are model-authored HTML
-- artifacts (self-contained worlds), stored whole and rendered as-is.

create extension if not exists "pgcrypto";

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
create table if not exists entries (
  id                uuid primary key default gen_random_uuid(),
  constellation_id  uuid not null references constellations(id) on delete cascade,
  label             text not null default '',
  raw_text          text not null,
  created_at        timestamptz not null default now()
);
create index if not exists entries_constellation_idx on entries(constellation_id);

-- One reading per entry. `artifact` is the model-authored HTML world.
create table if not exists readings (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null unique references entries(id) on delete cascade,
  artifact    text not null,
  created_at  timestamptz not null default now()
);

-- The cross-entry essence: one current artifact per constellation (upserted).
create table if not exists essences (
  id                uuid primary key default gen_random_uuid(),
  constellation_id  uuid not null unique references constellations(id) on delete cascade,
  artifact          text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
