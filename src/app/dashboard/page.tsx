'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays, addDays } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Factory,
  Package,
  AlertTriangle,
  Clock,
  TrendingUp,
  Users,
  ArrowRight,
  CalendarDays,
  ShieldCheck,
  Flame,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { FACTORIES, BATCH_KG, BOI_COLORS, PRIORITY_LABELS, type FactoryKey } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// --- Types ---
interface DaySummary {
  date: string;
  dayLabel: string;
  big2Batch: number;
  big1Batch: number;
  isToday: boolean;
}

interface UrgentOrder {
  id: string;
  fg_code: string;
  customer_name: string;
  qty_batch: number;
  delivery_date: string;
  priority: number;
  boi_level: string;
  requires_mcpd: boolean;
  status: string;
  daysLeft: number;
}

interface TopProduct {
  fg_code: string;
  name: string;
  total_batch: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  // KPI cards
  const [todayBatch, setTodayBatch] = useState({ big2: 0, big1: 0 });
  const [weekBatch, setWeekBatch] = useState({ big2: 0, big1: 0 });
  const [pendingOrders, setPendingOrders] = useState(0);
  const [mcpdPending, setMcpdPending] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);

  // Week capacity
  const [weekDays, setWeekDays] = useState<DaySummary[]>([]);

  // Urgent orders
  const [urgentOrders, setUrgentOrders] = useState<UrgentOrder[]>([]);

  // Top products
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  // BOI summary
  const [boiSummary, setBoiSummary] = useState<{ level: string; count: number; batch: number }[]>([]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      // 1. Fetch all production plans this week
      const { data: weekPlans } = await supabase
        .from('production_plans')
        .select('factory, plan_date, qty_batch, order:orders(boi_level, product:products(fg_code, name))')
        .gte('plan_date', weekStart)
        .lte('plan_date', weekEnd)
        .neq('status', 'cancelled');

      // 2. Fetch pending orders
      const { data: pendingData, count: pendingCount } = await supabase
        .from('orders')
        .select('id, qty_batch, delivery_date, priority, boi_level, requires_mcpd, status, product:products(fg_code, name), customer:customers(name)', { count: 'exact' })
        .eq('status', 'pending');

      // 3. MCPD pending count
      const { count: mcpdCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('requires_mcpd', true)
        .neq('status', 'done')
        .neq('status', 'cancelled');

      // 4. Master data counts
      const { count: prodCount } = await supabase.from('products').select('id', { count: 'exact', head: true });
      const { count: custCount } = await supabase.from('customers').select('id', { count: 'exact', head: true });

      // Process week plans
      const plans = (weekPlans || []) as unknown as Array<{
        factory: string;
        plan_date: string;
        qty_batch: number;
        order: { boi_level: string; product: { fg_code: string; name: string } } | null;
      }>;

      // Today batch
      const todayPlans = plans.filter((p) => p.plan_date === today);
      setTodayBatch({
        big2: todayPlans.filter((p) => p.factory === 'big2').reduce((s, p) => s + p.qty_batch, 0),
        big1: todayPlans.filter((p) => p.factory === 'big1').reduce((s, p) => s + p.qty_batch, 0),
      });

      // Week total batch
      setWeekBatch({
        big2: plans.filter((p) => p.factory === 'big2').reduce((s, p) => s + p.qty_batch, 0),
        big1: plans.filter((p) => p.factory === 'big1').reduce((s, p) => s + p.qty_batch, 0),
      });

      // Week capacity per day
      const days = eachDayOfInterval({
        start: startOfWeek(new Date(), { weekStartsOn: 1 }),
        end: endOfWeek(new Date(), { weekStartsOn: 1 }),
      });
      const daySummaries: DaySummary[] = days.map((d) => {
        const dateKey = format(d, 'yyyy-MM-dd');
        const dayPlans = plans.filter((p) => p.plan_date === dateKey);
        return {
          date: dateKey,
          dayLabel: format(d, 'EEE', { locale: th }),
          big2Batch: dayPlans.filter((p) => p.factory === 'big2').reduce((s, p) => s + p.qty_batch, 0),
          big1Batch: dayPlans.filter((p) => p.factory === 'big1').reduce((s, p) => s + p.qty_batch, 0),
          isToday: dateKey === today,
        };
      });
      setWeekDays(daySummaries);

      // Pending orders count
      setPendingOrders(pendingCount || 0);
      setMcpdPending(mcpdCount || 0);
      setTotalProducts(prodCount || 0);
      setTotalCustomers(custCount || 0);

      // Urgent orders (P1-P3 or delivery <= 5 days)
      const pending = (pendingData || []) as unknown as Array<{
        id: string;
        qty_batch: number;
        delivery_date: string;
        priority: number;
        boi_level: string;
        requires_mcpd: boolean;
        status: string;
        product: { fg_code: string; name: string } | null;
        customer: { name: string } | null;
      }>;
      const urgent = pending
        .map((o) => ({
          id: o.id,
          fg_code: o.product?.fg_code || '?',
          customer_name: o.customer?.name || '?',
          qty_batch: o.qty_batch,
          delivery_date: o.delivery_date,
          priority: o.priority,
          boi_level: o.boi_level || 'NON',
          requires_mcpd: o.requires_mcpd,
          status: o.status,
          daysLeft: o.delivery_date ? differenceInDays(new Date(o.delivery_date), new Date()) : 999,
        }))
        .filter((o) => o.priority <= 3 || o.daysLeft <= 5)
        .sort((a, b) => a.priority - b.priority || a.daysLeft - b.daysLeft)
        .slice(0, 8);
      setUrgentOrders(urgent);

      // Top products this week
      const productMap = new Map<string, { name: string; total: number }>();
      for (const p of plans) {
        const fg = p.order?.product?.fg_code || 'unknown';
        const name = p.order?.product?.name || '';
        const existing = productMap.get(fg) || { name, total: 0 };
        existing.total += p.qty_batch;
        productMap.set(fg, existing);
      }
      const topProds = Array.from(productMap.entries())
        .map(([fg_code, v]) => ({ fg_code, name: v.name, total_batch: v.total }))
        .sort((a, b) => b.total_batch - a.total_batch)
        .slice(0, 6);
      setTopProducts(topProds);

      // BOI level summary for plans this week
      const boiMap = new Map<string, { count: number; batch: number }>();
      for (const p of plans) {
        const level = p.order?.boi_level || 'NON';
        const existing = boiMap.get(level) || { count: 0, batch: 0 };
        existing.count += 1;
        existing.batch += p.qty_batch;
        boiMap.set(level, existing);
      }
      const boiArr = Array.from(boiMap.entries())
        .map(([level, v]) => ({ level, count: v.count, batch: v.batch }))
        .sort((a, b) => a.level.localeCompare(b.level));
      setBoiSummary(boiArr);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const todayTotal = todayBatch.big2 + todayBatch.big1;
  const todayMax = FACTORIES.big2.maxBatchPerDay + FACTORIES.big1.maxBatchPerDay;
  const todayPct = todayMax > 0 ? Math.round((todayTotal / todayMax) * 100) : 0;
  const todayWeightKg = todayTotal * BATCH_KG;
  const weekTotal = weekBatch.big2 + weekBatch.big1;
  const weekWeightTons = ((weekTotal * BATCH_KG) / 1000).toFixed(1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        กำลังโหลด Dashboard...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ภาพรวมการผลิต</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: th })}
          </p>
        </div>
        <Link href="/board">
          <Button variant="outline" size="sm">
            ไปแผนผลิต <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Factory className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Batch วันนี้</span>
            </div>
            <div className="text-2xl font-bold">{todayTotal}</div>
            <div className="text-xs text-muted-foreground">{(todayWeightKg / 1000).toFixed(1)} ตัน ({todayPct}%)</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Batch สัปดาห์นี้</span>
            </div>
            <div className="text-2xl font-bold">{weekTotal}</div>
            <div className="text-xs text-muted-foreground">{weekWeightTons} ตัน</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">รอจัดแผน</span>
            </div>
            <div className="text-2xl font-bold">{pendingOrders}</div>
            <div className="text-xs text-muted-foreground">orders pending</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">MCPD ค้าง</span>
            </div>
            <div className="text-2xl font-bold">{mcpdPending}</div>
            <div className="text-xs text-muted-foreground">รอดำเนินการ</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-cyan-500" />
              <span className="text-xs text-muted-foreground">สินค้า</span>
            </div>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <div className="text-xs text-muted-foreground">FG codes</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-indigo-500" />
              <span className="text-xs text-muted-foreground">ลูกค้า</span>
            </div>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <div className="text-xs text-muted-foreground">ราย</div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Week Capacity + Urgent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Week Capacity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                กำลังผลิตสัปดาห์นี้
              </CardTitle>
              <Link href="/board" className="text-xs text-muted-foreground hover:text-primary">
                ดูแผนผลิต →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weekDays.map((day) => {
                const totalDay = day.big2Batch + day.big1Batch;
                const maxDay = FACTORIES.big2.maxBatchPerDay + FACTORIES.big1.maxBatchPerDay;
                const pct = maxDay > 0 ? Math.round((totalDay / maxDay) * 100) : 0;
                return (
                  <div key={day.date} className={`flex items-center gap-3 p-2 rounded-md ${day.isToday ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
                    <div className="w-8 text-center">
                      <div className={`text-xs font-medium ${day.isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {day.dayLabel}
                      </div>
                      {day.isToday && <div className="text-[9px] text-primary">วันนี้</div>}
                    </div>
                    <div className="flex-1">
                      <div className="flex gap-1 h-6">
                        {/* Big 2 bar */}
                        {day.big2Batch > 0 && (
                          <div
                            className="bg-blue-500 rounded-sm flex items-center justify-center text-[10px] text-white font-medium min-w-[20px]"
                            style={{ width: `${(day.big2Batch / maxDay) * 100}%` }}
                          >
                            {day.big2Batch > 10 ? `B2: ${day.big2Batch}` : ''}
                          </div>
                        )}
                        {/* Big 1 bar */}
                        {day.big1Batch > 0 && (
                          <div
                            className="bg-emerald-500 rounded-sm flex items-center justify-center text-[10px] text-white font-medium min-w-[20px]"
                            style={{ width: `${(day.big1Batch / maxDay) * 100}%` }}
                          >
                            {day.big1Batch > 10 ? `B1: ${day.big1Batch}` : ''}
                          </div>
                        )}
                        {totalDay === 0 && (
                          <div className="text-xs text-muted-foreground flex items-center">ว่าง</div>
                        )}
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <span className="text-xs font-medium">{totalDay} batch</span>
                      <span className="text-xs text-muted-foreground ml-1">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-blue-500" />
                Big 2 (max {FACTORIES.big2.maxBatchPerDay}/day)
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                Big 1 (max {FACTORIES.big1.maxBatchPerDay}/day)
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Urgent Orders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-red-500" />
                รายการเร่งด่วน
              </CardTitle>
              <Badge variant="secondary" className="text-xs">{urgentOrders.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {urgentOrders.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                ไม่มีรายการเร่งด่วน
              </div>
            ) : (
              <div className="space-y-2">
                {urgentOrders.map((o) => {
                  const boiColor = BOI_COLORS[o.boi_level as keyof typeof BOI_COLORS] || BOI_COLORS.NON;
                  const prioInfo = PRIORITY_LABELS[o.priority as keyof typeof PRIORITY_LABELS] || PRIORITY_LABELS[4];
                  return (
                    <div
                      key={o.id}
                      className="flex items-center gap-2 p-2 rounded-md border text-xs"
                      style={{ borderLeftColor: boiColor.border, borderLeftWidth: 3 }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{o.fg_code}</div>
                        <div className="text-muted-foreground truncate">{o.customer_name} - {o.qty_batch}B</div>
                      </div>
                      <div className="text-right shrink-0">
                        {o.daysLeft <= 3 ? (
                          <span className="text-red-600 font-medium">{o.daysLeft}d</span>
                        ) : (
                          <span className="text-muted-foreground">{o.daysLeft}d</span>
                        )}
                        <div className="flex gap-1 mt-0.5 justify-end">
                          {o.requires_mcpd && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-purple-100 text-purple-700">MCPD</Badge>
                          )}
                          <Badge variant="secondary" className="text-[9px] px-1 py-0" style={{ backgroundColor: boiColor.bg, color: boiColor.text }}>
                            {o.boi_level}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Products + Factory Status + BOI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Top Products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              สินค้ายอดผลิตสัปดาห์นี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูล</div>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, i) => {
                  const maxBatch = topProducts[0]?.total_batch || 1;
                  return (
                    <div key={p.fg_code} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{p.fg_code}</span>
                        <span className="text-muted-foreground">{p.total_batch} batch ({((p.total_batch * BATCH_KG) / 1000).toFixed(1)}t)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${(p.total_batch / maxBatch) * 100}%`, opacity: 1 - i * 0.1 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Factory Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Factory className="h-4 w-4" />
              สถานะโรงงานวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.entries(FACTORIES) as [FactoryKey, (typeof FACTORIES)[FactoryKey]][])
              .filter(([, f]) => f.maxBatchPerDay > 0)
              .map(([key, factory]) => {
                const used = key === 'big2' ? todayBatch.big2 : todayBatch.big1;
                const pct = factory.maxBatchPerDay > 0 ? Math.round((used / factory.maxBatchPerDay) * 100) : 0;
                const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500';
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">{factory.name}</div>
                        <div className="text-xs text-muted-foreground">{factory.lines} สายการผลิต</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{used}<span className="text-xs text-muted-foreground font-normal">/{factory.maxBatchPerDay}</span></div>
                        <div className="text-xs text-muted-foreground">{(used * BATCH_KG / 1000).toFixed(1)} ตัน</div>
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>

        {/* BOI Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              สัดส่วน BOI สัปดาห์นี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            {boiSummary.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูล</div>
            ) : (
              <div className="space-y-3">
                {boiSummary.map((b) => {
                  const boiColor = BOI_COLORS[b.level as keyof typeof BOI_COLORS] || BOI_COLORS.NON;
                  const totalWeek = weekTotal || 1;
                  const pct = Math.round((b.batch / totalWeek) * 100);
                  return (
                    <div key={b.level} className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className="text-xs w-14 justify-center"
                        style={{ backgroundColor: boiColor.bg, color: boiColor.text, borderColor: boiColor.border }}
                      >
                        {b.level}
                      </Badge>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: boiColor.border }}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-right w-20">
                        <div className="font-medium">{b.batch} batch</div>
                        <div className="text-muted-foreground">{b.count} orders ({pct}%)</div>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  รวม {weekTotal} batch = {weekWeightTons} ตัน
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/board">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-50 text-blue-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium">แผนผลิต</div>
                <div className="text-xs text-muted-foreground">จัดลำดับ + ลากวาง</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/boi">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-50 text-green-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium">BOI Dashboard</div>
                <div className="text-xs text-muted-foreground">ติดตามโควตา + MCPD</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/reports">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-50 text-purple-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium">รายงาน</div>
                <div className="text-xs text-muted-foreground">พิมพ์แผนรายวัน</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/bom">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-50 text-amber-600">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium">BOM</div>
                <div className="text-xs text-muted-foreground">สูตร + บรรจุภัณฑ์</div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
