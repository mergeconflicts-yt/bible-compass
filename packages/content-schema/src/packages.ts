import { z } from "zod";

// ---------------------------------------------------------------------------
// Layered package schemas v2 — canonical / edition / locale (CUR-01)
// ---------------------------------------------------------------------------
// Executable form of docs/curation-structure/*.example.json (contract and
// schema 2.0.0, synthetic fixtures). This family is distinct from the
// T-CUR-01 draft track (1.0.0, content/pilot shapes): layered packages
// group records by kind, carry envelope versions plus job/submission
// identity, declare cross-layer dependencies, and report grouped
// coverage. Nothing here approves or publishes: every AI-authored record
// and package carries review_status "draft", candidates stay unresolved,
// and unknown translations, languages, or uses fail closed in validation.
// ---------------------------------------------------------------------------

const sha256Schema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, "Invalid sha256");

// --- Key grammars (fixture namespaces and ratified forms alike) ---

const entityKeySchema = z
  .string()
  .regex(/^entity:[a-z0-9-]+$/, "Invalid entity_key");
const claimKeySchema = z
  .string()
  .regex(/^claim:[a-z0-9-]+$/, "Invalid claim key");
const citationKeySchema = z
  .string()
  .regex(/^citation:[a-z0-9-]+$/, "Invalid citation key");
const questionRefSchema = z
  .string()
  .regex(/^question:[a-z0-9-]+$/, "Invalid question ref");
const attestationKeySchema = z
  .string()
  .regex(/^attestation:[a-z0-9-]+$/, "Invalid attestation_key");
const relationshipKeySchema = z
  .string()
  .regex(/^relationship:[a-z0-9-]+$/, "Invalid relationship_key");
const predicateKeySchema = z
  .string()
  .regex(/^relationship:[a-z0-9_-]+$/, "Invalid predicate_key");
const eventKeySchema = z
  .string()
  .regex(/^event:[a-z0-9-]+$/, "Invalid event_key");
const relevanceKeySchema = z
  .string()
  .regex(/^relevance:[a-z0-9-]+$/, "Invalid relevance_key");
const relevanceLocalizationKeySchema = z
  .string()
  .regex(
    /^relevance-localization:[a-z0-9-]+:[a-z0-9-]+$/,
    "Invalid localization_key",
  );
const profileKeySchema = z
  .string()
  .regex(/^profile:[a-z0-9-]+:[a-z0-9-]+$/, "Invalid profile_key");
const contextKeySchema = z
  .string()
  .regex(/^context:[a-z0-9-]+:[a-z0-9-]+$/, "Invalid context_key");
const mentionKeySchema = z
  .string()
  .regex(/^mention:[a-z0-9-]+:[a-z0-9-]+$/, "Invalid mention_key");
const evidenceItemKeySchema = z
  .string()
  .regex(/^evidence:[a-z0-9-]+:[a-z0-9-]+$/, "Invalid evidence_item_key");
const candidateKeySchema = z
  .string()
  .regex(/^candidate:[a-z0-9-]+:[a-z0-9-]+$/, "Invalid candidate_key");
const scopeKeySchema = z.string().regex(
  // Ratified scope keys carry the ASCII OSIS book code in the reference
  // span (docs/CANONICAL_IDENTIFIERS.md §6), which uses upper case.
  /^scope:[A-Za-z0-9-:.]+$/,
  "Invalid scope_key",
);
const verseKeySchema = z.string().regex(
  // Leading digit permitted so numbered OSIS works (1John, 2Kgs, ...)
  // align with workKeySchema in schemas.ts, which already allows [A-Za-z1-9].
  /^verse:[A-Za-z1-9][A-Za-z0-9]*\.\d+(\.\d+)?$/,
  "Invalid verse key",
);
const packageKeySchema = z
  .string()
  .regex(/^(draft|approved|registry):[a-z0-9-:]+$/, "Invalid package_key");
const submissionKeySchema = z
  .string()
  .regex(/^submission:[a-z0-9-:]+$/, "Invalid submission_id");
const jobKeySchema = z.string().regex(/^job:[a-z0-9-:]+$/, "Invalid job key");
const editionKeySchema = z.string().regex(
  // Ratified immutable edition keys append the source digest
  // (docs/CANONICAL_IDENTIFIERS.md §7): edition:bsb@20260912:sha-b2898c49
  /^edition:[a-z0-9-]+@[a-z0-9-]+(?::sha-[0-9a-f]{8})?$/,
  "Invalid translation_edition_key",
);

