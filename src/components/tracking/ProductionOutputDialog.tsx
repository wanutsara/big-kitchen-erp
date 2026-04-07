'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { BATCH_KG } from '@/lib/constants';
import { useTracking } from '@/hooks/useTracking';
import type { Sku } from '@/lib/types';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Package, Scale, Boxes, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductionOutputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  productId: string;
  fgCode: string;
  qtyBatch: number;
  actualBatch?: number;
  onComplete: () => void;
}

export default function ProductionOutputDialog({
  open,
  onOpenChange,
  planId,
  productId,
  fgCode,
  qtyBatch,
  actualBatch,
  onComplete,
}: ProductionOutputDialogProps) {
  const batchCount = actualBatch ?? qtyBatch;
  const defaultWeight = batchCount * BATCH_KG;

  // Form state
  const [actualWeight, setActualWeight] = useState<number>(defaultWeight);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [selectedSkuId, setSelectedSkuId] = useState<string>('');
  const [packSizeG, setPackSizeG] = useState<number>(0);
  const [unitsPerBox, setUnitsPerBox] = useState<number>(1);
  const [qcStatus, setQcStatus] = useState<string>('passed');
  const [qcNotes, setQcNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { completeProduction } = useTracking();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setActualWeight(defaultWeight);
      setSelectedSkuId('');
      setPackSizeG(0);
      setUnitsPerBox(1);
      setQcStatus('passed');
      setQcNotes('');
      setError(null);
    }
  }, [open, defaultWeight]);

  // Fetch SKUs for this product
  useEffect(() => {
    if (!open || !productId) return;

    const fetchSkus = async () => {
      const supabase = createClient();
      const { data, error: fetchErr } = await supabase
        .from('skus')
        .select('*')
        .eq('product_id', productId)
        .order('size_g', { ascending: true });

      if (fetchErr) {
        console.error('Failed to fetch SKUs:', fetchErr);
        return;
      }
      setSkus(data || []);
    };

    fetchSkus();
  }, [open, productId]);

  // When SKU is selected, auto-fill pack_size_g and units_per_box
  const handleSkuChange = useCallback(
    (skuId: string | null) => {
      const id = skuId ?? '';
      setSelectedSkuId(id);
      const sku = skus.find((s) => s.id === id);
      if (sku) {
        setPackSizeG(sku.size_g);
        setUnitsPerBox(sku.qty_per_box);
      } else {
        setPackSizeG(0);
        setUnitsPerBox(1);
      }
    },
    [skus]
  );

  // Auto-calculations
  const unitsProduced = useMemo(() => {
    if (!packSizeG || packSizeG <= 0) return 0;
    return Math.floor((actualWeight * 1000) / packSizeG);
  }, [actualWeight, packSizeG]);

  const boxesProduced = useMemo(() => {
    if (!unitsPerBox || unitsPerBox <= 0) return 0;
    return Math.floor(unitsProduced / unitsPerBox);
  }, [unitsProduced, unitsPerBox]);

  const looseUnits = useMemo(() => {
    if (!unitsPerBox || unitsPerBox <= 0) return 0;
    return unitsProduced % unitsPerBox;
  }, [unitsProduced, unitsPerBox]);

  const yieldPct = useMemo(() => {
    const expected = batchCount * BATCH_KG;
    if (expected <= 0) return 0;
    return (actualWeight / expected) * 100;
  }, [actualWeight, batchCount]);

  const yieldColor = useMemo(() => {
    if (yieldPct >= 90) return 'text-green-700 bg-green-50 border-green-200';
    if (yieldPct >= 70) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-red-700 bg-red-50 border-red-200';
  }, [yieldPct]);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);

    try {
      // 1. Complete production (create lot, update plan status)
      const lotNumber = await completeProduction(planId, fgCode, batchCount);

      const supabase = createClient();

      // 2. Get the lot we just created
      const { data: lotData, error: lotFetchErr } = await supabase
        .from('lots')
        .select('id')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lotFetchErr || !lotData) {
        throw new Error('ไม่พบข้อมูล Lot ที่สร้าง');
      }

      // 3. INSERT into lot_outputs
      const { data: lotOutput, error: lotOutputErr } = await supabase
        .from('lot_outputs')
        .insert({
          lot_id: lotData.id,
          sku_id: selectedSkuId || null,
          actual_weight_kg: actualWeight,
          pack_size_g: packSizeG || 0,
          units_produced: unitsProduced,
          units_per_box: unitsPerBox,
          boxes_produced: boxesProduced,
          loose_units: looseUnits,
          yield_pct: Math.round(yieldPct * 100) / 100,
          qc_status: qcStatus,
          qc_notes: qcNotes || null,
          warehouse_status: 'received',
          received_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (lotOutputErr) {
        throw new Error(`บันทึก lot_output ไม่สำเร็จ: ${lotOutputErr.message}`);
      }

      // 4. INSERT into fg_inventory (auto-receive)
      const { error: fgInvErr } = await supabase.from('fg_inventory').insert({
        lot_output_id: lotOutput?.id || null,
        product_id: productId,
        sku_id: selectedSkuId || null,
        lot_number: lotNumber,
        boxes: boxesProduced,
        loose_units: looseUnits,
        weight_kg: actualWeight,
        location: 'warehouse',
        status: 'in_stock',
      });

      if (fgInvErr) {
        throw new Error(`บันทึก fg_inventory ไม่สำเร็จ: ${fgInvErr.message}`);
      }

      // 5. Success
      onOpenChange(false);
      onComplete();
    } catch (err) {
      console.error('Production output save failed:', err);
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>บันทึกผลผลิต — {fgCode}</DialogTitle>
          <DialogDescription>
            {batchCount} batch ({(batchCount * BATCH_KG).toLocaleString()} kg ตามแผน)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Actual Weight */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" />
              น้ำหนักจริง (kg)
            </Label>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={actualWeight}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setActualWeight(parseFloat(e.target.value) || 0)
              }
              className="h-9"
            />
          </div>

          {/* Yield % */}
          <div className={cn('p-2 rounded border text-center', yieldColor)}>
            <span className="text-xs font-medium">Yield: </span>
            <span className="text-lg font-bold">{yieldPct.toFixed(1)}%</span>
            <span className="text-xs ml-1">
              ({actualWeight.toLocaleString()} / {(batchCount * BATCH_KG).toLocaleString()} kg)
            </span>
          </div>

          {/* SKU Selection */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              SKU
            </Label>
            {skus.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                ไม่พบ SKU สำหรับ {fgCode} — ข้ามขั้นตอนบรรจุภัณฑ์ได้
              </div>
            ) : (
              <Select value={selectedSkuId} onValueChange={(v) => handleSkuChange(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="เลือก SKU..." />
                </SelectTrigger>
                <SelectContent>
                  {skus.map((sku) => (
                    <SelectItem key={sku.id} value={sku.id}>
                      {sku.size_g}g x {sku.qty_per_box} ({sku.package_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Auto-calculated packing info (shown only when SKU selected) */}
          {selectedSkuId && packSizeG > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">จำนวนซอง/ถ้วย</Label>
                <div className="h-9 flex items-center px-3 bg-muted rounded border text-sm font-medium">
                  {unitsProduced.toLocaleString()}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Boxes className="h-3 w-3" />
                  กล่อง
                </Label>
                <div className="h-9 flex items-center px-3 bg-muted rounded border text-sm font-medium">
                  {boxesProduced.toLocaleString()}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">เศษไม่เต็มกล่อง</Label>
                <div className="h-9 flex items-center px-3 bg-muted rounded border text-sm font-medium">
                  {looseUnits}
                </div>
              </div>
            </div>
          )}

          {/* QC Status */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              QC Status
            </Label>
            <Select value={qcStatus} onValueChange={(v) => setQcStatus(v ?? 'passed')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="passed">
                  <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 border-green-300">
                    ผ่าน
                  </Badge>
                </SelectItem>
                <SelectItem value="failed">
                  <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 border-red-300">
                    ไม่ผ่าน
                  </Badge>
                </SelectItem>
                <SelectItem value="pending">
                  <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-700 border-gray-300">
                    รอตรวจ
                  </Badge>
                </SelectItem>
                <SelectItem value="hold">
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 border-amber-300">
                    พักไว้
                  </Badge>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>หมายเหตุ</Label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 min-h-[60px] resize-y"
              placeholder="หมายเหตุเพิ่มเติม..."
              value={qcNotes}
              onChange={(e) => setQcNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              'บันทึกผลผลิต'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
