-- Username aliases never expose account email addresses to anonymous browsers.
begin;
create schema if not exists private;
create table private.stv_usernames (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username=lower(username) and username ~ '^[a-z0-9][a-z0-9_.-]{2,31}$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table private.stv_usernames enable row level security;
revoke all on private.stv_usernames from public,anon,authenticated;
create table private.stv_password_attempts (
 key text primary key check(key ~ '^[0-9a-f]{64}$'),
 window_start timestamptz not null default now(), attempts integer not null default 1 check(attempts>0)
);
alter table private.stv_password_attempts enable row level security;
revoke all on private.stv_password_attempts from public,anon,authenticated;
create index on private.stv_password_attempts(window_start);

create function public.sessiontv_get_username() returns text language sql stable security definer set search_path='' as $$
 select username from private.stv_usernames where user_id=auth.uid()
$$;
create function public.sessiontv_set_username(new_username text) returns text language plpgsql security definer set search_path='' as $$
declare normalized text=lower(trim(new_username));begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if normalized is null or normalized !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' then raise exception 'Use 3-32 letters, numbers, dots, underscores or hyphens, starting with a letter or number';end if;
 insert into private.stv_usernames(user_id,username) values(auth.uid(),normalized)
 on conflict(user_id) do update set username=excluded.username,updated_at=now();
 return normalized;
 exception when unique_violation then raise exception 'That username is unavailable';
end $$;
-- These two RPCs are only callable by the server-side Edge Function.
create function public.sessiontv_lookup_login_email(login_username text) returns text language sql stable security definer set search_path='' as $$
 select u.email from auth.users u join private.stv_usernames n on n.user_id=u.id where n.username=lower(trim(login_username))
$$;
create function public.sessiontv_allow_password_attempt(username_key text,ip_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare k text; n integer; allowed boolean=true;begin
 if username_key is null or ip_key is null or username_key !~ '^[0-9a-f]{64}$' or ip_key !~ '^[0-9a-f]{64}$' then raise exception 'Invalid rate-limit key';end if;
 delete from private.stv_password_attempts where window_start<now()-interval '1 day';
 for k in select distinct v from unnest(array[username_key,ip_key]) as x(v) order by v loop
  insert into private.stv_password_attempts as a(key) values(k)
  on conflict(key) do update set
   attempts=case when a.window_start<now()-interval '10 minutes' then 1 else a.attempts+1 end,
   window_start=case when a.window_start<now()-interval '10 minutes' then now() else a.window_start end
  returning attempts into n;
  if n>(case when k=username_key then 10 else 30 end) then allowed=false;end if;
 end loop;
 return allowed;
end $$;
revoke all on function public.sessiontv_get_username(), public.sessiontv_set_username(text), public.sessiontv_lookup_login_email(text), public.sessiontv_allow_password_attempt(text,text) from public,anon,authenticated;
grant execute on function public.sessiontv_get_username(), public.sessiontv_set_username(text) to authenticated;
grant execute on function public.sessiontv_lookup_login_email(text), public.sessiontv_allow_password_attempt(text,text) to service_role;
commit;
