-- General image collections — arbitrary user-submitted images as a collection
-- (the only source whose material is bytes, not text). Run once in the Supabase
-- SQL editor. Safe to re-run.
--
-- The image BYTES live in Cloudflare R2 (lib/storage); Postgres only holds the
-- per-image metadata the editor and the hand-read work from. 'images' is NOT
-- added to entries_label_uniq: unlike API-sourced collections, arbitrary images
-- carry no global identity, so each one is its own world (same as 'text').

-- Re-surfaces an entry in the admin pending queue after its images change,
-- WITHOUT dropping the prior reading: the owner keeps seeing the old reading
-- (and the signature stays put) until the re-read is pasted in. Editing again
-- before that just leaves the flag true — the latest image set is always what
-- gets read.
alter table entries
  add column if not exists needs_reread boolean not null default false;

create table if not exists entry_images (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references entries(id) on delete cascade,
  storage_path text not null,
  -- SHA-256 of the raw bytes: the exact-duplicate "id". Submitting the same image
  -- again routes back to the constellation that already holds it (no image search,
  -- just a byte-for-byte match). A re-encode/resize won't match — that's intended.
  sha256       text,
  caption      text not null default '',
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);

-- The editor reads a collection's images in order; the admin renders them the
-- same way to do the hand-read.
create index if not exists entry_images_entry_idx
  on entry_images (entry_id, position);
-- Exact-duplicate lookup: given an incoming image's hash, find where it lives.
create index if not exists entry_images_sha256_idx
  on entry_images (sha256);
