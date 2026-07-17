create table if not exists public.leads (
  id text primary key,
  name text not null,
  email text not null,
  role text not null,
  interest text not null,
  message text not null default '',
  chef_story text not null default '',
  structured_profile jsonb,
  readiness_snapshot jsonb,
  created_at timestamptz not null default now()
);
