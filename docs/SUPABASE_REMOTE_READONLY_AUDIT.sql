-- READ ONLY. Prepared locally; not executed against the remote project.
begin transaction read only;
select current_database(), current_setting('server_version') as server_version;
select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename;
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public' order by table_name,ordinal_position;
select c.relname as table_name,k.conname,k.contype,pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' order by c.relname,k.conname;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname;
select c.relname as table_name,t.tgname,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname;
select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.prosecdef as security_definer,
has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
has_function_privilege('service_role',p.oid,'EXECUTE') as backend_execute,
md5(pg_get_functiondef(p.oid)) as definition_md5
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('management_snapshot','management_mutate','management_save_booking','management_import_archive','repository_catalogue','repository_booking_status','availability','create_booking','attach_checkout','process_payment_event','admin_mutate','assert_admin','service_eligible','expire_holds')
order by p.proname,arguments;
select to_regclass('supabase_migrations.schema_migrations') as migration_history_table;
select count(*) as administrator_count from public.admin_users;
-- No Auth users, customer names, bookings, tokens, keys or private settings are selected.
rollback;
-- If migration_history_table exists, inspect separately, still READ ONLY:
-- select version,name from supabase_migrations.schema_migrations order by version;
