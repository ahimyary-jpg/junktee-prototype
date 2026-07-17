/* JUNKTEE v0.3 — Stripe Test Mode presentation flow */
(() => {
  "use strict";

  const KEYS = Object.freeze({
    bag: "junktee_v03_bag",
    shipping: "junktee_v03_checkout_draft",
    pending: "junktee_v03_pending_payment",
    orders: "junktee_v03_demo_orders",
    owned: "junktee_v03_owned_items",
    lastConfirmation: "junktee_v03_last_confirmation",
    presenter: "junktee_v03_presenter",
  });
  const DELIVERY = 3500;
  const params = new URLSearchParams(location.search);
  const apiBase = (document.querySelector('meta[name="junktee-payment-api"]')?.content || "").replace(/\/$/, "");
  const baseOpenProduct = window.openProduct;
  const baseOpenPassport = window.openPassport;
  let submitting = false;

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function removeStored(key) {
    try { localStorage.removeItem(key); } catch { /* Storage can be unavailable in strict private mode. */ }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character]);
  }

  function priceAmount(product) {
    return Number(String(product.price).replace(/[^0-9]/g, "")) * 100;
  }

  function money(halalas) {
    return new Intl.NumberFormat("en-SA", {
      style: "currency",
      currency: "SAR",
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    }).format((Number(halalas) || 0) / 100).replace("SAR", "SAR ").replace(/\s+/g, " ").trim();
  }

  function productById(id) {
    return PRODUCTS.find((product) => product.id === id);
  }

  function cleanBag(items) {
    if (!Array.isArray(items)) return [];
    return items.slice(0, 8).flatMap((item) => {
      const product = productById(item.id);
      const quantity = Math.min(5, Math.max(1, Number(item.quantity) || 1));
      if (!product) return [];
      const size = product.id === "p6" ? "ONE SIZE" : ["S", "M", "L", "XL"].includes(item.size) ? item.size : "M";
      return [{ ...product, size, quantity }];
    });
  }

  function persistBag() {
    writeJSON(KEYS.bag, cart.map(({ id, size, quantity }) => ({ id, size, quantity })));
  }

  function cartQuantity() {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }

  function cartSubtotal() {
    return cart.reduce((total, item) => total + priceAmount(item) * item.quantity, 0);
  }

  function cartTotal() {
    return cart.length ? cartSubtotal() + DELIVERY : 0;
  }

  function apiItems() {
    return cart.map(({ id, size, quantity }) => ({ productId: id, size, quantity }));
  }

  function cartSignature(items = apiItems()) {
    return JSON.stringify(items.map(({ productId, size, quantity }) => ({ productId, size, quantity })));
  }

  function updateBadge() {
    const badge = document.getElementById("cart-badge");
    const quantity = cartQuantity();
    badge.textContent = quantity;
    badge.style.display = quantity ? "flex" : "none";
  }

  function selectedSize() {
    if (currentProduct === "p6") return "ONE SIZE";
    return document.querySelector("#size-row .sizechip.selected")?.textContent.trim().toUpperCase() || "M";
  }

  function configureSizes(productId) {
    const row = document.getElementById("size-row");
    if (!row) return;
    row.innerHTML = productId === "p6"
      ? '<button class="sizechip selected" type="button">One Size</button>'
      : ["S", "M", "L", "XL"].map((size) => `<button class="sizechip ${size === "M" ? "selected" : ""}" type="button">${size}</button>`).join("");
  }

  window.openProduct = function openProductV03(id) {
    baseOpenProduct(id);
    configureSizes(id);
  };

  window.addToBag = function addToBagV03() {
    const product = productById(currentProduct);
    const size = selectedSize();
    const existing = cart.find((item) => item.id === product.id && item.size === size);
    if (existing) existing.quantity = Math.min(5, existing.quantity + 1);
    else cart.push({ ...product, size, quantity: 1 });
    persistBag();
    updateBadge();
    const button = document.getElementById("add-to-bag");
    button.textContent = "Added";
    button.setAttribute("aria-live", "polite");
    setTimeout(() => { button.textContent = "Add to Bag"; }, 1300);
    renderCartV03();
  };

  window.changeCartQuantity = function changeCartQuantity(index, delta) {
    const item = cart[index];
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) cart.splice(index, 1);
    else item.quantity = Math.min(5, item.quantity);
    persistBag();
    updateBadge();
    renderCartV03();
  };

  window.removeCart = function removeCartV03(index) {
    cart.splice(index, 1);
    persistBag();
    updateBadge();
    renderCartV03();
  };

  function renderCartV03() {
    const wrap = document.getElementById("cart-items");
    const empty = document.getElementById("cart-empty");
    const summary = document.getElementById("cart-summary");
    if (!cart.length) {
      wrap.innerHTML = "";
      empty.style.display = "block";
      summary.style.display = "none";
      renderCheckoutSummary();
      return;
    }
    empty.style.display = "none";
    summary.style.display = "block";
    wrap.innerHTML = cart.map((item, index) => `
      <article class="cart-item">
        <div class="imgbox visual-${escapeHTML(item.id)}">${pIcon()}</div>
        <div style="flex:1;">
          <p class="body-md">${escapeHTML(item.name)}</p>
          <p class="bag-size" style="margin:7px 0 10px;">Size ${escapeHTML(item.size)}</p>
          <p class="meta" style="margin-bottom:7px;">${money(priceAmount(item))}</p>
          <div class="qty-control" aria-label="Quantity for ${escapeHTML(item.name)}">
            <button type="button" onclick="changeCartQuantity(${index},-1)" aria-label="Decrease quantity">−</button>
            <output aria-live="polite">${item.quantity}</output>
            <button type="button" onclick="changeCartQuantity(${index},1)" aria-label="Increase quantity" ${item.quantity >= 5 ? "disabled" : ""}>+</button>
          </div>
        </div>
        <button class="icon-btn" type="button" onclick="removeCart(${index})" aria-label="Remove ${escapeHTML(item.name)}">✕</button>
      </article>`).join("");
    document.getElementById("cart-subtotal").textContent = money(cartSubtotal());
    document.getElementById("cart-total").textContent = money(cartTotal());
    renderCheckoutSummary();
  }

  function checkoutMarkup() {
    return `
      <div class="topbar"><button class="back-btn" type="button" onclick="back()">← Bag</button><span class="body-md">Checkout</span><span style="width:24px;"></span></div>
      <form class="section-tight" id="payment-form" novalidate>
        <div class="sandbox-note" role="note">
          <span class="mark" aria-hidden="true"></span>
          <div><strong>Secure sandbox checkout</strong><p>Test environment — no real payment will be processed.</p></div>
        </div>
        <div class="checkout-section">
          <div class="checkout-section-title"><p class="eyebrow">Your Bag</p><span class="count" id="checkout-piece-count">0 pieces</span></div>
          <div class="checkout-summary" id="checkout-items"></div>
          <div class="totals" id="checkout-totals"></div>
        </div>
        <div class="checkout-section">
          <div class="checkout-section-title"><p class="eyebrow">Shipping Details</p><span class="count">Required</span></div>
          <div class="field"><label for="checkout-name">Full name</label><input id="checkout-name" name="fullName" autocomplete="name" placeholder="Layla Al-Otaibi" required></div>
          <div class="form-pair">
            <div class="field"><label for="checkout-email">Email</label><input id="checkout-email" name="email" type="email" autocomplete="email" placeholder="layla@example.com" required></div>
            <div class="field"><label for="checkout-mobile">Mobile number</label><input id="checkout-mobile" name="mobile" type="tel" autocomplete="tel" placeholder="+966 5X XXX XXXX" required></div>
          </div>
          <div class="form-pair">
            <div class="field"><label for="checkout-country">Country</label><select id="checkout-country" name="country" autocomplete="country-name" required><option value="Saudi Arabia">Saudi Arabia</option><option value="United Arab Emirates">United Arab Emirates</option><option value="Kuwait">Kuwait</option><option value="Bahrain">Bahrain</option><option value="Qatar">Qatar</option></select></div>
            <div class="field"><label for="checkout-city">City</label><input id="checkout-city" name="city" autocomplete="address-level2" placeholder="Jeddah" required></div>
          </div>
          <div class="field"><label for="checkout-address">Address</label><input id="checkout-address" name="address" autocomplete="street-address" placeholder="Street and district" required></div>
          <div class="form-pair">
            <div class="field"><label for="checkout-building">Building or apartment</label><input id="checkout-building" name="building" autocomplete="address-line2" placeholder="Building 12, Apt 4"></div>
            <div class="field"><label for="checkout-postal">Postal code</label><input id="checkout-postal" name="postalCode" inputmode="numeric" autocomplete="postal-code" placeholder="23435" required></div>
          </div>
          <div class="field"><label for="checkout-notes">Delivery notes</label><textarea id="checkout-notes" name="deliveryNotes" placeholder="Optional instructions for the courier"></textarea><p class="field-help">Saved only in this browser for the presentation.</p></div>
        </div>
        <div class="checkout-section" style="margin-bottom:34px;">
          <div class="checkout-section-title"><p class="eyebrow">Payment</p><span class="count">Stripe Test Mode</span></div>
          <div class="sandbox-note" style="margin-bottom:0;">
            <span class="mark" aria-hidden="true"></span>
            <div><strong>Payment details stay with Stripe</strong><p>You’ll continue to Stripe’s hosted test checkout. JUNKTEE never sees or stores card details.</p></div>
          </div>
        </div>
        <div class="checkout-status" id="checkout-status" role="status" aria-live="polite"></div>
        <button class="btn btn-primary" id="payment-submit" type="submit"><span>Continue to Test Payment · <span id="payment-button-total">SAR 0</span></span></button>
        <p class="payment-submit-copy"><strong>Sandbox only.</strong> No real money can be charged.</p>
      </form>`;
  }

  function installPaymentScreens() {
    const checkout = document.getElementById("screen-checkout");
    checkout.innerHTML = checkoutMarkup();
    checkout.insertAdjacentHTML("afterend", `
      <div class="screen no-nav" id="screen-processing">
        <div class="payment-state" role="status" aria-live="polite">
          <p class="eyebrow">Stripe Test Mode</p><h1>Verifying your payment.</h1>
          <p class="state-copy">Please keep this page open. Your Passport will activate only after Stripe confirms the test payment.</p>
          <div class="processing-rule" aria-hidden="true"></div>
        </div>
      </div>
      <div class="screen no-nav" id="screen-payment-error">
        <div class="payment-state">
          <p class="eyebrow">Sandbox Payment</p><h1 id="payment-error-title">We couldn’t verify this payment.</h1>
          <p class="state-copy" id="payment-error-copy">Your Bag and shipping details are still here. No Passport has been activated.</p>
          <div class="state-actions">
            <button class="btn btn-primary" type="button" onclick="retryPayment()">Try Again</button>
            <button class="btn btn-secondary" type="button" onclick="returnToCheckout()">Change Payment Method</button>
            <button class="btn btn-text" type="button" onclick="returnToCheckout()">Return to Checkout</button>
          </div>
        </div>
      </div>`);
    document.getElementById("screen-confirm").innerHTML = '<div class="confirmation-wrap" id="confirmation-content"></div>';

    const stats = document.querySelector("#screen-cabinet .stat-para");
    if (stats) stats.id = "cabinet-stats";
    const timeline = document.querySelector("#screen-cabinet .rail");
    if (timeline) timeline.id = "cabinet-timeline";

    const settings = document.querySelector("#screen-settings .section-tight");
    settings?.insertAdjacentHTML("beforeend", `
      <section class="presenter-panel" id="presenter-panel" aria-label="Presenter controls">
        <p class="eyebrow">Presenter Mode</p>
        <p class="meta">Clear sandbox orders, purchased pieces, active Passports, Bag, shipping draft, and confirmation state.</p>
        <button class="btn btn-secondary btn-sm" type="button" onclick="resetJunkteeDemo()">Reset Demo State</button>
      </section>`);

    const form = document.getElementById("payment-form");
    form.addEventListener("input", saveShippingDraft);
    form.addEventListener("change", saveShippingDraft);
    form.addEventListener("submit", startPayment);
    restoreShippingDraft();
  }

  function renderCheckoutSummary() {
    const itemsWrap = document.getElementById("checkout-items");
    const totals = document.getElementById("checkout-totals");
    if (!itemsWrap || !totals) return;
    const quantity = cartQuantity();
    document.getElementById("checkout-piece-count").textContent = `${quantity} ${quantity === 1 ? "piece" : "pieces"}`;
    itemsWrap.innerHTML = cart.length ? cart.map((item) => `
      <div class="checkout-line">
        <div class="imgbox visual-${escapeHTML(item.id)}">${pIcon()}</div>
        <div><p class="product-name">${escapeHTML(item.name)}</p><p class="meta">Size ${escapeHTML(item.size)} · Qty ${item.quantity}</p></div>
        <p class="price">${money(priceAmount(item) * item.quantity)}</p>
      </div>`).join("") : '<p class="meta">Your Bag is empty.</p>';
    totals.innerHTML = `
      <div class="total-row"><span>Subtotal</span><span>${money(cartSubtotal())}</span></div>
      <div class="total-row"><span>Delivery</span><span>${cart.length ? money(DELIVERY) : money(0)}</span></div>
      <div class="total-row grand"><span>Total</span><span>${money(cartTotal())}</span></div>`;
    document.getElementById("payment-button-total").textContent = money(cartTotal());
    document.getElementById("payment-submit").disabled = !cart.length;
  }

  function shippingData() {
    const form = document.getElementById("payment-form");
    if (!form) return {};
    return Object.fromEntries(new FormData(form).entries());
  }

  function saveShippingDraft() {
    writeJSON(KEYS.shipping, shippingData());
  }

  function restoreShippingDraft() {
    const draft = readJSON(KEYS.shipping, {});
    const form = document.getElementById("payment-form");
    Object.entries(draft).forEach(([name, value]) => {
      if (form?.elements[name]) form.elements[name].value = value;
    });
  }

  function setCheckoutStatus(message, type = "info") {
    const status = document.getElementById("checkout-status");
    if (!status) return;
    status.textContent = message;
    status.className = `checkout-status show ${type === "error" ? "error" : ""}`;
  }

  function clearCheckoutStatus() {
    const status = document.getElementById("checkout-status");
    if (status) status.className = "checkout-status";
  }

  function setSubmitting(value) {
    submitting = value;
    const button = document.getElementById("payment-submit");
    if (!button) return;
    button.disabled = value || !cart.length;
    button.classList.toggle("btn-loading", value);
    button.setAttribute("aria-busy", String(value));
  }

  function newAttemptId() {
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return `attempt_${id}`;
  }

  async function apiFetch(path, options = {}) {
    if (!apiBase) throw new Error("PAYMENT_API_NOT_CONFIGURED");
    if (localStorage.getItem(KEYS.presenter) === "1" && params.get("payment_test") === "network") {
      throw new Error("PRESENTER_NETWORK_TEST");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${apiBase}${path}`, { ...options, signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.code || "PAYMENT_API_ERROR");
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async function startPayment(event) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    clearCheckoutStatus();
    if (!cart.length) {
      setCheckoutStatus("Your Bag is empty.", "error");
      return;
    }
    if (!form.checkValidity()) {
      form.querySelectorAll(":invalid").forEach((field) => field.setAttribute("aria-invalid", "true"));
      form.reportValidity();
      setCheckoutStatus("Complete the required shipping details before continuing.", "error");
      return;
    }
    form.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
    saveShippingDraft();
    setSubmitting(true);

    const items = apiItems();
    const signature = cartSignature(items);
    let pending = readJSON(KEYS.pending, null);
    if (!pending || pending.signature !== signature || pending.completed) {
      pending = { attemptId: newAttemptId(), signature, items, createdAt: new Date().toISOString() };
      writeJSON(KEYS.pending, pending);
    }

    if (pending.sessionUrl && pending.sessionId) {
      location.assign(pending.sessionUrl);
      return;
    }

    try {
      const response = await apiFetch("/v1/checkout-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptId: pending.attemptId,
          items,
          customerEmail: shippingData().email,
        }),
      });
      if (!String(response.sessionId || "").startsWith("cs_test_") || response.amountTotal !== cartTotal()) {
        throw new Error("CHECKOUT_RESPONSE_MISMATCH");
      }
      pending = { ...pending, sessionId: response.sessionId, sessionUrl: response.url, expiresAt: response.expiresAt };
      writeJSON(KEYS.pending, pending);
      location.assign(response.url);
    } catch {
      setSubmitting(false);
      setCheckoutStatus("We couldn’t connect to the payment service. Your Bag and shipping details are safe — please retry.", "error");
    }
  }

  function cleanPaymentURL() {
    const url = new URL(location.href);
    url.searchParams.delete("payment");
    url.searchParams.delete("session_id");
    history.replaceState({}, "", url);
  }

  function showProcessing() {
    go("processing", { replace: true });
  }

  function showPaymentError(kind) {
    const network = kind === "network";
    document.getElementById("payment-error-title").textContent = network
      ? "We couldn’t connect to the payment service."
      : "We couldn’t verify this payment.";
    document.getElementById("payment-error-copy").textContent = network
      ? "The test service may be temporarily unavailable. Your Bag and shipping details have been preserved."
      : "No successful order was created. Your Bag, selected size, and shipping details are still here.";
    go("payment-error", { replace: true });
    cleanPaymentURL();
  }

  window.returnToCheckout = function returnToCheckout() {
    cleanPaymentURL();
    go("checkout", { replace: true });
    renderCheckoutSummary();
    restoreShippingDraft();
  };

  window.retryPayment = function retryPayment() {
    window.returnToCheckout();
    document.getElementById("payment-submit")?.focus();
  };

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat("en-SA", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function estimatedDelivery(value) {
    const date = new Date(value);
    date.setDate(date.getDate() + 5);
    return formatDate(date);
  }

  function finaliseOrder(serverOrder) {
    const orders = readJSON(KEYS.orders, []);
    const shipping = readJSON(KEYS.shipping, {});
    let order = orders.find((entry) => entry.orderReference === serverOrder.orderReference);
    if (!order) {
      order = {
        orderReference: serverOrder.orderReference,
        paidAt: serverOrder.paidAt,
        currency: serverOrder.currency,
        subtotal: serverOrder.subtotal,
        delivery: serverOrder.delivery,
        amountTotal: serverOrder.amountTotal,
        items: serverOrder.items,
        customerName: shipping.fullName || "JUNKTEE Collector",
        deliveryCity: shipping.city || "—",
        estimatedDelivery: estimatedDelivery(serverOrder.paidAt),
        paymentStatus: "Verified · Stripe Test Mode",
      };
      orders.unshift(order);
      writeJSON(KEYS.orders, orders.slice(0, 20));

      const owned = readJSON(KEYS.owned, []);
      serverOrder.items.forEach((item) => {
        const ownershipId = `${serverOrder.orderReference}:${item.productId}:${item.size}`;
        if (!owned.some((piece) => piece.ownershipId === ownershipId)) {
          owned.unshift({
            ownershipId,
            orderReference: serverOrder.orderReference,
            productId: item.productId,
            name: item.name,
            size: item.size,
            quantity: item.quantity,
            passportId: item.passportId,
            purchaseDate: serverOrder.paidAt,
            activationDate: serverOrder.paidAt,
            passportStatus: "Active",
            ownershipStatus: "First owner",
            firstOwner: shipping.fullName || "JUNKTEE Collector",
            currentOwner: shipping.fullName || "JUNKTEE Collector",
            city: shipping.city || "—",
            timeline: [{ date: serverOrder.paidAt, event: "Purchased and Passport activated." }],
          });
        }
      });
      writeJSON(KEYS.owned, owned.slice(0, 40));
    }

    cart = [];
    persistBag();
    removeStored(KEYS.pending);
    localStorage.setItem(KEYS.lastConfirmation, order.orderReference);
    updateBadge();
    renderCartV03();
    renderCabinetV03();
    renderConfirmation(order);
    cleanPaymentURL();
    go("confirm", { replace: true });
  }

  async function verifySession(sessionId) {
    return apiFetch(`/v1/checkout/verify?session_id=${encodeURIComponent(sessionId)}`);
  }

  async function handlePaymentReturn() {
    const state = params.get("payment");
    if (!state) return false;
    const pending = readJSON(KEYS.pending, null);

    if (state === "cancelled") {
      cleanPaymentURL();
      go("checkout", { replace: true });
      renderCheckoutSummary();
      restoreShippingDraft();
      setCheckoutStatus("Payment cancelled. Your Bag has been preserved. No payment was taken.");
      if (pending?.sessionId) {
        verifySession(pending.sessionId).then((result) => {
          if (result.status === "failed") showPaymentError("failed");
          if (result.status === "expired") removeStored(KEYS.pending);
        }).catch(() => { /* Cancellation remains safe even if the status check is unavailable. */ });
      }
      return true;
    }

    const sessionId = params.get("session_id") || "";
    if (state !== "success" || !sessionId.startsWith("cs_test_")) {
      showPaymentError("failed");
      return true;
    }

    showProcessing();
    try {
      const result = await verifySession(sessionId);
      if (result.verified && result.status === "paid") finaliseOrder(result.order);
      else showPaymentError(result.status === "failed" ? "failed" : "unverified");
    } catch {
      showPaymentError("network");
    }
    return true;
  }

  function renderConfirmation(order) {
    const wrap = document.getElementById("confirmation-content");
    if (!wrap || !order) return;
    const item = order.items[0];
    wrap.innerHTML = `
      <button class="back-btn" type="button" onclick="leaveConfirmation('home')">← JUNKTEE</button>
      <div class="confirmation-kicker">Payment Verified</div>
      <h1 class="confirmation-title">Your piece has entered the archive.</h1>
      <p class="confirmation-lede">The order is complete. Its next life begins with you.</p>
      <section class="activated-card" aria-labelledby="passport-activated-title">
        <p class="active-label">Digital Passport Activated</p>
        <div class="confirmation-product">
          <div class="imgbox visual-${escapeHTML(item.productId)}">${pIcon()}</div>
          <div><p class="eyebrow" style="color:#8c8c8c;">${escapeHTML(order.orderReference)}</p><h2 id="passport-activated-title">${escapeHTML(item.name)}</h2><p class="meta">Size ${escapeHTML(item.size)} · Qty ${item.quantity}</p></div>
        </div>
        <div class="confirmation-data">
          <div class="datarow"><span class="k">Payment status</span><span class="v" style="color:var(--green-bright);">${escapeHTML(order.paymentStatus)}</span></div>
          <div class="datarow"><span class="k">Total</span><span class="v">${money(order.amountTotal)}</span></div>
          <div class="datarow"><span class="k">Customer</span><span class="v">${escapeHTML(order.customerName)}</span></div>
          <div class="datarow"><span class="k">Delivery city</span><span class="v">${escapeHTML(order.deliveryCity)}</span></div>
          <div class="datarow"><span class="k">Estimated delivery</span><span class="v">${escapeHTML(order.estimatedDelivery)}</span></div>
          <div class="datarow"><span class="k">Passport ID</span><span class="v">${escapeHTML(item.passportId)}</span></div>
          <div class="datarow"><span class="k">Activation date</span><span class="v">${escapeHTML(formatDate(order.paidAt))}</span></div>
        </div>
        <div class="confirmation-actions">
          <button class="btn btn-primary" style="background:#fff;color:#0a0a0a;" type="button" onclick="openConfirmationPassport('${escapeHTML(item.productId)}')">Open Passport</button>
          <button class="btn btn-secondary" type="button" onclick="leaveConfirmation('cabinet')">View My Cabinet</button>
          <button class="btn btn-text" style="color:#fff;justify-self:center;" type="button" onclick="leaveConfirmation('collection')">Continue Exploring</button>
        </div>
      </section>`;
  }

  window.leaveConfirmation = function leaveConfirmation(destination) {
    removeStored(KEYS.lastConfirmation);
    go(destination, { replace: true });
  };

  window.openConfirmationPassport = function openConfirmationPassport(productId) {
    removeStored(KEYS.lastConfirmation);
    openOwnedPassport(productId);
  };

  function ownedPieces() {
    return readJSON(KEYS.owned, []);
  }

  function renderCabinetV03() {
    const basePieces = CABINET.map((piece) => ({ ...piece, base: true }));
    const purchased = ownedPieces();
    const allPieces = [...purchased, ...basePieces];
    const grid = document.getElementById("cabinet-grid");
    if (!grid) return;
    grid.innerHTML = allPieces.map((piece) => piece.base ? `
      <div class="card" style="border:none;" onclick="openProduct('${escapeHTML(piece.id)}')">
        <div class="imgbox visual-${escapeHTML(piece.id)} editorial-reveal in-view">${pIcon()}</div>
        <span class="passport-meta">V · Verified</span><p class="name" style="margin-top:8px;font-size:13px;font-weight:600;">${escapeHTML(piece.name)}</p>
      </div>` : `
      <div class="card" style="border:none;" onclick="openOwnedPassport('${escapeHTML(piece.productId)}')">
        <div class="imgbox visual-${escapeHTML(piece.productId)} editorial-reveal in-view">${pIcon()}</div>
        <span class="passport-meta passport-active">Active Passport</span><p class="name" style="margin-top:8px;font-size:13px;font-weight:600;">${escapeHTML(piece.name)}</p>
        <div class="cabinet-owned-meta"><span>${escapeHTML(formatDate(piece.purchaseDate))}</span><span>${escapeHTML(piece.ownershipStatus)} · ${escapeHTML(piece.passportId)}</span></div>
      </div>`).join("");

    const total = allPieces.length;
    const stats = document.getElementById("cabinet-stats");
    if (stats) stats.innerHTML = `<span class="n">${total}</span> pieces, all with active passports. <span class="n">${purchased.length || 1}</span> recent archive ${purchased.length === 1 ? "entry" : "entries"}. <span class="n">0</span> repairs completed. <span class="n">${total}</span> pieces still with their first owner.`;

    const timeline = document.getElementById("cabinet-timeline");
    if (timeline) timeline.innerHTML = `
      ${purchased.map((piece) => `<div class="rail-item"><p class="meta mono" style="color:var(--green);">${escapeHTML(formatDate(piece.activationDate).toUpperCase())}</p><p class="body" style="margin-top:2px;">Purchased and Passport activated — ${escapeHTML(piece.name)}</p></div>`).join("")}
      <div class="rail-item"><p class="meta mono" style="color:var(--green);">MAR 2025</p><p class="body" style="margin-top:2px;">First piece activated — Recycle Tee</p></div>
      <div class="rail-item"><p class="meta mono" style="color:var(--green);">JUL 2025</p><p class="body" style="margin-top:2px;">First scan of the season</p></div>
      <p class="rail-continue">This story continues.</p>`;
  }

  window.openOwnedPassport = function openOwnedPassport(productId) {
    const piece = ownedPieces().find((item) => item.productId === productId);
    if (!piece) {
      baseOpenPassport();
      return;
    }
    const product = productById(piece.productId);
    const pages = [
      { title: "Identity", body: `<div class="seal">JUNKTEE<br>SEAL</div><p class="pid">${escapeHTML(piece.passportId)}</p><p class="pcollection">${escapeHTML(piece.name)} · Owned piece</p><div class="verified-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>Active · Verified</div>` },
      { title: "Piece", body: `<p class="pp-para">${escapeHTML(product?.story || "A JUNKTEE piece with a story built to continue.")}</p><p class="pquote">“Only dead fish go with the flow.”</p>` },
      { title: "Purchase Record", body: `<div class="datarow"><span class="k">Order reference</span><span class="v">${escapeHTML(piece.orderReference)}</span></div><div class="datarow"><span class="k">Purchase status</span><span class="v">Verified</span></div><div class="datarow"><span class="k">Activation date</span><span class="v">${escapeHTML(formatDate(piece.activationDate))}</span></div><div class="datarow"><span class="k">Size</span><span class="v">${escapeHTML(piece.size)}</span></div>` },
      { title: "Ownership", body: `<div class="datarow"><span class="k">First owner</span><span class="v">${escapeHTML(piece.firstOwner)}</span></div><div class="datarow"><span class="k">Current owner</span><span class="v">${escapeHTML(piece.currentOwner)}</span></div><div class="datarow"><span class="k">Ownership status</span><span class="v">${escapeHTML(piece.ownershipStatus)}</span></div><div class="datarow"><span class="k">Product ID</span><span class="v">${escapeHTML(piece.productId.toUpperCase())}</span></div>` },
      { title: "Materials & Origin", body: `<div class="datarow"><span class="k">Material</span><span class="v">${escapeHTML(product?.material || "JUNKTEE material")}</span></div><div class="datarow"><span class="k">Country of Origin</span><span class="v">Saudi Arabia</span></div><p class="pp-para" style="margin-top:18px;">Material impact statements remain qualified until supplier verification is complete.</p>` },
      { title: "Ownership Timeline", body: `<div class="rail"><div class="rail-item"><p class="rt-date">${escapeHTML(formatDate(piece.activationDate).toUpperCase())}</p><p class="rt-desc">Purchased and Passport activated. · First owner · ${escapeHTML(piece.city)}</p></div><p class="rail-continue">This story continues.</p></div>` },
      { title: "Repair & Care", body: `<p class="pp-para">Nothing to repair yet. We’ll be here when this piece needs care.</p><div class="divider" style="background:#222;"></div><p class="eyebrow" style="margin-top:16px;">Care</p><p class="pp-para">Wash cold. Hang dry. Outlive the hype cycle.</p>` },
      { title: "Authentication", body: `<p class="pid" style="font-size:28px;margin-top:40px;">${escapeHTML(piece.passportId)}</p><p class="pp-para" style="text-align:center;margin-top:24px;">One piece. One identity. Activated only after the sandbox payment was verified server-side.</p>` },
    ];
    const wrap = document.getElementById("passport-pages");
    wrap.innerHTML = pages.map((page, index) => `<div class="ppage ${index === 0 ? "active" : ""}" data-i="${index}"><p class="ppage-title">${page.title}</p>${page.body}</div>`).join("");
    document.getElementById("pp-dots").innerHTML = pages.map((_, index) => `<div class="dot ${index === 0 ? "active" : ""}"></div>`).join("");
    ppIndex = 0;
    document.getElementById("pp-indicator").textContent = `1 / ${pages.length}`;
    document.getElementById("passport-modal").classList.add("active");
  };

  window.openPassport = function openPassportV03() {
    const latest = ownedPieces()[0];
    if (latest) window.openOwnedPassport(latest.productId);
    else baseOpenPassport();
  };

  function configurePresenterMode() {
    if (params.get("presenter") === "1") localStorage.setItem(KEYS.presenter, "1");
    if (params.get("presenter") === "0") removeStored(KEYS.presenter);
    document.getElementById("presenter-panel")?.classList.toggle("show", localStorage.getItem(KEYS.presenter) === "1");
  }

  window.resetJunkteeDemo = function resetJunkteeDemo() {
    if (!confirm("Reset the JUNKTEE sandbox demo on this browser?")) return;
    [KEYS.bag, KEYS.shipping, KEYS.pending, KEYS.orders, KEYS.owned, KEYS.lastConfirmation].forEach(removeStored);
    cart = [];
    updateBadge();
    renderCartV03();
    renderCabinetV03();
    document.getElementById("payment-form")?.reset();
    configureSizes(currentProduct);
    cleanPaymentURL();
    toast("Demo state reset");
    go("home", { replace: true });
  };

  function restoreConfirmation() {
    const reference = localStorage.getItem(KEYS.lastConfirmation);
    const order = readJSON(KEYS.orders, []).find((entry) => entry.orderReference === reference);
    if (!order) return false;
    renderConfirmation(order);
    go("confirm", { replace: true });
    return true;
  }

  async function initialise() {
    cart = cleanBag(readJSON(KEYS.bag, []));
    installPaymentScreens();
    configurePresenterMode();
    updateBadge();
    renderCartV03();
    renderCabinetV03();
    if (await handlePaymentReturn()) return;
    restoreConfirmation();
  }

  initialise();
})();
