/**
 * Synthetic v2 package fixtures (CUR-01) — clearly not production, never
 * publish. Positive fixtures mirror the docs/curation-structure examples
 * with job contexts that authorize every external reference; invalid
 * fixtures each fail for one documented reason.
 */

import type { PackageJobContext } from "../../src/packages";

const SHA0 = `sha256:${"0".repeat(64)}`;

export const canonicalFixtureCtx: PackageJobContext = {
  evidenceItemKeys: [
    "evidence:fixture-source:item-001",
    "evidence:fixture-geography:item-001",
  ],
  approvedEntityKeys: [
    "entity:fixture-person",
    "entity:fixture-role",
    "entity:fixture-place",
  ],
  approvedClaimKeys: [],
  authoritativeReferenceKeys: ["verse:Neh.2.1", "verse:Neh.2.2"],
  languageTags: ["en"],
  canonKeys: ["canon:prot-66"],
  referenceSystemKeys: ["refsys:eng-v22"],
};

export const editionFixtureCtx: PackageJobContext = {
  evidenceItemKeys: ["evidence:fixture-source:item-001"],
  approvedEntityKeys: ["entity:fixture-person"],
  approvedClaimKeys: ["claim:fixture-person-has-role"],
  approvedAttestationKeys: ["attestation:fixture-neh-2-1-person"],
  authoritativeReferenceKeys: ["verse:Neh.2.1", "verse:Neh.2.2"],
  languageTags: ["en"],
  canonKeys: ["canon:prot-66"],
  referenceSystemKeys: ["refsys:eng-v22"],
  translationEditionKeys: ["edition:synthetic-en@fixture-1"],
};

export const localeFixtureCtx: PackageJobContext = {
  evidenceItemKeys: ["evidence:fixture-source:item-001"],
  approvedEntityKeys: ["entity:fixture-person"],
  approvedClaimKeys: ["claim:fixture-person-has-role"],
  approvedRelevanceKeys: ["relevance:fixture-scope-person"],
  authoritativeScopeKeys: ["scope:fixture-neh-2-1-2"],
  languageTags: ["en"],
  canonKeys: ["canon:prot-66"],
  referenceSystemKeys: ["refsys:eng-v22"],
};

const envelopeBase = {
  contract_version: "2.0.0",
  schema_version: "2.0.0",
  vocabulary_version: "1.0.0",
  coverage_policy_version: "1.0.0",
  data_classification: "synthetic_fixture",
  package_revision: 1,
  attempt: 1,
  review_status: "draft",
  dependencies: [
    { package_key: "registry:fixture:entities", revision: 1, digest: SHA0 },
  ],
  editorial_observations: [],
};

const canonScope = {
  canon_key: "canon:prot-66",
  reference_system_key: "refsys:eng-v22",
  scope_keys: ["scope:fixture-neh-2-1-2"],
  reference_keys: ["verse:Neh.2.1", "verse:Neh.2.2"],
  language_tag: null,
  translation_edition_key: null,
};

