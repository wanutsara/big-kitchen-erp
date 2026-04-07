'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Warehouse,
  Search,
  PackagePlus,
  PackageMinus,
  SlidersHorizontal,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  CircleMinus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import type { StockBalance, InventoryTransaction, Ingredient } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// -------------------------------------------------------------------
// Status helpers
// -------------------------------------------------------------------

type StockStatus = 'normal' | 'low' | 'deficit';

function getStockStatus(balance: number): StockStatus {
  if (balance <= 0) return 'deficit';
  if (balance < 1000) return 'low';
  return 'normal';
}

function StatusBadge({ status }: { status: StockStatus }) {
  switch (status) {
    case 'normal':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-300"
        >
          ปกติ
        </Badge>
      );
    case 'low':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700 border-yellow-300"
        >
          ต่ำ
        </Badge>
      );
    case 'deficit':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-300"
        >
          ติดลบ
        </Badge>
      );
  }
}

function TransactionTypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'receive':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700"
        >
          รับเข้า
        </Badge>
      );
    case 'issue':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700"
        >
          เบิกจ่าย
        </Badge>
      );
    case 'adjust':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700"
        >
          ปรับยอด
        </Badge>
      );
    case 'transfer':
      return (
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700"
        >
          โอนย้าย
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {type}
        </Badge>
      );
  }
}

// -------------------------------------------------------------------
// Category options
// -------------------------------------------------------------------

const CATEGORIES = [
  'surimi',
  'seasoning',
  'additive',
  'starch',
  'oil',
  'preservative',
  'water',
];

const CATEGORY_LABELS: Record<string, string> = {
  surimi: 'ซูริมิ',
  seasoning: 'เครื่องปรุง',
  additive: 'สารเติมแต่ง',
  starch: 'แป้ง',
  oil: 'น้ำมัน',
  preservative: 'สารกันเสีย',
  water: 'น้ำ',
};

// -------------------------------------------------------------------
// Main Page
// -------------------------------------------------------------------

