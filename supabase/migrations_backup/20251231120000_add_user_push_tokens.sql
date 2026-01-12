-- Create table for storing device push tokens per user
create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  push_token text not null,
  platform text default 'unknown' check (platform in ('ios','android','web','unknown')),
  app_version text,
  last_seen_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  disabled boolean default false
);

alter table public.user_push_tokens enable row level security;

create unique index if not exists user_push_tokens_token_key on public.user_push_tokens (push_token);
create unique index if not exists user_push_tokens_user_token_key on public.user_push_tokens (user_id, push_token);
create index if not exists user_push_tokens_user_id_idx on public.user_push_tokens (user_id);

create policy "Users can insert their own push tokens"
  on public.user_push_tokens
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own push tokens"
  on public.user_push_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own push tokens"
  on public.user_push_tokens
  for delete
  using (auth.uid() = user_id);

create policy "Users can read their own push tokens"
  on public.user_push_tokens
  for select
  using (auth.uid() = user_id);

