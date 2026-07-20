# JUNKTEE v0.3 — Sandbox Checkout Prototype

Public presentation prototype for JUNKTEE’s luxury digital garment experience, now with an Excel-driven product catalog, Stripe-hosted Checkout in Test Mode, secure server-side Session verification, Digital Passport activation, and automatic Collector Cabinet updates.

Live frontend: [ahimyary-jpg.github.io/junktee-prototype](https://ahimyary-jpg.github.io/junktee-prototype/)

Live backend: [junktee-sandbox-payments.ahimyary.workers.dev](https://junktee-sandbox-payments.ahimyary.workers.dev/health)

## Architecture

- GitHub Pages serves this static frontend.
- A minimal Cloudflare Worker validates server-owned SAR prices, creates Stripe Test Mode Checkout Sessions, and verifies returned Sessions.
- Stripe hosts all payment fields.
- The browser stores only non-sensitive demo shipping, order, Passport, and Cabinet state in `localStorage`.
- There is no D1 database or production order system.

An order is created in the presentation only after the Worker confirms that the Stripe Session is paid, complete, test mode, and matches the expected server total.

## Environment-variable names

- `STRIPE_SECRET_KEY`
- `FRONTEND_URL`
- `ALLOWED_ORIGIN`

Secret values must be stored only in Cloudflare’s encrypted Worker secrets. Never add them to this repository.

## Run locally

Serve this directory over HTTP:

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173`. Local end-to-end payment testing also requires the Worker’s return URL and CORS origin to match localhost.

## Update products from Excel

The authoritative workbook is `../catalog/JUNKTEE_Product_Catalog.xlsx`. Edit product rows, embedded product images, and optional details there, then run from the repository root:

```sh
python3 -m pip install --requirement requirements-catalog.txt
npm run catalog:build
```

This regenerates `data/products.json`, `data/products.generated.js`, optimized WebP files under `assets/products/`, and the Worker’s server-owned catalog. The embedded workbook images remain the untouched source assets. Do not edit generated files directly. Pushing a workbook change to `main` also triggers the catalog GitHub Action. Invalid or duplicate SKUs and invalid prices fail the build, leaving the last valid live catalog intact; missing optional fields are hidden gracefully.

## Update the live frontend

1. Update `index.html`, `junktee-v03.css`, and `junktee-v03.js` on `main`.
2. Keep the public Worker URL in the `junktee-payment-api` meta tag in `index.html`.
3. GitHub Pages republishes the branch automatically.
4. Verify Bag totals, Checkout, cancellation, payment return, Passport activation, Cabinet update, refresh persistence, and presenter reset on the public HTTPS URL.

## Official Stripe test data

See [Stripe’s testing documentation](https://docs.stripe.com/testing).

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`
- Expiry: any future date
- CVC: any three digits

Never enter a real card. No real money can be charged by this prototype.

## Payment-state checks

- Success activates the purchased Passport and adds the piece to the Cabinet.
- Decline creates no order and preserves the Bag.
- Stripe’s JUNKTEE/back control returns to the preserved Checkout with a cancellation message.
- `?presenter=1&payment_test=network` simulates a recoverable network failure.
- Duplicate submission is blocked in the browser and with a Stripe idempotency key.
- Refreshing after success preserves the confirmation without duplicating the order.

## Presenter reset

Open `?presenter=1`, then use Cabinet → Settings → **Reset Demo State**. Use `?presenter=0` to hide the control.

## Security and limitations

The public frontend contains no secret keys and stores no card data, CVV, payment methods, authentication secrets, webhook secrets, or full gateway responses. The Worker rejects live keys and live-mode transactions.

This is a stateless presentation integration. It intentionally has no database or webhook fulfillment. A production system must add durable orders, idempotent webhooks, accounts, fulfillment, monitoring, and operational controls.
