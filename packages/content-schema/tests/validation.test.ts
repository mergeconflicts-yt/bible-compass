import {
  validateTranslationEdition,
  validateAttestation,
  validateEditionMention,
  validateRelevance,
  validateOperationGrant,
  checkDuplicateKeys,
  checkDanglingReferences,
} from "../src/validators";

describe("strict validation — positive and malformed fixtures", () => {
  it("accepts valid translation edition", () => {
    expect(
      validateTranslationEdition({
        key: "edition:bsb@20260912:sha-b2898c49",
        work: "trans:bsb",
        languageTag: "en",
        referenceSystem: "refsys:eng-v22",
        revisionDate: "2026-09-12",
        sourceArtifactSha256: "sha256:" + "a".repeat(64),
        attribution: "BSB",
        status: "published",
      }),
    ).toBeTruthy();
  });

  it("rejects unknown field", () => {
    const bad1: unknown = {
      key: "edition:bsb@20260912:sha-b2898c49",
      work: "trans:bsb",
      languageTag: "en",
      referenceSystem: "refsys:eng-v22",
      revisionDate: "2026-09-12",
      sourceArtifactSha256: "sha256:" + "a".repeat(64),
      attribution: "BSB",
      status: "published",
      extra: "nope",
    };
    expect(() => validateTranslationEdition(bad1)).toThrow();
    try {
      const bad2: unknown = { extra: "x" };
      validateTranslationEdition(bad2);
    } catch (e) {
      expect(e).toMatchObject({ code: "unknown-field" });
    }
  });

  it("rejects invalid edition key", () => {
    expect(() =>
      validateTranslationEdition({
        key: "bad-key",
        work: "trans:bsb",
        languageTag: "en",
        referenceSystem: "refsys:eng-v22",
        revisionDate: "2026-09-12",
        sourceArtifactSha256: "sha256:" + "a".repeat(64),
        attribution: "BSB",
        status: "published",
      }),
    ).toThrow();
  });

  it("rejects mismatched languageTag/refsys", () => {
    expect(() =>
      validateTranslationEdition({
        key: "edition:bsb@20260912:sha-b2898c49",
        work: "trans:bsb",
        languageTag: "te",
        referenceSystem: "refsys:eng-v22",
        revisionDate: "2026-09-12",
        sourceArtifactSha256: "sha256:" + "a".repeat(64),
        attribution: "BSB",
        status: "published",
      }),
    ).toThrow();
  });

  it("rejects duplicate keys", () => {
    expect(() =>
      checkDuplicateKeys([{ key: "entity:a" }, { key: "entity:a" }]),
    ).toThrow("Duplicate");
  });

  it("rejects dangling reference", () => {
    expect(() =>
      checkDanglingReferences(
        [{ entityKey: "entity:missing" }],
        [{ key: "entity:exists" }],
      ),
    ).toThrow("unknown entity");
  });

  it("rejects invalid state and rights-unknown", () => {
    expect(() =>
      validateAttestation({
        entityKey: "entity:artaxerxes-i",
        scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
        referenceSystem: "refsys:eng-v22",
        localKey: "Neh.2.4",
        kind: "bad_kind",
        explicitness: "explicit",
        claimKey: "claim:artaxerxes-was-king",
        reviewState: "draft",
      }),
    ).toThrow();

    expect(() =>
      validateOperationGrant({
        componentKey: "x",
        operation: "publication",
        state: "unknown",
      }),
    ).toThrow();
    try {
      const bad: unknown = {
        componentKey: "x",
        operation: "publication",
        state: "unknown",
      };
      validateOperationGrant(bad);
    } catch (e) {
      expect(e).toMatchObject({ code: "rights-unknown" });
    }
  });

  it("rejects edition mention without exactly one target", () => {
    expect(() =>
      validateEditionMention({
        editionKey: "edition:bsb@20260912:sha-b2898c49",
        verseId: "00000000-0000-0000-0000-000000000000",
        // missing both entityKey and contextCardId
        form: "explicit_name",
        quote: "Artaxerxes",
        occurrenceOrdinal: 1,
        pipelineTextSha256: "sha256:" + "a".repeat(64),
        reviewState: "draft",
      }),
    ).toThrow();
  });

  it("accepts valid attestation and relevance distinct", () => {
    expect(
      validateAttestation({
        entityKey: "entity:artaxerxes-i",
        scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
        referenceSystem: "refsys:eng-v22",
        localKey: "Neh.2.4",
        kind: "primary_subject",
        explicitness: "explicit",
        claimKey: "claim:artaxerxes-was-king",
        reviewState: "draft",
      }),
    ).toBeTruthy();
    expect(
      validateRelevance({
        scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
        entityKey: "entity:artaxerxes-i",
        roleInPassage: "king who authorizes return",
        importance: "central",
        isAttested: true,
      }),
    ).toBeTruthy();
  });
});
