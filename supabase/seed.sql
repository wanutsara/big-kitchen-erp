-- Big Kitchen Seed Data
-- ================================================================

-- Products (top 30 FG codes)
-- ----------------------------------------------------------------
insert into products (fg_code, name, category, flavor, flavor_code, batch_type, default_batch_kg) values
  ('FG0218', 'ปลาเส้น BBQ 5kg', 'ปลาเส้น', 'BBQ', '02', 'B5', 75),
  ('FG0901', 'สปูอัด ปูอัด 80g', 'สปูอัด', 'ปูอัด', '09', 'B5', 75),
  ('FG0202', 'ปลาเส้น BBQ 80g', 'ปลาเส้น', 'BBQ', '02', 'B5', 75),
  ('FG0305', 'ปลาเส้น ซุปเปอร์แซ่บ', 'ปลาเส้น', 'ซุปเปอร์แซ่บ', '03', 'By', 75),
  ('FG2201', 'ปลาเส้น ส่งออก TU', 'ปลาเส้น', 'BBQ', '22', 'By', 75),
  ('FG0101', 'ปลาเส้น รสเข้มข้น 80g', 'ปลาเส้น', 'รสเข้มข้น', '01', 'B5', 75),
  ('FG0102', 'ปลาเส้น รสเข้มข้น 72g', 'ปลาเส้น', 'รสเข้มข้น', '01', 'B5', 75),
  ('FG0204', 'ปลาเส้น BBQ By', 'ปลาเส้น', 'BBQ', '02', 'By', 75),
  ('FG0605', 'ปลาเส้น ดั้งเดิม 5kg', 'ปลาเส้น', 'ดั้งเดิม', '06', 'By', 75),
  ('FG0902', 'สปูอัด ปูอัด By', 'สปูอัด', 'ปูอัด', '09', 'By', 75),
  ('FG0904', 'สปูอัด เม็ดเปิด', 'สปูอัด', 'ปูอัด', '09', 'By', 75),
  ('FG0802', 'ปลาเส้น ไก่ย่าง 80g', 'ปลาเส้น', 'ไก่ย่าง', '08', 'By', 75),
  ('FG0908', 'สปูอัด ปูอัด By-2', 'สปูอัด', 'ปูอัด', '09', 'By', 75),
  ('FG0301', 'ปลาเส้น ซุปเปอร์แซ่บ 80g', 'ปลาเส้น', 'ซุปเปอร์แซ่บ', '03', 'By', 75),
  ('FG0228', 'ปลาเส้น BBQ B5-2', 'ปลาเส้น', 'BBQ', '02', 'B5', 75),
  ('FG0235', 'ปลาเส้น BBQ ส่งออก', 'ปลาเส้น', 'BBQ', '02', 'By', 75),
  ('SS0101', 'แผ่นทรงเครื่อง', 'แผ่น', 'รสเข้มข้น', '01', 'CN', 75),
  ('FG1102', 'พิซซ่า สอดไส้ซีส', 'สอดไส้', 'พิซซ่า/sausage', '11', 'B3', 75),
  ('FG1004', 'สอดไส้ N', 'สอดไส้', 'พิซซ่า/sausage', '10', 'N', 75),
  ('FG0404', 'ปลาเส้น ปลาหมึก B5', 'ปลาเส้น', 'ปลาหมึก', '04', 'B5', 75),
  ('FG0803', 'ปลาเส้น ไก่ย่าง By', 'ปลาเส้น', 'ไก่ย่าง', '08', 'By', 75),
  ('FG0234', 'ปลาเส้น BBQ กล่อง', 'ปลาเส้น', 'BBQ', '02', 'B5', 75),
  ('FG2901', 'สาหร่าย By', 'สาหร่าย', 'สาหร่าย', '29', 'By', 75),
  ('FG0405', 'ปลาเส้น ปลาหมึก By', 'ปลาเส้น', 'ปลาหมึก', '04', 'By', 75),
  ('FG0104', 'ปลาเส้น รสเข้มข้น By', 'ปลาเส้น', 'รสเข้มข้น', '01', 'By', 75),
  ('FG0108', 'ปลาเส้น รสเข้มข้น By-2', 'ปลาเส้น', 'รสเข้มข้น', '01', 'By', 75),
  ('FG0914', 'สปูอัด ปูอัด By-3', 'สปูอัด', 'ปูอัด', '09', 'By', 75),
  ('FG0804', 'ปลาเส้น ไก่ย่าง By-2', 'ปลาเส้น', 'ไก่ย่าง', '08', 'By', 75),
  ('FG0215', 'ปลาเส้น BBQ By-2', 'ปลาเส้น', 'BBQ', '02', 'By', 75),
  ('FG2302', 'ปลาเส้น BBQ By-3', 'ปลาเส้น', 'BBQ', '23', 'By', 75);

