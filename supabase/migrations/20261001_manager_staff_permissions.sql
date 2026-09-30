-- NIGHT DESK: Only the platform owner or the current store manager
-- may add/remove staff. Only the platform owner appoints/replaces a manager.
-- RLS exposes membership reads but never direct membership mutations.
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

  -- Serialize appointments, avoiding two managers being appointed at once.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('nightdesk_store_manager'),
    pg_catalog.hashtext(p_store_id::text)
  );

  select u.id into v_user_id from auth.users u
  where lower(u.email)=lower(trim(p_email))
    and u.email_confirmed_at is not null
  limit 1;
  if v_user_id is null then return false; end if;

  -- The owner account is never modifiable through store membership controls.
  if exists(select 1 from public.nightdesk_platform_owner o
            where o.user_id=v_user_id) then
    raise exception 'システムオーナーの権限はこの画面から変更できません';
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
    -- Exactly one non-owner manager per store: old manager stays as staff.
    update public.nightdesk_memberships m set role='staff'
    where m.store_id=p_store_id and m.role='admin'
      and m.user_id<>v_user_id
      and not exists(select 1 from public.nightdesk_platform_owner o
                     where o.user_id=m.user_id);
  end if;

  insert into public.nightdesk_memberships(store_id,user_id,role)
  values(p_store_id,v_user_id,p_role)
  on conflict(store_id,user_id)
  do update set role=excluded.role;
  return true;
end;
$$;
revoke all on function public.nightdesk_grant_access(uuid,text,text) from public,anon;
grant execute on function public.nightdesk_grant_access(uuid,text,text) to authenticated;

create or replace function public.nightdesk_remove_member(
  p_store_id uuid, p_user_id uuid
)
returns void language plpgsql security definer set search_path=''
as $$
declare v_role text;
begin
  if not public.nightdesk_is_admin(p_store_id) then
    raise exception '店長またはシステムオーナーの権限が必要です';
  end if;
  if p_user_id=(select auth.uid()) then
    raise exception '自分自身のアクセスは取り消せません';
  end if;
  if exists(select 1 from public.nightdesk_platform_owner o
            where o.user_id=p_user_id) then
    raise exception 'システムオーナーのアクセスは取り消せません';
  end if;
  select role into v_role from public.nightdesk_memberships
  where store_id=p_store_id and user_id=p_user_id;
  if v_role='admin' and not public.nightdesk_is_owner() then
    raise exception '店長の権限はシステムオーナーのみ変更できます';
  end if;
  delete from public.nightdesk_memberships
  where store_id=p_store_id and user_id=p_user_id;
end;
$$;
revoke all on function public.nightdesk_remove_member(uuid,uuid) from public,anon;
grant execute on function public.nightdesk_remove_member(uuid,uuid) to authenticated;

-- Return the owner as a separate identity only when the owner is viewing.
-- Store managers cannot see/change the platform owner via team controls.
create or replace function public.nightdesk_team(p_store_id uuid)
returns table(user_id uuid,email text,role text)
language plpgsql security definer set search_path=''
as $$
begin
  if not public.nightdesk_is_admin(p_store_id) then
    raise exception '店長またはシステムオーナーの権限が必要です';
  end if;
  return query
    select m.user_id,u.email::text,
      case when o.user_id is not null then 'owner'::text else m.role end
    from public.nightdesk_memberships m
    join auth.users u on u.id=m.user_id
    left join public.nightdesk_platform_owner o on o.user_id=m.user_id
    where m.store_id=p_store_id
      and (o.user_id is null or public.nightdesk_is_owner())
    union all
    select o.user_id,u.email::text,'owner'::text
    from public.nightdesk_platform_owner o
    join auth.users u on u.id=o.user_id
    where public.nightdesk_is_owner()
      and exists(select 1 from public.nightdesk_stores s where s.id=p_store_id)
      and not exists(
        select 1 from public.nightdesk_memberships m
        where m.store_id=p_store_id and m.user_id=o.user_id
      );
end;
$$;
revoke all on function public.nightdesk_team(uuid) from public,anon;
grant execute on function public.nightdesk_team(uuid) to authenticated;