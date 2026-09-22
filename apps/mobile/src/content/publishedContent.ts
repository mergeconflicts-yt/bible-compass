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

import { z } from 'zod';
import type { PublishedContextBundle } from './publishedContext';

export type { PublishedContextBundle } from './publishedContext';

export class PublishedContentError extends Error {
  constructor(message: string) {
    super(`publishedContent: ${message}`);
    this.name = 'PublishedContentError';
  }
}

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

// --- Runtime validation of published rows --------------------------------
//
// The published views are RLS-filtered but a malformed or schema-drifted
// payload must never cross the adapter boundary (finding 38). Every row is
// parsed with a strict Zod schema before it becomes a domain object; unknown
// fields or bad digests fail closed.

const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/);

const publishedVerseRowSchema = z
  .object({
    edition_key: z.string().min(1),
    refsys_key: z.string().min(1),
    book_osis: z.string().min(1),
    chapter: z.number().int().positive(),
    verse_number: z.number().int().nonnegative(),
    local_key: z.string().min(1),
    text: z.string(),
    text_sha256: sha256,
  })
  .strict();

const publishedEntityRowSchema = z
  .object({
    key: z.string().min(1),
    slug: z.string().min(1),
    type: z.string().min(1),
    identification_status: z.string().min(1),
  })
  .strict();

const publishedAttestationRowSchema = z
  .object({
    entity_key: z.string().min(1),
    scope_key: z.string().min(1),
    reference_local_key: z.string().min(1),
    kind: z.string().min(1),
    explicitness: z.string().min(1),
    review_state: z.string().min(1),
  })
  .strict();

function parseRows<T>(schema: z.ZodType<T[]>, data: unknown): T[] {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new PublishedContentError(parsed.error.issues[0]?.message ?? 'invalid published payload');
  }
  return parsed.data;
}

export function parsePublishedVerses(data: unknown): PublishedVerse[] {
  return parseRows(z.array(publishedVerseRowSchema), data).map((row) => ({
    editionKey: row.edition_key,
    refsysKey: row.refsys_key,
    bookOsis: row.book_osis,
    chapter: row.chapter,
    verse: row.verse_number,
    localKey: row.local_key,
    text: row.text,
    textSha256: row.text_sha256,
  }));
}

export function parsePublishedEntities(data: unknown): PublishedEntity[] {
  return parseRows(z.array(publishedEntityRowSchema), data).map((row) => ({
    key: row.key,
    slug: row.slug,
    type: row.type,
    identificationStatus: row.identification_status,
  }));
}

export function parsePublishedAttestations(data: unknown): PublishedAttestation[] {
  return parseRows(z.array(publishedAttestationRowSchema), data).map((row) => ({
    entityKey: row.entity_key,
    scopeKey: row.scope_key,
    referenceLocalKey: row.reference_local_key,
    kind: row.kind,
    explicitness: row.explicitness,
    reviewState: row.review_state,
  }));
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
   * `locale` and `editionKey` scope the server response to one language and
   * translation edition; the server defaults to English.
   */
  fetchPublishedContextBundle(
    scopeKey: string,
    locale?: string,
    editionKey?: string,
  ): Promise<PublishedContextBundle>;
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
