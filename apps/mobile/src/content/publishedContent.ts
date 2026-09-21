/**
 * Published-content repository contract (feature boundary).
 *
 * Infrastructure adapters (e.g. the Supabase read adapter) implement this
 * interface; screens and stores depend only on it. It reads the client-facing
 * published API exclusively: the `public_content` views are published-only
 * and RLS-filtered, so drafts never reach the client. Nothing here is
 * synchronous: callers treat empty results as "unavailable", never as
 * "no content exists".
 */

import type { PublishedContextBundle } from './publishedContext';

export type { PublishedContextBundle } from './publishedContext';

export interface PublishedVerse {
  editionKey: string;
  refsysKey: string;
  bookOsis: string;
  chapter: number;
  verse: number;
  localKey: string;
  text: string;
  textSha256: string;
}

export interface PublishedEntity {
  key: string;
  slug: string;
  type: string;
  identificationStatus: string;
}

export interface PublishedAttestation {
  entityKey: string;
  scopeKey: string;
  referenceLocalKey: string;
  kind: string;
  explicitness: string;
  reviewState: string;
}

export interface PublishedContentRepository {
  /** Published verses for one chapter, in verse order. */
  fetchPublishedVerses(
    bookOsis: string,
    chapter: number,
    editionKey?: string,
  ): Promise<PublishedVerse[]>;
  /** All published entities. */
  fetchPublishedEntities(): Promise<PublishedEntity[]>;
  /** Published attestations, optionally filtered to one scope. */
  fetchPublishedAttestations(scopeKey?: string): Promise<PublishedAttestation[]>;
  /**
   * Complete published context bundle for one Scripture scope, already
   * validated against the strict contract. Throws on a malformed payload.
   */
  fetchPublishedContextBundle(scopeKey: string): Promise<PublishedContextBundle>;
}

/**
 * Offline cache for received published content (SQLite adapter lives in
 * infrastructure). Writes replace the cached slice for the requested scope so
 * a successful fetch that returns nothing also clears stale cached rows.
 */
export interface PublishedContentCache {
  writeVerses(
    bookOsis: string,
    chapter: number,
    editionKey: string,
    verses: PublishedVerse[],
    cachedAt: string,
  ): Promise<void>;
  readVerses(bookOsis: string, chapter: number, editionKey?: string): Promise<PublishedVerse[]>;
  writeEntities(entities: PublishedEntity[], cachedAt: string): Promise<void>;
  readEntities(): Promise<PublishedEntity[]>;
  writeAttestations(
    scopeKey: string | null,
    attestations: PublishedAttestation[],
    cachedAt: string,
  ): Promise<void>;
  readAttestations(scopeKey?: string): Promise<PublishedAttestation[]>;
  /**
   * Atomically store one validated context bundle for a scope. The bundle
   * must already have passed parsePublishedContextBundle; readers re-validate
   * and treat anything unparsable as absent.
   */
  writeContextBundle(
    scopeKey: string,
    bundle: PublishedContextBundle,
    cachedAt: string,
  ): Promise<void>;
  /** The last healthy cached bundle for the scope, or null when absent/corrupt. */
  readContextBundle(scopeKey: string): Promise<PublishedContextBundle | null>;
  markSynced(at: string): Promise<void>;
  lastSyncedAt(): Promise<string | null>;
}
