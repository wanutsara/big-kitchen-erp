'use client';

import { useMemo } from 'react';
import { FACTORIES, type FactoryKey } from '@/lib/constants';
import type { BoardPlan } from '@/lib/types';
import { format } from 'date-fns';

export function useCapacity(plans: BoardPlan[], factory: FactoryKey) {
  const maxBatch = FACTORIES[factory].maxBatchPerDay;

  const dailyCapacity = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const plan of plans) {
      const date = plan.plan_date;
      byDate[date] = (byDate[date] || 0) + plan.qty_batch;
    }
    return byDate;
  }, [plans]);

  const getCapacity = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    return {
      used: dailyCapacity[key] || 0,
      max: maxBatch,
      pct: maxBatch > 0 ? Math.round(((dailyCapacity[key] || 0) / maxBatch) * 100) : 0,
    };
  };

  return { maxBatch, dailyCapacity, getCapacity };
}
