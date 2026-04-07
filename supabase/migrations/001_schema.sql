-- Big Kitchen Production Planner — Database Schema
-- ================================================================

-- Master Data
-- ----------------------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  fg_code text unique not null,
  name text not null,
  category text,
  flavor text,
  flavor_code text,
  batch_type text,
  default_batch_kg numeric default 75,
  created_at timestamptz default now()
);

create table skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  sku_code text unique not null,
  size_g integer not null,
  qty_per_box integer not null,
  package_code text not null,
  package_type text,
  created_at timestamptz default now()
);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text,
  category text,
  unit text default 'kg'
);

create table recipe_bom (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  weight_kg numeric not null,
  yield_kg numeric,
  unique(product_id, ingredient_id)
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  short_code text,
  name text not null,
  type text,
  brand text,
  size_g integer,
  boi_category text
);

create table packaging_bom (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid references skus(id) on delete cascade,
  material_id uuid references materials(id) on delete cascade,
  ratio_avg numeric,
  ratio_min numeric,
  ratio_max numeric,
  sample_count integer,
  ratio_type text default 'variable',
  confidence text,
  unique(sku_id, material_id)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  market text,
  contact_channel text,
  notes text
);

-- Transaction Data
-- ----------------------------------------------------------------

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  product_id uuid references products(id),
  qty_batch integer not null,
  order_date date not null,
  delivery_date date,
  po_number text,
  boi_level text check (boi_level in ('BOI4', 'BOI5', 'NON')),
  requires_mcpd boolean default false,
  priority integer default 4 check (priority between 1 and 4),
  source text check (source in ('mint', 'phone', 'line', 'stock_alert')),
  status text default 'pending' check (status in ('pending', 'planned', 'producing', 'done', 'cancelled')),
  remark text,
  created_at timestamptz default now()
);

create table production_plans (
  id uuid primary key default gen_random_uuid(),
  factory text not null check (factory in ('big2', 'big1', 'big2r')),
  plan_date date not null,
  order_id uuid references orders(id) on delete cascade,
  qty_batch integer not null,
  sort_order integer default 0,
  status text default 'planned' check (status in ('planned', 'producing', 'done', 'cancelled')),
  created_at timestamptz default now()
);

create table lots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references production_plans(id) on delete cascade,
  lot_number text not null,
  lot_date date not null,
  weight_kg numeric,
  batch_count integer,
  status text default 'produced'
);

-- Compliance
-- ----------------------------------------------------------------

create table compliance_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  task_type text not null check (task_type in ('mcpd', 'coa', 'barcode', 'hc', 'sticker')),
  status text default 'pending' check (status in ('pending', 'in_progress', 'done')),
  due_date date,
  completed_at timestamptz,
  notes text
);

create table boi_lines (
  id uuid primary key default gen_random_uuid(),
  factory text not null,
  line_number integer not null,
  boi_level text check (boi_level in ('BOI4', 'BOI5')),
  annual_cap_tons numeric default 1544,
  year integer not null,
  unique(factory, line_number, year)
);

create table boi_allocations (
  id uuid primary key default gen_random_uuid(),
  boi_line_id uuid references boi_lines(id) on delete cascade,
  lot_id uuid references lots(id) on delete cascade,
  weight_kg numeric not null,
  allocated_at timestamptz default now()
);

-- Views
-- ----------------------------------------------------------------

create view daily_capacity as
select
  pp.factory,
  pp.plan_date,
  sum(pp.qty_batch) as total_batch,
  case pp.factory
    when 'big2' then 176
    when 'big1' then 88
    when 'big2r' then 44
  end as max_batch,
  round(
    sum(pp.qty_batch)::numeric /
    case pp.factory when 'big2' then 176 when 'big1' then 88 when 'big2r' then 44 end * 100,
    1
  ) as capacity_pct
from production_plans pp
where pp.status != 'cancelled'
group by pp.factory, pp.plan_date;

create view boi_annual_summary as
select
  bl.factory,
  bl.line_number,
  bl.boi_level,
  bl.year,
  bl.annual_cap_tons,
  coalesce(sum(ba.weight_kg) / 1000, 0) as used_tons,
  bl.annual_cap_tons - coalesce(sum(ba.weight_kg) / 1000, 0) as remaining_tons,
  round(coalesce(sum(ba.weight_kg) / 1000, 0) / bl.annual_cap_tons * 100, 1) as used_pct
from boi_lines bl
left join boi_allocations ba on ba.boi_line_id = bl.id
group by bl.id, bl.factory, bl.line_number, bl.boi_level, bl.year, bl.annual_cap_tons;

-- Indexes
-- ----------------------------------------------------------------

create index idx_orders_status on orders(status);
create index idx_orders_priority on orders(priority);
create index idx_production_plans_factory_date on production_plans(factory, plan_date);
create index idx_production_plans_order_id on production_plans(order_id);
create index idx_boi_allocations_line on boi_allocations(boi_line_id);

-- RLS (disable for now, enable when auth is set up)
-- ----------------------------------------------------------------

alter table products enable row level security;
alter table skus enable row level security;
alter table ingredients enable row level security;
alter table recipe_bom enable row level security;
alter table materials enable row level security;
alter table packaging_bom enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table production_plans enable row level security;
alter table lots enable row level security;
alter table compliance_tasks enable row level security;
alter table boi_lines enable row level security;
alter table boi_allocations enable row level security;

-- Allow anonymous read/write for development
create policy "Allow all for anon" on products for all using (true) with check (true);
create policy "Allow all for anon" on skus for all using (true) with check (true);
create policy "Allow all for anon" on ingredients for all using (true) with check (true);
create policy "Allow all for anon" on recipe_bom for all using (true) with check (true);
create policy "Allow all for anon" on materials for all using (true) with check (true);
create policy "Allow all for anon" on packaging_bom for all using (true) with check (true);
create policy "Allow all for anon" on customers for all using (true) with check (true);
create policy "Allow all for anon" on orders for all using (true) with check (true);
create policy "Allow all for anon" on production_plans for all using (true) with check (true);
create policy "Allow all for anon" on lots for all using (true) with check (true);
create policy "Allow all for anon" on compliance_tasks for all using (true) with check (true);
create policy "Allow all for anon" on boi_lines for all using (true) with check (true);
create policy "Allow all for anon" on boi_allocations for all using (true) with check (true);
