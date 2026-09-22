import * as fs from "fs";
import * as path from "path";
import {
  validateCanonicalPackage,
  validateEditionPackage,
  validateLocalePackage,
} from "../src/validators";
import type { PackageJobContext } from "../src/packages";

// Validates the machine-generated whole-Bible draft packages produced by
// tools/curate_whole_bible.py against the CUR-01 layered package contract.
//
// Authority is INDEPENDENT of the package under test (finding 31): the
// authoritative verse universe comes from the ratified Scripture skeleton
// (apps/mobile/assets/scripture/<asset>/*.json), approved entities come from
// the committed registry (content/curated/registry/entities.json), and
// relationship predicates come from the ontology
// (content/curation/relationship-ontology.json). The package's own contents
// are never used as the authority that judges themselves. Skips cleanly when
// the generated corpus has not been built.

const CURATED = path.resolve(__dirname, "../../../content/curated");
const REGISTRY = path.join(CURATED, "registry", "entities.json");
const ONTOLOGY = path.resolve(
  __dirname,
  "../../../content/curation/relationship-ontology.json",
);
const SCRIPTURE = path.resolve(
  __dirname,
  "../../../apps/mobile/assets/scripture",
);

interface Corpus {
  name: string;
  root: string;
  asset: string;
  lang: string;
}
const CORPORA: Corpus[] = [
  { name: "bsb", root: CURATED, asset: "bsb", lang: "en" },
  {
    name: "tel_irv",
    root: path.join(CURATED, "tel"),
    asset: "tel_irv",
    lang: "te",
  },
];

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function listBooks(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".v2.json"))
    .map((f) => f.replace(".v2.json", ""))
    .sort();
}

// --- Independent authority -------------------------------------------------

const registryKeys: Set<string> = new Set(
  readJson(REGISTRY).entities.map((e: any) => e.entity_key),
);
const ontologyPredicates: Set<string> = new Set(
  Object.values(readJson(ONTOLOGY).mapping) as string[],
);

const skeletonCache = new Map<string, Map<string, string>>();
function skeleton(asset: string, osis: string): Map<string, string> {
  const cacheKey = `${asset}/${osis}`;
  const cached = skeletonCache.get(cacheKey);
  if (cached) return cached;
  const file = path.join(SCRIPTURE, asset, `${osis}.json`);
  const verses = new Map<string, string>();
  if (fs.existsSync(file)) {
    const data = readJson(file);
    for (const ch of data.chapters ?? []) {
      for (const block of ch.blocks ?? []) {
        if (block.t === "v")
          verses.set(`verse:${osis}.${ch.n}.${block.n}`, block.text);
      }
    }
  }
  skeletonCache.set(cacheKey, verses);
  return verses;
}

function evidenceKeys(pkg: any): string[] {
  const keys: string[] = [];
  for (const place of pkg.records.places ?? []) {
    for (const position of place.geographic_positions ?? []) {
      keys.push(position.evidence_item_key);
    }
  }
  for (const citation of pkg.records.citations ?? []) {
    keys.push(citation.evidence_item_key);
  }
  return Array.from(new Set(keys));
}

function mentionResolves(
  text: string,
  quote: string,
  ordinal: number,
): boolean {
  const escaped = quote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "g");
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    count += 1;
    if (count === ordinal) return true;
  }
  return false;
}

function assertEntitiesIndependent(book: string, keys: string[]): void {
  const missing = Array.from(new Set(keys)).filter((k) => !registryKeys.has(k));
  expect({ book, missing }).toEqual({ book, missing: [] });
}

