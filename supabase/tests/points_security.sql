\set ON_ERROR_STOP on
\if :run_content
-- Task 1: the forged cases intentionally fail against PR #4.
insert into public.profiles (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'one@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'two@example.test');
insert into public.posts (id, user_id, board_type) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'military_board'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'benefits'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'military_board'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'military_board'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'military_board');
insert into public.feed_posts (id, user_id) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare
  v_result jsonb;
begin
  v_result := public.earn_content_reward('post_reward', null);
  if (v_result->>'earned')::boolean then raise exception 'NULL reference earned points'; end if;
  v_result := public.earn_content_reward('post_reward', '10000000-0000-0000-0000-000000000099');
  if (v_result->>'earned')::boolean then raise exception 'missing post earned points'; end if;
  v_result := public.earn_content_reward('post_reward', '10000000-0000-0000-0000-000000000005');
  if (v_result->>'earned')::boolean then raise exception 'other user post earned points'; end if;
  v_result := public.earn_content_reward('feed_reward', '20000000-0000-0000-0000-000000000005');
  if (v_result->>'earned')::boolean then raise exception 'other user feed earned points'; end if;
  if (select points from public.profiles where id = auth.uid()) <> 0 then
    raise exception 'forged claims changed balance';
  end if;
  if (select count(*) from public.point_transactions) <> 0 then
    raise exception 'forged claims changed ledger';
  end if;
  if (select count(*) from public.daily_point_limits) <> 0 then
    raise exception 'forged claims changed daily limits';
  end if;
end $$;

do $$
declare
  v_result jsonb;
  v_id uuid;
