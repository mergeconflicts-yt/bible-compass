import * as fs from "fs";
import * as path from "path";
import { parseOpenBibleForNeh2 } from "../src/parser";

// Committed synthetic fixture (R1-A): hermetic on clean clones without the
// git-ignored production quarantine. Production defaults in src/parser.ts
// are unchanged.
const FIXTURE = {
  quarantinePath: path.join(__dirname, "fixtures", "ancient-synthetic.jsonl"),
  expectedSha256:
    "sha256:d7a086469c66284a929c0d2a38391a2141d607f31925e257b17fe0f43a799017",
  releaseKey: "release:source:openbible:geocoding@fixture:sha-d7a08646",
};

describe("Task 14 — OpenBible geographic adapter (Nehemiah 2)", () => {
  it("re-verifies SHA before parsing", () => {
    expect(fs.existsSync(FIXTURE.quarantinePath)).toBe(true);
    const r = parseOpenBibleForNeh2(FIXTURE);
    expect(r.receipt.sha256).toBe(FIXTURE.expectedSha256);
    expect(r.receipt.byteSize).toBe(175);
  });

  it("competing locations remain separate candidates", () => {
    const { modernSites } = parseOpenBibleForNeh2(FIXTURE);
    const jerusalemSites = modernSites.filter(
      (m) => m.ancientPlaceId === "openbible:ancient:jerusalem",
    );
    expect(jerusalemSites).toHaveLength(2);
    expect(jerusalemSites[0].modernSiteId).not.toBe(
      jerusalemSites[1].modernSiteId,
    );
    expect(jerusalemSites[0].geometry.coordinates).not.toEqual(
      jerusalemSites[1].geometry.coordinates,
    );
  });

  it("geometry records CRS, precision, period, evidence, component license", () => {
    const { modernSites } = parseOpenBibleForNeh2(FIXTURE);
    for (const m of modernSites) {
      expect(m.geometry.crs).toBe("EPSG:4326");
      expect([
        "exact_site",
        "approximate",
        "area",
        "candidates",
        "unknown",
      ]).toContain(m.geometry.precision);
      expect(m.geometry.period).toBeTruthy();
      expect(m.geometry.evidence).toMatch(/OpenBible source:/);
      expect(m.geometry.componentLicense).toBe("CC-BY-4.0");
    }
  });

  it("source confidence is distinct from Bible Compass review status", () => {
    const { ancientPlaces, modernSites } = parseOpenBibleForNeh2(FIXTURE);
    for (const a of ancientPlaces) {
      expect(a.confidence).toBeDefined();
      expect(a.reviewStatus).toBe("draft");
      // Source confidence is not reviewStatus
      expect(a.confidence).not.toBe(a.reviewStatus as unknown as string);
    }
    for (const m of modernSites) {
      expect(m.sourceConfidence).toBeDefined();
      // Source confidence high/medium vs reviewStatus draft
    }
  });

  it("excluded asset/OSM/Scripture fields cannot enter output", () => {
    const { rejects, modernSites, ancientPlaces } =
      parseOpenBibleForNeh2(FIXTURE);
    const all = JSON.stringify({ modernSites, ancientPlaces });
    expect(all).not.toMatch(/image\.jsonl|openstreetmap|ESV/);
    expect(rejects.some((r) => r.reason.includes("image"))).toBe(true);
    expect(rejects.some((r) => r.reason.includes("OSM"))).toBe(true);
    expect(rejects.some((r) => r.reason.includes("ESV"))).toBe(true);
  });

  it("does not choose a winning location", () => {
    const { modernSites } = parseOpenBibleForNeh2(FIXTURE);
    // No field like winningLocation or selected
    const json = JSON.stringify(modernSites);
    expect(json).not.toMatch(/winning|selected|established.*location/i);
  });

  it("does not merge ancient and modern places", () => {
    const { ancientPlaces, modernSites } = parseOpenBibleForNeh2(FIXTURE);
    for (const m of modernSites) {
      expect(
        ancientPlaces.some((a) => a.ancientPlaceId === m.ancientPlaceId),
      ).toBe(true);
      expect(m.modernSiteId).not.toBe(m.ancientPlaceId);
    }
  });

  it("fails on SHA mismatch", () => {
    const buf = fs.readFileSync(FIXTURE.quarantinePath);
    const tmp = "/tmp/openbible-tampered.jsonl";
    fs.writeFileSync(tmp, Buffer.concat([buf, Buffer.from("x")]));
    expect(() =>
      parseOpenBibleForNeh2({
        quarantinePath: tmp,
        expectedSha256: FIXTURE.expectedSha256,
      }),
    ).toThrow(/SHA mismatch/);
  });

  it("deterministic output", () => {
    const r1 = parseOpenBibleForNeh2(FIXTURE);
    const r2 = parseOpenBibleForNeh2(FIXTURE);
    expect(r1.receipt.candidatesSha256).toBe(r2.receipt.candidatesSha256);
  });

  it("coverage reports competing locations", () => {
    const { coverage } = parseOpenBibleForNeh2(FIXTURE);
    expect(coverage.competingLocations).toBe(2);
    expect(coverage.produced.ancient).toBe(2);
    expect(coverage.produced.modern).toBe(3);
  });
});
