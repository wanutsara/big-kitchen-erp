'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  LayoutDashboard,
  Inbox,
  ClipboardList,
  Shield,
  Warehouse,
  PackageCheck,
  Calculator,
  Database,
  FileText,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const icons = {
  BarChart3,
  LayoutDashboard,
  Inbox,
  ClipboardList,
  Shield,
  Warehouse,
  PackageCheck,
  Calculator,
  Database,
  FileText,
  Activity,
} as const;

const NAV_ITEMS = [
  { href: '/dashboard', label: 'ภาพรวม', icon: 'BarChart3' as const },
  { href: '/board', label: 'แผนผลิต', icon: 'LayoutDashboard' as const },
  { href: '/tracking', label: 'ติดตามผลิต', icon: 'Activity' as const },
  { href: '/inbox', label: 'รายการสั่ง', icon: 'Inbox' as const },
  { href: '/bom', label: 'BOM', icon: 'ClipboardList' as const },
  { href: '/boi', label: 'BOI', icon: 'Shield' as const },
  { href: '/inventory', label: 'คลังวัตถุดิบ', icon: 'Warehouse' as const },
  { href: '/fg-inventory', label: 'คลัง FG', icon: 'PackageCheck' as const },
  { href: '/mrp', label: 'MRP', icon: 'Calculator' as const },
  { href: '/master', label: 'ข้อมูลหลัก', icon: 'Database' as const },
  { href: '/reports', label: 'รายงาน', icon: 'FileText' as const },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold">Big Kitchen</h1>
        <p className="text-xs text-muted-foreground">Production Planner</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = icons[item.icon];
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t text-xs text-muted-foreground">
        Big Kitchen ERP v0.1
      </div>
    </aside>
  );
}
