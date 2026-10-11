-- Run once in the Supabase Dashboard SQL Editor for your project.
-- Uses a new table name; does not modify an existing tutorials table.
begin;
create table public.clickcoach_tutorials (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 goal text not null check (char_length(goal) between 3 and 2000),
 title text not null check (char_length(title) between 1 and 150),
 summary text not null check (char_length(summary) between 1 and 1200),
 steps jsonb not null check (jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 1 and 20),
 source_url text not null,
 current_step integer not null default 0 check (current_step >= 0 and current_step < jsonb_array_length(steps)),
 completed integer[] not null default '{}' check (0 <= all(completed) and jsonb_array_length(steps) > all(completed)),
 version integer not null default 1 check (version > 0),
 created_at timestamptz not null default now()
);
create index clickcoach_tutorials_owner_created on public.clickcoach_tutorials(user_id,created_at desc);
alter table public.clickcoach_tutorials enable row level security;
revoke all on public.clickcoach_tutorials from anon;
grant select,insert,update,delete on public.clickcoach_tutorials to authenticated;
create policy "Read own tutorials" on public.clickcoach_tutorials for select to authenticated using ((select auth.uid())=user_id);
create policy "Create own tutorials" on public.clickcoach_tutorials for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own tutorials" on public.clickcoach_tutorials for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Delete own tutorials" on public.clickcoach_tutorials for delete to authenticated using ((select auth.uid())=user_id);
commit;
