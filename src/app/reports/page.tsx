'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Printer, CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import {
  FACTORIES,
  BATCH_KG,
  BOI_COLORS,
  PRIORITY_LABELS,
  type FactoryKey,
} from '@/lib/constants';
import type { BoardPlan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ReportsPage() {
  const [selectedDate, setSelectedDate] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [factory, setFactory] = useState<FactoryKey>('big2');
  const [plans, setPlans] = useState<BoardPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('production_plans')
        .select(
          `
          *,
          order:orders(
            *,
            customer:customers(*),
            product:products(*)
          )
        `
        )
        .eq('factory', factory)
        .eq('plan_date', selectedDate)
        .neq('status', 'cancelled')
        .order('sort_order', { ascending: true });

      if (err) throw err;
      setPlans((data as BoardPlan[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [factory, selectedDate]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const totalBatch = plans.reduce((sum, p) => sum + p.qty_batch, 0);
  const maxBatch = FACTORIES[factory].maxBatchPerDay;
  const capacityPct = maxBatch > 0 ? Math.round((totalBatch / maxBatch) * 100) : 0;
  const totalWeightKg = totalBatch * BATCH_KG;
  const totalWeightTons = (totalWeightKg / 1000).toFixed(2);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = (() => {
    try {
      return format(new Date(selectedDate + 'T00:00:00'), 'd MMMM yyyy', {
        locale: th,
      });
    } catch {
      return selectedDate;
    }
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Controls -- hidden when printing */}
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">รายงาน</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <Select
            value={factory}
            onValueChange={(val) => setFactory(val as FactoryKey)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(FACTORIES) as [
                  FactoryKey,
                  (typeof FACTORIES)[FactoryKey],
                ][]
              ).map(([key, f]) => (
                <SelectItem key={key} value={key}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="default" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" />
            พิมพ์
          </Button>
        </div>
      </div>

      {/* Print preview area */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 print:hidden">
            {error}
          </div>
        )}

        <Card className="max-w-4xl mx-auto print:shadow-none print:ring-0 print:border-0">
          {/* Header */}
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  แผนผลิตประจำวัน {formattedDate} — {FACTORIES[factory].name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {FACTORIES[factory].lines} สายการผลิต | สูงสุด{' '}
                  {maxBatch} batch/วัน
                </p>
              </div>
              <div className="text-right print:hidden">
                <p className="text-sm font-medium">Big Kitchen</p>
                <p className="text-xs text-muted-foreground">
                  Production Planner
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                กำลังโหลด...
              </div>
            ) : plans.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                ไม่มีแผนผลิตสำหรับวันที่เลือก
              </div>
            ) : (
              <>
                {/* Production plan table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>FG Code</TableHead>
                      <TableHead>สินค้า</TableHead>
                      <TableHead className="text-center">
                        จำนวน batch
                      </TableHead>
                      <TableHead className="text-center">
                        น้ำหนัก (kg)
                      </TableHead>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead className="text-center">BOI</TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan, index) => {
                      const order = plan.order;
                      const boiLevel = (order?.boi_level ||
                        'NON') as keyof typeof BOI_COLORS;
                      const boiColor =
                        BOI_COLORS[boiLevel] || BOI_COLORS.NON;

                      return (
                        <TableRow key={plan.id}>
                          <TableCell className="text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-mono font-medium">
                            {order?.product?.fg_code || '-'}
                          </TableCell>
                          <TableCell>
                            {order?.product?.name || '-'}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {plan.qty_batch}
                          </TableCell>
                          <TableCell className="text-center">
                            {(plan.qty_batch * BATCH_KG).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {order?.customer?.name || '-'}
                          </TableCell>
                          <TableCell className="text-center">
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
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {order?.requires_mcpd && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-300"
                                >
                                  MCPD
                                </Badge>
                              )}
                              {order?.priority &&
                                order.priority <= 2 && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-300"
                                  >
                                    {
                                      PRIORITY_LABELS[
                                        order.priority as keyof typeof PRIORITY_LABELS
                                      ]?.label
                                    }
                                  </Badge>
                                )}
                              {order?.priority === 3 && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-300"
                                >
                                  {PRIORITY_LABELS[3].label}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                            {order?.remark || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-medium">
                        รวม ({plans.length} รายการ)
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {totalBatch}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {totalWeightKg.toLocaleString()}
                      </TableCell>
                      <TableCell colSpan={4} />
                    </TableRow>
                  </TableFooter>
                </Table>

                {/* Summary footer */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryItem
                    label="Batch รวม"
                    value={`${totalBatch} / ${maxBatch}`}
                  />
                  <SummaryItem
                    label="กำลังการผลิตใช้"
                    value={`${capacityPct}%`}
                    warn={capacityPct > 90}
                  />
                  <SummaryItem
                    label="น้ำหนักรวม"
                    value={`${totalWeightKg.toLocaleString()} kg`}
                  />
                  <SummaryItem
                    label="น้ำหนักรวม (ตัน)"
                    value={`${totalWeightTons} ตัน`}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-bold ${warn ? 'text-red-600' : 'text-foreground'}`}
      >
        {value}
      </p>
    </div>
  );
}
