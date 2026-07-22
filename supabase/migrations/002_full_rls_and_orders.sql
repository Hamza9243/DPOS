-- =====================================================================
-- DPOS — Full RLS rollout + atomic order/stock RPCs
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- (Run AFTER 001_business_members.sql. Safe to re-run — every statement
--  is idempotent: drop-if-exists / create-or-replace / add-if-not-exists.)
--
-- What this fixes:
--  1. products / categories / orders / order_items had NO row level
--     security — any signed-in user could read or write ANY business's
--     data via the API directly (not just through the app UI).
--  2. Order totals and stock were computed/trusted from the browser —
--     a tampered request could record a fake total or oversell stock.
--  3. Stock was adjusted by matching product NAME (ilike), which is
--     wrong when two products share a name, and wasn't atomic, so two
--     concurrent checkouts could both pass a stale stock check.
--  4. Staff roles were only admin/cashier — this adds "manager".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Roles: widen business_members to admin / manager / cashier
-- ---------------------------------------------------------------------
alter table public.business_members drop constraint if exists business_members_role_check;
alter table public.business_members
  add constraint business_members_role_check check (role in ('admin','manager','cashier'));

-- Effective role of the current user: 'admin' if they own the business,
-- otherwise their business_members.role, otherwise null (no business).
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select 'admin' from public.businesses where owner_id = auth.uid() limit 1),
    (select role from public.business_members where user_id = auth.uid() limit 1)
  );
$$;

grant execute on function public.current_role() to authenticated;
grant execute on function public.current_business_id() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 2) order_items: add product_id so stock is adjusted by id, not name
-- ---------------------------------------------------------------------
alter table public.order_items
  add column if not exists product_id uuid references public.products(id) on delete set null;

-- ---------------------------------------------------------------------
-- 3) RLS — businesses
-- ---------------------------------------------------------------------
alter table public.businesses enable row level security;

drop policy if exists "read own business" on public.businesses;
create policy "read own business" on public.businesses for select
  using (id = public.current_business_id());

-- New signup creating their own first business (see resolveUserContext).
drop policy if exists "self create business" on public.businesses;
create policy "self create business" on public.businesses for insert
  with check (owner_id = auth.uid());

drop policy if exists "admin update own business" on public.businesses;
create policy "admin update own business" on public.businesses for update
  using (id = public.current_business_id() and public.current_role() = 'admin')
  with check (id = public.current_business_id() and public.current_role() = 'admin');

-- No delete policy: deleting a business isn't exposed in the app UI;
-- do it from the Supabase dashboard if ever needed.

-- ---------------------------------------------------------------------
-- 4) RLS — products / categories (read: any member, write: admin+manager)
-- ---------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "members read products" on public.products;
create policy "members read products" on public.products for select
  using (business_id = public.current_business_id());

drop policy if exists "staff write products" on public.products;
create policy "staff write products" on public.products for insert
  with check (business_id = public.current_business_id() and public.current_role() in ('admin','manager'));

drop policy if exists "staff update products" on public.products;
create policy "staff update products" on public.products for update
  using (business_id = public.current_business_id() and public.current_role() in ('admin','manager'))
  with check (business_id = public.current_business_id() and public.current_role() in ('admin','manager'));

drop policy if exists "staff delete products" on public.products;
create policy "staff delete products" on public.products for delete
  using (business_id = public.current_business_id() and public.current_role() in ('admin','manager'));

alter table public.categories enable row level security;

drop policy if exists "members read categories" on public.categories;
create policy "members read categories" on public.categories for select
  using (business_id = public.current_business_id());

drop policy if exists "staff write categories" on public.categories;
create policy "staff write categories" on public.categories for insert
  with check (business_id = public.current_business_id() and public.current_role() in ('admin','manager'));

drop policy if exists "staff update categories" on public.categories;
create policy "staff update categories" on public.categories for update
  using (business_id = public.current_business_id() and public.current_role() in ('admin','manager'))
  with check (business_id = public.current_business_id() and public.current_role() in ('admin','manager'));

