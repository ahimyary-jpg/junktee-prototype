import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function marketplaceData() {
  const context = { window: {} };
  vm.runInNewContext(await read("github-pages/data/marketplace.generated.js"), context);
  return context.window.JUNKTEE_MARKETPLACE;
}

test("the platform has a reusable JUNKTEE and RMAYD brand model", async () => {
  const data = await marketplaceData();
  assert.deepEqual(Array.from(data.brands, ({ id }) => id), ["junktee", "rmayd"]);
  assert.equal(data.brands.find(({ id }) => id === "junktee").status, "Founding brand");
  assert.equal(data.brands.find(({ id }) => id === "rmayd").placeholder, true);
  assert.equal(data.collections.some(({ kind }) => kind === "mixed"), true);
});

test("RMAYD placeholders never masquerade as priced or purchasable catalog products", async () => {
  const data = await marketplaceData();
  assert.equal(data.demoProducts.length >= 3, true);
  for (const product of data.demoProducts) {
    assert.equal(product.brandId, "rmayd");
    assert.equal(product.demo, true);
    assert.equal(product.purchasable, false);
    assert.equal(product.unitAmount, 0);
    assert.equal(product.price, "Price pending");
    assert.equal(product.passportEligible, false);
  }
});

test("the deployed SPA exposes marketplace navigation, filters, brand pages, and safe mixed Bag behavior", async () => {
  const [html, client, checkout] = await Promise.all([
    read("github-pages/index.html"),
    read("github-pages/marketplace.js"),
    read("github-pages/junktee-v03.js"),
  ]);
  for (const asset of ["marketplace.css", "marketplace.js", "marketplace.generated.js"]) assert.match(html, new RegExp(asset.replace(".", "\\.")));
  for (const surface of ["screen-brands", "screen-brand", "screen-collections", "shop-brand-pills", "brand-product-grid", "Digital Passport"]) assert.match(client, new RegExp(surface));
  for (const control of ["All Brands", "All categories", "All collections", "All Passport states"]) assert.match(client, new RegExp(control));
  assert.match(checkout, /Preview pieces are saved in your Bag but cannot be charged/);
  assert.match(checkout, /RMAYD preview pieces have no approved price and cannot be sent to Stripe/);
  assert.match(checkout, /cart\.some\(\(item\) => !isPurchasable\(item\)\)/);
});

test("brand identity reaches product, Passport, Cabinet, and checkout layers", async () => {
  const [html, marketplace, checkout] = await Promise.all([
    read("github-pages/index.html"), read("github-pages/marketplace.js"), read("github-pages/junktee-v03.js"),
  ]);
  assert.match(html, /passportDataRow\('Brand'/);
  assert.match(marketplace, /pd-brand-link/);
  assert.match(marketplace, /cabinet-brand-filters/);
  assert.match(checkout, /brandName/);
  assert.match(checkout, /openBrand/);
});
