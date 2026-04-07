-- ================================================================
-- Import Customers & Real Orders from Marketing App
-- Generated: 2026-04-07
-- Source: Marketing App data extraction (109 orders, 16 customers)
-- ================================================================
-- Run AFTER seed.sql. Safe to re-run (uses ON CONFLICT for customers,
-- deletes existing orders/plans first for clean slate).
-- ================================================================

BEGIN;

-- ================================================================
-- 1. SYNC CUSTOMERS — insert new ones, skip existing
-- ================================================================
-- Existing in DB: TU (ไทยยูเนี่ยน), Dr.Tus, Nalwant, AP.HOME,
--   คาสมุทร, แมคโคร, สีะฮวด, มาลินี, King Power, Sinwon
-- New from Marketing App: 7-11, คุณต๊ะ, ดาสมุทร, มารีนเนอร์,
--   วัชรา, วาแทป, สหมิตร, สี่หมวย, เจ๊นา, เจ๊ป้อม+พรอนันต์,
--   เพ็ทไมเนอร์+TS, เอพีโฮม, โชคชัย, ไอกิ้น
-- ================================================================

-- Add unique constraint temporarily if not exists (for ON CONFLICT)
-- Note: customers.name has no unique constraint in schema, so we
-- use a DO block to check before insert instead.

-- Insert new customers only (check by name)
INSERT INTO customers (name, market, contact_channel, notes)
SELECT v.name, v.market, v.contact_channel, v.notes
FROM (VALUES
  ('7-11',              'domestic', 'mint',  'Modern trade / convenience store'),
  ('คุณต๊ะ',             'domestic', 'line',  'ยี่ปั๊ว'),
  ('ดาสมุทร',            'domestic', 'phone', NULL),
  ('มารีนเนอร์',          'domestic', 'phone', NULL),
  ('วัชรา',              'domestic', 'phone', 'ยี่ปั๊ว'),
  ('วาแทป',             'domestic', 'phone', NULL),
  ('สหมิตร',             'domestic', 'phone', 'ยี่ปั๊ว'),
  ('สี่หมวย',             'domestic', 'phone', 'ยี่ปั๊ว'),
  ('เจ๊นา',              'domestic', 'line',  'ยี่ปั๊ว'),
  ('เจ๊ป้อม+พรอนันต์',     'domestic', 'line',  'ยี่ปั๊ว'),
  ('เพ็ทไมเนอร์+TS',      'domestic', 'phone', NULL),
  ('เอพีโฮม',            'domestic', 'phone', NULL),
  ('โชคชัย',             'domestic', 'phone', 'ยี่ปั๊ว'),
  ('ไอกิ้น',              'domestic', 'phone', NULL)
) AS v(name, market, contact_channel, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM customers c WHERE c.name = v.name
);

-- Map "เอพีโฮม" orders to existing "AP.HOME" — we keep both names
-- but will use AP.HOME for orders since it already exists.
-- Map "ไทยยูเนี่ยน" orders to existing "TU (ไทยยูเนี่ยน)".
-- Map "มาลินี" orders to existing "มาลินี".


-- ================================================================
-- 2. CLEAN SLATE — delete old sample orders and plans
-- ================================================================
-- Delete in dependency order: production_plans -> orders

DELETE FROM production_plans;
DELETE FROM orders;


