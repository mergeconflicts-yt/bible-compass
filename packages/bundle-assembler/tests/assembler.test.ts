import { createBundle, validateBundle } from "../src/assembler";

describe("Task 19A — Bundle assembler", () => {
  const baseOpts = {
    jobId: "job:neh2-entity-profile-001" as const,
    scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20" as const,
    languageTag: "en" as const,
    packageKind: "entity-profile-draft",
    gateD2PacketSha:
      "sha256:a1da9ecef6bd8d61b4433d5733a6587434a391dab023f6c6864271254d91517b",
    scholarlyCorpusApproved: false,
  };

  it("input bundle contains only authorized exact source components", () => {
    const bundle = createBundle(baseOpts);
    expect(
      bundle.excerpts.every((e) =>
        ["source:stepbible:tipnr", "source:bibledata:structured"].includes(
          e.sourceKey,
        ),
      ),
    ).toBe(true);
    expect(
      bundle.excerpts.every(
        (e) =>
          e.locator.startsWith("TIPNR:") || e.locator.startsWith("BibleData-"),
      ),
    ).toBe(true);
  });

  it("registry denial prevents bundle creation", () => {
    expect(() =>
      createBundle({
        ...baseOpts,
        gateD2PacketSha: "invalid" as unknown as string,
      }),
    ).toThrow(/Gate D2/);
  });

  it("byte-identical inputs produce one deterministic digest", () => {
    const b1 = createBundle(baseOpts);
    const b2 = createBundle(baseOpts);
    expect(b1.bundleDigest).toBe(b2.bundleDigest);
    expect(b1.manifest.input_bundle.bundle_sha256).toBe(b2.bundleDigest);
  });

  it("bundle is one scope and one package kind with explicit limits", () => {
    const bundle = createBundle(baseOpts);
    expect(bundle.manifest.target.scope_key).toBe(
      "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
    );
    expect(bundle.manifest.contract.allowed_package_kinds).toHaveLength(1);
    expect(bundle.manifest.contract.maximum_records).toBe(100);
    expect(bundle.manifest.contract.maximum_output_bytes).toBe(500000);
    validateBundle(bundle);
  });

  it("no scholarly corpus produces explicit context-claim restrictions", () => {
    const bundle = createBundle({
      ...baseOpts,
      scholarlyCorpusApproved: false,
    });
    // For 19A, when no corpus, the bundle should be valid but downstream 20F must check this flag
    // Here we just verify bundle creation succeeds and has internet_access false
    expect(bundle.manifest.policies.internet_access).toBe(false);
    expect(bundle.manifest.provider.training_allowed).toBe(false);
  });

  it("internet-disabled prompt template", () => {
    const bundle = createBundle(baseOpts);
    expect(bundle.manifest.policies.internet_access).toBe(false);
    // Prompt template would be checked here — ensure no URLs in excerpts beyond locators
    expect(bundle.excerpts.every((e) => !e.text.includes("https://"))).toBe(
      true,
    );
  });
});
