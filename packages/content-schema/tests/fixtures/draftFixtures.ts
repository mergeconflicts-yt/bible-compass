/**
 * Synthetic draft-package fixtures (T-CUR-01) — clearly not production,
 * never publish. Positive fixtures resolve every reference; invalid
 * fixtures each fail for one documented reason.
 */

const SHA = "sha256:" + "a".repeat(64);

function claim(key: string) {
  return {
    record_key: `record-${key.slice(6)}`,
    record_kind: "claim",
    key,
    subjectType: "entity",
    subjectId: "entity:nehemiah-governor",
    predicate: "was_cupbearer_to",
    object: { kind: "entity", entity_key: "entity:artaxerxes-i" },
    evidenceStatus: "probable",
    textualBasis: "strongly_implied",
    reviewState: "draft",
  };
}

export const validEntityPackage = {
  schema_version: "1.0.0",
  package_kind: "entity-profile-draft",
  records: [
    {
      record_key: "entity-nehemiah",
      record_kind: "entity_candidate",
      candidate_key: "candidate:job-1:nehemiah",
      entity_type_key: "entity-type:person",
      proposed_editorial_label: "entity:nehemiah-governor",
      possible_existing_entity_keys: [],
      identifying_claim_keys: ["claim:nehemiah-was-cupbearer"],
      resolution_status: "unresolved",
    },
    {
      record_key: "profile-nehemiah-en",
      record_kind: "entity_profile",
      entity_key: "entity:nehemiah-governor",
      language_tag: "en",
      short_description: {
        text: "Nehemiah, cupbearer to Artaxerxes.",
        claim_keys: ["claim:nehemiah-was-cupbearer"],
      },
    },
    claim("claim:nehemiah-was-cupbearer"),
  ],
  open_questions: [],
  editorial_observations: [],
  bundleDigest: SHA,
  jobId: "job:synthetic-001",
  draft_revision: 1,
};

function section(
  text: string | null,
  claimKeys: string[],
  questionKey?: string,
) {
  return {
    text,
    claim_keys: claimKeys,
    ...(questionKey === undefined ? {} : { open_question_key: questionKey }),
  };
}

export const validContextPackage = {
  schema_version: "1.0.0",
  package_kind: "passage-context-draft",
  records: [
    {
      record_key: "context-neh2",
      record_kind: "passage_context",
      scope_key: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      who: section("Nehemiah the cupbearer", ["claim:nehemiah-was-cupbearer"]),
      where: section("Susa", ["claim:susa-location"]),
      when: section(null, [], "question-when-001"),
      what: section("A request to rebuild", ["claim:nehemiah-was-cupbearer"]),
      before: section("Exile and return", ["claim:nehemiah-was-cupbearer"]),
      stakes: section("The city stays in ruins", [
        "claim:nehemiah-was-cupbearer",
      ]),
      immediate_summary: section("Nehemiah asks the king", [
        "claim:nehemiah-was-cupbearer",
      ]),
    },
    claim("claim:nehemiah-was-cupbearer"),
    {
      record_key: "record-susa-location",
      record_kind: "claim",
      key: "claim:susa-location",
      subjectType: "entity",
      subjectId: "entity:susa-citadel",
      predicate: "located_at",
      object: { kind: "text", value: "Susa" },
      evidenceStatus: "probable",
      textualBasis: "strongly_implied",
      reviewState: "draft",
    },
  ],
  open_questions: [
    {
      question_key: "question-when-001",
      question_type: "uncertain_date",
      question: "Which regnal year reading should the date follow?",
      blocks_publication: true,
    },
  ],
  editorial_observations: [],
  bundleDigest: SHA,
  jobId: "job:synthetic-002",
  draft_revision: 1,
};

export const validEventPlacePackage = {
  schema_version: "1.0.0",
  package_kind: "event-place-draft",
  records: [
    {
      record_key: "entity-nehemiah",
      record_kind: "entity_candidate",
      candidate_key: "candidate:job-3:nehemiah",
      entity_type_key: "entity-type:person",
      proposed_editorial_label: "entity:nehemiah-governor",
      possible_existing_entity_keys: [],
      identifying_claim_keys: [],
      resolution_status: "unresolved",
    },
    {
      record_key: "entity-jerusalem",
      record_kind: "entity_candidate",
      candidate_key: "candidate:job-3:jerusalem",
      entity_type_key: "entity-type:place",
      proposed_editorial_label: "entity:jerusalem",
      possible_existing_entity_keys: [],
      identifying_claim_keys: [],
      resolution_status: "unresolved",
    },
    {
      record_key: "event-return",
      record_kind: "event",
      entity_key: "entity:return-to-jerusalem",
      event_kind: "return",
      participants: ["entity:nehemiah-governor"],
      places: ["entity:jerusalem"],
      scope: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      relation: "reports",
    },
    {
      record_key: "place-jerusalem",
      record_kind: "place",
      entity_key: "entity:jerusalem",
      geometry: {
        type: "Point",
        coordinates: [35.235, 31.778],
        crs: "EPSG:4326",
        precision: "approximate",
      },
    },
  ],
  open_questions: [],
  editorial_observations: [],
  bundleDigest: SHA,
  jobId: "job:synthetic-003",
  draft_revision: 1,
};
