'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Inbox,
  Plus,
  Upload,
  Filter,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useOrders } from '@/hooks/useOrders';
import { BOI_COLORS, PRIORITY_LABELS } from '@/lib/constants';
import type { Order } from '@/lib/types';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import QuickAddForm from './QuickAddForm';
import ImportOrders from './ImportOrders';

interface OrderInboxProps {
  onOrderPlaced?: () => void;
}

type PriorityFilter = 'all' | '1' | '2' | '3' | '4';
type BoiFilter = 'all' | 'BOI4' | 'BOI5' | 'NON';

export default function OrderInbox({ onOrderPlaced }: OrderInboxProps) {
  const { orders, loading, error, refetch } = useOrders('pending');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [boiFilter, setBoiFilter] = useState<BoiFilter>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Extract unique customer names for filter dropdown
  const customerNames = useMemo(() => {
    const names = new Set<string>();
    for (const order of orders) {
      if (order.customer?.name) {
        names.add(order.customer.name);
      }
    }
    return Array.from(names).sort();
  }, [orders]);

  // Filter and sort orders: priority ascending, then delivery_date ascending
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (priorityFilter !== 'all' && order.priority !== Number(priorityFilter)) {
        return false;
      }
      if (boiFilter !== 'all' && order.boi_level !== boiFilter) {
        return false;
      }
      if (customerFilter !== 'all' && order.customer?.name !== customerFilter) {
        return false;
      }
      return true;
    });
    // Already sorted by priority + delivery_date from the hook
  }, [orders, priorityFilter, boiFilter, customerFilter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (priorityFilter !== 'all') count++;
    if (boiFilter !== 'all') count++;
    if (customerFilter !== 'all') count++;
    return count;
  }, [priorityFilter, boiFilter, customerFilter]);

  const clearFilters = useCallback(() => {
    setPriorityFilter('all');
    setBoiFilter('all');
    setCustomerFilter('all');
  }, []);

  const handleOrderAdded = useCallback(() => {
    refetch();
    setShowQuickAdd(false);
    onOrderPlaced?.();
  }, [refetch, onOrderPlaced]);

  const handleImportComplete = useCallback(() => {
    refetch();
    setShowImport(false);
    onOrderPlaced?.();
  }, [refetch, onOrderPlaced]);

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="relative" />
        }
      >
        <Inbox className="h-4 w-4" />
        <span>รายการรอจัด</span>
        {orders.length > 0 && (
          <Badge
            variant="destructive"
            className="ml-1 h-5 min-w-5 px-1 text-[10px]"
          >
            {orders.length}
          </Badge>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="pb-0">
          <SheetTitle>
            รายการรอจัด
          </SheetTitle>
          <SheetDescription>
            {loading
              ? 'กำลังโหลด...'
              : `${filteredOrders.length} orders รอจัด`}
          </SheetDescription>
        </SheetHeader>

        {/* Action buttons */}
        <div className="flex gap-2 px-4">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowQuickAdd(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่มด่วน
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            นำเข้าจาก MINT
          </Button>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            className="ml-auto relative"
          >
            <Filter className="h-3.5 w-3.5" />
            กรอง
            {activeFilterCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-4 min-w-4 px-0.5 text-[9px]"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-4 space-y-2">
            <Separator />
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Priority</span>
                <Select
                  value={priorityFilter}
                  onValueChange={(val) =>
                    setPriorityFilter(val as PriorityFilter)
                  }
                >
                  <SelectTrigger className="w-full text-xs" size="sm">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="1">P1 ส่งออก</SelectItem>
                    <SelectItem value="2">P2 Stock ต่ำ</SelectItem>
                    <SelectItem value="3">P3 ยี่ปั๊วด่วน</SelectItem>
                    <SelectItem value="4">P4 ปกติ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">BOI</span>
                <Select
                  value={boiFilter}
                  onValueChange={(val) => setBoiFilter(val as BoiFilter)}
                >
                  <SelectTrigger className="w-full text-xs" size="sm">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="BOI4">BOI4</SelectItem>
                    <SelectItem value="BOI5">BOI5</SelectItem>
                    <SelectItem value="NON">NON-BOI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">ลูกค้า</span>
                <Select
                  value={customerFilter}
                  onValueChange={(v) => setCustomerFilter(v ?? '')}
                >
                  <SelectTrigger className="w-full text-xs" size="sm">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {customerNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={clearFilters}
                className="text-xs text-muted-foreground"
              >
                <X className="h-3 w-3" />
                ล้างตัวกรอง
              </Button>
            )}
            <Separator />
          </div>
        )}

        {/* Order list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && filteredOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-10 w-10 mb-2 opacity-50" />
              <span className="text-sm">ไม่มีรายการรอจัด</span>
              {activeFilterCount > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-1 text-xs"
                >
                  ล้างตัวกรอง
                </Button>
              )}
            </div>
          )}

          {filteredOrders.map((order) => (
            <InboxOrderCard key={order.id} order={order} />
          ))}
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
      </SheetContent>
    </Sheet>
  );
}

// ---------- Mini Order Card for Inbox ----------

interface InboxOrderCardProps {
  order: Order;
}

function InboxOrderCard({ order }: InboxOrderCardProps) {
  const boiLevel = (order.boi_level || 'NON') as keyof typeof BOI_COLORS;
  const boiColor = BOI_COLORS[boiLevel] || BOI_COLORS.NON;
  const priority = order.priority as keyof typeof PRIORITY_LABELS;
  const priorityInfo = PRIORITY_LABELS[priority] || PRIORITY_LABELS[4];

  return (
    <div
      className="rounded-lg border p-3 cursor-grab hover:shadow-sm transition-shadow active:cursor-grabbing"
      style={{
        borderLeft: `4px solid ${boiColor.border}`,
        backgroundColor: boiColor.bg,
      }}
    >
      <div className="space-y-1.5">
        {/* Top row: FG code + batch count */}
        <div className="flex items-start justify-between">
          <span className="font-bold text-sm" style={{ color: boiColor.text }}>
            {order.product?.fg_code || '—'}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {order.qty_batch} batch
          </span>
        </div>

        {/* Product name */}
        {order.product?.name && (
          <div className="text-xs text-muted-foreground truncate">
            {order.product.name}
          </div>
        )}

        {/* Customer + delivery date */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{order.customer?.name || '—'}</span>
          {order.delivery_date && (
            <span>
              ส่ง{' '}
              {format(new Date(order.delivery_date), 'd MMM', { locale: th })}
            </span>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          {/* Priority badge */}
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0"
            style={{
              backgroundColor:
                priority <= 2
                  ? '#FEE2E2'
                  : priority === 3
                  ? '#FFEDD5'
                  : '#DCFCE7',
              color:
                priority <= 2
                  ? '#991B1B'
                  : priority === 3
                  ? '#9A3412'
                  : '#166534',
            }}
          >
            P{order.priority} {priorityInfo.label}
          </Badge>

          {/* BOI badge */}
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

          {/* MCPD badge */}
          {order.requires_mcpd && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-300"
            >
              MCPD
            </Badge>
          )}

          {/* Remark badge */}
          {order.remark && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {order.remark}
            </Badge>
          )}
        </div>

        {/* PO number if available */}
        {order.po_number && (
          <div className="text-[10px] text-muted-foreground">
            PO: {order.po_number}
          </div>
        )}
      </div>
    </div>
  );
}