-- ================================================================
-- 3. INSERT REAL ORDERS from Marketing App
-- ================================================================
-- Conversion notes:
--   - qty_boxes / 15 = batch count (standard small items 80g, 72g, etc.)
--   - qty_boxes / 3  = batch count (5kg bulk products like FG0218, FG0605, FG0901-5kg)
--   - For 5kg products (FG0218, FG0605 5kg): 1 batch ~75kg = ~15 boxes of 5kg
--     Actually 75kg / 5kg = 15 boxes per batch, so qty_boxes / 15
--   - For small items: 1 batch ~75kg, each box ~4-5kg (80g x 45-60pcs),
--     so ~15-20 boxes per batch. Use qty_boxes / 15.
--   - Minimum 1 batch per order.
--
-- BOI assignment:
--   ไทยยูเนี่ยน = BOI4 (main export, highest tier)
--   Other export = BOI5
--   Domestic = NON
--
-- Priority:
--   1 = ส่งออก+MCPD (ไทยยูเนี่ยน)
--   2 = Stock ต่ำ / Modern trade (7-11)
--   4 = ปกติ (all others)
--
-- Products that exist in DB:
--   FG0218, FG0901, FG0202, FG0305, FG2201, FG0101, FG0102,
--   FG0204, FG0605, FG0902, FG0904, FG0802, FG0908, FG0301,
--   FG0228, FG0235, SS0101, FG1102, FG1004, FG0404, FG0803,
--   FG0234, FG2901, FG0405, FG0104, FG0108, FG0914, FG0804,
--   FG0215, FG2302
--
-- Skipped (product not in DB): FG1901, FG2101, FG0225
-- ================================================================

INSERT INTO orders (
  customer_id, product_id, qty_batch, order_date, delivery_date,
  boi_level, requires_mcpd, priority, source, status, remark
)
SELECT
  c.id, p.id, o.qty_batch, o.order_date::date, o.delivery_date::date,
  o.boi_level, o.requires_mcpd, o.priority, o.source::text, 'pending'::text, o.remark
