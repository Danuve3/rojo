const DB_NAME = 'rojo';
const DB_VERSION = 2;
export const KV = 'kv';
export const GAMES = 'games';
/** Partidas completas (para el análisis), con la misma clave que su entrada del historial. */
export const FULLGAMES = 'fullgames';
/** Tarjetas del repaso de errores (repetición espaciada). */
export const CARDS = 'cards';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
        if (!db.objectStoreNames.contains(GAMES)) db.createObjectStore(GAMES, { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains(FULLGAMES)) db.createObjectStore(FULLGAMES);
        if (!db.objectStoreNames.contains(CARDS)) db.createObjectStore(CARDS, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function request<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    return await request<T | undefined>(KV, 'readonly', (s) => s.get(key));
  } catch {
    return undefined;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    await request(KV, 'readwrite', (s) => s.put(value, key));
  } catch (e) {
    console.warn('No se pudo guardar', key, e);
  }
}

export async function kvDelete(key: string): Promise<void> {
  try {
    await request(KV, 'readwrite', (s) => s.delete(key));
  } catch {
    /* sin almacenamiento */
  }
}

export async function addRecord(store: string, value: unknown): Promise<IDBValidKey | null> {
  try {
    return await request<IDBValidKey>(store, 'readwrite', (s) => s.add(value));
  } catch (e) {
    console.warn('No se pudo guardar el registro', e);
    return null;
  }
}

export async function putRecord(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  try {
    await request(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key)));
  } catch (e) {
    console.warn('No se pudo guardar', e);
  }
}

export async function getRecord<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  try {
    return await request<T | undefined>(store, 'readonly', (s) => s.get(key));
  } catch {
    return undefined;
  }
}

export async function getAllKeys(store: string): Promise<IDBValidKey[]> {
  try {
    return await request<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys());
  } catch {
    return [];
  }
}

export async function deleteRecord(store: string, key: IDBValidKey): Promise<void> {
  try {
    await request(store, 'readwrite', (s) => s.delete(key));
  } catch {
    /* sin almacenamiento */
  }
}

export async function getAll<T>(store: string): Promise<T[]> {
  try {
    return await request<T[]>(store, 'readonly', (s) => s.getAll());
  } catch {
    return [];
  }
}

export async function clearAll(): Promise<void> {
  try {
    await request(KV, 'readwrite', (s) => s.clear());
    await request(GAMES, 'readwrite', (s) => s.clear());
    await request(FULLGAMES, 'readwrite', (s) => s.clear());
    await request(CARDS, 'readwrite', (s) => s.clear());
  } catch {
    /* sin almacenamiento */
  }
}
