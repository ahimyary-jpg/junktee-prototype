# JUNKTEE v0.3 — Sandbox Checkout Prototype

JUNKTEE v0.3 is a presentation-ready luxury fashion prototype with a real Stripe Test Mode journey and an Excel-driven product catalog. It preserves the v0.2 Home, Collection, Product, Bag, Journal, Digital Passport, Collector Cabinet, Scan, and Settings experiences while adding a secure hosted sandbox checkout.

No real money can be charged. Card details are entered only on Stripe-hosted Checkout and are never seen or stored by JUNKTEE.

## Architecture

1. The static frontend is hosted on GitHub Pages.
2. The browser sends only product IDs, sizes, quantities, an attempt ID, and an optional email address to a small Cloudflare Worker.
3. The Worker validates every product against its server-owned SAR catalog and creates a Stripe Test Mode Checkout Session.
4. Stripe hosts the card-entry page and returns the customer to JUNKTEE.
5. JUNKTEE asks the Worker to retrieve and verify the returned Checkout Session. A redirect query alone never creates an order.
6. Only after the Worker confirms a paid, complete, test-mode Session with the expected total does the browser activate the Digital Passport and add the piece to the Collector Cabinet.
7. Non-sensitive presentation state is kept in browser `localStorage`. There is no order database or D1 dependency.
8. `catalog/JUNKTEE_Product_Catalog.xlsx` is the product source of truth. A deterministic build creates the browser catalog, extracts its product images, and creates the Worker’s trusted price-and-size catalog.

The Worker uses Stripe’s idempotency support for duplicate session requests. The browser also locks the submit button and reuses a pending session for the same Bag.

## Project surfaces

- `github-pages/` — public static frontend source
- `catalog/JUNKTEE_Product_Catalog.xlsx` — authoritative product workbook
- `scripts/build_catalog.py` — dependency-free Excel-to-web conversion
- `payment-worker/` — minimal Cloudflare Worker
- `deliverables/` — local prototype package
- `tests/sandbox-checkout.test.mjs` — public frontend and security assertions
- `payment-worker/test/worker.test.mjs` — server validation and verification tests
- `tests/catalog-pipeline.test.mjs` — catalog/image/server consistency checks

## Product catalog workflow

Edit only `catalog/JUNKTEE_Product_Catalog.xlsx` when changing products. The `Products` sheet controls the Collection, product detail content, images, sizes, availability, and SAR prices. The `Optional Details` sheet adds material, care, origin, and Passport metadata by matching the same SKU.

Required fields for a publishable row are `SKU`, `Product Name`, and a positive `Price (SAR)`. SKUs must be unique. Blank size cells become `ONE SIZE`; missing optional details are hidden or shown as pending without breaking the site. Set `Available (Yes/No)` to `No` to exclude a product from the public storefront and Worker checkout catalog.

Images can remain embedded in the Excel image cells. The converter extracts them and assigns stable SKU/role paths such as `assets/products/st23a451/front.png`. A cell may instead contain a filename stored under `catalog/images/`.

Run the conversion locally after editing the workbook:

```sh
npm run catalog:build
```

Do not hand-edit these generated outputs:

- `github-pages/data/products.json`
- `github-pages/data/products.generated.js`
- `github-pages/assets/products/`
- `payment-worker/src/catalog.generated.js`

The `Build product catalog` GitHub Action runs on workbook changes, regenerates the files, mirrors public catalog assets to the GitHub Pages repository root, and commits the generated result. A validation error stops the workflow before the existing live catalog is replaced.

## Environment variables

Configure these names in Cloudflare. Do not commit their values.

- `STRIPE_SECRET_KEY` — encrypted Worker secret; must be a Stripe test or restricted-test secret key
- `FRONTEND_URL` — exact GitHub Pages prototype URL used for Stripe return URLs
- `ALLOWED_ORIGIN` — exact frontend origin permitted by CORS

The Worker rejects live key prefixes, non-test Checkout Session IDs, and Stripe responses with `livemode: true`.

## Local setup

Use Node.js 22 or newer.

Frontend:

```sh
cd github-pages
python3 -m http.server 4173
```

Then open `http://localhost:4173`. For local end-to-end payment testing, temporarily use matching localhost values for `FRONTEND_URL` and `ALLOWED_ORIGIN` in a local Worker environment.

Worker:

