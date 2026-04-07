'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  format,
} from 'date-fns';
import { th } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle, X, Rows3, Grid3x3 } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import FactoryToggle from './FactoryToggle';
import DayColumn from './DayColumn';
import LineBoard from './LineBoard';
import { OrderCardOverlay } from './OrderCard';
import OrderInbox from '@/components/inbox/OrderInbox';
import { usePlans } from '@/hooks/usePlans';
import { FACTORIES, type FactoryKey } from '@/lib/constants';
import type { BoardPlan } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function ProductionBoard() {
  const [factory, setFactory] = useState<FactoryKey>('big2');
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<'day' | 'line'>('line');
  const [activePlan, setActivePlan] = useState<BoardPlan | null>(null);
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const baseDate = useMemo(() => {
    let d = new Date();
    if (weekOffset > 0) d = addWeeks(d, weekOffset);
    if (weekOffset < 0) d = subWeeks(d, Math.abs(weekOffset));
    return d;
  }, [weekOffset]);

  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { plans, loading, error, reorderPlans, refetch: refetchPlans } = usePlans(factory, weekStart, weekEnd);
  const maxBatch = FACTORIES[factory].maxBatchPerDay;

  // Sensor: require 5px movement before activating drag (prevents accidental drags)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Group plans by date
  const plansByDate = useMemo(() => {
    const map: Record<string, BoardPlan[]> = {};
    for (const plan of plans) {
      const key = plan.plan_date;
      if (!map[key]) map[key] = [];
      map[key].push(plan);
    }
    // Sort each group by sort_order
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [plans]);

  // --- Helpers ---

  /** Find which date column a plan belongs to */
  const findDateForPlan = useCallback(
    (planId: UniqueIdentifier): string | null => {
      for (const [dateKey, datePlans] of Object.entries(plansByDate)) {
        if (datePlans.some((p) => p.id === planId)) return dateKey;
      }
      return null;
    },
    [plansByDate]
  );

  /** Extract the dateKey from a droppable container id like "column-2026-04-07" */
  const parseDateFromDroppableId = (id: UniqueIdentifier): string | null => {
    const str = String(id);
    if (str.startsWith('column-')) return str.replace('column-', '');
    return null;
  };

  /** Resolve the target dateKey from an over id — could be a column or a card */
  const resolveTargetDate = useCallback(
    (overId: UniqueIdentifier): string | null => {
      // Check if it's a column id
      const columnDate = parseDateFromDroppableId(overId);
      if (columnDate) return columnDate;
      // Otherwise it's a card id — find which date column it belongs to
      return findDateForPlan(overId);
    },
    [findDateForPlan]
  );

  // --- Collision detection ---
  // Use a combined strategy: pointerWithin first (better for cross-column),
  // fall back to closestCenter, then rectIntersection
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First check pointer-within (works well for dropping into containers)
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;

    // Then try closest center
    const centerCollisions = closestCenter(args);
    if (centerCollisions.length > 0) return centerCollisions;

    // Fallback to rect intersection
    return rectIntersection(args);
  }, []);

  // --- Drag handlers ---

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const plan = plans.find((p) => p.id === active.id);
      if (plan) setActivePlan(plan);
    },
    [plans]
  );

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Visual feedback is handled by useDroppable.isOver in DayColumn
    // No state changes needed here
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActivePlan(null);

      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = over.id;

      // Determine source and target dates
      const sourceDate = findDateForPlan(activeId);
      const targetDate = resolveTargetDate(overId);

      if (!sourceDate || !targetDate) return;

      const sourcePlans = [...(plansByDate[sourceDate] || [])];
      const targetPlans =
        sourceDate === targetDate
          ? sourcePlans
          : [...(plansByDate[targetDate] || [])];

      const activeIndex = sourcePlans.findIndex((p) => p.id === activeId);
      if (activeIndex === -1) return;

      const movedPlan = sourcePlans[activeIndex];

      // --- Capacity check (soft limit) ---
      if (sourceDate !== targetDate) {
        const targetBatchTotal = targetPlans.reduce((sum, p) => sum + p.qty_batch, 0);
        const newTotal = targetBatchTotal + movedPlan.qty_batch;
        if (newTotal > maxBatch) {
          const pct = Math.round((newTotal / maxBatch) * 100);
          showCapacityWarning(
            `${format(new Date(targetDate), 'd MMM', { locale: th })}: ${newTotal}/${maxBatch} batch (${pct}%) — เกินกำลังผลิต`
          );
        }
      }

      // --- Same column reorder ---
      if (sourceDate === targetDate) {
        const overColumnDate = parseDateFromDroppableId(overId);
        // Dropped on the column itself (not on a card) — no reorder needed
        if (overColumnDate) return;

        const overIndex = sourcePlans.findIndex((p) => p.id === String(overId));
        if (overIndex === -1 || activeIndex === overIndex) return;

        const reordered = arrayMove(sourcePlans, activeIndex, overIndex);
        const updates = reordered.map((p, i) => ({
          id: p.id,
          plan_date: sourceDate,
          sort_order: i,
        }));
        reorderPlans(updates);
        return;
      }

      // --- Cross-column move ---
      // Remove from source
      sourcePlans.splice(activeIndex, 1);
      const sourceUpdates = sourcePlans.map((p, i) => ({
        id: p.id,
        plan_date: sourceDate,
        sort_order: i,
      }));

      // Insert into target
      const overColumnDate = parseDateFromDroppableId(overId);
      let insertIndex: number;
      if (overColumnDate) {
        // Dropped on the column container — append to end
        insertIndex = targetPlans.length;
      } else {
        // Dropped on a specific card — insert at that position
        const overIdx = targetPlans.findIndex((p) => p.id === String(overId));
        insertIndex = overIdx >= 0 ? overIdx : targetPlans.length;
      }

      const newTargetPlans = [...targetPlans];
      newTargetPlans.splice(insertIndex, 0, movedPlan);
      const targetUpdates = newTargetPlans.map((p, i) => ({
        id: p.id,
        plan_date: targetDate,
        sort_order: i,
      }));

      reorderPlans([...sourceUpdates, ...targetUpdates]);
    },
    [plansByDate, findDateForPlan, resolveTargetDate, maxBatch, reorderPlans]
  );

  const handleDragCancel = useCallback(() => {
    setActivePlan(null);
  }, []);

  // --- Capacity warning display ---
  const showCapacityWarning = (msg: string) => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setCapacityWarning(msg);
    warningTimerRef.current = setTimeout(() => setCapacityWarning(null), 5000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">แผนผลิต</h1>
          <FactoryToggle value={factory} onChange={setFactory} />
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setViewMode('day')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors border-r',
                viewMode === 'day'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              )}
            >
              <Rows3 className="h-3.5 w-3.5" />
              มุมมองวัน
            </button>
            <button
              onClick={() => setViewMode('line')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'line'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent'
              )}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
              มุมมองสาย
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OrderInbox onOrderPlaced={refetchPlans} />
          <div className="w-px h-6 bg-border" />
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(0)}
            className="text-xs"
          >
            สัปดาห์นี้
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">
            {format(weekStart, 'd MMM', { locale: th })} —{' '}
            {format(weekEnd, 'd MMM yyyy', { locale: th })}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Capacity warning banner */}
      {capacityWarning && (
        <div className="mx-4 mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 rounded-md text-sm text-amber-800 animate-in slide-in-from-top-2 duration-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{capacityWarning}</span>
          <button
            onClick={() => setCapacityWarning(null)}
            className="text-amber-600 hover:text-amber-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            กำลังโหลด...
          </div>
        ) : viewMode === 'line' ? (
          <LineBoard
            factory={factory}
            plans={plans}
            days={days}
            maxBatch={maxBatch}
            onReorder={reorderPlans}
            onStatusChange={refetchPlans}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex gap-3">
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                return (
                  <DayColumn
                    key={dateKey}
                    date={day}
                    dateKey={dateKey}
                    plans={plansByDate[dateKey] || []}
                    maxBatch={maxBatch}
                    onStatusChange={refetchPlans}
                  />
                );
              })}
            </div>

            <DragOverlay dropAnimation={null}>
              {activePlan ? <OrderCardOverlay plan={activePlan} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
