-- NIGHT DESK cloud mode: run against a DEDICATED Supabase project.
-- No demo data is automatically imported. The anon key is safe for browser use;
-- the service role key must only exist in server-side environment variables.
create extension if not exists pgcrypto;

create table if not exists public.nightdesk_stores(
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.nightdesk_memberships(
  store_id uuid not null references public.nightdesk_stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','staff')),
  created_at timestamptz not null default now(),
  primary key(store_id,user_id)
);

create table if not exists public.nightdesk_records(
  store_id uuid not null references public.nightdesk_stores(id) on delete cascade,
  bucket text not null check(bucket in (
    'orders','casts','drivers','hotels','staff','options','customers','pricing',
    'store_settings','permissions','settlement','settlement_daily','shared_memo',
    'navigation','dispatch_widgets','audit_logs'
  )),
  item_id text not null check(length(item_id) between 1 and 256),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key(store_id,bucket,item_id)
);
create index if not exists nightdesk_records_bucket_idx on public.nightdesk_records(store_id,bucket);

create table if not exists public.nightdesk_backups(
  store_id uuid not null references public.nightdesk_stores(id) on delete cascade,
  backup_date date not null,
  records jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key(store_id,backup_date)
);

-- SECURITY DEFINER helpers avoid recursive RLS on membership checks.
create or replace function public.nightdesk_is_member(p_store_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.nightdesk_memberships m
    where m.store_id=p_store_id and m.user_id=(select auth.uid())
  )
$$;
create or replace function public.nightdesk_is_admin(p_store_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.nightdesk_memberships m
    where m.store_id=p_store_id and m.user_id=(select auth.uid()) and m.role='admin'
  )
$$;
revoke all on function public.nightdesk_is_member(uuid) from public;
revoke all on function public.nightdesk_is_admin(uuid) from public;
grant execute on function public.nightdesk_is_member(uuid) to authenticated;
grant execute on function public.nightdesk_is_admin(uuid) to authenticated;

alter table public.nightdesk_stores enable row level security;
alter table public.nightdesk_memberships enable row level security;
alter table public.nightdesk_records enable row level security;
alter table public.nightdesk_backups enable row level security;

create policy "store members read store" on public.nightdesk_stores for select to authenticated
using(public.nightdesk_is_member(id));
create policy "members read their own membership and admins see team" on public.nightdesk_memberships
for select to authenticated
using(user_id=(select auth.uid()) or public.nightdesk_is_admin(store_id));
create policy "members read store records" on public.nightdesk_records for select to authenticated
using(public.nightdesk_is_member(store_id));
create policy "members insert store records" on public.nightdesk_records for insert to authenticated
with check(public.nightdesk_is_member(store_id) and updated_by=(select auth.uid()));
create policy "members edit store records" on public.nightdesk_records for update to authenticated
using(public.nightdesk_is_member(store_id))
with check(public.nightdesk_is_member(store_id) and updated_by=(select auth.uid()));
create policy "members delete store records" on public.nightdesk_records for delete to authenticated
using(public.nightdesk_is_member(store_id));
create policy "admins read backups" on public.nightdesk_backups for select to authenticated
using(public.nightdesk_is_admin(store_id));

-- The store creator is the initial administrator; anonymous users cannot create stores.
create or replace function public.nightdesk_create_store(p_name text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_store uuid;
begin
  if (select auth.uid()) is null then raise exception 'ログインしてください'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 100 then
    raise exception '店舗名を入力してください';
  end if;
  insert into public.nightdesk_stores(name,created_by)
  values(trim(p_name),(select auth.uid())) returning id into v_store;
  insert into public.nightdesk_memberships(store_id,user_id,role)
  values(v_store,(select auth.uid()),'admin');
  return v_store;
end;
$$;
revoke all on function public.nightdesk_create_store(text) from public;
grant execute on function public.nightdesk_create_store(text) to authenticated;

-- Staff signs up first; an admin grants access by email. No anonymous listing of staff.
create or replace function public.nightdesk_grant_access(
  p_store_id uuid,p_email text,p_role text default 'staff'
)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid;
begin
  if not public.nightdesk_is_admin(p_store_id) then raise exception '管理者権限が必要です'; end if;
  if p_role not in ('admin','staff') then raise exception '権限の指定が不正です'; end if;
  select id into v_user_id from auth.users
  where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null
  limit 1;
  if v_user_id is null then return false; end if;
  insert into public.nightdesk_memberships(store_id,user_id,role)
  values(p_store_id,v_user_id,p_role)
  on conflict(store_id,user_id) do update set role=excluded.role;
  return true;
end;
$$;
revoke all on function public.nightdesk_grant_access(uuid,text,text) from public;
grant execute on function public.nightdesk_grant_access(uuid,text,text) to authenticated;

create or replace function public.nightdesk_team(p_store_id uuid)
returns table(user_id uuid,email text,role text)
language plpgsql security definer set search_path=''
as $$
begin
  if not public.nightdesk_is_admin(p_store_id) then raise exception '管理者権限が必要です'; end if;
  return query
  select m.user_id,u.email::text,m.role
  from public.nightdesk_memberships m join auth.users u on u.id=m.user_id
  where m.store_id=p_store_id order by m.created_at;
end;
$$;
revoke all on function public.nightdesk_team(uuid) from public;
grant execute on function public.nightdesk_team(uuid) to authenticated;

create or replace function public.nightdesk_remove_member(p_store_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not public.nightdesk_is_admin(p_store_id) then raise exception '管理者権限が必要です'; end if;
  if p_user_id=(select auth.uid()) then raise exception '自分自身の権限はここから削除できません'; end if;
  delete from public.nightdesk_memberships
  where store_id=p_store_id and user_id=p_user_id;
end;
$$;
revoke all on function public.nightdesk_remove_member(uuid,uuid) from public;
grant execute on function public.nightdesk_remove_member(uuid,uuid) to authenticated;

-- Daily snapshots stored server-side. Only the service role may run the global job.
create or replace function public.nightdesk_daily_backup()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_total integer;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'サーバー専用の処理です';
  end if;
  insert into public.nightdesk_backups(store_id,backup_date,records)
  select s.id,(now() at time zone 'Asia/Tokyo')::date,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'bucket',r.bucket,'item_id',r.item_id,'payload',r.payload
      ) order by r.bucket,r.item_id)
      from public.nightdesk_records r where r.store_id=s.id
    ),'[]'::jsonb)
  from public.nightdesk_stores s
  on conflict(store_id,backup_date) do update set
    records=excluded.records,created_at=now();
  get diagnostics v_total=row_count;
  delete from public.nightdesk_backups
  where backup_date < (now() at time zone 'Asia/Tokyo')::date-30;
  return v_total;
