import {
  evaluateAuthorization,
  validateSourceRelease,
  validateRightsComponent,
  validateOperationGrant,
  validateApprovalRecord,
  validateSourceArtifact,
  validateComponentLicenseIsolation,
  createAuditReceipt,
  type SourceRelease,
  type RightsComponent,
  type OperationGrant,
  type ApprovalRecord,
} from "../src/registry";

// Synthetic digests — must not be mistaken for production digests.
const SYNTH_SHA = "sha256:" + "a".repeat(64);
const SYNTH_SHA_B = "sha256:" + "b".repeat(64);
const SYNTH_SHA_C = "sha256:" + "c".repeat(64);

function makeRelease(overrides: Partial<SourceRelease> = {}): SourceRelease {
  return {
    releaseKey: "release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c",
    sourceKey: "source:stepbible:tipnr",
    commitOrTag: "abc12345",
    artifactSha256: SYNTH_SHA,
    byteSize: 12345,
    licenseEvidenceSha256: SYNTH_SHA_B,
    requiredAttribution: "STEPBible CC BY 4.0 — synthetic",
    retrievedAt: "2026-09-14T00:00:00.000Z",
    status: "candidate",
    ...overrides,
  };
}

function makeGrant(overrides: Partial<OperationGrant> = {}): OperationGrant {
  return {
    componentKey: "tipnr-structured-fields",
    operation: "evaluation_import",
    state: "allowed",
    provenance: "synthetic-test",
    ...overrides,
  };
}

function makeApproval(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    subjectKey:
      "release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c:tipnr-structured-fields",
    subjectDigest: SYNTH_SHA,
    reviewerId: "synthetic-rights-reviewer-001",
    reviewerRole: "rights_reviewer",
    decision: "approved",
    createdAt: "2026-09-14T00:00:00.000Z",
    synthetic: true,
    ...overrides,
  };
}

