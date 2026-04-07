'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, formatDistanceStrict } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Factory,
  CheckCircle2,
  Play,
  Pause,
  Clock,
  TrendingUp,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { FACTORIES, BATCH_KG, BOI_COLORS, type FactoryKey } from '@/lib/constants';
import type { BoardPlan, Lot, LotOutput } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import FactoryToggle from '@/components/board/FactoryToggle';
import ProductionOutputDialog from '@/components/tracking/ProductionOutputDialog';
import { useTracking } from '@/hooks/useTracking';
import { cn } from '@/lib/utils';

export default function TrackingPage() {
  const [factory, setFactory] = useState<FactoryKey>('big2');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [plans, setPlans] = useState<BoardPlan[]>([]);
  const [lots, setLots] = useState<Record<string, Lot>>({});
  const [lotOutputs, setLotOutputs] = useState<Record<string, LotOutput>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingBatch, setEditingBatch] = useState<Record<string, number>>({});
  const [outputDialogPlan, setOutputDialogPlan] = useState<BoardPlan | null>(null);

  const { startProduction, pauseProduction, updateActualBatch } = useTracking();

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Fetch production plans for the selected date and factory
      const { data: plansData, error: plansErr } = await supabase
        .from('production_plans')
        .select(`
          *,
          order:orders(
            *,
            customer:customers(*),
            product:products(*)
          )
        `)
        .eq('factory', factory)
        .eq('plan_date', selectedDate)
        .neq('status', 'cancelled')
        .order('sort_order', { ascending: true });

      if (plansErr) throw plansErr;

      const fetchedPlans = (plansData as BoardPlan[]) || [];
      setPlans(fetchedPlans);

      // Initialize editing batch values
      const batchMap: Record<string, number> = {};
      for (const p of fetchedPlans) {
        batchMap[p.id] = p.actual_batch ?? p.qty_batch;
      }
      setEditingBatch(batchMap);

      // Fetch lots for done plans
      const donePlanIds = fetchedPlans
        .filter((p) => p.status === 'done')
        .map((p) => p.id);

      if (donePlanIds.length > 0) {
        const { data: lotsData } = await supabase
          .from('lots')
          .select('*')
          .in('plan_id', donePlanIds);

        const lotsMap: Record<string, Lot> = {};
        const lotIds: string[] = [];
        for (const lot of lotsData || []) {
          lotsMap[lot.plan_id] = lot;
          lotIds.push(lot.id);
        }
        setLots(lotsMap);

        // Fetch lot_outputs for these lots
        if (lotIds.length > 0) {
          const { data: outputsData } = await supabase
            .from('lot_outputs')
            .select('*')
            .in('lot_id', lotIds);

          const outputsMap: Record<string, LotOutput> = {};
          for (const output of outputsData || []) {
            outputsMap[output.lot_id] = output;
          }
          setLotOutputs(outputsMap);
        } else {
          setLotOutputs({});
        }
      } else {
        setLots({});
        setLotOutputs({});
      }
    } catch (e) {
      console.error('Failed to fetch tracking data:', e);
    } finally {
      setLoading(false);
    }
  }, [factory, selectedDate]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Summary stats
  const summary = useMemo(() => {
    const planned = plans.reduce((s, p) => s + p.qty_batch, 0);
    const producing = plans
      .filter((p) => p.status === 'producing')
      .reduce((s, p) => s + p.qty_batch, 0);
    const done = plans.filter((p) => p.status === 'done');
    const doneBatch = done.reduce((s, p) => s + (p.actual_batch ?? p.qty_batch), 0);
    const doneTons = (doneBatch * BATCH_KG) / 1000;
    const efficiency = planned > 0 ? Math.round((doneBatch / planned) * 100) : 0;

    return { planned, producing, doneBatch, doneTons, efficiency, doneCount: done.length };
  }, [plans]);

  const handleStart = async (planId: string) => {
    setActionLoadingId(planId);
    try {
      await startProduction(planId);
      await fetchPlans();
    } catch (err) {
      console.error('Failed to start:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleComplete = (plan: BoardPlan) => {
    setOutputDialogPlan(plan);
  };

  const handleOutputDialogComplete = async () => {
    setOutputDialogPlan(null);
    await fetchPlans();
  };

  const handlePause = async (planId: string) => {
    setActionLoadingId(planId);
    try {
      await pauseProduction(planId);
      await fetchPlans();
    } catch (err) {
      console.error('Failed to pause:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBatchChange = async (planId: string, value: number) => {
    setEditingBatch((prev) => ({ ...prev, [planId]: value }));
    // Only persist if the plan is in producing or done state
    const plan = plans.find((p) => p.id === planId);
    if (plan && plan.status === 'producing') {
      try {
        await updateActualBatch(planId, value);
      } catch (err) {
        console.error('Failed to update batch:', err);
      }
    }
  };

  const getDuration = (plan: BoardPlan) => {
    if (!plan.actual_start) return '-';
    const start = new Date(plan.actual_start);
    const end = plan.actual_end ? new Date(plan.actual_end) : new Date();
    return formatDistanceStrict(start, end, { locale: th });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'planned':
        return (
          <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-600">
            รอผลิต
          </Badge>
        );
      case 'producing':
        return (
          <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 animate-pulse">
            กำลังผลิต
          </Badge>
        );
      case 'done':
        return (
          <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">
            เสร็จสิ้น
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px]">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">ติดตามการผลิต</h1>
          <FactoryToggle value={factory} onChange={setFactory} />
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto h-8 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
          >
            วันนี้
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">แผนวันนี้</span>
            </div>
            <div className="text-2xl font-bold">{summary.planned} <span className="text-sm font-normal text-muted-foreground">batch</span></div>
            <div className="text-xs text-muted-foreground">{((summary.planned * BATCH_KG) / 1000).toFixed(1)} ตัน</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Factory className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">กำลังผลิต</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{summary.producing} <span className="text-sm font-normal text-muted-foreground">batch</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">เสร็จแล้ว</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{summary.doneBatch} <span className="text-sm font-normal text-muted-foreground">batch</span></div>
            <div className="text-xs text-muted-foreground">{summary.doneTons.toFixed(1)} ตัน ({summary.doneCount} รายการ)</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">ประสิทธิภาพ</span>
            </div>
            <div className={cn(
              'text-2xl font-bold',
              summary.efficiency >= 80 ? 'text-green-600' : summary.efficiency >= 50 ? 'text-amber-600' : 'text-red-600'
            )}>
              {summary.efficiency}%
            </div>
            <div className="text-xs text-muted-foreground">จริง/แผน</div>
          </CardContent>
        </Card>
      </div>

      {/* Production Table */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            กำลังโหลด...
          </div>
        ) : plans.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            ไม่มีแผนผลิตสำหรับวันที่เลือก
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead className="w-14">สาย</TableHead>
                  <TableHead>FG Code</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead className="text-center w-20">Batch แผน</TableHead>
                  <TableHead className="text-center w-24">Batch จริง</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead className="w-16">เริ่ม</TableHead>
                  <TableHead className="w-16">จบ</TableHead>
                  <TableHead className="w-20">ระยะเวลา</TableHead>
                  <TableHead className="w-20">สถานะ</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead className="text-center w-20">น้ำหนักจริง</TableHead>
                  <TableHead className="text-center w-16">กล่อง</TableHead>
                  <TableHead className="text-center w-16">Yield</TableHead>
                  <TableHead className="w-32">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan, idx) => {
                  const boiLevel = (plan.order.boi_level || 'NON') as keyof typeof BOI_COLORS;
                  const boiColor = BOI_COLORS[boiLevel] || BOI_COLORS.NON;
                  const lot = lots[plan.id];
                  const isActionLoading = actionLoadingId === plan.id;

                  return (
                    <TableRow
                      key={plan.id}
                      className={cn(
                        plan.status === 'producing' && 'bg-blue-50/50',
                        plan.status === 'done' && 'bg-green-50/30'
                      )}
                    >
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-xs">
                        {plan.line_number ? `L${plan.line_number}` : '-'}
                      </TableCell>
                      <TableCell>
                        <span
                          className="font-bold text-xs"
                          style={{ color: boiColor.text }}
                        >
                          {plan.order.product?.fg_code}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">
                        {plan.order.product?.name}
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium">
                        {plan.qty_batch}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.status === 'done' ? (
                          <span className="text-xs font-medium text-green-700">
                            {plan.actual_batch ?? plan.qty_batch}
                          </span>
                        ) : plan.status === 'producing' ? (
                          <Input
                            type="number"
                            min={1}
                            value={editingBatch[plan.id] ?? plan.qty_batch}
                            onChange={(e) => handleBatchChange(plan.id, parseInt(e.target.value) || 0)}
                            className="h-6 w-16 text-xs text-center mx-auto"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">
                        {plan.order.customer?.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {plan.actual_start
                          ? format(new Date(plan.actual_start), 'HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {plan.actual_end
                          ? format(new Date(plan.actual_end), 'HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {getDuration(plan)}
                      </TableCell>
                      <TableCell>{getStatusBadge(plan.status)}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {lot?.lot_number || '-'}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {(() => {
                          const output = lot ? lotOutputs[lot.id] : null;
                          return output ? `${output.actual_weight_kg} kg` : '-';
                        })()}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {(() => {
                          const output = lot ? lotOutputs[lot.id] : null;
                          if (!output) return '-';
                          return output.boxes_produced > 0
                            ? `${output.boxes_produced}${output.loose_units > 0 ? `+${output.loose_units}` : ''}`
                            : '-';
                        })()}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {(() => {
                          const output = lot ? lotOutputs[lot.id] : null;
                          if (!output?.yield_pct) return '-';
                          const y = output.yield_pct;
                          const color = y >= 90 ? 'text-green-700' : y >= 70 ? 'text-amber-700' : 'text-red-700';
                          return <span className={cn('font-medium', color)}>{y.toFixed(1)}%</span>;
                        })()}
                      </TableCell>
                      <TableCell>
                        {plan.status === 'planned' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                            disabled={isActionLoading}
                            onClick={() => handleStart(plan.id)}
                          >
                            {isActionLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-3 w-3 mr-1" />
                                เริ่มผลิต
                              </>
                            )}
                          </Button>
                        )}
                        {plan.status === 'producing' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2 bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                              disabled={isActionLoading}
                              onClick={() => handleComplete(plan)}
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                  เสร็จ
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-1 bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                              disabled={isActionLoading}
                              onClick={() => handlePause(plan.id)}
                            >
                              <Pause className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {plan.status === 'done' && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="text-[10px]">เสร็จสิ้น</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Production Output Dialog */}
      {outputDialogPlan && (
        <ProductionOutputDialog
          open={!!outputDialogPlan}
          onOpenChange={(open) => {
            if (!open) setOutputDialogPlan(null);
          }}
          planId={outputDialogPlan.id}
          productId={outputDialogPlan.order.product?.id || ''}
          fgCode={outputDialogPlan.order.product?.fg_code || 'UNKNOWN'}
          qtyBatch={outputDialogPlan.qty_batch}
          actualBatch={editingBatch[outputDialogPlan.id]}
          onComplete={handleOutputDialogComplete}
        />
      )}
    </div>
  );
}
