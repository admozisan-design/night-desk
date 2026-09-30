-- NIGHT DESK: one-store isolation must apply even outside the UI.
-- RLS protects rows, but it does NOT protect TRUNCATE or REFERENCES.
-- Explicitly remove inherited/default broad table grants from browser roles.
-- All authorization still runs through store-scoped RLS and guarded RPCs.
revoke all privileges on table
  public.nightdesk_stores,
  public.nightdesk_memberships,
  public.nightdesk_records,
  public.nightdesk_backups,
  public.nightdesk_restore_safety,
  public.nightdesk_platform_owner,
  public.nightdesk_store_changes
from public, anon, authenticated;

-- Employees may discover only the store and membership rows allowed by RLS.
grant select on table
  public.nightdesk_stores,
  public.nightdesk_memberships,
  public.nightdesk_backups,
  public.nightdesk_restore_safety,
  public.nightdesk_store_changes
to authenticated;

-- All operational writes remain subject to store_id AND bucket checks in RLS.
grant select, insert, update, delete
on table public.nightdesk_records to authenticated;

-- Intentionally grant nothing to anon. Platform owner identity has no direct
-- browser-accessible SELECT; security-definer helpers verify auth.uid().
-- service_role's independently granted permissions remain unchanged.