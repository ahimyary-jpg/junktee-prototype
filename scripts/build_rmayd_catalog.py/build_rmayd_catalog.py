#!/usr/bin/env python3
"""Build RMAYD's approved Excel catalog as a separate static and Worker catalog."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from build_catalog import CatalogError, build, write_outputs


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKBOOK = ROOT / "catalog" / "RMAYD_Product_Catalog.xlsx"
PRODUCTS_JSON = ROOT / "github-pages" / "data" / "rmayd.products.json"
PRODUCTS_JS = ROOT / "github-pages" / "data" / "rmayd.products.generated.js"
PRODUCT_ASSETS = ROOT / "github-pages" / "assets" / "products-rmayd"
WORKER_CATALOG = ROOT / "payment-worker" / "src" / "rmayd-catalog.generated.js"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", nargs="?", type=Path, default=DEFAULT_WORKBOOK)
    args = parser.parse_args()
    assets_build = PRODUCT_ASSETS.parent / f".{PRODUCT_ASSETS.name}-build"
    try:
        catalog = build(
            args.workbook.resolve(),
            brand_id="rmayd",
            brand_name="RMAYD",
            assets_dir=PRODUCT_ASSETS,
            asset_url_prefix="./assets/products-rmayd",
        )
        write_outputs(
            catalog,
            products_json=PRODUCTS_JSON,
            products_js=PRODUCTS_JS,
            worker_catalog=WORKER_CATALOG,
            global_name="JUNKTEE_RMAYD_CATALOG",
            generated_by="scripts/build_rmayd_catalog.py",
        )
        print(
            f"RMAYD catalog valid: {len(catalog['products'])} products, "
            f"{sum(bool(product['images']['front']) for product in catalog['products'])} front images."
        )
        return 0
    except (CatalogError, shutil.Error, OSError) as error:
        if assets_build.exists():
            shutil.rmtree(assets_build)
        print(f"RMAYD catalog error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
