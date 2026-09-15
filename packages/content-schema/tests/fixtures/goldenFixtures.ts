// Synthetic golden fixtures for ADR-003 adoption gates — Task 05
// All data is synthetic, not production, and not to be published.
// Language: English (en), Telugu (te), Tamil (ta) — synthetic names only.

export const fixtures = {
  // 1. One entity shared across English, Telugu, Tamil names/descriptions
  entityMultilingual: {
    valid: {
      key: "entity:artaxerxes-i",
      slug: "artaxerxes-i",
      type: "person" as const,
      identificationStatus: "established" as const,
      provenance: "synthetic",
    },
    validNames: [
      {
        entityKey: "entity:artaxerxes-i",
        languageTag: "en" as const,
        form: "Artaxerxes I",
        normalizedForm: "artaxerxes i",
        kind: "preferred" as const,
      },
      {
        entityKey: "entity:artaxerxes-i",
        languageTag: "te" as const,
        form: "అర్తహషస్త I",
        normalizedForm: "అర్తహషస్త i",
        kind: "preferred" as const,
      },
      {
        entityKey: "entity:artaxerxes-i",
        languageTag: "ta" as const,
        form: "அர்தசஷ்டா I",
        normalizedForm: "அர்தசஷ்டா i",
        kind: "preferred" as const,
      },
    ],
    invalid: {
      // Invalid: slug with uppercase and space (should be lowercase hyphen)
      key: "entity:Artaxerxes I",
      slug: "Artaxerxes I",
      type: "person" as const,
      identificationStatus: "established" as const,
      provenance: "synthetic",
    },
  },

  // 2. Relevant-but-not-mentioned entity (relevance without attestation)
  relevantNotMentioned: {
    valid: {
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      entityKey: "entity:jerusalem",
      roleInPassage: "city being rebuilt",
      importance: "central" as const,
      isAttested: false,
    },
    invalid: {
      // Invalid: isAttested true but no attestation exists (dangling)
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      entityKey: "entity:nonexistent",
      roleInPassage: "ghost",
      importance: "central" as const,
      isAttested: true,
    },
  },

  // 3. Attestations: named, pronoun, indirect, collective, repeated, genealogy
  attestations: {
    validNamed: {
      entityKey: "entity:nehemiah-governor",
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      referenceSystem: "refsys:eng-v22" as const,
      localKey: "Neh.2.4",
      kind: "primary_subject" as const,
      explicitness: "explicit" as const,
      claimKey: "claim:nehemiah-was-cupbearer",
      reviewState: "draft" as const,
    },
    validPronoun: {
      entityKey: "entity:artaxerxes-i",
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      referenceSystem: "refsys:eng-v22" as const,
      localKey: "Neh.2.4",
      kind: "implied_referent" as const,
      explicitness: "strongly_implied" as const,
      claimKey: "claim:artaxerxes-asked-nehemiah",
      reviewState: "draft" as const,
    },
    invalid: {
      // Invalid: unknown kind
      entityKey: "entity:nehemiah-governor",
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      referenceSystem: "refsys:eng-v22" as const,
      localKey: "Neh.2.4",
      kind: "bad_kind" as unknown as "primary_subject",
      explicitness: "explicit" as const,
      claimKey: "claim:bad",
      reviewState: "draft" as const,
    },
  },

  // 4. Split/merged/reordered/omitted reference mapping
  referenceMappings: {
    validSplit: {
      from: "refsys:eng-v22:Neh.2.4",
      to: "refsys:tel-v1:Neh.2.4a",
      kind: "split" as const,
      fromRefsys: "refsys:eng-v22" as const,
      toRefsys: "refsys:tel-v1" as const,
    },
    validMerge: {
      from: "refsys:eng-v22:Neh.2.3",
      to: "refsys:tam-v1:Neh.2.3",
      kind: "merge" as const,
      fromRefsys: "refsys:eng-v22" as const,
      toRefsys: "refsys:tam-v1" as const,
    },
    validOmitted: {
      from: "refsys:eng-v22:Neh.2.5",
      to: "refsys:tel-v1:Neh.2.5",
      kind: "omitted" as const,
      fromRefsys: "refsys:eng-v22" as const,
      toRefsys: "refsys:tel-v1" as const,
    },
    invalid: {
      from: "refsys:eng-v22:Neh.2.4",
      to: "refsys:tel-v1:Neh.2.4",
      kind: "invalid_kind" as unknown as "split",
      fromRefsys: "refsys:eng-v22" as const,
      toRefsys: "refsys:tel-v1" as const,
    },
  },

  // 5. Corrected immutable edition preserving old selectors/spans
  correctedEdition: {
    valid: {
      oldEdition: {
        key: "edition:bsb@20260912:sha-b2898c49",
        work: "trans:bsb" as const,
        languageTag: "en" as const,
        referenceSystem: "refsys:eng-v22" as const,
        revisionDate: "2026-09-12",
        sourceArtifactSha256: "sha256:" + "a".repeat(64),
        attribution: "BSB",
        status: "published" as const,
      },
      newEdition: {
        key: "edition:bsb@20260913:sha-9f8e7d6c",
        work: "trans:bsb" as const,
        languageTag: "en" as const,
        referenceSystem: "refsys:eng-v22" as const,
        revisionDate: "2026-09-13",
        sourceArtifactSha256: "sha256:" + "b".repeat(64),
        attribution: "BSB",
        status: "draft" as const,
      },
      preservedSpan: {
        editionKey: "edition:bsb@20260912:sha-b2898c49",
        verseId: "00000000-0000-0000-0000-000000000001",
        entityKey: "entity:artaxerxes-i",
        form: "explicit_name" as const,
        quote: "Artaxerxes",
        occurrenceOrdinal: 1,
        pipelineTextSha256: "sha256:" + "c".repeat(64),
        reviewState: "approved" as const,
      },
    },
    invalid: {
      // Invalid: bad key format
      key: "bad-key",
      work: "trans:bsb" as const,
      languageTag: "en" as const,
      referenceSystem: "refsys:eng-v22" as const,
      revisionDate: "2026-09-12",
      sourceArtifactSha256: "sha256:" + "a".repeat(64),
      attribution: "BSB",
      status: "published" as const,
    },
  },

  // 6. Competing identity and chronology positions
  competingPositions: {
    valid: {
      claim1: {
        key: "claim:artaxerxes-chronology-a",
        subjectType: "entity" as const,
        subjectId: "entity:artaxerxes-i",
        predicate: "ruled",
        object: { from: "-465", to: "-424", precision: "exact" as const },
        evidenceStatus: "probable" as const,
        textualBasis: "explicit" as const,
        reviewState: "approved" as const,
      },
      claim2: {
        key: "claim:artaxerxes-chronology-b",
        subjectType: "entity" as const,
        subjectId: "entity:artaxerxes-i",
        predicate: "ruled",
        object: { from: "-470", to: "-430", precision: "range" as const },
        evidenceStatus: "possible" as const,
        textualBasis: "inferred" as const,
        reviewState: "approved" as const,
      },
    },
    invalid: {
      // Invalid: missing predicate
      key: "claim:bad",
      subjectType: "entity" as const,
      subjectId: "entity:artaxerxes-i",
      predicate: "" as unknown as "ruled",
      object: {},
      evidenceStatus: "established" as const,
      textualBasis: "explicit" as const,
      reviewState: "draft" as const,
    },
  },

  // 7. Cross-chapter, overlapping, alternate, non-contiguous scope segmentation
  scopeSegmentation: {
    validCrossChapter: {
      key: "scope:neh-2-3:refsys:eng-v22:Neh.2.10-Neh.3.5",
      referenceSystemId: "refsys:eng-v22",
      kind: "pericope" as const,
      startUnit: "Neh.2.10",
      endUnit: "Neh.3.5",
    },
    validNonContiguous: {
      key: "scope:neh-2-alt:refsys:eng-v22:Neh.2.1,Neh.2.4",
      kind: "pericope" as const,
      members: ["Neh.2.1", "Neh.2.4"],
    },
    invalid: {
      key: "bad scope",
      referenceSystemId: "refsys:eng-v22",
      kind: "pericope" as const,
      startUnit: "",
      endUnit: "",
    },
  },

  // 8. Event participants, places, multiple Scripture accounts
  events: {
    valid: {
      key: "entity:return-to-jerusalem",
      slug: "return-to-jerusalem",
      type: "event" as const,
      identificationStatus: "established" as const,
      provenance: "synthetic",
      participants: [
        {
          eventId: "entity:return-to-jerusalem",
          entityId: "entity:nehemiah-governor",
          role: "leader",
          claimId: "claim:nehemiah-led-return",
        },
        {
          eventId: "entity:return-to-jerusalem",
          entityId: "entity:artaxerxes-i",
          role: "authorizer",
          claimId: "claim:artaxerxes-authorized",
        },
      ],
      places: [
        {
          eventId: "entity:return-to-jerusalem",
          placeId: "entity:jerusalem",
          role: "destination",
          claimId: "claim:jerusalem-destination",
        },
      ],
      accounts: [
        {
          eventId: "entity:return-to-jerusalem",
          scopeId: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
          relation: "reports" as const,
          claimId: "claim:neh2-reports-return",
        },
        {
          eventId: "entity:return-to-jerusalem",
          scopeId: "scope:ezra-1:refsys:eng-v22:Ezra.1.1",
          relation: "recalls" as const,
          claimId: "claim:ezra-recalls-return",
        },
      ],
    },
    invalid: {
      key: "",
      slug: "Bad Slug!",
      type: "event" as const,
      identificationStatus: "established" as const,
      provenance: "synthetic",
    },
  },

  // 9. Grapheme-safe Telugu/Tamil selectors and UTF-16 projections
  tamilTeluguSelectors: {
    validTelugu: {
      editionKey: "edition:tel_irv@20260913:sha-3857e102",
      verseId: "00000000-0000-0000-0000-000000000002",
      entityKey: "entity:artaxerxes-i",
      form: "explicit_name" as const,
      quote: "అర్తహషస్త",
      occurrenceOrdinal: 1,
      pipelineTextSha256: "sha256:" + "d".repeat(64),
      reviewState: "draft" as const,
      // Grapheme: 7 Telugu characters, UTF-16 length 7 (no surrogates), but Tamil with surrogates would differ
      grapheme: { start: 10, end: 17 },
      utf16: { start: 10, end: 17 },
    },
    validTamil: {
      editionKey: "edition:tam_irv@20260913:sha-08e71ec8",
      verseId: "00000000-0000-0000-0000-000000000003",
      entityKey: "entity:artaxerxes-i",
      form: "explicit_name" as const,
      quote: "அர்தசஷ்டா",
      occurrenceOrdinal: 1,
      pipelineTextSha256: "sha256:" + "e".repeat(64),
      reviewState: "draft" as const,
      grapheme: { start: 5, end: 12 },
      utf16: { start: 5, end: 12 },
    },
    invalid: {
      // Invalid: quote does not match text slice, grapheme out of bounds
      editionKey: "edition:tel_irv@20260913:sha-3857e102",
      verseId: "00000000-0000-0000-0000-000000000002",
      entityKey: "entity:artaxerxes-i",
      form: "explicit_name" as const,
      quote: "Mismatch",
      occurrenceOrdinal: 0, // invalid ordinal
      pipelineTextSha256: "sha256:" + "f".repeat(64),
      reviewState: "draft" as const,
    },
  },

  // 10. Exact source locator plus checksum-bound human approval fixture
  sourceApproval: {
    valid: {
      claimKey: "claim:artaxerxes-was-king",
      sourceReleaseId: "release:source:stepbible:tipnr@abc123:sha-9f3e7d6c",
      locator: "TIPNR:NEH:2:4:person:artaxerxes-i",
      supportKind: "supports" as const,
      digest: "sha256:" + "a".repeat(64),
      approval: {
        subjectKey: "claim:artaxerxes-was-king",
        subjectDigest: "sha256:" + "b".repeat(64),
        reviewerId: "reviewer:human-001",
        decision: "approved" as const,
      },
    },
    invalid: {
      claimKey: "claim:bad",
      sourceReleaseId: "bad-release",
      locator: "",
      supportKind: "supports" as const,
      digest: "not-a-sha",
      approval: {
        subjectKey: "",
        subjectDigest: "bad",
        reviewerId: "",
        decision: "approved" as const,
      },
    },
  },

  // 11. Coverage: complete-zero, complete-with-records, incomplete, blocked, not-applicable
  coverage: {
    validCompleteZero: {
      scope: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      status: "complete_zero" as const,
      count: 0,
    },
    validCompleteWithRecords: {
      scope: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      status: "complete_with_records" as const,
      count: 5,
    },
    validIncomplete: {
      scope: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      status: "incomplete" as const,
      count: 2,
      missing: ["Neh.2.15"],
    },
    validBlocked: {
      scope: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      status: "blocked" as const,
      reason: "rights-unknown",
    },
    validNotApplicable: {
      scope: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      status: "not_applicable" as const,
    },
    invalid: {
      scope: "bad",
      status: "invalid_status" as unknown as "complete_zero",
      count: -1,
    },
  },

  // 12. Rights-unknown failures for every operation
  rightsUnknown: {
    valid: {
      componentKey: "tipnr-structured-fields",
      operation: "publication" as const,
      state: "unknown" as const,
    },
    invalid: {
      componentKey: "",
      operation: "bad_op" as unknown as "publication",
      state: "allowed" as const,
    },
  },

  // 13. Atomic NDJSON failure and release rollback (extra for Task 05)
  atomicNdjson: {
    valid: {
      ndjson:
        '{"key":"entity:artaxerxes-i","slug":"artaxerxes-i","type":"person","identificationStatus":"established","provenance":"synthetic"}\n{"key":"entity:nehemiah-governor","slug":"nehemiah-governor","type":"person","identificationStatus":"established","provenance":"synthetic"}\n',
      expected: { success: 2, failed: 0 },
    },
    invalid: {
      // One valid, one invalid (bad slug) — entire batch must fail atomically
      ndjson:
        '{"key":"entity:artaxerxes-i","slug":"artaxerxes-i","type":"person","identificationStatus":"established","provenance":"synthetic"}\n{"key":"bad","slug":"Bad Slug!","type":"person","identificationStatus":"established","provenance":"synthetic"}\n',
      expected: { success: 0, failed: 2, error: "invalid-slug" },
    },
    rollback: {
      release: "release:source:stepbible:tipnr@abc123:sha-9f3e7d6c",
      previous: "release:source:stepbible:tipnr@def456:sha-12345678",
      reason: "rollback to last healthy release after atomic failure",
    },
  },
};
