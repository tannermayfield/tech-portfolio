-- Apply once to a Supabase project. No service-role key is used by the application.
begin;

create table public.stv_courses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name)>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,name), unique(user_id,id)
);
create table public.stv_projects (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 legacy_id text not null, name text not null, payload jsonb not null default '{}' check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,legacy_id), unique(user_id,id)
);
create table public.stv_tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 legacy_id text not null, course_id uuid, project_id uuid,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 kind text generated always as (case when payload->>'track'='class' then 'assignment' when payload->>'track' in ('develop','practice') then 'skill' else 'project-task' end) stored,
 title text generated always as (payload->>'title') stored,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,legacy_id), unique(user_id,id),
 foreign key(user_id,course_id) references public.stv_courses(user_id,id),
 foreign key(user_id,project_id) references public.stv_projects(user_id,id)
);
create table public.stv_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 legacy_id text not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,legacy_id), unique(user_id,id)
);
create table public.stv_workspace_state (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 legacy_id text not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,legacy_id)
);
create table public.stv_settings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 legacy_id text not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,legacy_id)
);
create table public.stv_preferences (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 key text not null check(key like 'sb.%'), value text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,key)
);
-- Sprint metadata stays lossless in project payload; relational memberships support safe joins.
create table public.stv_sprints (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null, ordinal integer not null, payload jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,project_id,ordinal), unique(user_id,id),
 foreign key(user_id,project_id) references public.stv_projects(user_id,id) on delete cascade
);
create table public.stv_sprint_tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 sprint_id uuid not null, task_id uuid not null, payload jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,sprint_id,task_id),
 foreign key(user_id,sprint_id) references public.stv_sprints(user_id,id) on delete cascade,
 foreign key(user_id,task_id) references public.stv_tasks(user_id,id) on delete cascade
);
create table public.stv_conversations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 source text not null, task_legacy_id text not null, title text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,source,task_legacy_id), unique(user_id,id)
);
create table public.stv_messages (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null, position integer not null check(position>=0), role text not null check(role in ('user','assistant','system','developer','tool')),
 content text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,conversation_id,position),
 foreign key(user_id,conversation_id) references public.stv_conversations(user_id,id) on delete cascade
);
create table public.stv_imports (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 fingerprint text not null, report jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,fingerprint)
);

