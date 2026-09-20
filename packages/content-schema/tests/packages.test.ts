import {
  validateCanonicalPackage,
  validateEditionPackage,
  validateLocalePackage,
  ValidationError,
} from "../src/validators";
import type { PackageJobContext } from "../src/packages";
import {
  validCanonicalPackage,
  validEditionPackage,
  validLocalePackage,
  canonicalFixtureCtx,
  editionFixtureCtx,
  localeFixtureCtx,
} from "./fixtures/packageV2Fixtures";

function expectInvalid(
  run: () => unknown,
  code: string,
  snippet: string,
): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe(code);
    expect((error as ValidationError).message).toContain(snippet);
    return;
  }
  throw new Error("expected validation to throw");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("layered packages — positive fixtures mirror the examples", () => {
  it("accepts a coherent canonical package", () => {
    const pkg = validateCanonicalPackage(
      validCanonicalPackage,
      canonicalFixtureCtx,
    );
    expect(pkg.records.claims).toHaveLength(1);
  });

  it("accepts a coherent edition package linked to approved attestations", () => {
    const pkg = validateEditionPackage(validEditionPackage, editionFixtureCtx);
    expect(pkg.records.mentions).toHaveLength(1);
  });

  it("accepts a coherent locale package with blocking questions", () => {
    const pkg = validateLocalePackage(validLocalePackage, localeFixtureCtx);
    expect(pkg.records.passage_contexts).toHaveLength(1);
  });
});

describe("layered packages — envelope and draft rules", () => {
  it("rejects wrong-layer fields in records", () => {
    const pkg = clone(validCanonicalPackage) as Record<string, unknown>;
    (pkg.records as Record<string, unknown>).mentions = [];
    expectInvalid(
      () => validateCanonicalPackage(pkg, canonicalFixtureCtx),
      "unknown-field",
      "mentions",
    );
  });

  it("forces review_status draft on package and records", () => {
    const approved = clone(validCanonicalPackage) as Record<string, unknown>;
    approved.review_status = "approved";
    expectInvalid(
      () => validateCanonicalPackage(approved, canonicalFixtureCtx),
      "invalid-format",
      "draft",
    );
    const rec = clone(validCanonicalPackage) as unknown as {
      records: { claims: Record<string, unknown>[] };
    };
    rec.records.claims[0]!.review_status = "in_review";
    expectInvalid(
      () => validateCanonicalPackage(rec, canonicalFixtureCtx),
      "invalid-format",
      "draft",
    );
  });

  it("forces candidates unresolved", () => {
    const pkg = clone(validCanonicalPackage) as unknown as {
      records: { entity_candidates: Record<string, unknown>[] };
    };
    pkg.records.entity_candidates[0]!.resolution_status = "resolved_existing";
    expectInvalid(
      () => validateCanonicalPackage(pkg, canonicalFixtureCtx),
      "invalid-format",
      "unresolved",
    );
  });

  it("rejects version drift", () => {
    const pkg = clone(validCanonicalPackage) as Record<string, unknown>;
    pkg.schema_version = "1.0.0";
    expectInvalid(
      () => validateCanonicalPackage(pkg, canonicalFixtureCtx),
      "invalid-format",
      "2.0.0",
    );
  });
});

