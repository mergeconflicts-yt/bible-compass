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

# (layer, records field, key field). Profiles and candidates are canon-scoped
# records that legitimately repeat across book packages, so they may repeat
# only when byte-identical.
KINDS = [
    ("canonical", "entity_candidates", "candidate_key", True),
    ("canonical", "attestations", "attestation_key", False),
    ("canonical", "relationships", "relationship_key", False),
    ("canonical", "events", "event_key", False),
    ("canonical", "relevance", "relevance_key", False),
    ("edition", "mentions", "mention_key", False),
    ("locale", "entity_profiles", "profile_key", True),
    ("locale", "passage_contexts", "context_key", False),
    ("locale", "relevance_localizations", "localization_key", False),
]

# Annotation classes the packages can carry today, and the ones the curation
# spec requires that no input or pipeline currently produces.
ATTEMPTED_CLASSES = [
    "canonical_entity_attestation",
    "translation_mention",
    "canonical_relationship",
    "canonical_event",
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
        for book in books:
            path = CUR / layer / f"{book}.v2.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            for record in data["records"].get(field, []):
                content = json.dumps(record, sort_keys=True)
                seen[record[key_field]][content].append(book)
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