begin
  foreach v_id in array array[
    '10000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid]
  loop
    v_result := public.earn_content_reward('post_reward', v_id);
    if not (v_result->>'earned')::boolean or (v_result->>'points')::integer <> 50 then
      raise exception 'valid post reward failed: %', v_result;
    end if;
  end loop;
  v_result := public.earn_content_reward('post_reward', '10000000-0000-0000-0000-000000000001');
  if (v_result->>'earned')::boolean then raise exception 'duplicate post earned points'; end if;
  v_result := public.earn_content_reward('post_reward', '10000000-0000-0000-0000-000000000004');
  if (v_result->>'earned')::boolean then raise exception 'fourth post earned points'; end if;
  if (select points from public.profiles where id = auth.uid()) <> 150 then
    raise exception 'post balance mismatch';
  end if;
  if (select count(*) from public.point_transactions where type = 'post_reward') <> 3 then
    raise exception 'post ledger mismatch';
  end if;
  if (select count from public.daily_point_limits where user_id = auth.uid() and action_type = 'post_reward') <> 3 then
    raise exception 'post daily limit mismatch';
  end if;
end $$;

do $$
declare
  v_result jsonb;
  v_id uuid;
begin
  foreach v_id in array array[
    '20000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid,
    '20000000-0000-0000-0000-000000000003'::uuid]
  loop
    v_result := public.earn_content_reward('feed_reward', v_id);
    if not (v_result->>'earned')::boolean or (v_result->>'points')::integer <> 30 then
      raise exception 'valid feed reward failed: %', v_result;
    end if;
  end loop;
  v_result := public.earn_content_reward('feed_reward', '20000000-0000-0000-0000-000000000001');
  if (v_result->>'earned')::boolean then raise exception 'duplicate feed earned points'; end if;
  v_result := public.earn_content_reward('feed_reward', '20000000-0000-0000-0000-000000000004');
  if (v_result->>'earned')::boolean then raise exception 'fourth feed earned points'; end if;
  if (select points from public.profiles where id = auth.uid()) <> 240 then
    raise exception 'feed balance mismatch';
  end if;
  if (select count(*) from public.point_transactions where type = 'feed_reward') <> 3 then
    raise exception 'feed ledger mismatch';
  end if;
  if (select count from public.daily_point_limits where user_id = auth.uid() and action_type = 'feed_reward') <> 3 then
    raise exception 'feed daily limit mismatch';
  end if;
end $$;

reset role;

-- Task 3: privilege boundaries, including the PR #4 profile INSERT bypass.
do $$
begin
  if has_function_privilege('untrusted', 'public.earn_content_reward(text, uuid)', 'EXECUTE')
     or has_function_privilege('untrusted', 'public.redeem_invite_code(text)', 'EXECUTE') then
    raise exception 'PUBLIC can execute a reward function';
  end if;
  if has_function_privilege('anon', 'public.earn_content_reward(text, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.redeem_invite_code(text)', 'EXECUTE') then
    raise exception 'anon can execute a reward function';
  end if;
  if exists (
    select 1 from pg_proc where oid in (
      'public.earn_content_reward(text, uuid)'::regprocedure,
      'public.redeem_invite_code(text)'::regprocedure,
      'public.is_admin()'::regprocedure
    ) and not ('search_path=""' = any(proconfig))
  ) then
    raise exception 'security definer function has unsafe search_path';
  end if;
  if has_table_privilege('untrusted', 'public.point_transactions', 'INSERT')
     or has_table_privilege('untrusted', 'public.daily_point_limits', 'INSERT')
     or has_table_privilege('untrusted', 'public.invite_records', 'INSERT') then
    raise exception 'PUBLIC has direct reward table write access';
  end if;
end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
begin
  begin
    insert into public.point_transactions (user_id, amount, type) values (auth.uid(), 999, 'forged');
    raise exception 'direct point ledger insert succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.daily_point_limits (user_id, action_type, action_date, count)
    values (auth.uid(), 'post_reward', current_date, 3);
    raise exception 'direct daily limit insert succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.invite_records (inviter_id, invitee_id)
    values ('00000000-0000-0000-0000-000000000011', auth.uid());
    raise exception 'direct invite record insert succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set points = 9999 where id = auth.uid();
    raise exception 'direct points update succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'direct role update succeeded';
  exception when insufficient_privilege then null; end;
  update public.profiles set display_name = 'allowed edit' where id = auth.uid();
  if (select display_name from public.profiles where id = auth.uid()) <> 'allowed edit' then
    raise exception 'allowed profile update failed';
  end if;
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000099';
do $$
begin
  begin
    insert into public.profiles (id, email, points, role)
    values (auth.uid(), 'forged@example.test', 9999, 'admin');
    raise exception 'protected profile insert succeeded';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'forged profile row was inserted';
  end if;
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000098';
insert into public.profiles (id, email, display_name)
values (auth.uid(), 'safe@example.test', 'safe new user');
insert into public.profiles (id, email, display_name)
values (auth.uid(), 'safe@example.test', 'ignored duplicate')
on conflict (id) do nothing;
update public.profiles set display_name = 'saved onboarding' where id = auth.uid();
do $$
begin
  if (select display_name from public.profiles where id = auth.uid()) <> 'saved onboarding' then
    raise exception 'onboarding insert-ignore-then-update failed';
  end if;
end $$;
reset role;
set role anon;
do $$
begin
  begin
    perform public.earn_content_reward('post_reward', '10000000-0000-0000-0000-000000000001');
    raise exception 'anon reward call unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;
\endif

-- Task 2: normal and rejected invite flows.
insert into public.profiles (id, invite_code) values
  ('00000000-0000-0000-0000-000000000011', 'INVITE11'),
  ('00000000-0000-0000-0000-000000000012', 'INVITE12'),
  ('00000000-0000-0000-0000-000000000013', null);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000013';
do $$
declare v_result jsonb;
begin
  v_result := public.redeem_invite_code('NOPE');
  if v_result->>'reason' <> 'invalid_code' then raise exception 'invalid code was not rejected'; end if;
  v_result := public.redeem_invite_code('invite11');
  if not (v_result->>'ok')::boolean or (v_result->>'points')::integer <> 2000 then
    raise exception 'valid invite reward failed: %', v_result;
  end if;
  v_result := public.redeem_invite_code('INVITE12');
  if v_result->>'reason' <> 'already_redeemed' then raise exception 'repeat invite was not rejected'; end if;
  if (select points from public.profiles where id = auth.uid()) <> 2000
     or (select points from public.profiles where id = '00000000-0000-0000-0000-000000000011') <> 1000
     or (select points from public.profiles where id = '00000000-0000-0000-0000-000000000012') <> 0 then
    raise exception 'invite balances mismatch';
  end if;
  if (select count(*) from public.invite_records where invitee_id = auth.uid()) <> 1
     or (select count(*) from public.point_transactions where user_id = auth.uid() and type = 'signup_bonus') <> 1 then
    raise exception 'invite ledger mismatch';
  end if;
end $$;
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
do $$
begin
  if public.redeem_invite_code('INVITE11')->>'reason' <> 'self_invite' then
    raise exception 'self invite was not rejected';
  end if;
end $$;
reset role;
