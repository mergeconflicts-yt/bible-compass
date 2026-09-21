import {
  SupabasePublishedContentRepository,
  type PublishedContentClient,
} from '@/infrastructure/supabase/publishedContentRepository';
import {
  parsePublishedContextBundle,
  PublishedContextError,
  type PublishedContextBundle,
} from '@/content/publishedContext';
import {
  fetchPublishedContextBundle,
  resetPublishedContentStore,
  setPublishedContentRepository,
} from '@/content/publishedContentStore';
import type { PublishedContentRepository } from '@/content/publishedContent';

const SHA = 'sha256:' + 'a'.repeat(64);
const SCOPE = 'scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20';
const EDITION = 'edition:bsb@20260912:sha-b2898c49';

function validBundle(): PublishedContextBundle {
  return {
    scope_key: SCOPE,
    contexts: [
      { kind: 'stakes', text: 'Stakes text.', claim_keys: ['claim:a'] },
      { kind: 'what', text: 'What text.', claim_keys: [] },
    ],
    entities: [
      {
        entity_key: 'entity:a',
        slug: 'a',
        type: 'person',
        identification_status: 'established',
        names: [{ language_tag: 'en', form: 'A', normalized_form: 'a', kind: 'preferred' }],
        descriptions: [{ locale: 'en', revision: 1, short_desc: 'A person.', extended_desc: null }],
      },
      {
        entity_key: 'entity:b',
        slug: 'b',
        type: 'place',
        identification_status: 'established',
        names: [],
        descriptions: [],
      },
    ],
    claims: [
      {
        claim_key: 'claim:a',
        subject: { type: 'entity', key: 'entity:a' },
        predicate: 'probe',
        object: { type: 'text', value: 'x' },
        evidence_status: 'established',
        textual_basis: 'explicit',
        citations: [
          { locator: 'Neh.2.1', support_kind: 'supports', digest: SHA, edition_key: EDITION },
        ],
      },
    ],
    mentions: [
      {
        book_osis: 'Neh',
        chapter: 2,
        verse: 1,
        local_key: 'Neh.2.1',
        entity_key: 'entity:a',
        form: 'explicit_name',
        quote: 'A',
        occurrence_ordinal: 1,
        start_utf16: 0,
        end_utf16: 1,
        edition_key: EDITION,
      },
    ],
    relevance: [
      {
        scope_key: SCOPE,
        entity_key: 'entity:a',
        role_in_passage: 'The role.',
        importance: 'central',
        is_attested: true,
      },
    ],
    relationships: [
      {
        subject_entity_key: 'entity:a',
        predicate: 'probe',
        object_entity_key: 'entity:b',
        scope_key: SCOPE,
        certainty: 'established',
      },
    ],
    events: [
      {
        event_entity_key: 'entity:e',
        event_kind: 'probe-kind',
        participants: [{ entity_key: 'entity:a', role: 'participant' }],
        places: [{ entity_key: 'entity:b', role: null }],
      },
    ],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fakeRpcClient(
  data: unknown,
  error: string | null = null,
): { client: PublishedContentClient; calls: [string, Record<string, unknown>][] } {
  const calls: [string, Record<string, unknown>][] = [];
  const client = {
    schema: () => ({
      from: () => ({
        select: () => {
          throw new Error('schema reads are not used by the bundle contract');
        },
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push([fn, args]);
      return {
        then: (resolve: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
          Promise.resolve({ data, error: error ? { message: error } : null }).then(resolve),
      };
    },
  } as unknown as PublishedContentClient;
  return { client, calls };
}

describe('publishedContextBundle contract', () => {
  it('parses a complete, ordered bundle', () => {
    const bundle = parsePublishedContextBundle(validBundle());
    expect(bundle.scope_key).toBe(SCOPE);
    expect(bundle.entities.map((entity) => entity.entity_key)).toEqual(['entity:a', 'entity:b']);
    expect(bundle.mentions[0]?.end_utf16).toBe(1);
    expect(bundle.events[0]?.participants[0]?.entity_key).toBe('entity:a');
  });

  it('rejects missing sections, malformed digests, and bad spans', () => {
    const missing = clone(validBundle()) as Partial<PublishedContextBundle>;
    delete missing.events;
    expect(() => parsePublishedContextBundle(missing)).toThrow(PublishedContextError);

    const badDigest = clone(validBundle());
    badDigest.claims[0]!.citations[0]!.digest = 'not-a-digest';
    expect(() => parsePublishedContextBundle(badDigest)).toThrow(PublishedContextError);

    const badSpan = clone(validBundle());
    badSpan.mentions[0]!.end_utf16 = 0;
    expect(() => parsePublishedContextBundle(badSpan)).toThrow(PublishedContextError);
  });

  it('rejects unknown fields and non-deterministic order', () => {
    const extra = clone(validBundle()) as unknown as Record<string, unknown>;
    extra.unexpected = true;
    expect(() => parsePublishedContextBundle(extra)).toThrow(PublishedContextError);

    const unsorted = clone(validBundle());
    unsorted.entities = [unsorted.entities[1]!, unsorted.entities[0]!];
    expect(() => parsePublishedContextBundle(unsorted)).toThrow(/deterministic order/);
  });
});

describe('SupabasePublishedContentRepository.fetchPublishedContextBundle', () => {
  it('calls the bundle RPC with the scope key and validates the payload', async () => {
    const { client, calls } = fakeRpcClient(validBundle());
    const repo = new SupabasePublishedContentRepository(client);
    const bundle = await repo.fetchPublishedContextBundle(SCOPE);
    expect(bundle.relevance[0]?.role_in_passage).toBe('The role.');
    expect(calls).toEqual([['published_context_bundle', { p_scope_key: SCOPE }]]);
  });

  it('throws when the backend errors or the payload is invalid', async () => {
    const failing = new SupabasePublishedContentRepository(
      fakeRpcClient(null, 'permission denied').client,
    );
    await expect(failing.fetchPublishedContextBundle(SCOPE)).rejects.toThrow('permission denied');

    const corrupt = new SupabasePublishedContentRepository(
      fakeRpcClient({ scope_key: SCOPE, contexts: [] }).client,
    );
    await expect(corrupt.fetchPublishedContextBundle(SCOPE)).rejects.toThrow(PublishedContextError);
  });
});

describe('publishedContentStore.fetchPublishedContextBundle', () => {
  beforeEach(() => resetPublishedContentStore());

  const stubRepo = (
    impl: (scopeKey: string) => Promise<PublishedContextBundle>,
  ): PublishedContentRepository => ({
    fetchPublishedVerses: async () => [],
    fetchPublishedEntities: async () => [],
    fetchPublishedAttestations: async () => [],
    fetchPublishedContextBundle: impl,
  });

  it('returns the bundle through the repository boundary', async () => {
    setPublishedContentRepository(stubRepo(async () => validBundle()));
    await expect(fetchPublishedContextBundle(SCOPE)).resolves.toMatchObject({ scope_key: SCOPE });
  });

  it('returns null (never throws) when unconfigured or failing', async () => {
    await expect(fetchPublishedContextBundle(SCOPE)).resolves.toBeNull();
    setPublishedContentRepository(
      stubRepo(async () => {
        throw new Error('offline');
      }),
    );
    await expect(fetchPublishedContextBundle(SCOPE)).resolves.toBeNull();
  });
});
