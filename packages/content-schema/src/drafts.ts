import { z } from "zod";
import { scopeKeySchema, refsysKeySchema, claimSchema } from "./schemas";

// ---------------------------------------------------------------------------
// Draft-package record schemas (curation track T-CUR-01)
// ---------------------------------------------------------------------------
// Executable form of the pilot draft shapes (content/pilot/drafts/20A-G)
// and the AI_CURATION_CONTRACT record matrix. Every shape below mirrors an
// observed draft record or a contract-required record with no pilot
// exhibit yet (marked as such). Drafts are untrusted input: strict mode
// throughout, unknown record kinds rejected, cross-record references
// checked by checkDraftReferences in ./validators (not here).
//
// Key grammars follow the ratified Gate A1/A2 identifiers
// (docs/CANONICAL_IDENTIFIERS.md), not the contract doc's older examples.
// Known divergence: draft predicate_key values carry a `relationship:`
// prefix while private_staging.relationship_predicates keys are bare
// (served_as); mapping bare vocabularies is deterministic-converter work
// (future task), never silent coercion here.
// ---------------------------------------------------------------------------

const recordKeySchema = z.string().regex(/^[a-z0-9-]+$/, "Invalid record_key");
const entityKeySchema = z
  .string()
  .regex(/^entity:[a-z0-9-]+$/, "Invalid entity_key");
const claimKeySchema = z
  .string()
  .regex(/^claim:[a-z0-9-]+$/, "Invalid claim key");
const questionKeySchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, "Invalid question key");
const candidateKeySchema = z
  .string()
  .regex(/^candidate:[a-z0-9-]+:[a-z0-9-]+$/, "Invalid candidate_key");
const entityTypeKeySchema = z
  .string()
  .regex(/^entity-type:[a-z0-9-]+$/, "Invalid entity_type_key");
const predicateKeySchema = z
  .string()
  .regex(/^relationship:[a-z0-9_-]+$/, "Invalid predicate_key");
const localeSchema = z.enum(["en", "te", "ta"]);
const sha256Schema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, "Invalid sha256");

const descriptionBlockSchema = z
  .object({
    text: z.string().min(1),
    claim_keys: z.array(claimKeySchema).min(1),
  })
  .strict();

export const entityCandidateSchema = z
  .object({
    record_key: recordKeySchema,
    record_kind: z.literal("entity_candidate"),
    candidate_key: candidateKeySchema,
    entity_type_key: entityTypeKeySchema,
    proposed_editorial_label: z.string().min(1),
    possible_existing_entity_keys: z.array(entityKeySchema),
    identifying_claim_keys: z.array(claimKeySchema),
    resolution_status: z.enum([
      "unresolved",
      "resolved_existing",
      "created_new_canonical",
      "duplicate",
      "rejected",
      "needs_more_evidence",
    ]),
  })
  .strict();

export const entityProfileSchema = z
  .object({
    record_key: recordKeySchema,
    record_kind: z.literal("entity_profile"),
    entity_key: entityKeySchema,
    language_tag: localeSchema,
    short_description: descriptionBlockSchema,
    extended_description: descriptionBlockSchema.optional(),
    alias_record_keys: z.array(recordKeySchema).optional(),
  })
  .strict();

export const canonicalAttestationDraftSchema = z
  .object({
    record_key: recordKeySchema,
    record_kind: z.literal("canonical_attestation"),
    reference_system_key: refsysKeySchema,
    reference_key: z
      .string()
      .regex(
        /^verse:[A-Za-z1-9]+\.\d+(\.\d+)?$/,
        "Invalid reference_key (verse:Book.ch[.vs])",
      ),
    entity_key: entityKeySchema,
    attestation_kind: z.enum([
      "primary_subject",
      "participant",
      "location",
      "topic",
      "genealogical_member",
      "implied_referent",
      "disputed_referent",
    ]),
    textual_basis: z.enum([
      "explicit",
      "strongly_implied",
      "inferred",
      "disputed",
    ]),
    identification_status: z.enum([
      "established",
      "traditional",
      "proposed",
      "disputed",
      "unknown",
    ]),
    claim_keys: z.array(claimKeySchema),
  })
  .strict();

