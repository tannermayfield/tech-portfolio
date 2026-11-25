-- Course/project name normalization and stable sprint ids. Apply after 202611090001_username_login.sql.
begin;

-- Trim and collapse internal whitespace. Course matching is case-insensitive on this normalized form.
create function public.stv_normalize_name(raw text) returns text language sql immutable parallel safe set search_path='' as $$
 select btrim(regexp_replace(raw,'\s+',' ','g'))
$$;
revoke all on function public.stv_normalize_name(text) from public,anon;
grant execute on function public.stv_normalize_name(text) to authenticated,service_role;

-- Merge existing course duplicates before adding the case-insensitive unique index.
lock table public.stv_courses, public.stv_tasks in share row exclusive mode;
-- Whitespace-only course names normalize to '' and cannot be kept; detach their tasks (payload->>'course' is unchanged).
update public.stv_tasks t set course_id=null from public.stv_courses c
 where t.user_id=c.user_id and t.course_id=c.id and public.stv_normalize_name(c.name)='';
delete from public.stv_courses where public.stv_normalize_name(name)='';
-- Keep the oldest row per (owner, normalized lower-case name) and repoint tasks to it.
create temporary table stv_course_merge on commit drop as
 select id, user_id, first_value(id) over (partition by user_id, lower(public.stv_normalize_name(name)) order by created_at, id) as keep_id
 from public.stv_courses;
update public.stv_tasks t set course_id=m.keep_id from stv_course_merge m
 where t.user_id=m.user_id and t.course_id=m.id and m.id<>m.keep_id;
delete from public.stv_courses c using stv_course_merge m where c.id=m.id and m.id<>m.keep_id;
update public.stv_courses set name=public.stv_normalize_name(name) where name<>public.stv_normalize_name(name);
create unique index stv_courses_user_name_key on public.stv_courses(user_id,(lower(public.stv_normalize_name(name))));

