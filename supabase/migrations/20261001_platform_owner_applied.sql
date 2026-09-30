-- One platform owner only. This privilege is NOT assignable by the application.
-- Owner assignment is an explicit one-time database administrator operation
-- AFTER the intended user has confirmed their account email.
create table if not exists public.nightdesk_platform_owner(
  singleton boolean primary key default true check (singleton = true),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now()
);
alter table public.nightdesk_platform_owner enable row level security;
-- No table RLS policies: nobody can select/change its contents via client APIs.
revoke all on public.nightdesk_platform_owner from public,anon,authenticated;

create or replace function public.nightdesk_is_owner()
returns boolean
language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.nightdesk_platform_owner o
      where o.user_id=(select auth.uid())
    );
$$;
revoke all on function public.nightdesk_is_owner() from public,anon;
grant execute on function public.nightdesk_is_owner() to authenticated;

-- Owner can access every store without needing a membership in each one.
create or replace function public.nightdesk_is_member(p_store_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select public.nightdesk_is_owner()
    or exists(
      select 1 from public.nightdesk_memberships m
      where m.store_id=p_store_id and m.user_id=(select auth.uid())
    );
$$;

create or replace function public.nightdesk_is_admin(p_store_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select public.nightdesk_is_owner()
    or exists(
      select 1 from public.nightdesk_memberships m
      where m.store_id=p_store_id
        and m.user_id=(select auth.uid())
        and m.role='admin'
    );
$$;

create or replace function public.nightdesk_can_write(p_store_id uuid,p_bucket text)
returns boolean language sql stable security definer set search_path=''
as $$
  select public.nightdesk_is_owner()
    or exists(
      select 1 from public.nightdesk_memberships m
      where m.store_id=p_store_id and m.user_id=(select auth.uid())
        and (
          m.role='admin'
          or (
            m.role='staff'
            and p_bucket in (
              'orders','casts','drivers','hotels','options','customers',
              'settlement','settlement_daily','shared_memo','audit_logs'
            )
          )
        )
    );
$$;

-- Store provisioning belongs to the platform owner only.
create or replace function public.nightdesk_create_store(p_name text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_store uuid;
begin
  if not public.nightdesk_is_owner() then
    raise exception 'システムオーナー権限が必要です';
  end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 100 then
    raise exception '店舗名を入力してください';
  end if;
  insert into public.nightdesk_stores(name,created_by)
  values(trim(p_name),(select auth.uid()))
  returning id into v_store;
  insert into public.nightdesk_memberships(store_id,user_id,role)
  values(v_store,(select auth.uid()),'admin');
  return v_store;
end;
$$;

revoke all on function public.nightdesk_is_member(uuid) from public,anon;
revoke all on function public.nightdesk_is_admin(uuid) from public,anon;
revoke all on function public.nightdesk_can_write(uuid,text) from public,anon;
revoke all on function public.nightdesk_create_store(text) from public,anon;
grant execute on function public.nightdesk_is_member(uuid) to authenticated;
grant execute on function public.nightdesk_is_admin(uuid) to authenticated;
grant execute on function public.nightdesk_can_write(uuid,text) to authenticated;
grant execute on function public.nightdesk_create_store(text) to authenticated;