export const entityRelationshipDraftSchema = z
  .object({
    record_key: recordKeySchema,
    record_kind: z.literal("entity_relationship"),
    subject_entity_key: entityKeySchema,
    predicate_key: predicateKeySchema,
    object_entity_key: entityKeySchema,
    claim_keys: z.array(claimKeySchema),
    sourceLocator: z.string().min(1).optional(),
    sourceReleaseKey: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.subject_entity_key === data.object_entity_key) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "subject and object must differ",
        path: ["object_entity_key"],
      });
    }
  });

export const eventDraftSchema = z
  .object({
    record_key: recordKeySchema,
    record_kind: z.literal("event"),
    entity_key: entityKeySchema,
    event_kind: z.string().min(1),
    participants: z.array(entityKeySchema),
    places: z.array(entityKeySchema),
    scope: scopeKeySchema,
    relation: z.enum([
      "reports",
      "recalls",
      "anticipates",
      "interprets",
      "alludes",
    ]),
    claim_keys: z.array(claimKeySchema).optional(),
  })
  .strict();

export const placeDraftSchema = z
  .object({
    record_key: recordKeySchema,
    record_kind: z.literal("place"),
    entity_key: entityKeySchema,
    geometry: z
      .object({
        type: z.literal("Point"),
        coordinates: z
          .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
          .describe("lon,lat"),
        crs: z.string().min(1),
        precision: z.enum([
          "exact_site",
          "approximate",
          "area",
          "candidates",
          "unknown",
        ]),
      })
      .strict(),
    claim_keys: z.array(claimKeySchema).optional(),
  })
  .strict();

export const passageEntityRoleSchema = z
  .object({
    record_key: recordKeySchema,
    record_kind: z.literal("passage_entity_role"),
    entity_key: entityKeySchema,
    role_key: z.string().min(1),
    role_text: z.string().min(1),
    explicitly_attested_in_scope: z.boolean(),
    display_priority: z.number().int().positive(),
    claim_keys: z.array(claimKeySchema),
  })
  .strict();

const contextSectionSchema = z
  .object({
    text: z.string().min(1).nullable(),
    claim_keys: z.array(claimKeySchema),
    open_question_key: questionKeySchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Honest-partial-coverage rule: a missing section must name its
    // question. (Text alongside a question is allowed: partially known.)
    if (data.text === null && data.open_question_key === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "null text requires open_question_key",
        path: ["open_question_key"],
      });
    }
  });

export const passageContextSchema = z
  .object({
    record_key: recordKeySchema,
    record_kind: z.literal("passage_context"),
    scope_key: scopeKeySchema,
    who: contextSectionSchema,
    where: contextSectionSchema,
    when: contextSectionSchema,
    what: contextSectionSchema,
    before: contextSectionSchema,
    stakes: contextSectionSchema,
    immediate_summary: contextSectionSchema,
  })
  .strict();

export const claimLocalizationSchema = z
  .object({
    record_key: recordKeySchema,
    record_kind: z.literal("claim_localization"),
    claim_key: claimKeySchema,
    locale: localeSchema,
    text: z.string().min(1),
    translation_method: z.string().min(1),
    source_revision: z.number().int().positive(),
    review_state: z.enum(["draft", "in_review", "approved", "published"]),
  })
  .strict();

export const coverageResultSchema = z
  .object({
    record_key: recordKeySchema,
    record_kind: z.literal("coverage_result"),
    reference_system_key: refsysKeySchema,
    scope_key: scopeKeySchema,
    annotation_class: z.string().min(1),
    result: z.enum([
      "complete_zero",
      "complete_with_records",
      "incomplete",
      "blocked",
      "not_applicable",
    ]),
    record_keys: z.array(recordKeySchema).optional(),
    blocker_question_keys: z.array(questionKeySchema).optional(),
  })
  .strict();

export const openQuestionSchema = z
  .object({
    question_key: questionKeySchema,
    record_key: recordKeySchema.optional(),
    field_path: z.string().min(1).optional(),
    question_type: z.enum([
      "missing_source",
      "insufficient_evidence",
      "ambiguous_identity",
      "ambiguous_reference",
      "conflicting_sources",
      "disputed_interpretation",
      "uncertain_date",
      "uncertain_location",
      "rights_unknown",
      "out_of_scope",
    ]),
    question: z.string().min(1),
    candidate_options: z
      .array(
        z
          .object({
            label: z.string().min(1),
            supporting_citation_keys: z.array(z.string().min(1)).optional(),
          })
          .strict(),
      )
      .optional(),
    blocks_publication: z.boolean(),
  })
  .strict();

