import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { parseTIPNRForNeh2 } from "../src/parser";
import { entityCandidateSchema, attestationCandidateSchema } from "../src/types";

function resolveQuarantine(p: string): string {
  if (fs.existsSync(p)) return p;
  const cands = [path.resolve(__dirname, "../../../", p), path.resolve(process.cwd(), p), path.resolve(process.cwd(), "../../", p)];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return p;
}

describe("Task 11 — TIPNR proper-name adapter (Nehemiah 2)", () => {
  it("re-verifies SHA before parsing", () => {
    const r = parseTIPNRForNeh2();
    expect(r.receipt.sha256).toBe("sha256:6cab6e4b6b2597996abc2ce9c9c621beca672c84ce473eb6c67224b02bf0003d");
    expect(r.receipt.byteSize).toBe(7967354);
    expect(r.receipt.quarantinePath).toBe("content/quarantine/stepbible/tipnr/TIPNR.txt");
  });

  it("every candidate traces to release, raw locator, transform, mapping", () => {
    const { entities, attestations, relations } = parseTIPNRForNeh2();
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
    const { unresolved } = parseTIPNRForNeh2();
    expect(unresolved.length).toBeGreaterThan(0);
    expect(unresolved[0].reason).toMatch(/distinct/);
    // Entities are not merged - hanani distinct from nehemiah
    const { entities } = parseTIPNRForNeh2();
    const hanani = entities.find((e) => e.key === "entity:hanani-brother");
    const neh = entities.find((e) => e.key === "entity:nehemiah-governor");
    expect(hanani?.identificationStatus).toBe("proposed");
    expect(neh?.identificationStatus).toBe("established");
  });

  it("named attestations never imply pronoun or relevance", () => {
    const { attestations } = parseTIPNRForNeh2();
    for (const a of attestations) {
      expect(["explicit", "strongly_implied"]).toContain(a.explicitness);
      // Ensure attestation is for explicit named form, not pronoun/implied_referent
      expect(a.kind).not.toBe("implied_referent");
    }
    // Ensure no relevance is conflated - attestations count is 4, not including relevance
    expect(attestations).toHaveLength(4);
  });

  it("family relations remain claims requiring review", () => {
    const { relations } = parseTIPNRForNeh2();
    expect(relations.length).toBe(2);
    for (const r of relations) {
      expect(r.claimKey).toMatch(/^claim:/);
      // Predicate is not free-text beyond allowed set, but we check it exists
      expect(r.predicate.length).toBeGreaterThan(0);
    }
  });

  it("rebuild is deterministic", () => {
    const r1 = parseTIPNRForNeh2();
    const r2 = parseTIPNRForNeh2();
    expect(r1.receipt.candidatesSha256).toBe(r2.receipt.candidatesSha256);
    expect(r1.coverage.produced.entities).toBe(r2.coverage.produced.entities);
  });

  it("excludes Claude descriptions and geodata as rejects", () => {
    const { rejects } = parseTIPNRForNeh2();
    const reasons = rejects.map((r) => r.reason);
    expect(reasons.some((r) => r.includes("Claude"))).toBe(true);
    expect(reasons.some((r) => r.includes("Geodata"))).toBe(true);
  });

  it("fails on SHA mismatch", () => {
    const tmp = "/tmp/TIPNR-tampered.txt";
    const qPath = resolveQuarantine("content/quarantine/stepbible/tipnr/TIPNR.txt");
    const buf = fs.readFileSync(qPath);
    fs.writeFileSync(tmp, Buffer.concat([buf, Buffer.from("x")]));
    expect(() => parseTIPNRForNeh2({ quarantinePath: tmp, expectedSha256: "sha256:6cab6e4b6b2597996abc2ce9c9c621beca672c84ce473eb6c67224b02bf0003d" })).toThrow(/SHA mismatch/);
  });

  it("fails on missing TIPNR header", () => {
    const tmp = "/tmp/TIPNR-invalid.txt";
    fs.writeFileSync(tmp, "not tipnr");
    const sha = `sha256:${crypto.createHash("sha256").update(fs.readFileSync(tmp)).digest("hex")}`;
    expect(() => parseTIPNRForNeh2({ quarantinePath: tmp, expectedSha256: sha })).toThrow(/TIPNR header not found/);
  });

  it("coverage reports produced/rejected/unresolved", () => {
    const { coverage } = parseTIPNRForNeh2();
    expect(coverage.produced.entities).toBe(5);
    expect(coverage.produced.attestations).toBe(4);
    expect(coverage.rejected).toBe(2);
    expect(coverage.unresolved).toBe(1);
  });
});