-- Customers
-- ----------------------------------------------------------------
insert into customers (name, market, contact_channel, notes) values
  ('TU (ไทยยูเนี่ยน)', 'export', 'mint', 'ลูกค้าส่งออกหลัก'),
  ('Dr.Tus', 'domestic', 'mint', null),
  ('Nalwant', 'export', 'mint', null),
  ('AP.HOME', 'domestic', 'phone', null),
  ('คาสมุทร', 'domestic', 'phone', null),
  ('แมคโคร', 'domestic', 'mint', 'Modern trade'),
  ('สีะฮวด', 'domestic', 'line', 'ยี่ปั๊ว'),
  ('มาลินี', 'domestic', 'line', 'ยี่ปั๊ว'),
  ('King Power', 'duty_free', 'mint', 'Duty Free'),
  ('Sinwon', 'export', 'mint', 'เกาหลี');

-- Materials (packaging)
-- ----------------------------------------------------------------
insert into materials (code, short_code, name, type, boi_category) values
  ('FP02-80-F-01', '80-Fxx01', 'ฟิล์ม 80g แบบ 01', 'film', 'imported'),
  ('FP02-72-F-18', '72-Fxx18', 'ฟิล์ม 72g แบบ 18', 'film', 'imported'),
  ('FP03-60-F-53', '60-Fxx53', 'ฟิล์ม 60g แบบ 53', 'film', 'imported'),
  ('FP03-35-F-53', '35-Fxx53', 'ฟิล์ม 35g แบบ 53', 'film', 'imported'),
  ('FP06-70-F-16', '70-Fxx16', 'ฟิล์ม 70g แบบ 16', 'film', 'imported'),
  ('FP06-70-F-16E', '70-Fxx16E', 'ฟิล์ม 70g แบบ 16E', 'film', 'imported'),
  ('FP06-70-F-16S', '70-Fxx16S', 'ฟิล์ม 70g แบบ 16S', 'film', 'imported'),
  ('FP22-600x15-F-69', '600x15-Fxx69', 'ฟิล์ม 600x15 แบบ 69', 'film', 'imported'),
  ('FP09-5000x2-PTS', '5000x2-PTS-00', 'ถุง PTS 5kg x2', 'bag', 'domestic'),
  ('FP02-5000-F40', '5000-F40-00', 'ฟิล์ม 5kg F40', 'film', 'imported'),
  ('FP02-5000-F40-23', '5000-F40-23', 'ฟิล์ม 5kg F40-23', 'film', 'imported'),
  ('FP02-5000-F40-47', '5000-Fxx47', 'ฟิล์ม 5kg Fxx47', 'film', 'imported'),
  ('FP02-5000-F45', '5000-Fxx45', 'ฟิล์ม 5kg Fxx45', 'film', 'imported'),
  ('FP09-5000-F00', '5000-Fxx00', 'ฟิล์ม 5kg Fxx00', 'film', 'imported'),
  ('FP09-5000-F01', '5000-Fxx01', 'ฟิล์ม 5kg Fxx01', 'film', 'imported'),
  ('FP09-5000-F25-16', '5000-F25-16', 'ฟิล์ม 5kg F25-16', 'film', 'imported'),
  ('FP01-170L-03', '170L-03', 'ถ้วย 170ml แบบ 03', 'cup', 'domestic'),
  ('FP01-380L-03', '380L-03', 'ถ้วย 380ml แบบ 03', 'cup', 'domestic'),
  ('FP01-150L-18', '150L-18', 'ถ้วย 150ml แบบ 18', 'cup', 'domestic'),
  ('FP06-5000-D03', '5000-D03-001', 'กล่อง 5kg D03', 'box', 'domestic'),
  ('FP06-5000-D10', '5000-D10-001', 'กล่อง 5kg D10', 'box', 'domestic'),
  ('FP06-21x48-D16', '21x48-Dxx16', 'กล่อง 21x48 Dxx16', 'box', 'domestic'),
  ('FP06-45x36-D16', '45x36-Dxx16', 'กล่อง 45x36 Dxx16', 'box', 'domestic'),
  ('FP09-5000x4-F00D', '5000x4-Fxx00D', 'ฟิล์ม 5kgx4 Fxx00D', 'film', 'imported'),
  ('FP22-80x45-F73', '80x45-Fxx73', 'ฟิล์ม 80x45 Fxx73', 'film', 'imported'),
  ('FP22-500x10-F73', '500x10-Fxx73', 'ฟิล์ม 500x10 Fxx73', 'film', 'imported'),
  ('FP03-35x36-F53', '35x36-Fxx53', 'ฟิล์ม 35x36 Fxx53', 'film', 'imported'),
  ('FP03-18x72-D53', '18x72-Dxx53', 'กล่อง 18x72 Dxx53', 'box', 'domestic'),
  ('FP03-18x36-D27', '18x36-Dxx27', 'กล่อง 18x36 Dxx27', 'box', 'domestic');

