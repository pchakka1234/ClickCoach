-- Run for existing installations before starting the updated server.
-- Safe to rerun. Existing guides retain their content and progress.
alter table public.clickcoach_tutorials
  add column if not exists conversation jsonb not null default '[]'::jsonb
  check (jsonb_typeof(conversation) = 'array' and jsonb_array_length(conversation) <= 40);
