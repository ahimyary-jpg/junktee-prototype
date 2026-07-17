import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("GitHub Pages prototype loads the v0.3 checkout layer", async () => {
  const html = await readFile(new URL("github-pages/index.html", root), "utf8");
  assert.match(html, /name="junktee-payment-api"/);
  assert.match(html, /junktee-v03\.css/);
  assert.match(html, /junktee-v03\.js/);
  assert.match(html, /junktee_v03_last_confirmation/);
});

test("checkout collects the complete shipping draft and preserves demo state", async () => {
  const client = await readFile(new URL("github-pages/junktee-v03.js", root), "utf8");
  for (const field of ["fullName", "email", "mobile", "country", "city", "address", "building", "postalCode", "deliveryNotes"]) {
    assert.match(client, new RegExp(`name=\\"${field}\\"`));
  }
  for (const key of ["checkout_draft", "pending_payment", "demo_orders", "owned_items", "last_confirmation"]) {
    assert.match(client, new RegExp(`junktee_v03_${key}`));
  }
  assert.match(client, /Your piece has entered the archive/);
  assert.match(client, /Purchased and Passport activated/);
  assert.match(client, /Reset Demo State/);
});

test("public frontend contains no Stripe secret or live credential patterns", async () => {
  const files = await Promise.all([
    readFile(new URL("github-pages/index.html", root), "utf8"),
    readFile(new URL("github-pages/junktee-v03.js", root), "utf8"),
    readFile(new URL("github-pages/junktee-v03.css", root), "utf8"),
  ]);
  const publicSource = files.join("\n");
  assert.doesNotMatch(publicSource, /(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{8,}/);
  assert.doesNotMatch(publicSource, /whsec_[A-Za-z0-9]+/);
  assert.doesNotMatch(publicSource, /card(number|_number)|\bcvv\b/i);
});

test("payment UI states are all represented", async () => {
  const client = await readFile(new URL("github-pages/junktee-v03.js", root), "utf8");
  for (const copy of [
    "Verifying your payment.",
    "Payment cancelled. Your Bag has been preserved.",
    "We couldn’t verify this payment.",
    "We couldn’t connect to the payment service.",
    "Digital Passport Activated",
  ]) assert.match(client, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