```sh
cd payment-worker
cp .dev.vars.example .dev.vars
npm run dev
```

Add the three environment-variable values to `.dev.vars`. That file is ignored by the repository and must never be committed.

Run the automated checks from the repository root:

```sh
npm run catalog:build
node --test tests/*.test.mjs payment-worker/test/*.test.mjs
```

## Deployment

### Frontend — GitHub Pages

The live frontend is served from the `main` branch of the existing `junktee-prototype` repository. Replace the files at the repository root with the contents of `github-pages/`; GitHub Pages republishes automatically. The catalog workflow keeps root `data/` and `assets/products/` synchronized after future workbook-only updates.

The payment Worker URL is a safe public value. Set it in the `junktee-payment-api` meta tag in `github-pages/index.html` before publishing.

Live backend: `https://junktee-sandbox-payments.ahimyary.workers.dev`

### Backend — Cloudflare Worker

```sh
cd payment-worker
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler deploy
```

`FRONTEND_URL` and `ALLOWED_ORIGIN` are non-secret deployment variables. `STRIPE_SECRET_KEY` must be entered only through Cloudflare’s encrypted secret control or `wrangler secret put`.

Catalog changes also update `payment-worker/src/catalog.generated.js`. Cloudflare’s Git deployment should redeploy the Worker automatically; otherwise deploy it manually so the server-owned prices remain synchronized. After deployment, verify the health response:

```sh
curl https://junktee-sandbox-payments.ahimyary.workers.dev/health
```

It must report Stripe `test` mode before the frontend is connected.

## Official Stripe test payments

Use Stripe’s official test data only. See [Stripe’s testing documentation](https://docs.stripe.com/testing).

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure authentication: `4000 0025 0000 3155`
- Expiry: any future month and year
- CVC: any three digits
- Other form fields: any syntactically valid test values

Never enter a real card. The hosted page should visibly indicate Stripe Test Mode.

## Payment states

- **Success:** use the success card, complete Stripe Checkout, and wait for the branded verification and Passport activation.
- **Decline:** use the decline card. Stripe keeps the customer on the hosted page and displays the test decline. Returning to JUNKTEE does not create an order.
- **3D Secure:** use the authentication card and complete Stripe’s test challenge.
- **Cancellation:** use Stripe Checkout’s JUNKTEE/back control. The Bag, selected size, quantity, and shipping draft remain intact, and JUNKTEE states that no payment was taken.
- **Network failure:** open the frontend with `?presenter=1&payment_test=network`, then submit Checkout. The frontend displays the recoverable connection state and creates no order.
- **Duplicate click:** rapidly activate the payment button. It disables immediately, while the Worker uses the attempt ID as Stripe’s idempotency key.
- **Refresh after success:** reload the confirmation. The verified demo order, active Passport, and Cabinet entry persist without duplication.

## Presenter reset

1. Open the prototype with `?presenter=1` once.
2. Open Cabinet → Settings.
3. Use **Reset Demo State** in the discreet Presenter Mode section.

The reset clears demo orders, purchased items, active purchased Passports, the Bag, shipping draft, pending payment, and confirmation state, while restoring the original Cabinet. Use `?presenter=0` to hide Presenter Mode again.

## Security notes

- Stripe runs only in Test Mode; the Worker refuses live mode.
- No card number, CVC, payment method, authentication secret, webhook secret, or full gateway response is stored in the browser.
- No Stripe secret is present in HTML, CSS, JavaScript, repository configuration, documentation, `localStorage`, or `sessionStorage`.
- Prices, delivery, currency, product IDs, sizes, and quantities are validated by the Worker.
- The Worker returns only safe order fields needed for the presentation.
- CORS is limited to the approved JUNKTEE frontend origin.

## Known prototype limitations

- There is no database, account system, fulfillment system, or production order ledger.
- Verification occurs when the customer returns from Stripe. If the browser is closed after a successful test payment, that device’s local Passport and Cabinet state will not update until the return URL is opened again.
- Webhooks are intentionally omitted to keep this presentation build stateless. A production launch must add durable, idempotent webhook fulfillment and an order database.
- Browser storage is device-local and can be cleared by the user.
- GitHub Pages is static hosting; all payment and verification logic lives in the separate Worker and Stripe-hosted Checkout.

This repository must never be configured with live Stripe credentials.
