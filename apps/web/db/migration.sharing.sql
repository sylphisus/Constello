-- Sharing + view-requests (run once in the Supabase SQL editor / via the pg client).
--
-- Constellations are private. A `share` lets the grantee view the grantor. A
-- request to see someone requires sharing yours first (reciprocity), so the
-- target can already see you when they weigh the request. Access rule lives in
-- lib/share.canView: V can view A iff V = A or a share(grantor=A, grantee=V) exists.

create table if not exists shares (
  grantor_id uuid not null references constellations(id) on delete cascade,
  grantee_id uuid not null references constellations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (grantor_id, grantee_id)
);
create index if not exists shares_grantee_idx on shares(grantee_id);

create table if not exists view_requests (
  requester_id uuid not null references constellations(id) on delete cascade,
  target_id    uuid not null references constellations(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (requester_id, target_id)
);
create index if not exists view_requests_target_idx on view_requests(target_id);

-- Notifications now also cover connection events. For these, `ref` holds the
-- *other* constellation's id (the sharer for 'share', the requester for 'request'),
-- so the (contact, kind, ref) unique constraint still gives once-per-event.
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('reading', 'essence', 'share', 'request'));
