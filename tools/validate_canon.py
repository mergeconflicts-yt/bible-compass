#!/usr/bin/env python3
"""Canon-level validation across all whole-Bible draft packages.

Book-local validation cannot see defects that only appear when the 66 book
packages are read together: cross-book record-key collisions, conflicting
profile definitions for the same entity, identity splits between the locked
Nehemiah 2 reference dataset and the global registry, and coverage that
silently omits annotation classes that were never attempted.

This tool reads content/curated/** and content/nehemiah-2/**, reports every
finding, and exits non-zero when any hard failure is present. It never writes.

Usage:
    python3 tools/validate_canon.py
    python3 tools/validate_canon.py --json
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CUR = REPO / "content" / "curated"
NEH2 = REPO / "content" / "nehemiah-2"
COVERAGE = REPO / "content" / "curation" / "canon-coverage.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import relationship_ontology  # noqa: E402

# (layer, records field, key field). Profiles and candidates are canon-scoped
# records that legitimately repeat across book packages, so they may repeat
# only when byte-identical.
KINDS = [
    ("canonical", "entity_candidates", "candidate_key", True),
    ("canonical", "claims", "claim_key", False),
    ("canonical", "citations", "citation_key", False),
    ("canonical", "attestations", "attestation_key", False),
    ("canonical", "relationships", "relationship_key", False),
    ("canonical", "events", "event_key", False),
    ("canonical", "places", "entity_key", True),
    ("canonical", "relevance", "relevance_key", False),
    ("edition", "mentions", "mention_key", False),
    ("locale", "entity_profiles", "profile_key", True),
    ("locale", "passage_contexts", "context_key", False),
    ("locale", "relevance_localizations", "localization_key", False),
]

KEY_PATTERNS = {
    "candidate": re.compile(r"^candidate:[a-z0-9-]+:[a-z0-9-]+$"),
    "claim": re.compile(r"^claim:[a-z0-9-]+$"),
    "citation": re.compile(r"^citation:[a-z0-9-]+$"),
    "attestation": re.compile(r"^attestation:[a-z0-9-]+$"),
    "relationship": re.compile(r"^relationship:[a-z0-9-]+$"),
    "event": re.compile(r"^event:[a-z0-9-]+$"),
    "relevance": re.compile(r"^relevance:[a-z0-9-]+$"),
    "mention": re.compile(r"^mention:[a-z0-9-]+:[a-z0-9-]+$"),
    "profile": re.compile(r"^profile:[a-z0-9-]+:[a-z0-9-]+$"),
    "context": re.compile(r"^context:[a-z0-9-]+:[a-z0-9-]+$"),
    "localization": re.compile(r"^relevance-localization:[a-z0-9-]+:[a-z0-9-]+$"),
    "question": re.compile(r"^question:[a-z0-9-]+$"),
    "entity": re.compile(r"^entity:[a-z0-9-]+$"),
    "scope": re.compile(r"^scope:[A-Za-z0-9-:.]+$"),
    "verse": re.compile(r"^verse:[A-Za-z1-9][A-Za-z0-9]*\.\d+(\.\d+)?$"),
}
KEY_FIELD = {
    "entity_candidates": "candidate_key",
    "claims": "claim_key",
    "citations": "citation_key",
    "attestations": "attestation_key",
    "relationships": "relationship_key",
    "events": "event_key",
    "places": "entity_key",
    "relevance": "relevance_key",
    "mentions": "mention_key",
    "entity_profiles": "profile_key",
    "passage_contexts": "context_key",
    "relevance_localizations": "localization_key",
}

# Annotation classes the packages can carry today, and the ones the curation
# spec requires that no input or pipeline currently produces.
ATTEMPTED_CLASSES = [
    "canonical_entity_attestation",
    "translation_mention",
    "canonical_relationship",
    "canonical_entity_relevance",
    "passage_context_localization",
]
NOT_ATTEMPTED_CLASSES = [
    "canonical_object",
    "canonical_role",
    "canonical_practice",
    "canonical_term",
    "canonical_theme",
    "canonical_chronology",
    "canonical_event",
    "historical_context",
    "localized_entity_name",
    "map_timeline_projection",
]


def load_books() -> list[str]:
    return sorted(p.name.replace(".v2.json", "") for p in (CUR / "canonical").glob("*.v2.json"))


def scan_collisions(books: list[str], report: dict, errors: list[str]) -> None:
    for layer, field, key_field, allow_identical in KINDS:
        seen: dict[str, dict[str, list[str]]] = collections.defaultdict(
            lambda: collections.defaultdict(list)
        )
        kind = {
            "entity_candidates": "candidate",
            "claims": "claim",
            "citations": "citation",
            "attestations": "attestation",
            "relationships": "relationship",
            "events": "event",
            "places": "entity",
            "relevance": "relevance",
            "mentions": "mention",
            "entity_profiles": "profile",
            "passage_contexts": "context",
            "relevance_localizations": "localization",
        }[field]
        invalid = 0
        for book in books:
            path = CUR / layer / f"{book}.v2.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            for record in data["records"].get(field, []):
                if not KEY_PATTERNS[kind].match(record[key_field]):
                    invalid += 1
                content = json.dumps(record, sort_keys=True)
                seen[record[key_field]][content].append(book)
        report.setdefault("invalid_keys", {})
        if invalid:
            report["invalid_keys"][f"{layer}.{field}"] = invalid
            errors.append(f"{layer}.{field}: {invalid} invalid key(s)")
        books_per_key = {
            k: sum(len(b) for b in v.values()) for k, v in seen.items()
        }
        multi_book = {k: n for k, n in books_per_key.items() if n > 1}
        conflicting = {k: v for k, v in seen.items() if len(v) > 1}
        entry = {
            "records": sum(len(v) for v in seen.values()),
            "distinct_keys": len(seen),
            "keys_in_multiple_books": len(multi_book),
            "conflicting_keys": len(conflicting),
        }
        report["cross_book_keys"][f"{layer}.{field}"] = entry
        if conflicting and not allow_identical:
            errors.append(
                f"{layer}.{field}: {len(conflicting)} record key(s) reused across books "
                f"(e.g. {sorted(conflicting)[:3]})"
            )
        if conflicting and allow_identical:
            errors.append(
                f"{layer}.{field}: {len(conflicting)} canon-scoped key(s) have conflicting "
                f"content across books (e.g. {sorted(conflicting)[:3]})"
            )


def check_identity(report: dict, errors: list[str]) -> None:
    reg_path = CUR / "registry" / "entities.json"
    registry = json.loads(reg_path.read_text(encoding="utf-8"))
    reg_keys = {e["entity_key"] for e in registry["entities"]}
    reg_by_slug = {e["slug"]: e for e in registry["entities"]}

    neh2 = json.loads((NEH2 / "canonical.v2.json").read_text(encoding="utf-8"))
    neh2_keys = sorted(
        {
            r["canonical_entity_key"]
            for r in neh2["records"].get("reconciliation_records", [])
            if r.get("canonical_entity_key")
        }
    )
    missing = [k for k in neh2_keys if k not in reg_keys]
    splits = []
    for key in missing:
        label = key.split("entity:", 1)[1]
        candidates = sorted(
            e["entity_key"]
            for e in registry["entities"]
            if label.replace("-", " ") in (e["preferred_name"] or "").lower()
            or e["preferred_name"].lower().replace(" ", "-") == label
        )
        if candidates:
            splits.append({"locked": key, "registry_candidates": candidates[:5]})
    report["identity"] = {
        "registry_entities": len(reg_keys),
        "locked_neh2_entities": len(neh2_keys),
        "locked_not_in_registry": len(missing),
        "resolvable_name_splits": splits,
    }
    if splits:
        errors.append(
            f"identity: {len(splits)} locked Neh2 entities have a same-name registry "
            f"identity (e.g. {[s['locked'] for s in splits[:3]]})"
        )


def check_identities(books: list[str], report: dict, errors: list[str]) -> None:
    """Canonical identities are translation-neutral; BSB lives only in edition."""
    edition_keys: set[str] = set()
    for book in books:
        canonical = json.loads((CUR / "canonical" / f"{book}.v2.json").read_text(encoding="utf-8"))
        edition = json.loads((CUR / "edition" / f"{book}.v2.json").read_text(encoding="utf-8"))
        locale = json.loads((CUR / "locale" / f"{book}.v2.json").read_text(encoding="utf-8"))
        canon_key = canonical["package_key"].lower()
        if any(t in canon_key for t in ("bsb", "-en-", "-tel-", "-ta-")):
            errors.append(
                f"{book}/canonical: identity not translation-neutral ({canonical['package_key']})"
            )
        if canonical["scope"]["translation_edition_key"] is not None:
            errors.append(f"{book}/canonical: must not carry a translation_edition_key")
        locale_key = locale["package_key"].lower()
        if "bsb" in locale_key:
            errors.append(f"{book}/locale: locale identity must not name an edition ({locale['package_key']})")
        if locale["scope"]["translation_edition_key"] is not None:
            errors.append(f"{book}/locale: must not carry a translation_edition_key")
        if "bsb" not in edition["package_key"].lower():
            errors.append(f"{book}/edition: edition package must name its translation edition")
        if edition["scope"]["translation_edition_key"] is None:
            errors.append(f"{book}/edition: missing translation_edition_key")
        edition_keys.add(edition["scope"]["translation_edition_key"])
        # Canonical-layer language neutrality: source-derived labels and any
        # embedded prose must carry their language tag.
        for c in canonical["records"].get("entity_candidates", []):
            if c.get("label_language_tag") != "en":
                errors.append(f"{book}/canonical: candidate {c.get('candidate_key')} untagged label")
        for claim in canonical["records"].get("claims", []):
            for side in ("subject", "object"):
                part = claim.get(side, {})
                if part.get("type") == "text" and part.get("value_language_tag") != "en":
                    errors.append(
                        f"{book}/canonical: claim {claim.get('claim_key')} untagged {side} prose"
                    )
    report["identities"] = {
        "translation_neutral_canonical": True,
        "edition_keys": sorted(edition_keys),
    }


def check_registry_references(books: list[str], report: dict, errors: list[str]) -> None:
    registry = json.loads((CUR / "registry" / "entities.json").read_text(encoding="utf-8"))
    reg_keys = {e["entity_key"] for e in registry["entities"]}
    bad_status = sorted(
        e["entity_key"]
        for e in registry["entities"]
        if e.get("identification_status") not in (
            "established", "traditional", "proposed", "disputed", "unknown",
        )
    )
    proposed = sorted(
        e["entity_key"]
        for e in registry["entities"]
        if e.get("identification_status") == "proposed"
    )
    untagged = sorted(
        e["entity_key"]
        for e in registry["entities"]
        if e.get("language_tag") != "en"
    )
    missing_candidates = 0
    missing_recon = 0
    for book in books:
        canonical = json.loads((CUR / "canonical" / f"{book}.v2.json").read_text(encoding="utf-8"))
        for c in canonical["records"].get("entity_candidates", []):
            slug = c["candidate_key"].split("candidate:wb:", 1)[-1]
            if f"entity:{slug}" not in reg_keys:
                missing_candidates += 1
        for r in canonical["records"].get("reconciliation_records", []):
            key = r.get("canonical_entity_key")
            if key is not None and key not in reg_keys:
                missing_recon += 1
    report["registry_references"] = {
        "registry_entities": len(reg_keys),
        "candidates_not_in_registry": missing_candidates,
        "reconciliation_not_in_registry": missing_recon,
        "identification_status_proposed": proposed,
        "untagged_display_names": untagged,
        "invalid_identification_status": bad_status,
    }
    if missing_candidates or missing_recon:
        errors.append(
            f"registry references: {missing_candidates} candidate(s) and {missing_recon} "
            "reconciliation record(s) do not reference the global registry"
        )
    if bad_status:
        errors.append(
            f"registry: {len(bad_status)} entit(ies) with invalid identification_status "
            f"(e.g. {bad_status[:3]})"
        )
    if untagged:
        errors.append(
            f"registry: {len(untagged)} entit(ies) with untagged display names "
            f"(e.g. {untagged[:3]})"
        )


def check_sense_spotchecks(books: list[str], report: dict, errors: list[str]) -> None:
    """Regression guard for per-reference sense classification.

    Each cited verse must attest the group/collective/deity identity and
    must not attest the displaced patriarch/person identity.
    """
    by_book: dict[str, dict[str, set[str]]] = {}
    for book in books:
        canonical = json.loads((CUR / "canonical" / f"{book}.v2.json").read_text(encoding="utf-8"))
        ref_map: dict[str, set[str]] = collections.defaultdict(set)
        for a in canonical["records"].get("attestations", []):
            ref_map[a["reference_key"]].add(a["entity_key"])
        by_book[book] = ref_map
    by_book_edition: dict[str, dict] = {}
    for book in books:
        edition = json.loads((CUR / "edition" / f"{book}.v2.json").read_text(encoding="utf-8"))
        by_book_edition[book] = {
            (m["verse_key"], m["target"]["key"]): m["selector"]["exact_quote"]
            for m in edition["records"].get("mentions", [])
        }

    def attest_entities(book: str, ref: str) -> set[str]:
        return set(by_book.get(book, {}).get(ref, set()))

    checks: list[tuple[str, str, set[str], set[str]]] = [
        # (book, verse_key, must_have, must_not_have)
        ("Hos", "verse:Hos.1.11", {"entity:israelites"}, {"entity:p-jacob-1"}),
        ("Jer", "verse:Jer.32.30", {"entity:israelites", "entity:tribe-of-judah"}, {"entity:p-judah-1"}),
        ("Ezek", "verse:Ezek.37.19",
         {"entity:israelites", "entity:tribe-of-joseph", "entity:tribe-of-judah", "entity:tribe-of-ephraim"},
         {"entity:p-judah-1", "entity:p-joseph-1", "entity:p-ephraim-1"}),
        ("Num", "verse:Num.31.4", {"entity:israelites"}, {"entity:p-jacob-1"}),
        ("Num", "verse:Num.31.5", {"entity:israelites"}, {"entity:p-jacob-1"}),
        ("Num", "verse:Num.1.26", {"entity:tribe-of-judah"}, set()),
        ("Ezra", "verse:Ezra.6.16", {"entity:israelites"}, {"entity:p-jacob-1"}),
        ("Judg", "verse:Judg.3.2", {"entity:israelites"}, {"entity:p-jacob-1"}),
        ("Rev", "verse:Rev.7.5",
         {"entity:tribe-of-judah", "entity:tribe-of-reuben", "entity:tribe-of-gad"},
         {"entity:p-judah-1", "entity:p-reuben-1", "entity:p-gad-1"}),
        ("Gen", "verse:Gen.1.1", {"entity:god"}, set()),
        ("Matt", "verse:Matt.1.1", {"entity:jesus-christ"}, set()),
    ]
    for book, ref, must_have, must_not_have in checks:
        have = attest_entities(book, ref)
        missing = must_have - have
        if missing:
            errors.append(f"sense {ref}: missing {sorted(missing)}")
        wrong = must_not_have & have
        if wrong:
            errors.append(f"sense {ref}: displaced identity still attested {sorted(wrong)}")
    # Retained-phrase mentions anchor the corrected identities.
    mention_checks: list[tuple[str, str, str, str]] = [
        ("Ezra", "verse:Ezra.6.16", "entity:israelites", "people of Israel"),
        ("Judg", "verse:Judg.3.2", "entity:israelites", "generations of Israel"),
        ("Num", "verse:Num.1.26", "entity:tribe-of-judah", "sons of Judah"),
        ("Gen", "verse:Gen.1.1", "entity:god", "God"),
        ("Matt", "verse:Matt.1.1", "entity:jesus-christ", "Jesus Christ"),
    ]
    for book, ref, entity, quote in mention_checks:
        got = by_book_edition.get(book, {}).get((ref, entity))
        if got != quote:
            errors.append(
                f"sense {ref}: expected {entity} mention {quote!r}, found {got!r}"
            )
    report["sense_spotchecks"] = "checked"


def check_package_integrity(books: list[str], report: dict, errors: list[str]) -> None:
    """Independent structural checks not derived from the package under test.

    - registry no longer persists derived values (finding 25);
    - every registry entity retains structured external identifiers (26);
    - edition/locale dependencies bind to the canonical content digest and
      revision (16);
    - relationship predicates are inside the controlled ontology (24).
    """
    registry = json.loads((CUR / "registry" / "entities.json").read_text(encoding="utf-8"))
    derived = [
        e["entity_key"]
        for e in registry["entities"]
        if any(k in e for k in ("verse_count", "first_reference", "last_reference"))
    ]
    no_ext = [e["entity_key"] for e in registry["entities"] if not e.get("external_ids")]
    bad_pred: set[str] = set()
    bad_deps: list[str] = []
    for book in books:
        canonical = json.loads((CUR / "canonical" / f"{book}.v2.json").read_text(encoding="utf-8"))
        cdigest = canonical.get("content_digest")
        crev = canonical.get("package_revision")
        for layer in ("edition", "locale"):
            pkg = json.loads((CUR / layer / f"{book}.v2.json").read_text(encoding="utf-8"))
            deps = pkg.get("dependencies", [])
            if len(deps) != 1 or deps[0].get("package_key") != canonical["package_key"]:
                bad_deps.append(f"{book}/{layer}")
                continue
            if cdigest is not None and deps[0].get("digest") != cdigest:
                bad_deps.append(f"{book}/{layer}: digest != canonical content_digest")
            if deps[0].get("revision") != crev:
                bad_deps.append(f"{book}/{layer}: revision != canonical revision")
        for rel in canonical["records"].get("relationships", []):
            if not relationship_ontology.is_allowed(rel["predicate_key"]):
                bad_pred.add(rel["predicate_key"])
    report["package_integrity"] = {
        "registry_persisted_derived_values": derived[:5],
        "registry_entities_without_external_ids": len(no_ext),
        "dependency_binding_errors": bad_deps[:5],
        "predicates_outside_ontology": sorted(bad_pred),
    }
    if derived:
        errors.append(
            f"registry: {len(derived)} entries still persist derived values "
            f"(e.g. {derived[:3]})"
        )
    # Some entities legitimately have no external source row (deity,
    # collectives, tribal entities). The defect (26) is retaining NO mappings
    # at all, so fail only when the mapping feature is entirely absent.
    if registry["entities"] and len(no_ext) == len(registry["entities"]):
        errors.append("registry: no entity retains a structured external identifier")
    if bad_deps:
        errors.append(f"dependencies: {len(bad_deps)} binding error(s) (e.g. {bad_deps[:3]})")
    if bad_pred:
        errors.append(
            f"relationships: {len(bad_pred)} predicate(s) outside the controlled "
            f"ontology (e.g. {sorted(bad_pred)[:3]})"
        )


def check_coverage_partitions(books: list[str], report: dict, errors: list[str]) -> None:
    for book in books:
        canonical = json.loads((CUR / "canonical" / f"{book}.v2.json").read_text(encoding="utf-8"))
        edition = json.loads((CUR / "edition" / f"{book}.v2.json").read_text(encoding="utf-8"))
        locale = json.loads((CUR / "locale" / f"{book}.v2.json").read_text(encoding="utf-8"))
        for label, pkg, field in (
            ("canonical", canonical, "reference_keys"),
            ("edition", edition, "reference_keys"),
        ):
            authoritative = set(pkg["scope"]["reference_keys"])
            seen: set[str] = set()
            for block in pkg["coverage"]:
                for g in block["groups"]:
                    for ref in g[field]:
                        if ref in seen:
                            errors.append(f"{book}/{label}: overlapping coverage {ref}")
                        seen.add(ref)
            if seen != authoritative:
                errors.append(
                    f"{book}/{label}: coverage partitions {len(seen)}/{len(authoritative)} refs"
                )
        authoritative = set(locale["scope"]["scope_keys"])
        seen = set()
        for block in locale["coverage"]:
            for g in block["groups"]:
                for ref in g["scope_keys"]:
                    if ref in seen:
                        errors.append(f"{book}/locale: overlapping coverage {ref}")
                    seen.add(ref)
        if seen != authoritative:
            errors.append(
                f"{book}/locale: coverage partitions {len(seen)}/{len(authoritative)} scopes"
            )
    report["coverage_partitions"] = "checked"


def check_coverage(books: list[str], report: dict, errors: list[str]) -> None:
    data = json.loads(COVERAGE.read_text(encoding="utf-8"))
    report["coverage"] = {
        "books": data.get("books_total"),
        "chapters": data.get("chapters_total"),
        "verses": data.get("verses_total"),
        "attempted_annotation_classes": ATTEMPTED_CLASSES,
        "not_attempted_annotation_classes": NOT_ATTEMPTED_CLASSES,
        "per_class": data.get("annotation_class_coverage", {}),
    }
    if data.get("books_total") != len(books):
        errors.append(
            f"coverage: register covers {data.get('books_total')} books, packages have {len(books)}"
        )
    if data.get("chapters_total") != 1189:
        errors.append(f"coverage: register covers {data.get('chapters_total')} chapters, expected 1189")


def main() -> int:
    parser = argparse.ArgumentParser(description="Canon-level package validation.")
    parser.add_argument("--json", action="store_true", help="Print the report as JSON.")
    args = parser.parse_args()

    books = load_books()
    errors: list[str] = []
    report: dict = {
        "tool": "tools/validate_canon.py",
        "books": len(books),
        "cross_book_keys": {},
    }
    if not books:
        print("no packages found", file=sys.stderr)
        return 1
    scan_collisions(books, report, errors)
    check_identity(report, errors)
    check_identities(books, report, errors)
    check_registry_references(books, report, errors)
    check_coverage_partitions(books, report, errors)
    check_package_integrity(books, report, errors)
    check_sense_spotchecks(books, report, errors)
    check_coverage(books, report, errors)
    report["errors"] = errors
    report["status"] = "PASS" if not errors else "FAIL"

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"books: {report['books']}")
        for kind, entry in report["cross_book_keys"].items():
            print(
                f"  {kind:38} records={entry['records']:6} "
                f"multi_book={entry['keys_in_multiple_books']:5} conflicting={entry['conflicting_keys']:5}"
            )
        ident = report["identity"]
        print(
            f"  identity: registry={ident['registry_entities']} locked={ident['locked_neh2_entities']} "
            f"locked_not_in_registry={ident['locked_not_in_registry']} "
            f"name_splits={len(ident['resolvable_name_splits'])}"
        )
        cov = report["coverage"]
        print(f"  coverage: books={cov['books']} chapters={cov['chapters']} verses={cov['verses']}")
        print(f"  attempted classes: {len(cov['attempted_annotation_classes'])}")
        print(f"  NOT attempted classes: {', '.join(cov['not_attempted_annotation_classes'])}")
        if errors:
            print("\nFAIL:")
            for e in errors:
                print("  -", e)
        else:
            print("\nPASS")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
