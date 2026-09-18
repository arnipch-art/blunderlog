// IndexedDB: analyserade partier sparas i besökarens webbläsare, per användarnamn.
const DB = 'schackstat', STORE = 'reviews';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: 'key' });
      s.createIndex('user', 'user');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const res = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(res && res.result !== undefined ? res.result : res);
    t.onerror = () => reject(t.error);
  });
}

export async function loadReviews(user) {
  try {
    const db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).index('user').getAll(user.toLowerCase());
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

export async function saveReview(user, rec) {
  try {
    const db = await open();
    await tx(db, 'readwrite', (s) => s.put({ ...rec, key: `${user.toLowerCase()}:${rec.id}`, user: user.toLowerCase() }));
  } catch (e) { console.warn('kunde inte spara', e); }
}

export async function clearUser(user) {
  try {
    const db = await open();
    const recs = await loadReviews(user);
    await tx(db, 'readwrite', (s) => { for (const r of recs) s.delete(r.key); });
  } catch { /* ignore */ }
}
