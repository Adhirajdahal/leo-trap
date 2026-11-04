-- ================= Leo Trap schema (admin + bank enabled) =================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  chips int not null default 1000,
  wins int not null default 0,
  losses int not null default 0,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles public read" on public.profiles for select using (true);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount int not null,
  balance_after int not null,
  type text not null,
  reference_id uuid,
  note text,
  admin_id uuid references public.profiles(id),
  created_at timestamptz default now()
);
create index if not exists tx_user_time on public.transactions(user_id, created_at desc);
alter table public.transactions enable row level security;
create policy "users read own tx" on public.transactions for select using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

create table if not exists public.bank_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount int not null check (amount > 0),
  kind text not null check (kind in ('deposit','withdrawal')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.bank_requests enable row level security;
create policy "users read own bank" on public.bank_requests for select using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete cascade not null,
  stake int not null check (stake > 0),
  creator_side text not null check (creator_side in ('tiger','goat','random')),
  status text not null default 'open' check (status in ('open','matched','cancelled')),
  game_id uuid,
  created_at timestamptz default now()
);
alter table public.challenges enable row level security;
create policy "challenges public read" on public.challenges for select using (true);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges(id),
  tiger_player uuid references public.profiles(id) not null,
  goat_player uuid references public.profiles(id) not null,
  stake int not null,
  state jsonb not null,
  state_version int not null default 0,
  status text not null default 'active' check (status in ('active','finished')),
  winner uuid references public.profiles(id),
  last_move_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table public.games enable row level security;
