export const FACTORIES = {
  big2: { name: 'Big 2', lines: 8, maxBatchPerDay: 176 },
  big1: { name: 'Big 1', lines: 4, maxBatchPerDay: 88 },
} as const;

export type FactoryKey = keyof typeof FACTORIES;

export const BATCH_KG = 75;
export const LINE_BATCH_PER_DAY = 22;
export const BOI_CAP_TONS_PER_YEAR = 1544;

export const BOI_COLORS = {
  BOI4: { bg: '#EAF3DE', border: '#97C459', text: '#27500A' },
  BOI5: { bg: '#FBEAF0', border: '#ED93B1', text: '#72243E' },
  NON: { bg: '#FAECE7', border: '#F0997B', text: '#712B13' },
} as const;

export type BoiLevel = keyof typeof BOI_COLORS;

export const PRIORITY_LABELS = {
  1: { label: 'ส่งออก+MCPD', color: 'red' },
  2: { label: 'Stock ต่ำ', color: 'amber' },
  3: { label: 'ยี่ปั๊วด่วน', color: 'orange' },
  4: { label: 'ปกติ', color: 'green' },
} as const;

export const CAPACITY_THRESHOLDS = {
  normal: 70,
  warning: 90,
  critical: 100,
} as const;

export const FLAVORS = {
  '01': 'รสเข้มข้น',
  '02': 'BBQ',
  '03': 'ซุปเปอร์แซ่บ',
  '04': 'ปลาหมึก',
  '05': 'บาวาเรียน',
  '06': 'ดั้งเดิม',
  '08': 'ไก่ย่าง',
  '09': 'ปูอัด',
  '11': 'พิซซ่า/sausage',
} as const;

export const BOM_RATIOS: Record<
  string,
  { avg: number; min: number; max: number; n: number; stable: boolean }
> = {
  'FG2201|600x15-Fxx69': { avg: 9.88, min: 9.52, max: 10.0, n: 44, stable: true },
  'FG0904|5000x2-PTS-00': { avg: 5.19, min: 3.67, max: 6.0, n: 17, stable: false },
  'FG0901|5000-Fxx01': { avg: 9.12, min: 0.18, max: 14.0, n: 31, stable: false },
  'FG0901|80-Fxx01': { avg: 11.79, min: 3.0, max: 17.5, n: 20, stable: false },
  'FG0901|72-Fxx18': { avg: 11.71, min: 2.0, max: 19.47, n: 21, stable: false },
  'FG0901|170L-03': { avg: 4.5, min: 1.79, max: 9.09, n: 12, stable: false },
  'FG0202|80-Fxx01': { avg: 15.95, min: 5.07, max: 21.82, n: 22, stable: false },
  'FG0202|72-Fxx18': { avg: 17.6, min: 1.43, max: 22.21, n: 22, stable: false },
  'FG0202|5000-Fxx01': { avg: 6.99, min: 2.68, max: 16.0, n: 17, stable: false },
  'FG0218|5000-Fxx47': { avg: 9.21, min: 2.0, max: 28.08, n: 28, stable: false },
  'FG0218|5000-F40-00': { avg: 6.62, min: 2.27, max: 20.0, n: 24, stable: false },
  'FG0305|80-Fxx01': { avg: 11.94, min: 7.5, max: 26.5, n: 12, stable: false },
  'FG0305|60-Fxx53': { avg: 12.3, min: 4.29, max: 27.75, n: 13, stable: false },
  'FG0802|80-Fxx01': { avg: 16.29, min: 4.5, max: 22.73, n: 11, stable: false },
  'FG0802|72-Fxx18': { avg: 19.24, min: 11.36, max: 25.0, n: 9, stable: false },
  'FG0101|80-Fxx01': { avg: 12.79, min: 5.0, max: 17.5, n: 9, stable: false },
  'FG0605|5000-D03-001': { avg: 8.59, min: 3.33, max: 15.0, n: 9, stable: false },
};

export const NAV_ITEMS = [
  { href: '/board', label: 'แผนผลิต', icon: 'LayoutDashboard' },
  { href: '/tracking', label: 'ติดตามผลิต', icon: 'Activity' },
  { href: '/inbox', label: 'รายการสั่ง', icon: 'Inbox' },
  { href: '/bom', label: 'BOM', icon: 'ClipboardList' },
  { href: '/boi', label: 'BOI', icon: 'Shield' },
  { href: '/master', label: 'ข้อมูลหลัก', icon: 'Database' },
  { href: '/reports', label: 'รายงาน', icon: 'FileText' },
] as const;