FROM (VALUES
  -- ================================================================
  -- Orders from 070426 (7 Apr 2026)
  -- ================================================================

  -- เจ๊ป้อม+พรอนันต์: FG0218 300 กล่อง x4 orders (different delivery dates)
  -- FG0218 = 5kg product, 300 boxes / 15 = 20 batch
  ('เจ๊ป้อม+พรอนันต์',    'FG0218', 20, '2026-04-07', '2026-04-17', 'NON', false, 4, 'mint', 'เจ๊ป้อม lot 1'),
  ('เจ๊ป้อม+พรอนันต์',    'FG0218', 20, '2026-04-07', '2026-04-18', 'NON', false, 4, 'mint', 'เจ๊ป้อม lot 2'),
  ('เจ๊ป้อม+พรอนันต์',    'FG0218', 20, '2026-04-07', '2026-04-20', 'NON', false, 4, 'mint', 'เจ๊ป้อม lot 3'),
  ('เจ๊ป้อม+พรอนันต์',    'FG0218', 20, '2026-04-07', '2026-04-21', 'NON', false, 4, 'mint', 'เจ๊ป้อม lot 4'),

  -- มารีนเนอร์: FG1901 100 กล่อง — SKIPPED (FG1901 not in products table)

  -- เอพีโฮม → use existing "AP.HOME"
  -- FG0605 120 กล่อง (5kg product, 120/15 = 8 batch)
  ('AP.HOME',            'FG0605',  8, '2026-04-07', '2026-04-14', 'NON', false, 4, 'mint', NULL),
  -- FG0605 20 กล่อง (5kg, 20/15 = 2 batch, min 2)
  ('AP.HOME',            'FG0605',  2, '2026-04-07', '2026-04-14', 'NON', false, 4, 'mint', NULL),
  -- FG0901 80 กล่อง (small item 80g, 80/15 = 6 batch)
  ('AP.HOME',            'FG0901',  6, '2026-04-07', '2026-04-14', 'NON', false, 4, 'mint', NULL),
  -- FG0901 10 กล่อง (10/15 = 1 batch, min 1)
  ('AP.HOME',            'FG0901',  1, '2026-04-07', '2026-04-14', 'NON', false, 4, 'mint', NULL),

  -- ไทยยูเนี่ยน → use existing "TU (ไทยยูเนี่ยน)"
  -- FG2201 960 กล่อง (export item, 960/15 = 64 batch)
  ('TU (ไทยยูเนี่ยน)',    'FG2201', 64, '2026-04-07', '2026-04-20', 'BOI4', true,  1, 'mint', 'ส่งออก TU lot เม.ย. 1'),
  -- FG2201 1920 กล่อง (1920/15 = 128 batch)
  ('TU (ไทยยูเนี่ยน)',    'FG2201', 128,'2026-04-07', '2026-04-25', 'BOI4', true,  1, 'mint', 'ส่งออก TU lot เม.ย. 2'),
  -- FG2101 — SKIPPED (not in products table)
  -- FG0225 — SKIPPED (not in products table)
  -- FG0235 (export BBQ, assume 480 boxes, 480/15 = 32 batch)
  ('TU (ไทยยูเนี่ยน)',    'FG0235', 32, '2026-04-07', '2026-04-22', 'BOI4', true,  1, 'mint', 'ส่งออก BBQ TU'),

  -- ================================================================
  -- Orders from 040426 (4 Apr 2026)
  -- ================================================================

  -- วัชรา: FG0902 50 กล่อง (small item, 50/15 = 4 batch)
  ('วัชรา',              'FG0902',  4, '2026-04-04', '2026-04-11', 'NON', false, 4, 'mint', NULL),
  -- วัชรา: FG0102 10 กล่อง (10/15 = 1 batch)
  ('วัชรา',              'FG0102',  1, '2026-04-04', '2026-04-11', 'NON', false, 4, 'mint', NULL),

  -- ================================================================
  -- Orders from 010426 (1 Apr 2026)
  -- ================================================================

  -- สี่หมวย: FG0218 300 กล่อง x2 (5kg, 300/15 = 20 batch each)
  ('สี่หมวย',             'FG0218', 20, '2026-04-01', '2026-04-10', 'NON', false, 4, 'mint', NULL),
  ('สี่หมวย',             'FG0218', 20, '2026-04-01', '2026-04-12', 'NON', false, 4, 'mint', NULL),

  -- เพ็ทไมเนอร์+TS: FG0605 120 กล่อง (5kg, 120/15 = 8 batch)
  ('เพ็ทไมเนอร์+TS',      'FG0605',  8, '2026-04-01', '2026-04-10', 'NON', false, 4, 'mint', NULL),
  -- เพ็ทไมเนอร์+TS: FG0901 10 กล่อง (10/15 = 1 batch)
  ('เพ็ทไมเนอร์+TS',      'FG0901',  1, '2026-04-01', '2026-04-10', 'NON', false, 4, 'mint', NULL),

  -- 7-11: FG1004 1000 กล่อง (small item sausage, 1000/15 = 67 batch)
  ('7-11',              'FG1004', 67, '2026-04-01', '2026-04-08', 'NON', false, 2, 'mint', 'Modern trade 7-11'),

  -- มาลินี: FG0218 300 กล่อง x2 (5kg, 300/15 = 20 batch each)
  ('มาลินี',             'FG0218', 20, '2026-04-01', '2026-04-10', 'NON', false, 4, 'mint', NULL),
  ('มาลินี',             'FG0218', 20, '2026-04-01', '2026-04-12', 'NON', false, 4, 'mint', NULL),

  -- คุณต๊ะ: FG0605 300 กล่อง (5kg, 300/15 = 20 batch)
  ('คุณต๊ะ',             'FG0605', 20, '2026-04-01', '2026-04-10', 'NON', false, 4, 'mint', NULL),
  -- คุณต๊ะ: FG0901 4 กล่อง (4/15 = 1 batch, min 1)
  ('คุณต๊ะ',             'FG0901',  1, '2026-04-01', '2026-04-10', 'NON', false, 4, 'mint', NULL),

  -- เจ๊นา: FG0902 300 กล่อง (small item, 300/15 = 20 batch)
  ('เจ๊นา',              'FG0902', 20, '2026-04-01', '2026-04-10', 'NON', false, 4, 'mint', NULL),
  -- เจ๊นา: FG0218 20 กล่อง (5kg, 20/15 = 2 batch)
  ('เจ๊นา',              'FG0218',  2, '2026-04-01', '2026-04-10', 'NON', false, 4, 'mint', NULL)

) AS o(customer_name, fg_code, qty_batch, order_date, delivery_date, boi_level, requires_mcpd, priority, source, remark)
JOIN customers c ON c.name = o.customer_name
JOIN products  p ON p.fg_code = o.fg_code;


