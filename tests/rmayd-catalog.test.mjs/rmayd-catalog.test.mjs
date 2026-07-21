import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path, encoding = "utf8") => readFile(new URL(path, root), encoding);

test("RMAYD Excel workbook is the source of truth for the RMAYD catalog", async () => {
  const [workbook, catalogText] = await Promise.all([
    read("catalog/RMAYD_Product_Catalog.xlsx", null),
    read("github-pages/data/rmayd.products.json"),
  ]);
  const catalog = JSON.parse(catalogText);
  assert.equal(catalog.source, "catalog/RMAYD_Product_Catalog.xlsx");
  assert.equal(catalog.sourceSha256, createHash("sha256").update(workbook).digest("hex"));
  assert.equal(catalog.products.length, 11);
  assert.equal(new Set(catalog.products.map(({ id }) => id)).size, 11);
  assert.equal(catalog.products.every(({ brandId, brandName }) => brandId === "rmayd" && brandName === "RMAYD"), true);
  assert.equal(catalog.products.every(({ unitAmount, sizes }) => unitAmount > 0 && sizes.length > 0), true);
  assert.equal(catalog.products.every(({ images }) => Boolean(images.front)), true);
});

test("RMAYD storefront and Worker outputs are both generated", async () => {
  const [html, worker, catalogText] = await Promise.all([
    read("github-pages/index.html"),
    read("payment-worker/src/rmayd-catalog.generated.js"),
    read("github-pages/data/rmayd.products.json"),
  ]);
  const catalog = JSON.parse(catalogText);
  assert.match(html, /rmayd\.products\.generated\.js/);
  assert.match(worker, /export const CATALOG = Object\.freeze/);
  for (const product of catalog.products) {
    const image = new URL(`github-pages/${product.images.front.replace(/^\.\//, "")}`, root);
    assert.equal((await stat(image)).size > 0, true, `${product.id} image is empty`);
  }
});
