/* Smart Menu Pro - Utilitaires partagés */
(function (global) {
  'use strict';

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function generateUUID() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    global.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function isValidUUID(value) {
    return typeof value === 'string' && UUID_REGEX.test(value);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeText(el, value) {
    if (!el) return;
    el.textContent = value === null || value === undefined ? '' : String(value);
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return global.btoa(binary);
  }

  function base64ToBytes(b64) {
    const binary = global.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function formatPrice(value, currency = '€') {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    return `${num.toFixed(2).replace('.', ',')} ${currency}`;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function getQueryParam(name) {
    const params = new URLSearchParams(global.location.search);
    return params.get(name);
  }

  function clientDataPath(uuid) {
    return `data/clients/${uuid}`;
  }

  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const err = new Error(`Requête échouée (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  function copyToClipboard(text) {
    if (global.navigator && global.navigator.clipboard) {
      return global.navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  function bindCopyButtons(root = document) {
    root.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.getAttribute('data-copy'));
        if (!target) return;
        copyToClipboard(target.textContent || target.value || '').then(() => {
          const original = btn.textContent;
          btn.textContent = 'Copié ✓';
          setTimeout(() => { btn.textContent = original; }, 1500);
        });
      });
    });
  }

  global.SMP = global.SMP || {};
  Object.assign(global.SMP, {
    generateUUID,
    isValidUUID,
    escapeHtml,
    safeText,
    bytesToBase64,
    base64ToBytes,
    formatPrice,
    formatDate,
    getQueryParam,
    clientDataPath,
    fetchJSON,
    copyToClipboard,
    bindCopyButtons,
  });
})(typeof window !== 'undefined' ? window : globalThis);