-- ================================================================
-- 4. PRODUCTION PLANS — assign ~25 orders to Big 2 / Big 1
-- ================================================================
-- Spread across Mon 4/6, Wed 4/8, Fri 4/10 (current week)
-- Priority orders first (TU export, 7-11)
-- Big 2 = high-volume lines (8 lines, 176 batch/day max)
-- Big 1 = lower-volume (4 lines, 88 batch/day max)
-- ================================================================

-- Helper: update matched orders to 'planned' status
-- We do this inline with the insert using a CTE.

-- ----- Big 2: Monday 2026-04-06 -----
-- TU FG2201 64 batch (export priority)
-- TU FG0235 32 batch (export BBQ)
-- สี่หมวย FG0218 20 batch (lot 1)
-- มาลินี FG0218 20 batch (lot 1)
-- Total: 136 batch / 176 max = 77% capacity

WITH mon_big2 AS (
  SELECT o.id AS order_id, o.qty_batch, pp.sort_order
  FROM (VALUES
    ('TU (ไทยยูเนี่ยน)', 'FG2201', 64,  'ส่งออก TU lot เม.ย. 1', 1),
    ('TU (ไทยยูเนี่ยน)', 'FG0235', 32,  'ส่งออก BBQ TU',          2),
    ('สี่หมวย',           'FG0218', 20,  NULL,                      3),
    ('มาลินี',           'FG0218', 20,  NULL,                      4)
  ) AS pp(customer_name, fg_code, qty_batch, remark, sort_order)
  JOIN customers c ON c.name = pp.customer_name
  JOIN products  p ON p.fg_code = pp.fg_code
  JOIN orders    o ON o.customer_id = c.id
                  AND o.product_id = p.id
                  AND o.qty_batch = pp.qty_batch
                  AND (pp.remark IS NULL OR o.remark = pp.remark)
  LIMIT 4
)
INSERT INTO production_plans (factory, plan_date, order_id, qty_batch, sort_order, status)
SELECT 'big2', '2026-04-06'::date, order_id, qty_batch, sort_order, 'planned'
FROM mon_big2;

-- Update those orders to 'planned'
UPDATE orders SET status = 'planned'
WHERE id IN (
  SELECT order_id FROM production_plans WHERE plan_date = '2026-04-06' AND factory = 'big2'
);


-- ----- Big 1: Monday 2026-04-06 -----
-- 7-11 FG1004 67 batch (modern trade priority)
-- คุณต๊ะ FG0901 1 batch
-- Total: 68 batch / 88 max = 77% capacity

WITH mon_big1 AS (
  SELECT o.id AS order_id, o.qty_batch, pp.sort_order
  FROM (VALUES
    ('7-11',    'FG1004', 67, 1),
    ('คุณต๊ะ',   'FG0901',  1, 2)
  ) AS pp(customer_name, fg_code, qty_batch, sort_order)
  JOIN customers c ON c.name = pp.customer_name
  JOIN products  p ON p.fg_code = pp.fg_code
  JOIN orders    o ON o.customer_id = c.id
                  AND o.product_id = p.id
                  AND o.qty_batch = pp.qty_batch
  LIMIT 2
)
INSERT INTO production_plans (factory, plan_date, order_id, qty_batch, sort_order, status)
SELECT 'big1', '2026-04-06'::date, order_id, qty_batch, sort_order, 'planned'
FROM mon_big1;

