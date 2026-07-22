-- =====================================================================
-- DPOS — Phase 3: Reports, CRM (customers), Discounts/Tax/Payment,
--                 Audit Log
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- (Run AFTER 001 and 002. Safe to re-run — idempotent.)
--
-- What this adds:
--  1. customers table (lightweight CRM: phone, history, loyalty points).
--  2. orders gains subtotal/discount/tax/customer_id so checkout can
--     apply a discount + tax rate and link a sale to a customer.
--  3. order_items gains cost_price — a SNAPSHOT of the product's cost at
--     the moment of sale, so profit reports stay accurate even if a
--     product's cost is edited later.
--  4. audit_log — automatic, trigger-driven. Nothing can write to it
--     except the SECURITY DEFINER trigger functions below, so it can't
--     be tampered with or silently skipped by a client bug. Admin-only
--     read.
--  5. create_order / add_order_item / update_order_item / set_order_status
--     are redefined to compute discount/tax, keep customer stats (total
--     spent, order count, loyalty points) in sync, and reverse those
--     stats on cancellation.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) customers — lightweight CRM
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  name           text not null,
  phone          text,
  email          text,
  notes          text,
  loyalty_points integer not null default 0,
  total_spent    numeric not null default 0,
  orders_count   integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists customers_business_idx on public.customers(business_id);

alter table public.customers enable row level security;

drop policy if exists "members read customers" on public.customers;
create policy "members read customers" on public.customers for select
  using (business_id = public.current_business_id());

-- Any staff role (incl. cashier) can add a customer — needed for the
-- quick-add-at-checkout flow in POS.
drop policy if exists "members write customers" on public.customers;
create policy "members write customers" on public.customers for insert
  with check (business_id = public.current_business_id());

drop policy if exists "members update customers" on public.customers;
create policy "members update customers" on public.customers for update
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

drop policy if exists "staff delete customers" on public.customers;
create policy "staff delete customers" on public.customers for delete
  using (business_id = public.current_business_id() and public.current_role() in ('admin','manager'));

-- ---------------------------------------------------------------------
-- 2) orders: subtotal / discount / tax / customer_id
--    order_items: cost_price snapshot
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists subtotal numeric not null default 0;
alter table public.orders add column if not exists discount numeric not null default 0;
alter table public.orders add column if not exists tax numeric not null default 0;
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.order_items add column if not exists cost_price numeric not null default 0;

