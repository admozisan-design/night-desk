-- Keep expenses in the same RLS-protected per-store record model.
alter table public.nightdesk_records
  drop constraint if exists nightdesk_records_bucket_check;
alter table public.nightdesk_records
  add constraint nightdesk_records_bucket_check check (bucket in (
    'orders','casts','drivers','hotels','staff','options','customers','pricing',
    'store_settings','permissions','settlement','settlement_daily','shared_memo',
    'navigation','dispatch_widgets','audit_logs','expenses'
  ));

-- Normalize midnight against the store's business-day opening hour.
-- Example: a 12:00–05:00 store considers 01:00 to be business minute 1500.
create or replace function public.nightdesk_business_minute(p_time text,p_open int)
returns int language sql immutable set search_path=''
as $$
 select case
  when p_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  then (split_part(p_time,':',1)::int*60+split_part(p_time,':',2)::int)
     +case when split_part(p_time,':',1)::int*60+split_part(p_time,':',2)::int < p_open
       then 1440 else 0 end
  else null end
$$;
revoke all on function public.nightdesk_business_minute(text,int) from public,anon;
grant execute on function public.nightdesk_business_minute(text,int) to authenticated;

-- Transaction lock on (store,cast) ensures two simultaneous clients cannot
-- confirm overlapping reservations. This is a server-side safety net:
-- browser-only warnings do not protect against concurrent reception PCs.
create or replace function public.nightdesk_guard_order_overlaps()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare
 v_order jsonb;
 v_cast text;
 v_date text;
 v_open int:=720;
 v_start int;
 v_end int;
 v_buffer int:=15;
 v_duration int;
 v_conflict boolean;
begin
 if new.bucket<>'orders' then return new; end if;
 v_order:=new.payload->'value';
 if jsonb_typeof(v_order)<>'object' then
   raise exception 'オーダーデータの形式が不正です';
 end if;
 if v_order->>'status'='cancelled' then return new; end if;
 v_cast:=nullif(v_order->>'castId','');
 v_date:=nullif(v_order->>'serviceDate','');
 if v_date is null and nullif(v_order->>'createdAt','') is not null then
   v_date:=((v_order->>'createdAt')::timestamptz at time zone 'Asia/Tokyo')::date::text;
 end if;
 if v_cast is null or v_date is null or
    nullif(v_order->>'scheduledStart','') is null then
   raise exception '予約にはキャスト・営業日・開始時間が必要です';
 end if;
 -- Read the same store's settings with normal RLS (no service key required).
 select coalesce(public.nightdesk_business_minute(r.payload->'value'->>'openTime',0),720),
        greatest(0,least(180,coalesce((r.payload->'value'->>'bookingBufferMinutes')::int,15)))
 into v_open,v_buffer
 from public.nightdesk_records r
 where r.store_id=new.store_id and r.bucket='store_settings' and r.item_id='singleton';
 v_open:=coalesce(v_open,720);
 v_buffer:=coalesce(v_buffer,15);
 v_cast:=nullif(v_order->>'castId','');
 v_date:=coalesce(nullif(v_order->>'serviceDate',''),
  case when nullif(v_order->>'createdAt','') is not null
    then ((v_order->>'createdAt')::timestamptz at time zone 'Asia/Tokyo')::date::text end);
 v_start:=public.nightdesk_business_minute(v_order->>'scheduledStart',v_open);
 v_duration:=coalesce((v_order->>'courseMinutes')::int,0)+
             coalesce((v_order->>'extensionMinutes')::int,0);
 if v_start is null or v_duration<=0 or v_duration>1440 then
   raise exception '開始時刻または予約時間が不正です';
 end if;
 v_end:=v_start+v_duration;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(new.store_id::text||':'||v_cast,0)
 );
 select exists(
  select 1 from public.nightdesk_records other
  where other.store_id=new.store_id and other.bucket='orders'
    and other.item_id<>new.item_id
    and other.payload->'value'->>'status' is distinct from 'cancelled'
    and other.payload->'value'->>'castId'=v_cast
    and coalesce(nullif(other.payload->'value'->>'serviceDate',''),
      case when nullif(other.payload->'value'->>'createdAt','') is not null
        then ((other.payload->'value'->>'createdAt')::timestamptz at time zone 'Asia/Tokyo')::date::text
      end)=v_date
    and public.nightdesk_business_minute(other.payload->'value'->>'scheduledStart',v_open) is not null
    and v_start <
      public.nightdesk_business_minute(other.payload->'value'->>'scheduledStart',v_open)
       +greatest(1,coalesce((other.payload->'value'->>'courseMinutes')::int,0)
        +coalesce((other.payload->'value'->>'extensionMinutes')::int,0))+v_buffer
    and v_end >
      public.nightdesk_business_minute(other.payload->'value'->>'scheduledStart',v_open)-v_buffer
 ) into v_conflict;
 if v_conflict then
   raise exception '同じキャストの予約時間が重複しています。別の空き枠を選んでください'
     using errcode='23505';
 end if;
 return new;
end;
$$;
revoke all on function public.nightdesk_guard_order_overlaps()
from public,anon,authenticated;
drop trigger if exists nightdesk_order_overlap_guard on public.nightdesk_records;
create trigger nightdesk_order_overlap_guard
 before insert or update of payload,store_id,bucket on public.nightdesk_records
 for each row execute function public.nightdesk_guard_order_overlaps();

-- Synchronous reservation RPC: client awaits the atomic check before showing
-- a confirmed reservation; the trigger protects all other database writes.
create or replace function public.nightdesk_reserve_order(
 p_store_id uuid,p_order jsonb,p_position int default 0
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_id text;
begin
 if not public.nightdesk_can_write(p_store_id,'orders') then
   raise exception 'この店舗への予約登録権限がありません';
 end if;
 v_id:=nullif(p_order->>'id','');
 if v_id is null or length(v_id)>256 then
   raise exception '予約IDが不正です';
 end if;
 if exists(select 1 from public.nightdesk_records
     where store_id=p_store_id and bucket='orders' and item_id=v_id) then
   raise exception 'この予約は既に登録されています';
 end if;
 insert into public.nightdesk_records(store_id,bucket,item_id,payload,updated_at,updated_by)
 values(p_store_id,'orders',v_id,
   pg_catalog.jsonb_build_object('value',p_order,'position',p_position),
   now(),(select auth.uid()));
 return v_id;
end;
$$;
revoke all on function public.nightdesk_reserve_order(uuid,jsonb,int)
from public,anon;
grant execute on function public.nightdesk_reserve_order(uuid,jsonb,int) to authenticated;

create or replace function public.nightdesk_update_reservation(
 p_store_id uuid,p_order_id text,p_order jsonb
)
returns text language plpgsql security definer set search_path=''
as $$
begin
 if not public.nightdesk_can_write(p_store_id,'orders') then
   raise exception 'この店舗への予約更新権限がありません';
 end if;
 if p_order->>'id' is distinct from p_order_id then
   raise exception '予約IDは変更できません';
 end if;
 update public.nightdesk_records r
 set payload=pg_catalog.jsonb_set(r.payload,'{value}',p_order),
     updated_at=now(),updated_by=(select auth.uid())
 where r.store_id=p_store_id and r.bucket='orders' and r.item_id=p_order_id;
 if not found then raise exception '編集対象の予約が見つかりません'; end if;
 return p_order_id;
end;
$$;
revoke all on function public.nightdesk_update_reservation(uuid,text,jsonb)
from public,anon;
grant execute on function public.nightdesk_update_reservation(uuid,text,jsonb) to authenticated;
