import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { parseMaculaForNeh2 } from "../src/parser";

function resolveQuarantine(p: string): string {
  if (fs.existsSync(p)) return p;
  const cands = [path.resolve(__dirname, "../../../", p)];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return p;
}

describe("Task 13 — MACULA Hebrew linguistic adapter (Nehemiah 2)", () => {
  it("re-verifies SHA before parsing", () => {
    const r = parseMaculaForNeh2();
    expect(r.receipt.sha256).toBe("sha256:f125eed6cb098da454d8de45eccdfd750d2b2f9909258174fbe492e98b7e07f6");
    expect(r.receipt.byteSize).toBe(543402);
  });

  it("every field retains component-level license/provenance", () => {
    const { tokens, referents } = parseMaculaForNeh2();
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
    const { tokens } = parseMaculaForNeh2();
    for (const t of tokens) {
      expect(t.wlcTokenId).toMatch(/^WLC:/);
      expect(t.wlcTokenId).not.toMatch(/^BSB:/);
      expect(t.sourceLocator).not.toMatch(/BSB/);
    }
  });

  it("ambiguous/missing referents remain unresolved (isAmbiguous)", () => {
    const { referents, coverage } = parseMaculaForNeh2();
    const ambiguous = referents.filter((r) => r.isAmbiguous);
    expect(ambiguous.length).toBeGreaterThan(0);
    expect(coverage.ambiguous).toBe(ambiguous.length);
    expect(ambiguous[0].mappingConfidence).toBe("medium");
  });

  it("Hebrew referent coverage is reported as partial", () => {
    const { coverage } = parseMaculaForNeh2();
    expect(coverage.neh2Tokens).toBe(5);
    expect(coverage.totalTokens).toBeGreaterThan(coverage.neh2Tokens);
    expect(coverage.produced.tokens).toBe(5);
    expect(coverage.rejected).toBe(1); // qere/ketiv
  });

  it("fails on SHA mismatch", () => {
    const qPath = resolveQuarantine("content/quarantine/macula/hebrew/16-Neh-002-lowfat.xml");
    const buf = fs.readFileSync(qPath);
    const tmp = "/tmp/macula-tampered.xml";
    fs.writeFileSync(tmp, Buffer.concat([buf, Buffer.from("x")]));
    expect(() => parseMaculaForNeh2({ quarantinePath: tmp, expectedSha256: "sha256:f125eed6cb098da454d8de45eccdfd750d2b2f9909258174fbe492e98b7e07f6" })).toThrow(
      /SHA mismatch/,
    );
  });

  it("fails on missing header", () => {
    const tmp = "/tmp/macula-invalid.xml";
    fs.writeFileSync(tmp, "<not>macula</not>");
    const sha = `sha256:${crypto.createHash("sha256").update(fs.readFileSync(tmp)).digest("hex")}`;
    expect(() => parseMaculaForNeh2({ quarantinePath: tmp, expectedSha256: sha })).toThrow(/MACULA header not found/);
  });

  it("does not infer person identity (referent is annotation, not approved fact)", () => {
    const { referents } = parseMaculaForNeh2();
    for (const r of referents) {
      expect(r.referent).toMatch(/^(narrator|speaker|entity):/);
      // Should not claim as established fact, only candidate
      expect(r.mappingConfidence).not.toBe("established" as unknown as string);
    }
  });

  it("deterministic output", () => {
    const r1 = parseMaculaForNeh2();
    const r2 = parseMaculaForNeh2();
    expect(r1.receipt.candidatesSha256).toBe(r2.receipt.candidatesSha256);
  });
});
