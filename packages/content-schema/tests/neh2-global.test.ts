import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  validateCanonicalPackage,
  validateEditionPackage,
  validateLocalePackage,
} from "../src/validators";
import type { PackageJobContext } from "../src/packages";

// Global integrity validation for the Task EN-01 Nehemiah 2 reference dataset.
// Unlike per-file checks, this validates the three packages together: exact
// canonical dependency linkage, deterministic digest, globally unique and
// deterministic keys, BSB selector resolution, provenance, and honest coverage.

const REPO = path.resolve(__dirname, "../../..");
const NEH2 = path.join(REPO, "content", "nehemiah-2");
const BSB_NEH = path.join(REPO, "apps/mobile/assets/scripture/bsb/Neh.json");

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function stable(value: any): any {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}

function digest(pkg: any): string {
  const text = JSON.stringify(stable(pkg));
  return (
    "sha256:" + crypto.createHash("sha256").update(text, "utf8").digest("hex")
  );
}

function bsbNeh2Text(): Record<string, string> {
  const data = readJson(BSB_NEH);
  const chapter = (data.chapters as any[]).find((c) => c.n === 2);
  const texts: Record<string, string> = {};
  for (const block of chapter.blocks) {
    if (block.t === "v") texts[`verse:Neh.2.${block.n}`] = block.text;
  }
  return texts;
}

function recordKeys(
  namespace: string,
  records: any[],
  field: string,
): string[] {
  return records.map((r) => r[field]);
}

