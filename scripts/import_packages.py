#!/usr/bin/env python3
"""
Parse packaging/material data from CSV files and generate SQL for Supabase import.

Input files:
  - สูตรสินค้า - packages.csv   : material codes + Thai descriptions (rows 4+)
  - สูตรสินค้า - productList.csv : SKU codes with column mapping

Output:
  - supabase/import_packages.sql : INSERT statements for materials and skus tables
"""

import csv
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
CSV_DIR = Path("/Users/mintmacair15/Downloads")
PACKAGES_CSV = CSV_DIR / "สูตรสินค้า - packages.csv"
PRODUCT_LIST_CSV = CSV_DIR / "สูตรสินค้า - productList.csv"
OUTPUT_SQL = BASE_DIR / "supabase" / "import_packages.sql"

# Material type mapping from code prefix
# Prefixes are checked in order of longest-first to avoid partial matches
MATERIAL_TYPE_MAP = [
    ("CRPC", "box"),      # กล่อง (box for crispy pouch)
    ("CRP", "pouch"),     # ซอง crispy pouch (retort pouch)
    ("CSP", "pouch"),     # ซอง surimi pouch
    ("CPC", "box"),       # กล่อง (box for CP products)
    ("CB", "bag"),        # ถุง (bag)
    ("CP", "bag"),        # ถุง (bag)
    ("FBP", "film_bag"),  # ถุงบรรจุ (film bag printed)
    ("FB", "film_bag"),   # ซอง/ถุง film bag
    ("FPB", "bag"),       # ถุงร้อน barcode bag
    ("FPC", "box"),       # กล่อง (box)
    ("FPL", "label"),     # ฉลาก (label)
    ("FPP", "film"),      # ซอง (film pouch printed)
    ("FPZ", "film"),      # ซองซิปล๊อค (ziplock film)
    ("FP", "film"),       # ซอง/ฟิล์ม (film)
    ("FSL", "sticker"),   # สติ๊กเกอร์ (sticker)
    ("FSP", "film"),      # ซองไส้กรอก (sausage film)
    ("FT", "tray"),       # ถาด (tray)
    ("SFP", "film"),      # ซองปลาเส้นชุปน้ำจิ้ม (dipped fish film)
    ("SFPC", "box"),      # กล่องปลาเส้นชุปน้ำจิ้ม (dipped fish box)
    ("SKPC", "box"),      # กล่อง skin pack
    ("SPC", "box"),       # กล่องปลาแผ่นบด (minced fish box)
    ("SP", "film"),       # ซองปลาแผ่นบด (minced fish film)
    ("SRPC", "box"),      # กล่องหมึกวง (squid ring box)
    ("SRP", "bag"),       # ซองหมึกวง (squid ring bag)
    ("SSPB", "bag"),      # ถุงรวมใส (clear bag)
    ("SSPC", "box"),      # กล่องปลาแผ่นทรงเครื่อง (seasoned squid box)
    ("SSP", "film"),      # ซองปลาแผ่นทรงเครื่อง (seasoned squid film)
    ("STP", "tray"),      # ถาดบรรจุปลาแผ่นบด (tray)
    ("DP", "box"),        # กล่อง (box)
    ("LP", "label"),      # ฉลาก (label)
    ("BP", "box"),        # กล่อง (box)
    ("OXYGEN", "other"),  # สารดูดซับออกซิเจน
    ("PCO", "other"),     # พลาสติกใส CPP
    ("SB", "bag"),        # ถุงร้อน (hot bag)
]


def classify_material_type(code: str) -> str:
    """Determine material type from the code prefix."""
    code_upper = code.upper()
    for prefix, mat_type in MATERIAL_TYPE_MAP:
        if code_upper.startswith(prefix):
            return mat_type
    return "other"


def escape_sql(s: str) -> str:
    """Escape single quotes for SQL string literals."""
    if s is None:
        return ""
    return s.replace("'", "''").strip()