export const validCanonicalPackage = {
  ...envelopeBase,
  package_key: "draft:fixture:canonical:neh-2-1-2",
  submission_id: "submission:fixture-canonical-001:attempt-1",
  produced_for_job_id: "job:fixture-canonical-001",
  package_layer: "canonical",
  package_family: "canonical-context-draft",
  scope: canonScope,
  records: {
    entity_candidates: [
      {
        candidate_key: "candidate:fixture-canonical-001:entity-001",
        entity_type: "person",
        proposed_label: "Synthetic unresolved person",
        possible_existing_entity_keys: [],
        identifying_claim_keys: ["claim:fixture-person-has-role"],
        resolution_status: "unresolved",
        review_status: "draft",
      },
    ],
    claims: [
      {
        claim_key: "claim:fixture-person-has-role",
        subject: { type: "entity", key: "entity:fixture-person" },
        predicate: "has_role",
        object: { type: "entity", key: "entity:fixture-role" },
        evidence_status: "established",
        textual_basis: "explicit",
        citation_keys: ["citation:fixture-person-has-role-1"],
        review_status: "draft",
      },
    ],
    citations: [
      {
        citation_key: "citation:fixture-person-has-role-1",
        claim_keys: ["claim:fixture-person-has-role"],
        evidence_item_key: "evidence:fixture-source:item-001",
        stance: "supports",
        evidence_form: "direct",
        review_status: "draft",
      },
    ],
    attestations: [
      {
        attestation_key: "attestation:fixture-neh-2-1-person",
        reference_key: "verse:Neh.2.1",
        entity_key: "entity:fixture-person",
        kind: "participant",
        textual_basis: "explicit",
        identification_status: "established",
        claim_keys: ["claim:fixture-person-has-role"],
        review_status: "draft",
      },
    ],
    relationships: [
      {
        relationship_key: "relationship:fixture-person-holds-role",
        subject_entity_key: "entity:fixture-person",
        predicate_key: "relationship:holds-role",
        object_entity_key: "entity:fixture-role",
        applicable_scope_keys: ["scope:fixture-neh-2-1-2"],
        claim_keys: ["claim:fixture-person-has-role"],
        review_status: "draft",
      },
    ],
    events: [
      {
        event_key: "event:fixture-event",
        event_type: "fixture-event-type",
        participant_entity_keys: ["entity:fixture-person"],
        place_entity_keys: ["entity:fixture-place"],
        scripture_accounts: [
          { scope_key: "scope:fixture-neh-2-1-2", relation: "reports" },
        ],
        claim_keys: [],
        review_status: "draft",
      },
    ],
    places: [
      {
        entity_key: "entity:fixture-place",
        geographic_positions: [
          {
            evidence_item_key: "evidence:fixture-geography:item-001",
            precision: "unknown",
            claim_keys: [],
          },
        ],
        review_status: "draft",
      },
    ],
    relevance: [
      {
        relevance_key: "relevance:fixture-scope-person",
        scope_key: "scope:fixture-neh-2-1-2",
        entity_key: "entity:fixture-person",
        importance: "central",
        is_attested: true,
        claim_keys: ["claim:fixture-person-has-role"],
        review_status: "draft",
      },
    ],
  },
  coverage: [
    {
      annotation_class: "canonical_entity_attestation",
      groups: [
        {
          result: "complete_with_records",
          reference_keys: ["verse:Neh.2.1"],
          record_keys: ["attestation:fixture-neh-2-1-person"],
          blocker_question_keys: [],
        },
        {
          result: "complete_zero",
          reference_keys: ["verse:Neh.2.2"],
          record_keys: [],
          blocker_question_keys: [],
        },
      ],
    },
  ],
  open_questions: [],
};

export const validEditionPackage = {
  ...envelopeBase,
  package_key: "draft:fixture:edition-synthetic-en:neh-2-1-2",
  submission_id: "submission:fixture-edition-001:attempt-1",
  produced_for_job_id: "job:fixture-edition-001",
  package_layer: "edition",
  package_family: "translation-mention-draft",
  scope: {
    ...canonScope,
    language_tag: "en",
    translation_edition_key: "edition:synthetic-en@fixture-1",
  },
  dependencies: [
    {
      package_key: "approved:fixture:canonical:neh-2-1-2",
      revision: 1,
      digest: `sha256:${"1".repeat(64)}`,
    },
  ],
  records: {
    mentions: [
      {
        mention_key: "mention:fixture-edition:neh-2-1-person",
        verse_key: "verse:Neh.2.1",
        attestation_key: "attestation:fixture-neh-2-1-person",
        target: { type: "entity", key: "entity:fixture-person" },
        mention_form: "explicit_name",
        selector: {
          exact_quote: "Synthetic Person",
          occurrence_ordinal: 1,
          prefix: "",
          suffix: "",
        },
        claim_keys: ["claim:fixture-person-has-role"],
        review_status: "draft",
      },
    ],
  },
  coverage: [
    {
      annotation_class: "translation_mention",
      groups: [
        {
          result: "complete_with_records",
          reference_keys: ["verse:Neh.2.1"],
          record_keys: ["mention:fixture-edition:neh-2-1-person"],
          blocker_question_keys: [],
        },
        {
          result: "complete_zero",
          reference_keys: ["verse:Neh.2.2"],
          record_keys: [],
          blocker_question_keys: [],
        },
      ],
    },
  ],
  open_questions: [],
};

