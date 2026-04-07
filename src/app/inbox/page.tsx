'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Upload,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useOrders } from '@/hooks/useOrders';
import { BOI_COLORS, PRIORITY_LABELS, BATCH_KG } from '@/lib/constants';
import type { Order, OrderStatus } from '@/lib/types';
import { createClient } from '@/lib/supabase';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import QuickAddForm from '@/components/inbox/QuickAddForm';
import ImportOrders from '@/components/inbox/ImportOrders';

// --------------- Types ---------------

type StatusFilter = 'all' | OrderStatus;
type PriorityFilter = 'all' | '1' | '2' | '3' | '4';
type BoiFilter = 'all' | 'BOI4' | 'BOI5' | 'NON';
type SortField =
  | 'order_date'
  | 'fg_code'
  | 'product_name'
  | 'qty_batch'
  | 'customer'
  | 'delivery_date'
  | 'boi_level'
  | 'priority'
  | 'status';
type SortDir = 'asc' | 'desc';

const ROWS_PER_PAGE = 20;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอจัดแผน' },
  { value: 'planned', label: 'จัดแผนแล้ว' },
  { value: 'producing', label: 'กำลังผลิต' },
  { value: 'done', label: 'เสร็จ' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: '1', label: 'P1 ส่งออก' },
  { value: '2', label: 'P2 Stock ต่ำ' },
  { value: '3', label: 'P3 ยี่ปั๊วด่วน' },
  { value: '4', label: 'P4 ปกติ' },
];

const BOI_OPTIONS: { value: BoiFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'BOI4', label: 'BOI4' },
  { value: 'BOI5', label: 'BOI5' },
  { value: 'NON', label: 'NON-BOI' },
];

const STATUS_STYLES: Record<
  OrderStatus,
  { bg: string; text: string; label: string }
> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'รอจัดแผน' },
  planned: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'จัดแผนแล้ว' },
  producing: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    label: 'กำลังผลิต',
  },
  done: { bg: 'bg-green-100', text: 'text-green-800', label: 'เสร็จ' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'ยกเลิก' },
};

// --------------- Page Component ---------------

