'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase';
import type { BoiLevelType } from '@/lib/types';

interface ImportOrdersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedRow {
  fg_code: string;
  qty: number;
  customer: string;
  delivery_date: string;
  po_number: string;
  boi_level: string;
  mcpd: boolean;
  // Resolved IDs (after lookup)
  productId?: string;
  customerId?: string;
  skuId?: string;
  error?: string;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

export default function ImportOrders({
  open,
  onOpenChange,
  onSuccess,
}: ImportOrdersProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setRows([]);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        reset();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset]
  );

  // Parse CSV file
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);

      try {
        const text = await file.text();
        const lines = text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length < 2) {
          setError('ไฟล์ CSV ต้องมีอย่างน้อย 1 แถวข้อมูล (ไม่รวม header)');
          return;
        }

        // Parse header
        const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
        const expectedCols = [
          'fg_code',
          'qty',
          'customer',
          'delivery_date',
          'po_number',
          'boi_level',
          'mcpd',
        ];

        // Validate header columns exist
        const missingCols = expectedCols.filter(
          (col) => !header.includes(col)
        );
        if (missingCols.length > 0) {
          setError(
            `ไม่พบคอลัมน์: ${missingCols.join(', ')} (คอลัมน์ที่ต้องการ: ${expectedCols.join(', ')})`
          );
          return;
        }

        // Parse data rows
        const colIndices = Object.fromEntries(
          expectedCols.map((col) => [col, header.indexOf(col)])
        );

        const parsed: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          const mcpdVal = (cols[colIndices.mcpd] || '').toLowerCase().trim();

          parsed.push({
            fg_code: (cols[colIndices.fg_code] || '').trim(),
            qty: parseInt(cols[colIndices.qty] || '0', 10),
            customer: (cols[colIndices.customer] || '').trim(),
            delivery_date: (cols[colIndices.delivery_date] || '').trim(),
            po_number: (cols[colIndices.po_number] || '').trim(),
            boi_level: (cols[colIndices.boi_level] || 'NON').trim().toUpperCase(),
            mcpd:
              mcpdVal === 'true' ||
              mcpdVal === '1' ||
              mcpdVal === 'yes' ||
              mcpdVal === 'y',
          });
        }

        // Validate rows
        for (let i = 0; i < parsed.length; i++) {
          const row = parsed[i];
          if (!row.fg_code) {
            row.error = 'fg_code ว่าง';
          } else if (!row.qty || row.qty <= 0) {
            row.error = 'qty ไม่ถูกต้อง';
          } else if (!row.customer) {
            row.error = 'customer ว่าง';
          }
        }

        // Resolve product IDs, customer IDs, and SKU IDs
        await resolveIds(parsed);

        setRows(parsed);
        setStep('preview');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอ่านไฟล์'
        );
      }
    },
    []
  );

  // Resolve fg_code → product_id, customer name → customer_id, product → sku_id
  const resolveIds = async (parsed: ParsedRow[]) => {
    const supabase = createClient();

    // Fetch all products
    const { data: products } = await supabase
      .from('products')
      .select('id, fg_code');
    const productMap = new Map(
      (products || []).map((p) => [p.fg_code, p.id])
    );

    // Fetch all customers
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name');
    const customerMap = new Map(
      (customers || []).map((c) => [c.name.toLowerCase(), c.id])
    );

    // Fetch all SKUs grouped by product
    const { data: skus } = await supabase
      .from('skus')
      .select('id, product_id');
    const skuMap = new Map<string, string>();
    for (const sku of skus || []) {
      if (!skuMap.has(sku.product_id)) {
        skuMap.set(sku.product_id, sku.id);
      }
    }

    for (const row of parsed) {
      if (row.error) continue;

      const productId = productMap.get(row.fg_code);
      if (!productId) {
        row.error = `ไม่พบ FG: ${row.fg_code}`;
        continue;
      }
      row.productId = productId;

      const customerId = customerMap.get(row.customer.toLowerCase());
      if (!customerId) {
        row.error = `ไม่พบลูกค้า: ${row.customer}`;
        continue;
      }
      row.customerId = customerId;

      const skuId = skuMap.get(productId);
      if (!skuId) {
        row.error = `ไม่พบ SKU สำหรับ ${row.fg_code}`;
        continue;
      }
      row.skuId = skuId;
    }
  };

  // Bulk insert confirmed rows
  const handleImport = useCallback(async () => {
    const validRows = rows.filter((r) => !r.error);
    if (validRows.length === 0) {
      setError('ไม่มีรายการที่ถูกต้องสำหรับนำเข้า');
      return;
    }

    setStep('importing');
    setError(null);

    try {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];

      const inserts = validRows.map((row) => ({
        customer_id: row.customerId!,
        sku_id: row.skuId!,
        qty_batch: row.qty,
        order_date: today,
        delivery_date: row.delivery_date || null,
        po_number: row.po_number || null,
        boi_level: (['BOI4', 'BOI5', 'NON'].includes(row.boi_level)
          ? row.boi_level
          : 'NON') as BoiLevelType,
        requires_mcpd: row.mcpd,
        priority: 4, // Default for MINT imports
        source: 'mint' as const,
        status: 'pending' as const,
      }));

      const { error: insertErr } = await supabase
        .from('orders')
        .insert(inserts);

      if (insertErr) throw insertErr;

      const failedCount = rows.filter((r) => !!r.error).length;
      setImportResult({
        success: validRows.length,
        failed: failedCount,
      });
      setStep('done');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการนำเข้า'
      );
      setStep('preview');
    }
  }, [rows]);

  const handleDone = useCallback(() => {
    handleOpenChange(false);
    onSuccess();
  }, [handleOpenChange, onSuccess]);

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => !!r.error).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>นำเข้าจาก MINT</DialogTitle>
          <DialogDescription>
            อัปโหลดไฟล์ CSV จากระบบ MINT เพื่อเพิ่มรายการสั่งผลิต
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  เลือกไฟล์ CSV จากระบบ MINT
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  คอลัมน์ที่ต้องการ: fg_code, qty, customer, delivery_date,
                  po_number, boi_level, mcpd
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-4 w-4" />
                เลือกไฟล์
              </Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default">{validCount} รายการพร้อมนำเข้า</Badge>
              {errorCount > 0 && (
                <Badge variant="destructive">
                  {errorCount} รายการมีข้อผิดพลาด
                </Badge>
              )}
            </div>

            <div className="flex-1 overflow-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">สถานะ</TableHead>
                    <TableHead className="text-xs">FG Code</TableHead>
                    <TableHead className="text-xs">Batch</TableHead>
                    <TableHead className="text-xs">ลูกค้า</TableHead>
                    <TableHead className="text-xs">กำหนดส่ง</TableHead>
                    <TableHead className="text-xs">PO</TableHead>
                    <TableHead className="text-xs">BOI</TableHead>
                    <TableHead className="text-xs">MCPD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow
                      key={i}
                      className={row.error ? 'bg-red-50/50' : ''}
                    >
                      <TableCell className="text-xs">
                        {row.error ? (
                          <span
                            className="text-red-600 flex items-center gap-1"
                            title={row.error}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            ผิดพลาด
                          </span>
                        ) : (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            พร้อม
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {row.fg_code}
                      </TableCell>
                      <TableCell className="text-xs">{row.qty}</TableCell>
                      <TableCell className="text-xs">{row.customer}</TableCell>
                      <TableCell className="text-xs">
                        {row.delivery_date}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {row.po_number}
                      </TableCell>
                      <TableCell className="text-xs">{row.boi_level}</TableCell>
                      <TableCell className="text-xs">
                        {row.mcpd ? 'Yes' : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {errorCount > 0 && (
              <div className="text-xs text-muted-foreground">
                รายการที่มีข้อผิดพลาดจะถูกข้ามไป
              </div>
            )}
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
            <span className="text-sm">กำลังนำเข้า {validCount} รายการ...</span>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && importResult && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">
                นำเข้าสำเร็จ {importResult.success} รายการ
              </p>
              {importResult.failed > 0 && (
                <p className="text-xs text-muted-foreground">
                  ข้าม {importResult.failed} รายการที่มีข้อผิดพลาด
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              ยกเลิก
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={reset}>
                เลือกไฟล์ใหม่
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                นำเข้า {validCount} รายการ
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleDone}>เสร็จสิ้น</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- CSV Parsing Helper ----------

/**
 * Parse a single CSV line, handling quoted fields with commas inside.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}
