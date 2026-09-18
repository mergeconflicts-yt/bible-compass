import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { parseTIPNRForNeh2 } from "../src/parser";
import {
  entityCandidateSchema,
  attestationCandidateSchema,
} from "../src/types";

// Committed synthetic fixture (R1-A): hermetic on clean clones without the
// git-ignored production quarantine. Production defaults in src/parser.ts
// are unchanged.
const FIXTURE = {
  quarantinePath: path.join(__dirname, "fixtures", "TIPNR-synthetic.txt"),
  expectedSha256:
    "sha256:d6aea69493f9f1a1a69be2a8e2a144294265eb6ad0a1dad8550e1c8c03b62dc7",
  releaseKey: "release:source:stepbible:tipnr@fixture:sha-d6aea694",
};

describe("Task 11 — TIPNR proper-name adapter (Nehemiah 2)", () => {
  it("re-verifies SHA before parsing", () => {
    expect(fs.existsSync(FIXTURE.quarantinePath)).toBe(true);
    const r = parseTIPNRForNeh2(FIXTURE);
    expect(r.receipt.sha256).toBe(FIXTURE.expectedSha256);
    expect(r.receipt.byteSize).toBe(290);
    expect(r.receipt.quarantinePath).toBe(FIXTURE.quarantinePath);
  });

  it("every candidate traces to release, raw locator, transform, mapping", () => {
    const { entities, attestations, relations } = parseTIPNRForNeh2(FIXTURE);
    for (const e of entities) {
      expect(e.sourceReleaseKey).toMatch(/^release:source:stepbible:tipnr@/);
      expect(e.sourceLocator).toMatch(/^TIPNR:NEH:/);
      expect(e.upstreamId).toMatch(/^tipnr:/);
      expect(entityCandidateSchema.safeParse(e).success).toBe(true);
    }
    for (const a of attestations) {
      expect(a.sourceReleaseKey).toMatch(/^release:source:stepbible:tipnr@/);
      expect(a.sourceLocator).toMatch(/^TIPNR:NEH:/);
      expect(a.mappingVia).toMatch(/^TVTMS:/);
      expect(attestationCandidateSchema.safeParse(a).success).toBe(true);
    }
    for (const rel of relations) {
      expect(rel.sourceLocator).toMatch(/^TIPNR:/);
    }
  });

  it("same/probable/possible/distinct/unresolved remain separate - not merged homonyms", () => {
    const { unresolved } = parseTIPNRForNeh2(FIXTURE);
    expect(unresolved.length).toBeGreaterThan(0);
    expect(unresolved[0].reason).toMatch(/distinct/);
    // Entities are not merged - hanani distinct from nehemiah
    const { entities } = parseTIPNRForNeh2(FIXTURE);
    const hanani = entities.find((e) => e.key === "entity:hanani-brother");
    const neh = entities.find((e) => e.key === "entity:nehemiah-governor");
    expect(hanani?.identificationStatus).toBe("proposed");
    expect(neh?.identificationStatus).toBe("established");
  });

  it("named attestations never imply pronoun or relevance", () => {
    const { attestations } = parseTIPNRForNeh2(FIXTURE);
    for (const a of attestations) {
      expect(["explicit", "strongly_implied"]).toContain(a.explicitness);
      // Ensure attestation is for explicit named form, not pronoun/implied_referent
      expect(a.kind).not.toBe("implied_referent");
    }
    // Ensure no relevance is conflated - attestations count is 4, not including relevance
    expect(attestations).toHaveLength(4);
  });

  it("family relations remain claims requiring review", () => {
    const { relations } = parseTIPNRForNeh2(FIXTURE);
    expect(relations.length).toBe(2);
    for (const r of relations) {
      expect(r.claimKey).toMatch(/^claim:/);
      // Predicate is not free-text beyond allowed set, but we check it exists
      expect(r.predicate.length).toBeGreaterThan(0);
    }
  });

  it("rebuild is deterministic", () => {
    const r1 = parseTIPNRForNeh2(FIXTURE);
    const r2 = parseTIPNRForNeh2(FIXTURE);
    expect(r1.receipt.candidatesSha256).toBe(r2.receipt.candidatesSha256);
    expect(r1.coverage.produced.entities).toBe(r2.coverage.produced.entities);
  });

  it("excludes Claude descriptions and geodata as rejects", () => {
    const { rejects } = parseTIPNRForNeh2(FIXTURE);
    const reasons = rejects.map((r) => r.reason);
    expect(reasons.some((r) => r.includes("Claude"))).toBe(true);
    expect(reasons.some((r) => r.includes("Geodata"))).toBe(true);
  });

  it("fails on SHA mismatch", () => {
    const tmp = "/tmp/TIPNR-tampered.txt";
    const buf = fs.readFileSync(FIXTURE.quarantinePath);
    fs.writeFileSync(tmp, Buffer.concat([buf, Buffer.from("x")]));
    expect(() =>
      parseTIPNRForNeh2({
        quarantinePath: tmp,
        expectedSha256: FIXTURE.expectedSha256,
      }),
    ).toThrow(/SHA mismatch/);
  });

  it("fails on missing TIPNR header", () => {
    const tmp = "/tmp/TIPNR-invalid.txt";
    fs.writeFileSync(tmp, "not tipnr");
    const sha = `sha256:${crypto.createHash("sha256").update(fs.readFileSync(tmp)).digest("hex")}`;
    expect(() =>
      parseTIPNRForNeh2({ quarantinePath: tmp, expectedSha256: sha }),
    ).toThrow(/TIPNR header not found/);
  });

  it("coverage reports produced/rejected/unresolved", () => {
    const { coverage } = parseTIPNRForNeh2(FIXTURE);
    expect(coverage.produced.entities).toBe(5);
    expect(coverage.produced.attestations).toBe(4);
    expect(coverage.rejected).toBe(2);
    expect(coverage.unresolved).toBe(1);
  });
});
