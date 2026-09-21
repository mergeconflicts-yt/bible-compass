/**
 * Complete published context read contract for one Scripture scope.
 *
 * Mirrors `public_content.published_context_bundle(scope_key)`. Every record
 * uses stable keys and the arrays are in deterministic order; the runtime
 * validation below rejects anything malformed or mis-ordered, so the mobile
 * boundary never trusts an unvalidated payload. Drafts are never present:
 * the server returns published rows only.
 */

import { z } from 'zod';

export class PublishedContextError extends Error {
  constructor(message: string) {
    super(`publishedContext: ${message}`);
    this.name = 'PublishedContextError';
  }
}

const key = z.string().min(1);
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/);

const nameSchema = z
  .object({
    language_tag: z.string().min(1),
    form: z.string().min(1),
    normalized_form: z.string().min(1),
    kind: z.string().min(1),
  })
  .strict();

const descriptionSchema = z
  .object({
    locale: z.string().min(1),
    revision: z.number().int().positive(),
    short_desc: z.string().min(1),
    extended_desc: z.string().nullable(),
  })
  .strict();

const entitySchema = z
  .object({
    entity_key: key,
    slug: z.string().min(1),
    type: z.string().min(1),
    identification_status: z.string().min(1),
    names: z.array(nameSchema),
    descriptions: z.array(descriptionSchema),
  })
  .strict();

const citationSchema = z
  .object({
    locator: z.string().min(1),
    support_kind: z.string().min(1),
    digest: sha256,
    edition_key: z.string().min(1).nullable(),
  })
  .strict();

const claimObjectSchema = z.object({ type: z.string().min(1) }).catchall(z.unknown());

const claimSchema = z
  .object({
    claim_key: key,
    subject: z.object({ type: z.string().min(1), key: key.nullable() }).strict(),
    predicate: z.string().min(1),
    object: claimObjectSchema,
    evidence_status: z.string().min(1),
    textual_basis: z.string().min(1),
    citations: z.array(citationSchema),
  })
  .strict();

const contextSchema = z
  .object({
    kind: z.string().min(1),
    text: z.string().min(1),
    claim_keys: z.array(key),
  })
  .strict();

const mentionSchema = z
  .object({
    book_osis: z.string().min(1),
    chapter: z.number().int().positive(),
    verse: z.number().int().nonnegative(),
    local_key: z.string().min(1),
    entity_key: key,
    form: z.string().min(1),
    quote: z.string().min(1),
    occurrence_ordinal: z.number().int().positive(),
    start_utf16: z.number().int().nonnegative(),
    end_utf16: z.number().int().nonnegative(),
    edition_key: z.string().min(1),
  })
  .strict()
  .refine((mention) => mention.end_utf16 > mention.start_utf16, {
    message: 'mention span end must exceed start',
  });

const relevanceSchema = z
  .object({
    scope_key: z.string().min(1),
    entity_key: key,
    role_in_passage: z.string().min(1),
    importance: z.enum(['central', 'supporting', 'background']),
    is_attested: z.boolean(),
  })
  .strict();

const relationshipSchema = z
  .object({
    subject_entity_key: key,
    predicate: z.string().min(1),
    object_entity_key: key,
    scope_key: z.string().min(1),
    certainty: z.string().min(1),
  })
  .strict();

const eventLinkSchema = z.object({ entity_key: key, role: z.string().nullable() }).strict();

const eventSchema = z
  .object({
    event_entity_key: key,
    event_kind: z.string().min(1),
    participants: z.array(eventLinkSchema),
    places: z.array(eventLinkSchema),
  })
  .strict();

/** Arrays must already be in the server's deterministic order. */
function isSorted<T>(items: T[], by: (item: T) => string): boolean {
  for (let index = 1; index < items.length; index += 1) {
    if (by(items[index - 1] as T) > by(items[index] as T)) return false;
  }
  return true;
}

export const publishedContextBundleSchema = z
  .object({
    scope_key: z.string().min(1),
    contexts: z.array(contextSchema),
    entities: z.array(entitySchema),
    claims: z.array(claimSchema),
    mentions: z.array(mentionSchema),
    relevance: z.array(relevanceSchema),
    relationships: z.array(relationshipSchema),
    events: z.array(eventSchema),
  })
  .strict()
  .superRefine((bundle, ctx) => {
    const checks: [string, boolean][] = [
      ['contexts', isSorted(bundle.contexts, (item) => item.kind)],
      ['entities', isSorted(bundle.entities, (item) => item.entity_key)],
      ['claims', isSorted(bundle.claims, (item) => item.claim_key)],
      [
        'mentions',
        isSorted(
          bundle.mentions,
          (item) =>
            `${item.book_osis}.${item.chapter}.${item.verse}.${item.entity_key}.${item.occurrence_ordinal}`,
        ),
      ],
      ['relevance', isSorted(bundle.relevance, (item) => item.entity_key)],
      [
        'relationships',
        isSorted(
          bundle.relationships,
          (item) => `${item.subject_entity_key}.${item.predicate}.${item.object_entity_key}`,
        ),
      ],
      ['events', isSorted(bundle.events, (item) => item.event_entity_key)],
    ];
    for (const [name, sorted] of checks) {
      if (!sorted)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${name} are not in deterministic order`,
        });
    }
  });

export type PublishedContextBundle = z.infer<typeof publishedContextBundleSchema>;
export type PublishedContextEntity = z.infer<typeof entitySchema>;
export type PublishedContextClaim = z.infer<typeof claimSchema>;
export type PublishedContextMention = z.infer<typeof mentionSchema>;
export type PublishedContextEvent = z.infer<typeof eventSchema>;

/** Parse and validate a server bundle; throws PublishedContextError on any defect. */
export function parsePublishedContextBundle(data: unknown): PublishedContextBundle {
  const parsed = publishedContextBundleSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new PublishedContextError(first?.message ?? 'invalid bundle');
  }
  return parsed.data;
}
