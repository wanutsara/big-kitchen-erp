'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { Shield, AlertTriangle, ClipboardCheck, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import {
  FACTORIES,
  BOI_COLORS,
  BOI_CAP_TONS_PER_YEAR,
} from '@/lib/constants';
import type {
  BoiAnnualSummary,
  Order,
  ComplianceTask,
  Lot,
} from '@/lib/types';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// --- Types for joined queries ---

interface McpdOrder extends Omit<Order, 'customer' | 'product'> {
  customer?: { id: string; name: string };
  product?: { id: string; fg_code: string; name: string };
  compliance_tasks?: ComplianceTask[];
}

interface LotWithPlan extends Lot {
  production_plan?: {
    id: string;
    factory: string;
    plan_date: string;
    order?: {
      id: string;
      product?: { id: string; fg_code: string; name: string };
    };
  };
}

// --- Main Page ---

export default function BoiPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">BOI Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">ปี:</span>
          <Select
            value={String(year)}
            onValueChange={(val) => setYear(Number(val))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y + 543}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-8">
        {/* Section 1: BOI Meters */}
        <BoiMeterSection year={year} />

        {/* Section 2: MCPD Tracker */}
        <McpdTrackerSection />

        {/* Section 3: Allocation Table */}
        <AllocationTableSection year={year} />
      </div>
    </div>
  );
}

// ==================== Section 1: BOI Meters ====================

