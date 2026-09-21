/**
 * SQLite published-content cache (Task EN-04 follow-up).
 *
 * Persists content received from the published read API so it stays
 * readable offline. Writes are replace-per-scope inside a transaction, so a
 * successful fetch that returns nothing also clears stale cached rows. As
 * with every SQLite adapter, screens never import this module; the content
 * store injects it through the `PublishedContentCache` port.
 */

import type {
  PublishedAttestation,
  PublishedContentCache,
  PublishedEntity,
  PublishedVerse,
} from '@/content/publishedContent';
import type { PassageDbHandle } from '@/content/passageStore';

interface VerseRow {
  edition_key: string;
  refsys_key: string;
  book: string;
  chapter: number;
  verse: number;
  local_key: string;
  text: string;
  text_sha256: string;
}

interface EntityRow {
  key: string;
  slug: string;
  type: string;
  identification_status: string;
}

interface AttestationRow {
  entity_key: string;
  scope_key: string;
  reference_local_key: string;
  kind: string;
  explicitness: string;
  review_state: string;
}

interface MetaRow {
  value: string;
}

const LAST_SYNCED_KEY = 'published:last_synced_at';

export class SqlitePublishedContentCache implements PublishedContentCache {
  constructor(private readonly db: PassageDbHandle) {}

  async writeVerses(
    bookOsis: string,
    chapter: number,
    editionKey: string,
    verses: PublishedVerse[],
    cachedAt: string,
  ): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      if (editionKey) {
        await this.db.runAsync(
          'DELETE FROM published_verses_cache WHERE book = ? AND chapter = ? AND edition_key = ?',
          [bookOsis, chapter, editionKey],
        );
      } else {
        await this.db.runAsync(
          'DELETE FROM published_verses_cache WHERE book = ? AND chapter = ?',
          [bookOsis, chapter],
        );
      }
      for (const verse of verses) {
        await this.db.runAsync(
          'INSERT OR REPLACE INTO published_verses_cache (edition_key, refsys_key, book, chapter, verse, local_key, text, text_sha256, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            verse.editionKey,
            verse.refsysKey,
            verse.bookOsis,
            verse.chapter,
            verse.verse,
            verse.localKey,
            verse.text,
            verse.textSha256,
            cachedAt,
          ],
        );
      }
      await this.markSynced(cachedAt);
    });
  }

  async readVerses(
    bookOsis: string,
    chapter: number,
    editionKey?: string,
  ): Promise<PublishedVerse[]> {
    const rows = editionKey
      ? await this.db.getAllAsync<VerseRow>(
          'SELECT edition_key, refsys_key, book, chapter, verse, local_key, text, text_sha256 FROM published_verses_cache WHERE book = ? AND chapter = ? AND edition_key = ? ORDER BY verse ASC',
          [bookOsis, chapter, editionKey],
        )
      : await this.db.getAllAsync<VerseRow>(
          'SELECT edition_key, refsys_key, book, chapter, verse, local_key, text, text_sha256 FROM published_verses_cache WHERE book = ? AND chapter = ? ORDER BY edition_key ASC, verse ASC',
          [bookOsis, chapter],
        );
    return rows.map((row) => ({
      editionKey: row.edition_key,
      refsysKey: row.refsys_key,
      bookOsis: row.book,
      chapter: row.chapter,
      verse: row.verse,
      localKey: row.local_key,
      text: row.text,
      textSha256: row.text_sha256,
    }));
  }

  async writeEntities(entities: PublishedEntity[], cachedAt: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM published_entities_cache', []);
      for (const entity of entities) {
        await this.db.runAsync(
          'INSERT OR REPLACE INTO published_entities_cache (key, slug, type, identification_status, cached_at) VALUES (?, ?, ?, ?, ?)',
          [entity.key, entity.slug, entity.type, entity.identificationStatus, cachedAt],
        );
      }
      await this.markSynced(cachedAt);
    });
  }

  async readEntities(): Promise<PublishedEntity[]> {
    const rows = await this.db.getAllAsync<EntityRow>(
      'SELECT key, slug, type, identification_status FROM published_entities_cache ORDER BY key ASC',
      [],
    );
    return rows.map((row) => ({
      key: row.key,
      slug: row.slug,
      type: row.type,
      identificationStatus: row.identification_status,
    }));
  }

  async writeAttestations(
    scopeKey: string | null,
    attestations: PublishedAttestation[],
    cachedAt: string,
  ): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      if (scopeKey) {
        await this.db.runAsync('DELETE FROM published_attestations_cache WHERE scope_key = ?', [
          scopeKey,
        ]);
      } else {
        await this.db.runAsync('DELETE FROM published_attestations_cache', []);
      }
      for (const attestation of attestations) {
        await this.db.runAsync(
          'INSERT OR REPLACE INTO published_attestations_cache (entity_key, scope_key, reference_local_key, kind, explicitness, review_state, cached_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            attestation.entityKey,
            attestation.scopeKey,
            attestation.referenceLocalKey,
            attestation.kind,
            attestation.explicitness,
            attestation.reviewState,
            cachedAt,
          ],
        );
      }
      await this.markSynced(cachedAt);
    });
  }

  async readAttestations(scopeKey?: string): Promise<PublishedAttestation[]> {
    const rows = scopeKey
      ? await this.db.getAllAsync<AttestationRow>(
          'SELECT entity_key, scope_key, reference_local_key, kind, explicitness, review_state FROM published_attestations_cache WHERE scope_key = ? ORDER BY reference_local_key ASC, entity_key ASC, kind ASC',
          [scopeKey],
        )
      : await this.db.getAllAsync<AttestationRow>(
          'SELECT entity_key, scope_key, reference_local_key, kind, explicitness, review_state FROM published_attestations_cache ORDER BY scope_key ASC, reference_local_key ASC, entity_key ASC, kind ASC',
          [],
        );
    return rows.map((row) => ({
      entityKey: row.entity_key,
      scopeKey: row.scope_key,
      referenceLocalKey: row.reference_local_key,
      kind: row.kind,
      explicitness: row.explicitness,
      reviewState: row.review_state,
    }));
  }

  async markSynced(at: string): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO published_cache_meta (key, value) VALUES (?, ?)',
      [LAST_SYNCED_KEY, at],
    );
  }

  async lastSyncedAt(): Promise<string | null> {
    const row = await this.db.getAllAsync<MetaRow>(
      'SELECT value FROM published_cache_meta WHERE key = ?',
      [LAST_SYNCED_KEY],
    );
    return row[0]?.value ?? null;
  }
}
