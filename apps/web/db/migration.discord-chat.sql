-- Constello — conversational Discord channel (talk to Opus about your matches).
-- Run once in the Supabase SQL editor, after migration.alpha.sql.
--
-- The bot is talked to CONVERSATIONALLY: a user @mentions the bot or replies to
-- it in the mutual server, a gateway listener (apps/bot/) forwards the message to
-- /api/inbound/discord, and it lands here as an inbound question. Ethan answers
-- by hand from the admin console (copies the assembled context into claude.ai,
-- pastes Opus's reply back); the reply is posted as a native Discord reply and
-- logged here as an outbound row. The signal for "who is my closest match on this
-- server?" is computed by nearest_servermates() below.

create extension if not exists "vector";

-- One row per message in a bot conversation, inbound or outbound.
--  · in : a user's @mention/reply, forwarded by the listener. discord_message_id
--         is the snowflake of THAT message, so the reply can thread off it.
--  · out: the answer we posted (for the record + to mark the question answered).
-- constellation_id is resolved from the author's discord snowflake via `contacts`
-- (channel='discord'); null when the author has no linked constellation yet
-- (an "unlinked" knock — the admin surfaces it so Ethan can invite them).
create table if not exists discord_messages (
  id                  uuid primary key default gen_random_uuid(),
  discord_message_id  text not null,
  discord_user_id     text not null,
  discord_username    text not null default '',
  channel_id          text not null,
  guild_id            text,
  constellation_id    uuid references constellations(id) on delete set null,
  content             text not null,
  direction           text not null default 'in' check (direction in ('in', 'out')),
  answered            boolean not null default false,
  created_at          timestamptz not null default now()
);
-- The listener may redeliver on a gateway resume; the snowflake makes an inbound
-- message idempotent so a redelivery doesn't create a duplicate question.
create unique index if not exists discord_messages_in_uniq
  on discord_messages (discord_message_id)
  where direction = 'in';
create index if not exists discord_messages_inbox_idx
  on discord_messages (created_at)
  where direction = 'in' and answered = false;

-- The match signal. Given an asker constellation, return the nearest OTHER
-- constellations that are members of the mutual server, by embedding similarity.
--
--  · A constellation's shape = the CENTROID of its reading embeddings (we embed
--    the reading — the world someone is building — never the raw entry). avg() is
--    a pgvector aggregate over vector(1024).
--  · "member of the server" = has a verified `discord` contact. (Single-guild
--    alpha; per-guild scoping is deferred.)
--  · similarity = cosine similarity in [-1, 1] (1 - cosine distance).
-- Returns each match's signature + current essence so the caller can hand Opus
-- the rhyming worlds, not raw furniture.
create or replace function nearest_servermates(asker uuid, k int default 5)
returns table (
  constellation_id uuid,
  similarity       double precision,
  signature        text,
  essence          text
)
language sql
stable
as $$
  with centroids as (
    select e.constellation_id as cid, avg(r.embedding) as vec
    from readings r
    join entries e on e.id = r.entry_id
    where r.embedding is not null
    group by e.constellation_id
  ),
  members as (
    select distinct constellation_id as cid
    from contacts
    where channel = 'discord' and verified = true
  ),
  asker_c as (
    select vec from centroids where cid = asker
  )
  select
    c.cid,
    1 - (c.vec <=> a.vec) as similarity,
    con.signature,
    es.artifact as essence
  from centroids c
  cross join asker_c a
  join members m on m.cid = c.cid
  join constellations con on con.id = c.cid
  left join essences es on es.constellation_id = c.cid
  where c.cid <> asker
  order by c.vec <=> a.vec
  limit k;
$$;