export const editorialObservationSchema = z
  .object({
    code: z.string().min(1),
    record_key: recordKeySchema.optional(),
    note: z.string().min(1).optional(),
  })
  .strict();

/**
 * Draft claim record: the ratified claim shape (./schemas claimSchema —
 * the same shape that lands in staging, minus generated ids) plus draft
 * envelope identity. Packages define the claims they reference; the
 * cross-record check resolves claim_keys against these definitions.
 */
export const draftClaimSchema = claimSchema.extend({
  record_key: recordKeySchema,
  record_kind: z.literal("claim"),
});

// Draft package kinds observed in the pilot (content/pilot/drafts/20A-G).
// translation-mention-draft is intentionally absent: its draft record
// shape plus the mention-to-span derivation (G3) is the immediate
// follow-up, not a half-gated kind here.
export const draftPackageKindSchema = z.enum([
  "entity-profile-draft",
  "english-localization-draft",
  "canonical-attestation-draft",
  "entity-relationship-draft",
  "event-place-draft",
  "passage-relevance-draft",
  "passage-context-draft",
]);

const draftRecordSchemas = {
  entity_candidate: entityCandidateSchema,
  entity_profile: entityProfileSchema,
  claim: draftClaimSchema,
  canonical_attestation: canonicalAttestationDraftSchema,
  entity_relationship: entityRelationshipDraftSchema,
  event: eventDraftSchema,
  place: placeDraftSchema,
  passage_entity_role: passageEntityRoleSchema,
  passage_context: passageContextSchema,
  claim_localization: claimLocalizationSchema,
  coverage_result: coverageResultSchema,
} as const;

/** Record schemas by kind — the validator dispatches per record so every
 * failure carries its own pointer and reason (a zod union would collapse
 * them into one generic error). */
export const DRAFT_RECORD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  ...draftRecordSchemas,
};

export type DraftRecord =
  | z.infer<typeof entityCandidateSchema>
  | z.infer<typeof entityProfileSchema>
  | z.infer<typeof draftClaimSchema>
  | z.infer<typeof canonicalAttestationDraftSchema>
  | z.infer<typeof entityRelationshipDraftSchema>
  | z.infer<typeof eventDraftSchema>
  | z.infer<typeof placeDraftSchema>
  | z.infer<typeof passageEntityRoleSchema>
  | z.infer<typeof passageContextSchema>
  | z.infer<typeof claimLocalizationSchema>
  | z.infer<typeof coverageResultSchema>;

/** Which record kinds each package kind may carry. `claim` and
 * `entity_candidate` ride every package: claims are package-scoped
 * definitions for cited keys, and candidates propose the identities that
 * records cite (the pilot's dangling claim_keys are exactly what the
 * cross-record check rejects). */
export const PACKAGE_RECORD_KINDS: Record<string, readonly string[]> = {
  "entity-profile-draft": ["entity_candidate", "entity_profile", "claim"],
  "english-localization-draft": ["entity_candidate", "entity_profile", "claim"],
  "canonical-attestation-draft": [
    "entity_candidate",
    "canonical_attestation",
    "claim",
  ],
  "entity-relationship-draft": [
    "entity_candidate",
    "entity_relationship",
    "claim",
  ],
  "event-place-draft": ["entity_candidate", "event", "place", "claim"],
  "passage-relevance-draft": [
    "entity_candidate",
    "passage_entity_role",
    "claim",
  ],
  "passage-context-draft": ["entity_candidate", "passage_context", "claim"],
};

export const draftPackageShellSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    package_kind: draftPackageKindSchema,
    records: z.array(z.unknown()).min(1),
    open_questions: z.array(openQuestionSchema),
    editorial_observations: z.array(editorialObservationSchema),
    bundleDigest: sha256Schema,
    jobId: z.string().min(1),
    draft_revision: z.number().int().positive(),
  })
  .strict();

export interface DraftPackage {
  schema_version: "1.0.0";
  package_kind: z.infer<typeof draftPackageKindSchema>;
  records: DraftRecord[];
  open_questions: z.infer<typeof openQuestionSchema>[];
  editorial_observations: z.infer<typeof editorialObservationSchema>[];
  bundleDigest: string;
  jobId: string;
  draft_revision: number;
}