# ---------------------------------------------------------------------------
# 1. Parse packages.csv to extract material codes and descriptions
# ---------------------------------------------------------------------------
def parse_materials(csv_path: Path) -> list[dict]:
    """
    Parse packages.csv.
    - Row 0: header (col0=รหัสบรรจุภัณฑ์, col1=รายละเอียด, col2=สินค้า, col3+=SKU codes)
    - Row 1: จำนวนกลอง row
    - Row 2: ต้องใช้ ตามแผน row
    - Rows 3+: material_code, thai_description, "0", then quantities per SKU
    """
    materials = []
    seen_codes = set()

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i < 3:
                # Skip header rows (row 0 = header, row 1 = box counts, row 2 = required amounts)
                continue

            if len(row) < 2:
                continue

            code = row[0].strip()
            description = row[1].strip() if len(row) > 1 else ""

            # Skip empty codes or rows that don't look like material codes
            if not code:
                continue

            # Deduplicate
            if code in seen_codes:
                continue
            seen_codes.add(code)

            mat_type = classify_material_type(code)
            materials.append({
                "code": code,
                "name": description,
                "type": mat_type,
            })

    return materials


# ---------------------------------------------------------------------------
# 2. Parse productList.csv to get all SKU codes
# ---------------------------------------------------------------------------
def parse_skus(csv_path: Path) -> list[dict]:
    """
    Parse productList.csv. Format:
      packageID, columnRange, ColumnName, totalFormula
      CG0501-0500-BXX-00, 4, D1, 608
      ...

    SKU code format examples:
      FG0218-5000X01-F40-00   -> fg_code=FG0218, size=5000, pkg=F40-00
      FG0202-0080X45-FXX-73   -> fg_code=FG0202, size=80, pkg=FXX-73
      CG0501-0500-BXX-00      -> fg_code=CG0501, size=500, pkg=BXX-00
      FB0109-0250-X40-00      -> fg_code=FB0109, size=250, pkg=X40-00
      SF0401-0045X50-DXX-16   -> fg_code=SF0401, size=45, pkg=DXX-16

    First segment = product code (letters+digits up to first -)
    Second segment = size in grams (may contain XNN multiplier like 5000X01, 0080X45)
    Third+fourth segments = package code
    """
    skus = []
    seen_codes = set()

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i == 0:
                # Skip header row
                continue

            if len(row) < 1:
                continue

            sku_code = row[0].strip()
            if not sku_code:
                continue

            # Skip non-product rows (like the trailing "สินค้า" row)
            if not re.match(r"^[A-Z]{2}", sku_code):
                continue

            # Deduplicate
            if sku_code in seen_codes:
                continue
            seen_codes.add(sku_code)

            # Parse the SKU code
            parts = sku_code.split("-")
            if len(parts) < 3:
                continue

            fg_code = parts[0]  # e.g. FG0218, CG0501, FB0109

            # Parse size from second segment
            # Could be "5000X01", "0080X45", "0500", "0030X24", etc.
            size_part = parts[1]
            # Extract the base size (before X if present)
            size_match = re.match(r"^(\d+)", size_part)
            if not size_match:
                continue
            size_g = int(size_match.group(1))

            # Extract qty_per_box from XNN part if present
            qty_per_box = 1
            qty_match = re.search(r"X(\d+)", size_part)
            if qty_match:
                qty_per_box = int(qty_match.group(1))

            # Package code = remaining parts joined
            package_code = "-".join(parts[2:])

            skus.append({
                "sku_code": sku_code,
                "fg_code": fg_code,
                "size_g": size_g,
                "qty_per_box": qty_per_box,
                "package_code": package_code,
            })

    return skus