-- ---------------------------------------------------------------------
-- 3) audit_log — automatic, trigger-written, admin-only read
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id    uuid,
  actor_email text,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_business_idx on public.audit_log(business_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "admin read audit log" on public.audit_log;
create policy "admin read audit log" on public.audit_log for select
  using (business_id = public.current_business_id() and public.current_role() = 'admin');
-- Deliberately no insert/update/delete policy: only the SECURITY DEFINER
-- trigger functions below (owned by the migration role, which bypasses
-- RLS on tables it owns) can write here.

create or replace function public.write_audit_log(
  p_business_id uuid, p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (business_id, actor_id, actor_email, action, entity_type, entity_id, details)
  values (
    p_business_id,
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    p_action,
    p_entity_type,
    p_entity_id,
    p_details
  );
end;
$$;

-- Products: every insert/update/delete.
create or replace function public.trg_audit_products() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit_log(
    coalesce(new.business_id, old.business_id),
    lower(tg_op) || '.product',
    'product',
    coalesce(new.id, old.id),
    jsonb_build_object(
      'name', coalesce(new.name, old.name),
      'price', coalesce(new.price, old.price),
      'stock', coalesce(new.stock, old.stock)
    )
  );
  return coalesce(new, old);
end;
$$;
drop trigger if exists audit_products on public.products;
create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.trg_audit_products();

-- Staff (business_members): add / role change / remove.
create or replace function public.trg_audit_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit_log(
    coalesce(new.business_id, old.business_id),
    lower(tg_op) || '.staff',
    'business_member',
    coalesce(new.id, old.id),
    jsonb_build_object('email', coalesce(new.email, old.email), 'role', coalesce(new.role, old.role))
  );
  return coalesce(new, old);
end;
$$;
drop trigger if exists audit_members on public.business_members;
create trigger audit_members after insert or update or delete on public.business_members
  for each row execute function public.trg_audit_members();

-- Orders: creation + every status change (covers cancel/complete/pending).
create or replace function public.trg_audit_orders() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit_log(
    new.business_id,
    case when tg_op = 'INSERT' then 'order.create' else 'order.status.' || lower(new.status) end,
    'order',
    new.id,
    jsonb_build_object('receipt_no', new.receipt_no, 'total', new.total, 'status', new.status)
  );
  return new;
end;
$$;
drop trigger if exists audit_orders on public.orders;
create trigger audit_orders after insert or update of status on public.orders
  for each row execute function public.trg_audit_orders();

-- ---------------------------------------------------------------------
-- 4) create_order — rebuilt: discount amount + tax rate (%) + optional
--    customer link. Awards 1 loyalty point per Rs. 100 spent.
--    Drop the old 4-arg overload first so there's exactly one version.
-- ---------------------------------------------------------------------
drop function if exists public.create_order(uuid, jsonb, text, text);

create or replace function public.create_order(
  p_business_id uuid,
  p_items jsonb,
  p_payment text default 'Cash',
  p_customer text default null,
  p_discount numeric default 0,
  p_tax_rate numeric default 0,
  p_customer_id uuid default null
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
  v_discount numeric := greatest(coalesce(p_discount, 0), 0);
  v_tax numeric := 0;
  v_total numeric := 0;
  v_order public.orders;
  v_receipt text;
  v_customer_name text := p_customer;
begin
  if v_business_id is null or v_business_id <> p_business_id then
    raise exception 'Not authorized for this business';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  if p_customer_id is not null then
    select name into v_customer_name from public.customers
      where id = p_customer_id and business_id = v_business_id;
    if v_customer_name is null then
      raise exception 'Customer not found';
    end if;
  end if;

  -- Pass 1: lock every product row, validate stock, compute subtotal
  -- from the real DB price.
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

  if v_discount > v_subtotal then
    v_discount := v_subtotal;
  end if;
  v_tax := round((v_subtotal - v_discount) * greatest(coalesce(p_tax_rate, 0), 0) / 100, 2);
  v_total := v_subtotal - v_discount + v_tax;

  v_receipt := 'RCP-' || lpad(floor(random() * 90000 + 10000)::text, 5, '0');

  insert into public.orders
    (business_id, receipt_no, subtotal, discount, tax, total, status, payment, customer, customer_id, created_at)
  values
    (v_business_id, v_receipt, v_subtotal, v_discount, v_tax, v_total, 'Completed',
     coalesce(p_payment, 'Cash'), v_customer_name, p_customer_id, now())
  returning * into v_order;

  -- Pass 2: write items (with cost snapshot) + decrement stock.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid;

    insert into public.order_items (order_id, product_id, product_name, quantity, price, cost_price)
    values (v_order.id, v_product.id, v_product.name, v_qty, v_product.price, coalesce(v_product.cost_price, 0));

    if v_product.stock is not null then
      update public.products set stock = stock - v_qty where id = v_product.id;
    end if;
  end loop;

  if p_customer_id is not null then
    update public.customers set
      total_spent = total_spent + v_total,
      orders_count = orders_count + 1,
      loyalty_points = loyalty_points + floor(v_total / 100)::integer
    where id = p_customer_id;
  end if;

  return v_order;
end;
$$;

grant execute on function public.create_order(uuid, jsonb, text, text, numeric, numeric, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5) add_order_item — now keeps subtotal/total consistent with the
--    order's existing discount/tax, and adjusts customer total_spent
--    by the resulting delta.
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
  v_new_subtotal numeric;
  v_new_total numeric;
  v_old_total numeric;
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
  v_old_total := v_order.total;

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
    insert into public.order_items (order_id, product_id, product_name, quantity, price, cost_price)
    values (p_order_id, v_product.id, v_product.name, p_qty, v_product.price, coalesce(v_product.cost_price, 0));
  end if;

  if v_product.stock is not null then
    update public.products set stock = stock - p_qty where id = v_product.id;
  end if;

  select coalesce(sum(price * quantity), 0) into v_new_subtotal from public.order_items where order_id = p_order_id;
  v_new_total := greatest(v_new_subtotal - v_order.discount, 0) + v_order.tax;

  update public.orders set subtotal = v_new_subtotal, total = v_new_total where id = p_order_id
  returning * into v_order;

  if v_order.customer_id is not null then
    update public.customers set total_spent = total_spent + (v_new_total - v_old_total) where id = v_order.customer_id;
  end if;

  return v_order;
end;
$$;

grant execute on function public.add_order_item(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 6) update_order_item — same discount/tax-aware total recompute.
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
  v_new_subtotal numeric;
  v_new_total numeric;
  v_old_total numeric;
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
  v_old_total := v_order.total;

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

  select coalesce(sum(price * quantity), 0) into v_new_subtotal from public.order_items where order_id = v_item.order_id;
  v_new_total := greatest(v_new_subtotal - v_order.discount, 0) + v_order.tax;

  update public.orders set subtotal = v_new_subtotal, total = v_new_total where id = v_item.order_id
  returning * into v_order;

  if v_order.customer_id is not null then
    update public.customers set total_spent = total_spent + (v_new_total - v_old_total) where id = v_order.customer_id;
  end if;

  return v_order;
end;
$$;

grant execute on function public.update_order_item(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 7) set_order_status — cancelling now also reverses the customer's
--    total_spent / orders_count / loyalty_points, not just stock.
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

    if v_order.customer_id is not null then
      update public.customers set
        total_spent = greatest(total_spent - v_order.total, 0),
        orders_count = greatest(orders_count - 1, 0),
        loyalty_points = greatest(loyalty_points - floor(v_order.total / 100)::integer, 0)
      where id = v_order.customer_id;
    end if;
  end if;

  update public.orders set status = p_status where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

grant execute on function public.set_order_status(uuid, text) to authenticated;