describe("layered packages — claims, citations, labels", () => {
  it("rejects claims without citations", () => {
    const pkg = clone(validCanonicalPackage) as unknown as {
      records: { claims: Record<string, unknown>[] };
    };
    pkg.records.claims[0]!.citation_keys = [];
    expectInvalid(
      () => validateCanonicalPackage(pkg, canonicalFixtureCtx),
      "invalid-format",
      "at least 1",
    );
  });

  it("rejects untyped claim objects", () => {
    const pkg = clone(validCanonicalPackage) as unknown as {
      records: { claims: Record<string, unknown>[] };
    };
    pkg.records.claims[0]!.object = { anything: "goes" };
    expectInvalid(
      () => validateCanonicalPackage(pkg, canonicalFixtureCtx),
      "invalid-format",
      "discriminator",
    );
  });

  it("rejects citations to evidence the job never supplied", () => {
    const ctx: PackageJobContext = {
      ...canonicalFixtureCtx,
      evidenceItemKeys: [],
    };
    expectInvalid(
      () => validateCanonicalPackage(validCanonicalPackage, ctx),
      "dangling-reference",
      "evidence:fixture-source:item-001",
    );
  });

  it("rejects citations carrying URLs, paths, or digests", () => {
    const pkg = clone(validCanonicalPackage) as unknown as {
      records: { citations: Record<string, unknown>[] };
    };
    (pkg.records.citations[0] as Record<string, unknown>).source_url =
      "https://example.invalid/evidence";
    expectInvalid(
      () => validateCanonicalPackage(pkg, canonicalFixtureCtx),
      "unknown-field",
      "source_url",
    );
  });

  it("never resolves entities through proposed labels", () => {
    // The candidate's label text equals an entity key, yet nothing may
    // resolve through it: no approved snapshot, no reconciliation record.
    const pkg = clone(validCanonicalPackage) as unknown as {
      records: { entity_candidates: Record<string, unknown>[] };
    };
    (
      pkg.records.entity_candidates[0] as Record<string, unknown>
    ).proposed_label = "entity:fixture-person";
    const ctx: PackageJobContext = {
      ...canonicalFixtureCtx,
      approvedEntityKeys: [],
    };
    expectInvalid(
      () => validateCanonicalPackage(pkg, ctx),
      "dangling-reference",
      "entity:fixture-person",
    );
  });

  it("promotes candidates only through trusted reconciliation records", () => {
    const pkg = clone(validCanonicalPackage) as Record<string, unknown>;
    (pkg.records as Record<string, unknown[]>).reconciliation_records = [
      {
        candidate_key: "candidate:fixture-canonical-001:entity-001",
        canonical_entity_key: "entity:fixture-person",
        resolution_status: "created_new_canonical",
        review_status: "draft",
      },
    ];
    const ctx: PackageJobContext = {
      ...canonicalFixtureCtx,
      approvedEntityKeys: ["entity:fixture-role", "entity:fixture-place"],
    };
    const parsed = validateCanonicalPackage(pkg, ctx);
    expect(parsed.records.reconciliation_records).toHaveLength(1);
  });

  it("rejects reconciliation for unknown candidates", () => {
    const pkg = clone(validCanonicalPackage) as Record<string, unknown>;
    (pkg.records as Record<string, unknown[]>).reconciliation_records = [
      {
        candidate_key: "candidate:fixture-canonical-001:entity-999",
        resolution_status: "unresolved",
        review_status: "draft",
      },
    ];
    expectInvalid(
      () => validateCanonicalPackage(pkg, canonicalFixtureCtx),
      "invalid-state",
      "entity-999",
    );
  });
});

describe("layered packages — cross-record battery", () => {
  it("rejects null sections without a question", () => {
    const pkg = clone(validLocalePackage) as unknown as {
      records: { passage_contexts: Record<string, Record<string, unknown>>[] };
    };
    const orientation = pkg.records.passage_contexts[0]![
      "orientation"
    ] as Record<string, Record<string, unknown>>;
    orientation.where = { text: null, claim_keys: [], open_question_key: null };
    expectInvalid(
      () => validateLocalePackage(pkg, localeFixtureCtx),
      "invalid-format",
      "open_question_key",
    );
  });

  it("rejects dangling claims, questions, and entities with pointers", () => {
    const pkg = clone(validLocalePackage) as unknown as {
      records: { passage_contexts: Record<string, unknown>[] };
    };
    const context = pkg.records.passage_contexts[0] as Record<
      string,
      Record<string, unknown>
    >;
    (context.orientation as Record<string, Record<string, unknown>>).who = {
      text: "Someone",
      claim_keys: ["claim:missing"],
      open_question_key: "question:missing",
    };
    expectInvalid(
      () => validateLocalePackage(pkg, localeFixtureCtx),
      "dangling-reference",
      "claim:missing",
    );
  });

  it("rejects duplicate keys", () => {
    const pkg = clone(validEditionPackage) as unknown as {
      records: { mentions: unknown[] };
    };
    pkg.records.mentions = [pkg.records.mentions[0], pkg.records.mentions[0]];
    expectInvalid(
      () => validateEditionPackage(pkg, editionFixtureCtx),
      "duplicate-key",
      "mention:fixture-edition:neh-2-1-person",
    );
  });

  it("rejects the legacy pilot dangling pattern (20F claims/questions)", () => {
    // Mirrors content/pilot/drafts/20F: context cites claims with no claim
    // records and questions with no definitions — rejected by name.
    const pkg = clone(validLocalePackage) as unknown as {
      records: { passage_contexts: Record<string, unknown>[] };
      open_questions: unknown[];
    };
    const context = pkg.records.passage_contexts[0] as Record<
      string,
      Record<string, unknown>
    >;
    (context.orientation as Record<string, Record<string, unknown>>).who = {
      text: "Nehemiah asks king to rebuild Jerusalem",
      claim_keys: ["claim:nehemiah-was-cupbearer"],
      open_question_key: null,
    };
    (context.orientation as Record<string, Record<string, unknown>>).when = {
      text: null,
      claim_keys: [],
      open_question_key: "question:legacy-when-001",
    };
    pkg.open_questions = [];
    expectInvalid(
      () => validateLocalePackage(pkg, localeFixtureCtx),
      "dangling-reference",
      "claim:nehemiah-was-cupbearer",
    );
  });
});

