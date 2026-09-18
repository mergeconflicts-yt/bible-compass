import * as fs from "fs";
import * as path from "path";
import { compareForNeh2 } from "../src/parser";

// Committed synthetic fixtures (R1-A): hermetic on clean clones without the
// git-ignored production quarantine. Production defaults in src/parser.ts
// are unchanged.
const FIXTURE_OPTS = {
  quarantinePaths: {
    person: path.join(__dirname, "fixtures", "BibleData-Person-synthetic.csv"),
    relationship: path.join(
      __dirname,
      "fixtures",
      "BibleData-PersonRelationship-synthetic.csv",
    ),
    personVerse: path.join(
      __dirname,
      "fixtures",
      "BibleData-PersonVerse-synthetic.csv",
    ),
  },
  expectedShas: {
    person:
      "sha256:9cf83dd618868a7e84978dad664849bbbbd7d7951f5b5d5058c04ac5d34d105b",
    relationship:
      "sha256:50451170e782abc1d929990427489cd77682075c0d8eefc08da961d28098e2bf",
    personVerse:
      "sha256:5c19075404511c9f06c5ee9f86b614e4bff513b8342082afc9e65845ff73364d",
  },
  tipnrCandidatesPath: path.join(__dirname, "fixtures", "tipnr-synthetic.json"),
};

describe("Task 12 — BibleData discrepancy adapter (Nehemiah 2)", () => {
  it("re-verifies 3 CSV SHAs before parsing", () => {
    for (const p of Object.values(FIXTURE_OPTS.quarantinePaths)) {
      expect(fs.existsSync(p)).toBe(true);
    }
    const r = compareForNeh2(FIXTURE_OPTS);
    expect(r.bibleDataShas.person).toBe(FIXTURE_OPTS.expectedShas.person);
    expect(r.bibleDataShas.relationship).toBe(
      FIXTURE_OPTS.expectedShas.relationship,
    );
    expect(r.bibleDataShas.personVerse).toBe(
      FIXTURE_OPTS.expectedShas.personVerse,
    );
  });

  it("comparison is source-local and reversible (both locators present)", () => {
    const { records } = compareForNeh2(FIXTURE_OPTS);
    for (const rec of records) {
      if (
        rec.status === "exact" ||
        rec.status === "probable" ||
        rec.status === "conflict"
      ) {
        expect(rec.tipnrLocator).toBeTruthy();
        expect(rec.bibleDataLocator).toBeTruthy();
      }
      if (rec.status === "missing_in_bibledata") {
        expect(rec.bibleDataLocator).toBeNull();
        expect(rec.tipnrLocator).toBeTruthy();
      }
    }
  });

  it("every difference links both raw locators where applicable", () => {
    const { records } = compareForNeh2(FIXTURE_OPTS);
    const conflict = records.find((r) => r.status === "conflict");
    expect(conflict?.tipnrLocator).toMatch(/TIPNR:/);
    expect(conflict?.bibleDataLocator).toMatch(/BibleData-/);
  });

  it("shared upstream dependence is recorded where known", () => {
    const { records, flags } = compareForNeh2(FIXTURE_OPTS);
    const shared = records.filter((r) => r.sharedUpstream);
    expect(shared.length).toBeGreaterThan(0);
    expect(flags.sharedAncestry[0]).toMatch(
      /not counted as independent evidence/,
    );
  });

  it("consequential person/divine/collective classifications are flagged", () => {
    const { flags } = compareForNeh2(FIXTURE_OPTS);
    expect(flags.consequentialClassifications.length).toBeGreaterThan(0);
    expect(flags.consequentialClassifications[0]).toMatch(/collective\/polity/);
  });

  it("no automatic winner or canonical merge", () => {
    const { records } = compareForNeh2(FIXTURE_OPTS);
    for (const r of records) {
      expect(r.details).not.toMatch(/BibleData wins|TIPNR wins/i);
    }
    // Ensure report does not claim canonical entity creation
    const report = compareForNeh2(FIXTURE_OPTS);
    expect(JSON.stringify(report)).not.toMatch(/canonicalEntity/);
  });

  it("fails on SHA mismatch", () => {
    const tmp = "/tmp/BibleData-Person-tampered.csv";
    const buf = fs.readFileSync(FIXTURE_OPTS.quarantinePaths.person);
    fs.writeFileSync(tmp, Buffer.concat([buf, Buffer.from("x")]));
    expect(() =>
      compareForNeh2({
        ...FIXTURE_OPTS,
        quarantinePaths: { ...FIXTURE_OPTS.quarantinePaths, person: tmp },
      }),
    ).toThrow(/SHA mismatch/);
  });

  it("coverage distinguishes missing_in_bibledata vs unresolved", () => {
    const { records, coverage } = compareForNeh2(FIXTURE_OPTS);
    const missing = records.filter((r) => r.status === "missing_in_bibledata");
    const unresolved = records.filter((r) => r.status === "unresolved");
    expect(missing.length).toBe(2);
    expect(unresolved.length).toBe(1);
    expect(coverage.missing).toBe(2);
    expect(coverage.unresolved).toBe(1);
  });

  it("is deterministic", () => {
    const r1 = compareForNeh2(FIXTURE_OPTS);
    const r2 = compareForNeh2(FIXTURE_OPTS);
    expect(r1.receipt.reportSha256).toBe(r2.receipt.reportSha256);
  });
});
