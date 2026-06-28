-- Incremental: add the three native collection types to the dedupe identity
-- (Obsidian vaults, Google Docs, Notion databases). Run once in the Supabase
-- SQL editor. Safe to re-run.
--
-- entries.source has no CHECK constraint, so the new rows already insert; the
-- only thing to update is the partial unique index that dedupes API/upload
-- sourced collections by their deterministic label. A partial index's WHERE
-- predicate can't be ALTERed, so drop and recreate it to include the new ones.
-- ('spotify' is also folded in here — it's a connect source that was never
-- added to the index, so this closes that gap at the same time.)

drop index if exists entries_label_uniq;
create unique index if not exists entries_label_uniq
  on entries (source, lower(label))
  where source in (
    'lastfm', 'twitter', 'pinterest', 'spotify', 'obsidian', 'google-docs', 'notion'
  );
