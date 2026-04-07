'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import type { Order } from '@/lib/types';

export function useOrders(status?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          product:products(*)
        `)
        .order('priority', { ascending: true })
        .order('delivery_date', { ascending: true });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setOrders((data as Order[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}
