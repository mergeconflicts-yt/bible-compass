import {
  SupabasePublishedContentRepository,
  type PublishedContentClient,
} from '@/infrastructure/supabase/publishedContentRepository';
import {
  fetchPublishedAttestations,
  fetchPublishedEntities,
  fetchPublishedVerses,
  initializePublishedContent,
  initializePublishedContentCache,
  publishedContentCacheConfigured,
  publishedContentConfigured,
  publishedContentLastSyncedAt,
  resetPublishedContentStore,
  setPublishedContentRepository,
} from '@/content/publishedContentStore';
import type {
  PublishedAttestation,
  PublishedContentCache,
  PublishedContentRepository,
  PublishedEntity,
  PublishedVerse,
} from '@/content/publishedContent';

interface RecordedCall {
  table: string;
  columns: string;
  filters: [string, string | number][];
  order: string | null;
}

/** Minimal fake of the published-content query chain; records every read. */
function fakeClient(
  results: Record<string, unknown[]>,
  error: string | null = null,
): { client: PublishedContentClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client = {
    schema: () => ({
      from: (table: string) => ({
        select: (columns: string) => {
          const call: RecordedCall = { table, columns, filters: [], order: null };
          calls.push(call);
          const builder = {
            eq(column: string, value: string | number) {
              call.filters.push([column, value]);
              return builder;
            },
            order(column: string) {
              call.order = column;
              return builder;
            },
            then(
              resolve: (value: {
                data: unknown[] | null;
                error: { message: string } | null;
              }) => unknown,
            ) {
              const data = error ? null : (results[table] ?? []);
              return Promise.resolve({
                data,
                error: error ? { message: error } : null,
              }).then(resolve);
            },
          };
          return builder;
        },
      }),
    }),
  } as unknown as PublishedContentClient;
  return { client, calls };
}

describe('SupabasePublishedContentRepository', () => {
  it('reads published_verses with stable keys, filters and ordering', async () => {
    const { client, calls } = fakeClient({
      published_verses: [
        {
          edition_key: 'edition:bsb@20260912:sha-b2898c49',
          refsys_key: 'refsys:eng-v22',
          book_osis: 'Neh',
          chapter: 2,
          verse_number: 4,
          local_key: 'Neh.2.4',
          text: 'O LORD, let Your ear be attentive.',
          text_sha256: 'sha256:' + 'f'.repeat(64),
        },
      ],
    });
    const repo = new SupabasePublishedContentRepository(client);
    const verses = await repo.fetchPublishedVerses('Neh', 2, 'edition:bsb@20260912:sha-b2898c49');
    expect(verses).toHaveLength(1);
    expect(verses[0]).toMatchObject({
      bookOsis: 'Neh',
      chapter: 2,
      verse: 4,
      localKey: 'Neh.2.4',
      refsysKey: 'refsys:eng-v22',
    });
    expect(calls[0]!.table).toBe('published_verses');
    expect(calls[0]!.columns).toBe(
      'edition_key,refsys_key,book_osis,chapter,verse_number,local_key,text,text_sha256',
    );
    expect(calls[0]!.filters).toEqual([
      ['book_osis', 'Neh'],
      ['chapter', 2],
      ['edition_key', 'edition:bsb@20260912:sha-b2898c49'],
    ]);
    expect(calls[0]!.order).toBe('verse_number');
  });

  it('reads published_entities and maps identity status', async () => {
    const { client, calls } = fakeClient({
      published_entities: [
        {
          key: 'entity:nehemiah-governor',
          slug: 'nehemiah-governor',
          type: 'person',
          identification_status: 'established',
        },
      ],
    });
    const repo = new SupabasePublishedContentRepository(client);
    const entities = await repo.fetchPublishedEntities();
    expect(entities[0]).toEqual({
      key: 'entity:nehemiah-governor',
      slug: 'nehemiah-governor',
      type: 'person',
      identificationStatus: 'established',
    });
    expect(calls[0]!.table).toBe('published_entities');
    expect(calls[0]!.columns).toBe('key,slug,type,identification_status');
  });

  it('filters published_attestations by scope when asked', async () => {
    const { client, calls } = fakeClient({ published_attestations: [] });
    const repo = new SupabasePublishedContentRepository(client);
    await repo.fetchPublishedAttestations('scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20');
    expect(calls[0]!.table).toBe('published_attestations');
    expect(calls[0]!.filters).toEqual([
      ['scope_key', 'scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20'],
    ]);
    expect(calls[0]!.order).toBe('reference_local_key');
  });

  it('propagates backend errors to the caller', async () => {
    const { client } = fakeClient({}, 'permission denied');
    const repo = new SupabasePublishedContentRepository(client);
    await expect(repo.fetchPublishedVerses('Neh', 2)).rejects.toThrow('permission denied');
  });
});

