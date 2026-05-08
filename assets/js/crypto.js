/* Smart Menu Pro - Sécurité (PBKDF2 + AES-GCM via Web Crypto)
 * - Hash mot de passe : PBKDF2-SHA256, 600 000 itérations, salt 16 bytes aléatoire
 * - Chiffrement PAT GitHub : AES-GCM 256, clé dérivée du mot de passe (PBKDF2)
 *   IV 12 bytes aléatoire, tag d'authentification intégré
 */
(function (global) {
  'use strict';

  if (!global.crypto || !global.crypto.subtle) {
    throw new Error("Web Crypto API indisponible. Utilisez un navigateur moderne en HTTPS.");
  }

  const subtle = global.crypto.subtle;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const PBKDF2_ITERATIONS = 600000;
  const PBKDF2_HASH = 'SHA-256';
  const KEY_LENGTH_BITS = 256;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;

  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    global.crypto.getRandomValues(bytes);
    return bytes;
  }

  async function deriveKey(password, salt, usage) {
    const baseKey = await subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    return subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: PBKDF2_HASH,
      },
      baseKey,
      { name: 'AES-GCM', length: KEY_LENGTH_BITS },
      false,
      usage
    );
  }

  async function deriveHashBits(password, salt, bits = 256) {
    const baseKey = await subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    return subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: PBKDF2_HASH,
      },
      baseKey,
      bits
    );
  }

  function constantTimeEqual(a, b) {
    if (a.byteLength !== b.byteLength) return false;
    const av = new Uint8Array(a);
    const bv = new Uint8Array(b);
    let diff = 0;
    for (let i = 0; i < av.length; i++) {
      diff |= av[i] ^ bv[i];
    }
    return diff === 0;
  }

  /**
   * Génère le bloc d'authentification à stocker dans auth.json.
   * Le hash dérivé n'est PAS le mot de passe et ne permet pas de le retrouver
   * (PBKDF2 600k itérations, brute-force coûteux).
   */
  async function buildAuthRecord(password) {
    if (typeof password !== 'string' || password.length < 12) {
      throw new Error("Le mot de passe doit faire au moins 12 caractères.");
    }
    const salt = randomBytes(SALT_BYTES);
    const hashBits = await deriveHashBits(password, salt, 256);
    return {
      algorithm: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      salt: SMP.bytesToBase64(salt),
      hash: SMP.bytesToBase64(new Uint8Array(hashBits)),
      version: 1,
    };
  }

  /**
   * Vérifie un mot de passe par rapport à un enregistrement auth.json.
   */
  async function verifyPassword(password, authRecord) {
    if (!authRecord || authRecord.algorithm !== 'PBKDF2-SHA256') {
      throw new Error("Format auth.json invalide ou non supporté.");
    }
    const salt = SMP.base64ToBytes(authRecord.salt);
    const expected = SMP.base64ToBytes(authRecord.hash);
    const baseKey = await subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const actual = new Uint8Array(await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: authRecord.iterations || PBKDF2_ITERATIONS,
        hash: PBKDF2_HASH,
      },
      baseKey,
      expected.length * 8
    ));
    return constantTimeEqual(actual, expected);
  }

  /**
   * Chiffre un secret (PAT GitHub typiquement) avec AES-GCM,
   * en dérivant une clé du mot de passe via PBKDF2.
   * Le résultat est un objet sérialisable (salt, iv, ciphertext).
   */
  async function encryptSecret(plaintext, password) {
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const key = await deriveKey(password, salt, ['encrypt']);
    const ciphertext = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(plaintext)
    );
    return {
      v: 1,
      alg: 'AES-GCM-256+PBKDF2-SHA256',
      iter: PBKDF2_ITERATIONS,
      salt: SMP.bytesToBase64(salt),
      iv: SMP.bytesToBase64(iv),
      ct: SMP.bytesToBase64(new Uint8Array(ciphertext)),
    };
  }

  async function decryptSecret(envelope, password) {
    if (!envelope || envelope.alg !== 'AES-GCM-256+PBKDF2-SHA256') {
      throw new Error("Format chiffré invalide.");
    }
    const salt = SMP.base64ToBytes(envelope.salt);
    const iv = SMP.base64ToBytes(envelope.iv);
    const ct = SMP.base64ToBytes(envelope.ct);
    const key = await deriveKey(password, salt, ['decrypt']);
    try {
      const plain = await subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ct
      );
      return dec.decode(plain);
    } catch (e) {
      throw new Error("Déchiffrement impossible : mot de passe incorrect ou données altérées.");
    }
  }

  global.SMP = global.SMP || {};
  Object.assign(global.SMP, {
    buildAuthRecord,
    verifyPassword,
    encryptSecret,
    decryptSecret,
  });
})(typeof window !== 'undefined' ? window : globalThis);
