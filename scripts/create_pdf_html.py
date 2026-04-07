#!/usr/bin/env python3
"""Generate Big Kitchen ERP Manual PDF via HTML + Playwright (Thai font support)"""

import asyncio
from playwright.async_api import async_playwright

HTML_CONTENT = """<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans Thai', sans-serif; color: #1e293b; font-size: 11pt; line-height: 1.6; }

  .page { page-break-after: always; padding: 40px 50px; min-height: 100vh; }
  .page:last-child { page-break-after: avoid; }

  h1 { font-size: 22pt; color: #0f172a; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  h2 { font-size: 16pt; color: #1e40af; margin: 20px 0 8px; }
  h3 { font-size: 12pt; color: #334155; margin: 14px 0 6px; }

  p { margin-bottom: 8px; }
  ul { margin: 4px 0 8px 20px; }
  li { margin-bottom: 3px; }

  .cover { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; }
  .cover h1 { font-size: 36pt; border: none; margin-bottom: 4px; }
  .cover .sub { font-size: 16pt; color: #64748b; margin-bottom: 30px; }
  .cover .desc { font-size: 14pt; color: #475569; margin-bottom: 20px; }
  .cover .version { font-size: 10pt; color: #94a3b8; margin-top: 40px; }

  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 16px 0; }
  .stat-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center; }
  .stat-box .num { font-size: 16pt; font-weight: 700; color: #1e40af; }
  .stat-box .label { font-size: 9pt; color: #64748b; }

  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 10pt; }
  th { background: #1e40af; color: white; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }

  .feature-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0; }
  .feature-box h3 { margin-top: 0; }

  .step-list { counter-reset: step; list-style: none; margin-left: 0; }
  .step-list li { counter-increment: step; padding-left: 28px; position: relative; margin-bottom: 4px; }
  .step-list li::before { content: counter(step); position: absolute; left: 0; background: #1e40af; color: white; width: 20px; height: 20px; border-radius: 50%; text-align: center; font-size: 9pt; line-height: 20px; font-weight: 600; }

  .workflow-section { margin: 12px 0; }
  .wf-header { padding: 8px 14px; color: white; font-weight: 600; font-size: 11pt; border-radius: 6px 6px 0 0; }
  .wf-body { padding: 10px 14px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 6px 6px; }
  .wf-blue { background: #1e40af; }
  .wf-green { background: #16a34a; }
  .wf-purple { background: #7c3aed; }

  .flow-box { background: #eff6ff; border: 2px solid #1e40af; border-radius: 8px; padding: 14px; text-align: center; color: #1e40af; font-weight: 600; margin: 16px 0; font-size: 10pt; }

  .toc a { text-decoration: none; color: #1e293b; display: block; padding: 3px 0; }
  .toc a:hover { color: #1e40af; }
  .toc .sub { padding-left: 24px; color: #64748b; font-size: 10pt; }

  .badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 8pt; font-weight: 600; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-green { background: #dcfce7; color: #16a34a; }
  .badge-red { background: #fee2e2; color: #dc2626; }
  .badge-amber { background: #fef3c7; color: #d97706; }
  .badge-purple { background: #ede9fe; color: #7c3aed; }

  .url-tag { color: #64748b; font-size: 9pt; }
</style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page">
  <div class="cover">
    <h1>Big Kitchen</h1>
    <div class="sub">Production Planner ERP</div>
    <hr style="width:200px;border:1px solid #1e40af;margin:16px 0;">
    <div class="desc" style="font-size:20pt;font-weight:700;color:#0f172a;">คู่มือการใช้งานระบบ</div>
    <div class="desc">ระบบวางแผนการผลิตสำหรับโรงงาน Big Kitchen</div>
    <div class="stats-grid" style="width:500px;margin-top:20px;">
      <div class="stat-box"><div class="num">11</div><div class="label">เมนูหลัก</div></div>
      <div class="stat-box"><div class="num">123</div><div class="label">สินค้า</div></div>
      <div class="stat-box"><div class="num">127</div><div class="label">สูตรอาหาร</div></div>
      <div class="stat-box"><div class="num">24</div><div class="label">ลูกค้า</div></div>
      <div class="stat-box"><div class="num">475</div><div class="label">SKUs</div></div>
      <div class="stat-box"><div class="num">287</div><div class="label">วัสดุบรรจุภัณฑ์</div></div>
    </div>
    <div class="version">Version 1.0 | เมษายน 2569</div>
  </div>
</div>

<!-- PAGE 2: TOC -->
<div class="page">
  <h1>สารบัญ</h1>
  <div class="toc" style="margin-top:12px;">
    <a><b>1.</b> ภาพรวมระบบ</a>
    <a><b>2.</b> กลุ่ม 1: วางแผนและจัดลำดับการผลิต</a>
    <a class="sub">2.1 ภาพรวม (Dashboard)</a>
    <a class="sub">2.2 แผนผลิต (Production Board)</a>
    <a class="sub">2.3 ติดตามผลิต (Production Tracking)</a>
    <a><b>3.</b> กลุ่ม 2: รับและจัดการ Orders</a>
    <a class="sub">3.1 รายการสั่ง (Order Inbox)</a>
    <a><b>4.</b> กลุ่ม 3: วัตถุดิบ BOM และคลัง</a>
    <a class="sub">4.1 BOM Explorer</a>
    <a class="sub">4.2 คลังวัตถุดิบ (Inventory)</a>
    <a class="sub">4.3 คลัง FG (Finished Goods)</a>
    <a class="sub">4.4 MRP (Material Requirements Planning)</a>
    <a><b>5.</b> กลุ่ม 4: Compliance + Master Data</a>
    <a class="sub">5.1 BOI Dashboard</a>
    <a class="sub">5.2 ข้อมูลหลัก (Master Data)</a>
    <a class="sub">5.3 รายงาน (Reports)</a>
    <a><b>6.</b> ขั้นตอนการทำงานรายวัน (Daily Workflow)</a>
  </div>
</div>

<!-- PAGE 3: OVERVIEW -->
<div class="page">
  <h1>1. ภาพรวมระบบ</h1>
  <p>Big Kitchen Production Planner คือระบบ ERP สำหรับวางแผนการผลิตของโรงงาน Big Kitchen (ปลาเส้น/สปูอัด) ทดแทนการเขียนแผนผลิตด้วยมือ รองรับ BOI compliance</p>

  <table>
    <tr><th style="width:120px;">รายการ</th><th>รายละเอียด</th></tr>
    <tr><td><b>โรงงาน</b></td><td>Big 2 (8 สายผลิต, 176 batch/วัน) + Big 1 (4 สาย, 88 batch/วัน)</td></tr>
    <tr><td><b>กำลังผลิต</b></td><td>1 batch = 75 kg | 1 สาย = 22 batch/24hr = 1.65 ตัน/วัน</td></tr>
    <tr><td><b>สินค้า</b></td><td>123 FG codes | 127 สูตรอาหาร | 475 SKUs</td></tr>
    <tr><td><b>วัตถุดิบ</b></td><td>148 R-codes | 287 วัสดุบรรจุภัณฑ์</td></tr>
    <tr><td><b>ลูกค้า</b></td><td>24 ราย (TU, 7-11, แมคโคร, มาลินี, สี่หมวย ฯลฯ)</td></tr>
    <tr><td><b>BOI</b></td><td>BOI4 / BOI5 / NON-BOI | 1,544 ตัน/ปี/ลาย</td></tr>
  </table>

  <h3>เมนูทั้งหมด 11 เมนู</h3>
  <table>
    <tr><th>#</th><th>เมนู</th><th>URL</th><th>หน้าที่</th></tr>
    <tr><td>1</td><td>ภาพรวม</td><td>/dashboard</td><td>KPIs + กราฟกำลังผลิต + รายการเร่งด่วน</td></tr>
    <tr><td>2</td><td>แผนผลิต</td><td>/board</td><td>Drag-and-Drop + มุมมองสาย/วัน</td></tr>
    <tr><td>3</td><td>ติดตามผลิต</td><td>/tracking</td><td>เริ่ม/เสร็จ + Lot + บันทึกผลผลิต</td></tr>
    <tr><td>4</td><td>รายการสั่ง</td><td>/inbox</td><td>Orders + filter/sort + เพิ่ม/import CSV</td></tr>
    <tr><td>5</td><td>BOM</td><td>/bom</td><td>สูตรอาหาร + บรรจุภัณฑ์ 127 สูตร</td></tr>
    <tr><td>6</td><td>BOI</td><td>/boi</td><td>12 BOI lines + MCPD tracker</td></tr>
    <tr><td>7</td><td>คลังวัตถุดิบ</td><td>/inventory</td><td>148 R-codes + รับ-จ่าย-ปรับยอด</td></tr>
    <tr><td>8</td><td>คลัง FG</td><td>/fg-inventory</td><td>สินค้าสำเร็จรูป + Lot + จัดส่ง</td></tr>
    <tr><td>9</td><td>MRP</td><td>/mrp</td><td>คำนวณวัตถุดิบ + ใบสั่งซื้อ</td></tr>
    <tr><td>10</td><td>ข้อมูลหลัก</td><td>/master</td><td>CRUD สินค้า/ลูกค้า/วัตถุดิบ/วัสดุ</td></tr>
    <tr><td>11</td><td>รายงาน</td><td>/reports</td><td>พิมพ์แผนผลิตประจำวัน A4</td></tr>
  </table>
</div>

<!-- PAGE 4-5: GROUP 1 -->
<div class="page">
  <h1>2. กลุ่ม 1: วางแผนและจัดลำดับการผลิต</h1>

  <h2>2.1 ภาพรวม (Dashboard) <span class="url-tag">/dashboard</span></h2>
  <p>หน้าแรกของระบบ รวมตัวเลข KPI สำคัญทั้งหมดไว้ในหน้าเดียว เปิดดูทุกเช้าเพื่อวางแผนวัน</p>
  <div class="feature-box">
    <h3>เห็นอะไร</h3>
    <ul>
      <li>Batch วันนี้ + สัปดาห์นี้ (จำนวน batch, น้ำหนัก ตัน, % capacity)</li>
      <li>Orders รอจัดแผน + MCPD ค้าง</li>
      <li>กราฟกำลังผลิต Big 2 (น้ำเงิน) + Big 1 (เขียว) ทุกวันในสัปดาห์</li>
      <li>รายการเร่งด่วน (priority สูง หรือ deadline ใกล้)</li>
      <li>สินค้ายอดผลิตสัปดาห์นี้ + สถานะโรงงาน + สัดส่วน BOI</li>
    </ul>
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li>เปิดทุกเช้า เห็นภาพรวมวันนี้ทันที</li>
      <li>ดูกราฟกำลังผลิต ว่าวันไหนเต็ม วันไหนว่าง</li>
      <li>เช็ครายการเร่งด่วน ถ้ามี กด "ไปแผนผลิต" เพื่อจัดลำดับ</li>
      <li>ดูสัดส่วน BOI ว่า BOI4/BOI5/NON กี่ %</li>
    </ol>
  </div>

  <h2>2.2 แผนผลิต (Production Board) <span class="url-tag">/board</span></h2>
  <p>หัวใจของระบบ มี 2 มุมมอง: <b>มุมมองสาย</b> (Gantt Grid) และ <b>มุมมองวัน</b> (Kanban)</p>
  <div class="feature-box">
    <h3>เห็นอะไร</h3>
    <ul>
      <li><b>มุมมองสาย:</b> Grid 8 สาย × 7 วัน (Big 2) หรือ 4 สาย × 7 วัน (Big 1)</li>
      <li>แต่ละ slot = 1 สาย × 1 วัน รับได้ 22 batch</li>
      <li>แถว "ไม่จัดสาย" = orders ที่ยังไม่ assign เครื่อง</li>
      <li><b>มุมมองวัน:</b> 7 คอลัมน์วัน (จ.-อา.) แบบ Kanban</li>
      <li>Capacity Bar ต่อวัน: <span class="badge badge-green">เขียว &lt;70%</span> <span class="badge badge-amber">เหลือง 70-90%</span> <span class="badge badge-red">แดง &gt;100%</span></li>
    </ul>
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li>เลือกโรงงาน: Big 2 (8 สาย) หรือ Big 1 (4 สาย)</li>
      <li>สลับมุมมอง: กด "มุมมองสาย" หรือ "มุมมองวัน"</li>
      <li>เลื่อนสัปดาห์: กดปุ่ม &lt; &gt; หรือ "สัปดาห์นี้"</li>
      <li><b>ลาก order จาก "ไม่จัดสาย" วางลง slot สายที่ต้องการ</b></li>
      <li>ย้ายข้ามสาย/วัน ด้วยการลาก</li>
      <li>คลิกการ์ด → เปิดดู BOM (สูตรอาหาร + บรรจุภัณฑ์)</li>
      <li>กด "เริ่มผลิต" เมื่อเริ่มรันเครื่อง</li>
      <li>กด "เสร็จแล้ว" → เปิดฟอร์มบันทึกผลผลิต</li>
    </ol>
  </div>
</div>

<!-- PAGE 6: TRACKING -->
<div class="page">
  <h2>2.3 ติดตามผลิต (Production Tracking) <span class="url-tag">/tracking</span></h2>
  <p>หน้าจอสำหรับคุมการผลิตจริง แสดงสถานะทุก order ของวันที่เลือก พร้อมบันทึกผลผลิต</p>
  <div class="feature-box">
    <h3>เห็นอะไร</h3>
    <ul>
      <li>สรุป: แผนวันนี้ / กำลังผลิต / เสร็จแล้ว / ประสิทธิภาพ %</li>
      <li>ตารางแผนผลิต: สาย, FG Code, Batch แผน/จริง, ลูกค้า, เวลาเริ่ม/จบ, Lot, สถานะ</li>
      <li>สถานะ: <span class="badge" style="background:#e2e8f0;">รอผลิต</span> <span class="badge badge-blue">กำลังผลิต</span> <span class="badge badge-green">เสร็จสิ้น</span></li>
    </ul>
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li>เลือกวัน + โรงงาน</li>
      <li>กด <b>"เริ่มผลิต"</b> เมื่อเริ่มรันเครื่อง → บันทึกเวลาเริ่ม</li>
      <li>กด <b>"เสร็จแล้ว"</b> → เปิด Production Output Dialog</li>
      <li>กรอก <b>น้ำหนักจริง (kg)</b></li>
      <li>เลือก <b>SKU</b> → ระบบ auto-fill ขนาดแพค + จำนวนต่อกล่อง</li>
      <li>ระบบคำนวณ: <b>จำนวนซอง, จำนวนกล่อง, เศษ, Yield%</b></li>
      <li>เลือก QC: ผ่าน / ไม่ผ่าน / รอตรวจ / พักไว้</li>
      <li>Submit → สร้าง Lot Number + เข้าคลัง FG อัตโนมัติ</li>
    </ol>
  </div>

  <h1>3. กลุ่ม 2: รับและจัดการ Orders</h1>
  <h2>3.1 รายการสั่ง (Order Inbox) <span class="url-tag">/inbox</span></h2>
  <p>ตาราง orders ทั้งหมด พร้อมระบบ filter, sort, pagination และ actions</p>
  <div class="feature-box">
    <h3>เห็นอะไร</h3>
    <ul>
      <li>ตาราง: วันสั่ง, FG Code, สินค้า, Batch, ลูกค้า, กำหนดส่ง, BOI, Priority, MCPD, สถานะ</li>
      <li>สี BOI: <span class="badge badge-green">BOI4</span> <span class="badge badge-purple">BOI5</span> <span class="badge badge-amber">NON</span></li>
      <li>Priority: <span class="badge badge-red">P1 ส่งออก</span> <span class="badge badge-amber">P2 Stock ต่ำ</span> <span class="badge" style="background:#fed7aa;color:#c2410c;">P3 ยี่ปั๊ว</span> <span class="badge badge-green">P4 ปกติ</span></li>
    </ul>
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li><b>เพิ่ม Order ด่วน:</b> กด "+ เพิ่ม Order" → เลือก FG, batch, ลูกค้า, วันส่ง</li>
      <li><b>นำเข้า CSV:</b> กด "นำเข้า CSV" → อัพโหลด → preview → ยืนยัน</li>
      <li><b>Filter:</b> สถานะ / Priority / BOI / ค้นหา FG code หรือลูกค้า</li>
      <li><b>จัดแผน:</b> กด "จัดแผน" → สถานะเปลี่ยนเป็น planned → ไปจัดลง board</li>
      <li><b>ยกเลิก:</b> กด "ยกเลิก" พร้อมยืนยัน</li>
    </ol>
  </div>
</div>

<!-- PAGE 7-8: GROUP 3 -->
<div class="page">
  <h1>4. กลุ่ม 3: วัตถุดิบ BOM และคลัง</h1>

  <h2>4.1 BOM Explorer <span class="url-tag">/bom</span></h2>
  <p>ค้นหาสูตรอาหาร + บรรจุภัณฑ์ของสินค้าทุกตัว (56 สินค้าที่มีสูตร, 148 วัตถุดิบ, 475 SKUs)</p>
  <div class="feature-box">
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li>พิมพ์ FG code หรือชื่อสินค้าในช่องค้นหา</li>
      <li>เลือกสินค้า → เห็น <b>สูตรอาหาร</b> (R-codes + น้ำหนัก/batch + Yield%)</li>
      <li>เลื่อนลง → เห็น <b>บรรจุภัณฑ์</b> (SKU + วัสดุ + ratio avg/min/max)</li>
    </ol>
  </div>

  <h2>4.2 คลังวัตถุดิบ (Inventory) <span class="url-tag">/inventory</span></h2>
  <p>Stock วัตถุดิบ 148 R-codes พร้อมระบบรับ-จ่าย-ปรับยอด</p>
  <div class="feature-box">
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li><b>รับเข้า:</b> กด "รับเข้า" → เลือกวัตถุดิบ + จำนวน kg + เลขอ้างอิง</li>
      <li><b>เบิกจ่าย:</b> กด "เบิกจ่าย" → เลือกวัตถุดิบ + จำนวนที่เบิก</li>
      <li><b>ปรับยอด:</b> กด "ปรับยอด" → ใส่ยอดจริง → ระบบคำนวณผลต่าง</li>
      <li>ค้นหา R-code / filter หมวดหมู่ / สถานะ (ปกติ/ต่ำ/ติดลบ)</li>
    </ol>
  </div>

  <h2>4.3 คลัง FG — สินค้าสำเร็จรูป <span class="url-tag">/fg-inventory</span></h2>
  <p>Stock สินค้าที่ผลิตเสร็จแล้ว เข้าคลังอัตโนมัติเมื่อบันทึกผลผลิต</p>
  <div class="feature-box">
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li>สินค้าเข้าคลังอัตโนมัติเมื่อบันทึกผลผลิต (จากหน้า Tracking)</li>
      <li>คลิกสินค้า → ขยายดู lot detail (Lot Number, วันผลิต, QC status)</li>
      <li>กด "จอง" เพื่อ reserve สำหรับลูกค้า</li>
      <li>กด "จัดส่ง" เมื่อส่งของแล้ว</li>
    </ol>
  </div>

  <h2>4.4 MRP — วางแผนวัตถุดิบ <span class="url-tag">/mrp</span></h2>
  <p>คำนวณวัตถุดิบทั้งหมดที่ต้องใช้ในสัปดาห์ เทียบกับ stock → บอกว่าต้องซื้อเพิ่มอะไร</p>
  <div class="feature-box">
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li>เลือกสัปดาห์ + โรงงาน (ทั้งหมด / Big 2 / Big 1)</li>
      <li>ดูตาราง "ความต้องการวัตถุดิบ" เรียงจากมากไปน้อย</li>
      <li>ดูสถานะ: <span class="badge badge-green">พอ</span> / <span class="badge badge-red">ต้องสั่ง</span></li>
      <li>กด "พิมพ์ใบสั่งซื้อ" → พิมพ์เฉพาะรายการที่ต้องซื้อ</li>
    </ol>
  </div>
</div>

<!-- PAGE 9: GROUP 4 -->
<div class="page">
  <h1>5. กลุ่ม 4: Compliance + Master Data</h1>

  <h2>5.1 BOI Dashboard <span class="url-tag">/boi</span></h2>
  <p>ติดตามโควตา BOI 12 สาย + MCPD Tracker + Allocation (สวมตัวเลข)</p>
  <div class="feature-box">
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li>ดู meter แต่ละลาย: ตันที่ใช้ / 1,544 ตัน/ปี — ถ้าเกิน 80% = เหลือง, 95% = แดง</li>
      <li>ดู MCPD tracker → orders ที่ deadline ใกล้จะเป็นสีแดง</li>
      <li>Allocation: เลือกลายที่จะสวม → dropdown เลือก BOI line</li>
    </ol>
  </div>

  <h2>5.2 ข้อมูลหลัก (Master Data) <span class="url-tag">/master</span></h2>
  <p>CRUD จัดการข้อมูลหลัก 4 แท็บ: สินค้า (123), ลูกค้า (24), วัตถุดิบ (148), วัสดุบรรจุภัณฑ์ (287)</p>
  <div class="feature-box">
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li>เลือกแท็บ → ค้นหา → กดแก้ไข/ลบ</li>
      <li>กด "+ เพิ่ม" → กรอกฟอร์ม → บันทึก</li>
      <li>Pagination: 20 รายการต่อหน้า</li>
    </ol>
  </div>

  <h2>5.3 รายงาน (Reports) <span class="url-tag">/reports</span></h2>
  <p>พิมพ์แผนผลิตประจำวัน เป็นตาราง A4 landscape</p>
  <div class="feature-box">
    <h3>ขั้นตอนการใช้งาน</h3>
    <ol class="step-list">
      <li>เลือกวัน + โรงงาน</li>
      <li>ดู preview: FG Code, batch, น้ำหนัก, ลูกค้า, BOI, MCPD</li>
      <li>กด "พิมพ์" → A4 landscape</li>
    </ol>
  </div>
</div>

<!-- PAGE 10: DAILY WORKFLOW -->
<div class="page">
  <h1>6. ขั้นตอนการทำงานรายวัน (Daily Workflow)</h1>

  <div class="workflow-section">
    <div class="wf-header wf-blue">เช้า (07:00)</div>
    <div class="wf-body">
      <ul>
        <li>เปิด <b>"ภาพรวม"</b> → ดูว่าวันนี้ต้องผลิตอะไร มีอะไรเร่งด่วน</li>
        <li>ไป <b>"แผนผลิต"</b> → ลาก order ลงสายการผลิตที่ว่าง</li>
        <li>เช็ค <b>"MRP"</b> → วัตถุดิบพร้อมหรือไม่</li>
        <li>พิมพ์ <b>"รายงาน"</b> → แจกหน้าเครื่อง</li>
      </ul>
    </div>
  </div>

  <div class="workflow-section">
    <div class="wf-header wf-green">ระหว่างวัน (08:00 - 17:00)</div>
    <div class="wf-body">
      <ul>
        <li>เปิด <b>"ติดตามผลิต"</b> → กด "เริ่มผลิต" ทีละสาย</li>
        <li>เครื่องเสร็จ → กด <b>"เสร็จแล้ว"</b> → กรอกน้ำหนัก/กล่อง → เข้าคลัง</li>
        <li>ถ้ามี order ใหม่ → ไป <b>"รายการสั่ง"</b> → เพิ่ม order + จัดลงแผน</li>
        <li>เช็ค <b>"คลังวัตถุดิบ"</b> → ถ้าต้องเบิกจ่าย</li>
      </ul>
    </div>
  </div>

  <div class="workflow-section">
    <div class="wf-header wf-purple">เย็น (17:00)</div>
    <div class="wf-body">
      <ul>
        <li>ดู <b>"ภาพรวม"</b> → เช็ค Yield% + orders ที่เหลือ</li>
        <li>ดู <b>"คลัง FG"</b> → เช็คสินค้าที่ผลิตเสร็จวันนี้</li>
        <li>ดู <b>"MRP"</b> → เช็ควัตถุดิบสำหรับพรุ่งนี้</li>
        <li>วางแผนพรุ่งนี้ใน <b>"แผนผลิต"</b></li>
      </ul>
    </div>
  </div>

  <div class="flow-box">
    Order เข้า (Inbox) → จัดแผน (Board) → เริ่มผลิต (Tracking) → บันทึกผลผลิต (Output) → เข้าคลัง FG → จัดส่งลูกค้า
  </div>

  <hr style="margin:30px 0;border:1px solid #e2e8f0;">
  <p style="color:#94a3b8;font-size:9pt;">Big Kitchen Production Planner ERP v1.0 | สร้างโดย Claude Code | เมษายน 2569</p>
</div>

</body>
</html>"""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(HTML_CONTENT, wait_until="networkidle")

        # Wait for Google Font to load
        await page.wait_for_timeout(3000)

        output = "/Users/mintmacair15/Downloads/Big_Kitchen_ERP_Manual.pdf"
        await page.pdf(
            path=output,
            format="A4",
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
            print_background=True,
        )
        await browser.close()

        import os
        size = os.path.getsize(output)
        print(f"PDF created: {output}")
        print(f"Size: {size // 1024} KB")

asyncio.run(main())
