'use client';

import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BOI_COLORS, PRIORITY_LABELS } from '@/lib/constants';
import type { BoardPlan } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, formatDistanceStrict } from 'date-fns';
import { th } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import BomPopup from '@/components/bom/BomPopup';
import ProductionOutputDialog from '@/components/tracking/ProductionOutputDialog';
import { useTracking } from '@/hooks/useTracking';
import { Play, CheckCircle2, Pause, CircleCheckBig } from 'lucide-react';

interface OrderCardProps {
  plan: BoardPlan;
  compact?: boolean;
  onStatusChange?: () => void;
}

export default function OrderCard({ plan, compact, onStatusChange }: OrderCardProps) {
  const { order } = plan;
  const boiLevel = (order.boi_level || 'NON') as keyof typeof BOI_COLORS;
  const boiColor = BOI_COLORS[boiLevel] || BOI_COLORS.NON;
  const priority = order.priority as keyof typeof PRIORITY_LABELS;
  const priorityInfo = PRIORITY_LABELS[priority] || PRIORITY_LABELS[4];

  const [bomOpen, setBomOpen] = useState(false);
  const [outputDialogOpen, setOutputDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [lotNumber, setLotNumber] = useState<string | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const { startProduction, pauseProduction, getLotForPlan } = useTracking();

  // Load lot number if status is done
  useEffect(() => {
    if (plan.status === 'done') {
      getLotForPlan(plan.id).then((lot) => {
        if (lot) setLotNumber(lot.lot_number);
      });
    }
  }, [plan.status, plan.id, getLotForPlan]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: plan.id,
    data: {
      type: 'order-card',
      plan,
    },
    disabled: plan.status === 'producing' || plan.status === 'done',
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeft: `4px solid ${boiColor.border}`,
    backgroundColor: boiColor.bg,
    opacity: isDragging ? 0.4 : 1,
    cursor: plan.status === 'producing' || plan.status === 'done' ? 'default' : 'grab',
  };

  // Track pointer position to distinguish click from drag
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    // Forward to dnd-kit listeners
    listeners?.onPointerDown?.(e as never);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only open BOM popup if the pointer barely moved (not a drag)
    if (pointerDownPos.current) {
      const dx = Math.abs(e.clientX - pointerDownPos.current.x);
      const dy = Math.abs(e.clientY - pointerDownPos.current.y);
      if (dx < 5 && dy < 5 && !isDragging) {
        setBomOpen(true);
      }
    }
    pointerDownPos.current = null;
  };

  const handleStartProduction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await startProduction(plan.id);
      onStatusChange?.();
    } catch (err) {
      console.error('Failed to start production:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteProduction = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOutputDialogOpen(true);
  };

  const handleOutputComplete = () => {
    onStatusChange?.();
  };

  const handlePauseProduction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      await pauseProduction(plan.id);
      onStatusChange?.();
    } catch (err) {
      console.error('Failed to pause production:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate duration for producing/done status
  const getDuration = () => {
    if (!plan.actual_start) return null;
    const start = new Date(plan.actual_start);
    const end = plan.actual_end ? new Date(plan.actual_end) : new Date();
    return formatDistanceStrict(start, end, { locale: th });
  };

  // --- Compact mode for line board view ---
  if (compact) {
    return (
      <div>
        <Card
          ref={setNodeRef}
          className={cn(
            'px-2 py-1.5 hover:shadow-md transition-shadow touch-none text-[11px]',
            isDragging && 'shadow-lg ring-2 ring-primary/30 z-50',
            plan.status === 'producing' && 'ring-1 ring-blue-400 animate-pulse',
            plan.status === 'done' && 'opacity-70'
          )}
          style={style}
          {...attributes}
          {...listeners}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold truncate" style={{ color: boiColor.text }}>
              {order.product?.fg_code}
            </span>
            <span className="text-muted-foreground shrink-0">{plan.qty_batch}B</span>
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {order.customer?.name}
          </div>
          {(order.requires_mcpd || order.priority <= 2) && (
            <div className="flex gap-0.5 mt-0.5">
              {order.requires_mcpd && (
                <span className="text-[8px] px-1 py-0 rounded bg-purple-100 text-purple-700">MCPD</span>
              )}
              {order.priority <= 2 && (
                <span className="text-[8px] px-1 py-0 rounded bg-red-100 text-red-700">{priorityInfo.label}</span>
              )}
            </div>
          )}
        </Card>
        <BomPopup plan={plan} open={bomOpen} onOpenChange={setBomOpen} />
      </div>
    );
  }

  return (
    <div>
      <Card
        ref={setNodeRef}
        className={cn(
          'p-3 hover:shadow-md transition-shadow touch-none',
          isDragging && 'shadow-lg ring-2 ring-primary/30 z-50',
          plan.status === 'producing' && 'ring-2 ring-blue-400 animate-pulse',
          plan.status === 'done' && 'opacity-75'
        )}
        style={style}
        {...attributes}
        {...listeners}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
      >
        <div className="space-y-1.5">
          <div className="flex items-start justify-between">
            <span className="font-bold text-sm" style={{ color: boiColor.text }}>
              {order.product?.fg_code}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {plan.qty_batch} batch
            </span>
          </div>

          <div className="text-xs text-muted-foreground">
            {order.customer?.name}
          </div>

          {order.delivery_date && (
            <div className="text-xs text-muted-foreground">
              ส่ง {format(new Date(order.delivery_date), 'd MMM', { locale: th })}
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {order.requires_mcpd && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-300">
                MCPD
              </Badge>
            )}
            {order.priority <= 2 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-300">
                {priorityInfo.label}
              </Badge>
            )}
            {order.priority === 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-300">
                {priorityInfo.label}
              </Badge>
            )}
            {order.remark && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {order.remark}
              </Badge>
            )}
          </div>

          {/* Production action buttons */}
          <div className="pt-1 border-t border-black/5">
            {plan.status === 'planned' && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 w-full bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                disabled={actionLoading}
                onClick={handleStartProduction}
              >
                <Play className="h-3 w-3 mr-1" />
                เริ่มผลิต
              </Button>
            )}

            {plan.status === 'producing' && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 flex-1 bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                  disabled={actionLoading}
                  onClick={handleCompleteProduction}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  เสร็จแล้ว
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                  disabled={actionLoading}
                  onClick={handlePauseProduction}
                >
                  <Pause className="h-3 w-3" />
                </Button>
              </div>
            )}

            {plan.status === 'done' && (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] text-green-700">
                  <CircleCheckBig className="h-3 w-3" />
                  <span>เสร็จสิ้น</span>
                  {getDuration() && (
                    <span className="text-muted-foreground ml-auto">{getDuration()}</span>
                  )}
                </div>
                {lotNumber && (
                  <div className="text-[9px] text-muted-foreground font-mono">
                    Lot: {lotNumber}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
      <BomPopup plan={plan} open={bomOpen} onOpenChange={setBomOpen} />
      <ProductionOutputDialog
        open={outputDialogOpen}
        onOpenChange={setOutputDialogOpen}
        planId={plan.id}
        productId={order.product?.id || ''}
        fgCode={order.product?.fg_code || 'UNKNOWN'}
        qtyBatch={plan.qty_batch}
        onComplete={handleOutputComplete}
      />
    </div>
  );
}

/** Lightweight placeholder shown in the DragOverlay while dragging. */
export function OrderCardOverlay({ plan }: { plan: BoardPlan }) {
  const { order } = plan;
  const boiLevel = (order.boi_level || 'NON') as keyof typeof BOI_COLORS;
  const boiColor = BOI_COLORS[boiLevel] || BOI_COLORS.NON;

  return (
    <Card
      className="p-3 shadow-xl ring-2 ring-primary/40 rotate-[2deg] w-[200px]"
      style={{
        borderLeft: `4px solid ${boiColor.border}`,
        backgroundColor: boiColor.bg,
      }}
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between">
          <span className="font-bold text-sm" style={{ color: boiColor.text }}>
            {order.product?.fg_code}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {plan.qty_batch} batch
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {order.customer?.name}
        </div>
      </div>
    </Card>
  );
}