create function public.stv_touch() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now();return new;end $$;
do $$declare t text;begin
 foreach t in array array['stv_courses','stv_projects','stv_tasks','stv_sessions','stv_workspace_state','stv_settings','stv_preferences','stv_sprints','stv_sprint_tasks','stv_conversations','stv_messages','stv_imports'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy owner_only on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
  execute format('create index on public.%I(user_id)',t);
  execute format('create trigger touch_updated before update on public.%I for each row execute function public.stv_touch()',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
create index on public.stv_tasks(user_id,course_id);
create index on public.stv_tasks(user_id,project_id);
create index on public.stv_tasks(user_id,kind);

create function public.sessiontv_snapshot() returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb='{}'; prefs jsonb; c text; t text; value jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 foreach c in array array['projects','tasks','sessions','state','settings'] loop
  t=case c when 'state' then 'stv_workspace_state' else 'stv_'||c end;
  execute format('select coalesce(jsonb_object_agg(legacy_id,payload),''{}''::jsonb) from public.%I where user_id=$1',t) into value using auth.uid();
  result=result||jsonb_build_object(c,value);
 end loop;
 select coalesce(jsonb_object_agg(p.key,p.value),'{}'::jsonb) into prefs from public.stv_preferences p where p.user_id=auth.uid();
 return jsonb_build_object('database',result,'preferences',prefs);
end $$;

create function public.sessiontv_write(collection_name text,document_id text,document_value jsonb,write_mode text default 'set') returns void
language plpgsql security invoker set search_path=public as $$
declare t text; v jsonb; cid uuid; pid uuid; sid uuid; tid uuid; thread_id uuid; entry record; turn record; sp jsonb; item jsonb; ord integer; n text; src text;
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
  n=nullif(v->>'course','');
  if n is not null and v->>'track'='class' then
   insert into public.stv_courses(user_id,name) values(auth.uid(),n) on conflict(user_id,name) do update set name=excluded.name returning id into cid;
  elsif n is not null and coalesce(v->>'track','') not in ('class','practice','develop') then
   insert into public.stv_projects(user_id,legacy_id,name,payload) values(auth.uid(),coalesce(nullif(trim(both '-' from regexp_replace(lower(n),'[^a-z0-9]+','-','g')),''),'project'),n,jsonb_build_object('name',n))
   on conflict(user_id,legacy_id) do update set name=excluded.name returning id into pid;
  end if;
  insert into public.stv_tasks(user_id,legacy_id,course_id,project_id,payload) values(auth.uid(),document_id,cid,pid,v)
  on conflict(user_id,legacy_id) do update set course_id=excluded.course_id,project_id=excluded.project_id,payload=excluded.payload;
 else
  execute format('insert into public.%I(user_id,legacy_id,payload) values($1,$2,$3) on conflict(user_id,legacy_id) do update set payload=excluded.payload',t) using auth.uid(),document_id,v;
 end if;
 if collection_name='projects' then
  delete from public.stv_sprints where user_id=auth.uid() and project_id=pid;
  ord=0;
  for sp in select value from jsonb_array_elements(coalesce(v->'past','[]'::jsonb)||case when v ? 'sprint' and v->'sprint'<>'null'::jsonb then jsonb_build_array(v->'sprint') else '[]'::jsonb end) loop
   insert into public.stv_sprints(user_id,project_id,ordinal,payload) values(auth.uid(),pid,ord,sp) returning id into sid;ord=ord+1;
   for item in select value from jsonb_array_elements(coalesce(sp->'items','[]'::jsonb)) loop
    n=case when jsonb_typeof(item)='string' then item#>>'{}' else item->>'id' end;
    select id into tid from public.stv_tasks where user_id=auth.uid() and legacy_id=n;
    -- Historical/deleted task references remain lossless in sprint payload.
    if tid is not null then insert into public.stv_sprint_tasks(user_id,sprint_id,task_id,payload) values(auth.uid(),sid,tid,item) on conflict do nothing;end if;
   end loop;
  end loop;
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

create function public.sessiontv_preference(preference_key text,preference_value text) returns void language plpgsql security invoker set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if preference_key not like 'sb.%' then raise exception 'Invalid preference key';end if;
 if preference_value is null then delete from public.stv_preferences where user_id=auth.uid() and key=preference_key;
 else insert into public.stv_preferences(user_id,key,value) values(auth.uid(),preference_key,preference_value) on conflict(user_id,key) do update set value=excluded.value;end if;
end $$;

create function public.sessiontv_import(backup_values jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare fingerprint_value text; existing jsonb; data jsonb; entry record; doc record; c text; snap jsonb; report jsonb; count_docs integer=0;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if jsonb_typeof(backup_values) is distinct from 'object' or not (backup_values ? 'sessiontv.database.v1') or jsonb_typeof(backup_values->'sessiontv.database.v1') is distinct from 'string' then raise exception 'Invalid backup';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 fingerprint_value=encode(sha256(convert_to(backup_values::text,'UTF8')),'hex');
 select i.report into existing from public.stv_imports i where user_id=auth.uid() and fingerprint=fingerprint_value;
 if existing is not null then return existing||'{"alreadyImported":true}'::jsonb;end if;
 data=(backup_values->>'sessiontv.database.v1')::jsonb;
 if jsonb_typeof(data) is distinct from 'object' then raise exception 'Invalid database';end if;
 for entry in select * from jsonb_each(data) loop
  if entry.key not in ('tasks','projects','sessions','state','settings') or jsonb_typeof(entry.value)<>'object' then raise exception 'Invalid collection';end if;
 end loop;
 -- Merge only absent records, never overwrite an existing cloud document.
 snap=public.sessiontv_snapshot();
 foreach c in array array['projects','tasks','sessions','state','settings','projects'] loop
  for doc in select * from jsonb_each(coalesce(data->c,'{}'::jsonb)) loop
   if doc.key !~ '^[A-Za-z0-9_-]+$' or jsonb_typeof(doc.value)<>'object' then raise exception 'Invalid document';end if;
   if (snap->'database'->c) ? doc.key then
    if snap->'database'->c->doc.key <> doc.value then raise exception 'Import conflict at %/%. Export cloud data and resolve before importing.',c,doc.key;end if;
   else
    perform public.sessiontv_write(c,doc.key,doc.value,'set');
    if c<>'projects' then count_docs=count_docs+1;end if;
   end if;
  end loop;
 end loop;
 for entry in select * from jsonb_each(backup_values) loop
  if entry.key='sessiontv.database.v1' then continue;end if;
  if entry.key not like 'sb.%' or jsonb_typeof(entry.value)<>'string' then raise exception 'Invalid backup preference';end if;
  if (snap->'preferences') ? entry.key and snap->'preferences'->entry.key <> entry.value then raise exception 'Import conflict at %',entry.key;end if;
  perform public.sessiontv_preference(entry.key,entry.value#>>'{}');
 end loop;
 snap=public.sessiontv_snapshot();
 for entry in select * from jsonb_each(data) loop
  for doc in select * from jsonb_each(entry.value) loop
   if snap->'database'->entry.key->doc.key is distinct from doc.value then raise exception 'Import verification failed';end if;
  end loop;
 end loop;
 report=jsonb_build_object('verified',true,'alreadyImported',false,'fingerprint',fingerprint_value,'sourceDocuments',(select count(*) from jsonb_each(data) c cross join lateral jsonb_each(c.value) d));
 insert into public.stv_imports(user_id,fingerprint,report) values(auth.uid(),fingerprint_value,report);
 return report;
end $$;

revoke all on function public.sessiontv_snapshot(), public.sessiontv_write(text,text,jsonb,text), public.sessiontv_preference(text,text), public.sessiontv_import(jsonb) from public,anon;
grant execute on function public.sessiontv_snapshot(), public.sessiontv_write(text,text,jsonb,text), public.sessiontv_preference(text,text), public.sessiontv_import(jsonb) to authenticated;
commit;
