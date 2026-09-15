import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface GenerationReceipt {
  attemptId: string;
  bundleDigest: string;
  inputDigest: string;
  outputDigest: string;
  provider: string;
  model: string;
  startedAt: string;
  completedAt: string;
  status: "success" | "failed" | "timeout";
  costCents: number;
  rawResponsePath: string;
}

const COST_LIMIT_CENTS = 100;
const CONCURRENCY_LIMIT = 1;
let concurrent = 0;

function resolveBundle(p: string): string {
  if (fs.existsSync(p)) return p;
  const cands = [path.resolve(__dirname, "../../../", p), path.resolve(process.cwd(), p)];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return p;
}

export async function runOneAttempt(options: {
  bundlePath: string;
  expectedBundleDigest: string;
  gateD2Sha: string;
  attemptId: string;
  provider: string;
  model: string;
}): Promise<GenerationReceipt> {
  if (concurrent >= CONCURRENCY_LIMIT) {
    throw Object.assign(new Error("Concurrency limit exceeded"), { code: "rate-limited" });
  }
  concurrent++;
  try {
    const bundlePath = resolveBundle(options.bundlePath);
    const buf = fs.readFileSync(bundlePath);
    const actualDigest = `sha256:${crypto.createHash("sha256").update(buf).digest("hex")}`;
    if (actualDigest !== options.expectedBundleDigest) {
      throw Object.assign(new Error(`Bundle digest mismatch: expected ${options.expectedBundleDigest} got ${actualDigest}`), {
        code: "digest-mismatch",
      });
    }
    if (!options.gateD2Sha.startsWith("sha256:")) {
      throw Object.assign(new Error("Gate D2 SHA required"), { code: "gate-d2-denied" });
    }

    const startedAt = new Date().toISOString();
    // Simulate provider call with synthetic fixture (no network, no secrets)
    // In real, this would call provider API with bundle excerpts and capture raw JSON
    const syntheticRaw = JSON.stringify({
      schema_version: "1.0.0",
      package_kind: "entity-profile-draft",
      records: [
        {
          record_key: "profile-001",
          record_kind: "entity_profile",
          entity_key: "entity:nehemiah-governor",
          language_tag: "en",
          short_description: { text: "Nehemiah was cupbearer to Artaxerxes.", claim_keys: ["claim-001"] },
        },
      ],
      open_questions: [],
      editorial_observations: [],
    });
    const outputDigest = `sha256:${crypto.createHash("sha256").update(syntheticRaw).digest("hex")}`;
    const inputDigest = actualDigest;

    // Enforce cost limit
    const costCents = 5;
    if (costCents > COST_LIMIT_CENTS) {
      throw Object.assign(new Error("Cost limit exceeded"), { code: "cost-exceeded" });
    }

    // Write raw response quarantine — always to repo root content/pilot/raw-responses
    const rawDir = path.resolve(__dirname, "../../../content/pilot/raw-responses");
    fs.mkdirSync(rawDir, { recursive: true });
    const rawPath = path.join(rawDir, `${options.attemptId}.json`);
    fs.writeFileSync(rawPath, syntheticRaw);

    const completedAt = new Date().toISOString();
    const receipt: GenerationReceipt = {
      attemptId: options.attemptId,
      bundleDigest: actualDigest,
      inputDigest,
      outputDigest,
      provider: options.provider,
      model: options.model,
      startedAt,
      completedAt,
      status: "success",
      costCents,
      rawResponsePath: path.join("content/pilot/raw-responses", `${options.attemptId}.json`),
    };
    // Write receipt
    fs.writeFileSync(path.join(rawDir, `${options.attemptId}.receipt.json`), JSON.stringify(receipt, null, 2));
    return receipt;
  } finally {
    concurrent--;
  }
}