// --- Shared vocabularies (ratified lists; extended only by vocabulary review) ---

const evidenceStatusSchema = z.enum([
  "established",
  "probable",
  "possible",
  "disputed",
  "unknown",
]);
const textualBasisSchema = z.enum([
  "explicit",
  "strongly_implied",
  "inferred",
  "disputed",
]);
const identificationStatusSchema = z.enum([
  "established",
  "traditional",
  "proposed",
  "disputed",
  "unknown",
]);
const attestationKindSchema = z.enum([
  "primary_subject",
  "participant",
  "location",
  "topic",
  "genealogical_member",
  "implied_referent",
  "disputed_referent",
]);
const stanceSchema = z.enum([
  "supports",
  "qualifies",
  "disputes",
  "background",
]);
const evidenceFormSchema = z.enum([
  "direct",
  "inferential",
  "comparative",
  "contextual",
]);
const precisionSchema = z.enum([
  "exact_site",
  "approximate",
  "area",
  "candidates",
  "unknown",
]);
const importanceSchema = z.enum(["central", "supporting", "background"]);
const mentionFormSchema = z.enum([
  "explicit_name",
  "alias",
  "title",
  "pronoun",
  "indirect",
  "collective",
  "unnamed",
]);
const coverageResultSchema = z.enum([
  "complete_zero",
  "complete_with_records",
  "incomplete",
  "blocked",
  "not_applicable",
]);
const scopeRelationSchema = z.enum([
  "reports",
  "recalls",
  "anticipates",
  "interprets",
  "alludes",
]);
const entityTypeSchema = z.enum([
  "person",
  "deity",
  "place",
  "collective",
  "polity",
  "role",
  "object",
  "structure",
  "practice",
  "institution",
  "theme",
  "event",
]);
const resolutionStatusSchema = z.enum([
  "unresolved",
  "resolved_existing",
  "created_new_canonical",
  "duplicate",
  "rejected",
  "needs_more_evidence",
]);

const draftLiteral = z.literal("draft");

// --- Typed claim subjects and objects (closed discriminator, never unknown) ---

const pkgClaimSubjectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("entity"), key: entityKeySchema }).strict(),
  z.object({ type: z.literal("scope"), key: scopeKeySchema }).strict(),
  z.object({ type: z.literal("text"), value: z.string().min(1) }).strict(),
  z.object({ type: z.literal("number"), value: z.number() }).strict(),
  z.object({ type: z.literal("date_range"), key: z.string().min(1) }).strict(),
  z.object({ type: z.literal("geometry"), key: z.string().min(1) }).strict(),
  z.object({ type: z.literal("controlled"), key: z.string().min(1) }).strict(),
]);

const pkgClaimObjectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("entity"), key: entityKeySchema }).strict(),
  z.object({ type: z.literal("scope"), key: scopeKeySchema }).strict(),
  // Canonical-layer prose is never untagged: a text object always carries
  // the language of its value so localized text cannot leak into the
  // shared graph unmarked. New text objects must set value_language_tag.
  z.object({
    type: z.literal("text"),
    value: z.string().min(1),
    value_language_tag: z.enum(["en", "te", "ta"]).optional(),
  }).strict(),
  z.object({ type: z.literal("number"), value: z.number() }).strict(),
  z.object({ type: z.literal("date_range"), key: z.string().min(1) }).strict(),
  z.object({ type: z.literal("geometry"), key: z.string().min(1) }).strict(),
  z.object({ type: z.literal("controlled"), key: z.string().min(1) }).strict(),
]);

// --- Canonical-layer records ---

export const pkgEntityCandidateSchema = z
  .object({
    candidate_key: candidateKeySchema,
    entity_type: entityTypeSchema,
    // Source-derived display string. The locale layer owns localized
    // display names; the tag records which language this label is in so
    // canonical consumers never treat it as localized content.
    proposed_label: z.string().min(1),
    label_language_tag: z.enum(["en", "te", "ta"]).optional(),
    possible_existing_entity_keys: z.array(entityKeySchema),
    identifying_claim_keys: z.array(claimKeySchema),
    resolution_status: z.literal("unresolved"),
    review_status: draftLiteral,
  })
  .strict();