drop policy if exists "staff delete categories" on public.categories;
create policy "staff delete categories" on public.categories for delete
  using (business_id = public.current_business_id() and public.current_role() in ('admin','manager'));

-- ---------------------------------------------------------------------
-- 5) RLS — orders / order_items
--    Everyone in the business can read. Direct writes from the client
--    are only allowed for admin (emergency/manual fixes); manager and
--    cashier must go through the RPCs below, which run SECURITY DEFINER
--    and enforce their own role + business checks so this is not a
--    bypass — it's how stock/total stay atomic and server-computed.
-- ---------------------------------------------------------------------
alter table public.orders enable row level security;

drop policy if exists "members read orders" on public.orders;
create policy "members read orders" on public.orders for select
  using (business_id = public.current_business_id());

drop policy if exists "admin direct write orders" on public.orders;
create policy "admin direct write orders" on public.orders for all
  using (business_id = public.current_business_id() and public.current_role() = 'admin')
  with check (business_id = public.current_business_id() and public.current_role() = 'admin');

alter table public.order_items enable row level security;

drop policy if exists "members read order_items" on public.order_items;
create policy "members read order_items" on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.business_id = public.current_business_id()
  ));

drop policy if exists "admin direct write order_items" on public.order_items;
create policy "admin direct write order_items" on public.order_items for all
  using (
    public.current_role() = 'admin'
    and exists (select 1 from public.orders o where o.id = order_items.order_id and o.business_id = public.current_business_id())
  )
  with check (
    public.current_role() = 'admin'
    and exists (select 1 from public.orders o where o.id = order_items.order_id and o.business_id = public.current_business_id())
  );

