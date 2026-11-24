-- Run after all migrations: psql ... -v ON_ERROR_STOP=1 -f supabase/tests/write_fixes.sql
-- Course/project name normalization and stable sprint ids. Creates no durable fixtures; transaction rolls back.
begin;
insert into auth.users(id) values ('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
-- Case/whitespace variants of one course map to one row.
select public.sessiontv_write('tasks','a1','{"track":"class","title":"One","course":"IS 402"}','set');
select public.sessiontv_write('tasks','a2','{"track":"class","title":"Two","course":"IS  402 "}','set');
select public.sessiontv_write('tasks','a3','{"track":"class","title":"Three","course":"is 402"}','set');
select public.sessiontv_write('tasks','a4','{"track":"class","title":"Four","course":"\tIs\n402"}','set');
select public.sessiontv_write('tasks','a5','{"track":"class","title":"Blank","course":"   "}','set');
-- Project tasks reuse a manually created project whose name differs only in case/whitespace.
select public.sessiontv_write('projects','proj-1','{"name":"Sample Project"}','set');
select public.sessiontv_write('tasks','p1','{"track":"project","title":"Build","course":" sample   PROJECT"}','set');
select public.sessiontv_write('tasks','p2','{"track":"project","title":"Ship","course":"Other  Work"}','set');
select public.sessiontv_write('tasks','p3','{"track":"project","title":"Test","course":"other work"}','set');
do $$begin
 if (select count(*) from public.stv_courses)<>1 then raise exception 'Course variants created duplicates';end if;
 if (select name from public.stv_courses)<>'IS 402' then raise exception 'Course name not normalized';end if;
 if (select count(distinct course_id) from public.stv_tasks where legacy_id in ('a1','a2','a3','a4'))<>1
  or exists(select 1 from public.stv_tasks where legacy_id in ('a1','a2','a3','a4') and course_id is null) then raise exception 'Course variants not linked to one course';end if;
 if (select course_id from public.stv_tasks where legacy_id='a5') is not null then raise exception 'Blank course created';end if;
 if (select payload->>'course' from public.stv_tasks where legacy_id='a2')<>'IS  402 ' then raise exception 'Payload course text changed';end if;
 if (select project_id from public.stv_tasks where legacy_id='p1') is distinct from (select id from public.stv_projects where legacy_id='proj-1') then raise exception 'Project variant not matched';end if;
 if (select count(*) from public.stv_projects)<>2 then raise exception 'Project variants created duplicates';end if;
 if (select name from public.stv_projects where legacy_id='other-work')<>'Other Work' then raise exception 'Auto project name not normalized';end if;
 if (select count(distinct project_id) from public.stv_tasks where legacy_id in ('p2','p3'))<>1 then raise exception 'Auto project variants not linked';end if;
 begin
  insert into public.stv_courses(user_id,name) values('33333333-3333-4333-8333-333333333333','is  402');
  raise exception 'Unique course index missing';
 exception when unique_violation then null;end;
end $$;
-- A case-only class rename keeps the same course row.
select public.sessiontv_manage_class('IS 402','is 402');
do $$begin
 if (select count(*) from public.stv_courses)<>1 or (select name from public.stv_courses)<>'is 402' then raise exception 'Case-only class rename failed';end if;
end $$;
-- Another owner may use the same course name.
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
select public.sessiontv_write('tasks','b1','{"track":"class","title":"Other owner","course":"IS 402"}','set');
do $$begin if (select count(*) from public.stv_courses)<>1 then raise exception 'Other owner course missing';end if;end $$;

-- Sprint ids stay stable across project writes; removed items and sprints are deleted.
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
select public.sessiontv_write('projects','proj-1','{"name":"Sample Project","past":[{"num":1,"items":["p1","missing-task"]}],"sprint":{"num":2,"items":[{"id":"p1","pts":3},{"id":"p2","pts":5},{"id":"p2","pts":8}]}}','set');
create temporary table before_sprints as select id,ordinal from public.stv_sprints;
create temporary table before_items as select st.id,s.ordinal,t.legacy_id,st.payload from public.stv_sprint_tasks st join public.stv_sprints s on s.id=st.sprint_id join public.stv_tasks t on t.id=st.task_id;
do $$begin
 if (select count(*) from before_sprints)<>2 then raise exception 'Sprints not extracted';end if;
 if (select count(*) from before_items)<>3 then raise exception 'Sprint items not extracted';end if;
 if (select payload->>'pts' from before_items where ordinal=1 and legacy_id='p2')<>'5' then raise exception 'First duplicate sprint item should win';end if;
end $$;
-- Identical second write: same sprint and membership ids.
select public.sessiontv_write('projects','proj-1','{"name":"Sample Project","past":[{"num":1,"items":["p1","missing-task"]}],"sprint":{"num":2,"items":[{"id":"p1","pts":3},{"id":"p2","pts":5},{"id":"p2","pts":8}]}}','set');
do $$begin
 if exists(select 1 from public.stv_sprints s full join before_sprints b on b.id=s.id where s.id is null or b.id is null or s.ordinal<>b.ordinal) then raise exception 'Sprint ids changed on identical write';end if;
 if exists(select 1 from public.stv_sprint_tasks st full join before_items b on b.id=st.id where st.id is null or b.id is null) then raise exception 'Sprint item ids changed on identical write';end if;
end $$;
-- Current sprint drops p1 and changes p2; the past sprint is unchanged.
select public.sessiontv_write('projects','proj-1','{"sprint":{"num":2,"goal":"Ship","items":[{"id":"p2","pts":13},{"id":"p3","pts":1}]}}','update');
do $$begin
 if exists(select 1 from public.stv_sprints s join before_sprints b on b.ordinal=s.ordinal where s.id<>b.id) or (select count(*) from public.stv_sprints)<>2 then raise exception 'Sprint ids changed on update';end if;
 if (select payload->>'goal' from public.stv_sprints where ordinal=1)<>'Ship' then raise exception 'Sprint payload not updated';end if;
 if exists(select 1 from public.stv_sprint_tasks st join public.stv_sprints s on s.id=st.sprint_id join public.stv_tasks t on t.id=st.task_id where s.ordinal=1 and t.legacy_id='p1') then raise exception 'Removed sprint item not deleted';end if;
 if (select st.id from public.stv_sprint_tasks st join public.stv_sprints s on s.id=st.sprint_id join public.stv_tasks t on t.id=st.task_id where s.ordinal=1 and t.legacy_id='p2')
  is distinct from (select id from before_items where ordinal=1 and legacy_id='p2') then raise exception 'Kept sprint item id changed';end if;
 if (select st.payload->>'pts' from public.stv_sprint_tasks st join public.stv_sprints s on s.id=st.sprint_id join public.stv_tasks t on t.id=st.task_id where s.ordinal=1 and t.legacy_id='p2')<>'13' then raise exception 'Sprint item payload not updated';end if;
 if not exists(select 1 from public.stv_sprint_tasks st join public.stv_sprints s on s.id=st.sprint_id join public.stv_tasks t on t.id=st.task_id where s.ordinal=1 and t.legacy_id='p3') then raise exception 'New sprint item not inserted';end if;
 if (select st.id from public.stv_sprint_tasks st join public.stv_sprints s on s.id=st.sprint_id where s.ordinal=0)
  is distinct from (select id from before_items where ordinal=0) then raise exception 'Unchanged sprint item id changed';end if;
end $$;
-- Removing the current sprint deletes only that ordinal and its memberships.
select public.sessiontv_write('projects','proj-1','{"name":"Sample Project","past":[{"num":1,"items":["p1","missing-task"]}],"sprint":null}','set');
do $$begin
 if (select count(*) from public.stv_sprints)<>1 or (select id from public.stv_sprints) is distinct from (select id from before_sprints where ordinal=0) then raise exception 'Removed sprint not deleted';end if;
 if (select count(*) from public.stv_sprint_tasks)<>1 then raise exception 'Removed sprint items not deleted';end if;
end $$;
rollback;
