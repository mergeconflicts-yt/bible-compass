/**
 * Supabase published-content read adapter (Task EN-04).
 *
 * Reads the client-facing `public_content` views only. Those views are
 * published-only and run with security_invoker, so Postgres RLS decides
 * visibility: drafts are never returned, and only the public anon key is
 * used (never service_role). No writes happen here.
 *
 * The adapter depends on the narrow `PublishedContentClient` structural
 * subset of SupabaseClient so tests can inject a fake without a network.
 */

import type {
  PublishedAttestation,
  PublishedContentRepository,
  PublishedEntity,
  PublishedVerse,
} from '@/content/publishedContent';
import {
  parsePublishedAttestations,
  parsePublishedEntities,
  parsePublishedVerses,
} from '@/content/publishedContent';
import {
  parsePublishedContextBundle,
  type PublishedContextBundle,
} from '@/content/publishedContext';

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface FilterBuilder<T> extends PromiseLike<QueryResult<T>> {
  eq(column: string, value: string | number): FilterBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): FilterBuilder<T>;
}

interface ViewReader {
  select(columns: string): FilterBuilder<never>;
}

export interface PublishedContentClient {
  schema(name: 'public_content'): {
    from(table: string): ViewReader;
    rpc(
      fn: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
}

interface VerseRow {
  edition_key: string;
  refsys_key: string;
  book_osis: string;
  chapter: number;
  verse_number: number;
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

async function read<T>(builder: FilterBuilder<T>): Promise<T[]> {
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export class SupabasePublishedContentRepository implements PublishedContentRepository {
  constructor(private readonly client: PublishedContentClient) {}

  private from(table: string): ViewReader {
    return this.client.schema('public_content').from(table);
  }

  async fetchPublishedVerses(
    bookOsis: string,
    chapter: number,
    editionKey?: string,
  ): Promise<PublishedVerse[]> {
    let query = this.from('published_verses')
      .select('edition_key,refsys_key,book_osis,chapter,verse_number,local_key,text,text_sha256')
      .eq('book_osis', bookOsis)
      .eq('chapter', chapter) as FilterBuilder<VerseRow>;
    if (editionKey) query = query.eq('edition_key', editionKey);
    const rows = await read(query.order('verse_number', { ascending: true }));
    // Runtime Zod validation at the boundary (finding 38).
    return parsePublishedVerses(rows);
  }

  async fetchPublishedEntities(): Promise<PublishedEntity[]> {
    const rows = await read(
      this.from('published_entities')
        .select('key,slug,type,identification_status')
        .order('key', { ascending: true }) as FilterBuilder<EntityRow>,
    );
    return parsePublishedEntities(rows);
  }

  async fetchPublishedContextBundle(
    scopeKey: string,
    locale = 'en',
    editionKey?: string,
  ): Promise<PublishedContextBundle> {
    // The RPC lives in the public_content schema, not the default schema.
    const { data, error } = await this.client
      .schema('public_content')
      .rpc('published_context_bundle', {
        p_scope_key: scopeKey,
        p_locale: locale,
        p_edition_key: editionKey ?? null,
      });
    if (error) throw new Error(error.message);
    // Runtime validation: a malformed bundle never crosses this boundary.
    return parsePublishedContextBundle(data);
  }

  async fetchPublishedAttestations(scopeKey?: string): Promise<PublishedAttestation[]> {
    let query = this.from('published_attestations').select(
      'entity_key,scope_key,reference_local_key,kind,explicitness,review_state',
    ) as FilterBuilder<AttestationRow>;
    if (scopeKey) query = query.eq('scope_key', scopeKey);
    const rows = await read(query.order('reference_local_key', { ascending: true }));
    return parsePublishedAttestations(rows);
  }
}
