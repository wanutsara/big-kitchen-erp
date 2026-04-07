#!/usr/bin/env python3
"""Generate Big Kitchen ERP User Manual PDF in Thai"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# --- Thai Font Setup ---
# Try to find a Thai-supporting font
FONT_PATHS = [
    "/System/Library/Fonts/Supplemental/Thonburi.ttc",
    "/System/Library/Fonts/Thonburi.ttc",
    "/Library/Fonts/Thonburi.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
]

thai_font = "Helvetica"
thai_font_bold = "Helvetica-Bold"

for fp in FONT_PATHS:
    if os.path.exists(fp):
        try:
            pdfmetrics.registerFont(TTFont("Thai", fp, subfontIndex=0))
            pdfmetrics.registerFont(TTFont("Thai-Bold", fp, subfontIndex=1))
            thai_font = "Thai"
            thai_font_bold = "Thai-Bold"
            print(f"Using Thai font: {fp}")
            break
        except Exception:
            try:
                pdfmetrics.registerFont(TTFont("Thai", fp))
                thai_font = "Thai"
                thai_font_bold = "Thai"
                print(f"Using Thai font (no bold): {fp}")
                break
            except Exception:
                continue

# --- Colors ---
PRIMARY = HexColor("#1a1a2e")
ACCENT = HexColor("#16213e")
BLUE = HexColor("#0f3460")
GREEN = HexColor("#16a34a")
AMBER = HexColor("#d97706")
RED = HexColor("#dc2626")
PURPLE = HexColor("#7c3aed")
CYAN = HexColor("#0891b2")
LIGHT_BG = HexColor("#f8fafc")
LIGHT_BLUE = HexColor("#eff6ff")
LIGHT_GREEN = HexColor("#f0fdf4")
BORDER = HexColor("#e2e8f0")

# --- Styles ---
styles = {
    "title": ParagraphStyle("title", fontName=thai_font_bold, fontSize=28, textColor=PRIMARY, alignment=TA_CENTER, spaceAfter=6),
    "subtitle": ParagraphStyle("subtitle", fontName=thai_font, fontSize=14, textColor=HexColor("#64748b"), alignment=TA_CENTER, spaceAfter=20),
    "h1": ParagraphStyle("h1", fontName=thai_font_bold, fontSize=20, textColor=PRIMARY, spaceBefore=20, spaceAfter=10),
    "h2": ParagraphStyle("h2", fontName=thai_font_bold, fontSize=16, textColor=BLUE, spaceBefore=16, spaceAfter=8),
    "h3": ParagraphStyle("h3", fontName=thai_font_bold, fontSize=13, textColor=HexColor("#334155"), spaceBefore=12, spaceAfter=6),
    "body": ParagraphStyle("body", fontName=thai_font, fontSize=11, textColor=HexColor("#334155"), leading=18, spaceAfter=6),
    "bullet": ParagraphStyle("bullet", fontName=thai_font, fontSize=11, textColor=HexColor("#334155"), leading=18, leftIndent=20, spaceAfter=4),
    "step": ParagraphStyle("step", fontName=thai_font, fontSize=11, textColor=HexColor("#334155"), leading=18, leftIndent=24, spaceAfter=4),
    "small": ParagraphStyle("small", fontName=thai_font, fontSize=9, textColor=HexColor("#94a3b8"), leading=14),
    "tag": ParagraphStyle("tag", fontName=thai_font_bold, fontSize=10, textColor=white),
    "table_header": ParagraphStyle("th", fontName=thai_font_bold, fontSize=10, textColor=white, alignment=TA_CENTER),
    "table_cell": ParagraphStyle("td", fontName=thai_font, fontSize=10, textColor=HexColor("#334155"), leading=14),
    "table_cell_center": ParagraphStyle("tdc", fontName=thai_font, fontSize=10, textColor=HexColor("#334155"), leading=14, alignment=TA_CENTER),
}

def build_pdf():
    output_path = "/Users/mintmacair15/Downloads/Big_Kitchen_ERP_Manual.pdf"
    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )
    story = []
    W = A4[0] - 4*cm  # usable width

    # ============================================================
    # COVER PAGE
    # ============================================================
    story.append(Spacer(1, 60))
    story.append(Paragraph("Big Kitchen", styles["title"]))
    story.append(Paragraph("Production Planner ERP", styles["subtitle"]))
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="60%", thickness=2, color=BLUE, spaceAfter=20))
    story.append(Spacer(1, 10))
    story.append(Paragraph("คู่มือการใช้งานระบบ", ParagraphStyle("cover_sub", fontName=thai_font_bold, fontSize=22, textColor=PRIMARY, alignment=TA_CENTER, spaceAfter=10)))
    story.append(Paragraph("ระบบวางแผนการผลิตสำหรับโรงงาน Big Kitchen", ParagraphStyle("cover_desc", fontName=thai_font, fontSize=13, textColor=HexColor("#64748b"), alignment=TA_CENTER, spaceAfter=30)))

    # Feature summary box
    features = [
        ["11 เมนูหลัก", "123 สินค้า", "127 สูตรอาหาร"],
        ["24 ลูกค้า", "475 SKUs", "287 วัสดุบรรจุภัณฑ์"],
    ]
    feat_table = Table(features, colWidths=[W/3]*3, rowHeights=[30]*2)
    feat_table.setStyle(TableStyle([
        ("FONT", (0,0), (-1,-1), thai_font_bold, 12),
        ("TEXTCOLOR", (0,0), (-1,-1), BLUE),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("BOX", (0,0), (-1,-1), 1, BORDER),
        ("INNERGRID", (0,0), (-1,-1), 0.5, BORDER),
        ("BACKGROUND", (0,0), (-1,-1), LIGHT_BLUE),
        ("ROUNDEDCORNERS", [6,6,6,6]),
    ]))
    story.append(feat_table)
    story.append(Spacer(1, 40))
    story.append(Paragraph("Version 1.0  |  เมษายน 2569", styles["small"]))
    story.append(PageBreak())

    # ============================================================
    # TABLE OF CONTENTS
    # ============================================================
    story.append(Paragraph("สารบัญ", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))

    toc_items = [
        ("1", "ภาพรวมระบบ", "3"),
        ("2", "กลุ่ม 1: วางแผนและจัดลำดับการผลิต", "4"),
        ("", "   2.1  ภาพรวม (Dashboard)", "4"),
        ("", "   2.2  แผนผลิต (Production Board)", "5"),
        ("", "   2.3  ติดตามผลิต (Production Tracking)", "6"),
        ("3", "กลุ่ม 2: รับและจัดการ Orders", "7"),
        ("", "   3.1  รายการสั่ง (Order Inbox)", "7"),
        ("4", "กลุ่ม 3: วัตถุดิบ BOM และคลัง", "8"),
        ("", "   4.1  BOM Explorer", "8"),
        ("", "   4.2  คลังวัตถุดิบ (Inventory)", "9"),
        ("", "   4.3  คลัง FG (Finished Goods)", "10"),
        ("", "   4.4  MRP (Material Requirements Planning)", "11"),
        ("5", "กลุ่ม 4: Compliance + Master Data", "12"),
        ("", "   5.1  BOI Dashboard", "12"),
        ("", "   5.2  ข้อมูลหลัก (Master Data)", "13"),
        ("", "   5.3  รายงาน (Reports)", "13"),
        ("6", "ขั้นตอนการทำงานรายวัน (Daily Workflow)", "14"),
    ]
    for num, label, page in toc_items:
        if num:
            story.append(Paragraph(f"<b>{num}.</b>  {label}  {'.'*40}  {page}", styles["body"]))
        else:
            story.append(Paragraph(f"{label}  {'.'*40}  {page}", ParagraphStyle("toc_sub", fontName=thai_font, fontSize=10, textColor=HexColor("#64748b"), leading=16, spaceAfter=2)))

    story.append(PageBreak())

    # ============================================================
    # 1. OVERVIEW
    # ============================================================
    story.append(Paragraph("1. ภาพรวมระบบ", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
    story.append(Paragraph(
        "Big Kitchen Production Planner คือระบบ ERP สำหรับวางแผนการผลิตของโรงงาน Big Kitchen "
        "(ปลาเส้น/สปูอัด) ทดแทนการเขียนแผนผลิตด้วยมือ รองรับ BOI compliance",
        styles["body"]
    ))

    # System overview table
    overview_data = [
        [Paragraph("<b>รายการ</b>", styles["table_header"]), Paragraph("<b>รายละเอียด</b>", styles["table_header"])],
        [Paragraph("โรงงาน", styles["table_cell"]), Paragraph("Big 2 (8 สายผลิต, 176 batch/วัน) + Big 1 (4 สาย, 88 batch/วัน)", styles["table_cell"])],
        [Paragraph("กำลังผลิต", styles["table_cell"]), Paragraph("1 batch = 75 kg  |  1 สาย = 22 batch/24hr = 1.65 ตัน/วัน", styles["table_cell"])],
        [Paragraph("สินค้า", styles["table_cell"]), Paragraph("123 FG codes  |  127 สูตรอาหาร  |  475 SKUs", styles["table_cell"])],
        [Paragraph("วัตถุดิบ", styles["table_cell"]), Paragraph("148 R-codes  |  287 วัสดุบรรจุภัณฑ์", styles["table_cell"])],
        [Paragraph("ลูกค้า", styles["table_cell"]), Paragraph("24 ราย (TU, 7-11, แมคโคร, มาลินี, สี่หมวย ฯลฯ)", styles["table_cell"])],
        [Paragraph("BOI", styles["table_cell"]), Paragraph("BOI4 / BOI5 / NON-BOI  |  1,544 ตัน/ปี/ลาย", styles["table_cell"])],
        [Paragraph("Tech Stack", styles["table_cell"]), Paragraph("Next.js 16 + Supabase + Tailwind CSS + shadcn/ui", styles["table_cell"])],
    ]
    t = Table(overview_data, colWidths=[3.5*cm, W-3.5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), BLUE),
        ("TEXTCOLOR", (0,0), (-1,0), white),
        ("BACKGROUND", (0,1), (-1,-1), white),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, LIGHT_BG]),
        ("BOX", (0,0), (-1,-1), 1, BORDER),
        ("INNERGRID", (0,0), (-1,-1), 0.5, BORDER),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    # Menu overview
    story.append(Paragraph("เมนูทั้งหมด 11 เมนู", styles["h3"]))
    menu_data = [
        [Paragraph("<b>#</b>", styles["table_header"]),
         Paragraph("<b>เมนู</b>", styles["table_header"]),
         Paragraph("<b>URL</b>", styles["table_header"]),
         Paragraph("<b>หน้าที่</b>", styles["table_header"])],
        ["1", "ภาพรวม", "/dashboard", "KPIs + กราฟกำลังผลิต + รายการเร่งด่วน"],
        ["2", "แผนผลิต", "/board", "Drag-and-Drop + มุมมองสาย/วัน"],
        ["3", "ติดตามผลิต", "/tracking", "เริ่ม/เสร็จ + Lot + บันทึกผลผลิต"],
        ["4", "รายการสั่ง", "/inbox", "Orders + filter/sort + เพิ่ม/import"],
        ["5", "BOM", "/bom", "สูตรอาหาร + บรรจุภัณฑ์ 127 สูตร"],
        ["6", "BOI", "/boi", "12 BOI lines + MCPD tracker"],
        ["7", "คลังวัตถุดิบ", "/inventory", "148 R-codes + รับ-จ่าย-ปรับยอด"],
        ["8", "คลัง FG", "/fg-inventory", "สินค้าสำเร็จรูป + Lot + จัดส่ง"],
        ["9", "MRP", "/mrp", "คำนวณวัตถุดิบ + ใบสั่งซื้อ"],
        ["10", "ข้อมูลหลัก", "/master", "CRUD สินค้า/ลูกค้า/วัตถุดิบ/วัสดุ"],
        ["11", "รายงาน", "/reports", "พิมพ์แผนผลิตประจำวัน A4"],
    ]
    for i in range(1, len(menu_data)):
        menu_data[i] = [Paragraph(str(c), styles["table_cell_center"] if j < 3 else styles["table_cell"]) for j, c in enumerate(menu_data[i])]

    t = Table(menu_data, colWidths=[1*cm, 2.8*cm, 2.5*cm, W-6.3*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), BLUE),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, LIGHT_BG]),
        ("BOX", (0,0), (-1,-1), 1, BORDER),
        ("INNERGRID", (0,0), (-1,-1), 0.5, BORDER),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(t)
    story.append(PageBreak())

    # ============================================================
    # HELPER: Feature section
    # ============================================================
    def add_feature(title, url, description, what_you_see, how_to_use):
        story.append(Paragraph(title, styles["h2"]))
        story.append(Paragraph(f"URL: {url}", styles["small"]))
        story.append(Spacer(1, 4))
        story.append(Paragraph(description, styles["body"]))
        story.append(Spacer(1, 6))

        story.append(Paragraph("เห็นอะไร:", styles["h3"]))
        for item in what_you_see:
            story.append(Paragraph(f"  - {item}", styles["bullet"]))

        story.append(Spacer(1, 6))
        story.append(Paragraph("ขั้นตอนการใช้งาน:", styles["h3"]))
        for i, step in enumerate(how_to_use, 1):
            story.append(Paragraph(f"  {i}. {step}", styles["step"]))
        story.append(Spacer(1, 10))

    # ============================================================
    # 2. GROUP 1: Production Planning
    # ============================================================
    story.append(Paragraph("2. กลุ่ม 1: วางแผนและจัดลำดับการผลิต", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))

    add_feature(
        "2.1 ภาพรวม (Dashboard)", "/dashboard",
        "หน้าแรกของระบบ รวมตัวเลข KPI สำคัญทั้งหมดไว้ในหน้าเดียว เปิดดูทุกเช้าเพื่อวางแผนวัน",
        [
            "Batch วันนี้ + สัปดาห์นี้ (จำนวน batch, น้ำหนัก ตัน, % capacity)",
            "Orders รอจัดแผน + MCPD ค้าง",
            "กราฟกำลังผลิต Big 2 (น้ำเงิน) + Big 1 (เขียว) ทุกวันในสัปดาห์",
            "รายการเร่งด่วน (priority สูง หรือ deadline ใกล้)",
            "สินค้ายอดผลิตสัปดาห์นี้ + สถานะโรงงาน + สัดส่วน BOI",
        ],
        [
            "เปิดทุกเช้า เห็นภาพรวมวันนี้ทันที",
            "ดูกราฟกำลังผลิต ว่าวันไหนเต็ม วันไหนว่าง",
            "เช็ครายการเร่งด่วน ถ้ามี กด 'ไปแผนผลิต' เพื่อจัดลำดับ",
            "ดูสัดส่วน BOI ว่า BOI4/BOI5/NON กี่ %",
        ]
    )

    add_feature(
        "2.2 แผนผลิต (Production Board)", "/board",
        "หัวใจของระบบ มี 2 มุมมอง: มุมมองสาย (Gantt Grid) และมุมมองวัน (Kanban) ลาก-วาง order ได้",
        [
            "มุมมองสาย: Grid 8 สาย x 7 วัน (Big 2) หรือ 4 สาย x 7 วัน (Big 1)",
            "แต่ละ slot = 1 สาย x 1 วัน รับได้ 22 batch",
            "แถว 'ไม่จัดสาย' = orders ที่ยังไม่ assign เครื่อง",
            "มุมมองวัน: 7 คอลัมน์วัน (จ.-อา.) แบบ Kanban",
            "การ์ด order: FG code, batch, ลูกค้า, สี BOI, badges (MCPD, ด่วน)",
            "Capacity Bar ต่อวัน: เขียว (<70%), เหลือง (70-90%), ส้ม (90-100%), แดง (>100%)",
        ],
        [
            "เลือกโรงงาน: Big 2 (8 สาย) หรือ Big 1 (4 สาย)",
            "สลับมุมมอง: กด 'มุมมองสาย' หรือ 'มุมมองวัน'",
            "เลื่อนสัปดาห์: กดปุ่ม < > หรือ 'สัปดาห์นี้'",
            "ลาก order จาก 'ไม่จัดสาย' วางลง slot สายที่ต้องการ",
            "ย้ายข้ามสาย/วัน ด้วยการลาก",
            "คลิกการ์ด เปิดดู BOM (สูตรอาหาร + บรรจุภัณฑ์)",
            "กด 'เริ่มผลิต' เมื่อเริ่มรันเครื่อง",
            "กด 'เสร็จแล้ว' เปิดฟอร์มบันทึกผลผลิต",
        ]
    )
    story.append(PageBreak())

    add_feature(
        "2.3 ติดตามผลิต (Production Tracking)", "/tracking",
        "หน้าจอสำหรับคุมการผลิตจริง แสดงสถานะทุก order ของวันที่เลือก พร้อมบันทึกผลผลิต",
        [
            "สรุป: แผนวันนี้ / กำลังผลิต / เสร็จแล้ว / ประสิทธิภาพ %",
            "ตารางแผนผลิต: สาย, FG Code, Batch แผน/จริง, ลูกค้า, เวลาเริ่ม/จบ, Lot, สถานะ",
            "สถานะ: รอผลิต (เทา), กำลังผลิต (น้ำเงิน), เสร็จ (เขียว)",
            "น้ำหนักจริง, จำนวนกล่อง, Yield% ของแต่ละ order",
        ],
        [
            "เลือกวัน + โรงงาน",
            "กด 'เริ่มผลิต' เมื่อเริ่มรัน บันทึกเวลาเริ่ม",
            "กด 'เสร็จแล้ว' เปิด Production Output Dialog:",
            "   - กรอกน้ำหนักจริง (kg)",
            "   - เลือก SKU (ขนาดแพค + จำนวนต่อกล่อง auto-fill)",
            "   - ระบบคำนวณ: จำนวนซอง, จำนวนกล่อง, เศษ, Yield%",
            "   - เลือก QC: ผ่าน / ไม่ผ่าน / รอตรวจ / พักไว้",
            "Submit สร้าง Lot Number + เข้าคลังสินค้าสำเร็จรูปอัตโนมัติ",
        ]
    )

    # ============================================================
    # 3. GROUP 2: Orders
    # ============================================================
    story.append(Paragraph("3. กลุ่ม 2: รับและจัดการ Orders", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))

    add_feature(
        "3.1 รายการสั่ง (Order Inbox)", "/inbox",
        "ตาราง orders ทั้งหมด พร้อมระบบ filter, sort, pagination และ actions",
        [
            "ตาราง: วันสั่ง, FG Code, สินค้า, Batch, ลูกค้า, กำหนดส่ง, BOI, Priority, MCPD, สถานะ",
            "สี BOI: เขียว (BOI4), ชมพู (BOI5), ส้ม (NON)",
            "Priority: แดง (P1 ส่งออก), เหลือง (P2 Stock ต่ำ), ส้ม (P3 ยี่ปั๊ว), เขียว (P4 ปกติ)",
            "สรุปล่าง: จำนวน order, Pending/Planned/Producing/Done, batch + น้ำหนักรวม",
        ],
        [
            "เพิ่ม Order ด่วน: กด '+ เพิ่ม Order' เลือก FG, batch, ลูกค้า, วันส่ง",
            "นำเข้า CSV จาก MINT: กด 'นำเข้า CSV' อัพโหลด preview ยืนยัน",
            "Filter: สถานะ / Priority / BOI / ค้นหา FG code, ลูกค้า",
            "จัดแผน: กด 'จัดแผน' ที่ order สถานะเปลี่ยนเป็น planned",
            "ยกเลิก: กด 'ยกเลิก' พร้อมยืนยัน",
        ]
    )
    story.append(PageBreak())

    # ============================================================
    # 4. GROUP 3: BOM + Inventory
    # ============================================================
    story.append(Paragraph("4. กลุ่ม 3: วัตถุดิบ BOM และคลัง", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))

    add_feature(
        "4.1 BOM Explorer", "/bom",
        "ค้นหาสูตรอาหาร + บรรจุภัณฑ์ของสินค้าทุกตัว (56 สินค้าที่มีสูตร, 148 วัตถุดิบ, 475 SKUs)",
        [
            "Cards สรุป: จำนวนสินค้าที่มีสูตร, วัตถุดิบทั้งหมด, SKU ทั้งหมด",
            "สูตรอาหาร: ตาราง R-code + น้ำหนัก/batch + สัดส่วน% + Yield%",
            "บรรจุภัณฑ์: SKU list + วัสดุ + ratio avg/min/max + confidence",
        ],
        [
            "พิมพ์ FG code หรือชื่อสินค้าในช่องค้นหา",
            "เลือกสินค้า เห็นสูตรอาหาร (R-codes + น้ำหนัก + Yield%)",
            "เลื่อนลง เห็นบรรจุภัณฑ์ (SKU + วัสดุ + ratio)",
        ]
    )

    add_feature(
        "4.2 คลังวัตถุดิบ (Inventory)", "/inventory",
        "Stock วัตถุดิบ 148 R-codes พร้อมระบบรับ-จ่าย-ปรับยอด (ข้อมูลเริ่มต้นจาก Marketing App)",
        [
            "สรุป: จำนวนรายการ, stock ปกติ (เขียว), ต่ำ (เหลือง), ติดลบ (แดง)",
            "ตาราง: R-code, ชื่อ, หมวดหมู่, คงเหลือ (kg), สถานะ",
            "ประวัติ: 20 transactions ล่าสุด",
        ],
        [
            "รับเข้า: กด 'รับเข้า' เลือกวัตถุดิบ + จำนวน kg + เลขอ้างอิง",
            "เบิกจ่าย: กด 'เบิกจ่าย' เลือกวัตถุดิบ + จำนวนที่เบิก",
            "ปรับยอด: กด 'ปรับยอด' ใส่ยอดจริง ระบบคำนวณผลต่าง",
            "ค้นหา R-code หรือชื่อ / filter ตามหมวดหมู่ / สถานะ",
        ]
    )
    story.append(PageBreak())

    add_feature(
        "4.3 คลัง FG - สินค้าสำเร็จรูป (Finished Goods)", "/fg-inventory",
        "Stock สินค้าที่ผลิตเสร็จแล้ว เข้าคลังอัตโนมัติเมื่อบันทึกผลผลิต",
        [
            "สรุป: รายการสินค้า (FG codes), กล่องรวม, น้ำหนักรวม (ตัน), Lot ทั้งหมด",
            "ตาราง: FG Code, ชื่อ, หมวดหมู่, กล่อง, ซองเศษ, น้ำหนัก, จำนวน Lot",
            "Lot detail (ขยายได้): Lot Number, วันผลิต, SKU, QC status, ที่เก็บ",
        ],
        [
            "สินค้าเข้าคลังอัตโนมัติเมื่อบันทึกผลผลิต (จากหน้า Tracking)",
            "คลิกสินค้า ขยายดู lot detail",
            "กด 'จอง' เพื่อ reserve สำหรับลูกค้า",
            "กด 'จัดส่ง' เมื่อส่งของแล้ว",
        ]
    )

    add_feature(
        "4.4 MRP - วางแผนวัตถุดิบ", "/mrp",
        "คำนวณวัตถุดิบทั้งหมดที่ต้องใช้ในสัปดาห์ เทียบกับ stock บอกว่าต้องซื้อเพิ่มอะไร",
        [
            "สรุป: วัตถุดิบที่ต้องใช้ (X รายการ), น้ำหนักรวม (X ตัน), ต้องจัดซื้อ, พร้อมผลิต%",
            "ตาราง Gross Requirements: R-code, ชื่อ, หมวดหมู่, ต้องใช้ (kg), จำนวน batch",
            "ตาราง Net Requirements (ถ้ามี stock): คงเหลือ, ต้องซื้อ, สถานะ (พอ/ต้องสั่ง)",
            "Purchase Suggestion: เฉพาะรายการที่ต้องซื้อ เรียงจากเร่งด่วนสุด",
        ],
        [
            "เลือกสัปดาห์ + โรงงาน (ทั้งหมด / Big 2 / Big 1)",
            "ดูตาราง 'ความต้องการวัตถุดิบ' เรียงจากมากไปน้อย",
            "ดูสถานะ: 'พอ' (เขียว) / 'ต้องสั่ง' (แดง)",
            "กด 'พิมพ์ใบสั่งซื้อ' พิมพ์เฉพาะรายการที่ต้องซื้อ",
        ]
    )
    story.append(PageBreak())

    # ============================================================
    # 5. GROUP 4: Compliance + Master Data
    # ============================================================
    story.append(Paragraph("5. กลุ่ม 4: Compliance + Master Data", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))

    add_feature(
        "5.1 BOI Dashboard", "/boi",
        "ติดตามโควตา BOI 12 สาย + MCPD Tracker + Allocation (สวมตัวเลข)",
        [
            "Meter แต่ละลาย: ตันที่ใช้ / 1,544 ตัน/ปี (เขียว/เหลือง/แดง)",
            "MCPD Tracker: orders ที่ต้องทำ MCPD + สถานะ + deadline",
            "Allocation Table: จัดสรร lot เข้าลาย BOI",
        ],
        [
            "ดู meter ถ้าเกิน 80% = เหลือง, เกิน 95% = แดง",
            "ดู MCPD tracker orders ที่ deadline ใกล้จะเป็นสีแดง",
            "เลือกลายที่จะสวม dropdown เลือก BOI line",
        ]
    )

    add_feature(
        "5.2 ข้อมูลหลัก (Master Data)", "/master",
        "CRUD จัดการข้อมูลหลัก 4 แท็บ: สินค้า (123), ลูกค้า (24), วัตถุดิบ (148), วัสดุบรรจุภัณฑ์ (287)",
        [
            "สินค้า: FG Code, ชื่อ, หมวดหมู่, รส, Batch Type, Default Batch KG",
            "ลูกค้า: ชื่อ, ตลาด (domestic/export/duty_free), ช่องทาง",
            "วัตถุดิบ: R-code, ชื่อ, หมวดหมู่, หน่วย",
            "วัสดุ: รหัส, ชื่อ, ประเภท (film/box/bag), BOI category",
        ],
        [
            "เลือกแท็บ ค้นหา กดแก้ไข/ลบ",
            "กด '+ เพิ่ม' กรอกฟอร์ม บันทึก",
            "Pagination: 20 รายการต่อหน้า",
        ]
    )

    add_feature(
        "5.3 รายงาน (Reports)", "/reports",
        "พิมพ์แผนผลิตประจำวัน เป็นตาราง A4 landscape",
        [
            "ตาราง: FG Code, สินค้า, batch, น้ำหนัก, ลูกค้า, BOI, MCPD, หมายเหตุ",
            "สรุป: Batch รวม / capacity, กำลังผลิต%, น้ำหนักรวม kg/ตัน",
        ],
        [
            "เลือกวัน + โรงงาน",
            "ดู preview",
            "กด 'พิมพ์' A4 landscape",
        ]
    )
    story.append(PageBreak())

    # ============================================================
    # 6. DAILY WORKFLOW
    # ============================================================
    story.append(Paragraph("6. ขั้นตอนการทำงานรายวัน (Daily Workflow)", styles["h1"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))

    workflow = [
        ("เช้า (07:00)", BLUE, [
            "เปิด 'ภาพรวม' ดูว่าวันนี้ต้องผลิตอะไร มีอะไรเร่งด่วน",
            "ไป 'แผนผลิต' ลาก order ลงสายการผลิตที่ว่าง",
            "เช็ค 'MRP' ว่าวัตถุดิบพร้อมหรือไม่",
            "พิมพ์ 'รายงาน' แจกหน้าเครื่อง",
        ]),
        ("ระหว่างวัน (08:00-17:00)", GREEN, [
            "เปิด 'ติดตามผลิต' กด 'เริ่มผลิต' ทีละสาย",
            "เครื่องเสร็จ กด 'เสร็จแล้ว' กรอกน้ำหนัก/กล่อง เข้าคลัง",
            "ถ้ามี order ใหม่ ไป 'รายการสั่ง' เพิ่ม order + จัดลงแผน",
            "เช็ค 'คลังวัตถุดิบ' ถ้าต้องเบิกจ่าย",
        ]),
        ("เย็น (17:00)", PURPLE, [
            "ดู 'ภาพรวม' เช็ค Yield% + orders ที่เหลือ",
            "ดู 'คลัง FG' เช็คสินค้าที่ผลิตเสร็จวันนี้",
            "ดู 'MRP' เช็ควัตถุดิบสำหรับพรุ่งนี้",
            "วางแผนพรุ่งนี้ใน 'แผนผลิต'",
        ]),
    ]

    for title, color, steps in workflow:
        # Title bar
        title_data = [[Paragraph(f"<b>{title}</b>", ParagraphStyle("wf_title", fontName=thai_font_bold, fontSize=12, textColor=white))]]
        tt = Table(title_data, colWidths=[W])
        tt.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), color),
            ("TOPPADDING", (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("LEFTPADDING", (0,0), (-1,-1), 12),
        ]))
        story.append(tt)

        for step in steps:
            story.append(Paragraph(f"  - {step}", styles["bullet"]))
        story.append(Spacer(1, 10))

    # Flow diagram (text version)
    story.append(Spacer(1, 10))
    story.append(Paragraph("Production Flow:", styles["h3"]))
    flow_text = (
        "Order เข้า (Inbox)  -->  จัดแผน (Board)  -->  เริ่มผลิต (Tracking)  -->  "
        "บันทึกผลผลิต (Output)  -->  เข้าคลัง FG  -->  จัดส่งลูกค้า"
    )
    flow_data = [[Paragraph(flow_text, ParagraphStyle("flow", fontName=thai_font, fontSize=10, textColor=BLUE, alignment=TA_CENTER))]]
    ft = Table(flow_data, colWidths=[W])
    ft.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), LIGHT_BLUE),
        ("BOX", (0,0), (-1,-1), 1, BLUE),
        ("TOPPADDING", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
        ("LEFTPADDING", (0,0), (-1,-1), 12),
    ]))
    story.append(ft)

    story.append(Spacer(1, 30))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
    story.append(Paragraph("Big Kitchen Production Planner ERP v1.0", styles["small"]))
    story.append(Paragraph("สร้างโดย Claude Code  |  เมษายน 2569", styles["small"]))

    # Build
    doc.build(story)
    print(f"\nPDF created: {output_path}")
    print(f"File size: {os.path.getsize(output_path) // 1024} KB")
    return output_path

if __name__ == "__main__":
    build_pdf()
