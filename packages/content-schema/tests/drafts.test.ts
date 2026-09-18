import {
  validateDraftPackage,
  checkDraftReferences,
  ValidationError,
} from "../src/validators";
import {
  validEntityPackage,
  validContextPackage,
  validEventPlacePackage,
} from "./fixtures/draftFixtures";
import { fixtures as golden } from "./fixtures/goldenFixtures";
import { coverageResultSchema } from "../src/drafts";

function expectInvalid(data: unknown, code: string, snippet: string): void {
  try {
    validateDraftPackage(data);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe(code);
    expect((error as ValidationError).message).toContain(snippet);
    return;
  }
  throw new Error("expected validation to throw");
}

describe("draft packages — positive fixtures", () => {
  it("accepts an entity package with resolvable candidates, profiles, and claims", () => {
    const parsed = validateDraftPackage(validEntityPackage);
    expect(parsed.records).toHaveLength(3);
  });

  it("accepts a context package with honest null sections bound to questions", () => {
    const parsed = validateDraftPackage(validContextPackage);
    expect(parsed.records).toHaveLength(3);
  });

  it("accepts events and places with resolvable participants", () => {
    const parsed = validateDraftPackage(validEventPlacePackage);
    expect(parsed.records).toHaveLength(4);
  });

  it("resolves entities against an approved snapshot without same-package candidates", () => {
    const pkg = {
      schema_version: "1.0.0",
      package_kind: "canonical-attestation-draft",
      records: [
        {
          record_key: "attestation-001",
          record_kind: "canonical_attestation",
          reference_system_key: "refsys:eng-v22",
          reference_key: "verse:Neh.2.1",
          entity_key: "entity:artaxerxes-i",
          attestation_kind: "participant",
          textual_basis: "explicit",
          identification_status: "established",
          claim_keys: ["claim:artaxerxes-was-king"],
        },
        {
          record_key: "record-artaxerxes-was-king",
          record_kind: "claim",
          key: "claim:artaxerxes-was-king",
          subjectType: "entity",
          subjectId: "entity:artaxerxes-i",
          predicate: "ruled",
          object: { kind: "text", value: "Persia" },
          evidenceStatus: "established",
          textualBasis: "explicit",
          reviewState: "draft",
        },
      ],
      open_questions: [],
      editorial_observations: [],
      bundleDigest: `sha256:${"b".repeat(64)}`,
      jobId: "job:synthetic-004",
      draft_revision: 1,
    };
    const parsed = validateDraftPackage(pkg, ["entity:artaxerxes-i"]);
    expect(parsed.records).toHaveLength(2);
  });
});

