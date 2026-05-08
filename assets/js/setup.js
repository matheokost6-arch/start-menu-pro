/* Smart Menu Pro - Création d'un restaurant (génération des fichiers) */
(function () {
  'use strict';

  const form = document.getElementById('setup-form');
  const errorEl = document.getElementById('setup-error');
  const result = document.getElementById('setup-result');

  function buildDefaultMenu(name, description) {
    return {
      restaurant: {
        name: name || '',
        description: description || '',
        logo: '',
        address: '',
        phone: '',
      },
      categories: [
        {
          id: 'entrees',
          name: 'Entrées',
          icon: '🥗',
          items: [],
        },
        {
          id: 'plats',
          name: 'Plats',
          icon: '🍽️',
          items: [],
        },
        {
          id: 'desserts',
          name: 'Desserts',
          icon: '🍰',
          items: [],
        },
      ],
      lastUpdated: new Date().toISOString(),
    };
  }

  function buildDefaultTheme() {
    return {
      colors: {
        primary: '#27ae60',
        secondary: '#2c3e50',
        background: '#ffffff',
        text: '#1f2933',
      },
      fonts: {
        heading: 'Playfair Display',
        body: 'Inter',
      },
      borderRadius: 8,
    };
  }

  function downloadJSON(linkEl, filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    linkEl.href = URL.createObjectURL(blob);
    linkEl.download = filename;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    SMP.safeText(errorEl, '');

    const name = document.getElementById('setup-name').value.trim();
    const description = document.getElementById('setup-description').value.trim();
    const password = document.getElementById('setup-password').value;
    const confirm = document.getElementById('setup-password-confirm').value;

    if (!name) { SMP.safeText(errorEl, "Le nom du restaurant est requis."); return; }
    if (password.length < 12) { SMP.safeText(errorEl, "Le mot de passe doit faire au moins 12 caractères."); return; }
    if (password !== confirm) { SMP.safeText(errorEl, "Les mots de passe ne correspondent pas."); return; }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    SMP.safeText(errorEl, "Génération en cours (PBKDF2 600 000 itérations)...");

    try {
      const uuid = SMP.generateUUID();
      const auth = await SMP.buildAuthRecord(password);
      auth.uuid = uuid;
      auth.createdAt = new Date().toISOString();

      const menu = buildDefaultMenu(name, description);
      const theme = buildDefaultTheme();

      SMP.safeText(document.getElementById('result-uuid'), uuid);
      SMP.safeText(document.getElementById('result-menu'), JSON.stringify(menu, null, 2));
      SMP.safeText(document.getElementById('result-theme'), JSON.stringify(theme, null, 2));
      SMP.safeText(document.getElementById('result-auth'), JSON.stringify(auth, null, 2));

      const path = `data/clients/${uuid}/`;
      SMP.safeText(document.getElementById('result-path'), path);
      SMP.safeText(document.getElementById('next-path'), path);
      SMP.safeText(document.getElementById('next-url'), `menu.html?id=${uuid}`);

      downloadJSON(document.getElementById('download-menu'), 'menu.json', menu);
      downloadJSON(document.getElementById('download-theme'), 'theme.json', theme);
      downloadJSON(document.getElementById('download-auth'), 'auth.json', auth);

      result.hidden = false;
      SMP.bindCopyButtons(result);
      SMP.safeText(errorEl, '');
      result.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      SMP.safeText(errorEl, err.message || "Erreur inattendue lors de la génération.");
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
