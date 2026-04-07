export interface Product {
  id: string;
  fg_code: string;
  name: string;
  category: string | null;
  flavor: string | null;
  flavor_code: string | null;
  batch_type: string | null;
  default_batch_kg: number;
  created_at: string;
}

export interface Sku {
  id: string;
  product_id: string;
  sku_code: string;
  size_g: number;
  qty_per_box: number;
  package_code: string;
  package_type: string | null;
  created_at: string;
}

export interface Ingredient {
  id: string;
  code: string;
  name: string | null;
  category: string | null;
  unit: string;
}

export interface RecipeBom {
  id: string;
  product_id: string;
  ingredient_id: string;
  weight_kg: number;
  yield_kg: number | null;
}

export interface Material {
  id: string;
  code: string;
  short_code: string | null;
  name: string;
  type: string | null;
  brand: string | null;
  size_g: number | null;
  boi_category: string | null;
}

export interface PackagingBom {
  id: string;
  sku_id: string;
  material_id: string;
  ratio_avg: number | null;
  ratio_min: number | null;
  ratio_max: number | null;
  sample_count: number | null;
  ratio_type: string;
  confidence: string | null;
}

export interface Customer {
  id: string;
  name: string;
  market: string | null;
  contact_channel: string | null;
  notes: string | null;
}

export type OrderStatus = 'pending' | 'planned' | 'producing' | 'done' | 'cancelled';
export type OrderSource = 'mint' | 'phone' | 'line' | 'stock_alert';
export type BoiLevelType = 'BOI4' | 'BOI5' | 'NON';

export interface Order {
  id: string;
  customer_id: string;
  sku_id: string;
  qty_batch: number;
  order_date: string;
  delivery_date: string | null;
  po_number: string | null;
  boi_level: BoiLevelType | null;
  requires_mcpd: boolean;
  priority: number;
  source: OrderSource | null;
  status: OrderStatus;
  remark: string | null;
  created_at: string;
  // Joined fields
  customer?: Customer;
  product?: Product;
}

export type PlanStatus = 'planned' | 'producing' | 'done' | 'cancelled';
export type FactoryType = 'big2' | 'big1';

export interface ProductionPlan {
  id: string;
  factory: FactoryType;
  plan_date: string;
  order_id: string;
  qty_batch: number;
  sort_order: number;
  status: PlanStatus;
  created_at: string;
  // Joined fields
  order?: Order;
}

export interface Lot {
  id: string;
  plan_id: string;
  lot_number: string;
  lot_date: string;
  weight_kg: number | null;
  batch_count: number | null;
  status: string;
}

export type ComplianceTaskType = 'mcpd' | 'coa' | 'barcode' | 'hc' | 'sticker';
export type ComplianceStatus = 'pending' | 'in_progress' | 'done';

export interface ComplianceTask {
  id: string;
  order_id: string;
  task_type: ComplianceTaskType;
  status: ComplianceStatus;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface BoiLine {
  id: string;
  factory: string;
  line_number: number;
  boi_level: string | null;
  annual_cap_tons: number;
  year: number;
}

export interface BoiAllocation {
  id: string;
  boi_line_id: string;
  lot_id: string;
  weight_kg: number;
  allocated_at: string;
}

// View types
export interface DailyCapacity {
  factory: FactoryType;
  plan_date: string;
  total_batch: number;
  max_batch: number;
  capacity_pct: number;
}

export interface BoiAnnualSummary {
  factory: string;
  line_number: number;
  boi_level: string | null;
  year: number;
  annual_cap_tons: number;
  used_tons: number;
  remaining_tons: number;
  used_pct: number;
}

// Extended ProductionPlan with tracking fields
export interface ProductionPlanTracking extends ProductionPlan {
  actual_start: string | null;
  actual_end: string | null;
  actual_batch: number | null;
  line_number: number | null;
}

// Board-specific types
export interface BoardPlan extends ProductionPlanTracking {
  order: Order & {
    customer: Customer;
    product: Product;
  };
}

// Inventory types
export type TransactionType = 'receive' | 'issue' | 'adjust' | 'transfer';

export interface InventoryTransaction {
  id: string;
  ingredient_id: string | null;
  material_id: string | null;
  transaction_type: TransactionType;
  quantity: number;
  unit: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  // Joined
  ingredient?: Ingredient;
}

export interface StockBalance {
  item_id: string;
  code: string;
  name: string | null;
  category: string | null;
  item_type: string;
  balance: number;
  unit: string;
}

export interface LotOutput {
  id: string;
  lot_id: string;
  sku_id: string | null;
  actual_weight_kg: number;
  pack_size_g: number;
  units_produced: number;
  units_per_box: number;
  boxes_produced: number;
  loose_units: number;
  yield_pct: number | null;
  qc_status: string;
  qc_notes: string | null;
  warehouse_status: string;
  received_at: string | null;
  created_at: string;
}

export interface FgInventory {
  id: string;
  lot_output_id: string | null;
  product_id: string;
  sku_id: string | null;
  lot_number: string;
  boxes: number;
  loose_units: number;
  weight_kg: number;
  location: string;
  status: string;
  expiry_date: string | null;
  created_at: string;
}
