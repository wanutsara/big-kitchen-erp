-- Big Kitchen — Phase 10: Inventory Management
-- ================================================================

-- Inventory transactions log
CREATE TABLE inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid REFERENCES ingredients(id),
  material_id uuid REFERENCES materials(id),
  transaction_type text NOT NULL CHECK (transaction_type IN ('receive', 'issue', 'adjust', 'transfer')),
  quantity numeric NOT NULL,
  unit text DEFAULT 'kg',
  reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by text
);

-- Current stock view (derived from transactions)
CREATE VIEW stock_balance AS
SELECT
  i.id AS item_id,
  i.code,
  i.name,
  i.category,
  'ingredient' AS item_type,
  COALESCE(SUM(
    CASE WHEN t.transaction_type IN ('receive', 'adjust') THEN t.quantity
         ELSE -t.quantity
    END
  ), 0) AS balance,
  i.unit
FROM ingredients i
LEFT JOIN inventory_transactions t ON t.ingredient_id = i.id
GROUP BY i.id, i.code, i.name, i.category, i.unit;

-- Indexes
CREATE INDEX idx_inv_txn_ingredient ON inventory_transactions(ingredient_id);
CREATE INDEX idx_inv_txn_material ON inventory_transactions(material_id);
CREATE INDEX idx_inv_txn_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inv_txn_created ON inventory_transactions(created_at DESC);

-- RLS
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON inventory_transactions FOR ALL USING (true) WITH CHECK (true);

-- Seed initial stock from Marketing App data (R-codes with known quantities)
INSERT INTO inventory_transactions (ingredient_id, transaction_type, quantity, unit, reference, notes)
SELECT i.id, 'receive', v.stock_kg, 'kg', 'Initial stock from Marketing App', 'Import ' || to_char(now(), 'YYYY-MM-DD')
FROM (VALUES
  ('R201',  17000),
  ('R203',  23400),
  ('R206',  350),
  ('R207A', 3475),
  ('R208A', 32400),
  ('R209A', 4500),
  ('R213',  3040),
  ('R301A', 1160),
  ('R302-2', 35),
  ('R306A', 952),
  ('R306B', 1020),
  ('R308A', 120),
  ('R401A', 2780),
  ('R413',  1500),
  ('R416A', 3675),
  ('R501',  5780),
  ('R502-1', 2600),
  ('R503A', 800),
  ('R504',  14300),
  ('R506',  150),
  ('R509',  500),
  ('R510A', 150),
  ('R519',  30),
  ('R701',  100),
  ('R823A', 3200),
  ('R906',  200),
  ('R001',  5000)
) AS v(code, stock_kg)
JOIN ingredients i ON i.code = v.code;
