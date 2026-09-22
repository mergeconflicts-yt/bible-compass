#!/usr/bin/env python3
"""Whole-Bible curation generator.

Builds draft canonical / edition / locale packages (contract v2.0.0,
docs/curation-structure/*.example.json) for every book of the English Berean
Standard Bible, plus a shared entity registry.

Sources (all local, read-only):
  * apps/mobile/assets/scripture/bsb/<OSIS>.json  - canon skeleton + BSB text
    and section headings (Berean Standard Bible, BSB).
  * content/quarantine/bibledata/BibleData-Person{,Relationship,Verse}.csv
    - persons, relationships and person-to-verse links (CC BY 4.0).
  * content/quarantine/openbible/ancient.jsonl - ancient places and their
    verse references (CC BY 4.0).

Every emitted record is review_status "draft" and data_classification
"synthetic_fixture". Nothing here is approved or published. Historical,
chronological and interpretive context that the allowed inputs do not support
is emitted as an open question, never invented prose.

Usage:
    python3 tools/curate_whole_bible.py                 # all 66 books
    python3 tools/curate_whole_bible.py --books Neh Ruth
    python3 tools/curate_whole_bible.py --no-status     # skip status register
"""

from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import canon_order  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
SCRIPTURE = REPO / "apps" / "mobile" / "assets" / "scripture"
QUARANTINE = REPO / "content" / "quarantine"
KNOWLEDGE = Path(__file__).resolve().parent / "whole_bible_knowledge.json"
OUT = REPO / "content" / "curated"
STATUS = REPO / "content" / "curation" / "whole-bible-status.json"

CANON = "canon:prot-66"

# Supported translation editions. Each produces its own canonical (reference
# system scoped), edition and locale draft packages. Telugu uses refsys:tel-v1
# and its own verse numbering; canonical service relationships stay shared via
# the single registry.
TRANSLATIONS: dict[str, dict] = {
    "bsb": {
        "asset": "bsb",
        "lang": "en",
        "refsys": "refsys:eng-v22",
        "edition": "edition:bsb@20260912",
        "out": "",
        "name": "Berean Standard Bible",
        "knowledge": "books",
    },
    "tel_irv": {
        "asset": "tel_irv",
        "lang": "te",
        "refsys": "refsys:tel-v1",
        "edition": "edition:tel-irv@20260912",
        "out": "tel",
        "name": "Indian Revised Version (Telugu)",
        "knowledge": "books_te",
    },
}
CONTRACT = "2.0.0"
SCHEMA = "2.0.0"
VOCAB = "1.0.0"
COVERAGE_POLICY = "1.0.0"
DATA_CLASSIFICATION = "synthetic_fixture"
SOURCE_ATTRIBUTION = (
    "Names and references derived from STEPBible/BibleData/OpenBible (CC BY 4.0) "
    "and the Berean Standard Bible (BSB). Draft machine-generated fixture; "
    "not reviewed, approved or published."
)

OT_NT = {"OT": "OT", "NT": "NT"}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    value = re.sub(r"-{2,}", "-", value)
    return value or "x"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return "sha256:" + h.hexdigest()


