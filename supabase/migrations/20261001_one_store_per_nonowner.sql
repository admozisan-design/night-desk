-- Enforce exactly one home store for EVERY non-owner account
-- (both managers and ordinary staff). The single platform owner is exempt.
--
-- Existing owner memberships stay intact for compatibility with the initial
-- deployment's store creation and backup/settings screens. Only a SECURITY
-- DEFINER trigger can set the owner-exemption flag.
alter table public.nightdesk_memberships
  add column if not exists owner_exception boolean not null default false;

-- Backfill correctly; non-owner duplicates have been verified absent.
update public.nightdesk_memberships m
set owner_exception=exists(
  select 1 from public.nightdesk_platform_owner o where o.user_id=m.user_id
)
where m.owner_exception is distinct from exists(
  select 1 from public.nightdesk_platform_owner o where o.user_id=m.user_id
);

create or replace function public.nightdesk_set_membership_owner_exception()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  new.owner_exception:=exists(
    select 1 from public.nightdesk_platform_owner o where o.user_id=new.user_id
  );
  return new;
end;
$$;
revoke all on function public.nightdesk_set_membership_owner_exception()
  from public,anon,authenticated;
drop trigger if exists nightdesk_membership_owner_exception
  on public.nightdesk_memberships;
create trigger nightdesk_membership_owner_exception
before insert or update on public.nightdesk_memberships
for each row execute function public.nightdesk_set_membership_owner_exception();

-- The index is atomic even for concurrent admin requests.
create unique index if not exists nightdesk_one_store_per_nonowner
on public.nightdesk_memberships(user_id)
where owner_exception = false;

-- Reject cross-store invitations with a readable error before the unique
-- constraint would reject them. No RPC can grant more than one store.
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

  -- Every non-owner account belongs to exactly one store.
  if exists(
    select 1 from public.nightdesk_memberships m
    where m.user_id=v_user_id and m.store_id<>p_store_id
  ) then
    raise exception 'このアカウントは別店舗に所属しています。別店舗には追加できません。店舗変更は元の店舗の権限を解除してから行ってください';
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


revoke all on function public.nightdesk_grant_access(uuid,text,text)
from public,anon;
grant execute on function public.nightdesk_grant_access(uuid,text,text)
to authenticated;
