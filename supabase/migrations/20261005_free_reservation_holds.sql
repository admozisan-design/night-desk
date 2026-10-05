-- Add a store-scoped bucket for temporarily holding unassigned free reservations.
alter table public.nightdesk_records drop constraint if exists nightdesk_records_bucket_check;
alter table public.nightdesk_records add constraint nightdesk_records_bucket_check check (
  bucket = any (array[
    'orders','casts','drivers','hotels','staff','options','customers',
    'pricing','store_settings','permissions','settlement','settlement_daily',
    'shared_memo','navigation','dispatch_widgets','audit_logs','expenses',
    'free_reservation_holds'
  ]::text[])
);

create or replace function public.nightdesk_can_write(p_store_id uuid,p_bucket text)
returns boolean
language sql
stable
security definer
set search_path=''
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
                'settlement','settlement_daily','shared_memo','audit_logs',
                'free_reservation_holds'
              )
            )
          )
      )
    );
$$;
