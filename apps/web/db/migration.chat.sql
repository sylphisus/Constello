-- Constello — on-platform chat (talk to your reading about your own world).
-- Run once in the Supabase SQL editor, after migration.alpha.sql.
--
-- A constellation's owner asks about their own collections + essence; the reply
-- is fulfilled BY HAND from the admin console, exactly like a reading. The
-- owner's message is queued here as a 'user' row (answered=false); Ethan pastes
-- the assembled context into claude.ai and saves Opus's answer as an 'assistant'
-- row, which appears back in the thread on the owner's constellation page.

create table if not exists constellation_messages (
  id               uuid primary key default gen_random_uuid(),
  constellation_id uuid not null references constellations(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  -- Only meaningful on role='user' rows: flips true once a reply is saved.
  answered         boolean not null default false,
  created_at       timestamptz not null default now()
);

-- The thread, in order, for one constellation (the page render + admin context).
create index if not exists constellation_messages_thread_idx
  on constellation_messages (constellation_id, created_at);

-- The admin inbox: unanswered owner questions, oldest first.
create index if not exists constellation_messages_inbox_idx
  on constellation_messages (created_at)
  where role = 'user' and answered = false;
