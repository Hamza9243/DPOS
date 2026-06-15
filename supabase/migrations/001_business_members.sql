-- =====================================================================
-- DPOS — Staff roles (admin / cashier)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

-- 1) Membership table: links a user to a business with a role.
--    The business OWNER (businesses.owner_id) is always treated as admin in
--    the app, so owners do NOT need a row here. This table holds extra staff
--    (e.g. cashiers) that share the same business.
create table if not exists public.business_members (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id)        on delete cascade,
  role        text not null default 'cashier' check (role in ('admin','cashier')),
  email       text,
  created_at  timestamptz not null default now(),
  unique (user_id)                       -- one user belongs to one business
);

create index if not exists business_members_business_idx on public.business_members(business_id);

-- 2) Helper: the business_id the current user belongs to (owner OR member).
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select id from public.businesses where owner_id = auth.uid() limit 1),
    (select business_id from public.business_members where user_id = auth.uid() limit 1)
  );
$$;

-- 3) Helper: is the current user an admin of their business?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.businesses where owner_id = auth.uid());
$$;

-- 4) RLS on business_members.
alter table public.business_members enable row level security;

-- Everyone in the business can read its members list...
drop policy if exists "members read own business" on public.business_members;
create policy "members read own business"
  on public.business_members for select
  using (business_id = public.current_business_id());

-- ...but only the admin (owner) can add / change / remove staff.
drop policy if exists "admin manage members" on public.business_members;
create policy "admin manage members"
  on public.business_members for all
  using (public.is_admin() and business_id = public.current_business_id())
  with check (public.is_admin() and business_id = public.current_business_id());

-- =====================================================================
-- OPTIONAL HARDENING (recommended): restrict admin-only tables so a
-- cashier cannot reach them through the API, not just the UI.
-- Enable these once you've confirmed the app works. They assume each row
-- has a business_id column (products, categories, orders, order_items via
-- their order) — adjust names if yours differ.
-- =====================================================================
-- alter table public.products  enable row level security;
-- create policy "members read products" on public.products for select
--   using (business_id = public.current_business_id());
-- create policy "admin write products" on public.products for all
--   using (public.is_admin() and business_id = public.current_business_id())
--   with check (public.is_admin() and business_id = public.current_business_id());
