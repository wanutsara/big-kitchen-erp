'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import type { Product, Customer, Ingredient, Material } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Products Tab
// ---------------------------------------------------------------------------

const PRODUCT_CATEGORIES = ['ปลาเส้น', 'สปูอัด', 'ปลาหมึก', 'สอดไส้', 'อื่นๆ'];
const BATCH_TYPES = ['B5', 'By', 'B3', 'N', 'CN'];
const FLAVOR_OPTIONS: { code: string; label: string }[] = [
  { code: '01', label: 'รสเข้มข้น' },
  { code: '02', label: 'BBQ' },
  { code: '03', label: 'ซุปเปอร์แซ่บ' },
  { code: '04', label: 'ปลาหมึก' },
  { code: '05', label: 'บาวาเรียน' },
  { code: '06', label: 'ดั้งเดิม' },
  { code: '08', label: 'ไก่ย่าง' },
  { code: '09', label: 'ปูอัด' },
  { code: '11', label: 'พิซซ่า/sausage' },
];

type ProductForm = {
  fg_code: string;
  name: string;
  category: string;
  flavor: string;
  flavor_code: string;
  batch_type: string;
  default_batch_kg: string;
};

const emptyProductForm: ProductForm = {
  fg_code: '',
  name: '',
  category: '',
  flavor: '',
  flavor_code: '',
  batch_type: '',
  default_batch_kg: '75',
};

