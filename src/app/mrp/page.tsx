'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
} from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Package,
  Weight,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Printer,
  LoaderCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { FACTORIES, BATCH_KG, type FactoryKey } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface PlanRow {
  id: string;
  factory: string;
  plan_date: string;
  qty_batch: number;
  status: string;
  order: {
    id: string;
    product: {
      id: string;
      fg_code: string;
      name: string;
    };
  };
}

interface BomRow {
  id: string;
  product_id: string;
  weight_kg: number;
  yield_kg: number | null;
  ingredient: {
    id: string;
    code: string;
    name: string | null;
    category: string | null;
  };
}

interface StockRow {
  ingredient_id: string;
  balance_kg: number;
}

/** Aggregated requirement per ingredient */
interface GrossRequirement {
  ingredientId: string;
  code: string;
  name: string;
  category: string;
  totalKg: number;
  batchCount: number;
}

/** Extended with stock data */
interface NetRequirement extends GrossRequirement {
  stockKg: number | null; // null = no stock data
  netKg: number | null;
  status: 'enough' | 'need_purchase' | 'no_data';
}

// ------------------------------------------------------------------
// Helper: format number with commas
// ------------------------------------------------------------------

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ------------------------------------------------------------------
// Main Page
// ------------------------------------------------------------------

export default function MrpPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [factoryFilter, setFactoryFilter] = useState<'all' | FactoryKey>('all');

  const baseDate = useMemo(() => {
    let d = new Date();
    if (weekOffset > 0) d = addWeeks(d, weekOffset);
    if (weekOffset < 0) d = subWeeks(d, Math.abs(weekOffset));
    return d;
  }, [weekOffset]);

  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });

  const weekLabel = `${format(weekStart, 'd MMM', { locale: th })} - ${format(weekEnd, 'd MMM yy', { locale: th })}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Calculator className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">MRP — วางแผนวัตถุดิบ</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Factory filter */}
          <Select
            value={factoryFilter}
            onValueChange={(val) => setFactoryFilter(val as 'all' | FactoryKey)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="big2">Big 2</SelectItem>
              <SelectItem value="big1">Big 1</SelectItem>
            </SelectContent>
          </Select>

          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekOffset((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekOffset(0)}
              className="min-w-[160px] text-center"
            >
              {weekLabel}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekOffset((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-8">
        <MrpContent
          weekStart={weekStart}
          weekEnd={weekEnd}
          factoryFilter={factoryFilter}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// MRP Content (data fetching + rendering)
// ------------------------------------------------------------------

function MrpContent({
  weekStart,
  weekEnd,
  factoryFilter,
}: {
  weekStart: Date;
  weekEnd: Date;
  factoryFilter: 'all' | FactoryKey;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grossReqs, setGrossReqs] = useState<GrossRequirement[]>([]);
  const [netReqs, setNetReqs] = useState<NetRequirement[]>([]);
  const [hasStockData, setHasStockData] = useState(false);

  const startStr = format(weekStart, 'yyyy-MM-dd');
  const endStr = format(weekEnd, 'yyyy-MM-dd');

  const fetchMrp = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Step 1: Fetch production plans for the week (not cancelled)
      let plansQuery = supabase
        .from('production_plans')
        .select(`
          id,
          factory,
          plan_date,
          qty_batch,
          status,
          order:orders(
            id,
            product:products(id, fg_code, name)
          )
        `)
        .gte('plan_date', startStr)
        .lte('plan_date', endStr)
        .neq('status', 'cancelled');

      if (factoryFilter !== 'all') {
        plansQuery = plansQuery.eq('factory', factoryFilter);
      }

      const { data: plansData, error: plansErr } = await plansQuery;
      if (plansErr) throw plansErr;

      const plans = (plansData as unknown as PlanRow[]) || [];

      // Collect unique product IDs with their total batch counts
      const productBatches = new Map<string, { productId: string; fgCode: string; totalBatch: number }>();
      for (const plan of plans) {
        const product = plan.order?.product;
        if (!product) continue;
        const existing = productBatches.get(product.id);
        if (existing) {
          existing.totalBatch += plan.qty_batch;
        } else {
          productBatches.set(product.id, {
            productId: product.id,
            fgCode: product.fg_code,
            totalBatch: plan.qty_batch,
          });
        }
      }

      const productIds = Array.from(productBatches.keys());

      if (productIds.length === 0) {
        setGrossReqs([]);
        setNetReqs([]);
        setHasStockData(false);
        setLoading(false);
        return;
      }

      // Step 2: Fetch recipe_bom for those products
      const { data: bomData, error: bomErr } = await supabase
        .from('recipe_bom')
        .select(`
          id,
          product_id,
          weight_kg,
          yield_kg,
          ingredient:ingredients(id, code, name, category)
        `)
        .in('product_id', productIds);

      if (bomErr) throw bomErr;

      const boms = (bomData as unknown as BomRow[]) || [];

      // Aggregate gross requirements per ingredient
      const ingredientMap = new Map<
        string,
        { code: string; name: string; category: string; totalKg: number; batchCount: number }
      >();

      for (const bom of boms) {
        const ingredient = bom.ingredient;
        if (!ingredient) continue;

        const productInfo = productBatches.get(bom.product_id);
        if (!productInfo) continue;

        const kgNeeded = bom.weight_kg * productInfo.totalBatch;
        const existing = ingredientMap.get(ingredient.id);

        if (existing) {
          existing.totalKg += kgNeeded;
          existing.batchCount += productInfo.totalBatch;
        } else {
          ingredientMap.set(ingredient.id, {
            code: ingredient.code,
            name: ingredient.name || '-',
            category: ingredient.category || '-',
            totalKg: kgNeeded,
            batchCount: productInfo.totalBatch,
          });
        }
      }

      // Build sorted gross requirements
      const gross: GrossRequirement[] = Array.from(ingredientMap.entries())
        .map(([id, data]) => ({
          ingredientId: id,
          ...data,
        }))
        .sort((a, b) => b.totalKg - a.totalKg);

      setGrossReqs(gross);

      // Step 3: Try to fetch stock balance (may not exist)
      let stockMap = new Map<string, number>();
      let stockAvailable = false;

      try {
        // Try the stock_balance view first
        const ingredientIds = gross.map((g) => g.ingredientId);
        const { data: stockData, error: stockErr } = await supabase
          .from('stock_balance')
          .select('ingredient_id, balance_kg')
          .in('ingredient_id', ingredientIds);

        if (!stockErr && stockData) {
          stockAvailable = true;
          for (const row of stockData as StockRow[]) {
            stockMap.set(row.ingredient_id, row.balance_kg);
          }
        }
      } catch {
        // stock_balance view doesn't exist, that's fine
        stockAvailable = false;
      }

      setHasStockData(stockAvailable);

      // Build net requirements
      const net: NetRequirement[] = gross.map((g) => {
        const stockKg = stockAvailable ? (stockMap.get(g.ingredientId) ?? 0) : null;
        const netKg = stockKg !== null ? Math.max(0, g.totalKg - stockKg) : null;
        let status: NetRequirement['status'] = 'no_data';
        if (stockKg !== null) {
          status = netKg! > 0 ? 'need_purchase' : 'enough';
        }
        return { ...g, stockKg, netKg, status };
      });

      setNetReqs(net);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'โหลดข้อมูล MRP ไม่สำเร็จ'
      );
    } finally {
      setLoading(false);
    }
  }, [startStr, endStr, factoryFilter]);

  useEffect(() => {
    fetchMrp();
  }, [fetchMrp]);

  // Derived stats
  const stats = useMemo(() => {
    const totalItems = netReqs.length;
    const totalKg = netReqs.reduce((sum, r) => sum + r.totalKg, 0);
    const needPurchase = netReqs.filter((r) => r.status === 'need_purchase').length;
    const enoughItems = netReqs.filter((r) => r.status === 'enough').length;
    const readyPct = hasStockData && totalItems > 0
      ? Math.round((enoughItems / totalItems) * 100)
      : null;
    return { totalItems, totalKg, needPurchase, readyPct };
  }, [netReqs, hasStockData]);

  const purchaseItems = useMemo(
    () => netReqs.filter((r) => r.status === 'need_purchase').sort((a, b) => (b.netKg ?? 0) - (a.netKg ?? 0)),
    [netReqs]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <LoaderCircle className="h-5 w-5 animate-spin" />
        กำลังคำนวณ MRP...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
        <AlertTriangle className="inline h-4 w-4 mr-1" />
        {error}
      </div>
    );
  }

  if (grossReqs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <Calculator className="h-10 w-10 opacity-40" />
        <p className="text-base">ไม่มีแผนผลิตในสัปดาห์นี้</p>
        <p className="text-sm">เลือกสัปดาห์ที่มีแผนผลิตเพื่อดูความต้องการวัตถุดิบ</p>
      </div>
    );
  }

  return (
    <>
      {/* Summary Cards */}
      <SummaryCards stats={stats} hasStockData={hasStockData} />

      {/* Gross Requirements Table */}
      <GrossRequirementsSection reqs={netReqs} hasStockData={hasStockData} />

      {/* Purchase Suggestion (only if stock data exists and some items need purchase) */}
      {hasStockData && purchaseItems.length > 0 && (
        <PurchaseSuggestionSection items={purchaseItems} />
      )}
    </>
  );
}

// ------------------------------------------------------------------
// Summary Cards
// ------------------------------------------------------------------

function SummaryCards({
  stats,
  hasStockData,
}: {
  stats: {
    totalItems: number;
    totalKg: number;
    needPurchase: number;
    readyPct: number | null;
  };
  hasStockData: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card size="sm">
        <CardContent className="pt-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">วัตถุดิบที่ต้องใช้</p>
              <p className="text-lg font-bold">{stats.totalItems} <span className="text-sm font-normal text-muted-foreground">รายการ</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="pt-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Weight className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">น้ำหนักรวม</p>
              <p className="text-lg font-bold">{fmtNum(stats.totalKg / 1000, 2)} <span className="text-sm font-normal text-muted-foreground">ตัน</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="pt-3">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-lg p-2', hasStockData && stats.needPurchase > 0 ? 'bg-red-100' : 'bg-gray-100')}>
              <ShoppingCart className={cn('h-4 w-4', hasStockData && stats.needPurchase > 0 ? 'text-red-600' : 'text-gray-500')} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ต้องจัดซื้อ</p>
              {hasStockData ? (
                <p className="text-lg font-bold">
                  {stats.needPurchase} <span className="text-sm font-normal text-muted-foreground">รายการ</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">ไม่มีข้อมูล stock</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="pt-3">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-lg p-2', stats.readyPct !== null && stats.readyPct >= 80 ? 'bg-green-100' : stats.readyPct !== null ? 'bg-yellow-100' : 'bg-gray-100')}>
              <CheckCircle2 className={cn('h-4 w-4', stats.readyPct !== null && stats.readyPct >= 80 ? 'text-green-600' : stats.readyPct !== null ? 'text-yellow-600' : 'text-gray-500')} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">พร้อมผลิต</p>
              {stats.readyPct !== null ? (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold">{stats.readyPct}%</p>
                  <div className="h-2 w-16 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        stats.readyPct >= 80
                          ? 'bg-green-500'
                          : stats.readyPct >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      )}
                      style={{ width: `${stats.readyPct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">ไม่มีข้อมูล stock</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------
// Gross Requirements Table
// ------------------------------------------------------------------

function GrossRequirementsSection({
  reqs,
  hasStockData,
}: {
  reqs: NetRequirement[];
  hasStockData: boolean;
}) {
  const totalKg = reqs.reduce((sum, r) => sum + r.totalKg, 0);

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">ความต้องการวัตถุดิบ</h2>
        <Badge variant="secondary" className="text-xs">
          {reqs.length} รายการ
        </Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>รหัส R-code</TableHead>
                <TableHead>ชื่อวัตถุดิบ</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead className="text-right">ต้องใช้ (kg)</TableHead>
                <TableHead className="text-center">จำนวน batch</TableHead>
                {hasStockData && (
                  <>
                    <TableHead className="text-right">คงเหลือ (kg)</TableHead>
                    <TableHead className="text-right">ต้องซื้อ (kg)</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reqs.map((req, index) => (
                <TableRow key={req.ingredientId}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-mono text-xs font-medium">{req.code}</TableCell>
                  <TableCell>{req.name}</TableCell>
                  <TableCell>
                    <CategoryBadge category={req.category} />
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(req.totalKg)}</TableCell>
                  <TableCell className="text-center">{req.batchCount}</TableCell>
                  {hasStockData && (
                    <>
                      <TableCell className="text-right font-mono">
                        {req.stockKg !== null ? fmtNum(req.stockKg) : '-'}
                      </TableCell>
                      <TableCell className={cn('text-right font-mono', req.status === 'need_purchase' && 'text-red-600 font-medium')}>
                        {req.netKg !== null ? fmtNum(req.netKg) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <StockStatusBadge status={req.status} />
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-medium">รวมทั้งหมด</TableCell>
                <TableCell className="text-right font-mono font-medium">{fmtNum(totalKg)}</TableCell>
                <TableCell />
                {hasStockData && (
                  <>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                  </>
                )}
              </TableRow>
            </TableFooter>
          </Table>

          {!hasStockData && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-gray-400" />
              ไม่มีข้อมูล stock — แสดงเฉพาะ Gross Requirements (ไม่สามารถคำนวณ Net ได้)
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// ------------------------------------------------------------------
// Purchase Suggestion Table
// ------------------------------------------------------------------

function PurchaseSuggestionSection({ items }: { items: NetRequirement[] }) {
  const totalPurchase = items.reduce((sum, r) => sum + (r.netKg ?? 0), 0);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">รายการจัดซื้อ</h2>
          <Badge variant="destructive" className="text-xs">
            {items.length} รายการ
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="print:hidden"
        >
          <Printer className="h-4 w-4 mr-1" />
          พิมพ์ใบสั่งซื้อ
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อวัตถุดิบ</TableHead>
                <TableHead className="text-right">ต้องการ (kg)</TableHead>
                <TableHead className="text-right">คงเหลือ (kg)</TableHead>
                <TableHead className="text-right">ต้องซื้อ (kg)</TableHead>
                <TableHead>หมวดหมู่</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.ingredientId}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-mono text-xs font-medium">{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(item.totalKg)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(item.stockKg ?? 0)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600 font-medium">{fmtNum(item.netKg ?? 0)}</TableCell>
                  <TableCell>
                    <CategoryBadge category={item.category} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-medium">รวมต้องซื้อ</TableCell>
                <TableCell className="text-right font-mono font-medium text-red-600">{fmtNum(totalPurchase)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

// ------------------------------------------------------------------
// Shared mini-components
// ------------------------------------------------------------------

function StockStatusBadge({ status }: { status: NetRequirement['status'] }) {
  switch (status) {
    case 'enough':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-300"
        >
          พอ
        </Badge>
      );
    case 'need_purchase':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-300"
        >
          ต้องสั่ง
        </Badge>
      );
    default:
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500 border-gray-300"
        >
          ไม่มี stock data
        </Badge>
      );
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  surimi: 'bg-blue-50 text-blue-700',
  seasoning: 'bg-orange-50 text-orange-700',
  additive: 'bg-purple-50 text-purple-700',
  starch: 'bg-yellow-50 text-yellow-700',
  oil: 'bg-amber-50 text-amber-700',
  preservative: 'bg-pink-50 text-pink-700',
  water: 'bg-cyan-50 text-cyan-700',
};

function CategoryBadge({ category }: { category: string }) {
  const colorCls = CATEGORY_COLORS[category.toLowerCase()] || 'bg-gray-50 text-gray-600';
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', colorCls)}>
      {category}
    </span>
  );
}
