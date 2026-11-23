-- Atomic owner-scoped class changes: one transaction, no Canvas API writes.
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
  insert into public.stv_courses(user_id,name) values(owner,target) on conflict(user_id,name) do nothing;
  select id into cid from public.stv_courses where user_id=owner and name=target;
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
