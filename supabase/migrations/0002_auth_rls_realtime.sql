-- Khiaty: Supabase-specific setup applied on top of the Prisma schema (0001).
-- 1. Create an app profile row whenever Supabase Auth creates a user.
-- 2. Lock every table down with Row Level Security. The app talks to Postgres through
--    Prisma as the table owner, which is not subject to RLS; the browser (anon/authenticated
--    roles through PostgREST and Realtime) gets nothing except its own chat messages.
-- 3. Publish Message inserts to Realtime so chat updates live.
-- 4. Private storage bucket for reference photos.

-- 1. Profile trigger ---------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role "Role";
begin
  -- Role comes from sign-up metadata; anything unexpected becomes CUSTOMER.
  begin
    v_role := (new.raw_user_meta_data ->> 'role')::"Role";
  exception when others then
    v_role := 'CUSTOMER';
  end;

  insert into public."User" (id, email, name, role)
  values (
    new.id::text,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Only the auth trigger should run this; never the REST API (the linter flags SECURITY DEFINER otherwise).
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 2. Row Level Security -------------------------------------------------------
alter table public."User"        enable row level security;
alter table public."Request"     enable row level security;
alter table public."Bid"         enable row level security;
alter table public."BidRevision" enable row level security;
alter table public."Order"       enable row level security;
alter table public."OrderEvent"  enable row level security;
alter table public."Payment"     enable row level security;
alter table public."Message"     enable row level security;
alter table public."Review"      enable row level security;

-- The only browser-facing read: a party to a paid-or-later order may read its messages.
-- This is what Realtime evaluates before delivering an INSERT event to a subscriber.
-- Note: a policy's subquery runs with the caller's privileges, and "Order" has RLS with no
-- policies, so a plain EXISTS(select from "Order") would never see a row. The helper below is
-- SECURITY DEFINER (runs as its owner) and limited to the authenticated role.
create or replace function public.is_party_to_paid_order(p_order_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public."Order" o
    where o.id = p_order_id
      and o.status <> 'ACCEPTED'
      and (o."customerId" = auth.uid()::text or o."providerId" = auth.uid()::text)
  );
$$;

revoke execute on function public.is_party_to_paid_order(text) from public, anon;
grant execute on function public.is_party_to_paid_order(text) to authenticated;

drop policy if exists "parties read messages" on public."Message";
create policy "parties read messages"
  on public."Message" for select
  to authenticated
  using (public.is_party_to_paid_order("orderId"));

-- 3. Realtime -----------------------------------------------------------------
alter publication supabase_realtime add table public."Message";

-- 4. Storage ------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reference-photos', 'reference-photos', false, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
