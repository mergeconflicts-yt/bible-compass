import { SqlitePublishedContentCache } from '@/infrastructure/sqlite/publishedContentCache';
import type { PassageDbHandle } from '@/content/passageStore';
import type { PublishedContentRepository } from '@/content/publishedContent';
import {
  PUBLISHED_CONTEXT_SCHEMA_VERSION,
  type PublishedContextBundle,
} from '@/content/publishedContext';
import {
  fetchPublishedContextBundle,
  initializePublishedContent,
  resetPublishedContentStore,
} from '@/content/publishedContentStore';

const SCOPE_A = 'scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20';
const SCOPE_B = 'scope:neh-2-request:refsys:eng-v22:Neh.2.1-Neh.2.8';
const NOW = '2026-09-21T00:00:00.000Z';

function bundleFor(scopeKey: string, roleText = 'The role.'): PublishedContextBundle {
  return {
    scope_key: scopeKey,
    contexts: [{ kind: 'what', text: 'What text.', claim_keys: [] }],
    entities: [
      {
        entity_key: 'entity:a',
        slug: 'a',
        type: 'person',
        identification_status: 'established',
        names: [],
        descriptions: [],
      },
    ],
    claims: [],
    mentions: [],
    relevance: [
      {
        scope_key: scopeKey,
        entity_key: 'entity:a',
        role_in_passage: roleText,
        importance: 'central',
        is_attested: true,
      },
    ],
    relationships: [],
    events: [],
  };
}

interface StoredBundle {
  scope_key: string;
  schema_version: number;
  payload: string;
  cached_at: string;
}

/** Stateful in-memory stand-in for the bundle cache table. */
function bundleDb(): { db: PassageDbHandle; rows: Map<string, StoredBundle> } {
  const rows = new Map<string, StoredBundle>();
  const db: PassageDbHandle = {
    execAsync: async () => {},
    runAsync: async (source, params = []) => {
      if (source.includes('INSERT OR REPLACE INTO published_context_bundles')) {
        const [scopeKey, schemaVersion, payload, cachedAt] = params as [
          string,
          number,
          string,
          string,
        ];
        rows.set(scopeKey, {
          scope_key: scopeKey,
          schema_version: schemaVersion,
          payload,
          cached_at: cachedAt,
        });
      }
      return { lastInsertRowId: 1, changes: 1 };
    },
    getAllAsync: async <T>(source: string, params: (string | number)[] = []) => {
      if (source.includes('published_context_bundles')) {
        const row = rows.get(params[0] as string);
        return (row ? [row] : []) as T[];
      }
      return [] as T[];
    },
    getAllSync: () => [],
    getFirstSync: () => null,
    withTransactionAsync: async (task) => {
      await task();
    },
  };
  return { db, rows };
}

function repoReturning(bundle: PublishedContextBundle): PublishedContentRepository {
  return {
    fetchPublishedVerses: async () => [],
    fetchPublishedEntities: async () => [],
    fetchPublishedAttestations: async () => [],
    fetchPublishedContextBundle: async () => bundle,
  };
}

function repoFailing(): PublishedContentRepository {
  return {
    fetchPublishedVerses: async () => [],
    fetchPublishedEntities: async () => [],
    fetchPublishedAttestations: async () => [],
    fetchPublishedContextBundle: async () => {
      throw new Error('offline');
    },
  };
}

describe('SqlitePublishedContentCache context bundles', () => {
  it('round-trips a validated bundle with schema version and timestamp', async () => {
    const { db, rows } = bundleDb();
    const cache = new SqlitePublishedContentCache(db);
    await cache.writeContextBundle(SCOPE_A, bundleFor(SCOPE_A), NOW);

    const stored = rows.get(SCOPE_A);
    expect(stored?.schema_version).toBe(PUBLISHED_CONTEXT_SCHEMA_VERSION);
    expect(stored?.cached_at).toBe(NOW);

    await expect(cache.readContextBundle(SCOPE_A)).resolves.toMatchObject({ scope_key: SCOPE_A });
  });

  it('isolates bundles by scope_key', async () => {
    const { db } = bundleDb();
    const cache = new SqlitePublishedContentCache(db);
    await cache.writeContextBundle(SCOPE_A, bundleFor(SCOPE_A), NOW);
    await expect(cache.readContextBundle(SCOPE_A)).resolves.not.toBeNull();
    await expect(cache.readContextBundle(SCOPE_B)).resolves.toBeNull();
  });

  it('treats corrupt payloads and wrong schema versions as absent', async () => {
    const { db, rows } = bundleDb();
    const cache = new SqlitePublishedContentCache(db);
    rows.set(SCOPE_A, {
      scope_key: SCOPE_A,
      schema_version: PUBLISHED_CONTEXT_SCHEMA_VERSION,
      payload: '{ not valid json',
      cached_at: NOW,
    });
    await expect(cache.readContextBundle(SCOPE_A)).resolves.toBeNull();

    rows.set(SCOPE_B, {
      scope_key: SCOPE_B,
      schema_version: PUBLISHED_CONTEXT_SCHEMA_VERSION + 1,
      payload: JSON.stringify(bundleFor(SCOPE_B)),
      cached_at: NOW,
    });
    await expect(cache.readContextBundle(SCOPE_B)).resolves.toBeNull();
  });
});