export const pkgClaimSchema = z
  .object({
    claim_key: claimKeySchema,
    subject: pkgClaimSubjectSchema,
    predicate: z.string().regex(/^[a-z][a-z0-9_]*$/, "Invalid predicate"),
    object: pkgClaimObjectSchema,
    evidence_status: evidenceStatusSchema,
    textual_basis: textualBasisSchema,
    citation_keys: z.array(citationKeySchema).min(1),
    review_status: draftLiteral,
  })
  .strict();

export const pkgCitationSchema = z
  .object({
    citation_key: citationKeySchema,
    claim_keys: z.array(claimKeySchema).min(1),
    evidence_item_key: evidenceItemKeySchema,
    stance: stanceSchema,
    evidence_form: evidenceFormSchema,
    review_status: draftLiteral,
  })
  .strict();

export const pkgAttestationSchema = z
  .object({
    attestation_key: attestationKeySchema,
    reference_key: verseKeySchema,
    entity_key: entityKeySchema,
    kind: attestationKindSchema,
    textual_basis: textualBasisSchema,
    identification_status: identificationStatusSchema,
    claim_keys: z.array(claimKeySchema),
    review_status: draftLiteral,
  })
  .strict();

export const pkgRelationshipSchema = z
  .object({
    relationship_key: relationshipKeySchema,
    subject_entity_key: entityKeySchema,
    predicate_key: predicateKeySchema,
    object_entity_key: entityKeySchema,
    applicable_scope_keys: z.array(scopeKeySchema).min(1),
    claim_keys: z.array(claimKeySchema),
    review_status: draftLiteral,
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

export const pkgEventSchema = z
  .object({
    event_key: eventKeySchema,
    event_type: z.string().regex(/^[a-z0-9-]+$/, "Invalid event_type"),
    participant_entity_keys: z.array(entityKeySchema),
    place_entity_keys: z.array(entityKeySchema),
    scripture_accounts: z
      .array(
        z
          .object({ scope_key: scopeKeySchema, relation: scopeRelationSchema })
          .strict(),
      )
      .min(1),
    claim_keys: z.array(claimKeySchema),
    review_status: draftLiteral,
  })
  .strict();

export const pkgPlaceSchema = z
  .object({
    entity_key: entityKeySchema,
    geographic_positions: z.array(
      z
        .object({
          evidence_item_key: evidenceItemKeySchema,
          precision: precisionSchema,
          claim_keys: z.array(claimKeySchema),
        })
        .strict(),
    ),
    review_status: draftLiteral,
  })
  .strict();

export const pkgRelevanceSchema = z
  .object({
    relevance_key: relevanceKeySchema,
    scope_key: scopeKeySchema,
    entity_key: entityKeySchema,
    importance: importanceSchema,
    is_attested: z.boolean(),
    claim_keys: z.array(claimKeySchema),
    review_status: draftLiteral,
  })
  .strict();

// Reconciliation is normalized to the global registry: a record references an
// existing canonical entity key directly. candidate_key is retained only for
// candidate-resolution packages (e.g. the locked Nehemiah 2 dataset); a
// registry-backed record may omit it.
export const pkgReconciliationSchema = z
  .object({
    candidate_key: candidateKeySchema.optional(),
    canonical_entity_key: entityKeySchema.optional(),
    resolution_status: resolutionStatusSchema,
    review_status: draftLiteral,
  })
  .strict()
  .superRefine((data, ctx) => {
    const decided =
      data.resolution_status === "resolved_existing" ||
      data.resolution_status === "created_new_canonical";
    if (decided && data.canonical_entity_key === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "decided reconciliation requires canonical_entity_key",
        path: ["canonical_entity_key"],
      });
    }
    if (!decided && data.canonical_entity_key !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "undecided reconciliation must not carry canonical_entity_key",
        path: ["canonical_entity_key"],
      });
    }
  });

// --- Edition-layer records ---

export const pkgMentionSchema = z
  .object({
    mention_key: mentionKeySchema,
    verse_key: verseKeySchema,
    attestation_key: attestationKeySchema,
    target: z
      .object({ type: z.literal("entity"), key: entityKeySchema })
      .strict(),
    mention_form: mentionFormSchema,
    selector: z
      .object({
        exact_quote: z.string().min(1),
        occurrence_ordinal: z.number().int().positive(),
        prefix: z.string(),
        suffix: z.string(),
      })
      .strict(),
    claim_keys: z.array(claimKeySchema),
    review_status: draftLiteral,
  })
  .strict();

// --- Locale-layer records ---

