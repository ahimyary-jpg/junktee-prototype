import assert from "node:assert/strict";
import test from "node:test";
import { handleRequest } from "../src/index.js";

const ORIGIN = "https://ahimyary-jpg.github.io";
const ENV = {
  STRIPE_SECRET_KEY: "sk_test_example_for_unit_tests_only",
  FRONTEND_URL: `${ORIGIN}/junktee-prototype/`,
  ALLOWED_ORIGIN: ORIGIN,
};

function request(path, init = {}) {
  return new Request(`https://payments.example${path}`, {
    headers: { origin: ORIGIN, "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });
}

test("rejects non-test Stripe keys without contacting Stripe", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("fetch should not run"); };
  try {
    const response = await handleRequest(request("/v1/checkout-sessions", {
      method: "POST",
      body: JSON.stringify({ attemptId: "attempt_123456789", items: [{ productId: "ST23A451", size: "M", quantity: 1 }] }),
    }), { ...ENV, STRIPE_SECRET_KEY: "sk_live_forbidden" });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "test_mode_required");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("creates a server-priced, idempotent test Checkout Session", async () => {
  const originalFetch = globalThis.fetch;
  let stripeCall;
  globalThis.fetch = async (url, init) => {
    stripeCall = { url, init };
    return Response.json({
      id: "cs_test_created123",
      url: "https://checkout.stripe.com/c/pay/cs_test_created123",
      livemode: false,
      expires_at: 1900000000,
    });
  };
  try {
    const response = await handleRequest(request("/v1/checkout-sessions", {
      method: "POST",
      body: JSON.stringify({
        attemptId: "attempt_123456789",
        customerEmail: "layla@example.com",
        items: [{ productId: "ST23A44", size: "L", quantity: 2 }],
      }),
    }), ENV);
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.amountTotal, 78500);
    assert.equal(stripeCall.init.headers["idempotency-key"], "junktee-demo-attempt_123456789");
    const form = new URLSearchParams(stripeCall.init.body);
    assert.equal(form.get("line_items[0][price_data][unit_amount]"), "37500");
    assert.equal(form.get("line_items[0][quantity]"), "2");
    assert.match(form.get("success_url"), /session_id=\{CHECKOUT_SESSION_ID\}/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects client-invented products and prices", async () => {
  const response = await handleRequest(request("/v1/checkout-sessions", {
    method: "POST",
    body: JSON.stringify({
      attemptId: "attempt_123456789",
      items: [{ productId: "p999", size: "M", quantity: 1, unitAmount: 1 }],
    }),
  }), ENV);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "invalid_cart");
});

test("verifies paid test sessions and returns only safe order data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    id: "cs_test_verified123",
    livemode: false,
    status: "complete",
    payment_status: "paid",
    created: 1784246400,
    currency: "sar",
    amount_total: 36500,
    metadata: { cart: JSON.stringify([{ productId: "ST23A451", size: "M", quantity: 1 }]) },
  });
  try {
    const response = await handleRequest(request("/v1/checkout/verify?session_id=cs_test_verified123"), ENV);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.verified, true);
    assert.equal(result.order.amountTotal, 36500);
    assert.equal(result.order.items[0].passportId.startsWith("JT-ST23A451-"), true);
    assert.equal(JSON.stringify(result).includes("card"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("never accepts a live-mode session response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ id: "cs_live_123", livemode: true });
  try {
    const response = await handleRequest(request("/v1/checkout/verify?session_id=cs_test_expected123"), ENV);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "live_mode_rejected");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("blocks unapproved browser origins", async () => {
  const response = await handleRequest(new Request("https://payments.example/health", {
    headers: { origin: "https://evil.example" },
  }), ENV);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});