def load_books(asset: str = "bsb") -> list[dict]:
    books = []
    for path in sorted((SCRIPTURE / asset).glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        books.append(data)
    # Canonical order from the ratified skeleton, never alphabetical file
    # order (alphabetical order previously made Acts "OT" and Nehemiah "NT").
    return canon_order.ordered(books)


def verse_key(osis: str, chapter: int, verse: int) -> str:
    return f"verse:{osis}.{chapter}.{verse}"


def scope_key(
    slug: str,
    start: tuple[str, int, int],
    end: tuple[str, int, int],
    refsys: str = "refsys:eng-v22",
) -> str:
    # The CUR-01 v2 scope grammar is lower-case only, so the reference span is
    # lower-cased while verse keys retain canonical OSIS casing.
    s = f"{start[0]}.{start[1]}.{start[2]}"
    e = f"{end[0]}.{end[1]}.{end[2]}"
    return f"scope:{slug}:{refsys}:{s}-{e}".lower()


def book_verse_index(book: dict) -> list[tuple[int, int, str]]:
    """Ordered (chapter, verse, text) list for a book."""
    out = []
    for ch in book["chapters"]:
        for block in ch["blocks"]:
            if block.get("t") == "v":
                out.append((ch["n"], block["n"], block["text"]))
    return out


def chapter_passages(chapter: dict) -> list[dict]:
    """Split one chapter into passages by BSB section headings.

    Returns [{title, start_verse, end_verse}] with verse numbers that actually
    exist in the chapter. A chapter with no heading yields one passage."""
    groups: list[dict] = []
    current = {"title": None, "verses": []}
    for block in chapter["blocks"]:
        if block.get("t") == "h":
            if current["verses"]:
                groups.append(current)
            current = {"title": block["text"], "verses": []}
        elif block.get("t") == "v":
            current["verses"].append(block["n"])
    if current["verses"]:
        groups.append(current)
    passages = []
    for g in groups:
        if not g["verses"]:
            continue
        passages.append(
            {
                "title": g["title"],
                "start_verse": min(g["verses"]),
                "end_verse": max(g["verses"]),
            }
        )
    return passages


# ---------------------------------------------------------------------------
# source loading
# ---------------------------------------------------------------------------

def load_persons() -> tuple[dict, dict]:
    """Return (persons, person_labels). persons keyed by entity slug."""
    persons: dict[str, dict] = {}
    labels: dict[str, set] = {}
    person_csv = QUARANTINE / "bibledata" / "BibleData-Person.csv"
    personverse_csv = QUARANTINE / "bibledata" / "BibleData-PersonVerse.csv"
    if not person_csv.exists() or not personverse_csv.exists():
        return persons, labels

    with person_csv.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            pid = (row.get("person_id") or "").strip()
            name = (row.get("person_name") or "").strip()
            if not pid or not name:
                continue
            if pid.upper().startswith("YHVH") or name in {
                "YHVH",
                "YHWH",
                "LORD",
                "Lord",
                "G-d",
                "GOD",
                "God",
                "Yahweh",
            }:
                continue
            slug = "p-" + slugify(pid)
            persons[slug] = {
                "slug": slug,
                "type": "person",
                "name": name,
                "aliases": set(),
                "refs": set(),
            }
            labels[slug] = set()

    with personverse_csv.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            pid = (row.get("person_id") or "").strip()
            ref = (row.get("reference_id") or "").strip()
            label = (row.get("person_label") or "").strip()
            if not pid or not ref:
                continue
            slug = "p-" + slugify(pid)
            if slug not in persons:
                continue
            parts = ref.split(" ")
            if len(parts) != 2 or ":" not in parts[1]:
                continue
            bsb_code, cv = parts
            ch, _, vs = cv.partition(":")
            if not ch.isdigit() or not vs.isdigit():
                continue
            osis = BSB_TO_OSIS.get(bsb_code, bsb_code)
            persons[slug]["refs"].add((osis, int(ch), int(vs)))
            if label:
                labels[slug].add(label)
    return persons, labels


def load_source_identification_ids() -> set[str]:
    """All OpenBible identification ids (internal, never names)."""
    ids: set[str] = set()
    path = QUARANTINE / "openbible" / "ancient.jsonl"
    if not path.exists():
        return ids
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            for ident in rec.get("identifications") or []:
                if isinstance(ident, dict) and ident.get("id"):
                    ids.add(str(ident["id"]))
    return ids


def load_places() -> dict:
    places: dict[str, dict] = {}
    source_ids = load_source_identification_ids()
    path = QUARANTINE / "openbible" / "ancient.jsonl"
    if not path.exists():
        return places
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            pid = rec.get("id")
            friendly = (rec.get("friendly_id") or "").strip()
            if not pid or not friendly:
                continue
            slug = "pl-" + slugify(friendly) + "-" + slugify(pid)
            entry = places.setdefault(
                slug,
                {
                    "slug": slug,
                    "type": "place",
                    "name": friendly,
                    "aliases": set(),
                    "refs": set(),
                    "evidence": f"evidence:openbible:{slug}",
                },
            )
            for ident in rec.get("identifications") or []:
                if not isinstance(ident, dict) or not ident.get("id"):
                    continue
                # Internal OpenBible identification ids (e.g. a15257a) are
                # source identifiers, not names: never store them as
                # searchable aliases. Matching is by exact source-id set, so
                # short lowercase words are never dropped as collateral.
                alias = str(ident["id"]).strip()
                if alias and alias not in source_ids:
                    entry["aliases"].add(alias)
            extra = rec.get("extra")
            if extra:
                try:
                    osises = json.loads(extra).get("osises", [])
                except (ValueError, TypeError):
                    osises = []
                for osis_ref in osises:
                    parsed = parse_osis(osis_ref)
                    if parsed:
                        entry["refs"].add(parsed)
    return places


def parse_osis(ref: str) -> tuple[str, int, int] | None:
    parts = ref.split(".")
    if len(parts) != 3:
        return None
    book, ch, vs = parts
    if not ch.isdigit() or not vs.isdigit():
        return None
    return (book, int(ch), int(vs))


# ---------------------------------------------------------------------------
# envelope construction
# ---------------------------------------------------------------------------

def envelope(
    book: str,
    layer: str,
    family: str,
    scope_keys: list[str],
    reference_keys: list[str],
    language: str | None,
    edition: str | None,
    refsys: str,
    trans: str,
    registry_digest: str,
    records: dict,
    coverage: list[dict],
    questions: list[dict],
) -> dict:
    stem = f"wb-{trans}-{book.lower()}-{layer}"
    return {
        "contract_version": CONTRACT,
        "schema_version": SCHEMA,
        "vocabulary_version": VOCAB,
        "coverage_policy_version": COVERAGE_POLICY,
        "data_classification": DATA_CLASSIFICATION,
        "package_key": f"draft:{stem}",
        "package_revision": 1,
        "submission_id": f"submission:{stem}:attempt-1",
        "attempt": 1,
        "produced_for_job_id": f"job:{stem}",
        "package_layer": layer,
        "package_family": family,
        "scope": {
            "canon_key": CANON,
            "reference_system_key": refsys,
            "scope_keys": scope_keys,
            "reference_keys": reference_keys,
            "language_tag": language,
            "translation_edition_key": edition,
        },
        "review_status": "draft",
        "dependencies": [
            {
                "package_key": "registry:wb:entities",
                "revision": 1,
                "digest": registry_digest,
            }
        ],
        "records": records,
        "coverage": coverage,
        "open_questions": questions,
        "editorial_observations": [
            {"code": "source-attribution", "note": SOURCE_ATTRIBUTION},
            {
                "code": "machine-generated-draft",
                "note": "Generated by tools/curate_whole_bible.py from BSB structure plus CC BY 4.0 name/reference datasets.",
            },
        ],
    }


def reference_groups(verse_to_records: dict[str, list[str]]) -> list[dict]:
    by_set: dict[tuple[str, ...], list[str]] = {}
    zero: list[str] = []
    for verse, records in verse_to_records.items():
        if not records:
            zero.append(verse)
            continue
        key = tuple(sorted(records))
        by_set.setdefault(key, []).append(verse)
    groups: list[dict] = []
    if zero:
        groups.append(
            {
                "result": "complete_zero",
                "reference_keys": sorted(zero),
                "record_keys": [],
                "blocker_question_keys": [],
            }
        )
    for key, verses in by_set.items():
        groups.append(
            {
                "result": "complete_with_records",
                "reference_keys": sorted(verses),
                "record_keys": list(key),
                "blocker_question_keys": [],
            }
        )
    return groups


def search_quote(
    text: str,
    candidates: list[str],
    boundary: str = "[A-Za-z0-9]",
    require_tail: bool = True,
) -> tuple[str, int, str, str] | None:
    """Locate a proper-name surface form in verse text.

    Matching is case-sensitive and bounded so a short ancient name such as
    "Ai" is never matched inside an ordinary word. For Telugu the boundary is
    the Telugu script block and a trailing letter is allowed, because case and
    number suffixes attach directly to the name. The first occurrence is
    selected and its surrounding context is retained for verification."""
    for cand in candidates:
        cand = cand.strip()
        if len(cand) < 2:
            continue
        lookahead = f"(?!{boundary})" if require_tail else ""
        pattern = re.compile(
            f"(?<!{boundary})" + re.escape(cand) + lookahead
        )
        match = pattern.search(text)
        if match is None:
            continue
        quote = match.group(0)
        prefix = text[max(0, match.start() - 20) : match.start()]
        suffix = text[match.end() : match.end() + 20]
        return quote, 1, prefix, suffix
    return None


# ---------------------------------------------------------------------------
# per-book generation
# ---------------------------------------------------------------------------

def generate_book(
    book: dict,
    persons: dict,
    person_labels: dict,
    places: dict,
    knowledge: dict,
    registry_digest: str,
    config: dict,
    locale_names: dict[str, str] | None = None,
) -> dict:
    osis = book["osis"]
    lang = config["lang"]
    refsys = config["refsys"]
    edition_key = config["edition"]
    trans = slugify(config["asset"])
    locale_names = locale_names or {}

    verses = book_verse_index(book)
    verse_text = {(c, v): t for c, v, t in verses}
    all_verse_keys = [verse_key(osis, c, v) for c, v, _ in verses]
    verse_tset = {(osis, c, v) for c, v, _ in verses}

    def display(slug: str, fallback: str) -> str:
        return locale_names.get(slug, fallback)

    # scopes: book, chapters, passages
    first = (osis, verses[0][0], verses[0][1])
    last = (osis, verses[-1][0], verses[-1][1])
    book_slug = f"wb-{osis.lower()}"
    book_scope = scope_key(book_slug, first, last, refsys)
    chapter_scopes: dict[int, str] = {}
    passage_scopes: list[dict] = []
    for ch in book["chapters"]:
        ch_verses = [v for (c, v, _) in verses if c == ch["n"]]
        if not ch_verses:
            continue
        chapter_scopes[ch["n"]] = scope_key(
            f"{book_slug}-{ch['n']}",
            (osis, ch["n"], min(ch_verses)),
            (osis, ch["n"], max(ch_verses)),
            refsys,
        )
        for i, p in enumerate(chapter_passages(ch), start=1):
            passage_scopes.append(
                {
                    "slug": f"{book_slug}-{ch['n']}-p{i}",
                    "scope": scope_key(
                        f"{book_slug}-{ch['n']}-p{i}",
                        (osis, ch["n"], p["start_verse"]),
                        (osis, ch["n"], p["end_verse"]),
                        refsys,
                    ),
                    "chapter": ch["n"],
                    "title": p["title"],
                    "start": p["start_verse"],
                    "end": p["end_verse"],
                }
            )
    all_scopes = [book_scope] + list(chapter_scopes.values()) + [
        p["scope"] for p in passage_scopes
    ]

    # attestations for entities referenced in this book
    attestations: list[dict] = []
    candidates: list[dict] = []
    reconciliations: list[dict] = []
    places_records: list[dict] = []
    entity_in_book: dict[str, dict] = {}
    verse_to_attest: dict[str, list[str]] = {vk: [] for vk in all_verse_keys}

    def add_entity(slug: str, entry: dict) -> str | None:
        if slug in entity_in_book:
            return entity_in_book[slug]["candidate"]
        candidate = f"candidate:wb:{slug}"
        candidates.append(
            {
                "candidate_key": candidate,
                "entity_type": entry["type"],
                "proposed_label": entry["name"],
                "possible_existing_entity_keys": [],
                "identifying_claim_keys": [],
                "resolution_status": "unresolved",
                "review_status": "draft",
            }
        )
        reconciliations.append(
            {
                "candidate_key": candidate,
                "canonical_entity_key": f"entity:{slug}",
                "resolution_status": "created_new_canonical",
                "review_status": "draft",
            }
        )
        entity_in_book[slug] = {"candidate": candidate, "entry": entry}
        return candidate

    entities = list(persons.items()) + list(places.items())
    for slug, entry in entities:
        refs = [r for r in entry["refs"] if r in verse_tset]
        if not refs:
            continue
        add_entity(slug, entry)
        kind = "location" if entry["type"] == "place" else "participant"
        for (b, c, v) in sorted(refs):
            vk = verse_key(b, c, v)
            akey = f"attestation:wb-{slug}-{c}-{v}"
            attestations.append(
                {
                    "attestation_key": akey,
                    "reference_key": vk,
                    "entity_key": f"entity:{slug}",
                    "kind": kind,
                    "textual_basis": "explicit",
                    "identification_status": "established",
                    "claim_keys": [],
                    "review_status": "draft",
                }
            )
            verse_to_attest.setdefault(vk, []).append(akey)
        if entry["type"] == "place":
            places_records.append(
                {
                    "entity_key": f"entity:{slug}",
                    "geographic_positions": [
                        {
                            "evidence_item_key": entry["evidence"],
                            "precision": "approximate",
                            "claim_keys": [],
                        }
                    ],
                    "review_status": "draft",
                }
            )

    canonical = envelope(
        osis,
        "canonical",
        "canonical-context-draft",
        all_scopes,
        all_verse_keys,
        None,
        None,
        refsys,
        trans,
        registry_digest,
        {
            "entity_candidates": candidates,
            "claims": [],
            "citations": [],
            "attestations": attestations,
            "relationships": [],
            "events": [],
            "places": places_records,
            "relevance": [],
            "reconciliation_records": reconciliations,
        },
        [{"annotation_class": "canonical_entity_attestation", "groups": reference_groups(verse_to_attest)}],
        [],
    )

    # edition mentions: locate each entity's surface form in the BSB verse text
    mentions: list[dict] = []
    verse_to_mention: dict[str, list[str]] = {vk: [] for vk in all_verse_keys}
    attestation_index = {a["attestation_key"]: a for a in attestations}
    for a in attestations:
        b, c, v = a["reference_key"].split(":")[1].split(".")
        text = verse_text.get((int(c), int(v)), "")
        slug = a["entity_key"].split("entity:", 1)[1]
        entry = entity_in_book[slug]["entry"]
        if lang == "en":
            if entry["type"] == "person":
                candidates_forms = [entry["name"]] + sorted(person_labels.get(slug, []))
            else:
                candidates_forms = [entry["name"]] + sorted(entry.get("aliases", []))
        else:
            # Non-English editions locate the translation-specific surface form
            # discovered from the translation's own verse text.
            local = locale_names.get(slug)
            if not local:
                continue
            candidates_forms = [local]
        if lang == "en":
            found = search_quote(text, candidates_forms)
        else:
            found = search_quote(
                text,
                candidates_forms,
                boundary="[\u0c00-\u0c7f]",
                require_tail=False,
            )
        if not found:
            continue
        quote, ordinal, prefix, suffix = found
        akey = a["attestation_key"]
        mkey = f"mention:wb:{slug}-{c}-{v}"
        mentions.append(
            {
                "mention_key": mkey,
                "verse_key": a["reference_key"],
                "attestation_key": akey,
                "target": {"type": "entity", "key": a["entity_key"]},
                "mention_form": "explicit_name",
                "selector": {
                    "exact_quote": quote,
                    "occurrence_ordinal": ordinal,
                    "prefix": prefix,
                    "suffix": suffix,
                },
                "claim_keys": [],
                "review_status": "draft",
            }
        )
        verse_to_mention.setdefault(a["reference_key"], []).append(mkey)
    # drop mention keys whose attestation was not found
    for vk in verse_to_mention:
        verse_to_mention[vk] = list(dict.fromkeys(verse_to_mention[vk]))
    valid_mention_keys = {m["mention_key"] for m in mentions}
    for vk in verse_to_mention:
        verse_to_mention[vk] = [k for k in verse_to_mention[vk] if k in valid_mention_keys]

    edition = envelope(
        osis,
        "edition",
        "translation-mention-draft",
        all_scopes,
        all_verse_keys,
        lang,
        edition_key,
        refsys,
        trans,
        registry_digest,
        {"mentions": mentions},
        [{"annotation_class": "translation_mention", "groups": reference_groups(verse_to_mention)}],
        [],
    )

    if lang != "en":
        canonical["editorial_observations"].append(
            {
                "code": "versification-alignment-unverified",
                "note": "Attestation reference coordinates are aligned to this "
                "edition's canon skeleton. Where this edition's versification "
                "differs from the source reference system, exact alignment "
                "requires TVTMS verification, which has not yet been applied.",
            }
        )
        edition["editorial_observations"].append(
            {
                "code": "translation-mention-coverage-limited",
                "note": "Translation mentions are emitted only for entities whose "
                "name form was derived from this translation's own text; verses "
                "without such a form are reported complete_zero in this draft.",
            }
        )

    # locale: profiles, passage contexts, relevance localizations
    profiles = []
    for slug, info in entity_in_book.items():
        entry = info["entry"]
        if lang != "en" and slug not in locale_names:
            # No licensed translation-specific name form was derived from this
            # edition's own text, so no localized profile is emitted.
            continue
        name = display(slug, entry["name"])
        if lang == "en":
            aliases = sorted(
                a for a in entry.get("aliases", set()) if a and a != entry["name"]
            )
            kind_word = "person" if entry["type"] == "person" else "place"
            desc = f"{name} is a {kind_word} named in the book of {book['name']}."
        else:
            aliases = []
            if entry["type"] == "person":
                desc = f"{name}, {book['name']} గ్రంథంలో పేర్కొనబడిన వ్యక్తి."
            else:
                desc = f"{name}, {book['name']} గ్రంథంలో పేర్కొనబడిన స్థలం."
        profiles.append(
            {
                "profile_key": f"profile:{lang}:{slug}",
                "entity_key": f"entity:{slug}",
                "language_tag": lang,
                "preferred_name": name,
                "aliases": aliases,
                "short_description": {"text": desc, "claim_keys": []},
                "extended_description": None,
                "review_status": "draft",
            }
        )

    contexts = []
    questions = []
    relevance_localizations = []
    blocked_scope_contexts: list[tuple[str, str, list[str]]] = []
    complete_scope_contexts: list[tuple[str, str]] = []

    def add_question(context_key: str, field: str, qtype: str, note: str, blocking: bool) -> str:
        qkey = f"question:wb-{slugify(context_key)}-{field}"
        questions.append(
            {
                "question_key": qkey,
                "question_type": qtype,
                "record_key": context_key,
                "field_path": f"/records/passage_contexts/orientation/{field}",
                "question": note,
                "blocks_publication": blocking,
            }
        )
        return qkey

    def section(text: str | None, qkey: str | None) -> dict:
        return {"text": text, "claim_keys": [], "open_question_key": qkey}

    def entities_in_range(ch: int, start: int, end: int) -> tuple[list[str], list[str]]:
        ppl, pls = [], []
        for slug, info in entity_in_book.items():
            for r in info["entry"]["refs"]:
                b, c, v = r
                if b == osis and c == ch and start <= v <= end:
                    (ppl if info["entry"]["type"] == "person" else pls).append(
                        display(slug, info["entry"]["name"])
                    )
                    break
        return sorted(set(ppl)), sorted(set(pls))

    # book context from authored knowledge
    k = knowledge.get(osis, {})
    book_ctx = f"context:{lang}:{book_slug}"

    def build_context(context_key: str, scope: str, sections: dict[str, str | None], qtypes: dict[str, str]) -> dict:
        built = {}
        blockers = []
        for field in ("who", "where", "when", "what", "before", "stakes", "immediate_summary"):
            text = sections.get(field)
            if text:
                built[field] = section(text, None)
            else:
                qkey = add_question(
                    context_key,
                    field,
                    qtypes.get(field, "insufficient_evidence"),
                    f"{field.capitalize()} context is not supported by the approved inputs for this scope.",
                    True,
                )
                blockers.append(qkey)
                built[field] = section(None, qkey)
        contexts.append(
            {
                "context_key": context_key,
                "scope_key": scope,
                "language_tag": lang,
                "orientation": built,
                "review_status": "draft",
            }
        )
        if blockers:
            blocked_scope_contexts.append((scope, context_key, blockers))
        else:
            complete_scope_contexts.append((scope, context_key))
        return built

    build_context(
        book_ctx,
        book_scope,
        {
            "who": k.get("who"),
            "where": k.get("setting"),
            "when": k.get("date"),
            "what": k.get("overview"),
            "before": k.get("before"),
            "stakes": k.get("stakes"),
            "immediate_summary": k.get("overview"),
        },
        {"when": "uncertain_date"},
    )

    # chapter contexts
    for ch in book["chapters"]:
        if ch["n"] not in chapter_scopes:
            continue
        headings = [b["text"] for b in ch["blocks"] if b.get("t") == "h"]
        ch_verses = [v for (c, v, _) in verses if c == ch["n"]]
        ppl, pls = entities_in_range(ch["n"], min(ch_verses), max(ch_verses))
        what = (
            "This chapter: " + "; ".join(headings) + "."
            if headings
            else f"{book['name']} {ch['n']}."
        )
        build_context(
            f"context:{lang}:{book_slug}-{ch['n']}",
            chapter_scopes[ch["n"]],
            {
                "who": ("Present in this chapter: " + ", ".join(ppl[:8]) + ".") if ppl else None,
                "where": ("Places in this chapter: " + ", ".join(pls[:8]) + ".") if pls else None,
                "when": None,
                "what": what,
                "before": None,
                "stakes": None,
                "immediate_summary": what,
            },
            {"when": "uncertain_date"},
        )

    # passage contexts
    for p in passage_scopes:
        ppl, pls = entities_in_range(p["chapter"], p["start"], p["end"])
        title = p["title"] or f"{book['name']} {p['chapter']}:{p['start']}-{p['end']}"
        build_context(
            f"context:{lang}:{p['slug']}",
            p["scope"],
            {
                "who": ("Present in this passage: " + ", ".join(ppl[:8]) + ".") if ppl else None,
                "where": ("Places in this passage: " + ", ".join(pls[:8]) + ".") if pls else None,
                "when": None,
                "what": title + ".",
                "before": None,
                "stakes": None,
                "immediate_summary": title + ".",
            },
            {"when": "uncertain_date"},
        )

    # relevance + localizations at chapter scope
    relevance_records = []
    for slug, info in entity_in_book.items():
        for ch, scope in chapter_scopes.items():
            refs = [r for r in info["entry"]["refs"] if r[0] == osis and r[1] == ch]
            if not refs:
                continue
            importance = "central" if len(refs) >= 5 else ("supporting" if len(refs) >= 2 else "background")
            rkey = f"relevance:wb-{osis.lower()}-{ch}-{slug}"
            relevance_records.append(
                {
                    "relevance_key": rkey,
                    "scope_key": scope,
                    "entity_key": f"entity:{slug}",
                    "importance": importance,
                    "is_attested": True,
                    "claim_keys": [],
                    "review_status": "draft",
                }
            )
            if lang != "en" and slug not in locale_names:
                continue
            verses_list = sorted(r[2] for r in refs)
            verse_ref = ", ".join(str(x) for x in verses_list[:12]) + (
                "." if len(verses_list) <= 12 else ", among others."
            )
            if lang == "en":
                role_text = f"Named in {book['name']} {ch} at verse(s) {verse_ref}"
            else:
                role_text = (
                    f"{display(slug, info['entry']['name'])} — {book['name']} "
                    f"{ch}: {verse_ref}"
                )
            relevance_localizations.append(
                {
                    "localization_key": f"relevance-localization:{lang}:{rkey.split(':', 1)[1]}",
                    "relevance_key": rkey,
                    "scope_key": scope,
                    "entity_key": f"entity:{slug}",
                    "language_tag": lang,
                    "role_text": role_text,
                    "claim_keys": [],
                    "review_status": "draft",
                }
            )

    # canonical package gains relevance after the fact
    canonical["records"]["relevance"] = relevance_records

    locale_groups: list[dict] = []
    if complete_scope_contexts:
        locale_groups.append(
            {
                "result": "complete_with_records",
                "scope_keys": [s for s, _ in complete_scope_contexts],
                "record_keys": [c for _, c in complete_scope_contexts],
                "blocker_question_keys": [],
            }
        )
    if blocked_scope_contexts:
        locale_groups.append(
            {
                "result": "blocked",
                "scope_keys": [s for s, _, _ in blocked_scope_contexts],
                "record_keys": [c for _, c, _ in blocked_scope_contexts],
                "blocker_question_keys": sorted({q for _, _, qs in blocked_scope_contexts for q in qs}),
            }
        )

    locale = envelope(
        osis,
        "locale",
        "locale-context-draft",
        all_scopes,
        all_verse_keys,
        lang,
        None,
        refsys,
        trans,
        registry_digest,
        {
            "entity_profiles": profiles,
            "passage_contexts": contexts,
            "relevance_localizations": relevance_localizations,
        },
        [{"annotation_class": "passage_context_localization", "groups": locale_groups}],
        questions,
    )

    return {
        "canonical": canonical,
        "edition": edition,
        "locale": locale,
        "passage_count": len(passage_scopes),
        "chapter_count": len(chapter_scopes),
    }


# ---------------------------------------------------------------------------
# registry + status
# ---------------------------------------------------------------------------

def build_registry(persons: dict, places: dict, verse_key_set: set[str]) -> dict:
    entries = []
    for slug, entry in list(persons.items()) + list(places.items()):
        refs = sorted(r for r in entry["refs"] if r in verse_key_set)
        if not refs:
            continue
        entries.append(
            {
                "entity_key": f"entity:{slug}",
                "slug": slug,
                "type": entry["type"],
                "preferred_name": entry["name"],
                "aliases": sorted(a for a in entry.get("aliases", set()) if a and a != entry["name"]),
                "verse_count": len(refs),
                "first_reference": f"{refs[0][0]}.{refs[0][1]}.{refs[0][2]}",
                "last_reference": f"{refs[-1][0]}.{refs[-1][1]}.{refs[-1][2]}",
            }
        )
    entries.sort(key=lambda e: e["entity_key"])
    return {
        "registry_version": "1.0.0",
        "data_classification": DATA_CLASSIFICATION,
        "attribution": SOURCE_ATTRIBUTION,
        "entity_count": len(entries),
        "entities": entries,
    }


def load_translation_text(asset: str) -> dict[tuple[str, int, int], str]:
    texts: dict[tuple[str, int, int], str] = {}
    for path in sorted((SCRIPTURE / asset).glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        osis = data["osis"]
        for ch in data["chapters"]:
            for block in ch["blocks"]:
                if block.get("t") == "v":
                    texts[(osis, ch["n"], block["n"])] = block["text"]
    return texts


def derive_locale_names(
    entities: dict[str, dict],
    texts: dict[tuple[str, int, int], str],
    min_verses: int = 15,
    min_coverage: float = 0.5,
    min_lift: float = 8.0,
) -> dict[str, str]:
    """Derive translation-specific entity name forms from a translation's own text.

    A token is accepted only when it co-occurs across a majority of an entity's
    attested verses and is far rarer in the corpus at large (lift), so generic
    words are rejected. Nothing is transliterated or invented: only strings
    present in the translation are returned, and entities without a confident
    token simply receive no localized name."""
    if not texts:
        return {}

    def tokens(text: str) -> list[str]:
        return re.findall(r"[\u0c00-\u0c7f]+", text)

    global_count: collections.Counter = collections.Counter()
    for text in texts.values():
        global_count.update(set(tokens(text)))
    total = len(texts)

    names: dict[str, str] = {}
    for slug, entry in entities.items():
        present = [r for r in entry["refs"] if r in texts]
        if len(present) < min_verses:
            continue
        entity_count: collections.Counter = collections.Counter()
        for ref in present:
            entity_count.update(set(tokens(texts[ref])))
        best: tuple[tuple[float, float, int], str] | None = None
        for token, count in entity_count.items():
            if len(token) < 3 or global_count[token] == 0:
                continue
            coverage = count / len(present)
            if coverage < min_coverage:
                continue
            lift = coverage / (global_count[token] / total)
            if lift < min_lift:
                continue
            score = (lift, coverage, len(token))
            if best is None or score > best[0]:
                best = (score, token)
        if best is not None:
            names[slug] = best[1]
    return names


def update_status(book_stats: dict[str, dict], persons_total: int, places_total: int) -> None:
    if not STATUS.exists():
        return
    status = json.loads(STATUS.read_text(encoding="utf-8"))
    summary = status.setdefault("summary", {})
    for book in status.get("books", []):
        c = book.setdefault("counts", {})
        stats = book_stats.get(book["osis"])
        if not stats:
            continue
        c.update(stats)
        c.setdefault("claims", 0)
        book["status"] = "drafting"
        stages = book.setdefault("stages", {})
        for stage in stages:
            stages[stage] = "drafting"
        stages["passage_relevance_orientation"] = "blocked"
    summary["books_not_started"] = sum(
        1 for b in status.get("books", []) if b.get("status") == "not_started"
    )
    summary["books_blocked"] = sum(
        1 for b in status.get("books", []) if b.get("status") == "blocked"
    )
    for key in (
        "passages_curated",
        "entities",
        "attestations",
        "claims",
        "mentions",
        "contexts",
        "profiles",
        "localizations",
        "mentions_te",
        "contexts_te",
        "profiles_te",
        "localizations_te",
    ):
        summary[f"{key}_total"] = sum(
            stats.get(key, 0) for stats in book_stats.values()
        )
    status["status"] = (
        "DRAFT MACHINE-GENERATED — whole-Bible structural context fixtures exist for "
        "BSB (en) and Telugu IRV (te); nothing reviewed, approved or published; "
        "historical/chronological context blocked on evidence."
    )
    status["translations_curated"] = ["bsb:en", "tel_irv:te"]
    status["generated_by"] = "tools/curate_whole_bible.py"
    STATUS.write_text(
        json.dumps(status, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

BSB_TO_OSIS: dict[str, str] = {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate whole-Bible draft curation packages.")
    parser.add_argument("--books", nargs="*", help="OSIS codes to generate (default: all).")
    parser.add_argument(
        "--translations",
        nargs="*",
        default=list(TRANSLATIONS),
        help="Translation ids to generate (default: all).",
    )
    parser.add_argument("--out", default=str(OUT), help="Output directory.")
    parser.add_argument("--no-status", action="store_true", help="Do not update the status register.")
    args = parser.parse_args()

    all_books = load_books("bsb")
    for b in all_books:
        BSB_TO_OSIS[b["bsb"]] = b["osis"]

    knowledge_all = json.loads(KNOWLEDGE.read_text(encoding="utf-8"))
    persons, person_labels = load_persons()
    places = load_places()
    entities_all = {**persons, **places}

    valid = set()
    for book in all_books:
        for c, v, _ in book_verse_index(book):
            valid.add((book["osis"], c, v))
    registry = build_registry(persons, places, valid)

    out = Path(args.out)
    (out / "registry").mkdir(parents=True, exist_ok=True)
    registry_path = out / "registry" / "entities.json"
    registry_path.write_text(
        json.dumps(registry, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    registry_digest = sha256_file(registry_path)

    selected = set(args.books) if args.books else None
    book_stats: dict[str, dict] = {}

    for trans_id, cfg in TRANSLATIONS.items():
        if trans_id not in args.translations:
            continue
        books = load_books(cfg["asset"])
        knowledge = knowledge_all.get(cfg["knowledge"], {})
        locale_names: dict[str, str] = {}
        if cfg["lang"] != "en":
            texts = load_translation_text(cfg["asset"])
            locale_names = derive_locale_names(entities_all, texts)
            print(
                f"{trans_id}: derived {len(locale_names)} translation-specific names",
                flush=True,
            )
        out_trans = out / cfg["out"] if cfg["out"] else out
        for book in books:
            if selected and book["osis"] not in selected:
                continue
            data = generate_book(
                book,
                persons,
                person_labels,
                places,
                knowledge,
                registry_digest,
                cfg,
                locale_names,
            )
            for layer in ("canonical", "edition", "locale"):
                layer_dir = out_trans / layer
                layer_dir.mkdir(parents=True, exist_ok=True)
                path = layer_dir / f"{book['osis']}.v2.json"
                path.write_text(
                    json.dumps(data[layer], indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8",
                )
            canon = data["canonical"]["records"]
            ed = data["edition"]["records"]
            loc = data["locale"]["records"]
            stats = book_stats.setdefault(book["osis"], {})
            stats.setdefault("passages_curated", data["passage_count"])
            stats.setdefault("chapters_curated", data["chapter_count"])
            if cfg["lang"] == "en":
                stats["entities"] = len(canon["entity_candidates"])
                stats["attestations"] = len(canon["attestations"])
                stats["mentions"] = len(ed["mentions"])
                stats["contexts"] = len(loc["passage_contexts"])
                stats["profiles"] = len(loc["entity_profiles"])
                stats["localizations"] = len(loc["relevance_localizations"])
                stats["claims"] = 0
            else:
                suffix = cfg["lang"]
                stats[f"mentions_{suffix}"] = len(ed["mentions"])
                stats[f"contexts_{suffix}"] = len(loc["passage_contexts"])
                stats[f"profiles_{suffix}"] = len(loc["entity_profiles"])
                stats[f"localizations_{suffix}"] = len(loc["relevance_localizations"])
            print(
                f"{trans_id:8} {book['osis']:6} passages={data['passage_count']:4} "
                f"entities={len(canon['entity_candidates']):4} "
                f"attestations={len(canon['attestations']):5} "
                f"mentions={len(ed['mentions']):5} "
                f"contexts={len(loc['passage_contexts']):5} "
                f"profiles={len(loc['entity_profiles']):5}",
                flush=True,
            )

    if not args.no_status:
        update_status(book_stats, len(persons), len(places))
    print(f"registry entities: {registry['entity_count']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
