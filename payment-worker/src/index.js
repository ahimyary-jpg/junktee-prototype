import { CATALOG, CATALOG_SCHEMA_VERSION, CATALOG_SOURCE_SHA256 } from "./catalog.generated.js";

const STRIPE_API = "https://api.stripe.com/v1";
const CURRENCY = "sar";
const DELIVERY_HALALAS = 3500;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...headers },
});

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = normaliseOrigin(env.ALLOWED_ORIGIN || env.FRONTEND_URL || "");
  return origin && normaliseOrigin(origin) === allowedOrigin
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        vary: "Origin",
      }
    : { vary: "Origin" };
}

function normaliseOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function publicError(message, status, headers, code = "request_failed") {
  return json({ error: { code, message } }, status, headers);
}

function assertTestConfiguration(env) {
  const key = String(env.STRIPE_SECRET_KEY || "");
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("STRIPE_TEST_CONFIGURATION_REQUIRED");
  }
  const frontend = new URL(env.FRONTEND_URL);
  if (frontend.protocol !== "https:" && frontend.hostname !== "localhost") {
    throw new Error("HTTPS_FRONTEND_REQUIRED");
  }
  return { key, frontend };
}

function validateAttemptId(value) {
  const attemptId = String(value || "");
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(attemptId)) {
    throw new Error("INVALID_ATTEMPT_ID");
  }
  return attemptId;
}

function validateItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) {
    throw new Error("INVALID_ITEMS");
  }

  return value.map((item) => {
    const productId = String(item?.productId || "");
    const product = CATALOG[productId];
    const quantity = Number(item?.quantity);
    const requestedSize = String(item?.size || "").trim().toUpperCase();
    const size = !requestedSize && product?.sizes?.length === 1 ? product.sizes[0] : requestedSize;

    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
      throw new Error("INVALID_ITEM");
    }
    if (!product.sizes.includes(size)) {
      throw new Error("INVALID_SIZE");
    }

    return {
      productId,
      name: product.name,
      brandId: product.brandId,
      brandName: product.brandName,
      size,
      quantity,
      unitAmount: product.unitAmount,
      passportId: product.passportId,
      passportEligible: product.passportEligible !== false,
    };
  });
}

function cartTotal(items) {
  return items.reduce((total, item) => total + item.unitAmount * item.quantity, DELIVERY_HALALAS);
}