-- ---------------------------------------------------------------------
-- 6) RPC: create_order — the ONLY way a sale is recorded.
--    Locks each product row, re-checks stock, computes the total from
--    the DB price (never the browser), decrements stock, inserts the
--    order + items — all in one transaction (atomic, no race).
--    p_items shape: [{ "product_id": "<uuid>", "quantity": 2 }, ...]
-- ---------------------------------------------------------------------
create or replace function public.create_order(
  p_business_id uuid,
  p_items jsonb,
  p_payment text default 'Cash',
  p_customer text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.current_business_id();
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_subtotal numeric := 0;
  v_order public.orders;
  v_receipt text;
begin
  if v_business_id is null or v_business_id <> p_business_id then
    raise exception 'Not authorized for this business';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  -- Pass 1: lock every product row and validate stock/compute subtotal
  -- from the real DB price before anything is written.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity';
    end if;

    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and business_id = v_business_id
      for update;

    if v_product.id is null then
      raise exception 'Product not found';
    end if;
    if v_product.stock is not null and v_product.stock < v_qty then
      raise exception 'Insufficient stock for %: only % left', v_product.name, v_product.stock;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  v_receipt := 'RCP-' || lpad(floor(random() * 90000 + 10000)::text, 5, '0');

  insert into public.orders (business_id, receipt_no, total, status, payment, customer, created_at)
  values (v_business_id, v_receipt, v_subtotal, 'Completed', coalesce(p_payment, 'Cash'), p_customer, now())
  returning * into v_order;

  -- Pass 2: write items + decrement stock (rows are already locked above).
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid;

    insert into public.order_items (order_id, product_id, product_name, quantity, price)
    values (v_order.id, v_product.id, v_product.name, v_qty, v_product.price);

    if v_product.stock is not null then
      update public.products set stock = stock - v_qty where id = v_product.id;
    end if;
  end loop;

  return v_order;
end;
$$;

grant execute on function public.create_order(uuid, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7) RPC: add_order_item — admin/manager add a product to an existing
--    open order (Orders → order detail → Add Item).
-- ---------------------------------------------------------------------
create or replace function public.add_order_item(
  p_order_id uuid,
  p_product_id uuid,
  p_qty integer default 1
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.current_business_id();
  v_role text := public.current_role();
  v_order public.orders;
  v_product record;
  v_existing record;
begin
  if v_role not in ('admin','manager') then
    raise exception 'Not authorized';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Invalid quantity';
  end if;

  select * into v_order from public.orders where id = p_order_id and business_id = v_business_id for update;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  if v_order.status = 'Cancelled' then
    raise exception 'Cannot edit a cancelled order';
  end if;

  select * into v_product from public.products where id = p_product_id and business_id = v_business_id for update;
  if v_product.id is null then
    raise exception 'Product not found';
  end if;
  if v_product.stock is not null and v_product.stock < p_qty then
    raise exception 'Insufficient stock for %: only % left', v_product.name, v_product.stock;
  end if;

  select * into v_existing from public.order_items where order_id = p_order_id and product_id = p_product_id;
  if v_existing.id is not null then
    update public.order_items set quantity = quantity + p_qty where id = v_existing.id;
  else
    insert into public.order_items (order_id, product_id, product_name, quantity, price)
    values (p_order_id, v_product.id, v_product.name, p_qty, v_product.price);
  end if;

  if v_product.stock is not null then
    update public.products set stock = stock - p_qty where id = v_product.id;
  end if;

  update public.orders set total = (
    select coalesce(sum(price * quantity), 0) from public.order_items where order_id = p_order_id
  ) where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.add_order_item(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 8) RPC: update_order_item — admin/manager change an item's quantity
--    (p_new_qty = 0 removes the item). Adjusts stock by the delta.
-- ---------------------------------------------------------------------
create or replace function public.update_order_item(
  p_order_item_id uuid,
  p_new_qty integer
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.current_business_id();
  v_role text := public.current_role();
  v_item record;
  v_order public.orders;
  v_product record;
  v_delta integer;
begin
  if v_role not in ('admin','manager') then
    raise exception 'Not authorized';
  end if;
  if p_new_qty is null or p_new_qty < 0 then
    raise exception 'Invalid quantity';
  end if;

  select oi.* into v_item
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = p_order_item_id and o.business_id = v_business_id;
  if v_item.id is null then
    raise exception 'Order item not found';
  end if;

  select * into v_order from public.orders where id = v_item.order_id for update;
  if v_order.status = 'Cancelled' then
    raise exception 'Cannot edit a cancelled order';
  end if;

  v_delta := p_new_qty - v_item.quantity; -- positive = selling more (needs more stock)

  if v_item.product_id is not null and v_delta <> 0 then
    select * into v_product from public.products where id = v_item.product_id for update;
    if v_delta > 0 and v_product.stock is not null and v_product.stock < v_delta then
      raise exception 'Insufficient stock for %: only % left', v_product.name, v_product.stock;
    end if;
    if v_product.stock is not null then
      update public.products set stock = stock - v_delta where id = v_item.product_id;
    end if;
  end if;

  if p_new_qty = 0 then
    delete from public.order_items where id = p_order_item_id;
  else
    update public.order_items set quantity = p_new_qty where id = p_order_item_id;
  end if;

  update public.orders set total = (
    select coalesce(sum(price * quantity), 0) from public.order_items where order_id = v_item.order_id
  ) where id = v_item.order_id
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.update_order_item(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 9) RPC: set_order_status — admin/manager change status. Cancelling
--    (from any non-cancelled state) restores stock for every item —
--    this also fixes the old behaviour where cancelling via the status
--    buttons (as opposed to the dedicated Return button) never put
--    stock back.
-- ---------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id uuid,
  p_status text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid := public.current_business_id();
  v_role text := public.current_role();
  v_order public.orders;
  v_item record;
begin
  if v_role not in ('admin','manager') then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('Completed','Pending','Cancelled') then
    raise exception 'Invalid status';
  end if;

  select * into v_order from public.orders where id = p_order_id and business_id = v_business_id for update;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;

  if p_status = 'Cancelled' and v_order.status <> 'Cancelled' then
    for v_item in select * from public.order_items where order_id = p_order_id
    loop
      if v_item.product_id is not null then
        update public.products set stock = stock + v_item.quantity where id = v_item.product_id;
      end if;
    end loop;
  end if;

  update public.orders set status = p_status where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

grant execute on function public.set_order_status(uuid, text) to authenticated;
