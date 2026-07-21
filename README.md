# JUNKTEE — Independent Fashion Platform Prototype

JUNKTEE is a curated umbrella platform for selected independent fashion labels. JUNKTEE remains the founding brand and visual anchor; RMAYD is the second confirmed brand and uses its supplied official logo, secondary mark, Instagram QR identity, and approved product catalog throughout the experience. The experience includes a multi-brand Home, Shop, Brands directory, reusable brand pages, Collections, Journal, Bag, Stripe Test Mode checkout, a personal Cabinet, and Settings. JUNKTEE’s differentiator is how it discovers, introduces, presents, and celebrates each selected brand—not simply how it lists products.

No real money can be charged. Card details are entered only on Stripe-hosted Checkout and are never seen or stored by JUNKTEE.

## Current product scope

The retired identity and verification feature has been removed from the product. It is not part of navigation, product detail, checkout, confirmation, Cabinet, brand pages, Journal, search, onboarding, tests, configuration, or documentation. Legacy identity links are handled as safe redirects to an active destination; no credential, badge, serial number, ownership record, or activation state is created. The Cabinet remains as a simpler personal collection for saved or purchased demo pieces and does not depend on identity infrastructure.

## Architecture

1. The static frontend is hosted on GitHub Pages.
2. The browser sends only product IDs, sizes, quantities, an attempt ID, and an optional email address to a small Cloudflare Worker.
3. The Worker validates every product against its server-owned SAR catalog and creates a Stripe Test Mode Checkout Session.
4. Stripe hosts the card-entry page and returns the customer to JUNKTEE.
5. JUNKTEE asks the Worker to retrieve and verify the returned Checkout Session. A redirect query alone never creates an order.
6. Only after the Worker confirms a paid, complete, test-mode Session with the expected total does the browser create the demo order and add the purchased item to the personal Cabinet.
7. Non-sensitive presentation state is kept in browser `localStorage`. There is no order database or D1 dependency.
8. `catalog/JUNKTEE_Product_Catalog.xlsx` and `catalog/RMAYD_Product_Catalog.xlsx` are the product source-of-truth workbooks for their respective brands. Deterministic builds create separate browser catalogs, extract product images, and create the Worker’s trusted price-and-size catalogs without mixing brand records.
9. `data/marketplace.generated.js` contains platform presentation structure, RMAYD’s official identity references, approved/placeholder editorial entries, and configurable navigation. It is not a commerce catalog and cannot override Excel prices or Worker validation.

The Worker uses Stripe’s idempotency support for duplicate session requests. The browser also locks the submit button and reuses a pending session for the same Bag.

## Project surfaces

- `github-pages/` — public static frontend source
- `data/marketplace.generated.js` — non-commercial brand and presentation structure
- `marketplace.css` / `marketplace.js` — responsive multi-brand marketplace layer
- `assets/brands/rmayd/originals/` — untouched official RMAYD source assets
- `assets/brands/rmayd/` — responsive WebP logo, mark, and Instagram derivatives
- `scripts/build_rmayd_assets.py` — deterministic RMAYD crop, resize, optimization, and mirror step
- `catalog/JUNKTEE_Product_Catalog.xlsx` — authoritative product workbook
- `scripts/build_catalog.py` — Excel-to-web conversion and deterministic WebP optimization
- `catalog/RMAYD_Product_Catalog.xlsx` — authoritative RMAYD product workbook
- `scripts/build_rmayd_catalog.py` — RMAYD catalog conversion and deterministic WebP optimization
- `requirements-catalog.txt` — pinned image-build dependency
- `payment-worker/` — minimal Cloudflare Worker
- `deliverables/` — local prototype package
- `tests/sandbox-checkout.test.mjs` — public frontend and security assertions
- `payment-worker/test/worker.test.mjs` — server validation and verification tests
- `tests/catalog-pipeline.test.mjs` — catalog/image/server consistency checks
- `tests/marketplace.test.mjs` — brand model, filters, marketplace surfaces, and placeholder-commerce safeguards

## Product catalog workflow

