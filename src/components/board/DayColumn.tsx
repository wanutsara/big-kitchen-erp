'use client';

import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { format, isToday } from 'date-fns';
import { th } from 'date-fns/locale';
import CapacityBar from './CapacityBar';
import OrderCard from './OrderCard';
import type { BoardPlan } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DayColumnProps {
  date: Date;
  dateKey: string;
  plans: BoardPlan[];
  maxBatch: number;
  onStatusChange?: () => void;
}

export default function DayColumn({ date, dateKey, plans, maxBatch, onStatusChange }: DayColumnProps) {
  const totalBatch = plans.reduce((sum, p) => sum + p.qty_batch, 0);
  const sorted = useMemo(
    () => [...plans].sort((a, b) => a.sort_order - b.sort_order),
    [plans]
  );

  const sortableIds = useMemo(() => sorted.map((p) => p.id), [sorted]);

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${dateKey}`,
    data: {
      type: 'day-column',
      dateKey,
    },
  });

  return (
    <div
      className={cn(
        'flex flex-col min-w-[220px] w-[220px] rounded-lg border bg-card transition-colors',
        isToday(date) && 'ring-2 ring-primary',
        isOver && 'bg-primary/5 border-primary/40'
      )}
    >
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">
              {format(date, 'EEE', { locale: th })}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(date, 'd MMM yyyy', { locale: th })}
            </div>
          </div>
          {isToday(date) && (
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
              วันนี้
            </span>
          )}
        </div>
        <CapacityBar used={totalBatch} max={maxBatch} />
      </div>

      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            'flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] transition-colors',
            isOver && 'bg-primary/5'
          )}
        >
          {sorted.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              {isOver ? 'วางที่นี่' : 'ไม่มีแผนผลิต'}
            </div>
          ) : (
            sorted.map((plan) => <OrderCard key={plan.id} plan={plan} onStatusChange={onStatusChange} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}
