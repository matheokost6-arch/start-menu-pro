/* Smart Menu Pro - Création d'un restaurant
 * Génère le dossier client + pousse automatiquement sur GitHub via l'API.
 * Le restaurateur n'a rien à faire d'autre que remplir le formulaire.
 */
(function () {
  'use strict';

  const form = document.getElementById('setup-form');
  const formSection = document.getElementById('setup-form-section');
  const errorEl = document.getElementById('setup-error');
  const submitBtn = document.getElementById('setup-submit');

  const progressSection = document.getElementById('setup-progress');
  const progressStep = document.getElementById('progress-step');
  const progressFill = document.getElementById('progress-fill');

  const successSection = document.getElementById('setup-success');

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
        { id: 'entrees', name: 'Entrées', icon: '🥗', items: [] },
        { id: 'plats', name: 'Plats', icon: '🍽️', items: [] },
        { id: 'desserts', name: 'Desserts', icon: '🍰', items: [] },
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
      fonts: { heading: 'Playfair Display', body: 'Inter' },
      borderRadius: 8,
    };
  }

  function setProgress(stepText, percent) {
    SMP.safeText(progressStep, stepText);
    if (progressFill) progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function showProgress() {
    formSection.hidden = true;
    successSection.hidden = true;
    progressSection.hidden = false;
  }

  function showSuccess({ uuid, name }) {
    progressSection.hidden = true;
    formSection.hidden = true;
    successSection.hidden = false;

    const baseUrl = `${location.origin}${location.pathname.replace(/setup\.html$/, '')}`;
    const menuUrl = `${baseUrl}menu.html?id=${uuid}`;
    const adminUrl = `${baseUrl}admin.html?id=${uuid}`;

    SMP.safeText(document.getElementById('success-name'), name);
    SMP.safeText(document.getElementById('success-uuid'), uuid);
    SMP.safeText(document.getElementById('success-menu-url'), menuUrl);

    document.getElementById('success-admin-link').href = adminUrl;

    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&data=${encodeURIComponent(menuUrl)}`;
    document.getElementById('success-qr').src = qrSrc;
    document.getElementById('success-qr-download').href = qrSrc;

    SMP.bindCopyButtons(successSection);
    successSection.scrollIntoView({ behavior: 'smooth' });
  }

  function showError(msg) {
    progressSection.hidden = true;
    formSection.hidden = false;
    SMP.safeText(errorEl, msg);
    submitBtn.disabled = false;
  }

  async function pushClientFiles({ uuid, auth, menu, theme }) {
    const cfg = SMP.config;
    if (!cfg || !cfg.pat || cfg.pat === 'COLLE_TON_TOKEN_ICI') {
      throw new Error("Le token GitHub n'est pas configuré (assets/js/config.js).");
    }
    const base = { pat: cfg.pat, repo: cfg.repo, branch: cfg.branch };
    const dir = `data/clients/${uuid}`;

    setProgress('Enregistrement de l\'authentification…', 30);
    await SMP.github.putFile({
      ...base,
      path: `${dir}/auth.json`,
      content: JSON.stringify(auth, null, 2),
      message: `Création client ${uuid} : auth`,
    });

    setProgress('Enregistrement du menu…', 55);
    await SMP.github.putFile({
      ...base,
      path: `${dir}/menu.json`,
      content: JSON.stringify(menu, null, 2),
      message: `Création client ${uuid} : menu`,
    });

    setProgress('Enregistrement du thème…', 80);
    await SMP.github.putFile({
      ...base,
      path: `${dir}/theme.json`,
      content: JSON.stringify(theme, null, 2),
      message: `Création client ${uuid} : thème`,
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    SMP.safeText(errorEl, '');

    const name = document.getElementById('setup-name').value.trim();
    const description = document.getElementById('setup-description').value.trim();
    const password = document.getElementById('setup-password').value;
    const confirm = document.getElementById('setup-password-confirm').value;

    if (!name) return showError("Le nom du restaurant est requis.");
    if (password.length < 12) return showError("Le mot de passe doit faire au moins 12 caractères.");
    if (password !== confirm) return showError("Les mots de passe ne correspondent pas.");

    submitBtn.disabled = true;
    showProgress();

    try {
      setProgress('Sécurisation du mot de passe (PBKDF2 600 000 itérations)…', 10);
      const uuid = SMP.generateUUID();
      const auth = await SMP.buildAuthRecord(password);
      auth.uuid = uuid;
      auth.createdAt = new Date().toISOString();

      const menu = buildDefaultMenu(name, description);
      const theme = buildDefaultTheme();

      await pushClientFiles({ uuid, auth, menu, theme });

      setProgress('Finalisation…', 100);
      showSuccess({ uuid, name });
    } catch (err) {
      const msg = err && err.message
        ? `Erreur : ${err.message}`
        : "Erreur inattendue lors de la création du menu.";
      showError(msg);
    }
  });
})();
