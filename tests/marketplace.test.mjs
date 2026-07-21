import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
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
  assert.equal(data.brands.find(({ id }) => id === "rmayd").instagramHandle, "@rmayd.official");
  assert.match(data.brands.find(({ id }) => id === "rmayd").assets.primary.srcset, /480w.+960w.+1440w/);
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
    assert.equal(product.price, "Not yet available");
    assert.equal(product.name, "Collection arriving soon.");
    assert.equal(product.material, "");
    assert.equal(product.countryOfManufacture, "");
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
  assert.match(checkout, /brandLinkHTML/);
  assert.match(checkout, /brandIdentityHTML/);
});

test("official RMAYD assets replace temporary graphics and remain deployment-safe", async () => {
  const [html, marketplace, css] = await Promise.all([
    read("github-pages/index.html"), read("github-pages/marketplace.js"), read("github-pages/marketplace.css"),
  ]);
  assert.doesNotMatch(`${html}${marketplace}${css}`, /editorial-placeholder-rmayd|RMAYD Look/);
  assert.match(html, /rmaydPictureHTML/);
  assert.match(marketplace, /Follow RMAYD/);
  assert.match(marketplace, /@rmayd\.official/);
  assert.match(marketplace, /rmayd-instagram-qr/);
  const files = [
    "primary-480.webp", "primary-960.webp", "primary-1440.webp",
    "secondary-360.webp", "secondary-720.webp", "secondary-1080.webp",
    "instagram-240.webp", "instagram-480.webp", "instagram-720.webp",
  ];
  for (const file of files) {
    const details = await stat(new URL(`../github-pages/assets/brands/rmayd/${file}`, import.meta.url));
    assert.equal(details.size > 0, true, `${file} must not be empty`);
    assert.equal(details.size < 180_000, true, `${file} must remain lightweight`);
  }
  for (const original of ["RMAYD.logos-01.png", "RMAYD.logos-02.png", "instagram.jpeg"]) {
    const [source, mirror] = await Promise.all([
      readFile(new URL(`../assets/brands/rmayd/originals/${original}`, import.meta.url)),
      readFile(new URL(`../github-pages/assets/brands/rmayd/originals/${original}`, import.meta.url)),
    ]);
    assert.deepEqual(mirror, source);
  }
});