export function checkGlobalNeh2(dataset: {
  canonical: any;
  edition: any;
  locale: any;
  catalog: any;
  bsb: Record<string, string>;
}): void {
  const { canonical, edition, locale, catalog, bsb } = dataset;
  const fail = (msg: string): never => {
    throw new Error(msg);
  };

  // 1. exact canonical dependency
  const canonicalDigest = digest(canonical);
  for (const [name, pkg] of [
    ["edition", edition],
    ["locale", locale],
  ] as const) {
    if (pkg.dependencies.length !== 1) fail(`${name}: expected one dependency`);
    const dep = pkg.dependencies[0];
    if (dep.package_key !== canonical.package_key)
      fail(
        `${name}: dependency ${dep.package_key} != canonical ${canonical.package_key}`,
      );
    if (dep.revision !== 1)
      fail(`${name}: dependency revision ${dep.revision}`);
    if (dep.digest !== canonicalDigest)
      fail(
        `${name}: dependency digest ${dep.digest} != canonical ${canonicalDigest}`,
      );
  }

  // 2. dotted versions / draft everywhere
  for (const [name, pkg] of [
    ["canonical", canonical],
    ["edition", edition],
    ["locale", locale],
  ] as const) {
    for (const field of ["contract_version", "schema_version"]) {
      if (pkg[field] !== "2.0.0") fail(`${name}: ${field}=${pkg[field]}`);
    }
    if (pkg.review_status !== "draft") fail(`${name}: review_status not draft`);
  }
  const allRecords: any[] = [
    ...canonical.records.entity_candidates,
    ...canonical.records.claims,
    ...canonical.records.citations,
    ...canonical.records.attestations,
    ...canonical.records.relationships,
    ...canonical.records.events,
    ...canonical.records.places,
    ...canonical.records.relevance,
    ...edition.records.mentions,
    ...locale.records.entity_profiles,
    ...locale.records.passage_contexts,
    ...locale.records.relevance_localizations,
  ];
  for (const record of allRecords) {
    if (record.review_status !== "draft")
      fail(`record not draft: ${JSON.stringify(record).slice(0, 60)}`);
  }

  // 3. globally unique, deterministic keys per namespace
  const namespaces: [string, string[]][] = [
    [
      "candidate",
      recordKeys(
        "candidate",
        canonical.records.entity_candidates,
        "candidate_key",
      ),
    ],
    ["claim", recordKeys("claim", canonical.records.claims, "claim_key")],
    [
      "citation",
      recordKeys("citation", canonical.records.citations, "citation_key"),
    ],
    [
      "attestation",
      recordKeys(
        "attestation",
        canonical.records.attestations,
        "attestation_key",
      ),
    ],
    [
      "relationship",
      recordKeys(
        "relationship",
        canonical.records.relationships,
        "relationship_key",
      ),
    ],
    ["event", recordKeys("event", canonical.records.events, "event_key")],
    [
      "relevance",
      recordKeys("relevance", canonical.records.relevance, "relevance_key"),
    ],
    ["mention", recordKeys("mention", edition.records.mentions, "mention_key")],
    [
      "profile",
      recordKeys("profile", locale.records.entity_profiles, "profile_key"),
    ],
    [
      "context",
      recordKeys("context", locale.records.passage_contexts, "context_key"),
    ],
    [
      "localization",
      recordKeys(
        "localization",
        locale.records.relevance_localizations,
        "localization_key",
      ),
    ],
  ];
  for (const [name, keys] of namespaces) {
    const seen = new Set<string>();
    for (const key of keys) {
      if (seen.has(key)) fail(`${name}: duplicate key ${key}`);
      seen.add(key);
    }
  }

  // 4. entity identity consistency
  const entityKeys = new Set(
    canonical.records.reconciliation_records.map(
      (r: any) => r.canonical_entity_key,
    ),
  );
  const candidateKeys = new Set(
    canonical.records.entity_candidates.map((c: any) => c.candidate_key),
  );
  for (const rec of canonical.records.reconciliation_records) {
    if (!candidateKeys.has(rec.candidate_key))
      fail(`reconciliation for unknown candidate ${rec.candidate_key}`);
  }
  const referenced: string[] = [
    ...canonical.records.attestations.map((a: any) => a.entity_key),
    ...canonical.records.relationships.flatMap((r: any) => [
      r.subject_entity_key,
      r.object_entity_key,
    ]),
    ...canonical.records.events.flatMap((e: any) => [
      ...e.participant_entity_keys,
      ...e.place_entity_keys,
    ]),
    ...canonical.records.places.map((p: any) => p.entity_key),
    ...canonical.records.relevance.map((r: any) => r.entity_key),
    ...edition.records.mentions.map((m: any) => m.target.key),
    ...locale.records.entity_profiles.map((p: any) => p.entity_key),
    ...locale.records.relevance_localizations.map((l: any) => l.entity_key),
  ];
  for (const key of referenced) {
    if (!entityKeys.has(key)) fail(`unresolved entity reference ${key}`);
  }

  // 5. mention keys carry edition and complete verse identity
  const mentionPattern = /^mention:bsb-neh-2-\d+:[a-z0-9-]+$/;
  for (const mention of edition.records.mentions) {
    if (!mentionPattern.test(mention.mention_key))
      fail(`mention key lacks edition/verse identity: ${mention.mention_key}`);
  }

  // 6. BSB selectors resolve to the correct occurrence
  for (const mention of edition.records.mentions) {
    const text = bsb[mention.verse_key];
    if (text === undefined)
      fail(`mention verse missing from BSB: ${mention.verse_key}`);
    const { exact_quote, occurrence_ordinal, prefix, suffix } =
      mention.selector;
    let index = -1;
    let seen = 0;
    for (
      let i = text.indexOf(exact_quote);
      i !== -1;
      i = text.indexOf(exact_quote, i + 1)
    ) {
      seen += 1;
      if (seen === occurrence_ordinal) {
        index = i;
        break;
      }
    }
    if (index === -1)
      fail(
        `${mention.mention_key}: quote ${exact_quote} ordinal ${occurrence_ordinal} not in ${mention.verse_key}`,
      );
    const actualPrefix = text.slice(Math.max(0, index - 20), index);
    const actualSuffix = text.slice(
      index + exact_quote.length,
      index + exact_quote.length + 20,
    );
    if (actualPrefix !== prefix || actualSuffix !== suffix)
      fail(`${mention.mention_key}: prefix/suffix mismatch`);
  }

  // 7. provenance: citations and place evidence resolve to the catalog
  const catalogKeys = new Set(
    catalog.items.map((i: any) => i.evidence_item_key),
  );
  for (const citation of canonical.records.citations) {
    if (!catalogKeys.has(citation.evidence_item_key))
      fail(
        `citation ${citation.citation_key} cites unsigned evidence ${citation.evidence_item_key}`,
      );
  }
  for (const place of canonical.records.places) {
    for (const position of place.geographic_positions) {
      if (!catalogKeys.has(position.evidence_item_key))
        fail(
          `place ${place.entity_key} cites unsigned evidence ${position.evidence_item_key}`,
        );
    }
  }

  // 8. claims carry citations; citations resolve claims
  const claimKeys = new Set(
    canonical.records.claims.map((c: any) => c.claim_key),
  );
  const citationKeys = new Set(
    canonical.records.citations.map((c: any) => c.citation_key),
  );
  for (const claim of canonical.records.claims) {
    if (claim.citation_keys.length < 1)
      fail(`claim ${claim.claim_key} has no citation`);
    for (const key of claim.citation_keys)
      if (!citationKeys.has(key))
        fail(`claim ${claim.claim_key} -> missing citation ${key}`);
  }
  for (const citation of canonical.records.citations) {
    for (const key of citation.claim_keys)
      if (!claimKeys.has(key))
        fail(`citation ${citation.citation_key} -> missing claim ${key}`);
  }

  // 9. profiles are not duplicated
  const profileEntities = locale.records.entity_profiles.map(
    (p: any) => p.entity_key,
  );
  if (new Set(profileEntities).size !== profileEntities.length)
    fail("duplicate entity profile");

  // 10. coverage honesty: no complete_zero for unprocessed work
  const coverageBlocks = [
    ...canonical.coverage,
    ...edition.coverage,
    ...locale.coverage,
  ];
  for (const block of coverageBlocks) {
    for (const group of block.groups) {
      if (group.result === "complete_zero" && group.record_keys.length > 0)
        fail(`contradictory complete_zero in ${block.annotation_class}`);
    }
  }
  const canonicalResults = canonical.coverage[0].groups.map(
    (g: any) => g.result,
  );
  const editionResults = edition.coverage[0].groups.map((g: any) => g.result);
  if (!canonicalResults.includes("incomplete"))
    fail("canonical coverage does not report incomplete work");
  if (!editionResults.includes("incomplete"))
    fail("edition coverage does not report incomplete work");
}

