'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  PackageCheck,
  Search,
  ArrowUpDown,
  Package,
  Weight,
  Layers,
  ChevronDown,
  ChevronRight,
  BookmarkPlus,
  Truck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';

// -------------------------------------------------------------------
// Types for FG Inventory
// -------------------------------------------------------------------

interface FgStockSummary {
  product_id: string;
  fg_code: string;
  product_name: string;
  category: string | null;
  total_boxes: number;
  loose_packs: number;
  total_weight_kg: number;
  lot_count: number;
}

interface FgInventoryLot {
  id: string;
  product_id: string;
  lot_number: string;
  production_date: string;
  sku_code: string | null;
  boxes: number;
  loose_packs: number;
  weight_kg: number;
  status: string;
  location: string | null;
}

// -------------------------------------------------------------------
// Status badge for lot status
// -------------------------------------------------------------------

function LotStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'in_stock':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-300"
        >
          ในคลัง
        </Badge>
      );
    case 'reserved':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700 border-yellow-300"
        >
          จองแล้ว
        </Badge>
      );
    case 'shipped':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-300"
        >
          จัดส่งแล้ว
        </Badge>
      );
    case 'returned':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-300"
        >
          คืนสินค้า
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {status}
        </Badge>
      );
  }
}

// -------------------------------------------------------------------
// Summary Card (same pattern as inventory page)
// -------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  unit,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  unit?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>
              {typeof value === 'number'
                ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : value}
              {unit && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {unit}
                </span>
              )}
            </p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------------
// Main Page
// -------------------------------------------------------------------

