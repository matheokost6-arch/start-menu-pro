/* Smart Menu Pro - Affichage du menu public */
(function () {
  'use strict';

  const KNOWN_ALLERGENS = [
    { id: 'gluten', label: 'Gluten' },
    { id: 'lactose', label: 'Lactose' },
    { id: 'oeuf', label: 'Œuf' },
    { id: 'arachide', label: 'Arachide' },
    { id: 'fruits-coque', label: 'Fruits à coque' },
    { id: 'soja', label: 'Soja' },
    { id: 'poisson', label: 'Poisson' },
    { id: 'crustaces', label: 'Crustacés' },
    { id: 'mollusques', label: 'Mollusques' },
    { id: 'celeri', label: 'Céleri' },
    { id: 'moutarde', label: 'Moutarde' },
    { id: 'sesame', label: 'Sésame' },
    { id: 'sulfites', label: 'Sulfites' },
    { id: 'lupin', label: 'Lupin' },
  ];

  const state = {
    menu: null,
    theme: null,
    excludedAllergens: new Set(),
    chefOnly: false,
  };

  function showError(message) {
    document.getElementById('loader').hidden = true;
    document.getElementById('menu-app').hidden = true;
    const errEl = document.getElementById('error-state');
    SMP.safeText(document.getElementById('error-message'), message);
    errEl.hidden = false;
  }

  function applyTheme(theme) {
    if (!theme) return;
    const root = document.documentElement;
    if (theme.colors) {
      if (theme.colors.primary) root.style.setProperty('--color-primary', theme.colors.primary);
      if (theme.colors.secondary) root.style.setProperty('--color-secondary', theme.colors.secondary);
      if (theme.colors.background) root.style.setProperty('--color-background', theme.colors.background);
      if (theme.colors.text) root.style.setProperty('--color-text', theme.colors.text);
    }
    if (theme.fonts) {
      if (theme.fonts.heading) root.style.setProperty('--font-heading', `'${theme.fonts.heading}', system-ui, sans-serif`);
      if (theme.fonts.body) root.style.setProperty('--font-body', `'${theme.fonts.body}', system-ui, sans-serif`);
    }
    if (theme.borderRadius !== undefined && theme.borderRadius !== null) {
      const r = String(theme.borderRadius).replace(/[^0-9]/g, '');
      if (r) root.style.setProperty('--radius', `${r}px`);
    }
    if (theme.fonts && (theme.fonts.heading || theme.fonts.body)) {
      const families = [theme.fonts.heading, theme.fonts.body].filter(Boolean).map(f => f.replace(/\s+/g, '+'));
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}:wght@400;700`).join('&')}&display=swap`;
      document.head.appendChild(link);
    }
  }

  function renderRestaurantHeader(restaurant) {
    SMP.safeText(document.getElementById('restaurant-name'), restaurant.name || 'Notre menu');
    SMP.safeText(document.getElementById('restaurant-description'), restaurant.description || '');

    const logo = document.getElementById('restaurant-logo');
    if (restaurant.logo && /^https?:\/\//i.test(restaurant.logo)) {
      logo.src = restaurant.logo;
      logo.alt = restaurant.name ? `Logo ${restaurant.name}` : '';
      logo.hidden = false;
    }

    const contact = [];
    if (restaurant.address) contact.push(restaurant.address);
    if (restaurant.phone) contact.push(restaurant.phone);
    SMP.safeText(document.getElementById('restaurant-contact'), contact.join(' · '));
    document.title = `${restaurant.name || 'Menu'} - Smart Menu Pro`;
  }

  function renderAllergenFilters(menu) {
    const usedAllergens = new Set();
    (menu.categories || []).forEach(cat => {
      (cat.items || []).forEach(item => {
        (item.allergens || []).forEach(a => usedAllergens.add(a));
      });
    });

    const container = document.getElementById('allergen-filters');
    container.innerHTML = '';

    KNOWN_ALLERGENS.filter(a => usedAllergens.has(a.id)).forEach(a => {
      const label = document.createElement('label');
      label.className = 'filter-chip';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = a.id;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) state.excludedAllergens.add(a.id);
        else state.excludedAllergens.delete(a.id);
        renderCategories();
      });
      const span = document.createElement('span');
      span.textContent = a.label;
      label.appendChild(checkbox);
      label.appendChild(span);
      container.appendChild(label);
    });

    if (!container.children.length) {
      container.parentElement.hidden = true;
    }
  }

  function passesFilters(item) {
    if (state.chefOnly && !item.isChefSuggestion) return false;
    if (item.allergens && state.excludedAllergens.size > 0) {
      for (const a of item.allergens) {
        if (state.excludedAllergens.has(a)) return false;
      }
    }
    return true;
  }

  function buildItemCard(item) {
    const li = document.createElement('li');
    li.className = 'menu-item';
    if (item.isChefSuggestion) li.classList.add('chef-suggestion');
    if (item.available === false) li.classList.add('unavailable');

    if (item.isChefSuggestion) {
      const badge = document.createElement('span');
      badge.className = 'chef-badge';
      badge.textContent = '⭐ Chef';
      li.appendChild(badge);
    }

    if (item.image && /^https?:\/\//i.test(item.image)) {
      const img = document.createElement('img');
      img.className = 'menu-item-image';
      img.src = item.image;
      img.alt = item.name || '';
      img.loading = 'lazy';
      li.appendChild(img);
    }

    const header = document.createElement('div');
    header.className = 'menu-item-header';
    const name = document.createElement('h3');
    name.className = 'menu-item-name';
    name.textContent = item.name || '';
    const price = document.createElement('span');
    price.className = 'menu-item-price';
    price.textContent = SMP.formatPrice(item.price);
    header.appendChild(name);
    header.appendChild(price);
    li.appendChild(header);

    if (item.description) {
      const desc = document.createElement('p');
      desc.className = 'menu-item-description';
      desc.textContent = item.description;
      li.appendChild(desc);
    }

    if (typeof item.stock === 'number' && item.stock <= 5 && item.stock > 0) {
      const stock = document.createElement('p');
      stock.className = 'stock-warning';
      stock.textContent = `⚠️ Plus que ${item.stock} en stock`;
      li.appendChild(stock);
    }

    if (item.available === false) {
      const out = document.createElement('p');
      out.className = 'stock-warning';
      out.textContent = 'Indisponible aujourd\'hui';
      li.appendChild(out);
    }

    if (item.allergens && item.allergens.length) {
      const tags = document.createElement('div');
      tags.className = 'menu-item-allergens';
      item.allergens.forEach(a => {
        const known = KNOWN_ALLERGENS.find(k => k.id === a);
        const tag = document.createElement('span');
        tag.className = 'allergen-tag';
        tag.textContent = known ? known.label : a;
        tags.appendChild(tag);
      });
      li.appendChild(tags);
    }

    return li;
  }

  function renderCategories() {
    const container = document.getElementById('menu-categories');
    container.innerHTML = '';
    const categories = state.menu.categories || [];

    let visibleCount = 0;
    categories.forEach(cat => {
      const items = (cat.items || []).filter(passesFilters);
      if (!items.length) return;
      visibleCount += items.length;

      const section = document.createElement('section');
      section.className = 'menu-category';
      const h = document.createElement('h2');
      const icon = cat.icon ? `${cat.icon} ` : '';
      h.textContent = `${icon}${cat.name || ''}`;
      section.appendChild(h);

      const ul = document.createElement('ul');
      ul.className = 'menu-items';
      items.forEach(item => ul.appendChild(buildItemCard(item)));
      section.appendChild(ul);
      container.appendChild(section);
    });

    if (visibleCount === 0) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Aucun plat ne correspond à vos filtres.';
      container.appendChild(empty);
    }
  }

  async function init() {
    const uuid = (SMP.getQueryParam('id') || '').trim().toLowerCase();
    if (!SMP.isValidUUID(uuid)) {
      showError("Identifiant de restaurant invalide ou manquant dans l'URL.");
      return;
    }

    try {
      const base = SMP.clientDataPath(uuid);
      const [menu, theme] = await Promise.all([
        SMP.fetchJSON(`${base}/menu.json`),
        SMP.fetchJSON(`${base}/theme.json`).catch(() => null),
      ]);

      state.menu = menu;
      state.theme = theme;
      applyTheme(theme);
      renderRestaurantHeader(menu.restaurant || {});
      renderAllergenFilters(menu);
      renderCategories();
      SMP.safeText(document.getElementById('last-updated'), SMP.formatDate(menu.lastUpdated));
      const lu = document.getElementById('last-updated');
      if (lu && menu.lastUpdated) lu.setAttribute('datetime', menu.lastUpdated);

      document.getElementById('loader').hidden = true;
      document.getElementById('menu-app').hidden = false;
    } catch (err) {
      showError(err.status === 404
        ? "Ce restaurant n'a pas encore publié son menu."
        : "Impossible de charger le menu. Vérifiez votre connexion.");
    }

    const chefBox = document.getElementById('filter-chef-only');
    chefBox.addEventListener('change', () => {
      state.chefOnly = chefBox.checked;
      renderCategories();
    });
  }

  init();
})();
