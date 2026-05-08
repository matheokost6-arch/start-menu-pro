/* Smart Menu Pro - Paramètres internes
 *
 * ⚠️ Note : ce fichier est servi publiquement par GitHub Pages.
 * L'obfuscation ci-dessous est cosmétique — elle gêne un curieux qui
 * parcourt le code, pas une personne qui inspecte le trafic réseau.
 * La vraie protection : scope restreint (public_repo) + révocation
 * rapide en cas d'abus → https://github.com/settings/tokens
 */
(function (global) {
  'use strict';

  function _x(parts, k) {
    const raw = atob(parts.join(''));
    let o = '';
    for (let i = 0; i < raw.length; i++) {
      o += String.fromCharCode(raw.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    }
    return o;
  }

  const _p = ['FAUAcn9BAwFnEQguKwcLVCloXAI6', 'HAMieHVDRVgdMywRK0AICVpjHg=='];
  const _s = 'smp-2026-internal-key';

  global.SMP = global.SMP || {};
  global.SMP.config = {
    repo: 'matheokost6-arch/start-menu-pro',
    branch: 'main',
    get pat() { return _x(_p, _s); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
