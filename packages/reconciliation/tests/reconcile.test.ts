import { reconcile15A } from "../src/reconcile";

describe("Task 15A — Identity and attestation reconciliation", () => {
  it("every proposal traces to source releases and mapping decisions", () => {
    const r = reconcile15A();
    for (const m of r.mappings) {
      expect(m.sourceReleaseKey).toMatch(/^release:source:/);
      expect(m.evidence.length).toBeGreaterThan(0);
    }
    for (const a of r.attestations) {
      expect(a.sourceReleaseKey).toMatch(/^release:source:stepbible:tipnr@/);
      expect(a.sourceLocator).toMatch(/^TIPNR:/);
    }
  });

  it("identity and attestation decisions are separate atomic outputs", () => {
    const r = reconcile15A();
    expect(r.mappings.length).toBeGreaterThan(0);
    expect(r.attestations.length).toBeGreaterThan(0);
    // Mappings and attestations are separate arrays, not conflated
    expect(r.mappings[0]).not.toHaveProperty("kind");
    expect(r.attestations[0]).not.toHaveProperty("mappingState");
  });

  it("a canonical attestation can exist without an English surface mention (translation-independent)", () => {
    const r = reconcile15A();
    // Attestations are canonical (translation-independent) — they exist even if no edition mention yet
    const att = r.attestations.find(
      (a) => a.entityKey === "entity:susa-citadel",
    );
    expect(att?.explicitness).toBe("strongly_implied");
    expect(att?.referenceUnit).toBe("Neh.2.1");
  });

  it("counts and reverse links are generated only from approved atomic fixtures in tests (not from unresolved)", () => {
    const r = reconcile15A();
    // Unresolved should not be counted as occurrence
    const unresolvedCount = r.unresolved.length;
    const totalMappings = r.mappings.length;
    expect(unresolvedCount).toBe(1);
    expect(totalMappings).toBe(8);
    // Attestations count is 4, not including unresolved
    expect(r.attestations).toHaveLength(4);
  });

  it("distinct homonyms remain separate, not merged by name equality", () => {
    const r = reconcile15A();
    const distinct = r.mappings.find((m) => m.mappingState === "distinct");
    expect(distinct?.upstreamId).toBe("tipnr:person:unknown-homonym:999");
    expect(distinct?.canonicalEntityKey).toBeNull();
  });

  it("relevant-but-not-attested is separate from attestation", () => {
    const r = reconcile15A();
    const relevantNotAttested = r.relevances.find(
      (rel) => rel.entityKey === "entity:hanani-brother",
    );
    expect(relevantNotAttested?.isAttested).toBe(false);
    expect(relevantNotAttested?.importance).toBe("background");
    // Hanani has relevance but no attestation in Neh2
    const hasAttestation = r.attestations.some(
      (a) => a.entityKey === "entity:hanani-brother",
    );
    expect(hasAttestation).toBe(false);
  });

  it("is deterministic", () => {
    const r1 = reconcile15A();
    const r2 = reconcile15A();
    expect(r1.receipt.candidatesSha256).toBe(r2.receipt.candidatesSha256);
  });

  it("omitted sources remain explicit and not interpreted as negative evidence", () => {
    const r = reconcile15A();
    // BibleData Place is missing_in_bibledata in 12, here we still have Jerusalem mapping via OpenBible, but BibleData missing is not counted as not attested
    expect(r.coverage.mappings).toBe(8);
    expect(r.coverage.unresolved).toBe(1);
  });
});
