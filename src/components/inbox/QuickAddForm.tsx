'use client';

import { useState, useCallback } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { createClient } from '@/lib/supabase';
import type { OrderSource, BoiLevelType } from '@/lib/types';

interface QuickAddFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormState {
  productId: string;
  qtyBatch: string;
  customerId: string;
  deliveryDate: string;
  boiLevel: BoiLevelType;
  requiresMcpd: boolean;
  source: OrderSource;
  priority: string;
  remark: string;
}

const initialForm: FormState = {
  productId: '',
  qtyBatch: '',
  customerId: '',
  deliveryDate: '',
  boiLevel: 'NON',
  requiresMcpd: false,
  source: 'phone',
  priority: '3',
  remark: '',
};

export default function QuickAddForm({
  open,
  onOpenChange,
  onSuccess,
}: QuickAddFormProps) {
  const { products, loading: productsLoading } = useProducts();
  const { customers, loading: customersLoading } = useCustomers();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetForm = useCallback(() => {
    setForm(initialForm);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validate required fields
    if (!form.productId) {
      setError('กรุณาเลือกสินค้า');
      return;
    }
    if (!form.qtyBatch || Number(form.qtyBatch) <= 0) {
      setError('กรุณาระบุจำนวน batch');
      return;
    }
    if (!form.customerId) {
      setError('กรุณาเลือกลูกค้า');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Look up the first SKU for the selected product
      const { data: skus, error: skuErr } = await supabase
        .from('skus')
        .select('id')
        .eq('product_id', form.productId)
        .limit(1);

      if (skuErr) throw skuErr;

      // If no SKU found, we still need a sku_id — create a placeholder or use null
      const skuId = skus && skus.length > 0 ? skus[0].id : null;

      if (!skuId) {
        setError('ไม่พบ SKU สำหรับสินค้านี้ กรุณาเพิ่ม SKU ก่อน');
        setSubmitting(false);
        return;
      }

      const { error: insertErr } = await supabase.from('orders').insert({
        customer_id: form.customerId,
        sku_id: skuId,
        qty_batch: Number(form.qtyBatch),
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: form.deliveryDate || null,
        boi_level: form.boiLevel,
        requires_mcpd: form.requiresMcpd,
        priority: Number(form.priority),
        source: form.source,
        status: 'pending',
        remark: form.remark || null,
      });

      if (insertErr) throw insertErr;

      resetForm();
      onSuccess();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการบันทึก'
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, resetForm, onSuccess]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetForm();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetForm]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เพิ่มรายการด่วน</DialogTitle>
          <DialogDescription>
            เพิ่ม order จากโทรศัพท์หรือ LINE
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Product (FG) */}
          <div className="space-y-1.5">
            <Label htmlFor="product">สินค้า (FG) *</Label>
            <Select
              value={form.productId}
              onValueChange={(val) => val && updateField('productId', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    productsLoading ? 'กำลังโหลด...' : 'เลือกสินค้า'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fg_code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity batch + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qty_batch">จำนวน batch *</Label>
              <Input
                id="qty_batch"
                type="number"
                min={1}
                placeholder="เช่น 5"
                value={form.qtyBatch}
                onChange={(e) => updateField('qtyBatch', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(val) => val && updateField('priority', val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">P1 ส่งออก+MCPD</SelectItem>
                  <SelectItem value="2">P2 Stock ต่ำ</SelectItem>
                  <SelectItem value="3">P3 ยี่ปั๊วด่วน</SelectItem>
                  <SelectItem value="4">P4 ปกติ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Customer */}
          <div className="space-y-1.5">
            <Label htmlFor="customer">ลูกค้า *</Label>
            <Select
              value={form.customerId}
              onValueChange={(val) => val && updateField('customerId', val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    customersLoading ? 'กำลังโหลด...' : 'เลือกลูกค้า'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.market && (
                      <span className="text-muted-foreground ml-1">
                        ({c.market})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Delivery date + Source row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="delivery_date">กำหนดส่ง</Label>
              <Input
                id="delivery_date"
                type="date"
                value={form.deliveryDate}
                onChange={(e) => updateField('deliveryDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source">ช่องทาง</Label>
              <Select
                value={form.source}
                onValueChange={(val) =>
                  updateField('source', val as OrderSource)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">โทรศัพท์</SelectItem>
                  <SelectItem value="line">LINE</SelectItem>
                  <SelectItem value="stock_alert">Stock Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* BOI Level */}
          <div className="space-y-1.5">
            <Label htmlFor="boi_level">BOI Level</Label>
            <Select
              value={form.boiLevel}
              onValueChange={(val) =>
                updateField('boiLevel', val as BoiLevelType)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOI4">BOI4 (เขียว)</SelectItem>
                <SelectItem value="BOI5">BOI5 (ชมพู)</SelectItem>
                <SelectItem value="NON">NON-BOI (ส้ม)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* MCPD checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.requiresMcpd}
              onCheckedChange={(checked) =>
                updateField('requiresMcpd', !!checked)
              }
              id="requires_mcpd"
            />
            <Label htmlFor="requires_mcpd" className="cursor-pointer">
              ต้องการ MCPD
            </Label>
          </div>

          {/* Remark */}
          <div className="space-y-1.5">
            <Label htmlFor="remark">หมายเหตุ</Label>
            <Input
              id="remark"
              placeholder="หมายเหตุเพิ่มเติม"
              value={form.remark}
              onChange={(e) => updateField('remark', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