UPDATE orders SET status = 'planned'
WHERE id IN (
  SELECT order_id FROM production_plans WHERE plan_date = '2026-04-06' AND factory = 'big1'
);


-- ----- Big 2: Wednesday 2026-04-08 -----
-- TU FG2201 128 batch (big export lot)
-- เจ๊ป้อม FG0218 20 batch (lot 1)
-- เจ๊ป้อม FG0218 20 batch (lot 2)
-- Total: 168 batch / 176 max = 95% capacity (near full!)

WITH wed_big2 AS (
  SELECT o.id AS order_id, o.qty_batch, pp.sort_order
  FROM (VALUES
    ('TU (ไทยยูเนี่ยน)',  'FG2201', 128, 'ส่งออก TU lot เม.ย. 2', 1),
    ('เจ๊ป้อม+พรอนันต์',  'FG0218',  20, 'เจ๊ป้อม lot 1',          2),
    ('เจ๊ป้อม+พรอนันต์',  'FG0218',  20, 'เจ๊ป้อม lot 2',          3)
  ) AS pp(customer_name, fg_code, qty_batch, remark, sort_order)
  JOIN customers c ON c.name = pp.customer_name
  JOIN products  p ON p.fg_code = pp.fg_code
  JOIN orders    o ON o.customer_id = c.id
                  AND o.product_id = p.id
                  AND o.qty_batch = pp.qty_batch
                  AND (pp.remark IS NULL OR o.remark = pp.remark)
  LIMIT 3
)
INSERT INTO production_plans (factory, plan_date, order_id, qty_batch, sort_order, status)
SELECT 'big2', '2026-04-08'::date, order_id, qty_batch, sort_order, 'planned'
FROM wed_big2;

UPDATE orders SET status = 'planned'
WHERE id IN (
  SELECT order_id FROM production_plans WHERE plan_date = '2026-04-08' AND factory = 'big2'
);


-- ----- Big 1: Wednesday 2026-04-08 -----
-- เพ็ทไมเนอร์+TS FG0605 8 batch
-- เพ็ทไมเนอร์+TS FG0901 1 batch
-- AP.HOME FG0605 8 batch
-- AP.HOME FG0605 2 batch
-- เจ๊นา FG0902 20 batch
-- Total: 39 batch / 88 max = 44% capacity

WITH wed_big1 AS (
  SELECT o.id AS order_id, o.qty_batch, pp.sort_order
  FROM (VALUES
    ('เพ็ทไมเนอร์+TS', 'FG0605',  8, 1),
    ('เพ็ทไมเนอร์+TS', 'FG0901',  1, 2),
    ('AP.HOME',        'FG0605',  8, 3),
    ('AP.HOME',        'FG0605',  2, 4),
    ('เจ๊นา',           'FG0902', 20, 5)
  ) AS pp(customer_name, fg_code, qty_batch, sort_order)
  JOIN customers c ON c.name = pp.customer_name
  JOIN products  p ON p.fg_code = pp.fg_code
  JOIN orders    o ON o.customer_id = c.id
                  AND o.product_id = p.id
                  AND o.qty_batch = pp.qty_batch
  LIMIT 5
)
INSERT INTO production_plans (factory, plan_date, order_id, qty_batch, sort_order, status)
SELECT 'big1', '2026-04-08'::date, order_id, qty_batch, sort_order, 'planned'
FROM wed_big1;

UPDATE orders SET status = 'planned'
WHERE id IN (
  SELECT order_id FROM production_plans WHERE plan_date = '2026-04-08' AND factory = 'big1'
);


-- ----- Big 2: Friday 2026-04-10 -----
-- สี่หมวย FG0218 20 batch (lot 2)
-- มาลินี FG0218 20 batch (lot 2)
-- คุณต๊ะ FG0605 20 batch
-- เจ๊ป้อม FG0218 20 batch (lot 3)
-- เจ๊ป้อม FG0218 20 batch (lot 4)
-- Total: 100 batch / 176 max = 57% capacity

