/* JUNKTEE v0.5 — multi-brand marketplace experience */
(() => {
  "use strict";

  const brands = Array.isArray(MARKETPLACE.brands) ? MARKETPLACE.brands : [];
  const collections = Array.isArray(MARKETPLACE.collections) ? MARKETPLACE.collections : [];
  const marketplaceJournal = Array.isArray(MARKETPLACE.journal) ? MARKETPLACE.journal : [];
  const officialProducts = PRODUCTS.filter((product) => !product.demo);
  const state = { brand: "all", category: "all", collection: "all", passport: "all" };
  const baseGo = window.go;
  const baseOpenProduct = window.openProduct;

  function e(value) { return escapeCatalogHTML(value); }
  function brandById(id) { return brands.find((brand) => brand.id === id) || brands[0]; }
  function productBrand(product) { return product?.brandName || brandById(product?.brandId)?.name || "JUNKTEE"; }
  function passportLabel(product) { return product.passportEligible === false ? "Catalog forthcoming" : "Passport available"; }

  function productCard(product, compact = false) {
    return `<article class="card product-card marketplace-product ${product.demo ? "is-preview" : ""}" style="width:auto;border:none" data-brand="${e(product.brandId || "junktee")}" data-product="${e(product.id)}" onclick="openProduct('${e(product.id)}')">
      <div class="imgbox catalog-product editorial-reveal in-view">${productImageHTML(product)}</div>
      ${brandLinkHTML(product, { compact })}
      <span class="passport-meta">${e(passportLabel(product))}</span>
      <p class="name" style="margin-top:${compact ? 5 : 8}px;font-size:${compact ? 12 : 14}px;font-weight:600">${e(product.name)}</p>
      <p class="meta">${e(product.price || "Price pending")}</p>
    </article>`;
  }

  function ensureShell() {
    const app = document.getElementById("app");
    app.insertAdjacentHTML("afterbegin", `
      <header class="desktop-marketplace-header" aria-label="Primary navigation">
        <button class="platform-mark" type="button" onclick="go('home')">JUNKTEE</button>
        <nav>
          <button type="button" onclick="openCollection('new-in')">New In</button>
          <button type="button" onclick="go('collection')">Shop</button>
          <button type="button" onclick="go('brands')">Brands</button>
          <button type="button" onclick="go('collections')">Collections</button>
          <button type="button" onclick="go('journal')">Journal</button>
          <button type="button" onclick="openPassport()">Passport</button>
          <button type="button" onclick="go('cabinet')">Cabinet</button>
        </nav>
        <div class="desktop-actions"><button type="button" onclick="go('settings')" aria-label="Account settings">Account</button><button type="button" onclick="go('cart')">Bag <span id="desktop-cart-count">0</span></button></div>
      </header>`);

    document.getElementById("screen-collection").insertAdjacentHTML("beforebegin", `
      <div class="screen" id="screen-brands">
        <header class="marketplace-screen-intro"><p class="eyebrow">Platform Directory</p><h1 class="display">Brands</h1><p class="market-copy">Independent labels presented with their own point of view, connected by one marketplace and one Passport system.</p></header>
        <div class="brands-directory" id="brands-directory"></div>
      </div>
      <div class="screen" id="screen-brand"><div id="brand-page"></div></div>
      <div class="screen" id="screen-collections">
        <header class="marketplace-screen-intro"><p class="eyebrow">Curated across labels</p><h1 class="display">Collections</h1><p class="market-copy">Brand-led drops and cross-brand edits, with preview concepts clearly separated from approved catalog data.</p></header>
        <div class="collections-grid" id="collections-grid"></div>
      </div>`);

    const hero = document.querySelector("#screen-home .hero");
    hero.insertAdjacentHTML("afterend", '<div class="marketplace-home" id="marketplace-home"></div>');
    document.getElementById("bottomnav").insertAdjacentHTML("beforebegin", `
      <aside class="menu-sheet" id="marketplace-menu" aria-hidden="true">
        <div class="menu-sheet-top"><span class="wordmark">JUNKTEE</span><button class="icon-btn" type="button" onclick="toggleMarketplaceMenu(false)" aria-label="Close menu">✕</button></div>
        <nav><button type="button" onclick="menuGo('collections')">Collections</button><button type="button" onclick="menuGo('journal')">Journal</button><button type="button" onclick="menuPassport()">Digital Passport</button><button type="button" onclick="menuGo('settings')">Settings</button><button type="button" onclick="menuGo('cart')">Bag</button></nav>
      </aside>`);

    const productDetails = document.querySelector("#screen-product .section-tight");
    productDetails.insertAdjacentHTML("afterbegin", '<div class="product-brand-context"><button class="brand-link" id="pd-brand-link" type="button">JUNKTEE</button></div>');
    document.getElementById("add-to-bag").insertAdjacentHTML("afterend", '<p class="preview-commerce-note">The official RMAYD product catalog has not yet been imported.</p>');
    document.getElementById("cabinet-grid")?.closest(".section-tight")?.insertAdjacentHTML("afterend", `<div class="cabinet-brand-filter"><div class="filter-row" id="cabinet-brand-filters"></div><div class="cabinet-brand-empty" id="cabinet-brand-empty" hidden>${rmaydPictureHTML("secondary", "cabinet-rmayd-mark", "")}<p class="eyebrow">RMAYD</p><p class="body-md">Collection arriving soon.</p></div></div>`);
  }

  function renderHome() {
    const mixed = [officialProducts[0], PRODUCTS.find((product) => product.brandId === "rmayd"), ...officialProducts.slice(1, 5)].filter(Boolean);
    document.getElementById("hero-line").textContent = "Independent fashion. One curated destination.";
    document.querySelector("#screen-home .wordmark-lg").textContent = "JUNKTEE PLATFORM";
    document.getElementById("hero-cta-label").textContent = "Explore New In";
    document.querySelector("#screen-home .hero-cta").onclick = () => openCollection("new-in");
    document.getElementById("marketplace-home").innerHTML = `
      <section class="market-section">
        <div class="market-section-head"><div><p class="eyebrow">Across the platform</p><h2 class="market-title">New In</h2></div><button class="btn-text" type="button" onclick="go('collection')">Shop all →</button></div>
        <div class="market-grid">${mixed.map((product) => productCard(product)).join("")}</div>
      </section>
      <section class="market-section">
        <div class="market-section-head"><div><p class="eyebrow">Independent labels</p><h2 class="market-title">Featured Brands</h2></div><button class="btn-text" type="button" onclick="go('brands')">View directory →</button></div>
        <div class="featured-brand-grid">
          <button class="featured-brand" type="button" onclick="openBrand('junktee')"><p class="eyebrow">Founding brand</p><h3>JUNKTEE</h3><p>The first label in the archive, now anchoring a wider platform for independent fashion.</p></button>
          <button class="featured-brand rmayd" type="button" onclick="openBrand('rmayd')">${rmaydPictureHTML("secondary", "featured-brand-watermark", "")}<div class="featured-brand-content"><p class="eyebrow">Official identity</p>${brandIdentityHTML("rmayd", { className: "brand-identity--featured", alt: "RMAYD" })}<p>The first RMAYD collection will be available soon.</p></div></button>
        </div>
      </section>
      <section class="market-section">
        <div class="market-section-head"><div><p class="eyebrow">Platform edit</p><h2 class="market-title">The Curated Edit</h2></div><p class="market-copy">A presentation view showing how selected pieces from different labels can live together without flattening their identities.</p></div>
        <div class="market-grid">${[officialProducts[2], PRODUCTS.find((product) => product.id === "RMAYD-DEMO-02"), officialProducts[5], officialProducts[7]].filter(Boolean).map((product) => productCard(product)).join("")}</div>
      </section>
      <section class="market-section platform-passport">
        <div class="market-section-head"><div><p class="eyebrow" style="color:var(--green-bright)">One platform system</p><h2 class="market-title">Digital Passport</h2></div><p class="market-copy">Each eligible piece carries its brand identity, product record, ownership history, care journey, and authentication trail inside JUNKTEE.</p></div>
        <div class="passport-brand-row"><span>Brand identity</span><span>Product identity</span><span>Ownership history</span><span>Care & repair</span><span>Authentication</span></div>
      </section>
      <section class="market-section"><div class="market-section-head"><div><p class="eyebrow">Platform Journal</p><h2 class="market-title">Stories from the labels</h2></div><button class="btn-text" type="button" onclick="go('journal')">Open Journal →</button></div><div id="market-home-journal"></div></section>`;
    document.getElementById("market-home-journal").innerHTML = marketplaceJournal.map(journalCard).join("");
  }

  function renderBrands() {
    document.getElementById("brands-directory").innerHTML = brands.map((brand, index) => `
      <button class="brand-directory-card ${e(brand.id)}" type="button" onclick="openBrand('${e(brand.id)}')">
        <span class="brand-number">0${index + 1} · ${e(brand.status)}</span><div>${brand.id === "rmayd" ? brandIdentityHTML(brand.id, { className: "brand-identity--directory", alt: "RMAYD" }) : `<h2>${e(brand.name)}</h2>`}<p class="brand-desc">${e(brand.description)}</p></div>
      </button>`).join("");
  }

  function renderCollections() {
    document.getElementById("collections-grid").innerHTML = collections.map((collection) => `
      <button class="collection-tile ${collection.brandId === "rmayd" ? "rmayd-collection-tile" : ""}" type="button" onclick="openCollection('${e(collection.id)}')">${collection.brandId === "rmayd" ? rmaydPictureHTML("secondary", "collection-rmayd-mark", "") : ""}<div><p class="eyebrow">${collection.brandId ? e(brandById(collection.brandId)?.name) : "Cross-brand"}</p>${collection.brandId === "rmayd" ? brandIdentityHTML("rmayd", { className: "brand-identity--collection", alt: "RMAYD" }) : `<h2>${e(collection.name)}</h2>`}<p>${e(collection.description)}</p></div></button>`).join("");
  }

  function renderBrandPage(id) {
    const brand = brandById(id);
    if (!brand) return;
    const products = PRODUCTS.filter((product) => product.brandId === brand.id);
    const isRmayd = brand.id === "rmayd";
    const followSection = isRmayd ? `<section class="rmayd-follow" aria-labelledby="rmayd-follow-title"><div><p class="eyebrow">Instagram</p><h2 id="rmayd-follow-title">Follow RMAYD</h2><a href="${e(brand.instagramUrl)}" target="_blank" rel="noopener noreferrer">${e(brand.instagramHandle)}</a><p>Scan to open the official Instagram profile.</p></div><a class="rmayd-qr-link" href="${e(brand.instagramUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open RMAYD on Instagram">${rmaydPictureHTML("instagram", "rmayd-instagram-qr", "Instagram QR code for @rmayd.official")}</a></section>` : "";
    document.getElementById("brand-page").innerHTML = `
      <header class="brand-hero ${e(brand.id)}">${isRmayd ? rmaydPictureHTML("secondary", "brand-hero-secondary", "") : ""}<div class="brand-hero-content"><p class="eyebrow">${e(brand.status)}</p>${isRmayd ? brandIdentityHTML(brand.id, { className: "brand-identity--hero", alt: "RMAYD", eager: true }) : `<h1>${e(brand.name)}</h1>`}<p>${e(brand.description)}</p></div></header>
      <section class="brand-story"><p class="eyebrow">${isRmayd ? "Collection" : "Brand Story"}</p><div><p class="story-copy">${e(brand.story)}</p>${brand.placeholder ? '<p class="placeholder-disclosure" style="margin-top:28px">Official product names, imagery, pricing, materials, origin, and availability will appear after the approved catalog is imported.</p>' : ""}</div></section>
      <section class="market-section" style="border:0;padding-bottom:38px"><div class="market-section-head"><div><p class="eyebrow">${e(brand.name)}</p><h2 class="market-title">${brand.placeholder ? "Collection arriving soon." : "Current collection"}</h2></div>${brand.placeholder ? "" : `<button class="btn-text" type="button" onclick="shopBrand('${e(brand.id)}')">Shop this brand →</button>`}</div></section>
      <div class="brand-product-grid">${products.map((product) => productCard(product)).join("") || '<p class="market-copy">No approved products are available yet.</p>'}</div>
      <section class="market-section platform-passport ${isRmayd ? "rmayd-passport-panel" : ""}">${isRmayd ? rmaydPictureHTML("secondary", "passport-rmayd-mark", "") : ""}<div class="market-section-head"><div><p class="eyebrow" style="color:var(--green-bright)">Passport relationship</p><h2 class="market-title">${brand.passportEligible ? "Eligible pieces enter the shared archive." : "Passport details will follow the official product catalog."}</h2></div><p class="market-copy">The platform records brand and product identity without replacing the label’s own story.</p></div></section>
      ${followSection}`;
  }

  function shopMarkup() {
    const categoryOptions = [...new Set(PRODUCTS.map((product) => product.category).filter(Boolean))];
    const collectionOptions = [...new Set(PRODUCTS.map((product) => product.collection).filter(Boolean))];
    document.getElementById("screen-collection").innerHTML = `
      <header class="marketplace-screen-intro"><p class="eyebrow">Independent labels · One destination</p><h1 class="display">Shop</h1><p class="market-copy">Browse approved catalog pieces alongside clearly marked forthcoming collections.</p></header>
      <div class="shop-tools"><div class="filter-row" id="shop-brand-pills"><button class="pill active" type="button" data-brand="all">All Brands</button>${brands.map((brand) => `<button class="pill" type="button" data-brand="${e(brand.id)}">${e(brand.name)}</button>`).join("")}</div>
      <div class="filter-selects"><label><span class="screen-reader-only">Category</span><select id="shop-category"><option value="all">All categories</option>${categoryOptions.map((value) => `<option value="${e(value)}">${e(value)}</option>`).join("")}</select></label><label><span class="screen-reader-only">Collection</span><select id="shop-collection"><option value="all">All collections</option>${collectionOptions.map((value) => `<option value="${e(value)}">${e(value)}</option>`).join("")}</select></label><label><span class="screen-reader-only">Passport</span><select id="shop-passport"><option value="all">All Passport states</option><option value="eligible">Passport eligible</option><option value="pending">Passport pending</option></select></label><span class="shop-count" id="shop-count"></span></div></div>
      <div id="collection-grid"></div>`;
    document.getElementById("shop-brand-pills").addEventListener("click", (event) => {
      const button = event.target.closest("[data-brand]"); if (!button) return;
      state.brand = button.dataset.brand; document.querySelectorAll("#shop-brand-pills .pill").forEach((pill) => pill.classList.toggle("active", pill === button)); renderShop();
    });
    [["shop-category", "category"], ["shop-collection", "collection"], ["shop-passport", "passport"]].forEach(([id, key]) => document.getElementById(id).addEventListener("change", (event) => { state[key] = event.target.value; renderShop(); }));
  }

  function filteredProducts() {
    return PRODUCTS.filter((product) => {
      if (state.brand !== "all" && product.brandId !== state.brand) return false;
      if (state.category !== "all" && product.category !== state.category) return false;
      if (state.collection !== "all" && product.collection !== state.collection) return false;
      if (state.passport === "eligible" && product.passportEligible === false) return false;
      if (state.passport === "pending" && product.passportEligible !== false) return false;
      return true;
    });
  }

  function renderShop() {
    const list = filteredProducts();
    document.getElementById("collection-grid").innerHTML = list.length ? list.map((product) => productCard(product)).join("") : '<div class="catalog-empty"><p class="body-md">No pieces match these filters.</p><p class="meta">Try a different brand or collection.</p></div>';
    document.getElementById("shop-count").textContent = `${list.length} ${list.length === 1 ? "piece" : "pieces"}`;
  }

  function journalCard(article) {
    const brand = article.brandId === "platform" ? "JUNKTEE Platform" : brandById(article.brandId)?.name || "JUNKTEE";
    const action = article.placeholder ? `openBrand('${e(article.brandId)}')` : "openPassport()";
    return `<article class="article-card" onclick="${action}"><div class="thumb ${article.brandId === "rmayd" ? "rmayd-journal-thumb" : ""}">${article.brandId === "rmayd" ? rmaydPictureHTML("secondary", "journal-rmayd-mark", "") : ""}</div><div><p class="eyebrow"><span class="journal-brand">${e(brand)}</span>${e(article.type)}</p><p class="body-md">${e(article.title)}</p><p class="meta">${e(article.time)}</p></div></article>`;
  }

  function augmentJournal() {
    const list = document.getElementById("journal-list");
    list.insertAdjacentHTML("afterbegin", marketplaceJournal.map(journalCard).join(""));
    document.querySelector("#screen-journal .eyebrow").textContent = "Platform Journal";
    document.querySelector("#screen-journal .display").textContent = "Stories across the labels";
  }

  function updateProductContext(id) {
    const product = PRODUCTS.find((entry) => entry.id === id);
    if (!product) return;
    document.getElementById("screen-product").classList.toggle("preview-product", product.purchasable === false);
    const brandLink = document.getElementById("pd-brand-link");
    brandLink.innerHTML = brandIdentityHTML(product, { className: "brand-identity--product", alt: productBrand(product) }); brandLink.dataset.brandId = product.brandId || "junktee"; brandLink.setAttribute("aria-label", `Open ${productBrand(product)} brand page`); brandLink.onclick = () => openBrand(product.brandId || "junktee");
    document.getElementById("pd-price").textContent = product.price || "Price pending";
    document.querySelector("#screen-product .section-tight .meta[style*='color:var(--green)']").textContent = product.purchasable === false ? "Collection arriving soon" : "Available in sandbox checkout";
    document.getElementById("pd-related").innerHTML = PRODUCTS.filter((entry) => entry.id !== id && entry.brandId === product.brandId).slice(0, 4).map((entry) => productCard(entry, true)).join("");
    const crossBrand = PRODUCTS.filter((entry) => entry.id !== id && entry.brandId !== product.brandId).slice(0, 3);
    if (crossBrand.length) document.getElementById("pd-related").insertAdjacentHTML("beforeend", crossBrand.map((entry) => productCard(entry, true)).join(""));
  }

  function renderCabinetFilters() {
    const wrap = document.getElementById("cabinet-brand-filters");
    wrap.innerHTML = `<button class="pill active" type="button" data-cabinet-brand="all">All Brands</button>${brands.map((brand) => `<button class="pill brand-filter-pill" type="button" data-cabinet-brand="${e(brand.id)}">${brand.id === "rmayd" ? brandIdentityHTML(brand.id, { className: "brand-identity--filter", alt: "RMAYD" }) : e(brand.name)}</button>`).join("")}`;
    wrap.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cabinet-brand]"); if (!button) return;
      wrap.querySelectorAll(".pill").forEach((pill) => pill.classList.toggle("active", pill === button));
      const selected = button.dataset.cabinetBrand;
      let visible = 0;
      document.querySelectorAll("#cabinet-grid .card").forEach((card) => { const brandId = card.querySelector(".brand-link")?.dataset.brandId || "junktee"; card.hidden = selected !== "all" && brandId !== selected; if (!card.hidden) visible += 1; });
      const empty = document.getElementById("cabinet-brand-empty"); if (empty) empty.hidden = selected !== "rmayd" || visible > 0;
    });
  }

  window.go = function marketplaceGo(id, options) {
    document.getElementById("marketplace-menu")?.classList.remove("open");
    baseGo(id, options);
    document.querySelectorAll(".desktop-marketplace-header nav button").forEach((button) => button.removeAttribute("aria-current"));
    document.getElementById("desktop-cart-count").textContent = String(cart.reduce((sum, item) => sum + (item.quantity || 1), 0));
  };

  window.openProduct = function marketplaceOpenProduct(id) { baseOpenProduct(id); updateProductContext(id); };
  window.openBrand = function openBrand(id) { renderBrandPage(id); go("brand"); };
  window.shopBrand = function shopBrand(id) { state.brand = id; go("collection"); document.querySelector(`#shop-brand-pills [data-brand="${CSS.escape(id)}"]`)?.click(); };
  window.openCollection = function openCollection(id) {
    const collection = collections.find((entry) => entry.id === id);
    state.brand = collection?.brandId || "all"; state.collection = "all";
    go("collection");
    if (collection?.brandId) document.querySelector(`#shop-brand-pills [data-brand="${CSS.escape(collection.brandId)}"]`)?.click();
  };
  window.toggleMarketplaceMenu = function toggleMarketplaceMenu(force) { const menu = document.getElementById("marketplace-menu"); const open = typeof force === "boolean" ? force : !menu.classList.contains("open"); menu.classList.toggle("open", open); menu.setAttribute("aria-hidden", String(!open)); };
  window.menuGo = function menuGo(id) { toggleMarketplaceMenu(false); go(id); };
  window.menuPassport = function menuPassport() { toggleMarketplaceMenu(false); openPassport(); };

  ensureShell();
  shopMarkup();
  renderShop();
  renderHome();
  renderBrands();
  renderCollections();
  renderCabinetFilters();
  augmentJournal();
  document.body.classList.add("marketplace-ready");
  document.getElementById("desktop-cart-count").textContent = String(cart.reduce((sum, item) => sum + (item.quantity || 1), 0));
})();
