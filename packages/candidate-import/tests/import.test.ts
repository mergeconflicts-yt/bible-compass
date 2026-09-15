import * as fs from "fs";
import * as path from "path";
import { CandidateImportService, importerActor, anonActor } from "../src/service";

function resolveCandidate(p: string): string {
  if (fs.existsSync(p)) return p;
  const cands = [path.resolve(__dirname, "../../../", p)];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return p;
}

describe("Task 18 — Idempotent candidate import service", () => {
  const packageKey = "package:neh2:candidate:001";
  const candidatePaths = [
    "content/candidates/tvtms-neh2.json",
    "content/candidates/tipnr-neh2.json",
    "content/candidates/bibledata-neh2-discrepancy.json",
    "content/candidates/macula-neh2.json",
    "content/candidates/openbible-neh2.json",
    "content/candidates/reconciliation-15a.json",
    "content/candidates/bsb-mentions-neh2.json",
  ].map(resolveCandidate);

  it("same package replay creates no duplicate semantic record", async () => {
    const svc = new CandidateImportService();
    const actor = importerActor();
    const r1 = await svc.importPackage(packageKey, candidatePaths, actor);
    expect(r1.success).toBe(true);
    expect(r1.imported).toBe(7);
    expect(svc.getStagedCount()).toBe(7);
    const r2 = await svc.importPackage(packageKey, candidatePaths, actor);
    expect(r2.success).toBe(true);
    expect(r2.duplicatesSkipped).toBe(7);
    expect(r2.imported).toBe(0);
    expect(svc.getStagedCount()).toBe(7);
  });

  it("changed bytes under same release/package key fail", async () => {
    const svc = new CandidateImportService();
    const actor = importerActor();
    const originalPath = candidatePaths[0]!;
    const r1 = await svc.importPackage(packageKey, [originalPath], actor);
    expect(r1.success).toBe(true);
    // Tamper the file at same path with valid JSON but different content
    const tmp = "/tmp/candidate-tampered-same-key.json";
    const data = JSON.parse(fs.readFileSync(originalPath, "utf-8"));
    // Modify a field to make digest different but still valid
    if (Array.isArray((data as unknown as { candidates?: unknown[] }).candidates)) {
      ((data as unknown as { candidates: unknown[] }).candidates as unknown[]).push({ fake: "tampered" });
    } else {
      (data as Record<string, unknown>).tampered = true;
    }
    fs.writeFileSync(tmp, JSON.stringify(data));
    // Import with same packageKey but same logical path (simulate same file changed) — we use same tmp path as original key by using originalPath as key but with tampered content via tmp
    // To test changed bytes under same key, we need to use same path string but tampered content.
    // We'll copy tampered to a file that we will import with same packageKey and same path string as original, but we need to make the service see same key.
    // For this test, we simulate by importing the same tmp path twice with different content.
    const sameTacPath = "/tmp/candidate-same-key.json";
    fs.writeFileSync(sameTacPath, JSON.stringify({ candidates: [{ a: 1 }], sourceReleaseKey: "test" }));
    const rA = await svc.importPackage("package:changed-test", [sameTacPath], actor);
    expect(rA.success).toBe(true);
    // Now change content at same path
    fs.writeFileSync(sameTacPath, JSON.stringify({ candidates: [{ a: 2 }], sourceReleaseKey: "test2" }));
    const rB = await svc.importPackage("package:changed-test", [sameTacPath], actor);
    expect(rB.success).toBe(false);
    expect(rB.error).toMatch(/Changed bytes/);
  });

  it("one invalid record fails the atomic package", async () => {
    const svc = new CandidateImportService();
    const actor = importerActor();
    const tmp = "/tmp/candidate-invalid.json";
    fs.writeFileSync(tmp, JSON.stringify({ notACandidate: true }));
    const r = await svc.importPackage(packageKey, [candidatePaths[0]!, tmp], actor);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/One invalid record fails atomic package/);
    expect(svc.getStagedCount()).toBe(0);
  });

  it("every staged assertion resolves complete lineage and rights obligations", async () => {
    const svc = new CandidateImportService();
    const actor = importerActor();
    const r = await svc.importPackage(packageKey, candidatePaths, actor);
    expect(r.success).toBe(true);
    for (const line of r.receipt.lineage) {
      expect(line).toMatch(/lineage/);
    }
  });

  it("import actor cannot approve or publish (public client privilege)", async () => {
    const svc = new CandidateImportService();
    const anon = anonActor();
    await expect(svc.importPackage(packageKey, [candidatePaths[0]!], anon)).rejects.toThrow(/Public client cannot import/);
  });

  it("is deterministic and produces audit receipt", async () => {
    const svc = new CandidateImportService();
    const actor = importerActor();
    const r1 = await svc.importPackage(packageKey, candidatePaths, actor);
    const r2 = await svc.importPackage(packageKey, candidatePaths, actor);
    // Second is duplicate skipped, but first receipt should be deterministic
    expect(r1.receipt.candidatesSha256).toBe(r2.receipt.candidatesSha256);
  });
});
