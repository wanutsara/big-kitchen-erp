'use client';

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { LINE_BATCH_PER_DAY, CAPACITY_THRESHOLDS } from '@/lib/constants';
import OrderCard from './OrderCard';
import type { BoardPlan } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface LineSlotProps {
  dateKey: string;
  lineNumber: number | null;
  plans: BoardPlan[];
  onStatusChange?: () => void;
}

export default function LineSlot({ dateKey, lineNumber, plans, onStatusChange }: LineSlotProps) {
  const droppableId = lineNumber != null
    ? `slot-${dateKey}-${lineNumber}`
    : `slot-${dateKey}-unassigned`;

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      type: 'line-slot',
      dateKey,
      lineNumber,
    },
  });

  const sorted = useMemo(
    () => [...plans].sort((a, b) => a.sort_order - b.sort_order),
    [plans]
  );

  const sortableIds = useMemo(() => sorted.map((p) => p.id), [sorted]);

  const totalBatch = plans.reduce((sum, p) => sum + p.qty_batch, 0);

  // Line capacity indicator (only for numbered lines, not unassigned)
  const showLineCapacity = lineNumber != null && totalBatch > 0;
  const linePct = showLineCapacity ? Math.round((totalBatch / LINE_BATCH_PER_DAY) * 100) : 0;
  const lineOverCapacity = linePct > CAPACITY_THRESHOLDS.critical;
  const lineWarning = linePct > CAPACITY_THRESHOLDS.warning;

  return (
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[60px] p-1 border border-transparent rounded transition-colors relative',
          isOver && 'bg-primary/10 border-primary/40',
          !isOver && sorted.length === 0 && 'border-dashed border-muted-foreground/20',
        )}
      >
        {/* Line capacity micro-indicator */}
        {showLineCapacity && (
          <div className={cn(
            'text-[9px] font-medium mb-0.5 px-1',
            lineOverCapacity ? 'text-red-600' : lineWarning ? 'text-amber-600' : 'text-muted-foreground'
          )}>
            {totalBatch}/{LINE_BATCH_PER_DAY}B
          </div>
        )}

        {sorted.length === 0 ? (
          <div className={cn(
            'flex items-center justify-center h-[52px] text-muted-foreground/40 transition-colors',
            isOver && 'text-primary/60'
          )}>
            {isOver ? (
              <span className="text-[10px] font-medium">วางที่นี่</span>
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {sorted.map((plan) => (
              <OrderCard key={plan.id} plan={plan} compact onStatusChange={onStatusChange} />
            ))}
          </div>
        )}
      </div>
    </SortableContext>
  );
}