describe('fetchPublishedContextBundle online/offline', () => {
  beforeEach(() => resetPublishedContentStore());

  it('writes through on a successful online fetch', async () => {
    const { db, rows } = bundleDb();
    const cache = new SqlitePublishedContentCache(db);
    initializePublishedContent({
      cache,
      createRepository: () => repoReturning(bundleFor(SCOPE_A)),
      nowIso: () => NOW,
    });
    await expect(fetchPublishedContextBundle(SCOPE_A)).resolves.toMatchObject({
      scope_key: SCOPE_A,
    });
    expect(rows.get(SCOPE_A)?.cached_at).toBe(NOW);
  });

  it('serves the cached bundle when Supabase is unavailable', async () => {
    const { db } = bundleDb();
    const cache = new SqlitePublishedContentCache(db);
    await cache.writeContextBundle(SCOPE_A, bundleFor(SCOPE_A, 'Cached role.'), NOW);
    initializePublishedContent({ cache, createRepository: repoFailing });
    const bundle = await fetchPublishedContextBundle(SCOPE_A);
    expect(bundle?.relevance[0]?.role_in_passage).toBe('Cached role.');
  });

  it('preserves the last healthy bundle after a validation/network failure', async () => {
    const { db, rows } = bundleDb();
    const cache = new SqlitePublishedContentCache(db);
    await cache.writeContextBundle(SCOPE_A, bundleFor(SCOPE_A, 'Healthy role.'), NOW);
    const before = rows.get(SCOPE_A)?.payload;

    // The repository boundary validates, so an invalid payload surfaces as a
    // throw; nothing is overwritten and the cached bundle is served.
    initializePublishedContent({ cache, createRepository: repoFailing });
    const bundle = await fetchPublishedContextBundle(SCOPE_A);
    expect(bundle?.relevance[0]?.role_in_passage).toBe('Healthy role.');
    expect(rows.get(SCOPE_A)?.payload).toBe(before);
  });

  it('preserves the cached row when the cache write itself fails', async () => {
    const { db, rows } = bundleDb();
    // Seed a healthy cached bundle, then make bundle writes fail.
    rows.set(SCOPE_A, {
      scope_key: SCOPE_A,
      schema_version: PUBLISHED_CONTEXT_SCHEMA_VERSION,
      payload: JSON.stringify(bundleFor(SCOPE_A, 'Healthy role.')),
      cached_at: NOW,
    });
    const before = rows.get(SCOPE_A)?.payload;
    const failingCache = new SqlitePublishedContentCache({
      ...db,
      runAsync: async (source, params = []) => {
        if (source.includes('INSERT OR REPLACE INTO published_context_bundles')) {
          throw new Error('disk full');
        }
        return db.runAsync(source, params);
      },
    });
    initializePublishedContent({
      cache: failingCache,
      createRepository: () => repoReturning(bundleFor(SCOPE_A, 'Fresh role.')),
      nowIso: () => '2027-01-01T00:00:00.000Z',
    });
    const bundle = await fetchPublishedContextBundle(SCOPE_A);
    expect(bundle?.relevance[0]?.role_in_passage).toBe('Fresh role.');
    expect(rows.get(SCOPE_A)?.payload).toBe(before);
  });

  it('returns null for an empty cache with no remote', async () => {
    const { db } = bundleDb();
    initializePublishedContent({ cache: new SqlitePublishedContentCache(db) });
    await expect(fetchPublishedContextBundle(SCOPE_A)).resolves.toBeNull();
  });

  it('keeps scopes isolated when offline', async () => {
    const { db } = bundleDb();
    const cache = new SqlitePublishedContentCache(db);
    await cache.writeContextBundle(SCOPE_A, bundleFor(SCOPE_A), NOW);
    initializePublishedContent({ cache, createRepository: repoFailing });
    await expect(fetchPublishedContextBundle(SCOPE_A)).resolves.not.toBeNull();
    await expect(fetchPublishedContextBundle(SCOPE_B)).resolves.toBeNull();
  });
});