create or replace function public.sessiontv_write(collection_name text,document_id text,document_value jsonb,write_mode text default 'set') returns void
language plpgsql security invoker set search_path=public as $$
declare t text; v jsonb; cid uuid; pid uuid; sid uuid; tid uuid; thread_id uuid; entry record; turn record; sp jsonb; item jsonb; ord integer; n text; src text; kept uuid[];
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if document_id !~ '^[A-Za-z0-9_-]+$' or length(document_id)>250 then raise exception 'Invalid document identifier';end if;
 if collection_name not in ('tasks','projects','sessions','state','settings') or write_mode not in ('set','update','delete') then raise exception 'Invalid write';end if;
 t=case collection_name when 'state' then 'stv_workspace_state' else 'stv_'||collection_name end;
 -- Serialize writes for this owner so nested relational extraction remains coherent.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if write_mode='delete' then
  execute format('delete from public.%I where user_id=$1 and legacy_id=$2',t) using auth.uid(),document_id;
  if collection_name in ('sessions','state') then delete from public.stv_conversations where user_id=auth.uid() and source=collection_name||'/'||document_id;end if;
  return;
 end if;
 if document_value is null or jsonb_typeof(document_value)<>'object' then raise exception 'Document must be an object';end if;
 v=document_value;
 if write_mode='update' then
  execute format('select payload from public.%I where user_id=$1 and legacy_id=$2 for update',t) into v using auth.uid(),document_id;
  if v is null then raise exception 'Item no longer exists';end if;v=v||document_value;
 end if;
 if collection_name='projects' then
  insert into public.stv_projects(user_id,legacy_id,name,payload) values(auth.uid(),document_id,coalesce(nullif(v->>'name',''),document_id),v)
  on conflict(user_id,legacy_id) do update set name=excluded.name,payload=excluded.payload returning id into pid;
 elsif collection_name='tasks' then
  -- The payload keeps the text as typed; relational rows use the normalized name.
  n=nullif(public.stv_normalize_name(v->>'course'),'');
  if n is not null and v->>'track'='class' then
   select id into cid from public.stv_courses where user_id=auth.uid() and lower(public.stv_normalize_name(name))=lower(n);
   if cid is null then
    insert into public.stv_courses(user_id,name) values(auth.uid(),n)
    on conflict(user_id,(lower(public.stv_normalize_name(name)))) do update set name=public.stv_courses.name returning id into cid;
   end if;
  elsif n is not null and coalesce(v->>'track','') not in ('class','practice','develop') then
   select id into pid from public.stv_projects where user_id=auth.uid() and lower(public.stv_normalize_name(name))=lower(n) order by created_at,id limit 1;
   if pid is null then
    insert into public.stv_projects(user_id,legacy_id,name,payload) values(auth.uid(),coalesce(nullif(trim(both '-' from regexp_replace(lower(n),'[^a-z0-9]+','-','g')),''),'project'),n,jsonb_build_object('name',n))
    on conflict(user_id,legacy_id) do update set name=public.stv_projects.name returning id into pid;
   end if;
  end if;
  insert into public.stv_tasks(user_id,legacy_id,course_id,project_id,payload) values(auth.uid(),document_id,cid,pid,v)
  on conflict(user_id,legacy_id) do update set course_id=excluded.course_id,project_id=excluded.project_id,payload=excluded.payload;
 else
  execute format('insert into public.%I(user_id,legacy_id,payload) values($1,$2,$3) on conflict(user_id,legacy_id) do update set payload=excluded.payload',t) using auth.uid(),document_id,v;
 end if;
 if collection_name='projects' then
  -- Sync sprints in place by ordinal and memberships by task so unchanged rows keep their ids.
  ord=0;
  for sp in select value from jsonb_array_elements(coalesce(v->'past','[]'::jsonb)||case when v ? 'sprint' and v->'sprint'<>'null'::jsonb then jsonb_build_array(v->'sprint') else '[]'::jsonb end) loop
   select id into sid from public.stv_sprints where user_id=auth.uid() and project_id=pid and ordinal=ord;
   if sid is null then
    insert into public.stv_sprints(user_id,project_id,ordinal,payload) values(auth.uid(),pid,ord,sp) returning id into sid;
   else
    update public.stv_sprints set payload=sp where id=sid and payload is distinct from sp;
   end if;
   kept='{}';
   for item in select value from jsonb_array_elements(coalesce(sp->'items','[]'::jsonb)) loop
    n=case when jsonb_typeof(item)='string' then item#>>'{}' else item->>'id' end;
    select id into tid from public.stv_tasks where user_id=auth.uid() and legacy_id=n;
    -- Historical/deleted task references remain lossless in sprint payload. The first entry for a task wins.
    if tid is not null and not tid=any(kept) then
     kept=kept||tid;
     insert into public.stv_sprint_tasks(user_id,sprint_id,task_id,payload) values(auth.uid(),sid,tid,item)
     on conflict(user_id,sprint_id,task_id) do update set payload=excluded.payload where public.stv_sprint_tasks.payload is distinct from excluded.payload;
    end if;
   end loop;
   delete from public.stv_sprint_tasks where user_id=auth.uid() and sprint_id=sid and not task_id=any(kept);
   ord=ord+1;
  end loop;
  delete from public.stv_sprints where user_id=auth.uid() and project_id=pid and ordinal>=ord;
 end if;
 if collection_name in ('sessions','state') then
  src=collection_name||'/'||document_id;
  delete from public.stv_conversations where user_id=auth.uid() and source=src;
  for entry in select * from jsonb_each(coalesce(v->'skillChats','{}'::jsonb)) loop
   insert into public.stv_conversations(user_id,source,task_legacy_id,title) values(auth.uid(),src,entry.key,coalesce(entry.value->>'title','')) returning id into thread_id;
   for turn in select value,ordinality from jsonb_array_elements(coalesce(entry.value->'turns','[]'::jsonb)) with ordinality loop
    insert into public.stv_messages(user_id,conversation_id,position,role,content) values(auth.uid(),thread_id,turn.ordinality-1,coalesce(turn.value->>'role','user'),coalesce(turn.value->>'content',''));
   end loop;
  end loop;
 end if;
