-- The Luper Ledger: one shared family snapshot with compare-and-swap writes.
-- Paste into Supabase → SQL Editor → Run. Safe to re-run.
--
-- The table is closed to the public API (RLS on, no policies, no grants).
-- Devices only reach it through the two functions below, and only with the
-- family code. The code is stored as a sha256 hash, never in plain text.

create table if not exists public.ledger_family (
  code_hash  text primary key,
  version    bigint not null default 0,
  snapshot   jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ledger_family enable row level security;
revoke all on public.ledger_family from anon, authenticated;

create or replace function public.ledger_code_hash(p_code text)
returns text
language sql immutable
as $$ select encode(sha256(convert_to(lower(trim(p_code)), 'UTF8')), 'hex') $$;

-- Latest version, plus the snapshot only when it is newer than p_since.
-- No row back means the family code is wrong.
create or replace function public.ledger_pull(p_code text, p_since bigint default -1)
returns table (version bigint, snapshot jsonb)
language sql stable security definer
set search_path = public
as $$
  select f.version, case when f.version > p_since then f.snapshot end
  from public.ledger_family f
  where f.code_hash = public.ledger_code_hash(p_code)
$$;

-- Write only if nobody else wrote since p_expected. On a conflict the caller
-- gets the current snapshot back, replays its changes on top, and retries.
create or replace function public.ledger_push(p_code text, p_expected bigint, p_snapshot jsonb)
returns table (ok boolean, version bigint, snapshot jsonb)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_hash text := public.ledger_code_hash(p_code);
  v_row  public.ledger_family%rowtype;
begin
  update public.ledger_family f
     set snapshot = p_snapshot, version = f.version + 1, updated_at = now()
   where f.code_hash = v_hash and f.version = p_expected
  returning f.* into v_row;

  if found then
    return query select true, v_row.version, null::jsonb;
    return;
  end if;

  select * into v_row from public.ledger_family f where f.code_hash = v_hash;
  if not found then
    raise exception 'unknown family code';
  end if;
  return query select false, v_row.version, v_row.snapshot;
end
$$;

revoke all on function public.ledger_code_hash(text) from public;
revoke all on function public.ledger_pull(text, bigint) from public;
revoke all on function public.ledger_push(text, bigint, jsonb) from public;
grant execute on function public.ledger_pull(text, bigint) to anon, authenticated;
grant execute on function public.ledger_push(text, bigint, jsonb) to anon, authenticated;

-- Create the family. Replace the code with something only the family knows,
-- e.g. three words like 'maple-rocket-sunday'. Case and spaces are ignored.
insert into public.ledger_family (code_hash)
values (public.ledger_code_hash('CHANGE-ME'))
on conflict do nothing;