const localeDescriptionSchema = z
  .object({
    text: z.string().min(1),
    claim_keys: z.array(claimKeySchema),
  })
  .strict();

export const pkgProfileSchema = z
  .object({
    profile_key: profileKeySchema,
    entity_key: entityKeySchema,
    language_tag: z.string().min(1),
    preferred_name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    short_description: localeDescriptionSchema,
    extended_description: localeDescriptionSchema.nullable(),
    review_status: draftLiteral,
  })
  .strict();

const localeOrientationSectionSchema = z
  .object({
    text: z.string().min(1).nullable(),
    claim_keys: z.array(claimKeySchema),
    open_question_key: questionRefSchema.nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.text === null && data.open_question_key === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "null text requires open_question_key",
        path: ["open_question_key"],
      });
    }
  });

export const pkgPassageContextSchema = z
  .object({
    context_key: contextKeySchema,
    scope_key: scopeKeySchema,
    language_tag: z.string().min(1),
    orientation: z
      .object({
        who: localeOrientationSectionSchema,
        where: localeOrientationSectionSchema,
        when: localeOrientationSectionSchema,
        what: localeOrientationSectionSchema,
        before: localeOrientationSectionSchema,
        stakes: localeOrientationSectionSchema,
        immediate_summary: localeOrientationSectionSchema,
      })
      .strict(),
    review_status: draftLiteral,
  })
  .strict();

export const pkgRelevanceLocalizationSchema = z
  .object({
    localization_key: relevanceLocalizationKeySchema,
    relevance_key: relevanceKeySchema,
    scope_key: scopeKeySchema,
    entity_key: entityKeySchema,
    language_tag: z.string().min(1),
    role_text: z.string().min(1),
    claim_keys: z.array(claimKeySchema),
    review_status: draftLiteral,
  })
  .strict();

// --- Shared envelope pieces ---

const dependencySchema = z
  .object({
    package_key: packageKeySchema,
    revision: z.number().int().positive(),
    digest: sha256Schema,
  })
  .strict();

export const pkgQuestionSchema = z
  .object({
    question_key: questionRefSchema,
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
    record_key: z.string().min(1),
    field_path: z.string().regex(/^\//, "field_path must be a rooted pointer"),
    question: z.string().min(1),
    blocks_publication: z.boolean(),
  })
  .strict();

const editorialObservationSchema = z
  .object({
    code: z.string().min(1),
    record_key: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  })
  .strict();

const scopeBlockSchema = z
  .object({
    canon_key: z.string().min(1),
    reference_system_key: z.string().min(1),
    scope_keys: z.array(scopeKeySchema).min(1),
    reference_keys: z.array(verseKeySchema).min(1),
    language_tag: z.string().min(1).nullable(),
    translation_edition_key: editionKeySchema.nullable(),
  })
  .strict();

function referenceCoverageGroupSchema() {
  return z
    .object({
      result: coverageResultSchema,
      reference_keys: z.array(verseKeySchema).min(1),
      record_keys: z.array(z.string().min(1)),
      blocker_question_keys: z.array(questionRefSchema),
    })
    .strict();
}

function scopeCoverageGroupSchema() {
  return z
    .object({
      result: coverageResultSchema,
      scope_keys: z.array(scopeKeySchema).min(1),
      record_keys: z.array(z.string().min(1)),
      blocker_question_keys: z.array(questionRefSchema),
    })
    .strict();
}

function referenceCoverageBlockSchema() {
  return z
    .object({
      annotation_class: z.string().min(1),
      groups: z.array(referenceCoverageGroupSchema()).min(1),
    })
    .strict();
}

function scopeCoverageBlockSchema() {
  return z
    .object({
      annotation_class: z.string().min(1),
      groups: z.array(scopeCoverageGroupSchema()).min(1),
    })
    .strict();
}

const canonicalRecordsSchema = z
  .object({
    entity_candidates: z.array(pkgEntityCandidateSchema),
    claims: z.array(pkgClaimSchema),
    citations: z.array(pkgCitationSchema),
    attestations: z.array(pkgAttestationSchema),
    relationships: z.array(pkgRelationshipSchema),
    events: z.array(pkgEventSchema),
    places: z.array(pkgPlaceSchema),
    relevance: z.array(pkgRelevanceSchema),
    reconciliation_records: z.array(pkgReconciliationSchema).optional(),
  })
  .strict();

const editionRecordsSchema = z
  .object({
    mentions: z.array(pkgMentionSchema),
  })
  .strict();

const localeRecordsSchema = z
  .object({
    entity_profiles: z.array(pkgProfileSchema),
    passage_contexts: z.array(pkgPassageContextSchema),
    relevance_localizations: z.array(pkgRelevanceLocalizationSchema),
  })
  .strict();

function packageShell<R extends z.ZodTypeAny, C extends z.ZodTypeAny>(
  layer: "canonical" | "edition" | "locale",
  family: string,
  records: R,
  coverage: C,
) {
  return z
    .object({
      contract_version: z.literal("2.0.0"),
      schema_version: z.literal("2.0.0"),
      vocabulary_version: z.literal("1.0.0"),
      coverage_policy_version: z.literal("1.0.0"),
      data_classification: z.literal("synthetic_fixture"),
      package_key: packageKeySchema,
      package_revision: z.number().int().positive(),
      submission_id: submissionKeySchema,
      attempt: z.number().int().positive(),
      produced_for_job_id: jobKeySchema,
      package_layer: z.literal(layer),
      package_family: z.literal(family),
      scope: scopeBlockSchema,
      review_status: draftLiteral,
      dependencies: z.array(dependencySchema).min(1),
      records,
      coverage: z.array(coverage).min(1),
      open_questions: z.array(pkgQuestionSchema),
      editorial_observations: z.array(editorialObservationSchema),
    })
    .strict()
    .superRefine((data, ctx) => {
      // Translation-(in)dependence per layer: canonical carries neither
      // language nor edition; edition carries both; locale carries the
      // language but never an edition.
      const lang = data.scope.language_tag;
      const edition = data.scope.translation_edition_key;
      const problems: [path: string, message: string][] = [];
      if (layer === "canonical" && (lang !== null || edition !== null)) {
        problems.push([
          "scope",
          "canonical scope must have null language_tag and translation_edition_key",
        ]);
      }
      if (layer === "edition" && (lang === null || edition === null)) {
        problems.push([
          "scope",
          "edition scope requires language_tag and translation_edition_key",
        ]);
      }
      if (layer === "locale" && (lang === null || edition !== null)) {
        problems.push([
          "scope",
          "locale scope requires language_tag and null translation_edition_key",
        ]);
      }
      for (const [path, message] of problems) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
      }
    });
}

