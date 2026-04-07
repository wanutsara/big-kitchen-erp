'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { BOM_RATIOS, FLAVORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  FlaskConical,
  Package,
  Box,
  ChevronDown,
  X,
  LoaderCircle,
  ClipboardList,
  Beaker,
} from 'lucide-react';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface ProductRow {
  id: string;
  fg_code: string;
  name: string;
  category: string | null;
  flavor: string | null;
  flavor_code: string | null;
  batch_type: string | null;
}

interface RecipeBomRow {
  id: string;
  weight_kg: number;
  yield_kg: number | null;
  ingredient: {
    code: string;
    name: string | null;
    category: string | null;
  };
}

interface SkuRow {
  id: string;
  sku_code: string;
  size_g: number;
  qty_per_box: number;
  package_code: string;
  package_type: string | null;
}

interface PackagingBomRow {
  id: string;
  sku_id: string;
  ratio_avg: number | null;
  ratio_min: number | null;
  ratio_max: number | null;
  sample_count: number | null;
  ratio_type: string;
  material: {
    code: string;
    short_code: string | null;
    name: string;
    type: string | null;
  };
}

interface FallbackRow {
  key: string;
  materialCode: string;
  avg: number;
  min: number;
  max: number;
  n: number;
  stable: boolean;
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const INGREDIENT_CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  surimi:       { label: 'surimi',       color: 'bg-blue-100 text-blue-700 border-blue-300' },
  seasoning:    { label: 'seasoning',    color: 'bg-amber-100 text-amber-700 border-amber-300' },
  additive:     { label: 'additive',     color: 'bg-gray-100 text-gray-700 border-gray-300' },
  starch:       { label: 'starch',       color: 'bg-purple-100 text-purple-700 border-purple-300' },
  oil:          { label: 'oil',          color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  spice:        { label: 'spice',        color: 'bg-green-100 text-green-700 border-green-300' },
  preservative: { label: 'preservative', color: 'bg-red-100 text-red-700 border-red-300' },
  water:        { label: 'water',        color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
};

function getIngredientCategory(code: string, dbCategory: string | null): string {
  if (dbCategory) return dbCategory;
  const prefix = code.substring(0, 2).toUpperCase();
  if (prefix === 'R1') return 'surimi';
  if (prefix === 'R2') return 'seasoning';
  if (prefix === 'R3') return 'additive';
  if (prefix === 'R5') return 'starch';
  if (prefix === 'R8') return 'oil';
  return 'other';
}

function getConfidenceBadge(n: number) {
  if (n >= 20) return { label: `n=${n}`, color: 'bg-green-100 text-green-700 border-green-300' };
  if (n >= 10) return { label: `n=${n}`, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
  return { label: `n=${n}`, color: 'bg-red-100 text-red-700 border-red-300' };
}

// ------------------------------------------------------------------
// Product Search Combobox
// ------------------------------------------------------------------

function ProductSearch({
  products,
  selectedId,
  onSelect,
}: {
  products: ProductRow[];
  selectedId: string | null;
  onSelect: (product: ProductRow | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.fg_code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.flavor && p.flavor.toLowerCase().includes(q))
    );
  }, [products, query]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId) ?? null,
    [products, selectedId]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = useCallback(
    (product: ProductRow) => {
      onSelect(product);
      setQuery('');
      setOpen(false);
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    onSelect(null);
    setQuery('');
    inputRef.current?.focus();
  }, [onSelect]);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        {selectedProduct && !open ? (
          <button
            type="button"
            className="flex items-center gap-2 w-full h-9 rounded-lg border border-input bg-transparent px-9 py-1 text-sm cursor-text hover:border-ring transition-colors text-left"
            onClick={() => {
              setOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            <span className="font-mono font-medium">{selectedProduct.fg_code}</span>
            <span className="text-muted-foreground truncate">{selectedProduct.name}</span>
          </button>
        ) : (
          <Input
            ref={inputRef}
            placeholder="ค้นหารหัส FG หรือชื่อสินค้า..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="pl-9 pr-9 h-9"
          />
        )}
        {selectedProduct && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {!selectedProduct && (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-sm text-center text-muted-foreground">
              ไม่พบสินค้า
            </div>
          ) : (
            filtered.slice(0, 50).map((p) => {
              const flavorCode = p.flavor_code as keyof typeof FLAVORS | undefined;
              const flavorLabel = flavorCode ? FLAVORS[flavorCode] : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors',
                    selectedId === p.id && 'bg-accent'
                  )}
                  onClick={() => handleSelect(p)}
                >
                  <span className="font-mono font-medium shrink-0 w-16">{p.fg_code}</span>
                  <span className="truncate flex-1">{p.name}</span>
                  {flavorLabel && (
                    <span className="text-xs text-muted-foreground shrink-0">{flavorLabel}</span>
                  )}
                  {p.batch_type && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      {p.batch_type}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
          {filtered.length > 50 && (
            <div className="px-3 py-2 text-xs text-center text-muted-foreground border-t">
              แสดง 50 รายการแรก จาก {filtered.length} รายการ - พิมพ์เพื่อกรอง
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Stat Card
// ------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-bold tabular-nums">
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              value.toLocaleString()
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------
// Recipe BOM Section
// ------------------------------------------------------------------

function RecipeBomSection({ productId }: { productId: string }) {
  const [rows, setRows] = useState<RecipeBomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchRecipe() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: err } = await supabase
          .from('recipe_bom')
          .select(`
            id,
            weight_kg,
            yield_kg,
            ingredient:ingredients(code, name, category)
          `)
          .eq('product_id', productId)
          .order('weight_kg', { ascending: false });

        if (err) throw err;
        if (!cancelled) setRows((data as unknown as RecipeBomRow[]) || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to fetch recipe');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRecipe();
    return () => { cancelled = true; };
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        กำลังโหลดสูตรอาหาร...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Beaker className="h-8 w-8 opacity-40" />
        <div className="text-sm font-medium">ไม่พบข้อมูลสูตร</div>
        <div className="text-xs">ยังไม่ได้ตั้งค่า recipe_bom สำหรับสินค้านี้</div>
      </div>
    );
  }

  const totalWeightPerBatch = rows.reduce((sum, r) => sum + r.weight_kg, 0);
  const yieldKg = rows[0]?.yield_kg ?? 75;
  const yieldPct = totalWeightPerBatch > 0 ? (yieldKg / totalWeightPerBatch) * 100 : 0;

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>รหัส (R-code)</TableHead>
            <TableHead>ชื่อวัตถุดิบ</TableHead>
            <TableHead>หมวดหมู่</TableHead>
            <TableHead className="text-right">น้ำหนัก/batch (kg)</TableHead>
            <TableHead className="text-right">สัดส่วน (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => {
            const cat = getIngredientCategory(row.ingredient.code, row.ingredient.category);
            const catInfo = INGREDIENT_CATEGORY_MAP[cat] || {
              label: cat,
              color: 'bg-gray-100 text-gray-700 border-gray-300',
            };
            const pct = totalWeightPerBatch > 0
              ? (row.weight_kg / totalWeightPerBatch) * 100
              : 0;

            return (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                <TableCell className="font-mono text-xs font-medium">
                  {row.ingredient.code}
                </TableCell>
                <TableCell className="text-sm">
                  {row.ingredient.name || (
                    <span className="text-muted-foreground italic">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${catInfo.color}`}
                  >
                    {catInfo.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.weight_kg.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                  {pct.toFixed(1)}%
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4} className="font-medium">
              รวมน้ำหนักวัตถุดิบ
            </TableCell>
            <TableCell className="text-right font-mono font-medium tabular-nums">
              {totalWeightPerBatch.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              100.0%
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground px-1">
        <span>
          Yield/batch: <strong className="text-foreground">{yieldKg.toFixed(2)} kg</strong>
        </span>
        <span>
          Yield %: <strong className="text-foreground">{yieldPct.toFixed(1)}%</strong>
        </span>
        <span>
          วัตถุดิบ: <strong className="text-foreground">{rows.length} รายการ</strong>
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Packaging BOM Section
// ------------------------------------------------------------------

function PackagingBomSection({
  productId,
  fgCode,
}: {
  productId: string;
  fgCode: string;
}) {
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [packagingBySkuId, setPackagingBySkuId] = useState<Record<string, PackagingBomRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPackaging() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();

        // Fetch SKUs for product
        const { data: skuData, error: skuErr } = await supabase
          .from('skus')
          .select('id, sku_code, size_g, qty_per_box, package_code, package_type')
          .eq('product_id', productId)
          .order('sku_code');

        if (skuErr) throw skuErr;
        const fetchedSkus = (skuData as SkuRow[]) || [];
        if (cancelled) return;
        setSkus(fetchedSkus);

        if (fetchedSkus.length > 0) {
          const skuIds = fetchedSkus.map((s) => s.id);
          const { data: bomData, error: bomErr } = await supabase
            .from('packaging_bom')
            .select(`
              id,
              sku_id,
              ratio_avg,
              ratio_min,
              ratio_max,
              sample_count,
              ratio_type,
              material:materials(code, short_code, name, type)
            `)
            .in('sku_id', skuIds);

          if (bomErr) throw bomErr;
          if (cancelled) return;

          const bomRows = (bomData as unknown as PackagingBomRow[]) || [];
          const grouped: Record<string, PackagingBomRow[]> = {};
          for (const row of bomRows) {
            if (!grouped[row.sku_id]) grouped[row.sku_id] = [];
            grouped[row.sku_id].push(row);
          }
          setPackagingBySkuId(grouped);
        } else {
          setPackagingBySkuId({});
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to fetch packaging');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPackaging();
    return () => { cancelled = true; };
  }, [productId]);

  // Build fallback rows from BOM_RATIOS
  const fallbackRows: FallbackRow[] = useMemo(() => {
    const rows: FallbackRow[] = [];
    for (const [key, ratio] of Object.entries(BOM_RATIOS)) {
      const [fg, materialPart] = key.split('|');
      if (fg === fgCode) {
        rows.push({
          key,
          materialCode: materialPart,
          avg: ratio.avg,
          min: ratio.min,
          max: ratio.max,
          n: ratio.n,
          stable: ratio.stable,
        });
      }
    }
    return rows;
  }, [fgCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        กำลังโหลดบรรจุภัณฑ์...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
        {error}
      </div>
    );
  }

  const hasDbPackaging = Object.values(packagingBySkuId).some((rows) => rows.length > 0);

  if (skus.length === 0 && fallbackRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Package className="h-8 w-8 opacity-40" />
        <div className="text-sm font-medium">ไม่พบข้อมูล SKU / บรรจุภัณฑ์</div>
        <div className="text-xs">ไม่พบข้อมูล SKU หรือ BOM Ratios สำหรับ {fgCode}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* SKU list */}
      {skus.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground px-1">
            SKU ทั้งหมด ({skus.length} รายการ)
          </div>
          <div className="flex flex-wrap gap-2">
            {skus.map((sku) => (
              <Badge
                key={sku.id}
                variant="outline"
                className="text-xs font-mono px-2 py-0.5"
              >
                {sku.sku_code}
                <span className="ml-1 text-muted-foreground font-sans">
                  {sku.size_g}g x{sku.qty_per_box}
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* DB packaging data grouped by SKU */}
      {hasDbPackaging ? (
        <div className="space-y-4">
          {skus.map((sku) => {
            const bomRows = packagingBySkuId[sku.id];
            if (!bomRows || bomRows.length === 0) return null;

            return (
              <div key={sku.id} className="space-y-2">
                <div className="text-xs font-medium px-1 flex items-center gap-2">
                  <span className="font-mono">{sku.sku_code}</span>
                  <span className="text-muted-foreground">
                    ({sku.size_g}g x{sku.qty_per_box})
                  </span>
                  {sku.package_type && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {sku.package_type}
                    </Badge>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>รหัสวัสดุ</TableHead>
                      <TableHead>ชื่อ</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead className="text-right">ratio_avg</TableHead>
                      <TableHead className="text-right">min-max</TableHead>
                      <TableHead className="text-center">n</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bomRows.map((row) => {
                      const n = row.sample_count ?? 0;
                      const conf = getConfidenceBadge(n);
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {row.material.short_code || row.material.code}
                          </TableCell>
                          <TableCell className="text-sm">{row.material.name}</TableCell>
                          <TableCell>
                            {row.material.type ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {row.material.type}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {row.ratio_avg?.toFixed(2) ?? '-'}
                            {row.ratio_type === 'stable' && (
                              <Badge
                                variant="secondary"
                                className="ml-1 text-[9px] px-1 py-0 bg-green-100 text-green-700 border-green-300"
                              >
                                stable
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {row.ratio_min?.toFixed(2) ?? '-'} ~ {row.ratio_max?.toFixed(2) ?? '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 ${conf.color}`}
                            >
                              {conf.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      ) : fallbackRows.length > 0 ? (
        <div className="space-y-3">
          <div className="px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
            แสดงข้อมูลจาก BOM_RATIOS (ไม่พบข้อมูลในฐานข้อมูล packaging_bom)
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัสวัสดุ</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead className="text-right">ratio_avg</TableHead>
                <TableHead className="text-right">min-max</TableHead>
                <TableHead className="text-center">n</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fallbackRows.map((row) => {
                const conf = getConfidenceBadge(row.n);
                return (
                  <TableRow key={row.key}>
                    <TableCell className="font-mono text-xs font-medium">
                      {row.materialCode}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground italic">
                      (จาก constants)
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-xs">-</span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {row.avg.toFixed(2)}
                      {row.stable && (
                        <Badge
                          variant="secondary"
                          className="ml-1 text-[9px] px-1 py-0 bg-green-100 text-green-700 border-green-300"
                        >
                          stable
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {row.min.toFixed(2)} ~ {row.max.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${conf.color}`}
                      >
                        {conf.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <div className="text-sm">ไม่พบข้อมูล Packaging BOM สำหรับ SKU เหล่านี้</div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Main BOM Explorer Page
// ------------------------------------------------------------------

export default function BomPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    productsWithRecipe: 0,
    totalIngredients: 0,
    totalSkus: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch all products for the combobox
  useEffect(() => {
    async function fetchProducts() {
      setLoadingProducts(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('products')
          .select('id, fg_code, name, category, flavor, flavor_code, batch_type')
          .order('fg_code');

        if (error) throw error;
        setProducts((data as ProductRow[]) || []);
      } catch (e) {
        console.error('Failed to fetch products:', e);
      } finally {
        setLoadingProducts(false);
      }
    }

    fetchProducts();
  }, []);

  // Fetch stats
  useEffect(() => {
    async function fetchStats() {
      setLoadingStats(true);
      try {
        const supabase = createClient();

        // Products that have at least one recipe_bom entry
        const { count: recipeProductCount } = await supabase
          .from('recipe_bom')
          .select('product_id', { count: 'exact', head: true });

        // Use a distinct count via RPC or just count ingredients
        const { count: ingredientCount } = await supabase
          .from('ingredients')
          .select('id', { count: 'exact', head: true });

        const { count: skuCount } = await supabase
          .from('skus')
          .select('id', { count: 'exact', head: true });

        // For distinct product_id count from recipe_bom, fetch distinct ids
        const { data: distinctProducts } = await supabase
          .from('recipe_bom')
          .select('product_id');

        const uniqueProductIds = new Set(
          (distinctProducts || []).map((r: { product_id: string }) => r.product_id)
        );

        setStats({
          productsWithRecipe: uniqueProductIds.size,
          totalIngredients: ingredientCount ?? 0,
          totalSkus: skuCount ?? 0,
        });
      } catch (e) {
        console.error('Failed to fetch stats:', e);
      } finally {
        setLoadingStats(false);
      }
    }

    fetchStats();
  }, []);

  const handleProductSelect = useCallback((product: ProductRow | null) => {
    setSelectedProduct(product);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">BOM Explorer</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          ค้นหาและดูสูตรอาหาร (Recipe BOM) และบรรจุภัณฑ์ (Packaging BOM) ของสินค้า
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon={FlaskConical}
            label="จำนวนสินค้าที่มีสูตร"
            value={stats.productsWithRecipe}
            loading={loadingStats}
          />
          <StatCard
            icon={Beaker}
            label="จำนวนวัตถุดิบทั้งหมด"
            value={stats.totalIngredients}
            loading={loadingStats}
          />
          <StatCard
            icon={Box}
            label="จำนวน SKU ทั้งหมด"
            value={stats.totalSkus}
            loading={loadingStats}
          />
        </div>

        <Separator />

        {/* Product selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">เลือกสินค้า</label>
          {loadingProducts ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              กำลังโหลดรายการสินค้า...
            </div>
          ) : (
            <ProductSearch
              products={products}
              selectedId={selectedProduct?.id ?? null}
              onSelect={handleProductSelect}
            />
          )}
        </div>

        {/* BOM content */}
        {selectedProduct ? (
          <div className="space-y-6">
            {/* Selected product info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="font-mono">{selectedProduct.fg_code}</span>
                  <span className="font-normal text-base">{selectedProduct.name}</span>
                </CardTitle>
                <CardDescription>
                  <span className="flex items-center gap-2 flex-wrap">
                    {selectedProduct.category && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {selectedProduct.category}
                      </Badge>
                    )}
                    {selectedProduct.flavor && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {selectedProduct.flavor}
                      </Badge>
                    )}
                    {selectedProduct.batch_type && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {selectedProduct.batch_type}
                      </Badge>
                    )}
                  </span>
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Recipe BOM */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FlaskConical className="h-4 w-4" />
                  สูตรอาหาร (Recipe BOM)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RecipeBomSection productId={selectedProduct.id} />
              </CardContent>
            </Card>

            {/* Packaging BOM */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" />
                  บรรจุภัณฑ์ (Packaging BOM)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PackagingBomSection
                  productId={selectedProduct.id}
                  fgCode={selectedProduct.fg_code}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Search className="h-12 w-12 opacity-30" />
            <div className="text-sm font-medium">เลือกสินค้าเพื่อดู BOM</div>
            <div className="text-xs">ค้นหาด้วยรหัส FG หรือชื่อสินค้า</div>
          </div>
        )}
      </div>
    </div>
  );
}
