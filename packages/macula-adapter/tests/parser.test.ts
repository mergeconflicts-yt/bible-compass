import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { parseMaculaForNeh2 } from "../src/parser";

// Committed synthetic fixture (R1-A): hermetic on clean clones without the
// git-ignored production quarantine. Production defaults in src/parser.ts
// are unchanged.
const FIXTURE = {
  quarantinePath: path.join(
    __dirname,
    "fixtures",
    "16-Neh-002-synthetic-lowfat.xml",
  ),
  expectedSha256:
    "sha256:357d8cea36cf89204d0f248f48f3a759aae723eb342634e93d79fd89aad32ec5",
  releaseKey: "release:source:macula:hebrew@fixture:sha-bf5a1e2f",
};

describe("Task 13 — MACULA Hebrew linguistic adapter (Nehemiah 2)", () => {
  it("re-verifies SHA before parsing", () => {
    expect(fs.existsSync(FIXTURE.quarantinePath)).toBe(true);
    const r = parseMaculaForNeh2(FIXTURE);
    expect(r.receipt.sha256).toBe(FIXTURE.expectedSha256);
    expect(r.receipt.byteSize).toBe(582);
  });

  it("every field retains component-level license/provenance", () => {
    const { tokens, referents } = parseMaculaForNeh2(FIXTURE);
    for (const t of tokens) {
      expect(t.sourceReleaseKey).toMatch(/^release:source:macula:hebrew@/);
      expect(t.sourceLocator).toMatch(/^WLC:/);
      expect(t.wlcTokenId).toMatch(/^WLC:Neh\.2\./);
    }
    for (const r of referents) {
      expect(r.sourceReleaseKey).toMatch(/^release:source:macula:hebrew@/);
      expect(r.sourceLocator).toMatch(/^WLC:/);
    }
  });

  it("source token and app-edition identity remain separate (no BSB offset reuse)", () => {
    const { tokens } = parseMaculaForNeh2(FIXTURE);
    for (const t of tokens) {
      expect(t.wlcTokenId).toMatch(/^WLC:/);
      expect(t.wlcTokenId).not.toMatch(/^BSB:/);
      expect(t.sourceLocator).not.toMatch(/BSB/);
    }
  });

  it("ambiguous/missing referents remain unresolved (isAmbiguous)", () => {
    const { referents, coverage } = parseMaculaForNeh2(FIXTURE);
    const ambiguous = referents.filter((r) => r.isAmbiguous);
    expect(ambiguous.length).toBeGreaterThan(0);
    expect(coverage.ambiguous).toBe(ambiguous.length);
    expect(ambiguous[0].mappingConfidence).toBe("medium");
  });

  it("Hebrew referent coverage is reported as partial", () => {
    const { coverage } = parseMaculaForNeh2(FIXTURE);
    expect(coverage.neh2Tokens).toBe(5);
    expect(coverage.totalTokens).toBeGreaterThan(coverage.neh2Tokens);
    expect(coverage.produced.tokens).toBe(5);
    expect(coverage.rejected).toBe(1); // qere/ketiv
  });

  it("fails on SHA mismatch", () => {
    const buf = fs.readFileSync(FIXTURE.quarantinePath);
    const tmp = "/tmp/macula-tampered.xml";
    fs.writeFileSync(tmp, Buffer.concat([buf, Buffer.from("x")]));
    expect(() =>
      parseMaculaForNeh2({
        quarantinePath: tmp,
        expectedSha256: FIXTURE.expectedSha256,
      }),
    ).toThrow(/SHA mismatch/);
  });

  it("fails on missing header", () => {
    const tmp = "/tmp/macula-invalid.xml";
    fs.writeFileSync(tmp, "<not>macula</not>");
    const sha = `sha256:${crypto.createHash("sha256").update(fs.readFileSync(tmp)).digest("hex")}`;
    expect(() =>
      parseMaculaForNeh2({ quarantinePath: tmp, expectedSha256: sha }),
    ).toThrow(/MACULA header not found/);
  });

  it("does not infer person identity (referent is annotation, not approved fact)", () => {
    const { referents } = parseMaculaForNeh2(FIXTURE);
    for (const r of referents) {
      expect(r.referent).toMatch(/^(narrator|speaker|entity):/);
      // Should not claim as established fact, only candidate
      expect(r.mappingConfidence).not.toBe("established" as unknown as string);
    }
  });

  it("deterministic output", () => {
    const r1 = parseMaculaForNeh2(FIXTURE);
    const r2 = parseMaculaForNeh2(FIXTURE);
    expect(r1.receipt.candidatesSha256).toBe(r2.receipt.candidatesSha256);
  });
});
