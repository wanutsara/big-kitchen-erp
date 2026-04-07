'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { BOI_COLORS, BATCH_KG, FLAVORS } from '@/lib/constants';
import type { BoardPlan } from '@/lib/types';
import RecipeBom from './RecipeBom';
import PackagingBom from './PackagingBom';

interface BomPopupProps {
  plan: BoardPlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BomPopup({ plan, open, onOpenChange }: BomPopupProps) {
  const { order } = plan;
  const product = order.product;
  const fgCode = product?.fg_code ?? '';
  const productName = product?.name ?? '';
  const flavorCode = product?.flavor_code as keyof typeof FLAVORS | undefined;
  const flavorName = flavorCode ? FLAVORS[flavorCode] : null;
  const boiLevel = (order.boi_level || 'NON') as keyof typeof BOI_COLORS;
  const boiColor = BOI_COLORS[boiLevel] || BOI_COLORS.NON;
  const totalWeight = plan.qty_batch * BATCH_KG;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => onOpenChange(value)}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                <span
                  className="font-bold"
                  style={{ color: boiColor.text }}
                >
                  {fgCode}
                </span>
                <span className="font-normal text-sm text-muted-foreground">
                  {productName}
                </span>
              </DialogTitle>
              <DialogDescription>
                <span className="flex items-center gap-2 flex-wrap">
                  <span>{plan.qty_batch} batch</span>
                  <span className="text-muted-foreground/50">|</span>
                  <span>{totalWeight.toLocaleString()} kg</span>
                  {flavorName && (
                    <>
                      <span className="text-muted-foreground/50">|</span>
                      <span>{flavorName}</span>
                    </>
                  )}
                </span>
              </DialogDescription>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
                style={{
                  backgroundColor: boiColor.bg,
                  color: boiColor.text,
                  borderColor: boiColor.border,
                }}
              >
                {boiLevel}
              </Badge>
              {order.requires_mcpd && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-300"
                >
                  MCPD
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs defaultValue="recipe">
            <TabsList className="w-full">
              <TabsTrigger value="recipe">recipe</TabsTrigger>
              <TabsTrigger value="packaging">packaging</TabsTrigger>
            </TabsList>

            <TabsContent value="recipe" className="mt-3">
              {product?.id ? (
                <RecipeBom productId={product.id} qtyBatch={plan.qty_batch} />
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  no product data available
                </div>
              )}
            </TabsContent>

            <TabsContent value="packaging" className="mt-3">
              {product?.id ? (
                <PackagingBom
                  productId={product.id}
                  fgCode={fgCode}
                  qtyBatch={plan.qty_batch}
                />
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  no product data available
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground">
              total weight: <strong>{totalWeight.toLocaleString()} kg</strong>{' '}
              ({plan.qty_batch} batch x {BATCH_KG} kg)
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1" />
              print BOM
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