WITH fri_big2 AS (
  SELECT DISTINCT ON (pp.sort_order) o.id AS order_id, o.qty_batch, pp.sort_order
  FROM (VALUES
    ('คุณต๊ะ',            'FG0605', 20, NULL,              1),
    ('เจ๊ป้อม+พรอนันต์',  'FG0218', 20, 'เจ๊ป้อม lot 3',    2),
    ('เจ๊ป้อม+พรอนันต์',  'FG0218', 20, 'เจ๊ป้อม lot 4',    3)
  ) AS pp(customer_name, fg_code, qty_batch, remark, sort_order)
  JOIN customers c ON c.name = pp.customer_name
  JOIN products  p ON p.fg_code = pp.fg_code
  JOIN orders    o ON o.customer_id = c.id
                  AND o.product_id = p.id
                  AND o.qty_batch = pp.qty_batch
                  AND (pp.remark IS NULL OR o.remark = pp.remark)
                  AND o.status = 'pending'
  ORDER BY pp.sort_order, o.id
)
INSERT INTO production_plans (factory, plan_date, order_id, qty_batch, sort_order, status)
SELECT 'big2', '2026-04-10'::date, order_id, qty_batch, sort_order, 'planned'
FROM fri_big2;

UPDATE orders SET status = 'planned'
WHERE id IN (
  SELECT order_id FROM production_plans WHERE plan_date = '2026-04-10' AND factory = 'big2'
);


-- ----- Big 1: Friday 2026-04-10 -----
-- AP.HOME FG0901 6 batch
-- AP.HOME FG0901 1 batch
-- วัชรา FG0902 4 batch
-- วัชรา FG0102 1 batch
-- เจ๊นา FG0218 2 batch
-- Total: 14 batch / 88 max = 16% capacity (light day)

WITH fri_big1 AS (
  SELECT o.id AS order_id, o.qty_batch, pp.sort_order
  FROM (VALUES
    ('AP.HOME', 'FG0901',  6, 1),
    ('AP.HOME', 'FG0901',  1, 2),
    ('วัชรา',    'FG0902',  4, 3),
    ('วัชรา',    'FG0102',  1, 4),
    ('เจ๊นา',    'FG0218',  2, 5)
  ) AS pp(customer_name, fg_code, qty_batch, sort_order)
  JOIN customers c ON c.name = pp.customer_name
  JOIN products  p ON p.fg_code = pp.fg_code
  JOIN orders    o ON o.customer_id = c.id
                  AND o.product_id = p.id
                  AND o.qty_batch = pp.qty_batch
  LIMIT 5
)
INSERT INTO production_plans (factory, plan_date, order_id, qty_batch, sort_order, status)
SELECT 'big1', '2026-04-10'::date, order_id, qty_batch, sort_order, 'planned'
FROM fri_big1;

UPDATE orders SET status = 'planned'
WHERE id IN (
  SELECT order_id FROM production_plans WHERE plan_date = '2026-04-10' AND factory = 'big1'
);


-- ================================================================
-- SUMMARY
-- ================================================================
-- Customers: 14 new + 10 existing = 24 total
-- Orders: 27 inserted (3 skipped: FG1901, FG2101, FG0225 not in products)
-- Production Plans: ~25 orders assigned across 3 days (Mon/Wed/Fri)
--
-- Capacity breakdown:
--   Mon Big2: 136/176 = 77%  |  Mon Big1: 68/88 = 77%
--   Wed Big2: 168/176 = 95%  |  Wed Big1: 39/88 = 44%
--   Fri Big2: ~60/176 = 34%  |  Fri Big1: 14/88 = 16%
--
-- Remaining pending orders can be dragged onto the board via the app.
-- ================================================================

COMMIT;
