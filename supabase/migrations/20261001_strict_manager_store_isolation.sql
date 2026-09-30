-- Prevent a store manager from seeing or editing any other store,
-- even if old extra memberships exist or a different store ID is supplied.
-- Platform owner retains explicit cross-store access.

create or replace function public.nightdesk_is_member(p_store_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select public.nightdesk_is_owner() or (
    (select auth.uid()) is not null
    and exists(
      select 1 from public.nightdesk_memberships m
      where m.user_id=(select auth.uid()) and m.store_id=p_store_id
    )
    and (
      not exists (
        select 1 from public.nightdesk_memberships manager
        where manager.user_id=(select auth.uid()) and manager.role='admin'
      )
      or p_store_id=(
        select manager.store_id
        from public.nightdesk_memberships manager
        where manager.user_id=(select auth.uid()) and manager.role='admin'
        order by manager.created_at,manager.store_id
        limit 1
      )
    )
  );
$$;

create or replace function public.nightdesk_is_admin(p_store_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select public.nightdesk_is_owner()
    or (
      public.nightdesk_is_member(p_store_id)
      and exists(
        select 1 from public.nightdesk_memberships m
        where m.store_id=p_store_id and m.user_id=(select auth.uid())
          and m.role='admin'
      )
    );
$$;

create or replace function public.nightdesk_can_write(p_store_id uuid,p_bucket text)
returns boolean
language sql stable security definer set search_path=''
as $$
  select public.nightdesk_is_owner()
    or (
      public.nightdesk_is_member(p_store_id)
      and exists (
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
      )
    );
$$;

-- Show each employee only memberships to stores they are permitted to see.
-- This also prevents past cross-store memberships appearing in client queries.
drop policy if exists "members read their own membership and admins see team"
  on public.nightdesk_memberships;
create policy "authorized user or manager sees memberships" on public.nightdesk_memberships
for select to authenticated
using(
  (user_id=(select auth.uid()) and public.nightdesk_is_member(store_id))
  or public.nightdesk_is_admin(store_id)
);

-- Prevent new cross-store memberships or appointments for existing managers.
-- The owner must remove conflicting memberships before appointing a manager.
create or replace function public.nightdesk_grant_access(
  p_store_id uuid, p_email text, p_role text default 'staff'
)
returns boolean language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid;
  v_existing_role text;
  v_is_owner boolean;
begin
  v_is_owner := public.nightdesk_is_owner();
  if not public.nightdesk_is_admin(p_store_id) then
    raise exception '店長またはシステムオーナーの権限が必要です';
  end if;
  if p_role not in ('admin','staff') then
    raise exception '権限の指定が不正です';
  end if;
  if p_role='admin' and not v_is_owner then
    raise exception '店長の任命・変更はシステムオーナーのみ行えます';
  end if;
  if not exists(select 1 from public.nightdesk_stores where id=p_store_id) then
    raise exception '店舗が見つかりません';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('nightdesk_store_manager'),
    pg_catalog.hashtext(p_store_id::text)
  );

  select u.id into v_user_id from auth.users u
  where lower(u.email)=lower(trim(p_email))
    and u.email_confirmed_at is not null
  limit 1;
  if v_user_id is null then return false; end if;

  if exists(select 1 from public.nightdesk_platform_owner o
            where o.user_id=v_user_id) then
    raise exception 'システムオーナーの権限はこの画面から変更できません';
  end if;

  -- Strict manager scoping even when the same account is invited elsewhere.
  if exists(
    select 1 from public.nightdesk_memberships m
    where m.user_id=v_user_id and m.role='admin' and m.store_id<>p_store_id
  ) then
    raise exception '他店舗の店長は追加できません。店舗ごとに専用アカウントを使用してください';
  end if;
  if p_role='admin' and exists(
    select 1 from public.nightdesk_memberships m
    where m.user_id=v_user_id and m.store_id<>p_store_id
  ) then
    raise exception '店長候補に他店舗のアクセス権があります。先に解除してください';
  end if;

  select m.role into v_existing_role from public.nightdesk_memberships m
  where m.store_id=p_store_id and m.user_id=v_user_id;

  if not v_is_owner and v_existing_role='admin' then
    raise exception '店長の権限はシステムオーナーのみ変更できます';
  end if;
  if not v_is_owner and v_user_id=(select auth.uid()) then
    raise exception '自分自身の権限は変更できません';
  end if;

  if p_role='admin' then
    update public.nightdesk_memberships m set role='staff'
    where m.store_id=p_store_id and m.role='admin'
      and m.user_id<>v_user_id
      and not exists(
        select 1 from public.nightdesk_platform_owner o where o.user_id=m.user_id
      );
  end if;

  insert into public.nightdesk_memberships(store_id,user_id,role)
  values(p_store_id,v_user_id,p_role)
  on conflict(store_id,user_id) do update set role=excluded.role;
  return true;
end;
$$;

-- Explicitly revoke public RPC execution after replacing SQL functions.
revoke all on function public.nightdesk_is_member(uuid) from public,anon;
revoke all on function public.nightdesk_is_admin(uuid) from public,anon;
revoke all on function public.nightdesk_can_write(uuid,text) from public,anon;
revoke all on function public.nightdesk_grant_access(uuid,text,text) from public,anon;
grant execute on function public.nightdesk_is_member(uuid) to authenticated;
grant execute on function public.nightdesk_is_admin(uuid) to authenticated;
grant execute on function public.nightdesk_can_write(uuid,text) to authenticated;
grant execute on function public.nightdesk_grant_access(uuid,text,text) to authenticated;
