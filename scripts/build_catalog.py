#!/usr/bin/env python3
"""Build JUNKTEE's static and server-owned catalogs from the Excel source of truth.

The script uses Python's standard library for workbook parsing and Pillow for
deterministic web-image optimization. It supports both normal filename cells and
Excel's embedded rich-image cells.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import posixpath
import re
import shutil
import sys
import zipfile
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET

try:
    from PIL import Image, ImageOps
except ImportError as error:  # pragma: no cover - exercised by the build environment.
    raise SystemExit(
        "catalog error: Pillow is required. Install requirements-catalog.txt first."
    ) from error


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKBOOK = ROOT / "catalog" / "JUNKTEE_Product_Catalog.xlsx"
PRODUCTS_JSON = ROOT / "github-pages" / "data" / "products.json"
PRODUCTS_JS = ROOT / "github-pages" / "data" / "products.generated.js"
PRODUCT_ASSETS = ROOT / "github-pages" / "assets" / "products"
PRODUCT_ASSETS_BUILD = PRODUCT_ASSETS.parent / ".products-build"
WORKER_CATALOG = ROOT / "payment-worker" / "src" / "catalog.generated.js"

SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
RICH_NS = "http://schemas.microsoft.com/office/spreadsheetml/2017/richdata"
RICH_REL_NS = "http://schemas.microsoft.com/office/spreadsheetml/2022/richvaluerel"

PRODUCT_COLUMNS = [
    "SKU",
    "Product Name",
    "Category",
    "Collection",
    "Price (SAR)",
    "Color",
    "Sizes",
    "Short Description",
    "Front Image",
    "Back Image",
    "Detail Image 1",
    "Detail Image 2",
    "Available (Yes/No)",
]
OPTIONAL_COLUMNS = [
    "SKU",
    "Material",
    "Care Instructions",
    "Country of Manufacture",
    "Digital Passport ID",
    "Internal Notes",
]
IMAGE_ROLES = {
    "Front Image": "front",
    "Back Image": "back",
    "Detail Image 1": "detail-1",
    "Detail Image 2": "detail-2",
}
IMAGE_MAX_EDGE = 1600
IMAGE_WEBP_QUALITY = 86


class CatalogError(RuntimeError):
    """Raised when the authoritative workbook cannot produce a safe catalog."""


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def slug(value: str) -> str:
    result = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return result or "product"


def column_index(cell_reference: str) -> int:
    letters = re.match(r"[A-Z]+", cell_reference.upper())
    if not letters:
        return 0
    value = 0
    for character in letters.group(0):
        value = value * 26 + ord(character) - 64
    return value - 1


def xml_root(archive: zipfile.ZipFile, path: str) -> ET.Element:
    try:
        return ET.fromstring(archive.read(path))
    except KeyError as error:
        raise CatalogError(f"Workbook is missing {path}.") from error


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = xml_root(archive, "xl/sharedStrings.xml")
    except CatalogError:
        return []
    return ["".join(node.text or "" for node in item.iter(f"{{{SHEET_NS}}}t")) for item in root]


def sheet_paths(archive: zipfile.ZipFile) -> dict[str, str]:
    workbook = xml_root(archive, "xl/workbook.xml")
    relationships = xml_root(archive, "xl/_rels/workbook.xml.rels")
    targets = {
        relation.attrib["Id"]: relation.attrib["Target"]
        for relation in relationships.findall(f"{{{PKG_REL_NS}}}Relationship")
    }
    result: dict[str, str] = {}
    for sheet in workbook.findall(f".//{{{SHEET_NS}}}sheet"):
        relationship_id = sheet.attrib.get(f"{{{DOC_REL_NS}}}id", "")
        target = targets.get(relationship_id, "")
        if not target:
            continue
        path = posixpath.normpath(str(PurePosixPath("xl") / target))
        result[sheet.attrib.get("name", "")] = path.lstrip("/")
    return result


def embedded_image_map(archive: zipfile.ZipFile) -> dict[int, str]:
    """Return a 1-based value-metadata index to workbook media path mapping."""

    required = {
        "xl/metadata.xml",
        "xl/richData/rdrichvalue.xml",
        "xl/richData/richValueRel.xml",
        "xl/richData/_rels/richValueRel.xml.rels",
    }
    if not required.issubset(set(archive.namelist())):
        return {}

    metadata = xml_root(archive, "xl/metadata.xml")
    rich_values = xml_root(archive, "xl/richData/rdrichvalue.xml")
    rich_relations = xml_root(archive, "xl/richData/richValueRel.xml")
    relationships = xml_root(archive, "xl/richData/_rels/richValueRel.xml.rels")

    metadata_to_rich: list[int] = []
    value_metadata = metadata.find(f"{{{SHEET_NS}}}valueMetadata")
    if value_metadata is not None:
        for block in value_metadata.findall(f"{{{SHEET_NS}}}bk"):
            record = block.find(f"{{{SHEET_NS}}}rc")
            metadata_to_rich.append(int(record.attrib.get("v", "-1")) if record is not None else -1)

    rich_to_relation: list[int] = []
    for value in rich_values.findall(f"{{{RICH_NS}}}rv"):
        fields = value.findall(f"{{{RICH_NS}}}v")
        rich_to_relation.append(int(fields[0].text or "-1") if fields else -1)

    relation_ids = [
        relation.attrib.get(f"{{{DOC_REL_NS}}}id", "")
        for relation in rich_relations.findall(f"{{{RICH_REL_NS}}}rel")
    ]
    relation_targets = {
        relation.attrib.get("Id", ""): relation.attrib.get("Target", "")
        for relation in relationships.findall(f"{{{PKG_REL_NS}}}Relationship")
    }

    result: dict[int, str] = {}
    for metadata_index, rich_index in enumerate(metadata_to_rich, start=1):
        if rich_index < 0 or rich_index >= len(rich_to_relation):
            continue
        relation_index = rich_to_relation[rich_index]
        if relation_index < 0 or relation_index >= len(relation_ids):
            continue
        target = relation_targets.get(relation_ids[relation_index], "")
        if target:
            path = posixpath.normpath(str(PurePosixPath("xl/richData") / target))
            result[metadata_index] = path.lstrip("/")
    return result


def cell_value(cell: ET.Element, strings: list[str]) -> str:
    cell_type = cell.attrib.get("t", "")
    value = cell.find(f"{{{SHEET_NS}}}v")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(f"{{{SHEET_NS}}}t"))
    if value is None or value.text is None:
        return ""
    if cell_type == "s":
        try:
            return strings[int(value.text)]
        except (ValueError, IndexError):
            return ""
    if cell_type == "b":
        return "Yes" if value.text == "1" else "No"
    if cell_type == "e":
        return ""
    return value.text


def read_sheet(
    archive: zipfile.ZipFile,
    path: str,
    strings: list[str],
    image_map: dict[int, str],
) -> list[dict[str, object]]:
    root = xml_root(archive, path)
    rows: list[dict[str, object]] = []
    for row in root.findall(f".//{{{SHEET_NS}}}sheetData/{{{SHEET_NS}}}row"):
        values: dict[str, object] = {}
        for cell in row.findall(f"{{{SHEET_NS}}}c"):
            index = column_index(cell.attrib.get("r", ""))
            values[str(index)] = {
                "value": cell_value(cell, strings),
                "embedded": image_map.get(int(cell.attrib["vm"])) if cell.attrib.get("vm", "").isdigit() else None,
            }
        rows.append(values)
    return rows


def table_records(rows: list[dict[str, object]]) -> list[dict[str, dict[str, object]]]:
    if not rows:
        return []
    headers = {
        index: clean_text(cell.get("value"))
        for index, cell in rows[0].items()
        if isinstance(cell, dict) and clean_text(cell.get("value"))
    }
    records: list[dict[str, dict[str, object]]] = []
    for row in rows[1:]:
        record = {
            header: row.get(index, {"value": "", "embedded": None})
            for index, header in headers.items()
        }
        if any(clean_text(cell.get("value")) or cell.get("embedded") for cell in record.values()):
            records.append(record)
    return records


def parse_price(value: object) -> int:
    match = re.search(r"\d+(?:[.,]\d+)?", clean_text(value).replace(",", ""))
    if not match:
        raise CatalogError("Price (SAR) must contain a valid number.")
    amount = round(float(match.group(0)) * 100)
    if amount <= 0:
        raise CatalogError("Price (SAR) must be greater than zero.")
    return amount


def parse_sizes(value: object) -> list[str]:
    text = clean_text(value).upper()
    if not text:
        return ["ONE SIZE"]
    if "," in text:
        parts = text.split(",")
    else:
        parts = re.split(r"\s{2,}|\s+", text)
    sizes = [clean_text(part).upper() for part in parts if clean_text(part)]
    return list(dict.fromkeys(sizes)) or ["ONE SIZE"]


def required_headers(records: list[dict[str, dict[str, object]]], expected: list[str], sheet: str) -> None:
    if not records:
        if sheet == "Products":
            raise CatalogError("The Products sheet has no product rows.")
        return
    missing = [header for header in expected if header not in records[0]]
    if missing:
        raise CatalogError(f"{sheet} is missing columns: {', '.join(missing)}")


def copy_image(
    archive: zipfile.ZipFile,
    workbook: Path,
    cell: dict[str, object],
    sku_slug: str,
    role: str,
) -> str | None:
    embedded = cell.get("embedded")
    filename = clean_text(cell.get("value"))
    source_bytes: bytes | None = None
    suffix = ""

    if embedded:
        embedded_path = str(embedded)
        source_bytes = archive.read(embedded_path)
        suffix = Path(embedded_path).suffix.lower()
    elif filename:
        candidates = [ROOT / "catalog" / "images" / filename, workbook.parent / filename]
        source = next((candidate for candidate in candidates if candidate.is_file()), None)
        if source:
            source_bytes = source.read_bytes()
            suffix = source.suffix.lower()
        else:
            print(f"warning: image '{filename}' for {sku_slug}/{role} was not found", file=sys.stderr)

    if not source_bytes:
        return None
    if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        raise CatalogError(f"Unsupported image format for {sku_slug}/{role}: {suffix or 'unknown'}")

    try:
        with Image.open(io.BytesIO(source_bytes)) as source_image:
            image = ImageOps.exif_transpose(source_image)
            if max(image.size) > IMAGE_MAX_EDGE:
                image.thumbnail((IMAGE_MAX_EDGE, IMAGE_MAX_EDGE), Image.Resampling.LANCZOS)
            has_alpha = image.mode in {"RGBA", "LA"} or "transparency" in image.info
            image = image.convert("RGBA" if has_alpha else "RGB")
            encoded = io.BytesIO()
            image.save(
                encoded,
                format="WEBP",
                quality=IMAGE_WEBP_QUALITY,
                method=6,
                exact=has_alpha,
            )
            web_bytes = encoded.getvalue()
    except (OSError, ValueError) as error:
        raise CatalogError(f"Unable to optimise image for {sku_slug}/{role}.") from error

    output = PRODUCT_ASSETS_BUILD / sku_slug / f"{role}.webp"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(web_bytes)
    return f"./assets/products/{sku_slug}/{output.name}"


def value(record: dict[str, dict[str, object]], header: str) -> str:
    return clean_text(record.get(header, {}).get("value"))


def build(workbook: Path) -> dict[str, object]:
    if not workbook.is_file():
        raise CatalogError(f"Workbook not found: {workbook}")

    source_hash = hashlib.sha256(workbook.read_bytes()).hexdigest()
    if PRODUCT_ASSETS_BUILD.exists():
        shutil.rmtree(PRODUCT_ASSETS_BUILD)
    PRODUCT_ASSETS_BUILD.mkdir(parents=True)
    with zipfile.ZipFile(workbook) as archive:
        strings = shared_strings(archive)
        sheets = sheet_paths(archive)
        image_map = embedded_image_map(archive)
        if "Products" not in sheets:
            raise CatalogError("Workbook must contain a Products sheet.")

        product_records = table_records(read_sheet(archive, sheets["Products"], strings, image_map))
        optional_records = (
            table_records(read_sheet(archive, sheets["Optional Details"], strings, image_map))
            if "Optional Details" in sheets
            else []
        )
        required_headers(product_records, PRODUCT_COLUMNS, "Products")
        required_headers(optional_records, OPTIONAL_COLUMNS, "Optional Details")

        optional_by_sku = {
            value(record, "SKU").upper(): record
            for record in optional_records
            if value(record, "SKU")
        }
        seen: set[str] = set()
        products: list[dict[str, object]] = []

        for row_number, record in enumerate(product_records, start=2):
            sku = value(record, "SKU").upper()
            name = value(record, "Product Name")
            if not sku and not name:
                continue
            if not sku or not name:
                raise CatalogError(f"Products row {row_number} needs both SKU and Product Name.")
            if not re.fullmatch(r"[A-Z0-9_-]{2,48}", sku):
                raise CatalogError(f"Products row {row_number} has an unsafe SKU: {sku}")
            if sku in seen:
                raise CatalogError(f"Duplicate SKU in Products: {sku}")
            seen.add(sku)

            try:
                unit_amount = parse_price(value(record, "Price (SAR)"))
            except CatalogError as error:
                raise CatalogError(f"Products row {row_number} ({sku}): {error}") from error

            sku_slug = slug(sku)
            image_paths = {
                role: copy_image(archive, workbook, record.get(header, {}), sku_slug, role)
                for header, role in IMAGE_ROLES.items()
            }
            detail_images = [image_paths["detail-1"], image_paths["detail-2"]]
            optional = optional_by_sku.get(sku, {})
            available = value(record, "Available (Yes/No)").lower() not in {"no", "false", "0"}
            country = value(optional, "Country of Manufacture")
            description = value(record, "Short Description")

            products.append({
                "id": sku,
                "sku": sku,
                "name": name,
                "category": value(record, "Category") or "Uncategorised",
                "collection": value(record, "Collection") or "JUNKTEE Archive",
                "price": f"SAR {unit_amount / 100:,.2f}".replace(".00", ""),
                "priceSar": unit_amount / 100,
                "unitAmount": unit_amount,
                "color": value(record, "Color") or "Not specified",
                "sizes": parse_sizes(value(record, "Sizes")),
                "description": description or "Product details are coming soon.",
                "story": description or "Product details are coming soon.",
                "material": value(optional, "Material"),
                "careInstructions": value(optional, "Care Instructions"),
                "countryOfManufacture": country,
                "passportId": value(optional, "Digital Passport ID"),
                "images": {
                    "front": image_paths["front"],
                    "back": image_paths["back"],
                    "details": [path for path in detail_images if path],
                },
                "available": available,
            })

    if PRODUCT_ASSETS.exists():
        shutil.rmtree(PRODUCT_ASSETS)
    shutil.move(str(PRODUCT_ASSETS_BUILD), str(PRODUCT_ASSETS))

    return {
        "schemaVersion": 1,
        "source": "catalog/JUNKTEE_Product_Catalog.xlsx",
        "sourceSha256": source_hash,
        "products": products,
    }


def write_outputs(catalog: dict[str, object]) -> None:
    PRODUCTS_JSON.parent.mkdir(parents=True, exist_ok=True)
    json_text = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    PRODUCTS_JSON.write_text(json_text, encoding="utf-8")
    PRODUCTS_JS.write_text(
        "/* Generated by scripts/build_catalog.py. Do not edit by hand. */\n"
        f"window.JUNKTEE_PRODUCT_CATALOG = {json_text.rstrip()};\n",
        encoding="utf-8",
    )

    worker_products = {
        product["id"]: {
            "name": product["name"],
            "unitAmount": product["unitAmount"],
            "sizes": product["sizes"],
        }
        for product in catalog["products"]
        if product["available"]
    }
    WORKER_CATALOG.parent.mkdir(parents=True, exist_ok=True)
    WORKER_CATALOG.write_text(
        "/* Generated by scripts/build_catalog.py. Do not edit by hand. */\n"
        f"export const CATALOG_SCHEMA_VERSION = {catalog['schemaVersion']};\n"
        f"export const CATALOG_SOURCE_SHA256 = {json.dumps(catalog['sourceSha256'])};\n"
        f"export const CATALOG = Object.freeze({json.dumps(worker_products, ensure_ascii=False, indent=2)});\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", nargs="?", type=Path, default=DEFAULT_WORKBOOK)
    args = parser.parse_args()
    try:
        catalog = build(args.workbook.resolve())
        write_outputs(catalog)
        print(
            f"Catalog valid: {len(catalog['products'])} products, "
            f"{sum(bool(product['images']['front']) for product in catalog['products'])} front images."
        )
        return 0
    except (CatalogError, zipfile.BadZipFile) as error:
        if PRODUCT_ASSETS_BUILD.exists():
            shutil.rmtree(PRODUCT_ASSETS_BUILD)
        print(f"catalog error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
