\set ON_ERROR_STOP on
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
