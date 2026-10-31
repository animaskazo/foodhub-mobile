import AsyncStorage from '@react-native-async-storage/async-storage';

// Caché simple con stale-while-revalidate:
// - memoria para lecturas síncronas instantáneas (cambio de tab sin spinner)
// - AsyncStorage para persistir entre reinicios (best-effort)
// - deduplicación de fetches en vuelo

const memory = new Map(); // key -> { data, expiresAt }
const inflight = new Map(); // key -> Promise
const PREFIX = 'fh-cache:';

const now = () => Date.now();

function readMemory(key, allowStale = true) {
  const entry = memory.get(key);
  if (!entry) return null;
  const fresh = entry.expiresAt > now();
  if (!fresh && !allowStale) return null;
  return { data: entry.data, fresh };
}

/** Lectura síncrona para estado inicial: devuelve datos aunque estén vencidos. */
export function peekCache(key) {
  const hit = readMemory(key, true);
  return hit ? hit.data : null;
}

function writeMemory(key, data, ttlMs) {
  memory.set(key, { data, expiresAt: now() + ttlMs });
}

async function readPersistent(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !('data' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistent(key, data, ttlMs) {
  AsyncStorage.setItem(
    PREFIX + key,
    JSON.stringify({ data, expiresAt: now() + ttlMs })
  ).catch(() => {});
}

/**
 * Devuelve datos cacheados o ejecuta fetcher.
 * - hit fresco en memoria/persistencia -> retorna inmediato
 * - hit vencido -> retorna lo vencido y revalida en background (SWR)
 * - miss -> espera al fetch
 * - forceRefresh salta el caché fresco pero igual retorna stale al instante
 */
export async function cachedFetch(key, fetcher, options = {}) {
  const { ttl = 60_000, persist = true, forceRefresh = false } = options;

  if (!forceRefresh) {
    const mem = readMemory(key, false);
    if (mem) return mem.data;
    if (persist) {
      const saved = await readPersistent(key);
      if (saved && saved.expiresAt > now()) {
        writeMemory(key, saved.data, Math.max(saved.expiresAt - now(), 1000));
        return saved.data;
      }
    }
  }

  // SWR: si hay algo vencido, devuélvelo ya y refresca por detrás.
  const stale =
    readMemory(key, true)?.data ??
    (persist ? (await readPersistent(key))?.data : null) ??
    null;

  const doFetch = async () => {
    if (inflight.has(key)) return inflight.get(key);
    const p = (async () => {
      const data = await fetcher();
      writeMemory(key, data, ttl);
      if (persist) writePersistent(key, data, ttl);
      return data;
    })();
    inflight.set(key, p);
    try {
      return await p;
    } finally {
      inflight.delete(key);
    }
  };

  if (stale != null && !forceRefresh) {
    doFetch().catch(() => {});
    return stale;
  }

  return doFetch();
}

/** Borra caché en memoria + persistencia por prefijo. */
export function invalidateCache(prefix) {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
  return AsyncStorage.getAllKeys()
    .then((keys) =>
      AsyncStorage.multiRemove(
        keys.filter((k) => k.startsWith(PREFIX + prefix))
      ).catch(() => {})
    )
    .catch(() => {});
}

/** Limpia todo (p. ej. al cerrar sesión). */
export function clearAllCache() {
  memory.clear();
  inflight.clear();
  AsyncStorage.getAllKeys()
    .then((keys) =>
      AsyncStorage.multiRemove(
        keys.filter((k) => k.startsWith(PREFIX))
      ).catch(() => {})
    )
    .catch(() => {});
}
