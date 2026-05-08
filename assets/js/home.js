/* Smart Menu Pro - Page d'accueil */
(function () {
  'use strict';

  const form = document.getElementById('open-menu-form');
  const input = document.getElementById('uuid-input');
  const errorEl = document.getElementById('open-menu-error');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    SMP.safeText(errorEl, '');
    const value = (input.value || '').trim().toLowerCase();
    if (!SMP.isValidUUID(value)) {
      SMP.safeText(errorEl, "L'identifiant doit être un UUID valide.");
      input.focus();
      return;
    }
    window.location.href = `menu.html?id=${encodeURIComponent(value)}`;
  });
})();
