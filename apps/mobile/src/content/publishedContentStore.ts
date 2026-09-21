/**
 * Published-content store: owns repository selection and offline caching for
 * the published read API. The composition root injects the Supabase adapter
 * and a SQLite cache when configured; tests inject fakes.
 *
 * Read strategy: remote first, then the SQLite cache. A successful remote
 * read writes through to the cache (replace-per-scope, so an empty published
 * slice clears stale rows); a failed or unavailable remote falls back to the
 * cache. Reads never throw: when neither source has content the result is an
 * empty array so callers render an honest unavailable/offline state.
 */

import type {
  PublishedAttestation,
  PublishedContentCache,
  PublishedContentRepository,
  PublishedEntity,
  PublishedVerse,
} from './publishedContent';
import type { PublishedContextBundle } from './publishedContext';

let current: PublishedContentRepository | null = null;
let cache: PublishedContentCache | null = null;
let nowIso: () => string = () => new Date().toISOString();

export interface PublishedContentInitDeps {
  createRepository?: () => PublishedContentRepository;
  cache?: PublishedContentCache;
  nowIso?: () => string;
}

export function initializePublishedContent(deps: PublishedContentInitDeps): void {
  if (deps.cache) cache = deps.cache;
  if (deps.nowIso) nowIso = deps.nowIso;
  if (deps.createRepository) {
    try {
      current = deps.createRepository();
    } catch {
      // Misconfigured client: stay unconfigured, callers fall back to cache.
      current = null;
    }
  }
}

/** Inject the offline cache independently of the remote repository. */
export function initializePublishedContentCache(next: PublishedContentCache): void {
  cache = next;
}

export function setPublishedContentRepository(repo: PublishedContentRepository | null): void {
  current = repo;
}

export function resetPublishedContentStore(): void {
  current = null;
  cache = null;
  nowIso = () => new Date().toISOString();
}

export function publishedContentConfigured(): boolean {
  return current !== null;
}

export function publishedContentCacheConfigured(): boolean {
  return cache !== null;
}

export async function fetchPublishedVerses(
  bookOsis: string,
  chapter: number,
  editionKey?: string,
): Promise<PublishedVerse[]> {
  const repo = current;
  if (repo) {
    try {
      const rows = await repo.fetchPublishedVerses(bookOsis, chapter, editionKey);
      const store = cache;
      if (store) {
        try {
          await store.writeVerses(bookOsis, chapter, editionKey ?? '', rows, nowIso());
        } catch {
          // Cache write is best-effort: the network read still succeeds.
        }
      }
      return rows;
    } catch {
      // Offline or backend failure: fall through to the cache below.
    }
  }
  const store = cache;
  if (store) {
    try {
      return await store.readVerses(bookOsis, chapter, editionKey);
    } catch {
      return [];
    }
  }
  return [];
}

export async function fetchPublishedEntities(): Promise<PublishedEntity[]> {
  const repo = current;
  if (repo) {
    try {
      const rows = await repo.fetchPublishedEntities();
      const store = cache;
      if (store) {
        try {
          await store.writeEntities(rows, nowIso());
        } catch {
          // Best-effort cache write.
        }
      }
      return rows;
    } catch {
      // Fall through to cache.
    }
  }
  const store = cache;
  if (store) {
    try {
      return await store.readEntities();
    } catch {
      return [];
    }
  }
  return [];
}

export async function fetchPublishedAttestations(
  scopeKey?: string,
): Promise<PublishedAttestation[]> {
  const repo = current;
  if (repo) {
    try {
      const rows = await repo.fetchPublishedAttestations(scopeKey);
      const store = cache;
      if (store) {
        try {
          await store.writeAttestations(scopeKey ?? null, rows, nowIso());
        } catch {
          // Best-effort cache write.
        }
      }
      return rows;
    } catch {
      // Fall through to cache.
    }
  }
  const store = cache;
  if (store) {
    try {
      return await store.readAttestations(scopeKey);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Complete published context bundle for a scope: remote first, then the
 * last healthy SQLite-cached bundle.
 *
 * Only bundles that pass runtime validation reach the cache (the repository
 * validates before returning; the cache re-validates on read). A network,
 * validation or cache-write failure never destroys the previous healthy
 * bundle: nothing is overwritten on failure, and the cached copy is served
 * instead. Returns null only when neither source has a healthy bundle.
 */
export async function fetchPublishedContextBundle(
  scopeKey: string,
): Promise<PublishedContextBundle | null> {
  const repo = current;
  if (repo) {
    try {
      const bundle = await repo.fetchPublishedContextBundle(scopeKey);
      const store = cache;
      if (store) {
        try {
          await store.writeContextBundle(scopeKey, bundle, nowIso());
        } catch {
          // Cache write failed: keep the fresh bundle and the old cached row.
        }
      }
      return bundle;
    } catch {
      // Network or validation failure: fall through to the cached bundle,
      // which was never overwritten.
    }
  }
  const store = cache;
  if (store) {
    try {
      return await store.readContextBundle(scopeKey);
    } catch {
      return null;
    }
  }
  return null;
}

/** When the cache last received content, or null when never synced. */
export async function publishedContentLastSyncedAt(): Promise<string | null> {
  const store = cache;
  if (!store) return null;
  try {
    return await store.lastSyncedAt();
  } catch {
    return null;
  }
}