function BoiMeterSection({ year }: { year: number }) {
  const [summary, setSummary] = useState<BoiAnnualSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('boi_annual_summary')
        .select('*')
        .eq('year', year)
        .order('factory', { ascending: true })
        .order('line_number', { ascending: true });

      if (err) throw err;
      setSummary((data as BoiAnnualSummary[]) || []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'โหลดข้อมูล BOI ไม่สำเร็จ'
      );
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Group by factory
  const byFactory: Record<string, BoiAnnualSummary[]> = {};
  for (const row of summary) {
    if (!byFactory[row.factory]) byFactory[row.factory] = [];
    byFactory[row.factory].push(row);
  }

  // If no data from DB, show placeholder cards based on FACTORIES config
  const hasData = summary.length > 0;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">
          BOI Quota ปี {year + 543}
        </h2>
        <span className="text-sm text-muted-foreground">
          ({BOI_CAP_TONS_PER_YEAR.toLocaleString()} ตัน/ปี/ลาย)
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          กำลังโหลด...
        </div>
      ) : hasData ? (
        // Render from actual DB data
        Object.entries(byFactory).map(([factoryKey, lines]) => {
          const factoryInfo =
            FACTORIES[factoryKey as keyof typeof FACTORIES];
          return (
            <div key={factoryKey} className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {factoryInfo?.name || factoryKey}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {lines.map((line) => (
                  <BoiLineCard key={`${line.factory}-${line.line_number}`} line={line} />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        // Placeholder cards when no DB data
        <>
          {(['big2', 'big1'] as const).map((factoryKey) => {
            const factoryInfo = FACTORIES[factoryKey];
            return (
              <div key={factoryKey} className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {factoryInfo.name}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Array.from(
                    { length: factoryInfo.lines },
                    (_, i) => i + 1
                  ).map((lineNum) => (
                    <BoiLineCard
                      key={`${factoryKey}-${lineNum}`}
                      line={{
                        factory: factoryKey,
                        line_number: lineNum,
                        boi_level: lineNum <= 4 ? 'BOI4' : 'BOI5',
                        year: new Date().getFullYear(),
                        annual_cap_tons: BOI_CAP_TONS_PER_YEAR,
                        used_tons: 0,
                        remaining_tons: BOI_CAP_TONS_PER_YEAR,
                        used_pct: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

function BoiLineCard({ line }: { line: BoiAnnualSummary }) {
  const boiLevel = (line.boi_level || 'NON') as keyof typeof BOI_COLORS;
  const boiColor = BOI_COLORS[boiLevel] || BOI_COLORS.NON;
  const pct = line.used_pct;

  // Color thresholds: green(<80%), yellow(80-95%), red(>95%)
  let barColor = '#22c55e'; // green-500
  let barBg = '#dcfce7'; // green-100
  if (pct > 95) {
    barColor = '#ef4444'; // red-500
    barBg = '#fef2f2'; // red-50
  } else if (pct >= 80) {
    barColor = '#eab308'; // yellow-500
    barBg = '#fefce8'; // yellow-50
  }

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            Line {line.line_number}
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-medium"
            style={{
              backgroundColor: boiColor.bg,
              borderColor: boiColor.border,
              color: boiColor.text,
            }}
          >
            {boiLevel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Progress bar */}
          <div
            className="h-3 rounded-full overflow-hidden"
            style={{ backgroundColor: barBg }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(pct, 100)}%`,
                backgroundColor: barColor,
              }}
            />
          </div>

          {/* Numbers */}
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {line.used_tons.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}{' '}
              /{' '}
              {line.annual_cap_tons.toLocaleString()} ตัน
            </span>
            <span
              className="font-medium"
              style={{
                color:
                  pct > 95
                    ? '#ef4444'
                    : pct >= 80
                      ? '#ca8a04'
                      : '#16a34a',
              }}
            >
              {pct.toFixed(1)}%
            </span>
          </div>

          {/* Alert indicators */}
          {pct >= 80 && (
            <div
              className="flex items-center gap-1 text-xs mt-1"
              style={{
                color: pct > 95 ? '#ef4444' : '#ca8a04',
              }}
            >
              <AlertTriangle className="h-3 w-3" />
              {pct > 95
                ? 'เกินโควตา 95% — ใกล้เต็ม!'
                : 'เกินโควตา 80% — ควรระวัง'}
            </div>
          )}

          {/* Remaining */}
          <p className="text-xs text-muted-foreground">
            เหลือ{' '}
            {line.remaining_tons.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}{' '}
            ตัน
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== Section 2: MCPD Tracker ====================

function McpdTrackerSection() {
  const [orders, setOrders] = useState<McpdOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMcpdOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('orders')
        .select(
          `
          *,
          customer:customers(*),
          product:products(*),
          compliance_tasks(*)
        `
        )
        .eq('requires_mcpd', true)
        .neq('status', 'cancelled')
        .order('delivery_date', { ascending: true });

      if (err) throw err;
      setOrders((data as McpdOrder[]) || []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'โหลดข้อมูล MCPD ไม่สำเร็จ'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMcpdOrders();
  }, [fetchMcpdOrders]);

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">MCPD Tracker</h2>
        <Badge variant="secondary" className="text-xs">
          {orders.length} รายการ
        </Badge>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground">
              กำลังโหลด...
            </div>
          ) : orders.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground">
              ไม่มี order ที่ต้องทำ MCPD
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead className="text-center">
                    กำหนดส่ง
                  </TableHead>
                  <TableHead className="text-center">
                    MCPD Status
                  </TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order, index) => {
                  // Find the MCPD compliance task for this order
                  const mcpdTask = order.compliance_tasks?.find(
                    (t) => t.task_type === 'mcpd'
                  );
                  const mcpdStatus = mcpdTask?.status || 'pending';

                  // Check if deadline is urgent (<=3 days away and MCPD not done)
                  const isUrgent = (() => {
                    if (mcpdStatus === 'done') return false;
                    if (!order.delivery_date) return false;
                    const daysLeft = differenceInDays(
                      new Date(order.delivery_date),
                      new Date()
                    );
                    return daysLeft <= 3;
                  })();

                  return (
                    <TableRow
                      key={order.id}
                      className={isUrgent ? 'bg-red-50' : ''}
                    >
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.po_number || order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {order.product?.fg_code || '-'}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({order.qty_batch} batch)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.customer?.name || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.delivery_date ? (
                          <span
                            className={
                              isUrgent
                                ? 'text-red-600 font-medium'
                                : ''
                            }
                          >
                            {format(
                              new Date(order.delivery_date),
                              'd MMM yy',
                              { locale: th }
                            )}
                            {isUrgent && (
                              <AlertTriangle className="inline h-3 w-3 ml-1 text-red-500" />
                            )}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <McpdStatusBadge status={mcpdStatus} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {mcpdTask?.notes || order.remark || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function McpdStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'done':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-300"
        >
          เสร็จแล้ว
        </Badge>
      );
    case 'in_progress':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-300"
        >
          กำลังดำเนินการ
        </Badge>
      );
    default:
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700 border-yellow-300"
        >
          รอดำเนินการ
        </Badge>
      );
  }
}

// ==================== Section 3: Allocation Table ====================

function AllocationTableSection({ year }: { year: number }) {
  const [lots, setLots] = useState<LotWithPlan[]>([]);
  const [boiLines, setBoiLines] = useState<
    { id: string; factory: string; line_number: number; boi_level: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Fetch lots with joined plan and order data
      const [lotsRes, boiLinesRes] = await Promise.all([
        supabase
          .from('lots')
          .select(
            `
            *,
            production_plan:production_plans(
              id,
              factory,
              plan_date,
              order:orders(
                id,
                product:products(id, fg_code, name)
              )
            )
          `
          )
          .order('lot_date', { ascending: false })
          .limit(50),
        supabase
          .from('boi_lines')
          .select('id, factory, line_number, boi_level')
          .eq('year', year)
          .order('factory', { ascending: true })
          .order('line_number', { ascending: true }),
      ]);

      if (lotsRes.error) throw lotsRes.error;
      if (boiLinesRes.error) throw boiLinesRes.error;

      setLots((lotsRes.data as LotWithPlan[]) || []);
      setBoiLines(boiLinesRes.data || []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'โหลดข้อมูลการจัดสรรไม่สำเร็จ'
      );
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">
          จัดสรร Lot เข้าลาย BOI
        </h2>
        <span className="text-sm text-muted-foreground">
          (สวมตัวเลขเข้าลาย BOI)
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground">
              กำลังโหลด...
            </div>
          ) : lots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <Layers className="h-8 w-8 opacity-40" />
              <p>ยังไม่มี Lot ที่บันทึก</p>
              <p className="text-xs">
                Lot จะปรากฏที่นี่เมื่อมีการบันทึกผลการผลิต
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead>โรงงาน</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead className="text-center">
                    น้ำหนัก (kg)
                  </TableHead>
                  <TableHead className="text-center">Batch</TableHead>
                  <TableHead>จัดสรรเข้าลาย</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((lot, index) => {
                  const plan = lot.production_plan;
                  const product = (plan?.order as { product?: { fg_code: string; name: string } } | undefined)?.product;

                  return (
                    <TableRow key={lot.id}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">
                        {lot.lot_number}
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(lot.lot_date),
                          'd MMM yy',
                          { locale: th }
                        )}
                      </TableCell>
                      <TableCell>
                        {plan?.factory
                          ? FACTORIES[
                              plan.factory as keyof typeof FACTORIES
                            ]?.name || plan.factory
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {product?.fg_code || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {lot.weight_kg?.toLocaleString() || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {lot.batch_count || '-'}
                      </TableCell>
                      <TableCell>
                        {boiLines.length > 0 ? (
                          <Select>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="เลือกลาย..." />
                            </SelectTrigger>
                            <SelectContent>
                              {boiLines.map((bl) => {
                                const factoryName =
                                  FACTORIES[
                                    bl.factory as keyof typeof FACTORIES
                                  ]?.name || bl.factory;
                                return (
                                  <SelectItem
                                    key={bl.id}
                                    value={bl.id}
                                  >
                                    {factoryName} Line{' '}
                                    {bl.line_number} (
                                    {bl.boi_level || 'N/A'})
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            ยังไม่มีลาย BOI
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