function validateBook(corpus: Corpus, book: string): void {
  const canonical = readJson(
    path.join(corpus.root, "canonical", `${book}.v2.json`),
  );
  const edition = readJson(
    path.join(corpus.root, "edition", `${book}.v2.json`),
  );
  const locale = readJson(path.join(corpus.root, "locale", `${book}.v2.json`));

  // Authoritative verse universe from the ratified skeleton, NOT the package.
  const verses = skeleton(corpus.asset, book);
  const authoritativeReferenceKeys = Array.from(verses.keys());
  expect(authoritativeReferenceKeys.length).toBeGreaterThan(0);

  const canonicalCtx: PackageJobContext = {
    canonKeys: ["canon:prot-66"],
    referenceSystemKeys: [canonical.scope.reference_system_key],
    evidenceItemKeys: evidenceKeys(canonical),
    authoritativeReferenceKeys,
  };
  validateCanonicalPackage(canonical, canonicalCtx);

  const claimKeys = (canonical.records.claims ?? []).map(
    (c: any) => c.claim_key,
  );
  const attestationKeys = (canonical.records.attestations ?? []).map(
    (a: any) => a.attestation_key,
  );
  const relevanceKeys = (canonical.records.relevance ?? []).map(
    (r: any) => r.relevance_key,
  );

  const editionCtx: PackageJobContext = {
    canonKeys: ["canon:prot-66"],
    referenceSystemKeys: [edition.scope.reference_system_key],
    evidenceItemKeys: [],
    languageTags: [corpus.lang],
    translationEditionKeys: [edition.scope.translation_edition_key],
    approvedClaimKeys: claimKeys,
    approvedAttestationKeys: attestationKeys,
    authoritativeReferenceKeys,
  };
  validateEditionPackage(edition, editionCtx);

  const localeCtx: PackageJobContext = {
    canonKeys: ["canon:prot-66"],
    referenceSystemKeys: [locale.scope.reference_system_key],
    evidenceItemKeys: [],
    languageTags: [corpus.lang],
    approvedEntityKeys: Array.from(registryKeys),
    approvedClaimKeys: claimKeys,
    approvedRelevanceKeys: relevanceKeys,
    authoritativeScopeKeys: locale.scope.scope_keys,
  };
  validateLocalePackage(locale, localeCtx);

  // --- Independent semantic checks (authority external to the package) -----
  const entityRefs: string[] = [];
  for (const a of canonical.records.attestations ?? [])
    entityRefs.push(a.entity_key);
  for (const r of canonical.records.relationships ?? []) {
    entityRefs.push(r.subject_entity_key, r.object_entity_key);
  }
  for (const e of canonical.records.events ?? []) {
    entityRefs.push(...e.participant_entity_keys, ...e.place_entity_keys);
  }
  for (const r of canonical.records.relevance ?? [])
    entityRefs.push(r.entity_key);
  for (const p of canonical.records.places ?? []) entityRefs.push(p.entity_key);
  for (const p of locale.records.entity_profiles ?? [])
    entityRefs.push(p.entity_key);
  assertEntitiesIndependent(`${book}:entity-keys`, entityRefs);

  const badPredicates = Array.from(
    new Set(
      (canonical.records.relationships ?? [])
        .map((r: any) => r.predicate_key)
        .filter((p: string) => !ontologyPredicates.has(p)),
    ),
  );
  expect({ book, badPredicates }).toEqual({ book, badPredicates: [] });

  // Every attestation reference exists in the independent skeleton.
  const badAttestRefs = (canonical.records.attestations ?? [])
    .map((a: any) => a.reference_key)
    .filter((r: string) => !verses.has(r));
  expect({ book, badAttestRefs }).toEqual({ book, badAttestRefs: [] });

  // Every mention quote actually resolves in the independent skeleton text.
  const badMentions = (edition.records.mentions ?? []).filter((m: any) => {
    const text = verses.get(m.verse_key);
    if (text === undefined) return true;
    return !mentionResolves(
      text,
      m.selector.exact_quote,
      m.selector.occurrence_ordinal,
    );
  });
  expect(badMentions.map((m: any) => m.mention_key)).toEqual([]);
}

for (const corpus of CORPORA) {
  const canonicalBooks = listBooks(path.join(corpus.root, "canonical"));
  // Only the corpus that owns the shared canonical graph is validated
  // end-to-end here; localized corpora are validated by the same layered
  // validators once their edition/locale are regenerated against the current
  // canonical revisions.
  if (canonicalBooks.length === 0) continue;
  describe(`whole-Bible generated packages (${corpus.name})`, () => {
    it("generated a non-trivial corpus", () => {
      expect(canonicalBooks.length).toBeGreaterThan(0);
    });
    for (const book of canonicalBooks) {
      it(`${book}: canonical/edition/locale validate against independent authority`, () => {
        validateBook(corpus, book);
      });
    }
  });
}
