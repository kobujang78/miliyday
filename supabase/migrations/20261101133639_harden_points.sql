-- Follow-up to PR #4. Reject preexisting duplicate rewards; never erase live data.
do $$
begin
  if exists (
    select 1 from public.point_transactions
    where reference_id is not null and type in ('post_reward', 'feed_reward')
    group by user_id, type, reference_id having count(*) > 1
  ) then
    raise exception 'duplicate content rewards exist; investigate before applying migration';
  end if;
end $$;

create unique index if not exists point_transactions_content_reward_once
  on public.point_transactions (user_id, type, reference_id)
  where reference_id is not null and type in ('post_reward', 'feed_reward');

create or replace function public.earn_content_reward(
  p_action_type text,
  p_reference_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_amount integer;
  v_limit constant integer := 3;
  v_count integer;
  v_ledger_id uuid;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_amount := case p_action_type
    when 'post_reward' then 50
    when 'feed_reward' then 30
  end;
  if v_amount is null then
    raise exception 'invalid action_type: %', p_action_type using errcode = '22023';
  end if;

  if p_reference_id is null then
    return jsonb_build_object('earned', false, 'points', 0, 'remaining', 0);
  end if;

  if p_action_type = 'post_reward' and not exists (
    select 1 from public.posts where id = p_reference_id and user_id = v_uid
  ) then
    return jsonb_build_object('earned', false, 'points', 0, 'remaining', 0);
  end if;
  if p_action_type = 'feed_reward' and not exists (
    select 1 from public.feed_posts where id = p_reference_id and user_id = v_uid
  ) then
    return jsonb_build_object('earned', false, 'points', 0, 'remaining', 0);
  end if;

  -- Serialize a user's balance operations and refuse rewards for absent profiles.
  perform 1 from public.profiles where id = v_uid for update;
  if not found then
    return jsonb_build_object('earned', false, 'points', 0, 'remaining', 0);
  end if;

  -- The partial unique index remains the final concurrency boundary.
  insert into public.point_transactions (user_id, amount, type, description, reference_id)
  values (v_uid, v_amount, p_action_type,
    case p_action_type when 'post_reward' then '병영꿀팁 작성 보상'
                       else '생활공유 작성 보상' end,
    p_reference_id)
  on conflict (user_id, type, reference_id)
    where reference_id is not null and type in ('post_reward', 'feed_reward')
    do nothing
  returning id into v_ledger_id;
  if v_ledger_id is null then
    return jsonb_build_object('earned', false, 'points', 0, 'remaining', 0);
  end if;

  insert into public.daily_point_limits (user_id, action_type, action_date, count)
  values (v_uid, p_action_type, current_date, 1)
  on conflict (user_id, action_type, action_date)
    do update set count = public.daily_point_limits.count + 1
    where public.daily_point_limits.count < v_limit
  returning count into v_count;

  if v_count is null then
    delete from public.point_transactions where id = v_ledger_id;
    return jsonb_build_object('earned', false, 'points', 0, 'remaining', 0);
  end if;

  update public.profiles set points = points + v_amount where id = v_uid;
  return jsonb_build_object('earned', true, 'points', v_amount,
                            'remaining', v_limit - v_count);
end $$;

revoke execute on function public.earn_content_reward(text, uuid) from public, anon;
grant execute on function public.earn_content_reward(text, uuid) to authenticated;
