/* Smart Menu Pro - Console d'administration
 * Sécurité :
 * - Mot de passe vérifié localement contre auth.json (PBKDF2 constant-time compare)
 * - PAT GitHub chiffré en mémoire de session via AES-GCM (clé dérivée du mot de passe)
 * - Aucun secret stocké en clair dans localStorage : seul le PAT chiffré l'est
 * - Le mot de passe lui-même n'est conservé que le temps de la session (sessionStorage chiffré non, in-memory only)
 */
(function () {
  'use strict';

  const KNOWN_ALLERGENS = [
    'gluten', 'lactose', 'oeuf', 'arachide', 'fruits-coque', 'soja',
    'poisson', 'crustaces', 'mollusques', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin',
  ];

  const session = {
    uuid: null,
    password: null,
    auth: null,
    menu: null,
    theme: null,
    githubConfig: null,
    githubPat: null,
    menuSha: null,
    themeSha: null,
  };

  const PAT_STORAGE_PREFIX = 'smp_github_';

  function $(id) { return document.getElementById(id); }
  function setText(id, txt) { SMP.safeText($(id), txt); }

  function showSection(id) {
    ['login-section', 'github-section', 'editor-section'].forEach(s => {
      $(s).hidden = (s !== id);
    });
  }

  function setStatus(message, kind = 'info') {
    const pill = $('admin-status');
    if (!message) { pill.hidden = true; return; }
    pill.hidden = false;
    pill.textContent = message;
    pill.style.background = kind === 'error' ? 'var(--color-danger)' :
                            kind === 'warn' ? 'var(--color-warning)' :
                            'var(--color-success)';
  }

  function logout() {
    session.uuid = null;
    session.password = null;
    session.auth = null;
    session.menu = null;
    session.theme = null;
    session.githubConfig = null;
    session.githubPat = null;
    showSection('login-section');
    $('logout-btn').hidden = true;
    setStatus('');
  }

  $('logout-btn').addEventListener('click', logout);

  /* === LOGIN === */
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    setText('login-error', '');

    const uuid = $('login-uuid').value.trim().toLowerCase();
    const password = $('login-password').value;

    if (!SMP.isValidUUID(uuid)) {
      setText('login-error', "UUID invalide.");
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    setText('login-error', "Vérification en cours...");

    try {
      const base = SMP.clientDataPath(uuid);
      const auth = await SMP.fetchJSON(`${base}/auth.json`);
      const ok = await SMP.verifyPassword(password, auth);
      if (!ok) {
        setText('login-error', "Mot de passe incorrect.");
        return;
      }

      const [menu, theme] = await Promise.all([
        SMP.fetchJSON(`${base}/menu.json`),
        SMP.fetchJSON(`${base}/theme.json`).catch(() => ({})),
      ]);

      session.uuid = uuid;
      session.password = password;
      session.auth = auth;
      session.menu = menu;
      session.theme = theme;

      $('logout-btn').hidden = false;
      setStatus(`Connecté · ${uuid.slice(0, 8)}…`);

      const stored = localStorage.getItem(PAT_STORAGE_PREFIX + uuid);
      if (stored) {
        try {
          const envelope = JSON.parse(stored);
          const pat = await SMP.decryptSecret(envelope, password);
          session.githubPat = pat;
          session.githubConfig = {
            repo: envelope.repo || '',
            branch: envelope.branch || 'main',
          };
          openEditor();
          return;
        } catch (err) {
          localStorage.removeItem(PAT_STORAGE_PREFIX + uuid);
        }
      }

      showSection('github-section');
      setText('login-error', '');
    } catch (err) {
      setText('login-error',
        err.status === 404
          ? "Ce restaurant n'existe pas (auth.json introuvable)."
          : (err.message || "Erreur inattendue."));
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* === CONFIG GITHUB === */
  $('github-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    setText('github-status', '');

    const repo = $('github-repo').value.trim();
    const branch = $('github-branch').value.trim() || 'main';
    const pat = $('github-pat').value.trim();

    if (!/^[^/]+\/[^/]+$/.test(repo)) {
      setText('github-status', "Format de dépôt invalide. Exemple : utilisateur/dépôt.");
      return;
    }
    if (!pat) {
      setText('github-status', "Token requis.");
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    setText('github-status', "Vérification de l'accès au dépôt...");

    try {
      await SMP.github.checkAccess({ pat, repo, branch });
      const envelope = await SMP.encryptSecret(pat, session.password);
      envelope.repo = repo;
      envelope.branch = branch;
      localStorage.setItem(PAT_STORAGE_PREFIX + session.uuid, JSON.stringify(envelope));

      session.githubPat = pat;
      session.githubConfig = { repo, branch };
      openEditor();
    } catch (err) {
      setText('github-status', err.message || "Échec de la configuration GitHub.");
    } finally {
      btn.disabled = false;
    }
  });

  /* === ÉDITEUR === */
  function openEditor() {
    showSection('editor-section');
    fillRestaurantTab();
    fillThemeTab();
    renderCategoriesEditor();
    setText('publish-status', '');
  }

  function fillRestaurantTab() {
    const r = (session.menu && session.menu.restaurant) || {};
    $('info-name').value = r.name || '';
    $('info-description').value = r.description || '';
    $('info-logo').value = r.logo || '';
    $('info-address').value = r.address || '';
    $('info-phone').value = r.phone || '';
  }

  function fillThemeTab() {
    const t = session.theme || {};
    const c = t.colors || {};
    const f = t.fonts || {};
    $('theme-primary').value = c.primary || '#27ae60';
    $('theme-secondary').value = c.secondary || '#2c3e50';
    $('theme-bg').value = c.background || '#ffffff';
    $('theme-text').value = c.text || '#1f2933';
    $('theme-radius').value = parseInt(t.borderRadius, 10) || 8;
    $('theme-font-heading').value = f.heading || 'Playfair Display';
    $('theme-font-body').value = f.body || 'Inter';
  }

  function readRestaurantTab() {
    return {
      name: $('info-name').value.trim(),
      description: $('info-description').value.trim(),
      logo: $('info-logo').value.trim(),
      address: $('info-address').value.trim(),
      phone: $('info-phone').value.trim(),
    };
  }

  function readThemeTab() {
    return {
      colors: {
        primary: $('theme-primary').value,
        secondary: $('theme-secondary').value,
        background: $('theme-bg').value,
        text: $('theme-text').value,
      },
      fonts: {
        heading: $('theme-font-heading').value.trim() || 'Inter',
        body: $('theme-font-body').value.trim() || 'Inter',
      },
      borderRadius: parseInt($('theme-radius').value, 10) || 0,
    };
  }

  /* Catégories & plats — éditeur dynamique */
  function renderCategoriesEditor() {
    const container = $('categories-editor');
    container.innerHTML = '';
    const cats = (session.menu && session.menu.categories) || [];
    cats.forEach((cat, ci) => container.appendChild(buildCategoryBlock(cat, ci)));
  }

  function buildCategoryBlock(cat, ci) {
    const block = document.createElement('div');
    block.className = 'category-block';
    block.dataset.ci = ci;

    const header = document.createElement('div');
    header.className = 'category-block-header';

    const nameField = document.createElement('div');
    nameField.className = 'form-group';
    nameField.style.margin = 0;
    nameField.innerHTML = '<label>Nom de la catégorie</label>';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = cat.name || '';
    nameInput.dataset.field = 'category-name';
    nameField.appendChild(nameInput);

    const iconField = document.createElement('div');
    iconField.className = 'form-group';
    iconField.style.margin = 0;
    iconField.innerHTML = '<label>Icône</label>';
    const iconInput = document.createElement('input');
    iconInput.type = 'text';
    iconInput.value = cat.icon || '';
    iconInput.maxLength = 4;
    iconInput.dataset.field = 'category-icon';
    iconField.appendChild(iconInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-secondary btn-sm';
    removeBtn.textContent = 'Supprimer';
    removeBtn.addEventListener('click', () => {
      if (confirm(`Supprimer la catégorie "${cat.name || ''}" et tous ses plats ?`)) {
        session.menu.categories.splice(ci, 1);
        renderCategoriesEditor();
      }
    });

    header.appendChild(nameField);
    header.appendChild(iconField);
    header.appendChild(removeBtn);
    block.appendChild(header);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'items-container';
    (cat.items || []).forEach((item, ii) => {
      itemsContainer.appendChild(buildItemBlock(item, ci, ii));
    });
    block.appendChild(itemsContainer);

    const addItemBtn = document.createElement('button');
    addItemBtn.type = 'button';
    addItemBtn.className = 'btn btn-secondary btn-sm';
    addItemBtn.textContent = '+ Ajouter un plat';
    addItemBtn.addEventListener('click', () => {
      session.menu.categories[ci].items = session.menu.categories[ci].items || [];
      session.menu.categories[ci].items.push({
        id: SMP.generateUUID().slice(0, 8),
        name: '',
        description: '',
        price: 0,
        allergens: [],
        available: true,
        isChefSuggestion: false,
      });
      renderCategoriesEditor();
    });
    block.appendChild(addItemBtn);

    return block;
  }

  function buildItemBlock(item, ci, ii) {
    const block = document.createElement('div');
    block.className = 'item-block';
    block.dataset.ci = ci;
    block.dataset.ii = ii;

    const grid = document.createElement('div');
    grid.className = 'item-block-grid';

    grid.appendChild(field('Nom', 'text', item.name || '', 'item-name'));
    grid.appendChild(field('Prix (€)', 'number', item.price ?? 0, 'item-price', { step: '0.10', min: '0' }));
    grid.appendChild(field('Description', 'text', item.description || '', 'item-description'));
    grid.appendChild(field('URL image', 'url', item.image || '', 'item-image'));
    grid.appendChild(field('Stock (vide = illimité)', 'number', item.stock ?? '', 'item-stock', { min: '0' }));

    const allergenWrap = document.createElement('div');
    allergenWrap.className = 'form-group';
    allergenWrap.style.margin = 0;
    allergenWrap.style.gridColumn = '1 / -1';
    allergenWrap.innerHTML = '<label>Allergènes</label>';
    const chips = document.createElement('div');
    chips.className = 'filter-chips';
    KNOWN_ALLERGENS.forEach(a => {
      const lbl = document.createElement('label');
      lbl.className = 'filter-chip';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = a;
      cb.checked = (item.allergens || []).includes(a);
      cb.dataset.field = 'item-allergen';
      const span = document.createElement('span');
      span.textContent = a;
      lbl.appendChild(cb);
      lbl.appendChild(span);
      chips.appendChild(lbl);
    });
    allergenWrap.appendChild(chips);
    grid.appendChild(allergenWrap);

    block.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'item-block-actions';

    const availLbl = document.createElement('label');
    availLbl.className = 'filter-chip';
    const avail = document.createElement('input');
    avail.type = 'checkbox';
    avail.dataset.field = 'item-available';
    avail.checked = item.available !== false;
    availLbl.appendChild(avail);
    const availSpan = document.createElement('span'); availSpan.textContent = 'Disponible';
    availLbl.appendChild(availSpan);
    actions.appendChild(availLbl);

    const chefLbl = document.createElement('label');
    chefLbl.className = 'filter-chip';
    const chef = document.createElement('input');
    chef.type = 'checkbox';
    chef.dataset.field = 'item-chef';
    chef.checked = !!item.isChefSuggestion;
    chefLbl.appendChild(chef);
    const chefSpan = document.createElement('span'); chefSpan.textContent = '⭐ Suggestion du chef';
    chefLbl.appendChild(chefSpan);
    actions.appendChild(chefLbl);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-secondary btn-sm';
    del.textContent = 'Supprimer';
    del.addEventListener('click', () => {
      session.menu.categories[ci].items.splice(ii, 1);
      renderCategoriesEditor();
    });
    actions.appendChild(del);

    block.appendChild(actions);
    return block;
  }

  function field(label, type, value, fieldName, extra = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.style.margin = 0;
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.dataset.field = fieldName;
    Object.entries(extra).forEach(([k, v]) => input.setAttribute(k, v));
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    return wrap;
  }

  function collectCategoriesFromDOM() {
    const blocks = document.querySelectorAll('.category-block');
    const cats = [];
    blocks.forEach((block, ci) => {
      const name = block.querySelector('[data-field="category-name"]').value.trim();
      const icon = block.querySelector('[data-field="category-icon"]').value.trim();
      const items = [];
      block.querySelectorAll('.item-block').forEach((ib, ii) => {
        const get = sel => ib.querySelector(`[data-field="${sel}"]`);
        const stockRaw = get('item-stock').value;
        const allergens = Array.from(ib.querySelectorAll('[data-field="item-allergen"]:checked')).map(c => c.value);
        items.push({
          id: (session.menu.categories[ci] && session.menu.categories[ci].items && session.menu.categories[ci].items[ii] && session.menu.categories[ci].items[ii].id) || SMP.generateUUID().slice(0, 8),
          name: get('item-name').value.trim(),
          description: get('item-description').value.trim(),
          price: parseFloat(get('item-price').value) || 0,
          image: get('item-image').value.trim(),
          stock: stockRaw === '' ? null : (parseInt(stockRaw, 10) || 0),
          allergens,
          available: get('item-available').checked,
          isChefSuggestion: get('item-chef').checked,
        });
      });
      const existing = session.menu.categories[ci] || {};
      cats.push({
        id: existing.id || (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : SMP.generateUUID().slice(0, 8)),
        name, icon, items,
      });
    });
    return cats;
  }

  /* Onglets */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  /* Ajouter une catégorie */
  $('add-category-btn').addEventListener('click', () => {
    session.menu.categories = session.menu.categories || [];
    session.menu.categories.push({
      id: SMP.generateUUID().slice(0, 8),
      name: 'Nouvelle catégorie',
      icon: '🍴',
      items: [],
    });
    renderCategoriesEditor();
  });

  /* Prévisualiser */
  $('preview-btn').addEventListener('click', () => {
    window.open(`menu.html?id=${session.uuid}`, '_blank', 'noopener');
  });

  /* Publier */
  $('publish-btn').addEventListener('click', async () => {
    setText('publish-status', '');
    if (!session.githubPat) {
      setText('publish-status', "Token GitHub non configuré.");
      return;
    }

    const btn = $('publish-btn');
    btn.disabled = true;
    try {
      session.menu.restaurant = readRestaurantTab();
      session.menu.categories = collectCategoriesFromDOM();
      session.menu.lastUpdated = new Date().toISOString();
      session.theme = readThemeTab();

      setText('publish-status', "Publication sur GitHub en cours...");
      const { repo, branch } = session.githubConfig;
      const basePath = `data/clients/${session.uuid}`;

      const menuExisting = await SMP.github.getFile({
        pat: session.githubPat, repo, branch, path: `${basePath}/menu.json`,
      });
      const themeExisting = await SMP.github.getFile({
        pat: session.githubPat, repo, branch, path: `${basePath}/theme.json`,
      });

      await SMP.github.putFile({
        pat: session.githubPat, repo, branch,
        path: `${basePath}/menu.json`,
        content: JSON.stringify(session.menu, null, 2),
        message: `Mise à jour menu ${session.uuid.slice(0, 8)}`,
        sha: menuExisting && menuExisting.sha,
      });

      await SMP.github.putFile({
        pat: session.githubPat, repo, branch,
        path: `${basePath}/theme.json`,
        content: JSON.stringify(session.theme, null, 2),
        message: `Mise à jour thème ${session.uuid.slice(0, 8)}`,
        sha: themeExisting && themeExisting.sha,
      });

      setText('publish-status', "✓ Publié. GitHub Pages se redéploiera dans ~1 min.");
    } catch (err) {
      setText('publish-status', "Échec : " + (err.message || 'erreur inconnue'));
    } finally {
      btn.disabled = false;
    }
  });
})();
