'use client';

import { useMemo, useCallback, useRef, useState } from 'react';
import { format, isToday } from 'date-fns';
import { th } from 'date-fns/locale';
import { AlertTriangle, X } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCenter,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import CapacityBar from './CapacityBar';
import LineSlot from './LineSlot';
import { OrderCardOverlay } from './OrderCard';
import { FACTORIES, LINE_BATCH_PER_DAY, type FactoryKey } from '@/lib/constants';
import type { BoardPlan } from '@/lib/types';
import { cn } from '@/lib/utils';

interface LineBoardProps {
  factory: FactoryKey;
  plans: BoardPlan[];
  days: Date[];
  maxBatch: number;
  onReorder: (updates: { id: string; plan_date: string; sort_order: number; line_number?: number | null }[]) => void;
  onStatusChange: () => void;
}

/** Parse a slot droppable ID like "slot-2026-04-07-3" or "slot-2026-04-07-unassigned" */
function parseSlotId(id: string): { dateKey: string; lineNumber: number | null } | null {
  const str = String(id);
  if (!str.startsWith('slot-')) return null;

  // Try unassigned first
  const unassignedSuffix = '-unassigned';
  if (str.endsWith(unassignedSuffix)) {
    const dateKey = str.slice(5, str.length - unassignedSuffix.length);
    return { dateKey, lineNumber: null };
  }

  // Otherwise extract line number from last segment: slot-YYYY-MM-DD-N
  const lastDash = str.lastIndexOf('-');
  const lineStr = str.slice(lastDash + 1);
  const lineNum = parseInt(lineStr, 10);
  if (isNaN(lineNum)) return null;
  // dateKey is between "slot-" and the last dash
  const dateKey = str.slice(5, lastDash);
  return { dateKey, lineNumber: lineNum };
}