describe("layered packages — coverage battery", () => {
  function canonicalCoverage(overrides: Record<string, unknown>) {
    const pkg = clone(validCanonicalPackage) as unknown as {
      coverage: Record<string, unknown>[];
    };
    pkg.coverage = [
      {
        annotation_class: "canonical_entity_attestation",
        groups: [overrides],
      },
    ];
    return pkg;
  }

  it("rejects gaps against the authoritative reference set", () => {
    const pkg = canonicalCoverage({
      result: "complete_with_records",
      reference_keys: ["verse:Neh.2.1"],
      record_keys: ["attestation:fixture-neh-2-1-person"],
      blocker_question_keys: [],
    });
    expectInvalid(
      () => validateCanonicalPackage(pkg, canonicalFixtureCtx),
      "invalid-state",
      "verse:Neh.2.2",
    );
  });

  it("rejects overlapping and duplicate references", () => {
    const pkg = clone(validCanonicalPackage) as unknown as {
      coverage: { groups: Record<string, unknown>[] }[];
    };
    pkg.coverage[0]!.groups.push({
      result: "complete_zero",
      reference_keys: ["verse:Neh.2.1"],
      record_keys: [],
      blocker_question_keys: [],
    });
    expectInvalid(
      () => validateCanonicalPackage(pkg, canonicalFixtureCtx),
      "invalid-state",
      "overlapping",
    );
  });

  it("rejects contradictory complete_zero and missing records", () => {
    const withRecords = canonicalCoverage({
      result: "complete_zero",
      reference_keys: ["verse:Neh.2.1", "verse:Neh.2.2"],
      record_keys: ["attestation:fixture-neh-2-1-person"],
      blocker_question_keys: [],
    });
    expectInvalid(
      () => validateCanonicalPackage(withRecords, canonicalFixtureCtx),
      "invalid-state",
      "contradictory complete_zero",
    );
    const missing = canonicalCoverage({
      result: "complete_with_records",
      reference_keys: ["verse:Neh.2.1", "verse:Neh.2.2"],
      record_keys: ["attestation:fixture-nope"],
      blocker_question_keys: [],
    });
    expectInvalid(
      () => validateCanonicalPackage(missing, canonicalFixtureCtx),
      "dangling-reference",
      "attestation:fixture-nope",
    );
  });

  it("rejects blocked results without defined questions", () => {
    const pkg = clone(validLocalePackage) as unknown as {
      coverage: { groups: Record<string, unknown>[] }[];
    };
    pkg.coverage[0]!.groups[0]!["blocker_question_keys"] = [];
    expectInvalid(
      () => validateLocalePackage(pkg, localeFixtureCtx),
      "invalid-state",
      "without blocker questions",
    );
    const dangling = clone(validLocalePackage) as unknown as {
      coverage: { groups: Record<string, unknown>[] }[];
    };
    dangling.coverage[0]!.groups[0]!["blocker_question_keys"] = [
      "question:ghost",
    ];
    expectInvalid(
      () => validateLocalePackage(dangling, localeFixtureCtx),
      "dangling-reference",
      "question:ghost",
    );
  });

  it("rejects wrong annotation classes per layer", () => {
    const pkg = clone(validCanonicalPackage) as unknown as {
      coverage: Record<string, unknown>[];
    };
    (pkg.coverage[0] as Record<string, unknown>).annotation_class =
      "translation_mention";
    expectInvalid(
      () => validateCanonicalPackage(pkg, canonicalFixtureCtx),
      "invalid-state",
      "translation_mention",
    );
  });
});

describe("layered packages — snapshot battery (no hard-coded registries)", () => {
  it("rejects unknown languages, canons, systems, and editions", () => {
    const edition = clone(validEditionPackage) as unknown as {
      scope: Record<string, unknown>;
    };
    edition.scope.language_tag = "xx";
    expectInvalid(
      () => validateEditionPackage(edition, editionFixtureCtx),
      "invalid-state",
      "language_tag",
    );
    const canon = clone(validCanonicalPackage) as unknown as {
      scope: Record<string, unknown>;
    };
    canon.scope.reference_system_key = "refsys:unknown-v9";
    expectInvalid(
      () => validateCanonicalPackage(canon, canonicalFixtureCtx),
      "invalid-state",
      "reference_system_key",
    );
    const locale = clone(validLocalePackage);
    const badEdition = {
      ...locale,
      scope: {
        ...(locale.scope as Record<string, unknown>),
        translation_edition_key: "x",
      },
    };
    expectInvalid(
      () => validateLocalePackage(badEdition, localeFixtureCtx),
      "invalid-format",
      "translation_edition_key",
    );
  });

  it("rejects edition mentions whose attestation is not approved", () => {
    const ctx: PackageJobContext = {
      ...editionFixtureCtx,
      approvedAttestationKeys: [],
    };
    expectInvalid(
      () => validateEditionPackage(validEditionPackage, ctx),
      "dangling-reference",
      "attestation:fixture-neh-2-1-person",
    );
  });

  it("rejects locale relevance never approved", () => {
    const ctx: PackageJobContext = {
      ...localeFixtureCtx,
      approvedRelevanceKeys: [],
    };
    expectInvalid(
      () => validateLocalePackage(validLocalePackage, ctx),
      "dangling-reference",
      "relevance:fixture-scope-person",
    );
  });
});