describe("draft packages — invalid fixtures fail for the expected reason", () => {
  it("rejects unknown record kinds", () => {
    const pkg = {
      ...validEntityPackage,
      records: [
        {
          record_key: "weird-001",
          record_kind: "entity_gossip",
          entity_key: "entity:nehemiah-governor",
        },
      ],
    };
    expectInvalid(pkg, "unknown-field", "entity_gossip");
  });

  it("rejects empty record lists", () => {
    expectInvalid(
      { ...validEntityPackage, records: [] },
      "invalid-format",
      "at least 1",
    );
  });

  it("rejects kinds the package kind does not allow", () => {
    const pkg = {
      ...validContextPackage,
      package_kind: "canonical-attestation-draft",
    };
    expectInvalid(
      pkg,
      "invalid-format",
      "not allowed in canonical-attestation-draft",
    );
  });

  it("rejects duplicate record keys", () => {
    const records = [
      (validEntityPackage.records as unknown[])[0],
      (validEntityPackage.records as unknown[])[0],
    ];
    expectInvalid(
      { ...validEntityPackage, records },
      "duplicate-key",
      "entity-nehemiah",
    );
  });

  it("rejects dangling claim keys (the 20F pilot pattern)", () => {
    // Keep the context record, drop the claim definitions it cites.
    const pkg = {
      ...validContextPackage,
      records: (validContextPackage.records as unknown[]).slice(0, 1),
    };
    expectInvalid(pkg, "dangling-reference", "claim:nehemiah-was-cupbearer");
  });

  it("rejects dangling open-question keys", () => {
    const pkg = { ...validContextPackage, open_questions: [] };
    expectInvalid(pkg, "dangling-reference", "question-when-001");
  });

  it("rejects null sections without a question", () => {
    const records = JSON.parse(
      JSON.stringify(validContextPackage.records),
    ) as unknown[];
    const context = records[0] as Record<string, Record<string, unknown>>;
    context.when = { text: null, claim_keys: [] };
    expectInvalid(
      { ...validContextPackage, records },
      "invalid-format",
      "open_question_key",
    );
  });

  it("rejects unresolved entities", () => {
    const pkg = {
      ...validEntityPackage,
      records: (validEntityPackage.records as unknown[]).slice(1),
    };
    expectInvalid(pkg, "dangling-reference", "entity:nehemiah-governor");
  });

  it("rejects malformed key grammars", () => {
    const records = JSON.parse(
      JSON.stringify(validEntityPackage.records),
    ) as Record<string, unknown>[];
    (records[1] as Record<string, unknown>).entity_key = "Nehemiah Governor";
    expectInvalid(
      { ...validEntityPackage, records },
      "invalid-format",
      "entity_key",
    );
  });

  it("rejects self-relationships and bad geometry", () => {
    const rel = {
      record_key: "relationship-001",
      record_kind: "entity_relationship",
      subject_entity_key: "entity:nehemiah-governor",
      predicate_key: "relationship:served_as",
      object_entity_key: "entity:nehemiah-governor",
      claim_keys: [],
    };
    const base = {
      schema_version: "1.0.0",
      package_kind: "entity-relationship-draft",
      open_questions: [],
      editorial_observations: [],
      bundleDigest: `sha256:${"c".repeat(64)}`,
      jobId: "job:synthetic-005",
      draft_revision: 1,
    };
    expectInvalid({ ...base, records: [rel] }, "invalid-format", "must differ");
    const place = {
      record_key: "place-nowhere",
      record_kind: "place",
      entity_key: "entity:nowhere",
      geometry: {
        type: "Point",
        coordinates: [999, 999],
        crs: "EPSG:4326",
        precision: "exact_site",
      },
    };
    expectInvalid(
      {
        schema_version: "1.0.0",
        package_kind: "event-place-draft",
        records: [place],
        open_questions: [],
        editorial_observations: [],
        bundleDigest: `sha256:${"c".repeat(64)}`,
        jobId: "job:synthetic-006",
        draft_revision: 1,
      },
      "invalid-format",
      "less than or equal to 180",
    );
  });

  it("rejects unknown fields instead of dropping them", () => {
    const records = JSON.parse(
      JSON.stringify(validEntityPackage.records),
    ) as Record<string, unknown>[];
    (records[0] as Record<string, unknown>).model_identity = "sneaky-model";
    expectInvalid(
      { ...validEntityPackage, records },
      "unknown-field",
      "model_identity",
    );
  });
});

describe("draft packages — coverage compat with golden fixtures", () => {
  function coverageRecord(
    status: unknown,
    extra: Record<string, unknown> = {},
  ) {
    return {
      record_key: "coverage-001",
      record_kind: "coverage_result",
      reference_system_key: "refsys:eng-v22",
      scope_key: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      annotation_class: "canonical_entity_attestation",
      result: status,
      ...extra,
    };
  }

  it("accepts every golden coverage status", () => {
    for (const status of [
      golden.coverage.validCompleteZero.status,
      golden.coverage.validCompleteWithRecords.status,
      golden.coverage.validIncomplete.status,
      golden.coverage.validBlocked.status,
      golden.coverage.validNotApplicable.status,
    ]) {
      expect(() =>
        coverageResultSchema.parse(coverageRecord(status)),
      ).not.toThrow();
    }
  });

  it("rejects the golden invalid coverage shape", () => {
    expect(() =>
      coverageResultSchema.parse(
        coverageRecord(golden.coverage.invalid.status, {
          record_keys: undefined,
          count: golden.coverage.invalid.count,
        }),
      ),
    ).toThrow();
  });
});

describe("checkDraftReferences unit behavior", () => {
  it("reports every dangling reference in one error", () => {
    const parsed = {
      ...validContextPackage,
      records: (validContextPackage.records as unknown[]).slice(0, 1),
      open_questions: [],
    };
    try {
      checkDraftReferences(
        parsed as Parameters<typeof checkDraftReferences>[0],
        [],
      );
    } catch (error) {
      const message = (error as ValidationError).message;
      expect(message).toContain("claim:nehemiah-was-cupbearer");
      expect(message).toContain("claim:susa-location");
      expect(message).toContain("question-when-001");
      return;
    }
    throw new Error("expected dangling references");
  });
});