export default function InventoryPage() {
  const [stock, setStock] = useState<StockBalance[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<'code' | 'balance'>('code');
  const [sortAsc, setSortAsc] = useState(true);

  // Dialog states
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  // -------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const [stockRes, txnRes, ingRes] = await Promise.all([
        supabase.from('stock_balance').select('*').order('code'),
        supabase
          .from('inventory_transactions')
          .select('*, ingredient:ingredients(*)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('ingredients').select('*').order('code'),
      ]);

      if (stockRes.error) throw stockRes.error;
      if (txnRes.error) throw txnRes.error;
      if (ingRes.error) throw ingRes.error;

      setStock((stockRes.data as StockBalance[]) || []);
      setTransactions((txnRes.data as InventoryTransaction[]) || []);
      setIngredients((ingRes.data as Ingredient[]) || []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'โหลดข้อมูลคลังวัตถุดิบไม่สำเร็จ'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------------------------------------------------------
  // Filtered / sorted stock
  // -------------------------------------------------------------------

  const filteredStock = useMemo(() => {
    let result = [...stock];

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.code.toLowerCase().includes(q) ||
          (s.name && s.name.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((s) => s.category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(
        (s) => getStockStatus(s.balance) === statusFilter
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortField === 'code') {
        return sortAsc
          ? a.code.localeCompare(b.code)
          : b.code.localeCompare(a.code);
      }
      return sortAsc ? a.balance - b.balance : b.balance - a.balance;
    });

    return result;
  }, [stock, search, categoryFilter, statusFilter, sortField, sortAsc]);

  // -------------------------------------------------------------------
  // Summary counts
  // -------------------------------------------------------------------

  const summary = useMemo(() => {
    let normal = 0;
    let low = 0;
    let deficit = 0;
    for (const s of stock) {
      const st = getStockStatus(s.balance);
      if (st === 'normal') normal++;
      else if (st === 'low') low++;
      else deficit++;
    }
    return { total: stock.length, normal, low, deficit };
  }, [stock]);

  // -------------------------------------------------------------------
  // Toggle sort
  // -------------------------------------------------------------------

  function toggleSort(field: 'code' | 'balance') {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Warehouse className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">คลังวัตถุดิบ</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setReceiveOpen(true)}
          >
            <PackagePlus className="h-3.5 w-3.5" data-icon="inline-start" />
            รับเข้า
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIssueOpen(true)}
          >
            <PackageMinus className="h-3.5 w-3.5" data-icon="inline-start" />
            เบิกจ่าย
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdjustOpen(true)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" data-icon="inline-start" />
            ปรับยอด
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="จำนวนรายการ"
            value={summary.total}
            icon={<Warehouse className="h-4 w-4 text-muted-foreground" />}
            color="text-foreground"
          />
          <SummaryCard
            label="Stock ปกติ"
            value={summary.normal}
            icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
            color="text-green-600"
          />
          <SummaryCard
            label="Stock ต่ำ"
            value={summary.low}
            icon={<AlertTriangle className="h-4 w-4 text-yellow-600" />}
            color="text-yellow-600"
          />
          <SummaryCard
            label="Stock ติดลบ"
            value={summary.deficit}
            icon={<CircleMinus className="h-4 w-4 text-red-600" />}
            color="text-red-600"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="ค้นหา R-code หรือชื่อ..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v ?? '')}
          >
            <SelectTrigger className="w-fit">
              <SelectValue placeholder="หมวดหมู่" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v ?? '')}
          >
            <SelectTrigger className="w-fit">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="normal">ปกติ</SelectItem>
              <SelectItem value="low">ต่ำ</SelectItem>
              <SelectItem value="deficit">ติดลบ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stock Table */}
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                กำลังโหลด...
              </div>
            ) : filteredStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <Warehouse className="h-8 w-8 opacity-40" />
                <p>ไม่พบข้อมูลวัตถุดิบ</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>
                      <button
                        onClick={() => toggleSort('code')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        รหัส
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>หมวดหมู่</TableHead>
                    <TableHead className="text-right">
                      <button
                        onClick={() => toggleSort('balance')}
                        className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                      >
                        คงเหลือ (kg)
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStock.map((item, index) => {
                    const status = getStockStatus(item.balance);
                    return (
                      <TableRow
                        key={item.item_id}
                        className={
                          status === 'deficit'
                            ? 'bg-red-50'
                            : status === 'low'
                              ? 'bg-yellow-50'
                              : ''
                        }
                      >
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">
                          {item.code}
                        </TableCell>
                        <TableCell>{item.name || '-'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.category
                            ? CATEGORY_LABELS[item.category] || item.category
                            : '-'}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono tabular-nums ${
                            status === 'deficit'
                              ? 'text-red-600 font-medium'
                              : status === 'low'
                                ? 'text-yellow-700'
                                : ''
                          }`}
                        >
                          {item.balance.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusBadge status={status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Transaction History */}
        <section>
          <h2 className="text-lg font-semibold mb-3">ประวัติรายการเคลื่อนไหว</h2>
          <Card>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                  กำลังโหลด...
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-muted-foreground">
                  ยังไม่มีรายการเคลื่อนไหว
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>รหัส</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead className="text-right">จำนวน (kg)</TableHead>
                      <TableHead>อ้างอิง</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(
                            new Date(txn.created_at),
                            'd MMM yy HH:mm',
                            { locale: th }
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {txn.ingredient?.code || '-'}
                        </TableCell>
                        <TableCell>
                          <TransactionTypeBadge type={txn.transaction_type} />
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono tabular-nums ${
                            txn.transaction_type === 'issue'
                              ? 'text-red-600'
                              : txn.transaction_type === 'receive'
                                ? 'text-green-600'
                                : ''
                          }`}
                        >
                          {txn.transaction_type === 'issue' ? '-' : '+'}
                          {Math.abs(txn.quantity).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {txn.reference || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {txn.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Transaction Dialogs */}
      <ReceiveDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        ingredients={ingredients}
        onSuccess={fetchData}
      />
      <IssueDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        ingredients={ingredients}
        stock={stock}
        onSuccess={fetchData}
      />
      <AdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        ingredients={ingredients}
        stock={stock}
        onSuccess={fetchData}
      />
    </div>
  );
}

// -------------------------------------------------------------------
// Summary Card
// -------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------------
// Receive Dialog (รับเข้า)
// -------------------------------------------------------------------

function ReceiveDialog({
  open,
  onOpenChange,
  ingredients,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: Ingredient[];
  onSuccess: () => void;
}) {
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  function reset() {
    setIngredientId('');
    setQuantity('');
    setReference('');
    setNotes('');
    setDialogError(null);
  }

  async function handleSubmit() {
    if (!ingredientId || !quantity) {
      setDialogError('กรุณาเลือกวัตถุดิบและระบุจำนวน');
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setDialogError('จำนวนต้องมากกว่า 0');
      return;
    }

    setSaving(true);
    setDialogError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('inventory_transactions').insert({
        ingredient_id: ingredientId,
        transaction_type: 'receive',
        quantity: qty,
        unit: 'kg',
        reference: reference || null,
        notes: notes || null,
      });
      if (error) throw error;
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setDialogError(
        e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>รับเข้าวัตถุดิบ</DialogTitle>
          <DialogDescription>
            บันทึกการรับวัตถุดิบเข้าคลัง
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {dialogError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {dialogError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>วัตถุดิบ</Label>
            <Select value={ingredientId} onValueChange={(v) => setIngredientId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="เลือกวัตถุดิบ..." />
              </SelectTrigger>
              <SelectContent>
                {ingredients.map((ing) => (
                  <SelectItem key={ing.id} value={ing.id}>
                    {ing.code} — {ing.name || '(ไม่มีชื่อ)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>จำนวน (kg)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label>เลขอ้างอิง</Label>
            <Input
              value={reference}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReference(e.target.value)}
              placeholder="PO / Invoice / เลขที่เอกสาร"
            />
          </div>

          <div className="space-y-1.5">
            <Label>หมายเหตุ</Label>
            <Input
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            ยกเลิก
          </DialogClose>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกรับเข้า'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------------
// Issue Dialog (เบิกจ่าย)
// -------------------------------------------------------------------

function IssueDialog({
  open,
  onOpenChange,
  ingredients,
  stock,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: Ingredient[];
  stock: StockBalance[];
  onSuccess: () => void;
}) {
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const selectedStock = stock.find((s) => s.item_id === ingredientId);

  function reset() {
    setIngredientId('');
    setQuantity('');
    setReference('');
    setNotes('');
    setDialogError(null);
  }

  async function handleSubmit() {
    if (!ingredientId || !quantity) {
      setDialogError('กรุณาเลือกวัตถุดิบและระบุจำนวน');
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setDialogError('จำนวนต้องมากกว่า 0');
      return;
    }

    setSaving(true);
    setDialogError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('inventory_transactions').insert({
        ingredient_id: ingredientId,
        transaction_type: 'issue',
        quantity: qty,
        unit: 'kg',
        reference: reference || null,
        notes: notes || null,
      });
      if (error) throw error;
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setDialogError(
        e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>เบิกจ่ายวัตถุดิบ</DialogTitle>
          <DialogDescription>
            บันทึกการเบิกจ่ายวัตถุดิบออกจากคลัง
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {dialogError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {dialogError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>วัตถุดิบ</Label>
            <Select value={ingredientId} onValueChange={(v) => setIngredientId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="เลือกวัตถุดิบ..." />
              </SelectTrigger>
              <SelectContent>
                {ingredients.map((ing) => (
                  <SelectItem key={ing.id} value={ing.id}>
                    {ing.code} — {ing.name || '(ไม่มีชื่อ)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStock && (
              <p className="text-xs text-muted-foreground">
                คงเหลือปัจจุบัน:{' '}
                <span
                  className={
                    selectedStock.balance <= 0
                      ? 'text-red-600 font-medium'
                      : ''
                  }
                >
                  {selectedStock.balance.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>จำนวน (kg)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label>เลขอ้างอิง</Label>
            <Input
              value={reference}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReference(e.target.value)}
              placeholder="Lot / ใบเบิก / ลาย BOI"
            />
          </div>

          <div className="space-y-1.5">
            <Label>หมายเหตุ</Label>
            <Input
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            ยกเลิก
          </DialogClose>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกเบิกจ่าย'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------------
// Adjust Dialog (ปรับยอด)
// -------------------------------------------------------------------

function AdjustDialog({
  open,
  onOpenChange,
  ingredients,
  stock,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: Ingredient[];
  stock: StockBalance[];
  onSuccess: () => void;
}) {
  const [ingredientId, setIngredientId] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const selectedStock = stock.find((s) => s.item_id === ingredientId);
  const currentBalance = selectedStock?.balance ?? 0;
  const parsedNew = parseFloat(newBalance);
  const diff = !isNaN(parsedNew) ? parsedNew - currentBalance : null;

  function reset() {
    setIngredientId('');
    setNewBalance('');
    setNotes('');
    setDialogError(null);
  }

  async function handleSubmit() {
    if (!ingredientId || newBalance === '') {
      setDialogError('กรุณาเลือกวัตถุดิบและระบุจำนวนใหม่');
      return;
    }
    if (isNaN(parsedNew)) {
      setDialogError('กรุณาระบุจำนวนที่ถูกต้อง');
      return;
    }
    if (diff === null || diff === 0) {
      setDialogError('จำนวนใหม่เท่ากับยอดปัจจุบัน ไม่ต้องปรับ');
      return;
    }

    setSaving(true);
    setDialogError(null);
    try {
      const supabase = createClient();
      // For adjust: if new > current, insert positive receive-like adj
      // if new < current, insert positive issue-like adj
      // We use 'adjust' type and the quantity is the DIFF (positive)
      // The view computes: receive/adjust = +, issue/transfer = -
      // So for adjust, positive diff => insert positive qty (adds)
      // For negative diff, we need to insert the absolute diff as issue-type adjustment
      // BUT our view treats 'adjust' as additive. So we insert the DIFF directly.
      // If diff > 0: insert with qty = diff (will add to balance via 'adjust' type)
      // If diff < 0: we need to use 'issue' type or handle differently
      // Actually looking at the view: adjust is treated same as receive (positive)
      // So to reduce: we insert an 'issue' for the absolute diff
      // To increase: we insert an 'adjust' for the diff

      if (diff > 0) {
        const { error } = await supabase
          .from('inventory_transactions')
          .insert({
            ingredient_id: ingredientId,
            transaction_type: 'adjust',
            quantity: diff,
            unit: 'kg',
            reference: `ปรับยอด ${currentBalance.toLocaleString()} -> ${parsedNew.toLocaleString()}`,
            notes: notes || null,
          });
        if (error) throw error;
      } else {
        // diff < 0, need to reduce balance
        const { error } = await supabase
          .from('inventory_transactions')
          .insert({
            ingredient_id: ingredientId,
            transaction_type: 'issue',
            quantity: Math.abs(diff),
            unit: 'kg',
            reference: `ปรับยอด ${currentBalance.toLocaleString()} -> ${parsedNew.toLocaleString()}`,
            notes: notes || `ปรับลดยอด${notes ? ' — ' + notes : ''}`,
          });
        if (error) throw error;
      }

      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      setDialogError(
        e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ปรับยอดวัตถุดิบ</DialogTitle>
          <DialogDescription>
            ปรับยอดคงเหลือให้ตรงกับยอดจริง (นับ stock)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {dialogError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {dialogError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>วัตถุดิบ</Label>
            <Select value={ingredientId} onValueChange={(v) => setIngredientId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="เลือกวัตถุดิบ..." />
              </SelectTrigger>
              <SelectContent>
                {ingredients.map((ing) => (
                  <SelectItem key={ing.id} value={ing.id}>
                    {ing.code} — {ing.name || '(ไม่มีชื่อ)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStock && (
              <p className="text-xs text-muted-foreground">
                ยอดปัจจุบัน:{' '}
                <span className="font-medium">
                  {currentBalance.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{' '}
                  kg
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>จำนวนใหม่ (kg)</Label>
            <Input
              type="number"
              step="0.01"
              value={newBalance}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBalance(e.target.value)}
              placeholder="0.00"
            />
            {diff !== null && diff !== 0 && (
              <p
                className={`text-xs font-medium ${
                  diff > 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {diff > 0 ? '+' : ''}
                {diff.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{' '}
                kg
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>หมายเหตุ</Label>
            <Input
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
              placeholder="เหตุผลในการปรับยอด"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            ยกเลิก
          </DialogClose>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกปรับยอด'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