end;
$$;
revoke all on function public.nightdesk_daily_backup() from public,anon,authenticated;
grant execute on function public.nightdesk_daily_backup() to service_role;

-- Restoring replaces all data for exactly ONE authorized store in a transaction.
create or replace function public.nightdesk_restore_backup(p_store_id uuid,p_date date)
returns void language plpgsql security definer set search_path=''
as $$
declare v_records jsonb;
begin
  if not public.nightdesk_is_admin(p_store_id) then raise exception '管理者権限が必要です'; end if;
  select records into v_records from public.nightdesk_backups
  where store_id=p_store_id and backup_date=p_date;
  if v_records is null then raise exception '指定日のバックアップがありません'; end if;

  -- Save pre-restore state independently; never overwrite the target backup.
  insert into public.nightdesk_backups(store_id,backup_date,records)
  select p_store_id,(now() at time zone 'Asia/Tokyo')::date,
    coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'item_id',item_id,'payload',payload)),'[]'::jsonb)
  from public.nightdesk_records where store_id=p_store_id
  on conflict(store_id,backup_date) do nothing;

  delete from public.nightdesk_records where store_id=p_store_id;
  insert into public.nightdesk_records(store_id,bucket,item_id,payload,updated_by)
  select p_store_id,row->>'bucket',row->>'item_id',row->'payload',(select auth.uid())
  from jsonb_array_elements(v_records) row;
end;
$$;
revoke all on function public.nightdesk_restore_backup(uuid,date) from public;
grant execute on function public.nightdesk_restore_backup(uuid,date) to authenticated;

-- Enable realtime only once.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='nightdesk_records')
  then
    alter publication supabase_realtime add table public.nightdesk_records;
  end if;
end$$;