-- BOI Lines (Big2: 8 lines, Big1: 4 lines) — year 2568
-- ----------------------------------------------------------------
insert into boi_lines (factory, line_number, boi_level, annual_cap_tons, year) values
  ('big2', 1, 'BOI4', 1544, 2568),
  ('big2', 2, 'BOI4', 1544, 2568),
  ('big2', 3, 'BOI4', 1544, 2568),
  ('big2', 4, 'BOI4', 1544, 2568),
  ('big2', 5, 'BOI5', 1544, 2568),
  ('big2', 6, 'BOI5', 1544, 2568),
  ('big2', 7, 'BOI5', 1544, 2568),
  ('big2', 8, 'BOI5', 1544, 2568),
  ('big1', 1, 'BOI4', 1544, 2568),
  ('big1', 2, 'BOI4', 1544, 2568),
  ('big1', 3, 'BOI5', 1544, 2568),
  ('big1', 4, 'BOI5', 1544, 2568);

-- Sample Orders (15 orders, mixed BOI/priority/source)
-- Using current week dates for demo
-- ----------------------------------------------------------------
insert into orders (customer_id, product_id, qty_batch, order_date, delivery_date, po_number, boi_level, requires_mcpd, priority, source, status, remark)
select
  c.id, p.id, o.qty_batch, o.order_date::date, o.delivery_date::date, o.po_number, o.boi_level, o.requires_mcpd, o.priority, o.source, o.status, o.remark
