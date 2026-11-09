begin;
insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner@example.com'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','other@example.com');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
select public.sessiontv_set_username('Example.User');
do $$begin
 if public.sessiontv_get_username()<>'example.user' then raise exception 'Normalization failed';end if;
 begin perform public.sessiontv_lookup_login_email('example.user');raise exception 'Private email lookup exposed';exception when insufficient_privilege then null;end;
 begin perform 1 from private.stv_usernames;raise exception 'Username table exposed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
do $$begin
 if public.sessiontv_get_username() is not null then raise exception 'Another account username leaked';end if;
 begin perform public.sessiontv_set_username('EXAMPLE.USER');raise exception 'Duplicate username accepted';exception when raise_exception then if sqlerrm<>'That username is unavailable' then raise;end if;end;
end $$;
select public.sessiontv_set_username('second-user');
set local role anon;
do $$begin
 begin perform public.sessiontv_get_username();raise exception 'Anonymous account access allowed';exception when insufficient_privilege then null;end;
 begin perform public.sessiontv_lookup_login_email('example.user');raise exception 'Anonymous email lookup allowed';exception when insufficient_privilege then null;end;
 begin perform public.sessiontv_allow_password_attempt(repeat('a',64),repeat('b',64));raise exception 'Anonymous limiter reset allowed';exception when insufficient_privilege then null;end;
end $$;
set local role service_role;
do $$begin
 if public.sessiontv_lookup_login_email('EXAMPLE.USER')<>'owner@example.com' then raise exception 'Server lookup failed';end if;
 for n in 1..10 loop
  if not public.sessiontv_allow_password_attempt(repeat('a',64),repeat('b',64)) then raise exception 'Attempts blocked early';end if;
 end loop;
 if public.sessiontv_allow_password_attempt(repeat('a',64),repeat('c',64)) then raise exception 'Username limit bypassed with new IP';end if;
 for n in 1..30 loop
  if not public.sessiontv_allow_password_attempt(lpad(n::text,64,'0'),repeat('f',64)) then raise exception 'IP attempts blocked early';end if;
 end loop;
 if public.sessiontv_allow_password_attempt(repeat('d',64),repeat('f',64)) then raise exception 'IP limit bypassed with new username';end if;
end $$;
reset role;
update private.stv_password_attempts set window_start=now()-interval '11 minutes';
set local role service_role;
do $$begin if not public.sessiontv_allow_password_attempt(repeat('a',64),repeat('b',64)) then raise exception 'Limiter window did not reset';end if;end $$;
rollback;
