#!/usr/bin/env python3
"""
Parse recipe data from formula CSV files and generate SQL for Supabase import.

Input files:
  - สูตรสินค้า - formulaID.csv  (product-to-column mapping)
  - สูตรสินค้า - formula.csv    (wide-format recipe data)

Output:
  - supabase/import_recipes.sql

CSV structure (formula.csv):
  Row 1: FG codes as headers (every 3 columns: FG0102, "", "", FG0108, "", "", ...)
  Row 2: "Yield (Kg)", "", <yield_value>, repeated for each product
  Row 3: Section header ("Main")
  Row 4: Column labels (ingredientID, weight (kg), workStation)
  Rows 5+: Actual ingredient data (ingredientID, weight_kg, workStation per product)

  After ~330 data rows, there may be a second section ("10th" header, "ID" row,
  then column labels again) -- we skip those section headers.
"""

import csv
import os
import re
from collections import OrderedDict

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOADS_DIR = os.path.expanduser("~/Downloads")
FORMULA_CSV = os.path.join(DOWNLOADS_DIR, "สูตรสินค้า - formula.csv")
FORMULA_ID_CSV = os.path.join(DOWNLOADS_DIR, "สูตรสินค้า - formulaID.csv")
OUTPUT_SQL = os.path.join(BASE_DIR, "supabase", "import_recipes.sql")

# Existing FG codes in seed.sql (products table) -- these already exist in DB
EXISTING_FG_CODES = {
    'FG0218', 'FG0901', 'FG0202', 'FG0305', 'FG2201', 'FG0101', 'FG0102',
    'FG0204', 'FG0605', 'FG0902', 'FG0904', 'FG0802', 'FG0908', 'FG0301',
    'FG0228', 'FG0235', 'SS0101', 'FG1102', 'FG1004', 'FG0404', 'FG0803',
    'FG0234', 'FG2901', 'FG0405', 'FG0104', 'FG0108', 'FG0914', 'FG0804',
    'FG0215', 'FG2302',
}

# Ingredient category mapping based on R-code prefix
def categorize_ingredient(code: str) -> str:
    """Categorize ingredient by its R-code prefix."""
    code_upper = code.upper().strip()

    if code_upper in ('WATER', 'R001'):
        return 'water'

    # Extract numeric prefix after 'R'
    m = re.match(r'^R(\d)', code_upper)
    if not m:
        return 'other'

    prefix_digit = m.group(1)
    category_map = {
        '1': 'surimi',
        '2': 'seasoning',
        '3': 'additive',
        '4': 'spice',
        '5': 'starch',
        '6': 'additive',     # R6xx -- misc additive (e.g. R605)
        '7': 'preservative',
        '8': 'oil',
        '9': 'preservative',
    }
    return category_map.get(prefix_digit, 'other')


