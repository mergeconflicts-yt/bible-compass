import { SqlitePublishedContentCache } from '@/infrastructure/sqlite/publishedContentCache';
import type { PassageDbHandle } from '@/content/passageStore';

interface RecordedRun {
  source: string;
  params: (string | number)[];
}

/** Hand-rolled SQLite handle: records writes and answers the reads asked. */
function fakeHandle(readRows: Record<string, unknown[]> = {}): {
  db: PassageDbHandle;
  runs: RecordedRun[];
} {
  const runs: RecordedRun[] = [];
  const db: PassageDbHandle = {
    execAsync: async () => {},
    runAsync: async (source, params = []) => {
      runs.push({ source, params });
      return { lastInsertRowId: runs.length, changes: 1 };
    },
    getAllAsync: async <T>(source: string) => {
      const key = Object.keys(readRows).find((table) => source.includes(table));
      return (key ? readRows[key] : []) as T[];
    },
    getAllSync: () => [],
    getFirstSync: () => null,
    withTransactionAsync: async (task) => {
      await task();
    },
  };
  return { db, runs };
}

describe('SqlitePublishedContentCache', () => {
  it('replaces a chapter slice and stamps the sync time', async () => {
    const { db, runs } = fakeHandle();
    const cache = new SqlitePublishedContentCache(db);
    await cache.writeVerses(
      'Neh',
      2,
      'edition:bsb@20260912:sha-b2898c49',
      [
        {
          editionKey: 'edition:bsb@20260912:sha-b2898c49',
          refsysKey: 'refsys:eng-v22',
          bookOsis: 'Neh',
          chapter: 2,
          verse: 4,
          localKey: 'Neh.2.4',
          text: 'O LORD, let Your ear be attentive.',
          textSha256: 'sha256:' + 'f'.repeat(64),
        },
      ],
      '2026-09-21T00:00:00.000Z',
    );

    expect(runs[0]!.source).toContain('DELETE FROM published_verses_cache');
    const insert = runs.find((run) =>
      run.source.includes('INSERT OR REPLACE INTO published_verses_cache'),
    );
    expect(insert?.params).toEqual([
      'edition:bsb@20260912:sha-b2898c49',
      'refsys:eng-v22',
      'Neh',
      2,
      4,
      'Neh.2.4',
      'O LORD, let Your ear be attentive.',
      'sha256:' + 'f'.repeat(64),
      '2026-09-21T00:00:00.000Z',
    ]);
    const stamp = runs.find((run) => run.source.includes('published_cache_meta'));
    expect(stamp?.params).toEqual(['published:last_synced_at', '2026-09-21T00:00:00.000Z']);
  });

  it('reads cached verses back in verse order with mapped fields', async () => {
    const { db } = fakeHandle({
      published_verses_cache: [
        {
          edition_key: 'edition:bsb@20260912:sha-b2898c49',
          refsys_key: 'refsys:eng-v22',
          book: 'Neh',
          chapter: 2,
          verse: 4,
          local_key: 'Neh.2.4',
          text: 'O LORD, let Your ear be attentive.',
          text_sha256: 'sha256:' + 'f'.repeat(64),
        },
      ],
    });
    const cache = new SqlitePublishedContentCache(db);
    const verses = await cache.readVerses('Neh', 2, 'edition:bsb@20260912:sha-b2898c49');
    expect(verses).toEqual([
      {
        editionKey: 'edition:bsb@20260912:sha-b2898c49',
        refsysKey: 'refsys:eng-v22',
        bookOsis: 'Neh',
        chapter: 2,
        verse: 4,
        localKey: 'Neh.2.4',
        text: 'O LORD, let Your ear be attentive.',
        textSha256: 'sha256:' + 'f'.repeat(64),
      },
    ]);
  });

  it('replaces entities and maps them back', async () => {
    const { db, runs } = fakeHandle({
      published_entities_cache: [
        {
          key: 'entity:nehemiah-governor',
          slug: 'nehemiah-governor',
          type: 'person',
          identification_status: 'established',
        },
      ],
    });
    const cache = new SqlitePublishedContentCache(db);
    await cache.writeEntities(
      [
        {
          key: 'entity:nehemiah-governor',
          slug: 'nehemiah-governor',
          type: 'person',
          identificationStatus: 'established',
        },
      ],
      '2026-09-21T00:00:00.000Z',
    );
    expect(runs[0]!.source).toContain('DELETE FROM published_entities_cache');
    await expect(cache.readEntities()).resolves.toEqual([
      {
        key: 'entity:nehemiah-governor',
        slug: 'nehemiah-governor',
        type: 'person',
        identificationStatus: 'established',
      },
    ]);
  });

  it('replaces attestations for one scope only and maps them back', async () => {
    const { db, runs } = fakeHandle({
      published_attestations_cache: [
        {
          entity_key: 'entity:nehemiah-governor',
          scope_key: 'scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20',
          reference_local_key: 'Neh.2.1',
          kind: 'primary_subject',
          explicitness: 'strongly_implied',
          review_state: 'published',
        },
      ],
    });
    const cache = new SqlitePublishedContentCache(db);
    await cache.writeAttestations(
      'scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20',
      [
        {
          entityKey: 'entity:nehemiah-governor',
          scopeKey: 'scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20',
          referenceLocalKey: 'Neh.2.1',
          kind: 'primary_subject',
          explicitness: 'strongly_implied',
          reviewState: 'published',
        },
      ],
      '2026-09-21T00:00:00.000Z',
    );
    const del = runs.find((run) => run.source.includes('DELETE FROM published_attestations_cache'));
    expect(del?.source).toContain('WHERE scope_key = ?');
    expect(del?.params).toEqual(['scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20']);

    const rows = await cache.readAttestations('scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20');
    expect(rows[0]).toMatchObject({
      entityKey: 'entity:nehemiah-governor',
      referenceLocalKey: 'Neh.2.1',
      reviewState: 'published',
    });
  });

  it('reports the last sync time or null', async () => {
    const { db } = fakeHandle({ published_cache_meta: [] });
    const cache = new SqlitePublishedContentCache(db);
    await expect(cache.lastSyncedAt()).resolves.toBeNull();
    const { db: db2 } = fakeHandle({
      published_cache_meta: [{ value: '2026-09-21T00:00:00.000Z' }],
    });
    const cache2 = new SqlitePublishedContentCache(db2);
    await expect(cache2.lastSyncedAt()).resolves.toBe('2026-09-21T00:00:00.000Z');
  });
});