describe("Task 07 — source-registry contract (fail-closed)", () => {
  describe("schema validation — digest-bound", () => {
    it("accepts valid synthetic release", () => {
      expect(validateSourceRelease(makeRelease())).toBeTruthy();
    });
    it("rejects release with branch as commit", () => {
      expect(() =>
        validateSourceRelease(makeRelease({ commitOrTag: "main" })),
      ).toThrow();
    });
    it("rejects release with invalid sha", () => {
      expect(() =>
        validateSourceRelease(
          makeRelease({ artifactSha256: "bad" as unknown as string }),
        ),
      ).toThrow();
    });
    it("rejects release where releaseKey does not embed sourceKey", () => {
      expect(() =>
        validateSourceRelease(
          makeRelease({
            releaseKey: "release:source:other:dataset@abc123:sha-9f3e7d6c",
            sourceKey: "source:stepbible:tipnr",
          }),
        ),
      ).toThrow();
    });
    it("accepts valid artifact with quarantine path", () => {
      expect(
        validateSourceArtifact({
          releaseKey: "release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c",
          url: "https://example.com/file.zip",
          mediaType: "application/zip",
          byteSize: 100,
          sha256: SYNTH_SHA,
          quarantinePath: "content/quarantine/stepbible/tipnr/file.zip",
        }),
      ).toBeTruthy();
    });
    it("rejects artifact with path traversal", () => {
      expect(() =>
        validateSourceArtifact({
          releaseKey: "release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c",
          url: "https://example.com/file.zip",
          mediaType: "application/zip",
          byteSize: 100,
          sha256: SYNTH_SHA,
          quarantinePath: "/tmp/file.zip",
        }),
      ).toThrow();
    });
    it("accepts valid component with explicit pathsOrFields", () => {
      expect(
        validateRightsComponent({
          componentKey: "tipnr-structured-fields",
          releaseKey: "release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c",
          pathsOrFields: ["tipnr/person.csv", "tipnr/place.csv"],
          licenseSpdx: "CC-BY-4.0",
          licenseEvidenceSha256: SYNTH_SHA_B,
        }),
      ).toBeTruthy();
    });
    it("rejects component with empty pathsOrFields (cannot infer license scope)", () => {
      expect(() =>
        validateRightsComponent({
          componentKey: "x",
          releaseKey: "release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c",
          pathsOrFields: [],
          licenseSpdx: "CC-BY-4.0",
          licenseEvidenceSha256: SYNTH_SHA_B,
        }),
      ).toThrow();
    });
    it("rejects operation grant with unknown (fail-closed)", () => {
      expect(() =>
        validateOperationGrant({
          componentKey: "tipnr-structured-fields",
          operation: "publication",
          state: "unknown",
          provenance: "synthetic",
        }),
      ).toThrow();
      try {
        validateOperationGrant({
          componentKey: "x",
          operation: "publication",
          state: "unknown",
          provenance: "synthetic",
        } as unknown as OperationGrant);
      } catch (e) {
        const err = e as Error & { code?: string };
        expect(err.code ?? err.message).toMatch(/rights-unknown|unknown state/);
      }
    });
    it("fixture approvals are clearly synthetic", () => {
      const a = makeApproval();
      expect(validateApprovalRecord(a)).toBeTruthy();
      expect(a.synthetic).toBe(true);
      expect(a.reviewerId).toContain("synthetic");
      expect(a.subjectDigest).toMatch(/^sha256:/);
    });
  });

  describe("component license isolation", () => {
    it("allows single component per release", () => {
      const comps: RightsComponent[] = [
        {
          componentKey: "tipnr-structured-fields",
          releaseKey: "release:source:stepbible:tipnr@abc123:sha-aaaa1111",
          pathsOrFields: ["tipnr/person.csv"],
          licenseSpdx: "CC-BY-4.0",
          licenseEvidenceSha256: SYNTH_SHA,
        },
      ];
      expect(() => validateComponentLicenseIsolation(comps)).not.toThrow();
    });
    it("rejects one top-level license governing mixed components", () => {
      const releaseKey = "release:source:stepbible:tipnr@abc123:sha-aaaa1111";
      const comps: RightsComponent[] = [
        {
          componentKey: "tipnr-structured-fields",
          releaseKey,
          pathsOrFields: ["tipnr/person.csv"],
          licenseSpdx: "CC-BY-4.0",
          licenseEvidenceSha256: SYNTH_SHA,
        },
        {
          componentKey: "tipnr-ai-descriptions",
          releaseKey,
          pathsOrFields: ["tipnr/descriptions.json"],
          licenseSpdx: "CC-BY-4.0",
          licenseEvidenceSha256: SYNTH_SHA, // same evidence, different paths => violation
        },
      ];
      expect(() => validateComponentLicenseIsolation(comps)).toThrow(
        /One top-level license/,
      );
    });
  });

  describe("evaluateAuthorization — fail-closed", () => {
    const release = makeRelease();
    const grant = makeGrant();
    const approval = makeApproval();

    it("allows exact match with valid approval", () => {
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: grant.componentKey,
          operation: "evaluation_import",
        },
        [grant],
        [approval],
        release,
      );
      expect(result.allowed).toBe(true);
      expect(result.grant).toBeTruthy();
      expect(result.approval).toBeTruthy();
    });

    it("denies when no grant for component/operation", () => {
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: "missing",
          operation: "evaluation_import",
        },
        [grant],
        [approval],
        release,
      );
      expect(result.allowed).toBe(false);
      expect(result.deniedCode).toBe("no-grant");
    });

    it("denies when grant state is denied", () => {
      const deniedGrant = makeGrant({ state: "denied" });
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: deniedGrant.componentKey,
          operation: "evaluation_import",
        },
        [deniedGrant],
        [approval],
        release,
      );
      expect(result.allowed).toBe(false);
      expect(result.deniedCode).toBe("grant-denied");
    });

    it("denies when grant state is unknown (fail-closed)", () => {
      // Bypass schema validation to test evaluator directly with unknown
      const unknownGrant = { ...grant, state: "unknown" as const };
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: unknownGrant.componentKey,
          operation: "evaluation_import",
        },
        [unknownGrant],
        [approval],
        release,
      );
      expect(result.allowed).toBe(false);
    });

    it("denies expired grant", () => {
      const expired = makeGrant({ effectiveTo: "2025-01-01" });
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: expired.componentKey,
          operation: "evaluation_import",
          evaluationDate: "2026-09-14",
        },
        [expired],
        [approval],
        release,
      );
      expect(result.allowed).toBe(false);
      expect(result.deniedCode).toBe("grant-expired");
    });

    it("denies not-yet-effective grant", () => {
      const future = makeGrant({ effectiveFrom: "2027-01-01" });
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: future.componentKey,
          operation: "evaluation_import",
          evaluationDate: "2026-09-14",
        },
        [future],
        [approval],
        release,
      );
      expect(result.allowed).toBe(false);
      expect(result.deniedCode).toBe("grant-expired");
    });

    it("denies territory mismatch", () => {
      const territorial = makeGrant({ territory: "US" });
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: territorial.componentKey,
          operation: "evaluation_import",
          territory: "IN",
        },
        [territorial],
        [approval],
        release,
      );
      expect(result.allowed).toBe(false);
      expect(result.deniedCode).toBe("territory-mismatch");
    });

    it("denies language mismatch", () => {
      const langGrant = makeGrant({ languageTag: "en" });
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: langGrant.componentKey,
          operation: "evaluation_import",
          languageTag: "te",
        },
        [langGrant],
        [approval],
        release,
      );
      expect(result.allowed).toBe(false);
      expect(result.deniedCode).toBe("language-mismatch");
    });

    it("denies when no approval for release:component", () => {
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: grant.componentKey,
          operation: "evaluation_import",
        },
        [grant],
        [],
        release,
      );
      expect(result.allowed).toBe(false);
      expect(result.deniedCode).toBe("no-approval");
    });

    it("denies when approval digest not bound", () => {
      const badApproval = makeApproval({
        subjectDigest: "bad" as unknown as string,
      });
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: grant.componentKey,
          operation: "evaluation_import",
        },
        [grant],
        [badApproval],
        release,
      );
      expect(result.allowed).toBe(false);
    });

    it("denies when release key mismatches requested", () => {
      const result = evaluateAuthorization(
        {
          releaseKey: "release:source:stepbible:tipnr@other:sha-aaaaaaaa",
          componentKey: grant.componentKey,
          operation: "evaluation_import",
        },
        [grant],
        [approval],
        release,
      );
      expect(result.allowed).toBe(false);
      expect(result.deniedCode).toBe("release-key-mismatch");
    });

    it("denies revoked approval (latest decision rejected supersedes prior approved)", () => {
      const revokedApprovals: ApprovalRecord[] = [
        approval,
        makeApproval({
          decision: "rejected",
          createdAt: "2026-09-15T00:00:00.000Z",
          subjectDigest: SYNTH_SHA_C,
        }),
      ];
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: grant.componentKey,
          operation: "evaluation_import",
        },
        [grant],
        revokedApprovals,
        release,
      );
      expect(result.allowed).toBe(false);
      expect(result.deniedCode).toBe("no-approval");
    });

    it("denies external_ai_processing unless explicitly allowed", () => {
      const aiDenied = makeGrant({
        operation: "external_ai_processing",
        state: "denied",
      });
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: aiDenied.componentKey,
          operation: "external_ai_processing",
        },
        [aiDenied],
        [approval],
        release,
      );
      expect(result.allowed).toBe(false);
    });

    it("markdown status cannot authorize — unknown must not default to allowed", () => {
      // Simulate catalog says candidate_only but no grant exists — evaluator must deny
      const result = evaluateAuthorization(
        {
          releaseKey: release.releaseKey,
          componentKey: "unregistered-component",
          operation: "publication",
        },
        [],
        [],
        release,
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/no grant/);
    });
  });

  describe("audit receipt", () => {
    it("creates deterministic audit receipt bound to digests", () => {
      const release = makeRelease();
      const grant = makeGrant();
      const approval = makeApproval();
      const request = {
        releaseKey: release.releaseKey,
        componentKey: grant.componentKey,
        operation: "evaluation_import" as const,
      };
      const result = evaluateAuthorization(
        request,
        [grant],
        [approval],
        release,
      );
      const receipt = createAuditReceipt(
        "task:registry-contract:07:attempt-1",
        request,
        result,
        release,
        [grant],
        [approval],
      );
      expect(receipt.attemptId).toBe("task:registry-contract:07:attempt-1");
      expect(receipt.requestDigest).toMatch(/^sha256:/);
      expect(receipt.releaseDigest).toBe(release.artifactSha256);
      expect(receipt.decision).toBe("allowed");
      expect(receipt.grantsDigest).toMatch(/^sha256:/);
      expect(receipt.approvalsDigest).toMatch(/^sha256:/);
    });
  });

  describe("license evidence and bytes digest-bound", () => {
    it("release requires both artifact and license evidence digests", () => {
      const r = makeRelease();
      expect(r.artifactSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(r.licenseEvidenceSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(r.byteSize).toBeGreaterThan(0);
    });
  });
});