def guess_product_info(fg_code: str):
    """Guess product name, category, flavor, and flavor_code from FG code pattern."""
    code = fg_code.upper()

    # Flavor code is typically characters 3-4 of the FG code (e.g., FG0202 -> 02)
    flavor_code = code[2:4] if len(code) >= 4 else ''

    flavor_map = {
        '01': ('รสเข้มข้น', 'ปลาเส้น'),
        '02': ('BBQ', 'ปลาเส้น'),
        '03': ('ซุปเปอร์แซ่บ', 'ปลาเส้น'),
        '04': ('ปลาหมึก', 'ปลาเส้น'),
        '05': ('บาวาเรียน', 'ปลาเส้น'),
        '06': ('ดั้งเดิม', 'ปลาเส้น'),
        '08': ('ไก่ย่าง', 'ปลาเส้น'),
        '09': ('ปูอัด', 'สปูอัด'),
        '10': ('พิซซ่า/sausage', 'สอดไส้'),
        '11': ('พิซซ่า/sausage', 'สอดไส้'),
        '12': ('พิเศษ', 'พิเศษ'),
        '13': ('พิเศษ', 'พิเศษ'),
        '14': ('พิเศษ', 'พิเศษ'),
        '16': ('พิเศษ', 'พิเศษ'),
        '19': ('พิเศษ', 'พิเศษ'),
        '20': ('พิเศษ', 'พิเศษ'),
        '21': ('พิเศษ', 'พิเศษ'),
        '22': ('BBQ', 'ปลาเส้น'),  # export TU
        '23': ('BBQ', 'ปลาเส้น'),
        '25': ('พิเศษ', 'พิเศษ'),
        '29': ('สาหร่าย', 'สาหร่าย'),
        '32': ('พิเศษ', 'พิเศษ'),
    }

    # Non-FG prefixes
    prefix_category = {
        'CF': ('กาแฟ', 'กาแฟ', ''),
        'CR': ('ครีม', 'ครีม', ''),
        'SK': ('ขนม', 'ขนม', ''),
        'SQ': ('สควอช', 'สควอช', ''),
        'SS': ('แผ่นทรงเครื่อง', 'แผ่น', ''),
        'CG': ('เค้ก', 'เค้ก', ''),
        'CS': ('ชีส', 'ชีส', ''),
        'FB': ('ฟิชบอล', 'ฟิชบอล', ''),
        'SR': ('สาหร่าย', 'สาหร่าย', ''),
        'SF': ('ซีฟู้ด', 'ซีฟู้ด', ''),
        'UD': ('อุด้ง', 'อุด้ง', ''),
    }

    prefix_2 = code[:2]
    if prefix_2 in prefix_category:
        flavor, category, fc = prefix_category[prefix_2]
        name = f'{category} {fg_code}'
        return name, category, flavor, fc

    if prefix_2 == 'FG' and flavor_code in flavor_map:
        flavor, category = flavor_map[flavor_code]
        name = f'{category} {flavor} {fg_code}'
        return name, category, flavor, flavor_code

    # Fallback
    return f'สินค้า {fg_code}', 'อื่นๆ', '', flavor_code


def escape_sql(s: str) -> str:
    """Escape single quotes for SQL strings."""
    if s is None:
        return 'NULL'
    return s.replace("'", "''")


def parse_formula_csv():
    """Parse the wide-format formula CSV and return recipe data."""

    # Read all rows
    with open(FORMULA_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)

    if len(rows) < 5:
        print("ERROR: formula.csv has fewer than 5 rows")
        return {}, set()

    # Row 0 (line 1): FG codes -- every 3 columns
    header_row = rows[0]

    # Row 1 (line 2): Yield values -- at offset +2 from each FG code position
    yield_row = rows[1]

    # Row 2 (line 3): "Main" section header -- skip
    # Row 3 (line 4): column labels -- skip
    # Row 4+ (line 5+): ingredient data

    # Build product column map: {fg_code: (col_index, yield_kg)}
    product_columns = OrderedDict()
    for col_idx, cell in enumerate(header_row):
        cell_stripped = cell.strip()
        if cell_stripped and col_idx % 3 == 0:
            fg_code = cell_stripped
            # Get yield from row 1, col_idx + 2
            yield_val = None
            if col_idx + 2 < len(yield_row):
                yv = yield_row[col_idx + 2].strip()
                if yv and yv != '-':
                    try:
                        yield_val = float(yv)
                    except ValueError:
                        yield_val = None
            product_columns[fg_code] = (col_idx, yield_val)

    # Handle duplicate FG codes (e.g., FG0401 appears at col 88 and col 265)
    # The formulaID.csv lists them separately, so we keep both by appending suffix
    # Actually, we want UNIQUE recipes per FG code. If duplicated, the later one
    # is likely a revised version. We'll use the LAST occurrence.
    # But first let's track duplicates for logging.
    seen_codes = {}
    final_products = OrderedDict()
    for fg_code, (col_idx, yield_val) in product_columns.items():
        key = fg_code
        if key in seen_codes:
            # Duplicate -- overwrite with later column (revised recipe)
            seen_codes[key] += 1
        else:
            seen_codes[key] = 1
        final_products[key] = (col_idx, yield_val)

    duplicates = {k: v for k, v in seen_codes.items() if v > 1}
    if duplicates:
        print(f"Note: {len(duplicates)} products have duplicate columns (using last occurrence):")
        for code, count in duplicates.items():
            print(f"  {code}: {count} occurrences")

    # Parse ingredient rows (rows 4 onward, i.e., index 4+)
    # Skip section headers: rows where first cell is "Main", "10th", "ID", "ingredientID"
    skip_markers = {'main', '10th', 'id', 'ingredientid', 'yield (kg)', ''}

    recipes = {}       # {fg_code: [(ingredient_code, weight_kg), ...]}
    all_ingredients = set()  # all unique ingredient codes

    for fg_code, (col_idx, yield_val) in final_products.items():
        recipes[fg_code] = {
            'yield_kg': yield_val,
            'ingredients': []
        }

    for row_idx in range(4, len(rows)):
        row = rows[row_idx]

        # Check if this is a section header row
        first_cell = row[0].strip().lower() if row and row[0] else ''
        if first_cell in skip_markers:
            continue

        # For each product, read (ingredientID, weight_kg) from its column group
        for fg_code, (col_idx, yield_val) in final_products.items():
            if col_idx >= len(row):
                continue

            ingredient_id = row[col_idx].strip() if col_idx < len(row) else ''
            weight_str = row[col_idx + 1].strip() if col_idx + 1 < len(row) else ''

            if not ingredient_id or not weight_str:
                continue

            # Parse weight
            try:
                weight_kg = float(weight_str)
            except ValueError:
                continue

            # Normalize ingredient code
            ingredient_id = ingredient_id.strip()

            # Skip if weight is 0
            if weight_kg == 0:
                continue

            recipes[fg_code]['ingredients'].append((ingredient_id, weight_kg))
            all_ingredients.add(ingredient_id)

    # Remove products with no ingredients
    empty = [fg for fg, data in recipes.items() if not data['ingredients']]
    for fg in empty:
        del recipes[fg]

    print(f"\nParsed {len(recipes)} products with recipes")
    print(f"Found {len(all_ingredients)} unique ingredients")

    return recipes, all_ingredients