create policy "players view own games" on public.games for select using (
  auth.uid() = tiger_player or auth.uid() = goat_player
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Central atomic + logged chip mutation
create or replace function public._apply_chip_change(
  p_user_id uuid, p_delta int, p_type text,
  p_reference_id uuid default null, p_note text default null, p_admin_id uuid default null
) returns int language plpgsql security definer as $$
declare new_balance int;
begin
  update profiles set chips = chips + p_delta where id = p_user_id returning chips into new_balance;
  if not found then raise exception 'User not found'; end if;
  if new_balance < 0 then raise exception 'Insufficient balance'; end if;
  insert into transactions (user_id, amount, balance_after, type, reference_id, note, admin_id)
  values (p_user_id, p_delta, new_balance, p_type, p_reference_id, p_note, p_admin_id);
  return new_balance;
end;
$$;

create or replace function public.create_challenge(p_user_id uuid, p_stake int, p_side text)
returns uuid language plpgsql security definer as $$
declare cid uuid;
begin
  if p_stake <= 0 then raise exception 'Invalid stake'; end if;
  if p_side not in ('tiger','goat','random') then raise exception 'Invalid side'; end if;
  insert into challenges (creator_id, stake, creator_side) values (p_user_id, p_stake, p_side) returning id into cid;
  perform public._apply_chip_change(p_user_id, -p_stake, 'challenge_stake', cid, 'Challenge posted');
  return cid;
end;
$$;

create or replace function public.cancel_challenge(p_challenge_id uuid, p_user_id uuid)
returns void language plpgsql security definer as $$
declare c record;
begin
  select * into c from challenges where id = p_challenge_id for update;
  if not found then raise exception 'Not found'; end if;
  if c.creator_id != p_user_id then raise exception 'Not yours'; end if;
  if c.status != 'open' then raise exception 'Not open'; end if;
  perform public._apply_chip_change(p_user_id, c.stake, 'challenge_refund', c.id, 'Challenge cancelled');
  delete from challenges where id = c.id;
end;
$$;

create or replace function public.accept_challenge(p_challenge_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer as $$
declare c record; new_game_id uuid; tiger_id uuid; goat_id uuid; initial_state jsonb;
begin
  select * into c from challenges where id = p_challenge_id for update;
  if not found then raise exception 'Challenge not found'; end if;
  if c.status != 'open' then raise exception 'Challenge is not open'; end if;
  if c.creator_id = p_user_id then raise exception 'Cannot accept own challenge'; end if;
  if c.creator_side = 'tiger' then tiger_id := c.creator_id; goat_id := p_user_id;
  elsif c.creator_side = 'goat' then goat_id := c.creator_id; tiger_id := p_user_id;
  else
    if random() < 0.5 then tiger_id := c.creator_id; goat_id := p_user_id;
    else goat_id := c.creator_id; tiger_id := p_user_id; end if;
  end if;
  initial_state := jsonb_build_object(
    'board', (select jsonb_object_agg(i::text,
      case when i in (0,4,20,24) then to_jsonb('tiger'::text) else 'null'::jsonb end)
      from generate_series(0,24) i),
    'goatsInHand', 20, 'goatsCaptured', 0,
    'turn', 'tiger', 'gameOver', false, 'winner', null, 'moveLog', '[]'::jsonb);
  insert into games (challenge_id, tiger_player, goat_player, stake, state)
  values (c.id, tiger_id, goat_id, c.stake, initial_state) returning id into new_game_id;
  update challenges set status = 'matched', game_id = new_game_id where id = c.id;
  perform public._apply_chip_change(p_user_id, -c.stake, 'challenge_stake', new_game_id, 'Accepted challenge');
  return new_game_id;
end;
$$;

create or replace function public.commit_move(
  p_game_id uuid, p_user_id uuid, p_new_state jsonb, p_expected_version int
) returns jsonb language plpgsql security definer as $$
declare g record; winner_id uuid; loser_id uuid;
begin
  select * into g from games where id = p_game_id for update;
  if not found then raise exception 'Game not found'; end if;
  if g.status != 'active' then raise exception 'Game is not active'; end if;
  if g.state_version != p_expected_version then raise exception 'Version conflict'; end if;
  if p_user_id != g.tiger_player and p_user_id != g.goat_player then raise exception 'Not a player'; end if;
  winner_id := case when (p_new_state->>'winner') = 'tiger' then g.tiger_player
    when (p_new_state->>'winner') = 'goat' then g.goat_player else null end;
  update games set state = p_new_state, state_version = state_version + 1, last_move_at = now(),
    status = case when (p_new_state->>'gameOver')::boolean then 'finished' else 'active' end,
    winner = winner_id where id = p_game_id;
  if (p_new_state->>'gameOver')::boolean and winner_id is not null then
    loser_id := case when winner_id = g.tiger_player then g.goat_player else g.tiger_player end;
    perform public._apply_chip_change(winner_id, g.stake * 2, 'game_payout', g.id, 'Won pot');
    update profiles set wins = wins + 1 where id = winner_id;
    update profiles set losses = losses + 1 where id = loser_id;
  end if;
  return p_new_state;
end;
$$;

create or replace function public.request_bank(
  p_user_id uuid, p_amount int, p_kind text, p_note text default null
) returns uuid language plpgsql security definer as $$
declare rid uuid;
begin
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_kind not in ('deposit','withdrawal') then raise exception 'Invalid kind'; end if;
  if p_kind = 'withdrawal' then
    perform public._apply_chip_change(p_user_id, -p_amount, 'bank_withdrawal', null, 'Withdrawal requested (pending)');
  end if;
  insert into bank_requests (user_id, amount, kind, note) values (p_user_id, p_amount, p_kind, p_note) returning id into rid;
  return rid;
end;
$$;

create or replace function public.review_bank_request(p_request_id uuid, p_admin_id uuid, p_approve boolean)
returns void language plpgsql security definer as $$
declare r record;
begin
  if not exists (select 1 from profiles where id = p_admin_id and role = 'admin') then raise exception 'Not authorized'; end if;
  select * into r from bank_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status != 'pending' then raise exception 'Already reviewed'; end if;
  if p_approve then
    if r.kind = 'deposit' then
      perform public._apply_chip_change(r.user_id, r.amount, 'bank_deposit', r.id, 'Deposit approved', p_admin_id);
    else
      insert into transactions (user_id, amount, balance_after, type, reference_id, note, admin_id)
      select r.user_id, 0, chips, 'bank_withdrawal', r.id, 'Withdrawal approved', p_admin_id
        from profiles where id = r.user_id;
    end if;
    update bank_requests set status='approved', reviewed_by=p_admin_id, reviewed_at=now() where id = r.id;
  else
    if r.kind = 'withdrawal' then
      perform public._apply_chip_change(r.user_id, r.amount, 'bank_withdrawal', r.id, 'Withdrawal rejected — refunded', p_admin_id);
    end if;
    update bank_requests set status='rejected', reviewed_by=p_admin_id, reviewed_at=now() where id = r.id;
  end if;
end;
$$;

create or replace function public.admin_adjust_chips(p_admin_id uuid, p_user_id uuid, p_delta int, p_note text)
returns int language plpgsql security definer as $$
begin
  if not exists (select 1 from profiles where id = p_admin_id and role = 'admin') then raise exception 'Not authorized'; end if;
  if p_delta = 0 then raise exception 'Delta is zero'; end if;
  return public._apply_chip_change(p_user_id, p_delta,
    case when p_delta > 0 then 'admin_credit' else 'admin_debit' end,
    null, coalesce(p_note, 'Manual adjustment'), p_admin_id);
end;
$$;

-- Backfill initial grants for existing users
insert into public.transactions (user_id, amount, balance_after, type, note)
select id, chips, chips, 'initial_grant', 'Initial wallet balance'
from public.profiles
where not exists (select 1 from public.transactions t where t.user_id = profiles.id);

-- Enable realtime
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.challenges;