function localeSection(
  text: string | null,
  claimKeys: string[],
  questionKey: string | null,
) {
  return { text, claim_keys: claimKeys, open_question_key: questionKey };
}

export const validLocalePackage = {
  ...envelopeBase,
  package_key: "draft:fixture:locale-en:neh-2-1-2",
  submission_id: "submission:fixture-locale-en-001:attempt-1",
  produced_for_job_id: "job:fixture-locale-en-001",
  package_layer: "locale",
  package_family: "locale-context-draft",
  scope: { ...canonScope, language_tag: "en" },
  dependencies: [
    {
      package_key: "approved:fixture:canonical:neh-2-1-2",
      revision: 1,
      digest: `sha256:${"1".repeat(64)}`,
    },
  ],
  records: {
    entity_profiles: [
      {
        profile_key: "profile:en:fixture-person",
        entity_key: "entity:fixture-person",
        language_tag: "en",
        preferred_name: "Synthetic Person",
        aliases: [],
        short_description: {
          text: "Synthetic fixture description.",
          claim_keys: ["claim:fixture-person-has-role"],
        },
        extended_description: null,
        review_status: "draft",
      },
    ],
    passage_contexts: [
      {
        context_key: "context:en:fixture-neh-2-1-2",
        scope_key: "scope:fixture-neh-2-1-2",
        language_tag: "en",
        orientation: {
          who: localeSection(
            "Synthetic fixture text.",
            ["claim:fixture-person-has-role"],
            null,
          ),
          where: localeSection(null, [], "question:fixture-location"),
          when: localeSection(null, [], "question:fixture-date"),
          what: localeSection(
            "Synthetic fixture text.",
            ["claim:fixture-person-has-role"],
            null,
          ),
          before: localeSection(null, [], "question:fixture-before"),
          stakes: localeSection(null, [], "question:fixture-stakes"),
          immediate_summary: localeSection(
            "Synthetic fixture text.",
            ["claim:fixture-person-has-role"],
            null,
          ),
        },
        review_status: "draft",
      },
    ],
    relevance_localizations: [
      {
        localization_key: "relevance-localization:en:fixture-scope-person",
        relevance_key: "relevance:fixture-scope-person",
        scope_key: "scope:fixture-neh-2-1-2",
        entity_key: "entity:fixture-person",
        language_tag: "en",
        role_text: "Synthetic explanation of why the entity matters.",
        claim_keys: ["claim:fixture-person-has-role"],
        review_status: "draft",
      },
    ],
  },
  coverage: [
    {
      annotation_class: "passage_context_localization",
      groups: [
        {
          result: "blocked",
          scope_keys: ["scope:fixture-neh-2-1-2"],
          record_keys: ["context:en:fixture-neh-2-1-2"],
          blocker_question_keys: [
            "question:fixture-location",
            "question:fixture-date",
            "question:fixture-before",
            "question:fixture-stakes",
          ],
        },
      ],
    },
  ],
  open_questions: [
    {
      question_key: "question:fixture-location",
      question_type: "uncertain_location",
      record_key: "context:en:fixture-neh-2-1-2",
      field_path: "/records/passage_contexts/0/orientation/where",
      question: "Synthetic fixture question.",
      blocks_publication: true,
    },
    {
      question_key: "question:fixture-date",
      question_type: "uncertain_date",
      record_key: "context:en:fixture-neh-2-1-2",
      field_path: "/records/passage_contexts/0/orientation/when",
      question: "Synthetic fixture question.",
      blocks_publication: true,
    },
    {
      question_key: "question:fixture-before",
      question_type: "insufficient_evidence",
      record_key: "context:en:fixture-neh-2-1-2",
      field_path: "/records/passage_contexts/0/orientation/before",
      question: "Synthetic fixture question.",
      blocks_publication: true,
    },
    {
      question_key: "question:fixture-stakes",
      question_type: "insufficient_evidence",
      record_key: "context:en:fixture-neh-2-1-2",
      field_path: "/records/passage_contexts/0/orientation/stakes",
      question: "Synthetic fixture question.",
      blocks_publication: true,
    },
  ],
};