def normalize_ingredient_code(code: str) -> str:
    """Normalize ingredient codes for consistent SQL keys.

    Handles case variations like R1xx/R1XX, Water/WATER, etc.
    """
    c = code.strip()
    # Uppercase the main part but keep the structure
    # We want consistent casing: R101A, R208A, WATER, etc.
    upper = c.upper()
    return upper


def generate_sql(recipes, all_ingredients):
    """Generate SQL file for importing recipes."""

    # Normalize all ingredient codes
    normalized_ingredients = {}
    for ing in all_ingredients:
        norm = normalize_ingredient_code(ing)
        normalized_ingredients[norm] = ing  # keep original for reference

    # Determine which FG codes are NEW (not in seed data)
    all_fg_codes = set(recipes.keys())
    new_fg_codes = all_fg_codes - EXISTING_FG_CODES

    print(f"\nExisting products in seed: {len(EXISTING_FG_CODES)}")
    print(f"Products with recipes: {len(all_fg_codes)}")
    print(f"New products to insert: {len(new_fg_codes)}")

    lines = []
    lines.append("-- =============================================================")
    lines.append("-- Big Kitchen Recipe Import")
    lines.append("-- Generated from สูตรสินค้า CSV files")
    lines.append("-- =============================================================")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")

    # 1. Delete existing recipe_bom data
    lines.append("-- Delete existing recipe_bom data (fresh import)")
    lines.append("DELETE FROM recipe_bom;")
    lines.append("")

    # 2. Insert new products that don't exist in seed data
    if new_fg_codes:
        lines.append("-- =============================================================")
        lines.append(f"-- New products ({len(new_fg_codes)} items not in seed data)")
        lines.append("-- =============================================================")

        sorted_new = sorted(new_fg_codes)
        values = []
        for fg_code in sorted_new:
            name, category, flavor, flavor_code = guess_product_info(fg_code)
            values.append(
                f"  ('{escape_sql(fg_code)}', '{escape_sql(name)}', "
                f"'{escape_sql(category)}', '{escape_sql(flavor)}', "
                f"'{escape_sql(flavor_code)}', 'B5', 75)"
            )

        lines.append("INSERT INTO products (fg_code, name, category, flavor, flavor_code, batch_type, default_batch_kg)")
        lines.append("VALUES")
        lines.append(",\n".join(values))
        lines.append("ON CONFLICT (fg_code) DO NOTHING;")
        lines.append("")

    # 3. Insert ingredients
    lines.append("-- =============================================================")
    lines.append(f"-- Ingredients ({len(normalized_ingredients)} unique codes)")
    lines.append("-- =============================================================")

    sorted_ingredients = sorted(normalized_ingredients.keys())
    values = []
    for code in sorted_ingredients:
        category = categorize_ingredient(code)
        # Use the code itself as the name (we don't have proper names from CSV)
        values.append(
            f"  ('{escape_sql(code)}', '{escape_sql(code)}', '{escape_sql(category)}')"
        )

    lines.append("INSERT INTO ingredients (code, name, category)")
    lines.append("VALUES")
    lines.append(",\n".join(values))
    lines.append("ON CONFLICT (code) DO NOTHING;")
    lines.append("")

    # 4. Insert recipe_bom entries
    lines.append("-- =============================================================")
    lines.append(f"-- Recipe BOM entries")
    lines.append("-- =============================================================")

    total_bom_entries = 0
    sorted_fg_codes = sorted(recipes.keys())

    for fg_code in sorted_fg_codes:
        data = recipes[fg_code]
        yield_kg = data['yield_kg']
        ingredients = data['ingredients']

        if not ingredients:
            continue

        yield_sql = str(yield_kg) if yield_kg is not None else 'NULL'

        lines.append(f"")
        lines.append(f"-- {fg_code} (yield: {yield_kg} kg, {len(ingredients)} ingredients)")

        # Aggregate duplicate ingredients within same recipe
        # (some recipes list same ingredient multiple times)
        agg = OrderedDict()
        for ing_code, weight in ingredients:
            norm_code = normalize_ingredient_code(ing_code)
            if norm_code in agg:
                agg[norm_code] += weight
            else:
                agg[norm_code] = weight

        for norm_code, weight in agg.items():
            weight_rounded = round(weight, 4)
            lines.append(
                f"INSERT INTO recipe_bom (product_id, ingredient_id, weight_kg, yield_kg) "
                f"SELECT p.id, i.id, {weight_rounded}, {yield_sql} "
                f"FROM products p, ingredients i "
                f"WHERE p.fg_code = '{escape_sql(fg_code)}' AND i.code = '{escape_sql(norm_code)}' "
                f"ON CONFLICT (product_id, ingredient_id) DO UPDATE SET weight_kg = EXCLUDED.weight_kg, yield_kg = EXCLUDED.yield_kg;"
            )
            total_bom_entries += 1

    lines.append("")
    lines.append("COMMIT;")
    lines.append("")
    lines.append(f"-- Total: {len(recipes)} products, {len(normalized_ingredients)} ingredients, {total_bom_entries} BOM entries")

    print(f"Total BOM entries: {total_bom_entries}")

    return "\n".join(lines)


def main():
    print("=" * 60)
    print("Big Kitchen Recipe Import Script")
    print("=" * 60)

    # Check input files exist
    if not os.path.exists(FORMULA_CSV):
        print(f"ERROR: Cannot find {FORMULA_CSV}")
        return

    if not os.path.exists(FORMULA_ID_CSV):
        print(f"WARNING: Cannot find {FORMULA_ID_CSV} (not required, using formula.csv directly)")

    # Parse CSV
    print(f"\nParsing: {FORMULA_CSV}")
    recipes, all_ingredients = parse_formula_csv()

    if not recipes:
        print("ERROR: No recipes parsed")
        return

    # Generate SQL
    print(f"\nGenerating SQL...")
    sql = generate_sql(recipes, all_ingredients)

    # Write output
    os.makedirs(os.path.dirname(OUTPUT_SQL), exist_ok=True)
    with open(OUTPUT_SQL, 'w', encoding='utf-8') as f:
        f.write(sql)

    print(f"\nOutput written to: {OUTPUT_SQL}")
    print(f"File size: {os.path.getsize(OUTPUT_SQL):,} bytes")
    print("\nDone!")


if __name__ == '__main__':
    main()
