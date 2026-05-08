/* Smart Menu Pro - Wrapper GitHub Contents API
 * Permet de lire/écrire un fichier JSON dans un dépôt GitHub via la Contents API.
 * Le PAT est passé en argument à chaque appel — jamais stocké en clair dans ce module.
 */
(function (global) {
  'use strict';

  const API_BASE = 'https://api.github.com';

  function authHeaders(pat) {
    return {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    return SMP.bytesToBase64(bytes);
  }

  function base64ToUtf8(b64) {
    const bytes = SMP.base64ToBytes(b64.replace(/\s/g, ''));
    return new TextDecoder().decode(bytes);
  }

  async function getFile({ pat, repo, branch, path }) {
    const url = `${API_BASE}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, { headers: authHeaders(pat) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub : lecture impossible (${res.status})`);
    const data = await res.json();
    return {
      sha: data.sha,
      content: base64ToUtf8(data.content),
    };
  }

  async function putFile({ pat, repo, branch, path, content, message, sha }) {
    const url = `${API_BASE}/repos/${repo}/contents/${path}`;
    const body = {
      message: message || `Mise à jour de ${path}`,
      content: utf8ToBase64(content),
      branch,
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...authHeaders(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(`GitHub : écriture impossible (${res.status}) ${detail.message || ''}`);
    }
    return res.json();
  }

  async function checkAccess({ pat, repo, branch }) {
    const url = `${API_BASE}/repos/${repo}/branches/${encodeURIComponent(branch)}`;
    const res = await fetch(url, { headers: authHeaders(pat) });
    if (res.status === 404) throw new Error("Dépôt ou branche introuvable.");
    if (res.status === 401 || res.status === 403) throw new Error("Token rejeté ou permissions insuffisantes.");
    if (!res.ok) throw new Error(`GitHub : vérification impossible (${res.status}).`);
    return true;
  }

  global.SMP = global.SMP || {};
  global.SMP.github = { getFile, putFile, checkAccess };
})(typeof window !== 'undefined' ? window : globalThis);
