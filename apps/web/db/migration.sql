-- Constello prototype — general text adapter (§6.5) + essence synthesis (§7).
-- Run this once in the Supabase SQL editor for your project.
-- No auth / RLS in the prototype: a single local user, server writes with the
-- service-role key.

create extension if not exists "pgcrypto";

-- One row per text the person chose to include. The act of including this
-- particular text is itself the signal (§6.5).
create table if not exists text_submissions (
  id          uuid primary key default gen_random_uuid(),
  label       text not null default '',
  raw_text    text not null,
  created_at  timestamptz not null default now()
);

-- One Node per submission. We do not theme-split a submission (§6.5).
create table if not exists nodes (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references text_submissions(id) on delete cascade,
  title          text not null,
  reading        text not null,
  created_at     timestamptz not null default now()
);

create index if not exists nodes_submission_id_idx on nodes(submission_id);

-- The essence synthesis, cached on a fingerprint of all node readings + raw
-- material; recomputed only when something upstream changes (§7).
create table if not exists syntheses (
  id           uuid primary key default gen_random_uuid(),
  fingerprint  text not null unique,
  text         text not null,
  created_at   timestamptz not null default now()
);
