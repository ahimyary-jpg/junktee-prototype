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
});

test("generated frontend products have usable images or a graceful fallback", async () => {
  const catalog = JSON.parse(await read("github-pages/data/products.json"));
  for (const product of catalog.products) {
    if (!product.images.front) continue;
    const image = new URL(`github-pages/${product.images.front.replace(/^\.\//, "")}`, root);
    assert.equal((await stat(image)).size > 0, true, `${product.id} front image is empty`);
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
});
