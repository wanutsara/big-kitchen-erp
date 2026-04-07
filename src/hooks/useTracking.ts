'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { BATCH_KG } from '@/lib/constants';
import { format } from 'date-fns';

/**
 * Generate a lot number in the format: BK-{YYMMDD}-{FGcode}-{seq}
 * e.g. BK-260407-FG0218-001
 */
async function generateLotNumber(fgCode: string): Promise<string> {
  const supabase = createClient();
  const today = new Date();
  const dateStr = format(today, 'yyMMdd');
  const prefix = `BK-${dateStr}-${fgCode}-`;

  // Find existing lots with same prefix to determine sequence
  const { data: existingLots } = await supabase
    .from('lots')
    .select('lot_number')
    .like('lot_number', `${prefix}%`)
    .order('lot_number', { ascending: false })
    .limit(1);

  let seq = 1;
  if (existingLots && existingLots.length > 0) {
    const lastLot = existingLots[0].lot_number;
    const lastSeq = parseInt(lastLot.split('-').pop() || '0', 10);
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export function useTracking() {
  /**
   * Start production: status planned -> producing, set actual_start = now()
   */
  const startProduction = useCallback(async (planId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('production_plans')
      .update({
        status: 'producing',
        actual_start: new Date().toISOString(),
      })
      .eq('id', planId);

    if (error) throw error;

    // Also update the linked order status
    const { data: plan } = await supabase
      .from('production_plans')
      .select('order_id')
      .eq('id', planId)
      .single();

    if (plan?.order_id) {
      await supabase
        .from('orders')
        .update({ status: 'producing' })
        .eq('id', plan.order_id);
    }
  }, []);

  /**
   * Complete production: status producing -> done, set actual_end = now(),
   * generate lot number and insert into lots table
   */
  const completeProduction = useCallback(
    async (planId: string, fgCode: string, actualBatch?: number) => {
      const supabase = createClient();

      // Get the plan to determine qty_batch
      const { data: plan } = await supabase
        .from('production_plans')
        .select('qty_batch, order_id')
        .eq('id', planId)
        .single();

      if (!plan) throw new Error('Plan not found');

      const batchCount = actualBatch ?? plan.qty_batch;
      const lotNumber = await generateLotNumber(fgCode);

      // Update plan status
      const { error: planError } = await supabase
        .from('production_plans')
        .update({
          status: 'done',
          actual_end: new Date().toISOString(),
          actual_batch: batchCount,
        })
        .eq('id', planId);

      if (planError) throw planError;

      // Insert lot record
      const { error: lotError } = await supabase.from('lots').insert({
        plan_id: planId,
        lot_number: lotNumber,
        lot_date: format(new Date(), 'yyyy-MM-dd'),
        weight_kg: batchCount * BATCH_KG,
        batch_count: batchCount,
        status: 'produced',
      });

      if (lotError) throw lotError;

      // Update order status
      if (plan.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'done' })
          .eq('id', plan.order_id);
      }

      return lotNumber;
    },
    []
  );

  /**
   * Pause production: status producing -> planned (stop/pause)
   */
  const pauseProduction = useCallback(async (planId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('production_plans')
      .update({
        status: 'planned',
        actual_start: null,
      })
      .eq('id', planId);

    if (error) throw error;

    // Revert order status
    const { data: plan } = await supabase
      .from('production_plans')
      .select('order_id')
      .eq('id', planId)
      .single();

    if (plan?.order_id) {
      await supabase
        .from('orders')
        .update({ status: 'planned' })
        .eq('id', plan.order_id);
    }
  }, []);

  /**
   * Update actual_batch for a plan (editable field on tracking page)
   */
  const updateActualBatch = useCallback(async (planId: string, actualBatch: number) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('production_plans')
      .update({ actual_batch: actualBatch })
      .eq('id', planId);

    if (error) throw error;
  }, []);

  /**
   * Update line_number assignment for a plan
   */
  const updateLineNumber = useCallback(async (planId: string, lineNumber: number) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('production_plans')
      .update({ line_number: lineNumber })
      .eq('id', planId);

    if (error) throw error;
  }, []);

  /**
   * Get lot info for a completed plan
   */
  const getLotForPlan = useCallback(async (planId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('lots')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data;
  }, []);

  return {
    startProduction,
    completeProduction,
    pauseProduction,
    updateActualBatch,
    updateLineNumber,
    getLotForPlan,
  };
}
