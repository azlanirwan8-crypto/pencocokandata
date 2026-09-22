// IndexedDB storage utility for persistent local storage in browser
const DB_NAME = 'ToolsDataMatcherDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

let cachedDBPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!cachedDBPromise) {
    cachedDBPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        cachedDBPromise = null;
        reject(request.error);
      };
    });
  }
  return cachedDBPromise;
}

export async function setItem<T>(key: string, value: T): Promise<boolean> {
  const db = await getDB().catch((err) => {
    console.warn('Gagal membuka IndexedDB:', err);
    return null;
  });
  if (!db) {
    laporGagalSimpan(key);
    return false;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return true;
  } catch (err) {
    console.warn('Gagal menyimpan ke IndexedDB:', key, err);
    laporGagalSimpan(key);
    return false;
  }
}

// Kegagalan tulis browser = risiko kehilangan kerjaan, jadi tidak boleh hilang tanpa suara.
// Panggilan api/ dan satu-off membuang rejection-nya (`.catch(() => {})`), jadi laporan
// dilakukan di sini dan App.tsx yang menerjemahkannya jadi satu notifikasi.
export const PERISTIWA_GAGAL_LOKAL = 'pencocokan:gagal-simpan-lokal';

function laporGagalSimpan(key: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PERISTIWA_GAGAL_LOKAL, { detail: { key } }));
  }
}

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Gagal membaca dari IndexedDB:', err);
    return null;
  }
}

// Penulisan array puluhan ribu baris (mis. hasil Analisa 83 ribu) jangan dilakukan
// per klik — gabungkan penulisan terdekat supaya structured-clone hanya sekali.
const pendingWrites = new Map<string, { value: unknown; timer: ReturnType<typeof setTimeout> }>();

export function setItemDebounced<T>(key: string, value: T, delayMs = 600): void {
  const prev = pendingWrites.get(key);
  if (prev) clearTimeout(prev.timer);
  const timer = setTimeout(() => {
    pendingWrites.delete(key);
    void setItem(key, value);
  }, delayMs);
  pendingWrites.set(key, { value, timer });
}

export function cancelPendingWrite(key: string): void {
  const pending = pendingWrites.get(key);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingWrites.delete(key);
}

export async function flushPendingWrites(): Promise<{ jumlah: number; gagal: number }> {
  const jobs = Array.from(pendingWrites.entries());
  jobs.forEach(([key, job]) => {
    clearTimeout(job.timer);
    pendingWrites.delete(key);
  });
  const hasil = await Promise.all(jobs.map(([key, job]) => setItem(key, job.value)));
  return { jumlah: jobs.length, gagal: hasil.filter((ok) => !ok).length };
}

export async function deleteKey(key: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      // NotFoundError (key belum ada) bukan masalah — tetap anggap berhasil
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('Gagal menghapus key dari IndexedDB:', err);
  }
}

export async function clearAllStorage(): Promise<void> {
  pendingWrites.forEach((job) => clearTimeout(job.timer));
  pendingWrites.clear();
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Gagal membersihkan IndexedDB:', err);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flushPendingWrites();
  });
}
