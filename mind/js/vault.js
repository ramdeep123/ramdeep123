// Encrypted storage on the phone (handoff §10).
//
// - Everything is saved as one AES-GCM encrypted record in IndexedDB.
// - Without a PIN, the key is a random, non-extractable device key that never
//   leaves the browser's key store (protects against simple file copies).
// - With a PIN, the key is derived from the PIN (PBKDF2-SHA-256), so the map
//   cannot be read without it. There is no PIN recovery — by design.
// - wipe() deletes the database: "delete everything" really deletes.
//
// The storage backend is injectable so the same code runs in Node tests.

const enc = new TextEncoder();
const dec = new TextDecoder();
export const PBKDF2_ITERATIONS = 210000;
const GUARD_FREE_TRIES = 5;

export function createVault({ backend, subtle = globalThis.crypto.subtle, iterations = PBKDF2_ITERATIONS, random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)) } = {}) {
  let key = null;
  let mode = 'device';
  let salt = null;

  async function deviceKey() {
    let k = await backend.get('deviceKey');
    if (!k) {
      k = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await backend.set('deviceKey', k);
    }
    return k;
  }

  async function pinKey(pin, s, iter = iterations) {
    const base = await subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', salt: s, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  async function seal(obj, k = key) {
    const iv = random(12);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj)));
    return { iv, ct: new Uint8Array(ct) };
  }

  async function open(rec, k = key) {
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, k, rec.ct);
    return JSON.parse(dec.decode(pt));
  }

  /** Wrong-PIN guard: 5 free tries, then a growing wait. */
  async function guard() {
    return (await backend.get('pinGuard')) || { fails: 0, until: 0 };
  }

  return {
    get mode() { return mode; },

    /** 'empty' | 'device' | 'pin' */
    async status() {
      const rec = await backend.get('vault');
      return rec ? rec.mode : 'empty';
    },

    /** → state, null (nothing saved yet) or { locked: true } */
    async load() {
      const rec = await backend.get('vault');
      if (!rec) { mode = 'device'; key = await deviceKey(); return null; }
      if (rec.mode === 'pin') { mode = 'pin'; return { locked: true }; }
      mode = 'device';
      key = await deviceKey();
      return open(rec);
    },

    /** → { until } while blocked after too many wrong PINs */
    async waitTime(now = Date.now()) {
      const g = await guard();
      return Math.max(0, g.until - now);
    },

    async unlock(pin, now = Date.now()) {
      const rec = await backend.get('vault');
      if (!rec || rec.mode !== 'pin') throw new Error('not-locked');
      const g = await guard();
      if (g.until > now) throw Object.assign(new Error('wait'), { wait: g.until - now });
      const k = await pinKey(pin, rec.salt, rec.iterations || iterations);
      try {
        const state = await open(rec, k);
        key = k; mode = 'pin'; salt = rec.salt;
        await backend.set('pinGuard', { fails: 0, until: 0 });
        return state;
      } catch (e) {
        const fails = g.fails + 1;
        const until = fails >= GUARD_FREE_TRIES ? now + 30000 * 2 ** (fails - GUARD_FREE_TRIES) : 0;
        await backend.set('pinGuard', { fails, until });
        throw Object.assign(new Error('wrong-pin'), { fails, wait: until ? until - now : 0 });
      }
    },

    async save(state) {
      if (!key) key = await deviceKey();
      const sealed = await seal(state);
      await backend.set('vault', { v: 1, mode, salt, iterations, ...sealed, savedAt: Date.now() });
    },

    async setPin(pin, state) {
      salt = random(16);
      key = await pinKey(pin, salt);
      mode = 'pin';
      await this.save(state);
    },

    async clearPin(state) {
      salt = null;
      mode = 'device';
      key = await deviceKey();
      await this.save(state);
    },

    /** Check a PIN against the saved record without changing anything. */
    async checkPin(pin) {
      const rec = await backend.get('vault');
      if (!rec || rec.mode !== 'pin') return false;
      try { await open(rec, await pinKey(pin, rec.salt, rec.iterations || iterations)); return true; } catch (e) { return false; }
    },

    /** Lock again (e.g. after the app was in the background): forget the key. */
    lock() {
      if (mode === 'pin') key = null;
    },

    async wipe() {
      key = null; mode = 'device'; salt = null;
      await backend.destroy();
    },
  };
}

/** In-memory backend: tests, and browsers that block IndexedDB. */
export function memoryBackend() {
  const m = new Map();
  return {
    persistent: false,
    async get(k) { return m.get(k); },
    async set(k, v) { m.set(k, v); },
    async del(k) { m.delete(k); },
    async destroy() { m.clear(); },
  };
}

/** IndexedDB backend (browser / Android WebView). */
export function idbBackend(name = 'know-your-mind') {
  let dbp = null;
  const db = () => (dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const tx = async (mode, fn) => {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction('kv', mode);
      const r = fn(t.objectStore('kv'));
      t.oncomplete = () => resolve(r?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  };
  return {
    persistent: true,
    get: (k) => tx('readonly', (s) => s.get(k)),
    set: (k, v) => tx('readwrite', (s) => s.put(v, k)),
    del: (k) => tx('readwrite', (s) => s.delete(k)),
    async destroy() {
      if (dbp) { (await dbp).close(); dbp = null; }
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      });
    },
  };
}

/** IndexedDB if it works here, otherwise memory (nothing is kept). */
export async function bestBackend() {
  try {
    if (!globalThis.indexedDB) throw new Error('no idb');
    const b = idbBackend();
    await b.get('probe');
    return b;
  } catch (e) {
    return memoryBackend();
  }
}