export default function FgInventoryPage() {
  const [stockSummary, setStockSummary] = useState<FgStockSummary[]>([]);
  const [lotDetails, setLotDetails] = useState<FgInventoryLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lotLoading, setLotLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableNotFound, setTableNotFound] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'fg_code' | 'total_weight_kg'>('fg_code');
  const [sortAsc, setSortAsc] = useState(true);

  // Selected product for lot detail
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // -------------------------------------------------------------------
  // Data fetching - Stock Summary
  // -------------------------------------------------------------------

  const fetchStockSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTableNotFound(false);
    try {
      const supabase = createClient();

      // Try fg_stock_summary view first, fallback to fg_inventory table
      let data: FgStockSummary[] = [];

      const viewRes = await supabase
        .from('fg_stock_summary')
        .select('*')
        .order('fg_code');

      if (viewRes.error) {
        // View might not exist, try aggregating from fg_inventory directly
        const tableRes = await supabase
          .from('fg_inventory')
          .select(`
            id,
            product_id,
            lot_number,
            production_date,
            sku_code,
            boxes,
            loose_packs,
            weight_kg,
            status,
            location,
            product:products(fg_code, name, category)
          `)
          .eq('status', 'in_stock')
          .order('production_date', { ascending: false });

        if (tableRes.error) {
          // Table doesn't exist yet — show empty state
          setTableNotFound(true);
          setStockSummary([]);
          return;
        }

        // Aggregate by product
        const productMap = new Map<string, FgStockSummary>();

        for (const row of (tableRes.data || []) as any[]) {
          const productId = row.product_id;
          const product = row.product as any;

          if (!productMap.has(productId)) {
            productMap.set(productId, {
              product_id: productId,
              fg_code: product?.fg_code || '-',
              product_name: product?.name || '-',
              category: product?.category || null,
              total_boxes: 0,
              loose_packs: 0,
              total_weight_kg: 0,
              lot_count: 0,
            });
          }

          const entry = productMap.get(productId)!;
          entry.total_boxes += row.boxes || 0;
          entry.loose_packs += row.loose_packs || 0;
          entry.total_weight_kg += row.weight_kg || 0;
          entry.lot_count += 1;
        }

        data = Array.from(productMap.values());
      } else {
        data = (viewRes.data as FgStockSummary[]) || [];
      }

      setStockSummary(data);
    } catch (e) {
      // Table/view doesn't exist yet
      setTableNotFound(true);
      setStockSummary([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // -------------------------------------------------------------------
  // Data fetching - Lot Details
  // -------------------------------------------------------------------

  const fetchLotDetails = useCallback(async (productId: string) => {
    setLotLoading(true);
    try {
      const supabase = createClient();

      const { data, error: lotError } = await supabase
        .from('fg_inventory')
        .select('*')
        .eq('product_id', productId)
        .eq('status', 'in_stock')
        .order('production_date', { ascending: false });

      if (lotError) {
        setLotDetails([]);
        return;
      }

      setLotDetails((data as FgInventoryLot[]) || []);
    } catch {
      setLotDetails([]);
    } finally {
      setLotLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockSummary();
  }, [fetchStockSummary]);

  // -------------------------------------------------------------------
  // Handle product row click
  // -------------------------------------------------------------------

  function handleRowClick(productId: string) {
    if (selectedProductId === productId) {
      setSelectedProductId(null);
      setLotDetails([]);
    } else {
      setSelectedProductId(productId);
      fetchLotDetails(productId);
    }
  }

  // -------------------------------------------------------------------
  // Filtered / sorted stock
  // -------------------------------------------------------------------

  const filteredStock = useMemo(() => {
    let result = [...stockSummary];

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.fg_code.toLowerCase().includes(q) ||
          (s.product_name && s.product_name.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortField === 'fg_code') {
        return sortAsc
          ? a.fg_code.localeCompare(b.fg_code)
          : b.fg_code.localeCompare(a.fg_code);
      }
      return sortAsc
        ? a.total_weight_kg - b.total_weight_kg
        : b.total_weight_kg - a.total_weight_kg;
    });

    return result;
  }, [stockSummary, search, sortField, sortAsc]);

  // -------------------------------------------------------------------
  // Summary counts
  // -------------------------------------------------------------------

  const summary = useMemo(() => {
    let totalBoxes = 0;
    let totalWeightKg = 0;
    let totalLots = 0;

    for (const s of stockSummary) {
      totalBoxes += s.total_boxes;
      totalWeightKg += s.total_weight_kg;
      totalLots += s.lot_count;
    }

    return {
      fgCount: stockSummary.length,
      totalBoxes,
      totalWeightTons: totalWeightKg / 1000,
      totalLots,
    };
  }, [stockSummary]);

  // -------------------------------------------------------------------
  // Toggle sort
  // -------------------------------------------------------------------

  function toggleSort(field: 'fg_code' | 'total_weight_kg') {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  // -------------------------------------------------------------------
  // Lot actions (placeholder — logs intent for now)
  // -------------------------------------------------------------------

  function handleReserveLot(lotId: string) {
    // TODO: Implement reservation flow
    console.log('Reserve lot:', lotId);
  }

  function handleShipLot(lotId: string) {
    // TODO: Implement shipping flow
    console.log('Ship lot:', lotId);
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <PackageCheck className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">คลังสินค้าสำเร็จรูป</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="รายการสินค้า"
            value={summary.fgCount}
            unit="FG codes"
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
            color="text-foreground"
          />
          <SummaryCard
            label="กล่องรวม"
            value={summary.totalBoxes}
            unit="กล่อง"
            icon={<Layers className="h-4 w-4 text-blue-600" />}
            color="text-blue-600"
          />
          <SummaryCard
            label="น้ำหนักรวม"
            value={summary.totalWeightTons}
            unit="ตัน"
            icon={<Weight className="h-4 w-4 text-green-600" />}
            color="text-green-600"
          />
          <SummaryCard
            label="Lot ทั้งหมด"
            value={summary.totalLots}
            unit="lots"
            icon={<PackageCheck className="h-4 w-4 text-purple-600" />}
            color="text-purple-600"
          />
        </div>

        {/* Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="ค้นหา FG code หรือชื่อสินค้า..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Stock Table */}
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                กำลังโหลด...
              </div>
            ) : tableNotFound || filteredStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <PackageCheck className="h-12 w-12 opacity-30" />
                <p className="text-sm font-medium">
                  ยังไม่มีสินค้าสำเร็จรูปในคลัง
                </p>
                <p className="text-xs text-center max-w-md">
                  เมื่อผลิตเสร็จและบันทึกผลผลิต สินค้าจะเข้าคลังอัตโนมัติ
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead className="w-[40px]" />
                    <TableHead>
                      <button
                        onClick={() => toggleSort('fg_code')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        FG Code
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead>หมวดหมู่</TableHead>
                    <TableHead className="text-right">กล่อง</TableHead>
                    <TableHead className="text-right">ซองเศษ</TableHead>
                    <TableHead className="text-right">
                      <button
                        onClick={() => toggleSort('total_weight_kg')}
                        className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                      >
                        น้ำหนัก (kg)
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">จำนวน Lot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStock.map((item, index) => (
                    <React.Fragment key={item.product_id}>
                      {/* Summary row */}
                      <TableRow
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => handleRowClick(item.product_id)}
                      >
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="px-0">
                          {selectedProductId === item.product_id ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">
                          {item.fg_code}
                        </TableCell>
                        <TableCell>{item.product_name || '-'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.category || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {item.total_boxes.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {item.loose_packs > 0 ? item.loose_packs.toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {item.total_weight_kg.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {item.lot_count}
                        </TableCell>
                      </TableRow>

                      {/* Lot detail rows (expandable) */}
                      {selectedProductId === item.product_id && (
                        <TableRow>
                          <TableCell colSpan={9} className="p-0 bg-muted/30">
                            <div className="px-6 py-3">
                              {lotLoading ? (
                                <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">
                                  กำลังโหลด Lot...
                                </div>
                              ) : lotDetails.length === 0 ? (
                                <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">
                                  ไม่พบ Lot ในคลัง
                                </div>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="text-xs">Lot Number</TableHead>
                                      <TableHead className="text-xs">วันผลิต</TableHead>
                                      <TableHead className="text-xs">SKU</TableHead>
                                      <TableHead className="text-xs text-right">กล่อง</TableHead>
                                      <TableHead className="text-xs text-right">ซอง</TableHead>
                                      <TableHead className="text-xs text-right">น้ำหนัก (kg)</TableHead>
                                      <TableHead className="text-xs text-center">สถานะ</TableHead>
                                      <TableHead className="text-xs">ที่เก็บ</TableHead>
                                      <TableHead className="text-xs text-right">จัดการ</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {lotDetails.map((lot) => (
                                      <TableRow key={lot.id} className="hover:bg-accent/30">
                                        <TableCell className="font-mono text-xs">
                                          {lot.lot_number}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                          {lot.production_date
                                            ? format(new Date(lot.production_date), 'd MMM yy', { locale: th })
                                            : '-'}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                          {lot.sku_code || '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs tabular-nums">
                                          {lot.boxes.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs tabular-nums">
                                          {lot.loose_packs > 0 ? lot.loose_packs.toLocaleString() : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs tabular-nums">
                                          {lot.weight_kg.toLocaleString(undefined, {
                                            maximumFractionDigits: 2,
                                          })}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <LotStatusBadge status={lot.status} />
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                          {lot.location || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2 text-[10px]"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleReserveLot(lot.id);
                                              }}
                                            >
                                              <BookmarkPlus className="h-3 w-3 mr-0.5" />
                                              จอง
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2 text-[10px]"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleShipLot(lot.id);
                                              }}
                                            >
                                              <Truck className="h-3 w-3 mr-0.5" />
                                              จัดส่ง
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
