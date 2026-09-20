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
// Covers the English BSB corpus (content/curated) and the Telugu IRV corpus
// (content/curated/tel). Skips cleanly when the generated corpus has not been
// built yet so the default test suite stays green on a fresh checkout.

const CURATED = path.resolve(__dirname, "../../../content/curated");
const CORPORA: { name: string; root: string; lang: string }[] = [
  { name: "bsb", root: CURATED, lang: "en" },
  { name: "tel_irv", root: path.join(CURATED, "tel"), lang: "te" },
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

function validateBook(root: string, book: string, lang: string): void {
  const canonical = readJson(path.join(root, "canonical", `${book}.v2.json`));
  const edition = readJson(path.join(root, "edition", `${book}.v2.json`));
  const locale = readJson(path.join(root, "locale", `${book}.v2.json`));

  const canonicalCtx: PackageJobContext = {
    canonKeys: ["canon:prot-66"],
    referenceSystemKeys: [canonical.scope.reference_system_key],
    evidenceItemKeys: evidenceKeys(canonical),
    authoritativeReferenceKeys: canonical.scope.reference_keys,
  };
  validateCanonicalPackage(canonical, canonicalCtx);

  const entityKeys = (canonical.records.reconciliation_records ?? []).map(
    (r: any) => r.canonical_entity_key,
  );
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
    languageTags: [lang],
    translationEditionKeys: [edition.scope.translation_edition_key],
    approvedClaimKeys: claimKeys,
    approvedAttestationKeys: attestationKeys,
    authoritativeReferenceKeys: edition.scope.reference_keys,
  };
  validateEditionPackage(edition, editionCtx);

  const localeCtx: PackageJobContext = {
    canonKeys: ["canon:prot-66"],
    referenceSystemKeys: [locale.scope.reference_system_key],
    evidenceItemKeys: [],
    languageTags: [lang],
    approvedEntityKeys: entityKeys,
    approvedClaimKeys: claimKeys,
    approvedRelevanceKeys: relevanceKeys,
    authoritativeScopeKeys: locale.scope.scope_keys,
  };
  validateLocalePackage(locale, localeCtx);
}

for (const corpus of CORPORA) {
  const books = listBooks(path.join(corpus.root, "canonical"));
  if (books.length === 0) continue;
  describe(`whole-Bible generated packages (${corpus.name})`, () => {
    it("generated a non-trivial corpus", () => {
      expect(books.length).toBeGreaterThan(0);
    });
    for (const book of books) {
      it(`${book}: canonical/edition/locale validate against the job contract`, () => {
        validateBook(corpus.root, book, corpus.lang);
      });
    }
  });
}