function checkoutReturnURL(frontend, state, includeSession = false) {
  const url = new URL(frontend);
  url.searchParams.set("payment", state);
  const base = url.toString();
  if (!includeSession) return base;
  return `${base}${url.search ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
}

function appendLineItem(form, index, item) {
  const root = `line_items[${index}]`;
  form.append(`${root}[quantity]`, String(item.quantity));
  form.append(`${root}[price_data][currency]`, CURRENCY);
  form.append(`${root}[price_data][unit_amount]`, String(item.unitAmount));
  form.append(`${root}[price_data][product_data][name]`, item.name);
  form.append(`${root}[price_data][product_data][description]`, `Size ${item.size} · Digital Passport included`);
}

async function stripeRequest(path, env, init = {}) {
  const { key } = assertTestConfiguration(env);
  const response = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error("STRIPE_REQUEST_FAILED");
    error.stripeStatus = response.status;
    error.stripeCode = data?.error?.code || "stripe_error";
    throw error;
  }
  return data;
}

async function createCheckoutSession(request, env, headers) {
  let body;
  try {
    body = await request.json();
  } catch {
    return publicError("The checkout request could not be read.", 400, headers, "invalid_json");
  }

  let attemptId;
  let items;
  let frontend;
  try {
    attemptId = validateAttemptId(body.attemptId);
    items = validateItems(body.items);
    ({ frontend } = assertTestConfiguration(env));
  } catch (error) {
    if (error.message === "STRIPE_TEST_CONFIGURATION_REQUIRED") {
      return publicError("Sandbox payments are not configured.", 503, headers, "test_mode_required");
    }
    return publicError("The Bag contains an item that cannot be checked out.", 400, headers, "invalid_cart");
  }

  const email = String(body.customerEmail || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return publicError("Enter a valid email address.", 400, headers, "invalid_email");
  }

  const cartMetadata = JSON.stringify(items.map(({ productId, size, quantity }) => ({ productId, size, quantity })));
  const form = new URLSearchParams();
  form.append("mode", "payment");
  form.append("payment_method_types[0]", "card");
  form.append("submit_type", "pay");
  form.append("success_url", checkoutReturnURL(frontend, "success", true));
  form.append("cancel_url", checkoutReturnURL(frontend, "cancelled"));
  form.append("metadata[attempt_id]", attemptId);
  form.append("metadata[cart]", cartMetadata);
  form.append("payment_intent_data[metadata][attempt_id]", attemptId);
  if (email) form.append("customer_email", email);
  items.forEach((item, index) => appendLineItem(form, index, item));
  appendLineItem(form, items.length, {
    name: "Delivery",
    size: "JUNKTEE standard",
    quantity: 1,
    unitAmount: DELIVERY_HALALAS,
  });

  try {
    const session = await stripeRequest("/checkout/sessions", env, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": `junktee-demo-${attemptId}`,
      },
      body: form.toString(),
    });
    let checkoutHost = "";
    try { checkoutHost = new URL(session.url).hostname; } catch { /* Rejected below. */ }
    if (session.livemode !== false || !String(session.id || "").startsWith("cs_test_") || checkoutHost !== "checkout.stripe.com") {
      return publicError("A test Checkout Session could not be created.", 502, headers, "live_mode_rejected");
    }
    return json({
      sessionId: session.id,
      url: session.url,
      attemptId,
      expiresAt: session.expires_at || null,
      currency: CURRENCY.toUpperCase(),
      amountTotal: cartTotal(items),
    }, 201, headers);
  } catch (error) {
    if (error.message === "STRIPE_TEST_CONFIGURATION_REQUIRED") {
      return publicError("Sandbox payments are not configured.", 503, headers, "test_mode_required");
    }
    return publicError("We couldn’t connect to the payment service.", 502, headers, "payment_service_unavailable");
  }
}

async function shortHash(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function safePaymentState(session) {
  if (session.payment_status === "paid" && session.status === "complete") return "paid";
  if (session.status === "expired") return "expired";
  if (session.payment_intent?.last_payment_error) return "failed";
  return "unpaid";
}

async function verifyCheckoutSession(sessionId, env, headers) {
  if (!/^cs_test_[a-zA-Z0-9_]+$/.test(sessionId)) {
    return publicError("The sandbox payment reference is invalid.", 400, headers, "invalid_session");
  }

  let session;
  try {
    session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`, env);
  } catch (error) {
    if (error.message === "STRIPE_TEST_CONFIGURATION_REQUIRED") {
      return publicError("Sandbox payments are not configured.", 503, headers, "test_mode_required");
    }
    return publicError("We couldn’t verify this payment.", 502, headers, "verification_unavailable");
  }

  if (session.livemode !== false || !String(session.id || "").startsWith("cs_test_")) {
    return publicError("Live-mode transactions are not accepted.", 403, headers, "live_mode_rejected");
  }

  let items;
  try {
    items = validateItems(JSON.parse(session.metadata?.cart || "[]"));
  } catch {
    return publicError("The verified payment does not match a valid JUNKTEE Bag.", 409, headers, "cart_mismatch");
  }

  const expectedTotal = cartTotal(items);
  if (session.currency !== CURRENCY || session.amount_total !== expectedTotal) {
    return publicError("The verified payment total does not match the Bag.", 409, headers, "total_mismatch");
  }

  const status = safePaymentState(session);
  if (status !== "paid") {
    return json({ verified: false, status }, 200, headers);
  }

  const hash = await shortHash(session.id);
  const paidAt = new Date((session.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
  const dateCode = paidAt.slice(0, 10).replaceAll("-", "");
  return json({
    verified: true,
    status: "paid",
    order: {
      sessionId: session.id,
      orderReference: `JT-${dateCode}-${hash.slice(0, 6)}`,
      paidAt,
      currency: "SAR",
      subtotal: expectedTotal - DELIVERY_HALALAS,
      delivery: DELIVERY_HALALAS,
      amountTotal: expectedTotal,
      items: items.map((item, index) => ({
        productId: item.productId,
        name: item.name,
        brandId: item.brandId,
        brandName: item.brandName,
        size: item.size,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
        passportId: item.passportId || `JT-${item.productId.toUpperCase()}-${hash.slice(index * 6, index * 6 + 8)}`,
        passportEligible: item.passportEligible,
      })),
    },
  }, 200, headers);
}

export async function handleRequest(request, env) {
  const headers = corsHeaders(request, env);
  const origin = request.headers.get("origin");
  const allowedOrigin = normaliseOrigin(env.ALLOWED_ORIGIN || env.FRONTEND_URL || "");

  if (origin && normaliseOrigin(origin) !== allowedOrigin) {
    return publicError("Origin not allowed.", 403, headers, "origin_not_allowed");
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    try {
      assertTestConfiguration(env);
      return json({
        ok: true,
        provider: "stripe",
        mode: "test",
        catalog: {
          schemaVersion: CATALOG_SCHEMA_VERSION,
          sourceSha256: CATALOG_SOURCE_SHA256,
          productCount: Object.keys(CATALOG).length,
        },
      }, 200, headers);
    } catch {
      return json({ ok: false, provider: "stripe", mode: "unconfigured" }, 503, headers);
    }
  }
  if (request.method === "POST" && url.pathname === "/v1/checkout-sessions") {
    return createCheckoutSession(request, env, headers);
  }
  if (request.method === "GET" && url.pathname === "/v1/checkout/verify") {
    return verifyCheckoutSession(url.searchParams.get("session_id") || "", env, headers);
  }
  return publicError("Not found.", 404, headers, "not_found");
}

const worker = { fetch: handleRequest };
export default worker;

export { CATALOG, DELIVERY_HALALAS, cartTotal, validateItems };