const dataset = {
  canonical: readJson(path.join(NEH2, "canonical.v2.json")),
  edition: readJson(path.join(NEH2, "edition-bsb.v2.json")),
  locale: readJson(path.join(NEH2, "locale-en.v2.json")),
  catalog: readJson(path.join(NEH2, "evidence-catalog.json")),
  bsb: bsbNeh2Text(),
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function context(): {
  canonical: PackageJobContext;
  edition: PackageJobContext;
  locale: PackageJobContext;
} {
  const canonicalPayload = dataset.canonical;
  const evidenceItemKeys = dataset.catalog.items.map(
    (i: any) => i.evidence_item_key,
  );
  const claimKeys = canonicalPayload.records.claims.map(
    (c: any) => c.claim_key,
  );
  const attestationKeys = canonicalPayload.records.attestations.map(
    (a: any) => a.attestation_key,
  );
  const entityKeys = canonicalPayload.records.reconciliation_records.map(
    (r: any) => r.canonical_entity_key,
  );
  const relevanceKeys = canonicalPayload.records.relevance.map(
    (r: any) => r.relevance_key,
  );
  return {
    canonical: {
      canonKeys: ["canon:prot-66"],
      referenceSystemKeys: ["refsys:eng-v22"],
      evidenceItemKeys,
      authoritativeReferenceKeys: canonicalPayload.scope.reference_keys,
      authoritativeScopeKeys: canonicalPayload.scope.scope_keys,
    },
    edition: {
      canonKeys: ["canon:prot-66"],
      referenceSystemKeys: ["refsys:eng-v22"],
      evidenceItemKeys: [],
      languageTags: ["en"],
      translationEditionKeys: [dataset.edition.scope.translation_edition_key],
      approvedClaimKeys: claimKeys,
      approvedAttestationKeys: attestationKeys,
      authoritativeReferenceKeys: dataset.edition.scope.reference_keys,
    },
    locale: {
      canonKeys: ["canon:prot-66"],
      referenceSystemKeys: ["refsys:eng-v22"],
      evidenceItemKeys: [],
      languageTags: ["en"],
      approvedEntityKeys: entityKeys,
      approvedClaimKeys: claimKeys,
      approvedRelevanceKeys: relevanceKeys,
      authoritativeScopeKeys: dataset.locale.scope.scope_keys,
    },
  };
}

describe("Nehemiah 2 reference dataset — global integrity", () => {
  it("validates all three packages together with full context", () => {
    const ctx = context();
    validateCanonicalPackage(dataset.canonical, ctx.canonical);
    validateEditionPackage(dataset.edition, ctx.edition);
    validateLocalePackage(dataset.locale, ctx.locale);
    checkGlobalNeh2(dataset);
  });

  it("is deterministic: the recorded canonical digest matches recomputation", () => {
    expect(dataset.edition.dependencies[0].digest).toBe(
      digest(dataset.canonical),
    );
    expect(dataset.locale.dependencies[0].digest).toBe(
      digest(dataset.canonical),
    );
  });

  it("keeps the three layers separate", () => {
    expect(dataset.canonical.scope.language_tag).toBeNull();
    expect(dataset.canonical.scope.translation_edition_key).toBeNull();
    expect(dataset.edition.scope.language_tag).toBe("en");
    expect(dataset.edition.scope.translation_edition_key).toBe(
      "edition:bsb@20260912:sha-b2898c49",
    );
    expect(dataset.locale.scope.language_tag).toBe("en");
    expect(dataset.locale.scope.translation_edition_key).toBeNull();
  });
});

describe("Nehemiah 2 reference dataset — invalid mutations are rejected", () => {
  it("rejects a mention whose quote does not resolve", () => {
    const bad = clone(dataset);
    bad.edition.records.mentions[0].selector.exact_quote = "zzzz-not-in-text";
    expect(() => checkGlobalNeh2(bad)).toThrow(/not in verse/);
  });

  it("rejects a mention key without edition and verse identity", () => {
    const bad = clone(dataset);
    bad.edition.records.mentions[0].mention_key = "mention:artaxerxes";
    expect(() => checkGlobalNeh2(bad)).toThrow(/edition\/verse/);
  });

  it("rejects a broken canonical dependency digest", () => {
    const bad = clone(dataset);
    bad.locale.dependencies[0].digest =
      "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    expect(() => checkGlobalNeh2(bad)).toThrow(/dependency digest/);
  });

  it("rejects a duplicated entity profile", () => {
    const bad = clone(dataset);
    bad.locale.records.entity_profiles.push(
      bad.locale.records.entity_profiles[0],
    );
    expect(() => checkGlobalNeh2(bad)).toThrow(
      /duplicate key|duplicate entity profile/,
    );
  });

  it("rejects coverage that claims complete_zero over unprocessed work", () => {
    const bad = clone(dataset);
    bad.canonical.coverage[0].groups[0].result = "complete_zero";
    // keep dependency linkage intact so the coverage check itself is exercised
    bad.edition.dependencies[0].digest = digest(bad.canonical);
    bad.locale.dependencies[0].digest = digest(bad.canonical);
    expect(() => checkGlobalNeh2(bad)).toThrow(/complete_zero/);
  });
});
