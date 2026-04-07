'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import type { BoardPlan, FactoryType } from '@/lib/types';
import { format } from 'date-fns';

export function usePlans(factory: FactoryType, weekStart: Date, weekEnd: Date) {
  const [plans, setPlans] = useState<BoardPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use string keys to avoid Date object reference issues
  const startStr = format(weekStart, 'yyyy-MM-dd');
  const endStr = format(weekEnd, 'yyyy-MM-dd');

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
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
        .gte('plan_date', startStr)
        .lte('plan_date', endStr)
        .neq('status', 'cancelled')
        .order('sort_order', { ascending: true });

      if (err) throw err;
      setPlans((data as BoardPlan[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  }, [factory, startStr, endStr]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  /** Move a plan to a new date and/or update its sort_order and line_number. Optimistic update included. */
  const movePlan = useCallback(
    async (planId: string, newDate: string, newSortOrder: number, lineNumber?: number | null) => {
      // Optimistic update
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? { ...p, plan_date: newDate, sort_order: newSortOrder, ...(lineNumber !== undefined ? { line_number: lineNumber } : {}) }
            : p
        )
      );

      try {
        const supabase = createClient();
        const updatePayload: Record<string, unknown> = { plan_date: newDate, sort_order: newSortOrder };
        if (lineNumber !== undefined) updatePayload.line_number = lineNumber;
        const { error: err } = await supabase
          .from('production_plans')
          .update(updatePayload)
          .eq('id', planId);

        if (err) throw err;
      } catch (e) {
        // Revert on failure
        setError(e instanceof Error ? e.message : 'Failed to move plan');
        await fetchPlans();
      }
    },
    [fetchPlans]
  );

  /** Batch-update sort_order (and optionally line_number) for multiple plans (used after reorder). */
  const reorderPlans = useCallback(
    async (updates: { id: string; plan_date: string; sort_order: number; line_number?: number | null }[]) => {
      // Optimistic update
      setPlans((prev) => {
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        return prev.map((p) => {
          const upd = updateMap.get(p.id);
          if (!upd) return p;
          return {
            ...p,
            plan_date: upd.plan_date,
            sort_order: upd.sort_order,
            ...(upd.line_number !== undefined ? { line_number: upd.line_number } : {}),
          };
        });
      });

      try {
        const supabase = createClient();
        // Use individual updates in parallel for simplicity
        const results = await Promise.all(
          updates.map((u) => {
            const payload: Record<string, unknown> = { plan_date: u.plan_date, sort_order: u.sort_order };
            if (u.line_number !== undefined) payload.line_number = u.line_number;
            return supabase
              .from('production_plans')
              .update(payload)
              .eq('id', u.id);
          })
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to reorder plans');
        await fetchPlans();
      }
    },
    [fetchPlans]
  );

  return { plans, setPlans, loading, error, refetch: fetchPlans, movePlan, reorderPlans };
}
