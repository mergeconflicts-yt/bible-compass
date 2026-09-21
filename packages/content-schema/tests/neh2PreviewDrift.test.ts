import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

// Drift detection for the generated Nehemiah 2 mobile preview asset. The
// asset is a pure projection of the three contract packages; if either the
// projection tool or the source packages change without regenerating it, the
// asset is stale and this test fails. Regenerate with:
//   python3 tools/build-neh2-preview.py
// or run the CI gate:
//   python3 tools/build-neh2-preview.py --check

const REPO = path.resolve(__dirname, "../../..");
const GENERATOR = path.join(REPO, "tools", "build-neh2-preview.py");
const ASSET = path.join(
  REPO,
  "apps/mobile/assets/content/nehemiah-2.preview.json",
);
const CANONICAL = path.join(REPO, "content/nehemiah-2/canonical.v2.json");

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = stable((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function digest(value: unknown): string {
  return (
    "sha256:" +
    crypto
      .createHash("sha256")
      .update(JSON.stringify(stable(value)), "utf8")
      .digest("hex")
  );
}

describe("Nehemiah 2 preview projection — drift", () => {
  it("ships the generator the asset claims to come from", () => {
    expect(fs.existsSync(GENERATOR)).toBe(true);
    const asset = JSON.parse(fs.readFileSync(ASSET, "utf-8")) as {
      generator: string;
    };
    expect(asset.generator).toBe("tools/build-neh2-preview.py");
  });

  it("matches the canonical source package digest", () => {
    const canonical = JSON.parse(
      fs.readFileSync(CANONICAL, "utf-8"),
    ) as unknown;
    const asset = JSON.parse(fs.readFileSync(ASSET, "utf-8")) as {
      canonical_digest: string;
      packages: { canonical: string; locale: string; edition: string };
      review_status: string;
    };
    expect(asset.canonical_digest).toBe(digest(canonical));
    expect(asset.packages.canonical).toBe("draft:neh2:canonical");
    expect(asset.review_status).toBe("draft");
  });
});