export default function LineBoard({ factory, plans, days, maxBatch, onReorder, onStatusChange }: LineBoardProps) {
  const numLines = FACTORIES[factory].lines;
  const [activePlan, setActivePlan] = useState<BoardPlan | null>(null);
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Group plans by dateKey + lineNumber
  const plansBySlot = useMemo(() => {
    const map: Record<string, BoardPlan[]> = {};
    for (const plan of plans) {
      const line = plan.line_number;
      const slotKey = line != null ? `${plan.plan_date}-${line}` : `${plan.plan_date}-unassigned`;
      if (!map[slotKey]) map[slotKey] = [];
      map[slotKey].push(plan);
    }
    // Sort each slot by sort_order
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [plans]);

  // Plans grouped by date (for capacity bar)
  const batchByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const plan of plans) {
      map[plan.plan_date] = (map[plan.plan_date] || 0) + plan.qty_batch;
    }
    return map;
  }, [plans]);

  const getPlansForSlot = useCallback(
    (dateKey: string, lineNumber: number | null): BoardPlan[] => {
      const slotKey = lineNumber != null ? `${dateKey}-${lineNumber}` : `${dateKey}-unassigned`;
      return plansBySlot[slotKey] || [];
    },
    [plansBySlot]
  );

  /** Find which slot a plan belongs to */
  const findSlotForPlan = useCallback(
    (planId: UniqueIdentifier): { dateKey: string; lineNumber: number | null } | null => {
      for (const plan of plans) {
        if (plan.id === planId) {
          return { dateKey: plan.plan_date, lineNumber: plan.line_number };
        }
      }
      return null;
    },
    [plans]
  );

  /** Resolve target slot from an over ID (could be a slot droppable or a card) */
  const resolveTargetSlot = useCallback(
    (overId: UniqueIdentifier): { dateKey: string; lineNumber: number | null } | null => {
      // First check if it's a slot droppable
      const parsed = parseSlotId(String(overId));
      if (parsed) return parsed;
      // Otherwise it's a card -- find which slot it belongs to
      return findSlotForPlan(overId);
    },
    [findSlotForPlan]
  );

  // Collision detection strategy
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    const centerCollisions = closestCenter(args);
    if (centerCollisions.length > 0) return centerCollisions;
    return rectIntersection(args);
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const plan = plans.find((p) => p.id === event.active.id);
      if (plan) setActivePlan(plan);
    },
    [plans]
  );

  const showCapacityWarning = (msg: string) => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setCapacityWarning(msg);
    warningTimerRef.current = setTimeout(() => setCapacityWarning(null), 5000);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActivePlan(null);

      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const sourceSlot = findSlotForPlan(activeId);
      const targetSlot = resolveTargetSlot(over.id);

      if (!sourceSlot || !targetSlot) return;

      const sourceKey = sourceSlot.lineNumber != null
        ? `${sourceSlot.dateKey}-${sourceSlot.lineNumber}`
        : `${sourceSlot.dateKey}-unassigned`;
      const targetKey = targetSlot.lineNumber != null
        ? `${targetSlot.dateKey}-${targetSlot.lineNumber}`
        : `${targetSlot.dateKey}-unassigned`;

      const sourcePlans = [...(plansBySlot[sourceKey] || [])];
      const targetPlans = sourceKey === targetKey
        ? sourcePlans
        : [...(plansBySlot[targetKey] || [])];

      const activeIndex = sourcePlans.findIndex((p) => p.id === activeId);
      if (activeIndex === -1) return;

      const movedPlan = sourcePlans[activeIndex];

      // --- Capacity checks ---
      // Per-day capacity
      if (sourceSlot.dateKey !== targetSlot.dateKey) {
        const targetDateBatch = batchByDate[targetSlot.dateKey] || 0;
        const newTotal = targetDateBatch + movedPlan.qty_batch;
        if (newTotal > maxBatch) {
          const pct = Math.round((newTotal / maxBatch) * 100);
          showCapacityWarning(
            `${format(new Date(targetSlot.dateKey), 'd MMM', { locale: th })}: ${newTotal}/${maxBatch} batch (${pct}%) -- เกินกำลังผลิตโรงงาน`
          );
        }
      }

      // Per-line capacity
      if (targetSlot.lineNumber != null) {
        const lineBatch = targetPlans.reduce((sum, p) => sum + p.qty_batch, 0);
        const newLineBatch = (sourceKey === targetKey ? lineBatch : lineBatch + movedPlan.qty_batch);
        if (newLineBatch > LINE_BATCH_PER_DAY) {
          showCapacityWarning(
            `สาย ${targetSlot.lineNumber} ${format(new Date(targetSlot.dateKey), 'd MMM', { locale: th })}: ${newLineBatch}/${LINE_BATCH_PER_DAY} batch -- เกินกำลังต่อสาย`
          );
        }
      }

      // --- Same slot reorder ---
      if (sourceKey === targetKey) {
        const isSlotDroppable = parseSlotId(String(over.id)) !== null;
        if (isSlotDroppable) return; // dropped on slot container, no reorder

        const overIndex = sourcePlans.findIndex((p) => p.id === String(over.id));
        if (overIndex === -1 || activeIndex === overIndex) return;

        const reordered = arrayMove(sourcePlans, activeIndex, overIndex);
        const updates = reordered.map((p, i) => ({
          id: p.id,
          plan_date: sourceSlot.dateKey,
          sort_order: i,
          line_number: sourceSlot.lineNumber,
        }));
        onReorder(updates);
        return;
      }

      // --- Cross-slot move ---
      sourcePlans.splice(activeIndex, 1);
      const sourceUpdates = sourcePlans.map((p, i) => ({
        id: p.id,
        plan_date: sourceSlot.dateKey,
        sort_order: i,
        line_number: sourceSlot.lineNumber,
      }));

      // Determine insert position
      const isSlotDroppable = parseSlotId(String(over.id)) !== null;
      let insertIndex: number;
      if (isSlotDroppable) {
        insertIndex = targetPlans.length;
      } else {
        const overIdx = targetPlans.findIndex((p) => p.id === String(over.id));
        insertIndex = overIdx >= 0 ? overIdx : targetPlans.length;
      }

      const newTargetPlans = [...targetPlans];
      newTargetPlans.splice(insertIndex, 0, movedPlan);
      const targetUpdates = newTargetPlans.map((p, i) => ({
        id: p.id,
        plan_date: targetSlot.dateKey,
        sort_order: i,
        line_number: targetSlot.lineNumber,
      }));

      onReorder([...sourceUpdates, ...targetUpdates]);
    },
    [plans, plansBySlot, batchByDate, maxBatch, findSlotForPlan, resolveTargetSlot, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActivePlan(null);
  }, []);

  // Grid template: sticky label column + day columns
  const gridCols = `80px repeat(${days.length}, minmax(160px, 1fr))`;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Capacity warning banner */}
      {capacityWarning && (
        <div className="mb-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-300 rounded-md text-sm text-amber-800 animate-in slide-in-from-top-2 duration-200">
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

      <div className="overflow-auto border rounded-lg bg-card">
        {/* --- Sticky header row: day labels + capacity --- */}
        <div
          className="grid sticky top-0 z-20 bg-card border-b"
          style={{ gridTemplateColumns: gridCols }}
        >
          {/* Corner cell */}
          <div className="px-2 py-2 text-xs font-medium text-muted-foreground sticky left-0 z-30 bg-card border-r">
            สาย
          </div>
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const usedBatch = batchByDate[dateKey] || 0;
            return (
              <div
                key={dateKey}
                className={cn(
                  'px-2 py-2 border-r last:border-r-0',
                  isToday(day) && 'bg-primary/5'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">
                    {format(day, 'EEE d/M', { locale: th })}
                  </span>
                  {isToday(day) && (
                    <span className="text-[9px] bg-primary text-primary-foreground px-1 py-0.5 rounded-full">
                      วันนี้
                    </span>
                  )}
                </div>
                <CapacityBar used={usedBatch} max={maxBatch} />
              </div>
            );
          })}
        </div>

        {/* --- Line rows --- */}
        {Array.from({ length: numLines }, (_, i) => i + 1).map((lineNum) => (
          <div
            key={lineNum}
            className="grid border-b last:border-b-0"
            style={{ gridTemplateColumns: gridCols }}
          >
            {/* Line label (sticky left) */}
            <div className="px-2 py-2 text-xs font-medium sticky left-0 z-10 bg-card border-r flex items-start">
              <div>
                <div>สาย {lineNum}</div>
                <div className="text-[9px] text-muted-foreground font-normal">{LINE_BATCH_PER_DAY}B/วัน</div>
              </div>
            </div>
            {/* Day cells */}
            {days.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              return (
                <div
                  key={`${dateKey}-${lineNum}`}
                  className={cn(
                    'border-r last:border-r-0',
                    isToday(day) && 'bg-primary/[0.02]'
                  )}
                >
                  <LineSlot
                    dateKey={dateKey}
                    lineNumber={lineNum}
                    plans={getPlansForSlot(dateKey, lineNum)}
                    onStatusChange={onStatusChange}
                  />
                </div>
              );
            })}
          </div>
        ))}

        {/* --- Unassigned row --- */}
        <div
          className="grid border-t-2 border-dashed"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="px-2 py-2 text-xs font-medium text-muted-foreground sticky left-0 z-10 bg-muted/30 border-r flex items-start">
            ไม่จัดสาย
          </div>
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            return (
              <div
                key={`${dateKey}-unassigned`}
                className={cn(
                  'border-r last:border-r-0 bg-muted/10',
                  isToday(day) && 'bg-primary/[0.02]'
                )}
              >
                <LineSlot
                  dateKey={dateKey}
                  lineNumber={null}
                  plans={getPlansForSlot(dateKey, null)}
                  onStatusChange={onStatusChange}
                />
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activePlan ? <OrderCardOverlay plan={activePlan} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