# ---------------------------------------------------------------------------
# 3. Generate SQL
# ---------------------------------------------------------------------------
def generate_sql(materials: list[dict], skus: list[dict], output_path: Path):
    """Generate SQL file with INSERT statements for materials and skus."""

    # Collect unique FG codes from SKUs that start with "FG"
    # (only FG-prefixed products exist in the products table)
    fg_codes_in_skus = sorted(set(
        s["fg_code"] for s in skus if s["fg_code"].startswith("FG")
    ))

    lines = []
    lines.append("-- =================================================================")
    lines.append("-- Import packaging materials and SKUs from CSV data")
    lines.append("-- Generated by scripts/import_packages.py")
    lines.append("-- =================================================================")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")

    # -----------------------------------------------------------------------
    # DELETE existing data (except seed materials)
    # -----------------------------------------------------------------------
    lines.append("-- Clean up existing imported data")
    lines.append("-- (packaging_bom references skus, so delete it first)")
    lines.append("DELETE FROM packaging_bom;")
    lines.append("DELETE FROM skus;")
    lines.append("DELETE FROM materials;")
    lines.append("")

    # -----------------------------------------------------------------------
    # INSERT materials
    # -----------------------------------------------------------------------
    lines.append("-- =================================================================")
    lines.append(f"-- Materials ({len(materials)} packaging materials)")
    lines.append("-- =================================================================")

    for mat in materials:
        code = escape_sql(mat["code"])
        name = escape_sql(mat["name"])
        mat_type = mat["type"]

        lines.append(
            f"INSERT INTO materials (code, name, type) "
            f"VALUES ('{code}', '{name}', '{mat_type}') "
            f"ON CONFLICT (code) DO NOTHING;"
        )

    lines.append("")

    # -----------------------------------------------------------------------
    # INSERT SKUs
    # Only for products that exist in the products table (FG-prefixed).
    # We use a subquery to look up product_id by fg_code.
    # -----------------------------------------------------------------------
    lines.append("-- =================================================================")
    lines.append(f"-- SKUs ({len(skus)} total, only FG-prefixed will match products)")
    lines.append("-- =================================================================")

    # Filter to only FG-prefixed SKUs (products table only has FG codes)
    fg_skus = [s for s in skus if s["fg_code"].startswith("FG")]
    non_fg_skus = [s for s in skus if not s["fg_code"].startswith("FG")]

    lines.append(f"-- {len(fg_skus)} FG-prefixed SKUs (will reference products table)")
    lines.append(f"-- {len(non_fg_skus)} non-FG SKUs skipped: "
                 f"{', '.join(sorted(set(s['fg_code'][:2] for s in non_fg_skus)))}")
    lines.append("")

    for sku in fg_skus:
        sku_code = escape_sql(sku["sku_code"])
        fg_code = escape_sql(sku["fg_code"])
        size_g = sku["size_g"]
        qty_per_box = sku["qty_per_box"]
        package_code = escape_sql(sku["package_code"])

        lines.append(
            f"INSERT INTO skus (product_id, sku_code, size_g, qty_per_box, package_code) "
            f"SELECT id, '{sku_code}', {size_g}, {qty_per_box}, '{package_code}' "
            f"FROM products WHERE fg_code = '{fg_code}' "
            f"ON CONFLICT (sku_code) DO NOTHING;"
        )

    lines.append("")
    lines.append("COMMIT;")
    lines.append("")

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print(f"Parsing materials from: {PACKAGES_CSV}")
    if not PACKAGES_CSV.exists():
        print(f"ERROR: File not found: {PACKAGES_CSV}")
        sys.exit(1)
    materials = parse_materials(PACKAGES_CSV)
    print(f"  Found {len(materials)} unique material codes")

    # Show type distribution
    type_counts = {}
    for m in materials:
        t = m["type"]
        type_counts[t] = type_counts.get(t, 0) + 1
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"    {t}: {c}")

    print(f"\nParsing SKUs from: {PRODUCT_LIST_CSV}")
    if not PRODUCT_LIST_CSV.exists():
        print(f"ERROR: File not found: {PRODUCT_LIST_CSV}")
        sys.exit(1)
    skus = parse_skus(PRODUCT_LIST_CSV)
    print(f"  Found {len(skus)} unique SKU codes")

    # Show prefix distribution
    prefix_counts = {}
    for s in skus:
        p = s["fg_code"][:2]
        prefix_counts[p] = prefix_counts.get(p, 0) + 1
    for p, c in sorted(prefix_counts.items(), key=lambda x: -x[1]):
        print(f"    {p}: {c}")

    # Show FG code distribution
    fg_skus = [s for s in skus if s["fg_code"].startswith("FG")]
    unique_fg = sorted(set(s["fg_code"] for s in fg_skus))
    print(f"\n  {len(fg_skus)} FG-prefixed SKUs referencing {len(unique_fg)} unique FG codes")

    print(f"\nGenerating SQL: {OUTPUT_SQL}")
    generate_sql(materials, skus, OUTPUT_SQL)
    print(f"  Done! SQL file written to: {OUTPUT_SQL}")

    # Summary
    print(f"\nSummary:")
    print(f"  Materials: {len(materials)} INSERT statements")
    print(f"  SKUs (FG only): {len(fg_skus)} INSERT statements")
    print(f"  SKUs (non-FG, skipped): {len(skus) - len(fg_skus)}")


if __name__ == "__main__":
    main()
