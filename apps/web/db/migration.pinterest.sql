-- Incremental: add 'pinterest' to the dedupe identity (branch: pinterest boards).
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- entries.source has no CHECK constraint, so 'pinterest' rows already insert;
-- the only thing to update is the partial unique index that dedupes API-sourced
-- collections by their deterministic label. A partial index's WHERE predicate
-- can't be ALTERed, so drop and recreate it to include 'pinterest'.

drop index if exists entries_label_uniq;
create unique index if not exists entries_label_uniq
  on entries (source, lower(label))
  where source in ('lastfm', 'twitter', 'pinterest');