end $$;
revoke all on function public.sessiontv_write(text,text,jsonb,text) from public,anon;
grant execute on function public.sessiontv_write(text,text,jsonb,text) to authenticated;

-- Same as supabase/class-management.sql except the course upsert, which must target the new
-- case-insensitive index (an exact-name arbiter would raise unique_violation for case-only renames).
create or replace function public.sessiontv_manage_class(old_course text,new_course text default null,delete_class boolean default false,class_value jsonb default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare owner uuid=auth.uid(); classes jsonb; mapping jsonb; excluded jsonb; target text=coalesce(new_course,old_course); course_value jsonb; canvas_id text; item record; cid uuid; affected integer;
begin
 if owner is null then raise exception 'Authentication required';end if;
 if old_course is null or length(trim(old_course))=0 or length(old_course)>500 or target is null or length(trim(target))=0 or length(target)>500 or delete_class is null then raise exception 'Invalid class';end if;
 if class_value is not null and (jsonb_typeof(class_value)<>'object' or length(class_value::text)>20000) then raise exception 'Invalid class metadata';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,0));
 select coalesce(value::jsonb,'{}') into classes from public.stv_preferences where user_id=owner and key='sb.classes';classes=coalesce(classes,'{}');
 select coalesce(value::jsonb,'{}') into mapping from public.stv_preferences where user_id=owner and key='sb.canvasCourses';mapping=coalesce(mapping,'{}');
 select coalesce(value::jsonb,'[]') into excluded from public.stv_preferences where user_id=owner and key='sb.canvasExcludedCourses';excluded=coalesce(excluded,'[]');
 if not delete_class and target<>old_course and classes ? target then raise exception 'A class already uses that code and name';end if;
 course_value=coalesce(class_value,classes->old_course,'{}');canvas_id=coalesce(course_value->>'canvasId',classes->old_course->>'canvasId');
 if delete_class then
  for item in select key from jsonb_each_text(mapping) where value=old_course loop
   if not excluded @> jsonb_build_array(item.key) then excluded=excluded||jsonb_build_array(item.key);end if;mapping=mapping-item.key;
  end loop;
  if canvas_id is not null and not excluded @> jsonb_build_array(canvas_id) then excluded=excluded||jsonb_build_array(canvas_id);end if;
  delete from public.stv_tasks where user_id=owner and kind='assignment' and payload->>'course'=old_course;get diagnostics affected=row_count;
  classes=classes-old_course;
 else
  insert into public.stv_courses(user_id,name) values(owner,public.stv_normalize_name(target))
  on conflict(user_id,(lower(public.stv_normalize_name(name)))) do update set name=excluded.name returning id into cid;
  update public.stv_tasks set payload=jsonb_set(payload,'{course}',to_jsonb(target)),course_id=cid where user_id=owner and kind='assignment' and payload->>'course'=old_course;get diagnostics affected=row_count;
  classes=(classes-old_course)||jsonb_build_object(target,course_value);
  for item in select key from jsonb_each_text(mapping) where value=old_course loop mapping=jsonb_set(mapping,array[item.key],to_jsonb(target));end loop;
  if canvas_id is not null then mapping=jsonb_set(mapping,array[canvas_id],to_jsonb(target));end if;
 end if;
 perform public.sessiontv_preference('sb.classes',classes::text);
 perform public.sessiontv_preference('sb.canvasCourses',mapping::text);
 perform public.sessiontv_preference('sb.canvasExcludedCourses',excluded::text);
 return jsonb_build_object('affected',affected,'deleted',delete_class,'course',target);
end $$;
revoke all on function public.sessiontv_manage_class(text,text,boolean,jsonb) from public,anon;
grant execute on function public.sessiontv_manage_class(text,text,boolean,jsonb) to authenticated;
commit;
