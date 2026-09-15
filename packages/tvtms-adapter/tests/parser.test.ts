import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { parseTVTMSForNeh2 } from "../src/parser";
import { referenceMappingCandidateSchema } from "../src/types";

function resolveQuarantine(p: string): string {
  if (fs.existsSync(p)) return p;
  const candidates = [
    path.resolve(__dirname, "../../../", p),
    path.resolve(process.cwd(), p),
    path.resolve(process.cwd(), "../../", p),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return p;
}

describe("Task 10 — TVTMS reference-mapping adapter (Nehemiah 2)", () => {
  it("re-verifies SHA before parsing and produces Neh2 candidates", () => {
    const result = parseTVTMSForNeh2();
    expect(result.candidates.length).toBeGreaterThan(20);
    expect(result.coverage.produced).toBe(result.candidates.length);
    expect(result.receipt.sha256).toBe("sha256:63058e0f20201af4bdaa7d830da5be8f493455d947c5f147d84840b33db9ddf8");
    expect(result.receipt.byteSize).toBe(5790928);
    expect(result.receipt.quarantinePath).toBe("content/quarantine/stepbible/tvtms/TVTMS.txt");
  });

  it("every candidate maps to named refsys and preserves kind", () => {
    const { candidates } = parseTVTMSForNeh2();
    for (const c of candidates) {
      expect(referenceMappingCandidateSchema.safeParse(c).success).toBe(true);
      expect(["refsys:eng-v22", "refsys:tel-v1", "refsys:tam-v1"]).toContain(c.fromRefsys);
      expect(["refsys:eng-v22", "refsys:tel-v1", "refsys:tam-v1"]).toContain(c.toRefsys);
      expect(c.sourceLocator).toMatch(/^TVTMS:/);
    }
    const kinds = new Set(candidates.map((c) => c.kind));
    expect(kinds.has("equivalent")).toBe(true);
    expect(kinds.has("split")).toBe(true);
    expect(kinds.has("merge")).toBe(true);
    expect(kinds.has("omitted")).toBe(true);
    expect(kinds.has("uncertain")).toBe(true);
  });

  it("split is preserved not silently dropped (Neh.2.4 => 4a + 4b)", () => {
    const { candidates } = parseTVTMSForNeh2();
    const split = candidates.filter((c) => c.from === "Neh.2.4" && c.kind === "split");
    expect(split).toHaveLength(2);
    expect(split.map((s) => s.to).sort()).toEqual(["Neh.2.4a", "Neh.2.4b"]);
  });

  it("merge is preserved (Neh.2.3+2.4 => tam 2.3)", () => {
    const { candidates } = parseTVTMSForNeh2();
    const merge = candidates.find((c) => c.from === "Neh.2.3" && c.kind === "merge");
    expect(merge).toBeTruthy();
    expect(merge?.toRefsys).toBe("refsys:tam-v1");
  });

  it("unresolved mappings are rejected not guessed", () => {
    const { rejects } = parseTVTMSForNeh2();
    expect(rejects.length).toBeGreaterThan(0);
    expect(rejects[0].reason).toMatch(/rejected, not guessed/);
  });

  it("fails on SHA mismatch (different bytes under same releaseKey)", () => {
    const quarantinedPath = resolveQuarantine("content/quarantine/stepbible/tvtms/TVTMS.txt");
    const buf = fs.readFileSync(quarantinedPath);
    const tampered = Buffer.concat([buf, Buffer.from("x")]);
    const tmpPath = "/tmp/TVTMS-tampered.txt";
    fs.writeFileSync(tmpPath, tampered);
    expect(() =>
      parseTVTMSForNeh2({ quarantinePath: tmpPath, expectedSha256: "sha256:63058e0f20201af4bdaa7d830da5be8f493455d947c5f147d84840b33db9ddf8" }),
    ).toThrow(/SHA mismatch/);
  });

  it("fails on missing TVTMS header (invalid artifact)", () => {
    const tmpPath = "/tmp/TVTMS-invalid.txt";
    fs.writeFileSync(tmpPath, "not tvtms");
    const sha = `sha256:${crypto.createHash("sha256").update(fs.readFileSync(tmpPath)).digest("hex")}`;
    expect(() => parseTVTMSForNeh2({ quarantinePath: tmpPath, expectedSha256: sha })).toThrow(/TVTMS header not found/);
  });

  it("candidates are deterministic (same bytes => same candidatesSha)", () => {
    const r1 = parseTVTMSForNeh2();
    const r2 = parseTVTMSForNeh2();
    expect(r1.receipt.candidatesSha256).toBe(r2.receipt.candidatesSha256);
  });

  it("coverage kinds are reported", () => {
    const { coverage } = parseTVTMSForNeh2();
    expect(coverage.kinds["equivalent"]).toBeGreaterThan(10);
    expect(coverage.kinds["split"]).toBe(2);
    expect(coverage.kinds["omitted"]).toBe(1);
  });
});
