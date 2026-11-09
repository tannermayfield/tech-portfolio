-- Run against a LOCAL Supabase test database after the migration: psql ... -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
-- Creates no durable fixtures; transaction rolls back.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select public.sessiontv_write('tasks','legacy-task','{"track":"class","title":"Owner one private","course":"CS 101"}','set');
select public.sessiontv_write('tasks','project-task','{"track":"project","title":"Build a screen","course":"Sample Project"}','set');
select public.sessiontv_write('projects','sample-project','{"name":"Sample Project","sprint":{"num":1,"items":[{"id":"project-task","pts":3}]}}','set');
select public.sessiontv_write('sessions','study-session','{"date":"2026-11-08","skillChats":{"legacy-task":{"title":"Concept review","turns":[{"role":"user","content":"Explain loops"},{"role":"assistant","content":"A loop repeats steps."}]}}}','set');
select public.sessiontv_import('{"sessiontv.database.v1":"{\"tasks\":{\"imported\":{\"title\":\"Imported\"}}}","sb.ws.imported":"SELECT 1"}');
do $$declare result jsonb;begin
 result=public.sessiontv_import('{"sessiontv.database.v1":"{\"tasks\":{\"imported\":{\"title\":\"Imported\"}}}","sb.ws.imported":"SELECT 1"}');
 if not (result->>'alreadyImported')::boolean then raise exception 'Duplicate import failed';end if;
 if (select count(*) from public.stv_tasks)<>3 then raise exception 'Owner data missing';end if;
 if (select count(*) from public.stv_sprint_tasks)<>1 then raise exception 'Sprint relationship missing';end if;
 if (select count(*) from public.stv_messages)<>2 then raise exception 'Conversation extraction missing';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.stv_tasks) then raise exception 'RLS leaked another owner records';end if;
 if exists(select 1 from public.stv_messages) then raise exception 'RLS leaked conversations';end if;
 begin
  insert into public.stv_tasks(user_id,legacy_id,payload) values('11111111-1111-4111-8111-111111111111','stolen','{}');
  raise exception 'RLS allowed forged ownership';
 exception when insufficient_privilege then null;end;
end $$;
select public.sessiontv_write('tasks','second','{"title":"Owner two"}','set');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$begin
 if (select count(*) from public.stv_tasks)<>3 then raise exception 'Cross-owner isolation failed';end if;
 begin
  perform public.sessiontv_import('{"sessiontv.database.v1":"{\"tasks\":{\"imported\":{\"title\":\"Conflict\"}}}"}');
  raise exception 'Conflicting import should fail';
 exception when others then if sqlerrm not like 'Import conflict%' then raise;end if;end;
 if (select payload->>'title' from public.stv_tasks where legacy_id='imported')<>'Imported' then raise exception 'Conflict overwrote data';end if;
 begin
  perform public.sessiontv_import('{"sessiontv.database.v1":null}');raise exception 'Invalid import should fail';
 exception when others then if sqlerrm<>'Invalid backup' then raise;end if;end;
end $$;
set local role anon;
do $$begin
 begin perform public.sessiontv_snapshot();raise exception 'Anonymous RPC allowed';exception when insufficient_privilege then null;end;
end $$;
rollback;
