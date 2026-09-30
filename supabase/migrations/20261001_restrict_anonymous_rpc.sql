-- Supabase grants EXECUTE on new routines to anon by default.
-- Remove it explicitly for every SECURITY DEFINER routine.
revoke execute on function public.nightdesk_is_member(uuid) from anon;
revoke execute on function public.nightdesk_is_admin(uuid) from anon;
revoke execute on function public.nightdesk_can_write(uuid,text) from anon;
revoke execute on function public.nightdesk_create_store(text) from anon;
revoke execute on function public.nightdesk_grant_access(uuid,text,text) from anon;
revoke execute on function public.nightdesk_team(uuid) from anon;
revoke execute on function public.nightdesk_remove_member(uuid,uuid) from anon;
revoke execute on function public.nightdesk_restore_backup(uuid,date) from anon;
revoke execute on function public.nightdesk_restore_safety(uuid,uuid) from anon;

-- Restrict future helper functions to authenticated sessions by default.
-- Functions needed by clients still receive explicit GRANT EXECUTE.
alter default privileges in schema public
revoke execute on functions from public,anon;