export const canonicalPackageSchema = packageShell(
  "canonical",
  "canonical-context-draft",
  canonicalRecordsSchema,
  referenceCoverageBlockSchema(),
);

export const editionPackageSchema = packageShell(
  "edition",
  "translation-mention-draft",
  editionRecordsSchema,
  referenceCoverageBlockSchema(),
);

export const localePackageSchema = packageShell(
  "locale",
  "locale-context-draft",
  localeRecordsSchema,
  scopeCoverageBlockSchema(),
);

export type CanonicalPackage = z.infer<typeof canonicalPackageSchema>;
export type EditionPackage = z.infer<typeof editionPackageSchema>;
export type LocalePackage = z.infer<typeof localePackageSchema>;

/** Job-supplied authority for layered validation (CUR-01 assumption: the
 * job context is the scope block plus declared dependencies plus injected
 * registry snapshots; tests inject fakes, production injects registry
 * reads — never hard-coded vocabularies). */
export interface PackageJobContext {
  /** Evidence-item keys citations and positions may cite. */
  evidenceItemKeys: readonly string[];
  /** Canonical entity identities already approved. */
  approvedEntityKeys?: readonly string[];
  /** Claim keys approved via dependencies. */
  approvedClaimKeys?: readonly string[];
  /** Attestation keys approved via dependencies (edition links). */
  approvedAttestationKeys?: readonly string[];
  /** Relevance keys approved via dependencies (locale links). */
  approvedRelevanceKeys?: readonly string[];
  /** Authoritative scope membership for locale coverage. */
  authoritativeScopeKeys?: readonly string[];
  /** Authoritative verse membership for canonical/edition coverage. */
  authoritativeReferenceKeys?: readonly string[];
  /** Allowed language tags (injected, never hard-coded). */
  languageTags?: readonly string[];
  /** Allowed canon keys. */
  canonKeys?: readonly string[];
  /** Allowed reference-system keys. */
  referenceSystemKeys?: readonly string[];
  /** Allowed translation-edition keys. */
  translationEditionKeys?: readonly string[];
}
