import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { CATALOG } from "../payment-worker/src/catalog.generated.js";

const root = new URL("../", import.meta.url);
const read = (path, encoding = "utf8") => readFile(new URL(path, root), encoding);

test("Excel is the authoritative source for all generated products", async () => {
  const [workbook, catalogText] = await Promise.all([
    read("catalog/JUNKTEE_Product_Catalog.xlsx", null),
    read("github-pages/data/products.json"),
  ]);
  const catalog = JSON.parse(catalogText);
  assert.equal(catalog.source, "catalog/JUNKTEE_Product_Catalog.xlsx");
  assert.equal(catalog.sourceSha256, createHash("sha256").update(workbook).digest("hex"));
  assert.equal(catalog.products.length, 11);
  assert.equal(new Set(catalog.products.map(({ id }) => id)).size, 11);
  assert.equal(catalog.products.every(({ id, name, unitAmount, sizes }) => id && name && unitAmount > 0 && sizes.length), true);
  assert.deepEqual(catalog.products.find(({ id }) => id === "ST23A444").sizes, ["S", "M", "L", "XL"]);
  assert.deepEqual(catalog.products.find(({ id }) => id === "ST23A442").sizes, ["S", "M", "L", "XL"]);
  assert.deepEqual(catalog.products.find(({ id }) => id === "ST23A443").sizes, ["S", "M", "L", "XL"]);
});

test("generated frontend products have optimized WebP images or a graceful fallback", async () => {
  const catalog = JSON.parse(await read("github-pages/data/products.json"));
  for (const product of catalog.products) {
    const paths = [product.images.front, product.images.back, ...product.images.details].filter(Boolean);
    for (const path of paths) {
      assert.match(path, /\.webp$/);
      const image = new URL(`github-pages/${path.replace(/^\.\//, "")}`, root);
      const size = (await stat(image)).size;
      assert.equal(size > 0, true, `${product.id} image is empty`);
      assert.equal(size < 300_000, true, `${product.id} image is unexpectedly large`);
    }
  }
  assert.equal(catalog.products.filter(({ images }) => images.front).length, 11);
});

test("the Worker catalog exactly matches available spreadsheet prices and sizes", async () => {
  const catalog = JSON.parse(await read("github-pages/data/products.json"));
  const expected = Object.fromEntries(catalog.products.filter(({ available }) => available).map((product) => [
    product.id,
    { name: product.name, unitAmount: product.unitAmount, sizes: product.sizes },
  ]));
  assert.deepEqual(CATALOG, expected);
});

test("the storefront loads generated data instead of a hardcoded product array", async () => {
  const html = await read("github-pages/index.html");
  assert.match(html, /<script src="\.\/data\/products\.generated\.js"><\/script>/);
  assert.doesNotMatch(html, /const PRODUCTS\s*=\s*\[/);
  assert.match(html, /Collection temporarily unavailable/);
  assert.match(html, /productImageHTML/);
  assert.match(html, /id="hero-primary-image"/);
  assert.match(html, /renderHeroProduct/);
  assert.doesNotMatch(html, /hero-media:before\{content:"";position:absolute;right:11%/);
});
