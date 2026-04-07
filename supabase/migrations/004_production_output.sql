-- Lot outputs (actual production results per lot)
CREATE TABLE lot_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid REFERENCES lots(id) ON DELETE CASCADE,
  sku_id uuid REFERENCES skus(id),
  actual_weight_kg numeric NOT NULL,
  pack_size_g integer NOT NULL,
  units_produced integer NOT NULL,
  units_per_box integer NOT NULL DEFAULT 1,
  boxes_produced integer NOT NULL,
  loose_units integer DEFAULT 0,
  yield_pct numeric,
  qc_status text DEFAULT 'passed' CHECK (qc_status IN ('passed','failed','pending','hold')),
  qc_notes text,
  warehouse_status text DEFAULT 'pending' CHECK (warehouse_status IN ('pending','received','rejected')),
  received_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Finished goods inventory
CREATE TABLE fg_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_output_id uuid REFERENCES lot_outputs(id),
  product_id uuid REFERENCES products(id),
  sku_id uuid REFERENCES skus(id),
  lot_number text NOT NULL,
  boxes integer NOT NULL,
  loose_units integer DEFAULT 0,
  weight_kg numeric NOT NULL,
  location text DEFAULT 'warehouse',
  status text DEFAULT 'in_stock' CHECK (status IN ('in_stock','reserved','shipped','returned')),
  expiry_date date,
  created_at timestamptz DEFAULT now()
);

-- Summary view
CREATE VIEW fg_stock_summary AS
SELECT p.id as product_id, p.fg_code, p.name, p.category,
  COALESCE(SUM(fi.boxes), 0) as total_boxes,
  COALESCE(SUM(fi.loose_units), 0) as total_loose,
  COALESCE(SUM(fi.weight_kg), 0) as total_weight_kg,
  COUNT(DISTINCT fi.lot_number) as lot_count
FROM fg_inventory fi
JOIN products p ON p.id = fi.product_id
WHERE fi.status = 'in_stock'
GROUP BY p.id, p.fg_code, p.name, p.category;

-- RLS
ALTER TABLE lot_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fg_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON lot_outputs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON fg_inventory FOR ALL USING (true) WITH CHECK (true);

-- Update lots table
ALTER TABLE lots ADD COLUMN IF NOT EXISTS qc_status text DEFAULT 'pending';
