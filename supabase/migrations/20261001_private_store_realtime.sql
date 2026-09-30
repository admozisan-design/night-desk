-- Never publish raw order/customer record changes. Postgres Changes DELETE
-- events are not protected by row-level policies; instead publish per-store
-- notices with RLS so other stores cannot even observe deleted record IDs.
create table if not exists public.nightdesk_store_changes(
  store_id uuid not null references public.nightdesk_stores(id) on delete cascade,
  bucket text not null,
  version bigint not null default 1,
  changed_at timestamptz not null default now(),
  primary key(store_id,bucket)
);
alter table public.nightdesk_store_changes enable row level security;
revoke all on public.nightdesk_store_changes from public,anon,authenticated;
grant select on public.nightdesk_store_changes to authenticated;
drop policy if exists "members see only their store notices" on public.nightdesk_store_changes;
create policy "members see only their store notices"
on public.nightdesk_store_changes for select to authenticated
using(public.nightdesk_is_member(store_id));

create or replace function public.nightdesk_signal_store_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_store uuid;
  v_bucket text;
begin
  if tg_op='DELETE' then
    v_store:=old.store_id;
    v_bucket:=old.bucket;
  else
    v_store:=new.store_id;
    v_bucket:=new.bucket;
  end if;
  -- A store deletion can cascade through its records after deleting parent.
  if exists(select 1 from public.nightdesk_stores where id=v_store) then
    insert into public.nightdesk_store_changes(store_id,bucket,version,changed_at)
      values(v_store,v_bucket,1,now())
    on conflict(store_id,bucket) do update set
      version=public.nightdesk_store_changes.version+1,changed_at=now();
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.nightdesk_signal_store_change()
from public,anon,authenticated;
drop trigger if exists nightdesk_store_records_signal on public.nightdesk_records;
create trigger nightdesk_store_records_signal
after insert or update or delete on public.nightdesk_records
for each row execute function public.nightdesk_signal_store_change();

-- Raw record DELETE cannot be safely filtered by Realtime; remove ALL raw
-- events from its publication (including adversarial manual subscriptions).
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if exists(
      select 1 from pg_publication_tables where pubname='supabase_realtime'
        and schemaname='public' and tablename='nightdesk_records'
    ) then
      alter publication supabase_realtime drop table public.nightdesk_records;
    end if;
    if not exists(
      select 1 from pg_publication_tables where pubname='supabase_realtime'
        and schemaname='public' and tablename='nightdesk_store_changes'
    ) then
      alter publication supabase_realtime add table public.nightdesk_store_changes;
    end if;
  end if;
end;
$$;