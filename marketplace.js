/* JUNKTEE v0.7 — curated multi-brand marketplace */
(() => {
  "use strict";

  const brands = Array.isArray(MARKETPLACE.brands) ? MARKETPLACE.brands : [];
  const collections = Array.isArray(MARKETPLACE.collections) ? MARKETPLACE.collections : [];
  const marketplaceJournal = Array.isArray(MARKETPLACE.journal) ? MARKETPLACE.journal : [];
  const platform = MARKETPLACE.platform || {};
  const officialProducts = PRODUCTS.filter((product) => !product.demo);
  const state = {
    brand: "all",
    category: "all",
    collection: "all",
    size: "all",
    availability: "all",
    price: "all",
    query: "",
    brandQuery: "",
    brandInitial: "all",
    directoryView: "featured",
  };
  const baseGo = window.go;
  const baseOpenProduct = window.openProduct;

  function e(value) { return escapeCatalogHTML(value); }
  function brandById(id) { return brands.find((brand) => brand.id === id) || null; }
  function productBrand(product) { return product?.brandName || brandById(product?.brandId)?.name || "JUNKTEE"; }
  function isAvailable(product) { return product?.purchasable !== false && Number(product?.unitAmount) > 0; }
  function initials(value) { return String(value || "").trim().charAt(0).toUpperCase(); }
  function platformWordmarkMarkup(className = "") { return `<img class="platform-wordmark ${e(className)}" src="./public/brand/junktee-wordmark.jpeg" alt="JUNKTEE" width="448" height="96" decoding="async">`; }

  function productCard(product, compact = false) {
    const availability = isAvailable(product) ? "" : '<span class="card-availability">Collection forthcoming</span>';
    return `<article class="product-card marketplace-product ${product.demo ? "is-preview" : ""}" data-brand="${e(product.brandId || "junktee")}" data-product="${e(product.id)}" role="link" tabindex="0" onclick="openProduct('${e(product.id)}')" onkeydown="if(event.key==='Enter')openProduct('${e(product.id)}')">
      <div class="imgbox catalog-product editorial-reveal in-view">${productImageHTML(product)}</div>
      <div class="product-card-copy">${brandLinkHTML(product, { compact })}${availability}<p class="name">${e(product.name)}</p><p class="meta">${e(product.price || "Price pending")}</p></div>
    </article>`;
  }

  function navigationMarkup(items) {
    return (items || []).map((item) => `<button type="button" data-platform-nav="${e(item.id)}" onclick="navigatePlatform('${e(item.id)}')">${e(item.label)}</button>`).join("");
  }

  function mobileIcon(id) {
    const paths = {
      home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
      shop: '<path d="M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2M4 7h16l-1 14H5L4 7z"/>',
      brands: '<path d="M4 5h16M4 12h16M4 19h10"/>',
      journal: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zm3 0v16"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    };
    return `<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${paths[id] || paths.menu}</svg>`;
  }

  function renderMobileNavigation() {
    const items = platform.navigation?.mobile || [
      { id: "home", label: "Home" }, { id: "shop", label: "Shop" }, { id: "brands", label: "Brands" },
      { id: "journal", label: "Journal" }, { id: "menu", label: "Menu" },
    ];
    document.getElementById("bottomnav").innerHTML = items.map((item) => `<button class="navitem" data-nav="${e(item.id)}" type="button" onclick="navigatePlatform('${e(item.id)}')">${mobileIcon(item.id)}${e(item.label)}</button>`).join("");
  }

  function ensureShell() {
    const app = document.getElementById("app");
    const primary = platform.navigation?.primary || [];
    app.insertAdjacentHTML("afterbegin", `
      <header class="desktop-marketplace-header" aria-label="Primary navigation">
        <button class="platform-mark" type="button" onclick="go('home')" aria-label="JUNKTEE home">${platformWordmarkMarkup()}</button>
        <nav>${navigationMarkup(primary)}</nav>
        <div class="desktop-actions">
          <button type="button" onclick="openSearch()" aria-label="Search products, brands and collections">Search</button>
          <button type="button" onclick="go('settings')" aria-label="Account settings">Account</button>
          <button type="button" onclick="go('cart')">Bag <span id="desktop-cart-count">0</span></button>
        </div>
      </header>`);

    document.getElementById("screen-collection").insertAdjacentHTML("beforebegin", `
      <div class="screen" id="screen-search">
        <header class="marketplace-screen-intro search-intro"><p class="eyebrow">Discover the edit</p><h1 class="display">Search</h1></header>
        <div class="search-shell"><label class="search-field"><span class="screen-reader-only">Search products, brands and collections</span><input id="global-search" type="search" autocomplete="off" placeholder="Search products, brands, collections" oninput="renderGlobalSearch(this.value)"></label><div class="search-results" id="search-results"></div></div>
      </div>
      <div class="screen" id="screen-brands">
        <header class="marketplace-screen-intro"><p class="eyebrow">Selected by JUNKTEE</p><h1 class="display">Meet the brands</h1><p class="market-copy">Independent labels are introduced as creative worlds, not reduced to catalog filters.</p></header>
        <div class="brand-directory-tools">
          <label class="brand-search"><span class="screen-reader-only">Search brands</span><input id="brand-search" type="search" placeholder="Search brands" oninput="filterBrandsDirectory(this.value)"></label>
          <div class="directory-modes" role="group" aria-label="Brand directory view"><button class="active" type="button" data-directory-mode="featured" onclick="setBrandDirectoryMode('featured')">Featured</button><button type="button" data-directory-mode="alphabetical" onclick="setBrandDirectoryMode('alphabetical')">A—Z</button></div>
        </div>
        <div class="brand-letter-nav" id="brand-letter-nav" aria-label="Browse brands alphabetically"></div>
        <div class="brands-directory" id="brands-directory"></div>
      </div>
      <div class="screen" id="screen-brand"><div id="brand-page"></div></div>
      <div class="screen" id="screen-collections">
        <header class="marketplace-screen-intro"><p class="eyebrow">Curated across labels</p><h1 class="display">Collections</h1><p class="market-copy">Brand-led releases and JUNKTEE edits, presented with a clear point of view.</p></header>
        <div class="collections-grid" id="collections-grid"></div>
      </div>`);

    const hero = document.querySelector("#screen-home .hero");
    hero.insertAdjacentHTML("afterend", '<div class="marketplace-home" id="marketplace-home"></div>');
    document.getElementById("bottomnav").insertAdjacentHTML("beforebegin", `
      <aside class="menu-sheet" id="marketplace-menu" aria-hidden="true">
        <div class="menu-sheet-top"><span class="wordmark">${platformWordmarkMarkup("platform-wordmark--menu")}</span><button class="icon-btn" type="button" onclick="toggleMarketplaceMenu(false)" aria-label="Close menu">✕</button></div>
        <nav>
          <button type="button" onclick="openSearch()">Search</button>
          <button type="button" onclick="menuGo('collections')">Collections</button>
          <button type="button" onclick="menuGo('journal')">Journal</button>
          <button type="button" onclick="menuGo('cabinet')">My Collection</button>
          <button type="button" onclick="menuGo('settings')">Account & Settings</button>
          <button type="button" onclick="menuGo('cart')">Bag</button>
        </nav>
      </aside>`);

    const productDetails = document.querySelector("#screen-product .section-tight");
    productDetails.insertAdjacentHTML("afterbegin", '<div class="product-brand-context"><button class="brand-link" id="pd-brand-link" type="button">JUNKTEE</button></div>');
    document.getElementById("add-to-bag").insertAdjacentHTML("afterend", '<p class="preview-commerce-note">The official RMAYD product catalog has not yet been imported.</p>');
    document.getElementById("cabinet-grid")?.closest(".section-tight")?.insertAdjacentHTML("afterend", `<div class="cabinet-brand-filter"><div class="filter-row" id="cabinet-brand-filters"></div><div class="cabinet-brand-empty" id="cabinet-brand-empty" hidden>${rmaydPictureHTML("secondary", "cabinet-rmayd-mark", "")}<p class="eyebrow">RMAYD</p><p class="body-md">Collection arriving soon.</p></div></div>`);
    renderMobileNavigation();
  }

  function homeNewIn() {
    const mixed = [officialProducts[0], PRODUCTS.find((product) => product.brandId === "rmayd"), ...officialProducts.slice(1, 5)].filter(Boolean);
    return `<section class="market-section home-new-in"><div class="market-section-head"><div><p class="eyebrow">Across the platform</p><h2 class="market-title">New in</h2></div><button class="btn-text" type="button" onclick="go('collection')">Shop the edit →</button></div><div class="market-grid">${mixed.map((product) => productCard(product)).join("")}</div></section>`;
  }

  function homeBrandMoment() {
    const brand = brandById(platform.featuredBrandIds?.[0] || "rmayd") || brandById("rmayd");
    if (!brand) return "";
    return `<section class="brand-moment ${e(brand.id)}"><div class="brand-moment-art">${brand.id === "rmayd" ? rmaydPictureHTML("secondary", "brand-moment-mark", "") : ""}</div><div class="brand-moment-copy"><p class="eyebrow">Brand of the moment</p>${brand.id === "rmayd" ? brandIdentityHTML("rmayd", { className: "brand-identity--moment", alt: "RMAYD" }) : `<h2>${e(brand.name)}</h2>`}<p>${e(brand.description)}</p><button class="btn-text" type="button" onclick="openBrand('${e(brand.id)}')">Explore the label →</button></div></section>`;
  }

  function homeMeetBrands() {
    return `<section class="market-section meet-brands"><div class="market-section-head"><div><p class="eyebrow">Selected labels</p><h2 class="market-title">Meet the brands</h2></div><button class="btn-text" type="button" onclick="go('brands')">View all brands →</button></div><div class="meet-brand-list">${brands.map((brand, index) => `<button type="button" onclick="openBrand('${e(brand.id)}')"><span>0${index + 1}</span><div>${brand.id === "rmayd" ? brandIdentityHTML("rmayd", { className: "brand-identity--meet", alt: "RMAYD" }) : `<h3>${e(brand.name)}</h3>`}<p>${e(brand.status)}</p></div><i>↗</i></button>`).join("")}</div></section>`;
  }

  function homeCuratedTogether() {
    const edit = [officialProducts[2], PRODUCTS.find((product) => product.id === "RMAYD-DEMO-02"), officialProducts[5], officialProducts[7]].filter(Boolean);
    return `<section class="market-section curated-together"><div class="curated-intro"><p class="eyebrow">Curated together</p><h2 class="market-title">Different voices.<br>One deliberate edit.</h2><p class="market-copy">A JUNKTEE selection brings independent labels into conversation without flattening their identities.</p></div><div class="market-grid">${edit.map((product) => productCard(product)).join("")}</div></section>`;
  }

  function homeJournal() {
    return `<section class="market-section journal-home"><div class="market-section-head"><div><p class="eyebrow">The editorial engine</p><h2 class="market-title">Journal</h2></div><button class="btn-text" type="button" onclick="go('journal')">Read the Journal →</button></div><div class="journal-home-grid" id="market-home-journal">${marketplaceJournal.map(journalCard).join("")}</div></section>`;
  }

  function homeStatement() {
    return `<section class="platform-statement"><p class="eyebrow">The JUNKTEE point of view</p><p>We discover, introduce and celebrate independent fashion labels worth knowing.</p><button class="btn-text" type="button" onclick="go('brands')">Meet the selected brands →</button></section>`;
  }

  function renderHome() {
    document.getElementById("hero-line").textContent = "Independent fashion, selected with intent.";
    document.querySelector("#screen-home .wordmark-lg").innerHTML = `${platformWordmarkMarkup("platform-wordmark--hero")}<span class="hero-platform-caption">/ THE PLATFORM</span>`;
    document.getElementById("hero-cta-label").textContent = "Discover New In";
    document.querySelector("#screen-home .hero-cta").onclick = () => openCollection("new-in");
    const sections = { newIn: homeNewIn, brandMoment: homeBrandMoment, meetBrands: homeMeetBrands, curatedTogether: homeCuratedTogether, journal: homeJournal, statement: homeStatement };
    const order = platform.homeSections || Object.keys(sections);
    document.getElementById("marketplace-home").innerHTML = order.map((id) => sections[id]?.() || "").join("");
  }

  function brandDirectoryCard(brand, index) {
    return `<button class="brand-directory-card ${e(brand.id)}" type="button" onclick="openBrand('${e(brand.id)}')"><span class="brand-number">0${index + 1} · ${e(brand.status)}</span><div>${brand.id === "rmayd" ? brandIdentityHTML(brand.id, { className: "brand-identity--directory", alt: "RMAYD" }) : `<h2>${e(brand.name)}</h2>`}<p class="brand-desc">${e(brand.description)}</p><span class="brand-explore">Explore the label →</span></div></button>`;
  }

  function renderBrandLetters() {
    const letters = [...new Set(brands.map((brand) => initials(brand.name)).filter(Boolean))].sort();
    document.getElementById("brand-letter-nav").innerHTML = `<button class="${state.brandInitial === "all" ? "active" : ""}" type="button" onclick="setBrandInitial('all')">All</button>${letters.map((letter) => `<button class="${state.brandInitial === letter ? "active" : ""}" type="button" onclick="setBrandInitial('${e(letter)}')">${e(letter)}</button>`).join("")}`;
  }

  function renderBrandsDirectory() {
    const query = state.brandQuery.trim().toLowerCase();
    const list = brands.filter((brand) => (!query || `${brand.name} ${brand.description} ${brand.status}`.toLowerCase().includes(query)) && (state.brandInitial === "all" || initials(brand.name) === state.brandInitial));
    const wrap = document.getElementById("brands-directory");
    wrap.className = `brands-directory ${state.directoryView}`;
    if (!list.length) {
      wrap.innerHTML = '<div class="catalog-empty"><p class="body-md">No selected brand matches this search.</p><p class="meta">Try another name or letter.</p></div>';
      return;
    }
    if (state.directoryView === "alphabetical") {
      wrap.innerHTML = `<div class="brand-alpha-list">${list.sort((a, b) => a.name.localeCompare(b.name)).map((brand) => `<button type="button" onclick="openBrand('${e(brand.id)}')"><span>${e(initials(brand.name))}</span><div>${brand.id === "rmayd" ? brandIdentityHTML("rmayd", { className: "brand-identity--alpha", alt: "RMAYD" }) : `<h2>${e(brand.name)}</h2>`}<p>${e(brand.status)}</p></div><i>↗</i></button>`).join("")}</div>`;
    } else {
      wrap.innerHTML = list.map((brand) => brandDirectoryCard(brand, brands.indexOf(brand))).join("");
    }
  }

  function renderBrands() { renderBrandLetters(); renderBrandsDirectory(); }

  function renderCollections() {
    document.getElementById("collections-grid").innerHTML = collections.map((collection) => `<button class="collection-tile ${collection.brandId === "rmayd" ? "rmayd-collection-tile" : ""}" type="button" onclick="openCollection('${e(collection.id)}')">${collection.brandId === "rmayd" ? rmaydPictureHTML("secondary", "collection-rmayd-mark", "") : ""}<div><p class="eyebrow">${collection.brandId ? e(brandById(collection.brandId)?.name) : "JUNKTEE edit"}</p>${collection.brandId === "rmayd" ? brandIdentityHTML("rmayd", { className: "brand-identity--collection", alt: "RMAYD" }) : `<h2>${e(collection.name)}</h2>`}<p>${e(collection.description)}</p><span>Explore →</span></div></button>`).join("");
  }

  function brandJournalMarkup(brand) {
    const articles = marketplaceJournal.filter((article) => article.brandId === brand.id);
    if (!articles.length) return "";
    return `<section class="market-section brand-journal"><div class="market-section-head"><div><p class="eyebrow">Stories and updates</p><h2 class="market-title">From the Journal</h2></div><button class="btn-text" type="button" onclick="go('journal')">Open Journal →</button></div><div class="journal-home-grid">${articles.map(journalCard).join("")}</div></section>`;
  }

  function brandDiscoverMarkup(brand) {
    const others = brands.filter((entry) => entry.id !== brand.id);
    if (!others.length) return "";
    return `<section class="brand-discover"><p class="eyebrow">Discover another label</p>${others.map((entry) => `<button type="button" onclick="openBrand('${e(entry.id)}')">${entry.id === "rmayd" ? brandIdentityHTML("rmayd", { className: "brand-identity--discover", alt: "RMAYD" }) : `<span>${e(entry.name)}</span>`}<i>↗</i></button>`).join("")}</section>`;
  }

  function renderBrandPage(id) {
    const brand = brandById(id);
    if (!brand) return;
    document.getElementById("screen-brand").dataset.brandWorld = brand.id;
    const products = officialProducts.filter((product) => product.brandId === brand.id);
    const isRmayd = brand.id === "rmayd";
    const approvedStory = brand.storyApproved ? `<section class="brand-story"><p class="eyebrow">Brand story</p><div><p class="story-copy">${e(brand.story)}</p></div></section>` : "";
    const collectionBody = brand.placeholder
      ? `<div class="brand-coming-soon">${rmaydPictureHTML("secondary", "brand-coming-mark", "")}<div><p class="eyebrow">Future collection area</p><h2>Collection coming soon.</h2><p>Official products and photography will appear here after the approved catalog arrives.</p></div></div>`
      : `<div class="brand-product-grid">${products.map((product) => productCard(product)).join("")}</div>`;
    const heroVisual = isRmayd ? rmaydPictureHTML("secondary", "brand-hero-secondary", "") : (products[0] ? `<div class="brand-hero-product" aria-hidden="true">${productImageHTML(products[0], { eager: true, alt: "" })}</div>` : "");
    const followSection = isRmayd ? `<section class="rmayd-follow" aria-labelledby="rmayd-follow-title"><div><p class="eyebrow">Instagram</p><h2 id="rmayd-follow-title">Follow RMAYD</h2><a href="${e(brand.instagramUrl)}" target="_blank" rel="noopener noreferrer">${e(brand.instagramHandle)}</a><p>Open the official Instagram profile.</p></div><a class="rmayd-qr-link" href="${e(brand.instagramUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open RMAYD on Instagram">${rmaydPictureHTML("instagram", "rmayd-instagram-qr", "Instagram QR code for @rmayd.official")}</a></section>` : "";
    document.getElementById("brand-page").innerHTML = `<header class="brand-hero ${e(brand.id)}">${heroVisual}<div class="brand-hero-content"><p class="eyebrow">${e(brand.status)}</p>${isRmayd ? brandIdentityHTML(brand.id, { className: "brand-identity--hero", alt: "RMAYD", eager: true }) : `<h1>${e(brand.name)}</h1>`}<p>${e(brand.description)}</p><span>Selected by JUNKTEE</span></div></header>${approvedStory}<section class="market-section brand-collection-head"><div class="market-section-head"><div><p class="eyebrow">${e(brand.name)}</p><h2 class="market-title">${brand.placeholder ? "The first collection" : "Current collection"}</h2></div>${brand.placeholder ? "" : `<button class="btn-text" type="button" onclick="shopBrand('${e(brand.id)}')">Shop this brand →</button>`}</div></section>${collectionBody}${brandJournalMarkup(brand)}${followSection}${brandDiscoverMarkup(brand)}`;
  }

  function filterOptions(values, label) {
    const titles = { categories: "All categories", collections: "All collections", sizes: "All sizes" };
    return `<option value="all">${titles[label] || `All ${e(label)}`}</option>${values.map((value) => `<option value="${e(value)}">${e(value)}</option>`).join("")}`;
  }

  function shopMarkup() {
    const categories = [...new Set(PRODUCTS.map((product) => product.category).filter(Boolean))];
    const collectionOptions = [...new Set(PRODUCTS.map((product) => product.collection).filter(Boolean))];
    const sizes = [...new Set(PRODUCTS.flatMap((product) => product.sizes || []).filter(Boolean))];
    document.getElementById("screen-collection").innerHTML = `<header class="marketplace-screen-intro shop-intro"><p class="eyebrow">Independent labels · One destination</p><h1 class="display">Shop the edit</h1><p class="market-copy">Browse the catalog by brand, category, collection, size and availability.</p></header><div class="shop-tools"><div class="shop-search-row"><label class="shop-search"><span class="screen-reader-only">Search shop</span><input id="shop-search" type="search" placeholder="Search the shop" oninput="setShopQuery(this.value)"></label><button class="filter-trigger" type="button" onclick="toggleFilters(true)">Filters <span id="active-filter-count">0</span></button></div><div class="filter-row" id="shop-brand-pills"><button class="pill active" type="button" data-brand="all">All Brands</button>${brands.map((brand) => `<button class="pill" type="button" data-brand="${e(brand.id)}">${e(brand.name)}</button>`).join("")}</div><aside class="shop-filter-panel" id="shop-filter-panel" aria-hidden="true"><div class="filter-panel-top"><p class="eyebrow">Refine the edit</p><button class="icon-btn" type="button" onclick="toggleFilters(false)" aria-label="Close filters">✕</button></div><div class="filter-selects"><label><span>Category</span><select id="shop-category">${filterOptions(categories, "categories")}</select></label><label><span>Collection</span><select id="shop-collection">${filterOptions(collectionOptions, "collections")}</select></label><label><span>Size</span><select id="shop-size">${filterOptions(sizes, "sizes")}</select></label><label><span>Availability</span><select id="shop-availability"><option value="all">All availability</option><option value="available">Available now</option><option value="forthcoming">Forthcoming</option></select></label><label><span>Price</span><select id="shop-price"><option value="all">All prices</option><option value="under-200">Under SAR 200</option><option value="200-350">SAR 200—350</option><option value="over-350">SAR 350+</option></select></label></div><div class="filter-panel-actions"><button class="btn-text" type="button" onclick="resetShopFilters()">Reset</button><button class="btn btn-primary" type="button" onclick="toggleFilters(false)">Apply filters</button></div></aside><div class="shop-result-meta"><span class="shop-count" id="shop-count"></span><button class="btn-text" type="button" onclick="resetShopFilters()">Clear filters</button></div></div><div id="collection-grid"></div>`;
    document.getElementById("shop-brand-pills").addEventListener("click", (event) => {
      const button = event.target.closest("[data-brand]"); if (!button) return;
      state.brand = button.dataset.brand;
      document.querySelectorAll("#shop-brand-pills .pill").forEach((pill) => pill.classList.toggle("active", pill === button));
      renderShop();
    });
    [["shop-category", "category"], ["shop-collection", "collection"], ["shop-size", "size"], ["shop-availability", "availability"], ["shop-price", "price"]].forEach(([id, key]) => document.getElementById(id).addEventListener("change", (event) => { state[key] = event.target.value; renderShop(); }));
  }

  function filteredProducts() {
    const query = state.query.trim().toLowerCase();
    return PRODUCTS.filter((product) => {
      if (state.brand !== "all" && product.brandId !== state.brand) return false;
      if (state.category !== "all" && product.category !== state.category) return false;
      if (state.collection !== "all" && product.collection !== state.collection) return false;
      if (state.size !== "all" && !(product.sizes || []).includes(state.size)) return false;
      if (state.availability === "available" && !isAvailable(product)) return false;
      if (state.availability === "forthcoming" && isAvailable(product)) return false;
      const amount = Number(product.unitAmount) / 100;
      if (state.price === "under-200" && !(amount > 0 && amount < 200)) return false;
      if (state.price === "200-350" && !(amount >= 200 && amount <= 350)) return false;
      if (state.price === "over-350" && amount < 350) return false;
      if (query && !`${product.name} ${productBrand(product)} ${product.collection} ${product.category}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }

  function activeFilterCount() { return [state.brand, state.category, state.collection, state.size, state.availability, state.price].filter((value) => value !== "all").length + Number(Boolean(state.query.trim())); }

  function renderShop() {
    const list = filteredProducts();
    document.getElementById("collection-grid").innerHTML = list.length ? list.map((product) => productCard(product)).join("") : '<div class="catalog-empty"><p class="body-md">No pieces match these filters.</p><p class="meta">Try a different brand, size or collection.</p></div>';
    document.getElementById("shop-count").textContent = `${list.length} ${list.length === 1 ? "piece" : "pieces"}`;
    const count = activeFilterCount();
    document.getElementById("active-filter-count").textContent = String(count);
    document.getElementById("active-filter-count").hidden = count === 0;
  }

  function journalCard(article) {
    const brand = article.brandId === "platform" ? "JUNKTEE" : brandById(article.brandId)?.name || "JUNKTEE";
    const action = article.placeholder ? `openBrand('${e(article.brandId)}')` : `openArticle('${e(article.articleId || "a1")}')`;
    return `<article class="article-card marketplace-journal-card" role="link" tabindex="0" onclick="${action}" onkeydown="if(event.key==='Enter')${action}"><div class="thumb ${article.brandId === "rmayd" ? "rmayd-journal-thumb" : "platform-journal-thumb"}">${article.brandId === "rmayd" ? rmaydPictureHTML("secondary", "journal-rmayd-mark", "") : '<span>J / EDITORIAL</span>'}</div><div><p class="eyebrow"><span class="journal-brand">${e(brand)}</span>${e(article.type)}</p><p class="body-md">${e(article.title)}</p><p class="meta">${e(article.time)}</p></div></article>`;
  }

  function augmentJournal() {
    const list = document.getElementById("journal-list");
    list.insertAdjacentHTML("afterbegin", marketplaceJournal.map(journalCard).join(""));
    document.querySelector("#screen-journal .eyebrow").textContent = "JUNKTEE Journal";
    document.querySelector("#screen-journal .display").textContent = "Stories behind the labels";
  }

  function renderGlobalSearch(value = "") {
    const query = String(value).trim().toLowerCase();
    const wrap = document.getElementById("search-results");
    const matchingBrands = brands.filter((brand) => !query || `${brand.name} ${brand.description}`.toLowerCase().includes(query));
    const matchingProducts = PRODUCTS.filter((product) => !query || `${product.name} ${productBrand(product)} ${product.collection}`.toLowerCase().includes(query)).slice(0, 8);
    const matchingCollections = collections.filter((collection) => !query || `${collection.name} ${collection.description}`.toLowerCase().includes(query));
    wrap.innerHTML = `${matchingBrands.length ? `<section><p class="eyebrow">Brands</p><div class="search-brand-list">${matchingBrands.map((brand) => `<button type="button" onclick="openBrand('${e(brand.id)}')">${brand.id === "rmayd" ? brandIdentityHTML("rmayd", { className: "brand-identity--search", alt: "RMAYD" }) : `<span>${e(brand.name)}</span>`}<i>Explore →</i></button>`).join("")}</div></section>` : ""}${matchingProducts.length ? `<section><p class="eyebrow">Pieces</p><div class="market-grid">${matchingProducts.map((product) => productCard(product, true)).join("")}</div></section>` : ""}${matchingCollections.length ? `<section><p class="eyebrow">Collections</p><div class="search-collection-list">${matchingCollections.map((collection) => `<button type="button" onclick="openCollection('${e(collection.id)}')"><span>${e(collection.name)}</span><i>→</i></button>`).join("")}</div></section>` : ""}${!matchingBrands.length && !matchingProducts.length && !matchingCollections.length ? '<div class="catalog-empty"><p class="body-md">Nothing matched that search.</p><p class="meta">Try a brand, product or collection name.</p></div>' : ""}`;
  }

  function updateProductContext(id) {
    const product = PRODUCTS.find((entry) => entry.id === id);
    if (!product) return;
    document.getElementById("screen-product").classList.toggle("preview-product", product.purchasable === false);
    const brandLink = document.getElementById("pd-brand-link");
    brandLink.innerHTML = brandIdentityHTML(product, { className: "brand-identity--product", alt: productBrand(product) });
    brandLink.dataset.brandId = product.brandId || "junktee";
    brandLink.setAttribute("aria-label", `Open ${productBrand(product)} brand page`);
    brandLink.onclick = () => openBrand(product.brandId || "junktee");
    document.getElementById("pd-price").textContent = product.price || "Price pending";
    document.getElementById("pd-availability").textContent = product.purchasable === false ? "Collection arriving soon" : "Available in sandbox checkout";
    document.getElementById("pd-related-title").textContent = `More from ${productBrand(product)}`;
    const sameBrand = PRODUCTS.filter((entry) => entry.id !== id && entry.brandId === product.brandId).slice(0, 4);
    const crossBrand = PRODUCTS.filter((entry) => entry.id !== id && entry.brandId !== product.brandId).slice(0, 3);
    document.getElementById("pd-related").innerHTML = [...sameBrand, ...crossBrand].map((entry) => productCard(entry, true)).join("");
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
    document.getElementById("shop-filter-panel")?.classList.remove("open");
    document.body.classList.remove("filter-open");
    baseGo(id, options);
    const navMap = { home: "home", collection: "shop", brands: "brands", brand: "brands", journal: "journal" };
    document.querySelectorAll("[data-platform-nav], .bottomnav .navitem").forEach((button) => button.removeAttribute("aria-current"));
    document.querySelectorAll(".bottomnav .navitem").forEach((button) => button.classList.toggle("active", button.dataset.nav === navMap[id]));
    document.querySelector(`[data-platform-nav="${navMap[id] || ""}"]`)?.setAttribute("aria-current", "page");
    document.getElementById("desktop-cart-count").textContent = String(cart.reduce((sum, item) => sum + (item.quantity || 1), 0));
  };

  window.navigatePlatform = function navigatePlatform(id) {
    const actions = { home: () => go("home"), "new-in": () => openCollection("new-in"), shop: () => go("collection"), brands: () => go("brands"), collections: () => go("collections"), journal: () => go("journal"), search: () => openSearch(), account: () => go("settings"), bag: () => go("cart"), menu: () => toggleMarketplaceMenu() };
    actions[id]?.();
  };
  window.openSearch = function openSearch() { toggleMarketplaceMenu(false); go("search"); renderGlobalSearch(""); requestAnimationFrame(() => document.getElementById("global-search")?.focus()); };
  window.renderGlobalSearch = renderGlobalSearch;
  window.filterBrandsDirectory = function filterBrandsDirectory(value) { state.brandQuery = String(value || ""); renderBrandsDirectory(); };
  window.setBrandInitial = function setBrandInitial(value) { state.brandInitial = value; renderBrandLetters(); renderBrandsDirectory(); };
  window.setBrandDirectoryMode = function setBrandDirectoryMode(value) { state.directoryView = value === "alphabetical" ? "alphabetical" : "featured"; document.querySelectorAll("[data-directory-mode]").forEach((button) => button.classList.toggle("active", button.dataset.directoryMode === state.directoryView)); renderBrandsDirectory(); };
  window.openProduct = function marketplaceOpenProduct(id) { baseOpenProduct(id); updateProductContext(id); };
  window.openBrand = function openBrand(id) { renderBrandPage(id); go("brand"); };
  window.shopBrand = function shopBrand(id) { state.brand = id; go("collection"); const button = document.querySelector(`#shop-brand-pills [data-brand="${CSS.escape(id)}"]`); if (button) button.click(); };
  window.openCollection = function openCollection(id) { const collection = collections.find((entry) => entry.id === id); state.brand = collection?.brandId || "all"; state.collection = "all"; go("collection"); if (collection?.brandId) document.querySelector(`#shop-brand-pills [data-brand="${CSS.escape(collection.brandId)}"]`)?.click(); };
  window.setShopQuery = function setShopQuery(value) { state.query = String(value || ""); renderShop(); };
  window.toggleFilters = function toggleFilters(force) { const panel = document.getElementById("shop-filter-panel"); const open = typeof force === "boolean" ? force : !panel.classList.contains("open"); panel.classList.toggle("open", open); panel.setAttribute("aria-hidden", String(!open)); document.body.classList.toggle("filter-open", open); };
  window.resetShopFilters = function resetShopFilters() { Object.assign(state, { brand: "all", category: "all", collection: "all", size: "all", availability: "all", price: "all", query: "" }); document.querySelectorAll("#shop-brand-pills .pill").forEach((pill) => pill.classList.toggle("active", pill.dataset.brand === "all")); ["shop-category", "shop-collection", "shop-size", "shop-availability", "shop-price"].forEach((id) => { document.getElementById(id).value = "all"; }); document.getElementById("shop-search").value = ""; renderShop(); };
  window.toggleMarketplaceMenu = function toggleMarketplaceMenu(force) { const menu = document.getElementById("marketplace-menu"); const open = typeof force === "boolean" ? force : !menu.classList.contains("open"); menu.classList.toggle("open", open); menu.setAttribute("aria-hidden", String(!open)); };
  window.menuGo = function menuGo(id) { toggleMarketplaceMenu(false); go(id); };

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

  const legacyDestination = new URLSearchParams(location.search).get("legacy");
  if (legacyDestination) {
    history_ = ["home"];
    go("cabinet", { replace: true });
    history.replaceState({}, "", location.pathname);
  }
})();
