'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { BATCH_KG } from '@/lib/constants';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface RecipeBomRow {
  id: string;
  weight_kg: number;
  yield_kg: number | null;
  ingredient: {
    code: string;
    name: string | null;
    category: string | null;
  };
}

interface RecipeBomProps {
  productId: string;
  qtyBatch: number;
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  surimi:      { label: 'surimi',        color: 'bg-blue-100 text-blue-700 border-blue-300' },
  seasoning:   { label: 'seasoning',     color: 'bg-amber-100 text-amber-700 border-amber-300' },
  additive:    { label: 'additive',      color: 'bg-purple-100 text-purple-700 border-purple-300' },
  starch:      { label: 'starch',        color: 'bg-orange-100 text-orange-700 border-orange-300' },
  oil:         { label: 'oil',           color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  preservative:{ label: 'preservative',  color: 'bg-red-100 text-red-700 border-red-300' },
  water:       { label: 'water',         color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
};

function getIngredientCategory(code: string, dbCategory: string | null): string {
  if (dbCategory) return dbCategory;
  const prefix = code.substring(0, 2).toUpperCase();
  if (prefix === 'R1') return 'surimi';
  if (prefix === 'R2') return 'seasoning';
  if (prefix === 'R3') return 'additive';
  if (prefix === 'R5') return 'starch';
  if (prefix === 'R8') return 'oil';
  return 'other';
}

export default function RecipeBom({ productId, qtyBatch }: RecipeBomProps) {
  const [rows, setRows] = useState<RecipeBomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecipe() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: err } = await supabase
          .from('recipe_bom')
          .select(`
            id,
            weight_kg,
            yield_kg,
            ingredient:ingredients(code, name, category)
          `)
          .eq('product_id', productId)
          .order('weight_kg', { ascending: false });

        if (err) throw err;
        setRows((data as unknown as RecipeBomRow[]) || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch recipe');
      } finally {
        setLoading(false);
      }
    }

    fetchRecipe();
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <div className="text-sm font-medium">no recipe data</div>
        <div className="text-xs">
          recipe_bom has not been set for this product yet
        </div>
      </div>
    );
  }

  const totalWeightPerBatch = rows.reduce((sum, r) => sum + r.weight_kg, 0);
  const totalWeightAll = totalWeightPerBatch * qtyBatch;
  const yieldKg = rows[0]?.yield_kg ?? BATCH_KG;
  const yieldPct = yieldKg > 0 ? (yieldKg / totalWeightPerBatch) * 100 : 0;

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>R-code</TableHead>
            <TableHead>category</TableHead>
            <TableHead className="text-right">weight/batch (kg)</TableHead>
            <TableHead className="text-right">total weight (kg)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const cat = getIngredientCategory(
              row.ingredient.code,
              row.ingredient.category
            );
            const catInfo = CATEGORY_MAP[cat] || {
              label: cat,
              color: 'bg-gray-100 text-gray-700 border-gray-300',
            };
            return (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">
                  {row.ingredient.code}
                  {row.ingredient.name && (
                    <span className="ml-1.5 text-muted-foreground font-sans">
                      {row.ingredient.name}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${catInfo.color}`}
                  >
                    {catInfo.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.weight_kg.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(row.weight_kg * qtyBatch).toFixed(2)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              total input
            </TableCell>
            <TableCell className="text-right font-mono font-medium">
              {totalWeightPerBatch.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-mono font-medium">
              {totalWeightAll.toFixed(2)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      <div className="flex gap-4 text-xs text-muted-foreground px-2">
        <span>
          Yield/batch: <strong className="text-foreground">{yieldKg} kg</strong>
        </span>
        <span>
          Yield %: <strong className="text-foreground">{yieldPct.toFixed(1)}%</strong>
        </span>
        <span>
          {rows.length} ingredients
        </span>
      </div>
    </div>
  );
}