describe('publishedContentStore', () => {
  const failingRepo: PublishedContentRepository = {
    fetchPublishedVerses: async () => {
      throw new Error('network down');
    },
    fetchPublishedEntities: async () => {
      throw new Error('network down');
    },
    fetchPublishedAttestations: async () => {
      throw new Error('network down');
    },
  };

  beforeEach(() => resetPublishedContentStore());

  it('is unconfigured by default and returns empty, never throws', async () => {
    expect(publishedContentConfigured()).toBe(false);
    await expect(fetchPublishedVerses('Neh', 2)).resolves.toEqual([]);
    await expect(fetchPublishedEntities()).resolves.toEqual([]);
    await expect(fetchPublishedAttestations()).resolves.toEqual([]);
  });

  it('returns empty on backend failure instead of crashing', async () => {
    setPublishedContentRepository(failingRepo);
    expect(publishedContentConfigured()).toBe(true);
    await expect(fetchPublishedVerses('Neh', 2)).resolves.toEqual([]);
    await expect(fetchPublishedEntities()).resolves.toEqual([]);
  });

  it('initializes from injected deps and serves published rows', async () => {
    const { client } = fakeClient({
      published_entities: [
        {
          key: 'entity:artaxerxes-i',
          slug: 'artaxerxes-i',
          type: 'person',
          identification_status: 'established',
        },
      ],
    });
    initializePublishedContent({
      createRepository: () => new SupabasePublishedContentRepository(client),
    });
    const entities = await fetchPublishedEntities();
    expect(entities).toEqual([
      {
        key: 'entity:artaxerxes-i',
        slug: 'artaxerxes-i',
        type: 'person',
        identificationStatus: 'established',
      },
    ]);
  });

  it('stays unconfigured when the client factory throws', () => {
    initializePublishedContent({
      createRepository: () => {
        throw new Error('bad config');
      },
    });
    expect(publishedContentConfigured()).toBe(false);
  });
});

interface CacheState {
  verses: PublishedVerse[];
  entities: PublishedEntity[];
  attestations: PublishedAttestation[];
  last: string | null;
}

function fakeCache(): { cache: PublishedContentCache; state: CacheState } {
  const state: CacheState = { verses: [], entities: [], attestations: [], last: null };
  const cache: PublishedContentCache = {
    writeVerses: async (_b, _c, _e, rows, at) => {
      state.verses = rows;
      state.last = at;
    },
    readVerses: async () => state.verses,
    writeEntities: async (rows, at) => {
      state.entities = rows;
      state.last = at;
    },
    readEntities: async () => state.entities,
    writeAttestations: async (_s, rows, at) => {
      state.attestations = rows;
      state.last = at;
    },
    readAttestations: async () => state.attestations,
    markSynced: async (at) => {
      state.last = at;
    },
    lastSyncedAt: async () => state.last,
  };
  return { cache, state };
}

describe('publishedContentStore offline cache', () => {
  beforeEach(() => resetPublishedContentStore());

  it('writes received content through to the cache', async () => {
    const { cache, state } = fakeCache();
    const { client } = fakeClient({
      published_entities: [
        {
          key: 'entity:queen',
          slug: 'queen',
          type: 'person',
          identification_status: 'established',
        },
      ],
    });
    initializePublishedContent({
      cache,
      createRepository: () => new SupabasePublishedContentRepository(client),
      nowIso: () => '2026-09-21T00:00:00.000Z',
    });
    const entities = await fetchPublishedEntities();
    expect(entities).toHaveLength(1);
    expect(state.entities).toEqual(entities);
    expect(await publishedContentLastSyncedAt()).toBe('2026-09-21T00:00:00.000Z');
  });

  it('falls back to cached content when the backend fails', async () => {
    const { cache, state } = fakeCache();
    state.entities = [
      { key: 'entity:queen', slug: 'queen', type: 'person', identificationStatus: 'established' },
    ];
    setPublishedContentRepository({
      fetchPublishedVerses: async () => {
        throw new Error('offline');
      },
      fetchPublishedEntities: async () => {
        throw new Error('offline');
      },
      fetchPublishedAttestations: async () => {
        throw new Error('offline');
      },
    });
    initializePublishedContentCache(cache);
    expect(publishedContentConfigured()).toBe(true);
    expect(publishedContentCacheConfigured()).toBe(true);
    await expect(fetchPublishedEntities()).resolves.toEqual(state.entities);
  });

  it('reads the cache when no remote is configured', async () => {
    const { cache, state } = fakeCache();
    state.attestations = [
      {
        entityKey: 'entity:nehemiah-governor',
        scopeKey: 'scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20',
        referenceLocalKey: 'Neh.2.1',
        kind: 'primary_subject',
        explicitness: 'strongly_implied',
        reviewState: 'published',
      },
    ];
    initializePublishedContentCache(cache);
    expect(publishedContentConfigured()).toBe(false);
    await expect(fetchPublishedAttestations()).resolves.toEqual(state.attestations);
  });

  it('returns empty when neither remote nor cache has content, never throws', async () => {
    const { cache } = fakeCache();
    initializePublishedContentCache(cache);
    await expect(fetchPublishedVerses('Neh', 2)).resolves.toEqual([]);
    await expect(publishedContentLastSyncedAt()).resolves.toBeNull();
  });
});