Edit only the relevant brand workbook when changing products: `catalog/JUNKTEE_Product_Catalog.xlsx` for JUNKTEE or `catalog/RMAYD_Product_Catalog.xlsx` for RMAYD. The `Products` sheet controls the Collection, product detail content, images, sizes, availability, and SAR prices. The `Optional Details` sheet adds material, care, and origin by matching the same SKU. Deprecated identity columns are ignored and never rendered or used by the storefront.

Required fields for a publishable row are `SKU`, `Product Name`, and a positive `Price (SAR)`. SKUs must be unique. Blank size cells become `ONE SIZE`; missing optional details are hidden without breaking the site. Set `Available (Yes/No)` to `No` to exclude a product from the public storefront and Worker checkout catalog.

`Brand` is an optional Products-sheet column. When it is absent or blank, the converter safely assigns `JUNKTEE`, preserving compatibility with the current workbook. When a future row contains an approved brand name such as `RMAYD`, the generated storefront and Worker catalog receive its normalized `brandId` and display `brandName` automatically. Product name, description, price, availability, sizes, imagery, material, care, and origin must still come from the workbook.

## Platform behavior versus brand behavior

- **Platform-owned:** marketplace navigation, Brands directory, cross-brand Shop filters, Collections, Journal aggregation, Bag, checkout shell, Cabinet, and account/settings surfaces.
- **Brand-owned:** brand name, story, visual treatment, products, collections, product claims, imagery, price, inventory, and origin.
- **JUNKTEE:** founding brand; its existing Excel products are authoritative and remain fully purchasable in Stripe Test Mode.
- **RMAYD:** official identity and approved catalog are active. The imported workbook supplies the product names, prices, availability, sizes, descriptions, and embedded photography. The former “Collection arriving soon” entries remain as a safe fallback only when the RMAYD catalog is unavailable and are automatically suppressed when catalog rows are present.

## Onboarding a new brand

1. Obtain owner-approved brand name, short description, story, and visual assets.
2. Add the brand record to `data/marketplace.generated.js` and its mirrored `github-pages/data/marketplace.generated.js`.
3. Add a `Brand` column to the Excel Products sheet if it is not present (the RMAYD build assigns `RMAYD` automatically).
4. Add approved product rows using the exact brand name, with real prices, sizes, availability, descriptions, and image cells or filenames.
5. Add matching Optional Details rows for material, care, and origin where available.
6. Run the matching build (`npm run catalog:build` for JUNKTEE or `python3 scripts/build_rmayd_catalog.py` for RMAYD); review the generated JSON and WebP assets.
7. Add or update the brand’s visual treatment in `marketplace.css`. Do not place commerce facts in CSS or JavaScript.
8. Run the complete automated and responsive test pass before deployment.

The RMAYD workbook is now the authoritative source for RMAYD commerce. The generated frontend automatically suppresses the matching `RMAYD-DEMO-*` fallback entries when approved RMAYD rows are present. Future RMAYD product updates require editing only `catalog/RMAYD_Product_Catalog.xlsx` and rerunning `python3 scripts/build_rmayd_catalog.py`.

## Brand configuration and RMAYD identity assets

`data/marketplace.generated.js` is the central presentation configuration. Change `platform.navigation`, `platform.homeSections`, and `platform.featuredBrandIds` to reorder or hide navigation and homepage modules; update a brand record to add only approved descriptions, sections, links, and imagery. Journal entries carry a `brandId` (or `platform`) so editorial stories can be related to a selected label without inventing product claims. Keep commerce facts in the Excel workbook and keep incomplete brand sections omitted rather than filling them with made-up copy.

The Cabinet is intentionally independent of any identity or ownership credential. It is a device-local personal collection for saved/purchased demo pieces; payment confirmation may add an item, but no credential is issued, displayed, or required.

RMAYD’s approved product catalog is now imported from `catalog/RMAYD_Product_Catalog.xlsx`. Product names, SAR prices, sizes, availability, descriptions, and embedded photography come from that workbook. The workbook’s optional details sheet is currently blank, so material, care, origin, founder story, sustainability claims, and other unapproved editorial facts remain intentionally undisclosed.

The three supplied originals are preserved unchanged under `assets/brands/rmayd/originals/`. The public site loads responsive WebP derivatives so the primary logo, secondary mark, and Instagram QR remain sharp without downloading the 4500-pixel source canvases.

Rebuild the responsive assets after replacing an official source file:

```sh
python3 scripts/build_rmayd_assets.py
```

The script crops only the surrounding canvas in generated derivatives, creates multiple responsive widths, mirrors them into `github-pages/`, and verifies that every copied original remains byte-identical.

Images can remain embedded in the Excel image cells. The converter reads each original directly from the workbook, preserves that workbook as the source asset, and generates a quality-controlled WebP derivative at a stable SKU/role path such as `assets/products/st23a451/front.webp`. It never recompresses a previously generated image. A cell may instead contain a filename stored under `catalog/images/`.

Run the conversion locally after editing the workbook:

```sh
python3 -m pip install --requirement requirements-catalog.txt
npm run catalog:build
```

The generated storefront uses one neutral studio-frame system with a fixed 4:5 aspect ratio and `object-fit: contain` across Home, Collection, product galleries, Bag, Checkout, Cabinet, and confirmation. Original white backgrounds are therefore treated as intentional photography sheets rather than pasted rectangles. The Home hero uses real front and back imagery from the first available catalog product; it does not use generated garments or stock photography.

Do not hand-edit these generated outputs:

- `github-pages/data/products.json` and `github-pages/data/products.generated.js`
- `github-pages/data/rmayd.products.json` and `github-pages/data/rmayd.products.generated.js`
- `github-pages/assets/products/`
- `github-pages/assets/products-rmayd/`
- `payment-worker/src/catalog.generated.js`
- `payment-worker/src/rmayd-catalog.generated.js`

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

- **Success:** use the success card, complete Stripe Checkout, and wait for branded payment verification and the Cabinet update.
- **Decline:** use the decline card. Stripe keeps the customer on the hosted page and displays the test decline. Returning to JUNKTEE does not create an order.
- **3D Secure:** use the authentication card and complete Stripe’s test challenge.
- **Cancellation:** use Stripe Checkout’s JUNKTEE/back control. The Bag, selected size, quantity, and shipping draft remain intact, and JUNKTEE states that no payment was taken.
- **Network failure:** open the frontend with `?presenter=1&payment_test=network`, then submit Checkout. The frontend displays the recoverable connection state and creates no order.
- **Duplicate click:** rapidly activate the payment button. It disables immediately, while the Worker uses the attempt ID as Stripe’s idempotency key.
- **Refresh after success:** reload the confirmation. The verified demo order and Cabinet entry persist without duplication.

## Presenter reset

1. Open the prototype with `?presenter=1` once.
2. Open Cabinet → Settings.
3. Use **Reset Demo State** in the discreet Presenter Mode section.

The reset clears demo orders, purchased items, the Bag, shipping draft, pending payment, and confirmation state, while restoring the original Cabinet. Use `?presenter=0` to hide Presenter Mode again.

## Security notes

- Stripe runs only in Test Mode; the Worker refuses live mode.
- No card number, CVC, payment method, authentication secret, webhook secret, or full gateway response is stored in the browser.
- No Stripe secret is present in HTML, CSS, JavaScript, repository configuration, documentation, `localStorage`, or `sessionStorage`.
- Prices, delivery, currency, product IDs, sizes, and quantities are validated by the Worker.
- The Worker returns only safe order fields needed for the presentation.
- CORS is limited to the approved JUNKTEE frontend origin.

## Known prototype limitations

- There is no database, account system, fulfillment system, or production order ledger.
- Verification occurs when the customer returns from Stripe. If the browser is closed after a successful test payment, that device’s local Cabinet state will not update until the return URL is opened again.
- Webhooks are intentionally omitted to keep this presentation build stateless. A production launch must add durable, idempotent webhook fulfillment and an order database.
- Browser storage is device-local and can be cleared by the user.
- GitHub Pages is static hosting; all payment and verification logic lives in the separate Worker and Stripe-hosted Checkout.
- RMAYD’s 11 approved catalog rows are live in Collection, brand pages, product detail, Bag, and sandbox checkout. Optional material/care/origin fields remain empty until they are supplied in the workbook; no unsupported claims are invented.
- Cross-brand fulfillment, tax allocation, brand payouts, inventory reservation, account sync, durable order storage, and account synchronization require production backend decisions and are outside this static presentation build.

This repository must never be configured with live Stripe credentials.
