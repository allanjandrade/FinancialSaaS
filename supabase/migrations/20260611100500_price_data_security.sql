-- Attribute price observations to their author to prevent cross-user poisoning.

alter table public.products
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();
alter table public.stores
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();
alter table public.price_records
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

drop policy if exists "products insert authenticated" on public.products;
drop policy if exists "products insert own" on public.products;
create policy "products insert own"
on public.products for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "stores insert authenticated" on public.stores;
drop policy if exists "stores insert own" on public.stores;
create policy "stores insert own"
on public.stores for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "price records insert authenticated" on public.price_records;
drop policy if exists "price records insert own" on public.price_records;
create policy "price records insert own"
on public.price_records for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "price records for tracked products" on public.price_records;
create policy "price records for tracked products"
on public.price_records for select to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.user_tracked_products tracked
    where tracked.product_id = price_records.product_id
      and tracked.user_id = auth.uid()
  )
);
