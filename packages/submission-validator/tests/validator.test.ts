import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { validateSubmission } from "../src/validator";

function resolveRaw(p: string): string {
  if (fs.existsSync(p)) return p;
  const cand = path.resolve(__dirname, "../../../", p);
  if (fs.existsSync(cand)) return cand;
  return p;
}

// Finding 5: every validation writes drafts and quarantine files into an
// isolated tmpdir — never the tracked content/pilot/drafts directory — so
// committed evidence files cannot be overwritten by a test run. Same
// attemptIds as the pipeline on purpose: identical names in a different
// directory prove isolation.
const scratchDirs: string[] = [];

function scratchDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

function writeRaw(dir: string, name: string, payload: unknown): string {
  const rawPath = path.join(dir, name);
  fs.writeFileSync(rawPath, JSON.stringify(payload));
  return rawPath;
}

function validPayload(
  recordKey = "profile-001",
  entityKey = "entity:nehemiah-governor",
) {
  return {
    schema_version: "1.0.0",
    package_kind: "entity-profile-draft",
    records: [
      {
        record_key: recordKey,
        record_kind: "entity_profile",
        entity_key: entityKey,
        language_tag: "en",
        short_description: {
          text: "Nehemiah was cupbearer to Artaxerxes.",
          claim_keys: ["claim-001"],
        },
      },
    ],
    open_questions: [],
    editorial_observations: [],
  };
}

afterAll(() => {
  for (const dir of scratchDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Task 19C — AI submission validator and quarantine", () => {
  const bundleDigest = "sha256:" + "a".repeat(64);
  const jobId = "job:neh2-entity-profile-001";
  // The committed pipeline raw response stays a read-only fixture: the
  // suite never writes through this path.
  const rawPath = resolveRaw("content/pilot/raw-responses/19B-attempt-1.json");

  it("no downstream mutation before complete validation (valid passes, invalid fails atomic)", () => {
    const dir = scratchDir("19C-valid-");
    const result = validateSubmission({
      rawResponsePath: rawPath,
      bundleDigest,
      jobId,
      attemptId: "19C-valid-1",
      draftDir: dir,
    });
    expect(result.valid).toBe(true);
    expect(result.findings).toHaveLength(0);
    expect(result.draftPath).toBeTruthy();
    expect(result.draftPath!.startsWith(dir)).toBe(true);
    expect(fs.existsSync(result.draftPath!)).toBe(true);
    // Invalid should not create draft
    const tmp = "/tmp/19C-invalid.json";
    fs.writeFileSync(tmp, JSON.stringify({ not: "valid" }));
    const invalid = validateSubmission({
      rawResponsePath: tmp,
      bundleDigest,
      jobId,
      attemptId: "19C-invalid-1",
      draftDir: dir,
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.findings[0].severity).toBe("blocking");
    expect(invalid.draftPath).toBeNull();
  });

  it("findings have stable codes/pointers and blocking state", () => {
    const dir = scratchDir("19C-dup-");
    const tmp = "/tmp/19C-duplicate.json";
    const raw = JSON.stringify({
      schema_version: "1.0.0",
      package_kind: "entity-profile-draft",
      records: [
        { record_key: "dup", record_kind: "entity_profile" },
        { record_key: "dup", record_kind: "entity_profile" },
      ],
      open_questions: [],
      editorial_observations: [],
    });
    fs.writeFileSync(tmp, raw);
    const result = validateSubmission({
      rawResponsePath: tmp,
      bundleDigest,
      jobId,
      attemptId: "19C-dup-1",
      draftDir: dir,
    });
    expect(result.valid).toBe(false);
    expect(result.findings[0].code).toBe("duplicate-key");
    expect(result.findings[0].severity).toBe("blocking");
  });

  it("replay of one response cannot create a second draft revision", () => {
    const dir = scratchDir("19C-replay-");
    const attemptId = "19C-replay-1";
    const r1 = validateSubmission({
      rawResponsePath: rawPath,
      bundleDigest,
      jobId,
      attemptId,
      draftDir: dir,
    });
    expect(r1.valid).toBe(true);
    const r2 = validateSubmission({
      rawResponsePath: rawPath,
      bundleDigest,
      jobId,
      attemptId,
      draftDir: dir,
    });
    expect(r2.valid).toBe(true);
    expect(r2.draftPath).toBe(r1.draftPath);
    // Different payload under same attempt should fail
    const tmp2 = "/tmp/19C-replay-changed.json";
    fs.writeFileSync(
      tmp2,
      JSON.stringify({
        schema_version: "1.0.0",
        package_kind: "entity-profile-draft",
        records: [
          {
            record_key: "other",
            record_kind: "entity_profile",
            entity_key: "entity:other",
            language_tag: "en",
          },
        ],
        open_questions: [],
        editorial_observations: [],
      }),
    );
    const r3 = validateSubmission({
      rawResponsePath: tmp2,
      bundleDigest,
      jobId,
      attemptId,
      draftDir: dir,
    });
    expect(r3.valid).toBe(false);
    expect(r3.findings[0].code).toBe("replay-changed-payload");
  });

  it("writes self-contained valid submissions without the committed fixture", () => {
    const dir = scratchDir("19C-selfcontained-");
    const raw = writeRaw(dir, "input.json", validPayload());
    const result = validateSubmission({
      rawResponsePath: raw,
      bundleDigest,
      jobId,
      attemptId: "19C-valid-1",
      draftDir: dir,
    });
    expect(result.valid).toBe(true);
    expect(result.quarantinedPath).toBeTruthy();
    expect(result.quarantinedPath!.startsWith(dir)).toBe(true);
    expect(result.draftPath!.startsWith(dir)).toBe(true);
    const draft = JSON.parse(fs.readFileSync(result.draftPath!, "utf-8")) as {
      rawSha?: string;
    };
    expect(typeof draft.rawSha).toBe("string");
  });

  it("rejects atomic on duplicate or invalid", () => {
    const dir = scratchDir("19C-invalid2-");
    const tmp = "/tmp/19C-invalid2.json";
    fs.writeFileSync(tmp, "not json at all {{{");
    const result = validateSubmission({
      rawResponsePath: tmp,
      bundleDigest,
      jobId,
      attemptId: "19C-invalid2",
      draftDir: dir,
    });
    expect(result.valid).toBe(false);
    expect(result.findings[0].code).toBe("invalid-json");
  });
});