from (values
  ('TU (ไทยยูเนี่ยน)', 'FG2201', 12, '2025-04-01', '2025-04-10', 'PO-TU-001', 'BOI4', true,  1, 'mint', 'planned', 'ส่งออก TU lot เม.ย.'),
  ('TU (ไทยยูเนี่ยน)', 'FG0235', 8,  '2025-04-01', '2025-04-10', 'PO-TU-002', 'BOI4', true,  1, 'mint', 'planned', 'ส่งออก BBQ'),
  ('Nalwant',          'FG0218', 10, '2025-04-02', '2025-04-12', 'PO-NW-001', 'BOI5', true,  1, 'mint', 'planned', null),
  ('แมคโคร',           'FG0202', 15, '2025-04-02', '2025-04-08', null,        'NON',  false, 4, 'mint', 'planned', null),
  ('แมคโคร',           'FG0901', 10, '2025-04-02', '2025-04-08', null,        'NON',  false, 4, 'mint', 'planned', null),
  ('Dr.Tus',           'FG0101', 8,  '2025-04-03', '2025-04-09', 'PO-DT-001', 'BOI4', false, 4, 'mint', 'planned', null),
  ('สีะฮวด',            'FG0305', 5,  '2025-04-03', '2025-04-07', null,        'NON',  false, 3, 'phone', 'planned', 'ด่วน'),
  ('AP.HOME',          'FG0802', 6,  '2025-04-03', '2025-04-09', null,        'BOI5', false, 4, 'phone', 'planned', null),
  ('King Power',       'FG0904', 4,  '2025-04-03', '2025-04-11', 'PO-KP-001', 'BOI4', false, 4, 'mint', 'pending', null),
  ('มาลินี',            'FG0102', 6,  '2025-04-04', '2025-04-10', null,        'NON',  false, 4, 'line', 'pending', null),
  ('Sinwon',           'FG0218', 8,  '2025-04-04', '2025-04-14', 'PO-SW-001', 'BOI5', true,  1, 'mint', 'pending', 'เกาหลี MCPD'),
  ('คาสมุทร',           'FG0605', 3,  '2025-04-04', '2025-04-08', null,        'NON',  false, 2, 'stock_alert', 'pending', 'stock ต่ำ'),
  ('แมคโคร',           'FG0404', 5,  '2025-04-04', '2025-04-09', null,        'NON',  false, 4, 'mint', 'pending', null),
  ('Dr.Tus',           'FG1102', 3,  '2025-04-05', '2025-04-11', 'PO-DT-002', 'BOI4', false, 4, 'mint', 'pending', null),
  ('สีะฮวด',            'FG0301', 4,  '2025-04-05', '2025-04-08', null,        'NON',  false, 3, 'phone', 'pending', 'ยี่ปั๊วด่วน')
) as o(customer_name, fg_code, qty_batch, order_date, delivery_date, po_number, boi_level, requires_mcpd, priority, source, status, remark)
join customers c on c.name = o.customer_name
join products p on p.fg_code = o.fg_code;

-- Sample Production Plans (placed orders → board)
-- ----------------------------------------------------------------
-- Big 2: 5 days of plans
insert into production_plans (factory, plan_date, order_id, qty_batch, sort_order, status)
select 'big2', pp.plan_date::date, o.id, pp.qty_batch, pp.sort_order, 'planned'
from (values
  -- วันจันทร์
  ('2025-04-07', 'FG2201', 'TU (ไทยยูเนี่ยน)', 12, 1),
  ('2025-04-07', 'FG0202', 'แมคโคร',            15, 2),
  ('2025-04-07', 'FG0218', 'Nalwant',           10, 3),
  -- วันอังคาร
  ('2025-04-08', 'FG0235', 'TU (ไทยยูเนี่ยน)',  8,  1),
  ('2025-04-08', 'FG0901', 'แมคโคร',            10, 2),
  ('2025-04-08', 'FG0305', 'สีะฮวด',             5,  3),
  -- วันพุธ
  ('2025-04-09', 'FG0101', 'Dr.Tus',            8,  1),
  ('2025-04-09', 'FG0802', 'AP.HOME',           6,  2)
) as pp(plan_date, fg_code, customer_name, qty_batch, sort_order)
join orders o on o.product_id = (select id from products where fg_code = pp.fg_code limit 1)
  and o.customer_id = (select id from customers where name = pp.customer_name limit 1);

-- Big 1: 3 days of plans
insert into production_plans (factory, plan_date, order_id, qty_batch, sort_order, status)
select 'big1', pp.plan_date::date, o.id, pp.qty_batch, pp.sort_order, 'planned'
from (values
  ('2025-04-07', 'FG0202', 'แมคโคร', 8, 1),
  ('2025-04-08', 'FG0101', 'Dr.Tus', 5, 1),
  ('2025-04-09', 'FG0305', 'สีะฮวด', 3, 1)
) as pp(plan_date, fg_code, customer_name, qty_batch, sort_order)
join orders o on o.product_id = (select id from products where fg_code = pp.fg_code limit 1)
  and o.customer_id = (select id from customers where name = pp.customer_name limit 1);
