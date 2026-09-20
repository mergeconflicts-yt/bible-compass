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
// deterministic keys, BSB selector resolution, provenance locators against the
// underlying sources, and honest coverage. Types mirror the contract fields the
// test reads; no `any` is used.

const REPO = path.resolve(__dirname, "../../..");
const NEH2 = path.join(REPO, "content", "nehemiah-2");
const BSB_DIR = path.join(REPO, "apps/mobile/assets/scripture/bsb");
const QUARANTINE = path.join(REPO, "content", "quarantine");
const EDITION_SLUG = "bsb-20260912-sha-b2898c49";

interface EvidenceItem {
  evidence_item_key: string;
  source_key: string;
  release_key: string;
  kind: string;
  locator: string;
  note: string;
}
interface EvidenceCatalog {
  catalog_version: string;
  data_classification: string;
  items: EvidenceItem[];
}
interface Dependency {
  package_key: string;
  revision: number;
  digest: string;
}
interface ScopeBlock {
  canon_key: string;
  reference_system_key: string;
  scope_keys: string[];
  reference_keys: string[];
  language_tag: string | null;
  translation_edition_key: string | null;
}
interface TypedRef {
  type: string;
  key?: string;
  value?: string;
}
interface CoverageGroup {
  result: string;
  reference_keys?: string[];
  scope_keys?: string[];
  record_keys: string[];
  blocker_question_keys: string[];
}
interface CoverageBlock {
  annotation_class: string;
  groups: CoverageGroup[];
}
interface EntityCandidate {
  candidate_key: string;
  entity_type: string;
  proposed_label: string;
  resolution_status: string;
  review_status: string;
}
interface Reconciliation {
  candidate_key: string;
  canonical_entity_key: string;
  resolution_status: string;
  review_status: string;
}
interface Claim {
  claim_key: string;
  subject: TypedRef;
  predicate: string;
  object: TypedRef;
  evidence_status: string;
  textual_basis: string;
  citation_keys: string[];
  review_status: string;
}
interface Citation {
  citation_key: string;
  claim_keys: string[];
  evidence_item_key: string;
  stance: string;
  evidence_form: string;
  review_status: string;
}
interface Attestation {
  attestation_key: string;
  reference_key: string;
  entity_key: string;
  kind: string;
  textual_basis: string;
  identification_status: string;
  claim_keys: string[];
  review_status: string;
}
interface Relationship {
  relationship_key: string;
  subject_entity_key: string;
  predicate_key: string;
  object_entity_key: string;
  applicable_scope_keys: string[];
  claim_keys: string[];
  review_status: string;
}
interface EventRecord {
  event_key: string;
  event_type: string;
  participant_entity_keys: string[];
  place_entity_keys: string[];
  scripture_accounts: { scope_key: string; relation: string }[];
  claim_keys: string[];
  review_status: string;
}
interface PlaceRecord {
  entity_key: string;
  geographic_positions: {
    evidence_item_key: string;
    precision: string;
    claim_keys: string[];
  }[];
  review_status: string;
}
interface Relevance {
  relevance_key: string;
  scope_key: string;
  entity_key: string;
  importance: string;
  is_attested: boolean;
  claim_keys: string[];
  review_status: string;
}
interface CanonicalRecords {
  entity_candidates: EntityCandidate[];
  claims: Claim[];
  citations: Citation[];
  attestations: Attestation[];
  relationships: Relationship[];
  events: EventRecord[];
  places: PlaceRecord[];
  relevance: Relevance[];
  reconciliation_records: Reconciliation[];
}
interface OpenQuestion {
  question_key: string;
  question_type: string;
  record_key: string;
  field_path: string;
  question: string;
  blocks_publication: boolean;
}
interface CanonicalPackage {
  contract_version: string;
  schema_version: string;
  package_key: string;
  review_status: string;
  scope: ScopeBlock;
  dependencies: Dependency[];
  records: CanonicalRecords;
  coverage: CoverageBlock[];
  open_questions: OpenQuestion[];
  editorial_observations: { code: string; note?: string }[];
}
interface Mention {
  mention_key: string;
  verse_key: string;
  attestation_key: string;
  target: { type: string; key: string };
  mention_form: string;
  selector: {
    exact_quote: string;
    occurrence_ordinal: number;
    prefix: string;
    suffix: string;
  };
  claim_keys: string[];
  review_status: string;
}
interface EditionPackage {
  contract_version: string;
  schema_version: string;
  package_key: string;
  review_status: string;
  scope: ScopeBlock;
  dependencies: Dependency[];
  records: { mentions: Mention[] };
  coverage: CoverageBlock[];
  open_questions: OpenQuestion[];
  editorial_observations: { code: string; note?: string }[];
}
interface Profile {
  profile_key: string;
  entity_key: string;
  language_tag: string;
  preferred_name: string;
  aliases: string[];
  short_description: { text: string; claim_keys: string[] };
  extended_description: { text: string; claim_keys: string[] } | null;
  review_status: string;
}
interface OrientationSection {
  text: string | null;
  claim_keys: string[];
  open_question_key: string | null;
}
interface PassageContext {
  context_key: string;
  scope_key: string;
  language_tag: string;
  orientation: Record<string, OrientationSection>;
  review_status: string;
}
interface RelevanceLocalization {
  localization_key: string;
  relevance_key: string;
  scope_key: string;
  entity_key: string;
  language_tag: string;
  role_text: string;
  claim_keys: string[];
  review_status: string;
}
interface LocalePackage {
  contract_version: string;
  schema_version: string;
  package_key: string;
  review_status: string;
  scope: ScopeBlock;
  dependencies: Dependency[];
  records: {
    entity_profiles: Profile[];
    passage_contexts: PassageContext[];
    relevance_localizations: RelevanceLocalization[];
  };
  coverage: CoverageBlock[];
  open_questions: OpenQuestion[];
  editorial_observations: { code: string; note?: string }[];
}
interface Dataset {
  canonical: CanonicalPackage;
  edition: EditionPackage;
  locale: LocalePackage;
  catalog: EvidenceCatalog;
  bsb: Record<string, string>;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

function readTextIfExists(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : null;
}

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

function digest(pkg: unknown): string {
  const text = JSON.stringify(stable(pkg));
  return (
    "sha256:" + crypto.createHash("sha256").update(text, "utf8").digest("hex")
  );
}

function bsbBookText(book: string): Record<string, string> {
  const data = readJson<{
    chapters: {
      n: number;
      blocks: { t: string; n?: number; text: string }[];
    }[];
  }>(path.join(BSB_DIR, `${book}.json`));
  const verses: Record<string, string> = {};
  for (const chapter of data.chapters) {
    for (const block of chapter.blocks) {
      if (block.t === "v" && block.n !== undefined) {
        verses[`verse:${book}.${chapter.n}.${block.n}`] = block.text;
      }
    }
  }
  return verses;
}

function recordField<T>(records: T[], field: keyof T): string[] {
  return records.map((record) => String(record[field]));
}

function scopeVerseRange(scope: string): [number, number] {
  const match = scope.match(/:Neh\.2\.(\d+)-Neh\.2\.(\d+)$/);
  if (!match) return [1, 20];
  return [Number(match[1]), Number(match[2])];
}

function verifyLocators(catalog: EvidenceCatalog): number {
  let verified = 0;
  for (const item of catalog.items) {
    if (item.source_key === "source:bsb:edition") {
      const parts = item.locator.split(".");
      if (parts.length !== 3)
        throw new Error(`bad scripture locator ${item.locator}`);
      const [book, chapter, verse] = parts;
      const verses = bsbBookText(book);
      const key = `verse:${book}.${chapter}.${verse}`;
      if (verses[key] === undefined)
        throw new Error(
          `evidence ${item.evidence_item_key}: ${item.locator} not in bundled BSB`,
        );
      verified += 1;
      continue;
    }
    if (item.source_key === "source:stepbible:tipnr") {
      const text = readTextIfExists(
        path.join(QUARANTINE, "stepbible/tipnr/TIPNR.txt"),
      );
      if (text !== null) {
        if (!text.includes(item.locator))
          throw new Error(
            `evidence ${item.evidence_item_key}: locator ${item.locator} not in TIPNR`,
          );
        verified += 1;
      }
      continue;
    }
    if (item.source_key === "source:bibledata:structured") {
      const text = readTextIfExists(
        path.join(QUARANTINE, "bibledata/BibleData-Person.csv"),
      );
      if (text !== null) {
        if (!text.includes(item.locator))
          throw new Error(
            `evidence ${item.evidence_item_key}: locator ${item.locator} not in BibleData`,
          );
        verified += 1;
      }
      continue;
    }
    if (item.source_key === "source:openbible:geocoding") {
      const text = readTextIfExists(
        path.join(QUARANTINE, "openbible/ancient.jsonl"),
      );
      if (text !== null) {
        if (!text.includes(`"id":"${item.locator}"`))
          throw new Error(
            `evidence ${item.evidence_item_key}: locator ${item.locator} not in OpenBible`,
          );
        verified += 1;
      }
      continue;
    }
    throw new Error(`unrecognised evidence source ${item.source_key}`);
  }
  return verified;
}

export function checkGlobalNeh2(dataset: Dataset): void {
  const { canonical, edition, locale, catalog, bsb } = dataset;
  const fail = (msg: string): never => {
    throw new Error(msg);
  };

  // 1. exact canonical dependency + deterministic digest
  const canonicalDigest = digest(canonical);
  for (const [name, pkg] of [
    ["edition", edition],
    ["locale", locale],
  ] as const) {
    if (pkg.dependencies.length !== 1) fail(`${name}: expected one dependency`);
    const dep = pkg.dependencies[0]!;
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

  // 2. versions and draft status everywhere
  for (const [name, pkg] of [
    ["canonical", canonical],
    ["edition", edition],
    ["locale", locale],
  ] as const) {
    if (pkg.contract_version !== "2.0.0" || pkg.schema_version !== "2.0.0")
      fail(`${name}: version drift`);
    if (pkg.review_status !== "draft") fail(`${name}: review_status not draft`);
  }
  const allRecords: { review_status: string }[] = [
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
    if (record.review_status !== "draft") fail("a record is not draft");
  }

  // 3. globally unique, deterministic keys per namespace
  const namespaces: [string, string[]][] = [
    [
      "candidate",
      recordField(canonical.records.entity_candidates, "candidate_key"),
    ],
    ["claim", recordField(canonical.records.claims, "claim_key")],
    ["citation", recordField(canonical.records.citations, "citation_key")],
    [
      "attestation",
      recordField(canonical.records.attestations, "attestation_key"),
    ],
    [
      "relationship",
      recordField(canonical.records.relationships, "relationship_key"),
    ],
    ["event", recordField(canonical.records.events, "event_key")],
    ["relevance", recordField(canonical.records.relevance, "relevance_key")],
    ["mention", recordField(edition.records.mentions, "mention_key")],
    ["profile", recordField(locale.records.entity_profiles, "profile_key")],
    ["context", recordField(locale.records.passage_contexts, "context_key")],
    [
      "localization",
      recordField(locale.records.relevance_localizations, "localization_key"),
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
  const entityTypes = new Map<string, string>();
  const candidateTypes = new Map(
    canonical.records.entity_candidates.map((c) => [
      c.candidate_key,
      c.entity_type,
    ]),
  );
  for (const rec of canonical.records.reconciliation_records) {
    const type = candidateTypes.get(rec.candidate_key);
    if (type === undefined)
      throw new Error(
        `reconciliation for unknown candidate ${rec.candidate_key}`,
      );
    entityTypes.set(rec.canonical_entity_key, type);
  }
  const referenced: string[] = [
    ...canonical.records.attestations.map((a) => a.entity_key),
    ...canonical.records.relationships.flatMap((r) => [
      r.subject_entity_key,
      r.object_entity_key,
    ]),
    ...canonical.records.events.flatMap((e) => [
      ...e.participant_entity_keys,
      ...e.place_entity_keys,
    ]),
    ...canonical.records.places.map((p) => p.entity_key),
    ...canonical.records.relevance.map((r) => r.entity_key),
    ...edition.records.mentions.map((m) => m.target.key),
    ...locale.records.entity_profiles.map((p) => p.entity_key),
    ...locale.records.relevance_localizations.map((l) => l.entity_key),
  ];
  for (const key of referenced) {
    if (!entityTypes.has(key)) fail(`unresolved entity reference ${key}`);
  }

  // 5. mention keys carry the immutable edition and complete verse identity
  const mentionPattern = new RegExp(
    `^mention:${EDITION_SLUG}-neh-2-\\d+:[a-z0-9-]+$`,
  );
  for (const mention of edition.records.mentions) {
    if (!mentionPattern.test(mention.mention_key))
      fail(`mention key lacks edition/verse identity: ${mention.mention_key}`);
  }

  // 6. the central subject is linked in the edition layer
  const nehemiahMentions = edition.records.mentions.filter(
    (m) => m.target.key === "entity:nehemiah-governor",
  );
  if (nehemiahMentions.length < 15)
    fail(`Nehemiah has too few edition mentions (${nehemiahMentions.length})`);
  for (const a of canonical.records.attestations) {
    if (
      a.entity_key === "entity:nehemiah-governor" &&
      a.textual_basis === "explicit"
    )
      fail(
        `Nehemiah attestation ${a.attestation_key} is marked explicit but is a first-person reference`,
      );
  }

  // 7. BSB selectors resolve to the correct occurrence
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

  // 8. proofreading regressions
  const wallClaim = canonical.records.claims.find(
    (c) => c.claim_key === "claim:wall-broken-down",
  );
  if (!wallClaim || wallClaim.predicate !== "broken_down")
    fail("wall claim must state the wall was broken down");
  const gatesClaim = canonical.records.claims.find(
    (c) => c.claim_key === "claim:gates-destroyed-by-fire",
  );
  if (!gatesClaim || gatesClaim.predicate !== "destroyed_by_fire")
    fail("gates claim must state the gates were destroyed by fire");
  if (
    canonical.records.claims.some(
      (c) =>
        c.subject.key === "entity:jerusalem-wall" &&
        c.predicate === "destroyed_by_fire",
    )
  )
    fail("the wall must not be claimed to have been destroyed by fire");

  const godType = entityTypes.get("entity:god-of-heaven");
  if (godType !== "deity")
    fail(`the God of heaven must use the canonical deity type, got ${godType}`);

  const pluralForms = new Set(["us", "we", "our", "ourselves"]);
  for (const mention of edition.records.mentions) {
    if (!pluralForms.has(mention.selector.exact_quote.toLowerCase())) continue;
    const type = entityTypes.get(mention.target.key);
    if (type === "person" || type === "deity")
      fail(
        `plural reference ${mention.mention_key} targets a singular ${type}`,
      );
  }
  const usAt19 = edition.records.mentions.find(
    (m) => m.verse_key === "verse:Neh.2.19" && m.selector.exact_quote === "us",
  );
  if (!usAt19 || usAt19.target.key !== "entity:judean-people")
    fail(
      "Neh.2.19 'us' must target the opposed collective, not a single person",
    );

  const stopOrder = canonical.records.claims.find(
    (c) => c.claim_key === "claim:prior-stop-order",
  );
  const stopOrderEvidence = new Set(
    canonical.records.citations
      .filter(
        (cit) => stopOrder && cit.claim_keys.includes(stopOrder.claim_key),
      )
      .map((cit) => cit.evidence_item_key),
  );
  if (
    !stopOrderEvidence.has("evidence:bsb:ezra-4-21") ||
    !stopOrderEvidence.has("evidence:bsb:ezra-4-23")
  )
    fail("stop-order claim must cite Ezra 4:21 and 4:23");

  // 9. provenance: citations and place evidence resolve to the catalog
  const catalogKeys = new Set(catalog.items.map((i) => i.evidence_item_key));
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

  // 10. claims carry citations; citations resolve claims
  const claimKeys = new Set(canonical.records.claims.map((c) => c.claim_key));
  const citationKeys = new Set(
    canonical.records.citations.map((c) => c.citation_key),
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

  // 11. profiles are not duplicated
  const profileEntities = locale.records.entity_profiles.map(
    (p) => p.entity_key,
  );
  if (new Set(profileEntities).size !== profileEntities.length)
    fail("duplicate entity profile");

  // 12. relevance honesty: is_attested must be true when an attestation exists in scope
  const attestationsByEntity = new Map<string, number[]>();
  for (const a of canonical.records.attestations) {
    const verse = Number(a.reference_key.split(".")[2]);
    const list = attestationsByEntity.get(a.entity_key) ?? [];
    list.push(verse);
    attestationsByEntity.set(a.entity_key, list);
  }
  for (const relevance of canonical.records.relevance) {
    const [start, end] = scopeVerseRange(relevance.scope_key);
    const verses = attestationsByEntity.get(relevance.entity_key) ?? [];
    const inScope = verses.some((v) => v >= start && v <= end);
    if (inScope && !relevance.is_attested)
      fail(
        `relevance ${relevance.relevance_key} is marked unattested but an attestation exists in scope`,
      );
  }

  // 13. events: places must be places, and an uncertain setting must not be asserted
  for (const event of canonical.records.events) {
    for (const placeKey of event.place_entity_keys) {
      const type = entityTypes.get(placeKey);
      if (type !== "place" && type !== "structure")
        fail(`event ${event.event_key} lists ${placeKey} (${type}) as a place`);
    }
  }
  const audience = canonical.records.events.find(
    (e) => e.event_key === "event:audience-with-artaxerxes",
  );
  if (!audience) throw new Error("audience event missing");
  if (
    audience.place_entity_keys.includes("entity:susa") ||
    audience.place_entity_keys.includes("entity:persian-empire")
  )
    fail(
      "audience event asserts a location the package separately records as uncertain",
    );

  // 14. coverage honesty: no complete_zero for unprocessed work
  for (const block of [
    ...canonical.coverage,
    ...edition.coverage,
    ...locale.coverage,
  ]) {
    for (const group of block.groups) {
      if (group.result === "complete_zero" && group.record_keys.length > 0)
        fail(`contradictory complete_zero in ${block.annotation_class}`);
    }
  }
  const canonicalResults = canonical.coverage[0]!.groups.map((g) => g.result);
  const editionResults = edition.coverage[0]!.groups.map((g) => g.result);
  if (!canonicalResults.includes("incomplete"))
    fail("canonical coverage does not report incomplete work");
  if (!editionResults.includes("incomplete"))
    fail("edition coverage does not report incomplete work");

  // 15. provenance locators resolve against the underlying sources
  verifyLocators(catalog);
}

const dataset: Dataset = {
  canonical: readJson<CanonicalPackage>(path.join(NEH2, "canonical.v2.json")),
  edition: readJson<EditionPackage>(path.join(NEH2, "edition-bsb.v2.json")),
  locale: readJson<LocalePackage>(path.join(NEH2, "locale-en.v2.json")),
  catalog: readJson<EvidenceCatalog>(path.join(NEH2, "evidence-catalog.json")),
  bsb: bsbBookText("Neh"),
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function contexts(): {
  canonical: PackageJobContext;
  edition: PackageJobContext;
  locale: PackageJobContext;
} {
  const payload = dataset.canonical;
  const evidenceItemKeys = dataset.catalog.items.map(
    (i) => i.evidence_item_key,
  );
  const claimKeys = payload.records.claims.map((c) => c.claim_key);
  const attestationKeys = payload.records.attestations.map(
    (a) => a.attestation_key,
  );
  const entityKeys = payload.records.reconciliation_records.map(
    (r) => r.canonical_entity_key,
  );
  const relevanceKeys = payload.records.relevance.map((r) => r.relevance_key);
  return {
    canonical: {
      canonKeys: ["canon:prot-66"],
      referenceSystemKeys: ["refsys:eng-v22"],
      evidenceItemKeys,
      authoritativeReferenceKeys: payload.scope.reference_keys,
      authoritativeScopeKeys: payload.scope.scope_keys,
    },
    edition: {
      canonKeys: ["canon:prot-66"],
      referenceSystemKeys: ["refsys:eng-v22"],
      evidenceItemKeys: [],
      languageTags: ["en"],
      translationEditionKeys: [
        dataset.edition.scope.translation_edition_key ?? "",
      ],
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
    const ctx = contexts();
    validateCanonicalPackage(dataset.canonical, ctx.canonical);
    validateEditionPackage(dataset.edition, ctx.edition);
    validateLocalePackage(dataset.locale, ctx.locale);
    checkGlobalNeh2(dataset);
  });

  it("is deterministic: the recorded canonical digest matches recomputation", () => {
    expect(dataset.edition.dependencies[0]!.digest).toBe(
      digest(dataset.canonical),
    );
    expect(dataset.locale.dependencies[0]!.digest).toBe(
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

  it("verifies provenance locators against the underlying source files", () => {
    expect(verifyLocators(dataset.catalog)).toBeGreaterThan(0);
  });
});

describe("Nehemiah 2 reference dataset — invalid mutations are rejected", () => {
  it("rejects a mention whose quote does not resolve", () => {
    const bad = clone(dataset);
    bad.edition.records.mentions[0]!.selector.exact_quote = "zzzz-not-in-text";
    expect(() => checkGlobalNeh2(bad)).toThrow(/not in verse/);
  });

  it("rejects a mention key that omits the immutable edition", () => {
    const bad = clone(dataset);
    bad.edition.records.mentions[0]!.mention_key =
      "mention:bsb-neh-2-1:artaxerxes-i";
    expect(() => checkGlobalNeh2(bad)).toThrow(/edition\/verse/);
  });

  it("rejects a broken canonical dependency digest", () => {
    const bad = clone(dataset);
    bad.locale.dependencies[0]!.digest =
      "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    expect(() => checkGlobalNeh2(bad)).toThrow(/dependency digest/);
  });

  it("rejects a duplicated entity profile", () => {
    const bad = clone(dataset);
    bad.locale.records.entity_profiles.push(
      bad.locale.records.entity_profiles[0]!,
    );
    expect(() => checkGlobalNeh2(bad)).toThrow(
      /duplicate key|duplicate entity profile/,
    );
  });

  it("rejects coverage that claims complete_zero over unprocessed work", () => {
    const bad = clone(dataset);
    bad.canonical.coverage[0]!.groups[0]!.result = "complete_zero";
    bad.edition.dependencies[0]!.digest = digest(bad.canonical);
    bad.locale.dependencies[0]!.digest = digest(bad.canonical);
    expect(() => checkGlobalNeh2(bad)).toThrow(/complete_zero/);
  });

  it("rejects a relevance record that contradicts an in-scope attestation", () => {
    const bad = clone(dataset);
    const target = bad.canonical.records.relevance.find((r) => r.is_attested);
    if (!target) throw new Error("no attested relevance to mutate");
    target.is_attested = false;
    bad.edition.dependencies[0]!.digest = digest(bad.canonical);
    bad.locale.dependencies[0]!.digest = digest(bad.canonical);
    expect(() => checkGlobalNeh2(bad)).toThrow(
      /unattested but an attestation exists/,
    );
  });

  it("rejects the former wall-fire claim error", () => {
    const bad = clone(dataset);
    const wall = bad.canonical.records.claims.find(
      (c) => c.claim_key === "claim:wall-broken-down",
    );
    if (!wall) throw new Error("wall claim missing");
    wall.predicate = "destroyed_by_fire";
    bad.edition.dependencies[0]!.digest = digest(bad.canonical);
    bad.locale.dependencies[0]!.digest = digest(bad.canonical);
    expect(() => checkGlobalNeh2(bad)).toThrow(/broken down/);
  });

  it("rejects the God of heaven typed as person", () => {
    const bad = clone(dataset);
    const rec = bad.canonical.records.reconciliation_records.find(
      (r) => r.canonical_entity_key === "entity:god-of-heaven",
    );
    if (!rec) throw new Error("god-of-heaven reconciliation missing");
    const candidate = bad.canonical.records.entity_candidates.find(
      (c) => c.candidate_key === rec.candidate_key,
    );
    if (!candidate) throw new Error("god-of-heaven candidate missing");
    candidate.entity_type = "person";
    bad.edition.dependencies[0]!.digest = digest(bad.canonical);
    bad.locale.dependencies[0]!.digest = digest(bad.canonical);
    expect(() => checkGlobalNeh2(bad)).toThrow(/deity type/);
  });

  it("rejects a plural reference targeting a single person", () => {
    const bad = clone(dataset);
    const us = bad.edition.records.mentions.find(
      (m) =>
        m.verse_key === "verse:Neh.2.19" && m.selector.exact_quote === "us",
    );
    if (!us) throw new Error("Neh.2.19 'us' mention missing");
    us.target.key = "entity:nehemiah-governor";
    bad.edition.dependencies[0]!.digest = digest(bad.canonical);
    bad.locale.dependencies[0]!.digest = digest(bad.canonical);
    expect(() => checkGlobalNeh2(bad)).toThrow(/plural reference/);
  });
});