export default function InboxPage() {
  // Fetch ALL orders (no status filter on the hook level)
  const { orders, loading, error, refetch } = useOrders();

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [boiFilter, setBoiFilter] = useState<BoiFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sort
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Dialogs
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Confirm action dialog
  const [confirmAction, setConfirmAction] = useState<{
    orderId: string;
    action: 'plan' | 'cancel';
    fgCode: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ---------- Filtering ----------

  const filteredOrders = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (
        priorityFilter !== 'all' &&
        order.priority !== Number(priorityFilter)
      )
        return false;
      if (boiFilter !== 'all' && order.boi_level !== boiFilter) return false;
      if (query) {
        const fgCode = (order.product?.fg_code || '').toLowerCase();
        const productName = (order.product?.name || '').toLowerCase();
        const customerName = (order.customer?.name || '').toLowerCase();
        if (
          !fgCode.includes(query) &&
          !productName.includes(query) &&
          !customerName.includes(query)
        )
          return false;
      }
      return true;
    });
  }, [orders, statusFilter, priorityFilter, boiFilter, searchQuery]);

  // ---------- Sorting ----------

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'order_date':
          cmp = (a.order_date || '').localeCompare(b.order_date || '');
          break;
        case 'fg_code':
          cmp = (a.product?.fg_code || '').localeCompare(
            b.product?.fg_code || ''
          );
          break;
        case 'product_name':
          cmp = (a.product?.name || '').localeCompare(b.product?.name || '');
          break;
        case 'qty_batch':
          cmp = a.qty_batch - b.qty_batch;
          break;
        case 'customer':
          cmp = (a.customer?.name || '').localeCompare(
            b.customer?.name || ''
          );
          break;
        case 'delivery_date':
          cmp = (a.delivery_date || '').localeCompare(
            b.delivery_date || ''
          );
          break;
        case 'boi_level':
          cmp = (a.boi_level || '').localeCompare(b.boi_level || '');
          break;
        case 'priority':
          cmp = a.priority - b.priority;
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredOrders, sortField, sortDir]);

  // ---------- Pagination ----------

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = sortedOrders.slice(
    (safePage - 1) * ROWS_PER_PAGE,
    safePage * ROWS_PER_PAGE
  );

  // Reset page when filters change
  const handleFilterChange = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
      (value: T) => {
        setter(value);
        setCurrentPage(1);
      },
    []
  );

  // ---------- Sort handler ----------

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('asc');
      }
      setCurrentPage(1);
    },
    [sortField]
  );

  // ---------- Actions ----------

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const supabase = createClient();
      const newStatus =
        confirmAction.action === 'plan' ? 'planned' : 'cancelled';
      const { error: err } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', confirmAction.orderId);
      if (err) throw err;
      refetch();
      setConfirmAction(null);
    } catch (e) {
      console.error('Action failed:', e);
    } finally {
      setActionLoading(false);
    }
  }, [confirmAction, refetch]);

  const handleOrderAdded = useCallback(() => {
    refetch();
    setShowQuickAdd(false);
  }, [refetch]);

  const handleImportComplete = useCallback(() => {
    refetch();
    setShowImport(false);
  }, [refetch]);

  // ---------- Summary ----------

  const summary = useMemo(() => {
    const byStatus: Record<string, number> = {
      pending: 0,
      planned: 0,
      producing: 0,
      done: 0,
      cancelled: 0,
    };
    let totalBatch = 0;
    for (const order of filteredOrders) {
      byStatus[order.status] = (byStatus[order.status] || 0) + 1;
      totalBatch += order.qty_batch;
    }
    const totalWeightTons = (totalBatch * BATCH_KG) / 1000;
    return { byStatus, totalBatch, totalWeightTons };
  }, [filteredOrders]);

  // ---------- Active filter count ----------

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (statusFilter !== 'all') n++;
    if (priorityFilter !== 'all') n++;
    if (boiFilter !== 'all') n++;
    if (searchQuery.trim()) n++;
    return n;
  }, [statusFilter, priorityFilter, boiFilter, searchQuery]);

  const clearFilters = useCallback(() => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setBoiFilter('all');
    setSearchQuery('');
    setCurrentPage(1);
  }, []);

  // ---------- Render ----------

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 pb-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">รายการสั่งผลิต</h1>
            <Badge variant="secondary" className="text-xs">
              {filteredOrders.length} รายการ
            </Badge>
            {loading && (
              <span className="text-xs text-muted-foreground">
                กำลังโหลด...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowQuickAdd(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              เพิ่ม Order
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              นำเข้า CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status */}
          <Select
            value={statusFilter}
            onValueChange={handleFilterChange(setStatusFilter) as (v: string | null) => void}
          >
            <SelectTrigger className="w-[140px] text-xs" size="sm">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority */}
          <Select
            value={priorityFilter}
            onValueChange={handleFilterChange(setPriorityFilter) as (v: string | null) => void}
          >
            <SelectTrigger className="w-[150px] text-xs" size="sm">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* BOI */}
          <Select
            value={boiFilter}
            onValueChange={handleFilterChange(setBoiFilter) as (v: string | null) => void}
          >
            <SelectTrigger className="w-[120px] text-xs" size="sm">
              <SelectValue placeholder="BOI" />
            </SelectTrigger>
            <SelectContent>
              {BOI_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-7 h-7 w-[200px] text-xs"
              placeholder="ค้นหา FG code, ลูกค้า..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={clearFilters}
              className="text-xs text-muted-foreground"
            >
              <X className="h-3 w-3" />
              ล้างตัวกรอง ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 pt-3">
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs w-10">#</TableHead>
                <SortableHead
                  field="order_date"
                  label="วันสั่ง"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  field="fg_code"
                  label="FG Code"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  field="product_name"
                  label="สินค้า"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  field="qty_batch"
                  label="Batch"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  field="customer"
                  label="ลูกค้า"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  field="delivery_date"
                  label="กำหนดส่ง"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  field="boi_level"
                  label="BOI"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  field="priority"
                  label="Priority"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <TableHead className="text-xs">MCPD</TableHead>
                <SortableHead
                  field="status"
                  label="สถานะ"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <TableHead className="text-xs">หมายเหตุ</TableHead>
                <TableHead className="text-xs text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && paginatedOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="h-32 text-center">
                    <span className="text-sm text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </span>
                  </TableCell>
                </TableRow>
              )}
              {!loading && paginatedOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="h-32 text-center">
                    <span className="text-sm text-muted-foreground">
                      ไม่พบรายการ
                    </span>
                    {activeFilterCount > 0 && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={clearFilters}
                        className="ml-2 text-xs"
                      >
                        ล้างตัวกรอง
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {paginatedOrders.map((order, idx) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  index={(safePage - 1) * ROWS_PER_PAGE + idx + 1}
                  onPlan={(id, fg) =>
                    setConfirmAction({ orderId: id, action: 'plan', fgCode: fg })
                  }
                  onCancel={(id, fg) =>
                    setConfirmAction({
                      orderId: id,
                      action: 'cancel',
                      fgCode: fg,
                    })
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-2 flex items-center justify-between border-t">
          <span className="text-xs text-muted-foreground">
            แสดง {(safePage - 1) * ROWS_PER_PAGE + 1}-
            {Math.min(safePage * ROWS_PER_PAGE, sortedOrders.length)} จาก{' '}
            {sortedOrders.length} รายการ
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs px-2 text-muted-foreground">
              หน้า {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              <ChevronsRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="px-4 py-2.5 border-t bg-muted/30 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          รวม <strong className="text-foreground">{filteredOrders.length}</strong>{' '}
          orders
        </span>
        <span className="text-border">|</span>
        <span>
          Pending:{' '}
          <strong className="text-yellow-700">{summary.byStatus.pending}</strong>
        </span>
        <span>
          Planned:{' '}
          <strong className="text-blue-700">{summary.byStatus.planned}</strong>
        </span>
        <span>
          Producing:{' '}
          <strong className="text-indigo-700">
            {summary.byStatus.producing}
          </strong>
        </span>
        <span>
          Done:{' '}
          <strong className="text-green-700">{summary.byStatus.done}</strong>
        </span>
        <span className="text-border">|</span>
        <span>
          Total batch:{' '}
          <strong className="text-foreground">{summary.totalBatch}</strong>
        </span>
        <span>
          Total weight:{' '}
          <strong className="text-foreground">
            {summary.totalWeightTons.toFixed(2)}
          </strong>{' '}
          ตัน
        </span>
      </div>

      {/* Quick Add Dialog */}
      <QuickAddForm
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onSuccess={handleOrderAdded}
      />

      {/* Import Dialog */}
      <ImportOrders
        open={showImport}
        onOpenChange={setShowImport}
        onSuccess={handleImportComplete}
      />

      {/* Confirm Action Dialog */}
      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === 'plan'
                ? 'ยืนยันจัดแผน'
                : 'ยืนยันยกเลิก'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === 'plan'
                ? `ต้องการเปลี่ยนสถานะ ${confirmAction.fgCode} เป็น "จัดแผนแล้ว" ?`
                : `ต้องการยกเลิก order ${confirmAction?.fgCode} ?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={actionLoading}
            >
              ไม่
            </Button>
            <Button
              variant={
                confirmAction?.action === 'cancel' ? 'destructive' : 'default'
              }
              onClick={handleConfirmAction}
              disabled={actionLoading}
            >
              {actionLoading
                ? 'กำลังดำเนินการ...'
                : confirmAction?.action === 'plan'
                ? 'จัดแผน'
                : 'ยกเลิก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --------------- Sortable Table Head ---------------

function SortableHead({
  field,
  label,
  currentField,
  currentDir,
  onSort,
}: {
  field: SortField;
  label: string;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentField === field;
  return (
    <TableHead className="text-xs">
      <button
        className="flex items-center gap-0.5 hover:text-foreground transition-colors cursor-pointer select-none"
        onClick={() => onSort(field)}
      >
        {label}
        {isActive ? (
          currentDir === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <span className="w-3" />
        )}
      </button>
    </TableHead>
  );
}

// --------------- Order Row ---------------

function OrderRow({
  order,
  index,
  onPlan,
  onCancel,
}: {
  order: Order;
  index: number;
  onPlan: (id: string, fgCode: string) => void;
  onCancel: (id: string, fgCode: string) => void;
}) {
  const boiLevel = (order.boi_level || 'NON') as keyof typeof BOI_COLORS;
  const boiColor = BOI_COLORS[boiLevel] || BOI_COLORS.NON;
  const priority = order.priority as keyof typeof PRIORITY_LABELS;
  const priorityInfo = PRIORITY_LABELS[priority] || PRIORITY_LABELS[4];
  const statusInfo = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
  const fgCode = order.product?.fg_code || '---';

  const priorityBgMap: Record<number, string> = {
    1: 'bg-red-100 text-red-800 border-red-200',
    2: 'bg-amber-100 text-amber-800 border-amber-200',
    3: 'bg-orange-100 text-orange-800 border-orange-200',
    4: 'bg-green-100 text-green-800 border-green-200',
  };

  return (
    <TableRow className="text-xs">
      {/* # */}
      <TableCell className="text-muted-foreground">{index}</TableCell>

      {/* วันสั่ง */}
      <TableCell>
        {order.order_date
          ? format(new Date(order.order_date), 'd MMM yy', { locale: th })
          : '---'}
      </TableCell>

      {/* FG Code */}
      <TableCell className="font-mono font-medium">{fgCode}</TableCell>

      {/* สินค้า */}
      <TableCell className="max-w-[150px] truncate">
        {order.product?.name || '---'}
      </TableCell>

      {/* Batch */}
      <TableCell className="font-medium">{order.qty_batch}</TableCell>

      {/* ลูกค้า */}
      <TableCell className="max-w-[120px] truncate">
        {order.customer?.name || '---'}
      </TableCell>

      {/* กำหนดส่ง */}
      <TableCell>
        {order.delivery_date
          ? format(new Date(order.delivery_date), 'd MMM yy', { locale: th })
          : '---'}
      </TableCell>

      {/* BOI */}
      <TableCell>
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0"
          style={{
            backgroundColor: boiColor.bg,
            color: boiColor.text,
            borderColor: boiColor.border,
            borderWidth: 1,
          }}
        >
          {boiLevel}
        </Badge>
      </TableCell>

      {/* Priority */}
      <TableCell>
        <Badge
          variant="secondary"
          className={`text-[10px] px-1.5 py-0 border ${priorityBgMap[order.priority] || priorityBgMap[4]}`}
        >
          P{order.priority} {priorityInfo.label}
        </Badge>
      </TableCell>

      {/* MCPD */}
      <TableCell>
        {order.requires_mcpd && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border border-purple-300"
          >
            MCPD
          </Badge>
        )}
      </TableCell>

      {/* สถานะ */}
      <TableCell>
        <Badge
          variant="secondary"
          className={`text-[10px] px-1.5 py-0 ${statusInfo.bg} ${statusInfo.text}`}
        >
          {statusInfo.label}
        </Badge>
      </TableCell>

      {/* หมายเหตุ */}
      <TableCell className="max-w-[120px] truncate text-muted-foreground">
        {order.remark || ''}
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {order.status === 'pending' && (
            <>
              <Button
                variant="outline"
                size="xs"
                className="text-[10px]"
                onClick={() => onPlan(order.id, fgCode)}
              >
                จัดแผน
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onCancel(order.id, fgCode)}
              >
                ยกเลิก
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
