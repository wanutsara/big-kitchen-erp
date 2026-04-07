'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { BOM_RATIOS } from '@/lib/constants';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface PackagingBomRow {
  id: string;
  ratio_avg: number | null;
  ratio_min: number | null;
  ratio_max: number | null;
  sample_count: number | null;
  ratio_type: string;
  material: {
    code: string;
    short_code: string | null;
    name: string;
    type: string | null;
  };
}

interface FallbackRow {
  key: string;
  materialCode: string;
  avg: number;
  min: number;
  max: number;
  n: number;
  stable: boolean;
}

interface PackagingBomProps {
  productId: string;
  fgCode: string;
  qtyBatch: number;
}

function getConfidenceBadge(n: number) {
  if (n >= 20) return { label: `n=${n}`, color: 'bg-green-100 text-green-700 border-green-300' };
  if (n >= 10) return { label: `n=${n}`, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
  return { label: `n=${n}`, color: 'bg-red-100 text-red-700 border-red-300' };
}

export default function PackagingBom({ productId, fgCode, qtyBatch }: PackagingBomProps) {
  const [dbRows, setDbRows] = useState<PackagingBomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actuals, setActuals] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchPackaging() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        // Fetch packaging_bom via the product's SKUs
        const { data: skus } = await supabase
          .from('skus')
          .select('id')
          .eq('product_id', productId);

        if (skus && skus.length > 0) {
          const skuIds = skus.map((s: { id: string }) => s.id);
          const { data, error: err } = await supabase
            .from('packaging_bom')
            .select(`
              id,
              ratio_avg,
              ratio_min,
              ratio_max,
              sample_count,
              ratio_type,
              material:materials(code, short_code, name, type)
            `)
            .in('sku_id', skuIds);

          if (err) throw err;
          setDbRows((data as unknown as PackagingBomRow[]) || []);
        } else {
          setDbRows([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch packaging BOM');
      } finally {
        setLoading(false);
      }
    }

    fetchPackaging();
  }, [productId]);

  const handleActualChange = useCallback((key: string, value: string) => {
    setActuals((prev) => ({ ...prev, [key]: value }));
  }, []);

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

  // If DB has rows, use those. Otherwise, fall back to BOM_RATIOS from constants.
  const hasDbData = dbRows.length > 0;

  // Build fallback rows from BOM_RATIOS keyed by FG code
  const fallbackRows: FallbackRow[] = [];
  if (!hasDbData) {
    for (const [key, ratio] of Object.entries(BOM_RATIOS)) {
      const [fg, materialPart] = key.split('|');
      if (fg === fgCode) {
        fallbackRows.push({
          key,
          materialCode: materialPart,
          avg: ratio.avg,
          min: ratio.min,
          max: ratio.max,
          n: ratio.n,
          stable: ratio.stable,
        });
      }
    }
  }

  if (!hasDbData && fallbackRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <div className="text-sm font-medium">no packaging BOM data</div>
        <div className="text-xs">
          neither packaging_bom nor BOM_RATIOS constants have data for {fgCode}
        </div>
      </div>
    );
  }

  if (hasDbData) {
    return (
      <div className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>material code</TableHead>
              <TableHead>name</TableHead>
              <TableHead className="text-right">avg ratio</TableHead>
              <TableHead className="text-right">min-max</TableHead>
              <TableHead className="text-center">n</TableHead>
              <TableHead className="text-right">suggested qty</TableHead>
              <TableHead className="text-right">actual qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dbRows.map((row) => {
              const avg = row.ratio_avg ?? 0;
              const suggested = avg * qtyBatch;
              const isStable = row.ratio_type === 'stable';
              const n = row.sample_count ?? 0;
              const conf = getConfidenceBadge(n);
              const rowKey = row.id;

              return (
                <TableRow key={rowKey}>
                  <TableCell className="font-mono text-xs">
                    {row.material.short_code || row.material.code}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.material.name}
                    {row.material.type && (
                      <span className="ml-1 text-muted-foreground">
                        ({row.material.type})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {avg.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {row.ratio_min?.toFixed(2) ?? '-'} ~ {row.ratio_max?.toFixed(2) ?? '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ${conf.color}`}
                    >
                      {conf.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {suggested.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isStable ? (
                      <span className="font-mono text-muted-foreground">
                        {suggested.toFixed(2)}
                        <Badge
                          variant="secondary"
                          className="ml-1 text-[9px] px-1 py-0 bg-green-100 text-green-700 border-green-300"
                        >
                          locked
                        </Badge>
                      </span>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24 h-7 text-right font-mono text-xs ml-auto"
                        value={actuals[rowKey] ?? suggested.toFixed(2)}
                        onChange={(e) =>
                          handleActualChange(rowKey, e.target.value)
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="text-xs text-muted-foreground px-2">
          Actual quantities are editable for variable-ratio materials. Stable ratios are locked.
        </div>
      </div>
    );
  }

  // Fallback rendering using BOM_RATIOS from constants
  return (
    <div className="space-y-3">
      <div className="px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
        Showing data from BOM_RATIOS constants (no DB records found for this product).
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>material code</TableHead>
            <TableHead className="text-right">avg ratio</TableHead>
            <TableHead className="text-right">min-max</TableHead>
            <TableHead className="text-center">n</TableHead>
            <TableHead className="text-right">suggested qty</TableHead>
            <TableHead className="text-right">actual qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fallbackRows.map((row) => {
            const suggested = row.avg * qtyBatch;
            const conf = getConfidenceBadge(row.n);

            return (
              <TableRow key={row.key}>
                <TableCell className="font-mono text-xs">
                  {row.materialCode}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.avg.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {row.min.toFixed(2)} ~ {row.max.toFixed(2)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${conf.color}`}
                  >
                    {conf.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {suggested.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {row.stable ? (
                    <span className="font-mono text-muted-foreground">
                      {suggested.toFixed(2)}
                      <Badge
                        variant="secondary"
                        className="ml-1 text-[9px] px-1 py-0 bg-green-100 text-green-700 border-green-300"
                      >
                        locked
                      </Badge>
                    </span>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24 h-7 text-right font-mono text-xs ml-auto"
                      value={actuals[row.key] ?? suggested.toFixed(2)}
                      onChange={(e) =>
                        handleActualChange(row.key, e.target.value)
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="text-xs text-muted-foreground px-2">
        Actual quantities are editable for variable-ratio materials. Stable ratios are locked.
      </div>
    </div>
  );
}