function ProductsTab() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('fg_code');
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (p) =>
        p.fg_code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const openAdd = () => {
    setForm(emptyProductForm);
    setShowAdd(true);
  };

  const openEdit = (item: Product) => {
    setForm({
      fg_code: item.fg_code,
      name: item.name,
      category: item.category ?? '',
      flavor: item.flavor ?? '',
      flavor_code: item.flavor_code ?? '',
      batch_type: item.batch_type ?? '',
      default_batch_kg: String(item.default_batch_kg),
    });
    setEditItem(item);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      fg_code: form.fg_code.trim(),
      name: form.name.trim(),
      category: form.category || null,
      flavor: form.flavor || null,
      flavor_code: form.flavor_code || null,
      batch_type: form.batch_type || null,
      default_batch_kg: Number(form.default_batch_kg) || 75,
    };

    if (editItem) {
      await supabase.from('products').update(payload).eq('id', editItem.id);
      setEditItem(null);
    } else {
      await supabase.from('products').insert(payload);
      setShowAdd(false);
    }
    setSaving(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', deleteItem.id);
    setDeleteItem(null);
    fetchData();
  };

  const handleFlavorChange = (code: string) => {
    const found = FLAVOR_OPTIONS.find((f) => f.code === code);
    setForm((prev) => ({
      ...prev,
      flavor_code: code,
      flavor: found?.label ?? '',
    }));
  };

  const formDialog = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>FG Code *</Label>
        <Input
          value={form.fg_code}
          onChange={(e) => setForm((f) => ({ ...f, fg_code: e.target.value }))}
          placeholder="เช่น FG0202"
        />
      </div>
      <div className="space-y-1.5">
        <Label>ชื่อสินค้า *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="ชื่อผลิตภัณฑ์"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>หมวดหมู่</Label>
          <Select
            value={form.category}
            onValueChange={(val) =>
              setForm((f) => ({ ...f, category: val ?? '' }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกหมวดหมู่" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>รส</Label>
          <Select
            value={form.flavor_code}
            onValueChange={(v) => v && handleFlavorChange(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกรส" />
            </SelectTrigger>
            <SelectContent>
              {FLAVOR_OPTIONS.map((f) => (
                <SelectItem key={f.code} value={f.code}>
                  {f.code} — {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Batch Type</Label>
          <Select
            value={form.batch_type}
            onValueChange={(val) =>
              setForm((f) => ({ ...f, batch_type: val ?? '' }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือก Batch Type" />
            </SelectTrigger>
            <SelectContent>
              {BATCH_TYPES.map((bt) => (
                <SelectItem key={bt} value={bt}>
                  {bt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Default Batch (kg)</Label>
          <Input
            type="number"
            value={form.default_batch_kg}
            onChange={(e) =>
              setForm((f) => ({ ...f, default_batch_kg: e.target.value }))
            }
          />
        </div>
      </div>
    </div>
  );

  const canSave = form.fg_code.trim() !== '' && form.name.trim() !== '';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหา FG Code หรือชื่อสินค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" data-icon="inline-start" />
          เพิ่มสินค้า
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          กำลังโหลด...
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>FG Code</TableHead>
                <TableHead>ชื่อสินค้า</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead>รส</TableHead>
                <TableHead>Batch Type</TableHead>
                <TableHead className="text-right">Batch (kg)</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.fg_code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.category ?? '—'}</TableCell>
                    <TableCell>
                      {item.flavor ? (
                        <Badge variant="secondary">{item.flavor}</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {item.batch_type ? (
                        <Badge variant="outline">{item.batch_type}</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.default_batch_kg}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => setDeleteItem(item)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} />
        </>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มสินค้าใหม่</DialogTitle>
            <DialogDescription>กรอกข้อมูลสินค้าเพื่อเพิ่มในระบบ</DialogDescription>
          </DialogHeader>
          {formDialog}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>ยกเลิก</DialogClose>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขสินค้า</DialogTitle>
            <DialogDescription>แก้ไขข้อมูลสินค้า {editItem?.fg_code}</DialogDescription>
          </DialogHeader>
          {formDialog}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>ยกเลิก</DialogClose>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        title="ลบสินค้า"
        description={`ยืนยันลบสินค้า ${deleteItem?.fg_code} — ${deleteItem?.name} หรือไม่?`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customers Tab
// ---------------------------------------------------------------------------


type CustomerForm = {
  name: string;
  market: string;
  contact_channel: string;
  notes: string;
};

const emptyCustomerForm: CustomerForm = {
  name: '',
  market: '',
  contact_channel: '',
  notes: '',
};

function CustomersTab() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editItem, setEditItem] = useState<Customer | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyCustomerForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.market ?? '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const openAdd = () => {
    setForm(emptyCustomerForm);
    setShowAdd(true);
  };

  const openEdit = (item: Customer) => {
    setForm({
      name: item.name,
      market: item.market ?? '',
      contact_channel: item.contact_channel ?? '',
      notes: item.notes ?? '',
    });
    setEditItem(item);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: form.name.trim(),
      market: form.market || null,
      contact_channel: form.contact_channel || null,
      notes: form.notes.trim() || null,
    };

    if (editItem) {
      await supabase.from('customers').update(payload).eq('id', editItem.id);
      setEditItem(null);
    } else {
      await supabase.from('customers').insert(payload);
      setShowAdd(false);
    }
    setSaving(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const supabase = createClient();
    await supabase.from('customers').delete().eq('id', deleteItem.id);
    setDeleteItem(null);
    fetchData();
  };

  const marketLabel = (m: string | null) => {
    if (m === 'domestic') return 'ในประเทศ';
    if (m === 'export') return 'ส่งออก';
    if (m === 'duty_free') return 'Duty Free';
    return '—';
  };

  const channelLabel = (c: string | null) => {
    if (c === 'mint') return 'MINT';
    if (c === 'phone') return 'โทรศัพท์';
    if (c === 'line') return 'LINE';
    return '—';
  };

  const formDialog = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>ชื่อลูกค้า *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="ชื่อลูกค้า"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>ตลาด</Label>
          <Select
            value={form.market}
            onValueChange={(val) => setForm((f) => ({ ...f, market: val ?? '' }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกตลาด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="domestic">ในประเทศ</SelectItem>
              <SelectItem value="export">ส่งออก</SelectItem>
              <SelectItem value="duty_free">Duty Free</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>ช่องทาง</Label>
          <Select
            value={form.contact_channel}
            onValueChange={(val) => setForm((f) => ({ ...f, contact_channel: val ?? '' }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกช่องทาง" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mint">MINT</SelectItem>
              <SelectItem value="phone">โทรศัพท์</SelectItem>
              <SelectItem value="line">LINE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>หมายเหตุ</Label>
        <Input
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="หมายเหตุเพิ่มเติม"
        />
      </div>
    </div>
  );

  const canSave = form.name.trim() !== '';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อลูกค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" data-icon="inline-start" />
          เพิ่มลูกค้า
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          กำลังโหลด...
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ตลาด</TableHead>
                <TableHead>ช่องทาง</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{marketLabel(item.market)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{channelLabel(item.contact_channel)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {item.notes ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => setDeleteItem(item)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} />
        </>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
            <DialogDescription>กรอกข้อมูลลูกค้าเพื่อเพิ่มในระบบ</DialogDescription>
          </DialogHeader>
          {formDialog}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>ยกเลิก</DialogClose>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขลูกค้า</DialogTitle>
            <DialogDescription>แก้ไขข้อมูลลูกค้า {editItem?.name}</DialogDescription>
          </DialogHeader>
          {formDialog}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>ยกเลิก</DialogClose>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        title="ลบลูกค้า"
        description={`ยืนยันลบลูกค้า "${deleteItem?.name}" หรือไม่?`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ingredients Tab
// ---------------------------------------------------------------------------

const INGREDIENT_CATEGORIES = [
  'surimi',
  'seasoning',
  'additive',
  'starch',
  'oil',
  'preservative',
  'water',
];

const INGREDIENT_CATEGORY_LABELS: Record<string, string> = {
  surimi: 'ซูริมิ',
  seasoning: 'เครื่องปรุง',
  additive: 'สารเติมแต่ง',
  starch: 'แป้ง',
  oil: 'น้ำมัน',
  preservative: 'สารกันเสีย',
  water: 'น้ำ',
};

type IngredientForm = {
  code: string;
  name: string;
  category: string;
  unit: string;
};

const emptyIngredientForm: IngredientForm = {
  code: '',
  name: '',
  category: '',
  unit: 'kg',
};

function IngredientsTab() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editItem, setEditItem] = useState<Ingredient | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<IngredientForm>(emptyIngredientForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('ingredients')
      .select('*')
      .order('code');
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        i.code.toLowerCase().includes(q) ||
        (i.name ?? '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const openAdd = () => {
    setForm(emptyIngredientForm);
    setShowAdd(true);
  };

  const openEdit = (item: Ingredient) => {
    setForm({
      code: item.code,
      name: item.name ?? '',
      category: item.category ?? '',
      unit: item.unit,
    });
    setEditItem(item);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      code: form.code.trim(),
      name: form.name.trim() || null,
      category: form.category || null,
      unit: form.unit || 'kg',
    };

    if (editItem) {
      await supabase.from('ingredients').update(payload).eq('id', editItem.id);
      setEditItem(null);
    } else {
      await supabase.from('ingredients').insert(payload);
      setShowAdd(false);
    }
    setSaving(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const supabase = createClient();
    await supabase.from('ingredients').delete().eq('id', deleteItem.id);
    setDeleteItem(null);
    fetchData();
  };

  const formDialog = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>รหัส (R-code) *</Label>
        <Input
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          placeholder="เช่น R101A"
        />
      </div>
      <div className="space-y-1.5">
        <Label>ชื่อวัตถุดิบ</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="ชื่อวัตถุดิบ"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>หมวดหมู่</Label>
          <Select
            value={form.category}
            onValueChange={(val) => setForm((f) => ({ ...f, category: val ?? '' }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกหมวดหมู่" />
            </SelectTrigger>
            <SelectContent>
              {INGREDIENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {INGREDIENT_CATEGORY_LABELS[c] ?? c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>หน่วย</Label>
          <Input
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            placeholder="kg"
          />
        </div>
      </div>
    </div>
  );

  const canSave = form.code.trim() !== '';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหารหัสหรือชื่อวัตถุดิบ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" data-icon="inline-start" />
          เพิ่มวัตถุดิบ
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          กำลังโหลด...
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead>หน่วย</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell>{item.name ?? '—'}</TableCell>
                    <TableCell>
                      {item.category ? (
                        <Badge variant="secondary">
                          {INGREDIENT_CATEGORY_LABELS[item.category] ?? item.category}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => setDeleteItem(item)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} />
        </>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มวัตถุดิบใหม่</DialogTitle>
            <DialogDescription>กรอกข้อมูลวัตถุดิบ (R-code)</DialogDescription>
          </DialogHeader>
          {formDialog}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>ยกเลิก</DialogClose>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขวัตถุดิบ</DialogTitle>
            <DialogDescription>แก้ไขข้อมูล {editItem?.code}</DialogDescription>
          </DialogHeader>
          {formDialog}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>ยกเลิก</DialogClose>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        title="ลบวัตถุดิบ"
        description={`ยืนยันลบวัตถุดิบ ${deleteItem?.code} หรือไม่?`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Materials Tab
// ---------------------------------------------------------------------------

const MATERIAL_TYPES = ['film', 'box', 'label', 'sticker', 'cap', 'lid', 'bag', 'capsule'];

type MaterialForm = {
  code: string;
  name: string;
  type: string;
  brand: string;
  boi_category: string;
};

const emptyMaterialForm: MaterialForm = {
  code: '',
  name: '',
  type: '',
  brand: '',
  boi_category: '',
};

function MaterialsTab() {
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [editItem, setEditItem] = useState<Material | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Material | null>(null);
  const [form, setForm] = useState<MaterialForm>(emptyMaterialForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('materials')
      .select('*')
      .order('code');
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (m) =>
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const openAdd = () => {
    setForm(emptyMaterialForm);
    setShowAdd(true);
  };

  const openEdit = (item: Material) => {
    setForm({
      code: item.code,
      name: item.name,
      type: item.type ?? '',
      brand: item.brand ?? '',
      boi_category: item.boi_category ?? '',
    });
    setEditItem(item);
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: form.type || null,
      brand: form.brand.trim() || null,
      boi_category: form.boi_category || null,
    };

    if (editItem) {
      await supabase.from('materials').update(payload).eq('id', editItem.id);
      setEditItem(null);
    } else {
      await supabase.from('materials').insert(payload);
      setShowAdd(false);
    }
    setSaving(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const supabase = createClient();
    await supabase.from('materials').delete().eq('id', deleteItem.id);
    setDeleteItem(null);
    fetchData();
  };

  const formDialog = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>รหัสวัสดุ *</Label>
        <Input
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          placeholder="เช่น FP02-80-F-01"
        />
      </div>
      <div className="space-y-1.5">
        <Label>ชื่อวัสดุ *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="ชื่อวัสดุบรรจุภัณฑ์"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>ประเภท</Label>
          <Select
            value={form.type}
            onValueChange={(val) => setForm((f) => ({ ...f, type: val ?? '' }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกประเภท" />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>BOI Category</Label>
          <Select
            value={form.boi_category}
            onValueChange={(val) => setForm((f) => ({ ...f, boi_category: val ?? '' }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือก BOI" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="imported">Imported</SelectItem>
              <SelectItem value="domestic">Domestic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>แบรนด์</Label>
        <Input
          value={form.brand}
          onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
          placeholder="แบรนด์ (ถ้ามี)"
        />
      </div>
    </div>
  );

  const canSave = form.code.trim() !== '' && form.name.trim() !== '';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหารหัสหรือชื่อวัสดุ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" data-icon="inline-start" />
          เพิ่มวัสดุ
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          กำลังโหลด...
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>BOI Category</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      {item.type ? (
                        <Badge variant="secondary">{item.type}</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {item.boi_category ? (
                        <Badge variant="outline">{item.boi_category}</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon-xs" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => setDeleteItem(item)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} />
        </>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มวัสดุบรรจุภัณฑ์ใหม่</DialogTitle>
            <DialogDescription>กรอกข้อมูลวัสดุบรรจุภัณฑ์</DialogDescription>
          </DialogHeader>
          {formDialog}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>ยกเลิก</DialogClose>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขวัสดุบรรจุภัณฑ์</DialogTitle>
            <DialogDescription>แก้ไขข้อมูล {editItem?.code}</DialogDescription>
          </DialogHeader>
          {formDialog}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>ยกเลิก</DialogClose>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        onConfirm={handleDelete}
        title="ลบวัสดุบรรจุภัณฑ์"
        description={`ยืนยันลบวัสดุ ${deleteItem?.code} — ${deleteItem?.name} หรือไม่?`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: Pagination
// ---------------------------------------------------------------------------

function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  totalItems: number;
}) {
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        แสดง {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalItems)} จาก{' '}
        {totalItems} รายการ
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-2 text-xs">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-xs"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: Delete Confirmation Dialog
// ---------------------------------------------------------------------------

function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>ยกเลิก</DialogClose>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
            }}
          >
            ลบ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page: Tabbed interface with counts
// ---------------------------------------------------------------------------

export default function MasterPage() {
  const [productCount, setProductCount] = useState<number | null>(null);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [ingredientCount, setIngredientCount] = useState<number | null>(null);
  const [materialCount, setMaterialCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => setProductCount(count ?? 0));

    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => setCustomerCount(count ?? 0));

    supabase
      .from('ingredients')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => setIngredientCount(count ?? 0));

    supabase
      .from('materials')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => setMaterialCount(count ?? 0));
  }, []);

  const countLabel = (n: number | null) => (n !== null ? ` (${n})` : '');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-5">ข้อมูลหลัก</h1>
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">
            สินค้า{countLabel(productCount)}
          </TabsTrigger>
          <TabsTrigger value="customers">
            ลูกค้า{countLabel(customerCount)}
          </TabsTrigger>
          <TabsTrigger value="ingredients">
            วัตถุดิบ{countLabel(ingredientCount)}
          </TabsTrigger>
          <TabsTrigger value="materials">
            วัสดุบรรจุภัณฑ์{countLabel(materialCount)}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="customers" className="mt-4">
          <CustomersTab />
        </TabsContent>
        <TabsContent value="ingredients" className="mt-4">
          <IngredientsTab />
        </TabsContent>
        <TabsContent value="materials" className="mt-4">
          <MaterialsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
