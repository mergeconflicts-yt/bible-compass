#!/usr/bin/env python3
"""Resumable whole-canon curation queue (English BSB).

This is the queue driver for the whole-Bible curation track. It curates the
English Berean Standard Bible canon book by book and chapter group by chapter
group, validating and checkpointing every job before merging it into
book-level canonical / edition / locale v2 packages (contract 2.0.0, see
docs/curation-structure/*.example.json). Nehemiah 2 (content/nehemiah-2) is
the quality reference; this track only produces draft fixtures.

Design:
  * Canon enumerated from apps/mobile/assets/scripture/bsb/*.json (66 books,
    1,189 chapters).
  * A job is a natural passage group: a bounded run of contiguous chapters
    (never splitting a chapter). Jobs are the unit of validation, retry and
    checkpoint.
  * Inputs (BSB text/headings, BibleData persons/relationships/verse links,
    OpenBible places, authored book knowledge) are read-only local files.
  * Every emitted record is a draft. No historical, chronological or
    interpretive claim is invented: unsupported orientation fields become
    blocking open questions, never filler prose.
  * Entity identity reuses the global registry (content/curated/registry/
    entities.json). Candidates whose source identity is explicitly uncertain
    are kept as unresolved candidates with no attestations.
  * Cross-book reconciliation runs after each book and again for the full
    canon.

Usage:
    python3 tools/curate_canon_queue.py                     # whole canon, resume
    python3 tools/curate_canon_queue.py --books Neh Gen     # subset
    python3 tools/curate_canon_queue.py --force             # re-run all jobs
    python3 tools/curate_canon_queue.py --validate-only     # no writes
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
import curate_whole_bible as cwb  # noqa: E402
import locked_neh2  # noqa: E402

REPO = cwb.REPO
SCRIPTURE = cwb.SCRIPTURE
QUARANTINE = cwb.QUARANTINE
KNOWLEDGE = cwb.KNOWLEDGE
CURATED = cwb.OUT
QUEUE = REPO / "content" / "curation" / "queue"
RECON = REPO / "content" / "curation" / "reconciliation"
COVERAGE = REPO / "content" / "curation" / "canon-coverage.json"

CANON = cwb.CANON
CONTRACT = cwb.CONTRACT
DATA_CLASSIFICATION = cwb.DATA_CLASSIFICATION

TRANSLATION = "bsb"
LANG = "en"
REFSYS = "refsys:eng-v22"
EDITION = "edition:bsb@20260912"
MAX_JOB_VERSES = 150
MAX_JOB_CHAPTERS = 4
GENERATOR_VERSION = "1.0.0"

UNCERTAIN_PATTERN = re.compile(
    r"\b(possib|probab|maybe|may be|uncertain|disputed|perhaps|likely the same|"
    r"same as|identified with|either)\b",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# key grammar (mirrors packages/content-schema/src/packages.ts)
# ---------------------------------------------------------------------------

KEY_PATTERNS = {
    "entity": re.compile(r"^entity:[a-z0-9-]+$"),
    "claim": re.compile(r"^claim:[a-z0-9-]+$"),
    "citation": re.compile(r"^citation:[a-z0-9-]+$"),
    "question": re.compile(r"^question:[a-z0-9-]+$"),
    "attestation": re.compile(r"^attestation:[a-z0-9-]+$"),
    "relationship": re.compile(r"^relationship:[a-z0-9-]+$"),
    "predicate": re.compile(r"^relationship:[a-z0-9_-]+$"),
    "event": re.compile(r"^event:[a-z0-9-]+$"),
    "relevance": re.compile(r"^relevance:[a-z0-9-]+$"),
    "localization": re.compile(r"^relevance-localization:[a-z0-9-]+:[a-z0-9-]+$"),
    "profile": re.compile(r"^profile:[a-z0-9-]+:[a-z0-9-]+$"),
    "context": re.compile(r"^context:[a-z0-9-]+:[a-z0-9-]+$"),
    "mention": re.compile(r"^mention:[a-z0-9-]+:[a-z0-9-]+$"),
    "evidence": re.compile(r"^evidence:[a-z0-9-]+:[a-z0-9-]+$"),
    "candidate": re.compile(r"^candidate:[a-z0-9-]+:[a-z0-9-]+$"),
    "scope": re.compile(r"^scope:[A-Za-z0-9-:.]+$"),
    "verse": re.compile(r"^verse:[A-Za-z1-9][A-Za-z0-9]*\.\d+(\.\d+)?$"),
    "package": re.compile(r"^(draft|approved|registry):[a-z0-9-:]+$"),
    "submission": re.compile(r"^submission:[a-z0-9-:]+$"),
    "job": re.compile(r"^job:[a-z0-9-:]+$"),
}


def jcs(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def jcs_digest(obj) -> str:
    return "sha256:" + hashlib.sha256(jcs(obj).encode("utf-8")).hexdigest()


def sha256_text(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


# ---------------------------------------------------------------------------
# source loading
# ---------------------------------------------------------------------------

def load_registry() -> tuple[dict, str]:
    """Return (registry_by_slug, digest) from the committed global registry."""
    path = CURATED / "registry" / "entities.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    by_slug = {e["slug"]: e for e in data.get("entities", [])}
    return by_slug, cwb.sha256_file(path)


def load_relationships() -> list[dict]:
    rows: list[dict] = []
    path = QUARANTINE / "bibledata" / "BibleData-PersonRelationship.csv"
    if not path.exists():
        return rows
    with path.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            p1 = (row.get("person_id_1") or "").strip()
            p2 = (row.get("person_id_2") or "").strip()
            rtype = (row.get("relationship_type") or "").strip()
            ref = (row.get("reference_id") or "").strip()
            if not (p1 and p2 and rtype and ref):
                continue
            parts = ref.split(" ")
            if len(parts) != 2 or ":" not in parts[1]:
                continue
            bsb_code, cv = parts
            ch, _, vs = cv.partition(":")
            if not ch.isdigit() or not vs.isdigit():
                continue
            osis = cwb.BSB_TO_OSIS.get(bsb_code, bsb_code)
            rows.append(
                {
                    "subject": "p-" + cwb.slugify(p1),
                    "object": "p-" + cwb.slugify(p2),
                    "predicate": "relationship:" + cwb.slugify(rtype),
                    "type": rtype,
                    "category": (row.get("relationship_category") or "").strip(),
                    "osis": osis,
                    "chapter": int(ch),
                    "verse": int(vs),
                }
            )
    return rows


def uncertain_person_slugs() -> set[str]:
    slugs: set[str] = set()
    path = QUARANTINE / "bibledata" / "BibleData-Person.csv"
    if not path.exists():
        return slugs
    with path.open(encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            pid = (row.get("person_id") or "").strip()
            name = (row.get("person_name") or "").strip()
            if not pid or not name:
                continue
            if pid.upper().startswith("YHVH") or name in {
                "YHVH", "YHWH", "LORD", "Lord", "G-d", "GOD", "God", "Yahweh",
            }:
                continue
            blob = " ".join(
                [row.get("person_notes") or "", row.get("unique_attribute") or ""]
            )
            if UNCERTAIN_PATTERN.search(blob):
                slugs.add("p-" + cwb.slugify(pid))
    return slugs


# ---------------------------------------------------------------------------
# job planning
# ---------------------------------------------------------------------------

def plan_jobs(book: dict) -> list[dict]:
    """Bounded contiguous chapter groups. Never splits a chapter."""
    verses = cwb.book_verse_index(book)
    by_ch: dict[int, list[int]] = collections.defaultdict(list)
    for c, v, _ in verses:
        by_ch[c].append(v)
    chapters = [ch["n"] for ch in book["chapters"] if by_ch.get(ch["n"])]
    jobs: list[dict] = []
    current: list[int] = []
    current_verses = 0
    for ch in chapters:
        n_verses = len(by_ch[ch])
        if current and (
            len(current) >= MAX_JOB_CHAPTERS
            or current_verses + n_verses > MAX_JOB_VERSES
        ):
            jobs.append(_job(book, current, by_ch))
            current, current_verses = [], 0
        current.append(ch)
        current_verses += n_verses
    if current:
        jobs.append(_job(book, current, by_ch))
    return jobs


def _job(book: dict, chapters: list[int], by_ch: dict[int, list[int]]) -> dict:
    osis = book["osis"]
    first_ch, last_ch = chapters[0], chapters[-1]
    label = f"c{first_ch}" if first_ch == last_ch else f"c{first_ch}-{last_ch}"
    return {
        "job_id": f"{osis}-{label}",
        "chapters": list(chapters),
        "start": (osis, first_ch, min(by_ch[first_ch])),
        "end": (osis, last_ch, max(by_ch[last_ch])),
    }


def job_verse_keys(book: dict, chapters: list[int]) -> list[str]:
    return [
        cwb.verse_key(book["osis"], c, v)
        for c, v, _ in cwb.book_verse_index(book)
        if c in chapters
    ]


# ---------------------------------------------------------------------------
# book generation + enrichment
# ---------------------------------------------------------------------------

def classify_event(title: str) -> str:
    t = title.lower()
    for key, tag in (
        ("vision", "vision"),
        ("prayer", "prayer"),
        ("genealog", "genealogy"),
        ("covenant", "covenant"),
        ("law", "law"),
        ("song", "song"),
        ("psalm", "song"),
        ("letter", "letter"),
        ("prophec", "prophecy"),
        ("parable", "teaching"),
        ("sermon", "teaching"),
        ("miracle", "miracle"),
        ("battle", "battle"),
        ("war", "battle"),
        ("journey", "journey"),
        ("journeys", "journey"),
        ("birth", "birth"),
        ("death", "death"),
        ("genealogy", "genealogy"),
        ("commission", "commission"),
        ("conquest", "battle"),
        ("dedication", "worship"),
        ("worship", "worship"),
        ("census", "census"), 
        ("plague", "judgment"),
        ("judgment", "judgment"),
        ("instruction", "teaching"),
        ("teaching", "teaching"),
        ("discourse", "teaching"),
    ):
        if key in t:
            return tag
    return "narrative"


def parse_outline(knowledge: dict) -> list[tuple[int, int, str]]:
    out: list[tuple[int, int, str]] = []
    for entry in knowledge.get("outline", []) or []:
        m = re.search(r"\((\d+)(?:\s*[-\u2013]\s*(\d+))?\)\s*$", entry)
        if not m:
            continue
        start = int(m.group(1))
        end = int(m.group(2) or start)
        out.append((start, end, entry[: m.start()].strip()))
    return out


_WORD_BOUNDED = re.compile(r"^$")


def mention_span(mention: dict, verse_text: dict[tuple[int, int], str]) -> tuple[int, int] | None:
    _, c, v = mention["verse_key"].split(":")[1].split(".")
    text = verse_text.get((int(c), int(v)))
    if text is None:
        return None
    quote = mention["selector"]["exact_quote"]
    pattern = re.compile(r"(?<![A-Za-z0-9])" + re.escape(quote) + r"(?![A-Za-z0-9])")
    matches = list(pattern.finditer(text))
    ordinal = mention["selector"]["occurrence_ordinal"]
    if ordinal < 1 or len(matches) < ordinal:
        return None
    match = matches[ordinal - 1]
    return (match.start(), match.end())


def dedupe_mentions(
    mentions: list[dict], verse_text: dict[tuple[int, int], str]
) -> tuple[list[dict], int]:
    by_verse: dict[str, list[tuple[int, int, dict]]] = collections.defaultdict(list)
    for m in mentions:
        span = mention_span(m, verse_text)
        if span is None:
            continue
        by_verse[m["verse_key"]].append((span[0], span[1], m))
    kept: list[dict] = []
    dropped = 0
    for vk, items in by_verse.items():
        # Prefer the longest surface form, then the earliest start, then key.
        items.sort(key=lambda t: (-(t[1] - t[0]), t[0], t[2]["mention_key"]))
        chosen: list[tuple[int, int]] = []
        for s, e, m in items:
            if any(not (e <= cs or s >= ce) for cs, ce in chosen):
                dropped += 1
                continue
            chosen.append((s, e))
            kept.append(m)
    kept.sort(key=lambda m: m["mention_key"])
    return kept, dropped


def enrich_book_data(
    data: dict,
    book: dict,
    knowledge: dict,
    relationships: list[dict],
    registry_keys: set[str],
    uncertain: set[str],
    persons: dict,
    places: dict,
    verse_text: dict[tuple[int, int], str],
    registry_by_slug: dict,
    home_by_slug: dict | None = None,
    bridged_candidates: dict | None = None,
) -> dict:
    osis = book["osis"]
    verses = cwb.book_verse_index(book)
    all_verse_keys = [cwb.verse_key(osis, c, v) for c, v, _ in verses]

    canonical = data["canonical"]
    edition = data["edition"]
    locale = data["locale"]
    crec = canonical["records"]
    erec = edition["records"]
    lrec = locale["records"]

    # 1. drop uncertain identities entirely (unresolved candidates carry no
    #    attestations in this contract) and index the removal.
    dropped_entities = {f"entity:{slug}" for slug in uncertain}
    dropped_candidates = {f"candidate:wb:{slug}" for slug in uncertain}
    # Uncertain identities stay as unresolved candidates (the contract's only
    # representation for "identity not decided"); they carry no attestations,
    # relevance, profiles or mentions.
    for rec in crec.get("reconciliation_records", []):
        if rec["candidate_key"] in dropped_candidates:
            rec["resolution_status"] = "unresolved"
            rec.pop("canonical_entity_key", None)
    crec["attestations"] = [
        a for a in crec["attestations"] if a["entity_key"] not in dropped_entities
    ]
    crec["relevance"] = [
        r for r in crec["relevance"] if r["entity_key"] not in dropped_entities
    ]
    crec["places"] = [
        p for p in crec["places"] if p["entity_key"] not in dropped_entities
    ]
    lrec["entity_profiles"] = [
        p for p in lrec["entity_profiles"] if p["entity_key"] not in dropped_entities
    ]
    lrec["relevance_localizations"] = [
        r
        for r in lrec["relevance_localizations"]
        if r["entity_key"] not in dropped_entities
    ]
    retained_attestations = {a["attestation_key"] for a in crec["attestations"]}
    erec["mentions"] = [
        m for m in erec["mentions"] if m["attestation_key"] in retained_attestations
    ]
    # Overlapping surface forms (the person Haran and the place Haran; the
    # person David inside the place "City of David") are ambiguous referents.
    # The contract forbids overlapping spans in one verse. Keep the longest
    # surface form in each overlap cluster and drop the rest rather than
    # guessing; affected verses keep explicit coverage results.
    erec["mentions"], ambiguous_count = dedupe_mentions(erec["mentions"], verse_text)

    # Book-scope record keys. The un-scoped forms collide across books (an
    # entity in Gen.1.1 and Neh.1.1 produced the same key), which book-local
    # validation could not see. Keys now carry the book OSIS.
    attest_key_map: dict[str, str] = {}
    for a in crec["attestations"]:
        slug = a["entity_key"].split("entity:", 1)[1]
        _, c, v = a["reference_key"].split(":")[1].split(".")
        new_key = f"attestation:wb-{osis.lower()}-{slug}-{c}-{v}"
        attest_key_map[a["attestation_key"]] = new_key
        a["attestation_key"] = new_key
    for m in erec["mentions"]:
        slug = m["target"]["key"].split("entity:", 1)[1]
        _, c, v = m["verse_key"].split(":")[1].split(".")
        m["attestation_key"] = attest_key_map.get(m["attestation_key"], m["attestation_key"])
        m["mention_key"] = f"mention:wb:{osis.lower()}-{slug}-{c}-{v}"

    # Canon-consistent candidate content: entities bridged to a locked Neh2
    # identity use the locked candidate's type/label in every book so the
    # canon-scoped candidate key never conflicts.
    if bridged_candidates:
        for c in crec["entity_candidates"]:
            slug = c["candidate_key"].split("candidate:wb:", 1)[-1]
            locked_c = bridged_candidates.get(slug)
            if not locked_c:
                continue
            for field in (
                "entity_type",
                "proposed_label",
                "possible_existing_entity_keys",
                "identifying_claim_keys",
            ):
                c[field] = locked_c[field]

    # 2. reconciliation: reuse existing global registry identities.
    for rec in crec.get("reconciliation_records", []):
        canonical_key = rec.get("canonical_entity_key")
        if canonical_key is None:
            continue
        rec["resolution_status"] = (
            "resolved_existing" if canonical_key in registry_keys else "created_new_canonical"
        )

    # 3. relationships (only between retained, reconciled entities).
    retained_entities = {a["entity_key"] for a in crec["attestations"]}
    chapter_scope = {}
    passage_scopes: dict[str, str] = {}
    for sk in canonical["scope"]["scope_keys"]:
        m = re.match(r"^scope:(wb-[a-z0-9]+-(?P<ch>\d+)):", sk)
        if m:
            chapter_scope[int(m.group("ch"))] = sk
        else:
            mp = re.match(r"^scope:(wb-[a-z0-9]+-(?P<ch>\d+)-p(?P<idx>\d+)):", sk)
            if mp:
                passage_scopes[f"{osis.lower()}-{mp.group('ch')}-p{mp.group('idx')}"] = sk
    rel_map: dict[str, dict] = {}
    for rel in relationships:
        if rel["osis"] != osis:
            continue
        subj = f"entity:{rel['subject']}"
        obj = f"entity:{rel['object']}"
        if subj not in retained_entities or obj not in retained_entities or subj == obj:
            continue
        key = f"relationship:wb-{osis.lower()}-{rel['subject']}-{cwb.slugify(rel['type'])}-{rel['object']}"
        scope = chapter_scope.get(rel["chapter"])
        if scope is None:
            continue
        rec = rel_map.setdefault(
            key,
            {
                "relationship_key": key,
                "subject_entity_key": subj,
                "predicate_key": rel["predicate"],
                "object_entity_key": obj,
                "applicable_scope_keys": [],
                "claim_keys": [],
                "review_status": "draft",
            },
        )
        if scope not in rec["applicable_scope_keys"]:
            rec["applicable_scope_keys"].append(scope)
    crec["relationships"] = sorted(rel_map.values(), key=lambda r: r["relationship_key"])

    # 4. events from BSB section headings with attested participants.
    entity_refs = {}
    for slug, entry in list(persons.items()) + list(places.items()):
        ekey = f"entity:{slug}"
        if ekey in retained_entities:
            entity_refs[ekey] = entry
    events: list[dict] = []
    for ch in book["chapters"]:
        for i, p in enumerate(cwb.chapter_passages(ch), start=1):
            if not p["title"]:
                continue
            slug = f"{osis.lower()}-{ch['n']}-p{i}"
            scope = passage_scopes.get(slug)
            if scope is None:
                continue
            participants, event_places = [], []
            for ekey, entry in entity_refs.items():
                for (b, c, v) in entry["refs"]:
                    if b == osis and c == ch["n"] and p["start_verse"] <= v <= p["end_verse"]:
                        (event_places if entry["type"] == "place" else participants).append(ekey)
                        break
            if not participants and not event_places:
                continue
            events.append(
                {
                    "event_key": f"event:wb-{slug}",
                    "event_type": classify_event(p["title"]),
                    "participant_entity_keys": sorted(set(participants)),
                    "place_entity_keys": sorted(set(event_places)),
                    "scripture_accounts": [{"scope_key": scope, "relation": "reports"}],
                    "claim_keys": [],
                    "review_status": "draft",
                }
            )
    crec["events"] = sorted(events, key=lambda e: e["event_key"])

    # 4b. Canon-scoped definitions are consolidated to ONE authoritative
    # payload per canonical key: the entity candidate and place definition are
    # emitted only in the entity's home book. Every other book references the
    # global registry through a registry-backed reconciliation record instead.
    referenced: set[str] = set()
    for a in crec["attestations"]:
        referenced.add(a["entity_key"])
    for r in crec["relationships"]:
        referenced.add(r["subject_entity_key"])
        referenced.add(r["object_entity_key"])
    for e in crec["events"]:
        referenced.update(e["participant_entity_keys"])
        referenced.update(e["place_entity_keys"])
    for r in crec["relevance"]:
        referenced.add(r["entity_key"])
    for p in crec["places"]:
        referenced.add(p["entity_key"])
    crec["reconciliation_records"] = [
        {
            "canonical_entity_key": key,
            "resolution_status": "resolved_existing",
            "review_status": "draft",
        }
        for key in sorted(referenced)
    ]
    if home_by_slug is not None:
        crec["entity_candidates"] = [
            c
            for c in crec["entity_candidates"]
            if home_by_slug.get(c["candidate_key"].split("candidate:wb:", 1)[-1], osis) == osis
        ]
        crec["places"] = [
            p
            for p in crec["places"]
            if home_by_slug.get(p["entity_key"].split("entity:", 1)[1], osis) == osis
        ]

    # 5. explicit, verse-level coverage for attestations and mentions.
    verse_to_attest: dict[str, list[str]] = {vk: [] for vk in all_verse_keys}
    for a in crec["attestations"]:
        verse_to_attest.setdefault(a["reference_key"], []).append(a["attestation_key"])
    verse_to_mention: dict[str, list[str]] = {vk: [] for vk in all_verse_keys}
    for m in erec["mentions"]:
        verse_to_mention.setdefault(m["verse_key"], []).append(m["mention_key"])
    canonical["coverage"] = [
        {
            "annotation_class": "canonical_entity_attestation",
            "groups": cwb.reference_groups(verse_to_attest),
        }
    ]
    edition["coverage"] = [
        {
            "annotation_class": "translation_mention",
            "groups": cwb.reference_groups(verse_to_mention),
        }
    ]

    # 6. authored, book-specific context (replaces generic generated prose).
    outline = parse_outline(knowledge)
    by_context = {c["context_key"]: c for c in lrec["passage_contexts"]}

    book_key = f"context:{LANG}:wb-{osis.lower()}"
    book_ctx = by_context.get(book_key)
    if book_ctx and knowledge:
        def set_text(field: str, text: str | None) -> None:
            if text is None:
                return
            section = book_ctx["orientation"][field]
            section["text"] = text

        set_text("who", knowledge.get("who"))
        set_text("where", knowledge.get("setting"))
        set_text("when", knowledge.get("date"))
        genre = knowledge.get("genre")
        what = knowledge.get("overview") or ""
        if genre:
            what = (what + " Genre: " + genre + ".").strip()
        set_text("what", what or None)
        set_text("immediate_summary", what or None)
        set_text("before", knowledge.get("before"))
        set_text("stakes", knowledge.get("stakes"))

    def outline_label(ch: int) -> str | None:
        labels = [lbl for (s, e, lbl) in outline if s <= ch <= e]
        if not labels:
            return None
        seen, out = set(), []
        for lbl in labels:
            if lbl and lbl not in seen:
                seen.add(lbl)
                out.append(lbl)
        return "; ".join(out)

    for ch in book["chapters"]:
        ckey = f"context:{LANG}:wb-{osis.lower()}-{ch['n']}"
        ctx = by_context.get(ckey)
        if not ctx:
            continue
        headings = [b["text"] for b in ch["blocks"] if b.get("t") == "h"]
        pieces = [f"{book['name']} {ch['n']}."]
        label = outline_label(ch["n"])
        if label:
            pieces.append(label + ".")
        if headings:
            pieces.append("Sections: " + "; ".join(headings) + ".")
        text = " ".join(pieces)
        ctx["orientation"]["what"]["text"] = text
        ctx["orientation"]["immediate_summary"]["text"] = text

    for ch in book["chapters"]:
        for i, p in enumerate(cwb.chapter_passages(ch), start=1):
            slug = f"wb-{osis.lower()}-{ch['n']}-p{i}"
            ctx = by_context.get(f"context:{LANG}:{slug}")
            if not ctx:
                continue
            title = p["title"] or f"{book['name']} {ch['n']}:{p['start_verse']}-{p['end_verse']}"
            label = outline_label(ch["n"])
            text = title + (" (" + label + ")" if label else "") + "."
            ctx["orientation"]["what"]["text"] = text
            ctx["orientation"]["immediate_summary"]["text"] = text

    # 7. profiles are canon-scoped, not book-scoped. The same entity appears
    # in many book packages; identical, registry-derived text keeps those
    # definitions consistent instead of conflicting (1388 collisions before).
    person_entity_keys = {f"entity:{s}" for s in persons}
    for prof in lrec["entity_profiles"]:
        ekey = prof["entity_key"]
        slug = ekey.split("entity:", 1)[1]
        entry = registry_by_slug.get(slug, {})
        first = entry.get("first_reference", "Scripture")
        last = entry.get("last_reference", "Scripture")
        kind = "person" if ekey in person_entity_keys else "place"
        span = first if first == last else f"{first}\u2013{last}"
        prof["short_description"]["text"] = (
            f"{prof['preferred_name']} is a {kind} named in Scripture ({span})."
        )
    # Profiles are canon-scoped: emit each entity's profile once, in its home
    # book (Nehemiah for locked identities), so the same profile_key never
    # repeats with differing content.
    if home_by_slug is not None:
        lrec["entity_profiles"] = [
            p
            for p in lrec["entity_profiles"]
            if home_by_slug.get(p["entity_key"].split("entity:", 1)[1], osis) == osis
        ]

    # 8. package identity for the merged book package.
    # Translation-neutral identities: the canonical package names neither a
    # language nor an edition; the edition package carries the BSB edition;
    # the locale package names the language only.
    stems = {
        "canonical": f"wb-{osis.lower()}-canonical",
        "edition": f"wb-{TRANSLATION}-{osis.lower()}-edition",
        "locale": f"wb-{LANG}-{osis.lower()}-locale",
    }
    for pkg, layer in ((canonical, "canonical"), (edition, "edition"), (locale, "locale")):
        stem = stems[layer]
        pkg["package_key"] = f"draft:{stem}"
        pkg["submission_id"] = f"submission:{stem}:attempt-1"
        pkg["produced_for_job_id"] = f"job:{stem}"

    canonical["editorial_observations"] = [
        {"code": "source-attribution", "note": cwb.SOURCE_ATTRIBUTION},
        {
            "code": "machine-generated-draft",
            "note": "Generated by tools/curate_canon_queue.py from BSB structure and headings, BibleData persons/relationships, OpenBible places (CC BY 4.0), and authored book knowledge (tools/whole_bible_knowledge.json).",
        },
        {
            "code": "events-projected-from-headings",
            "note": "Event records are structural projections of BSB section headings with the participants and places attested in that passage; they carry no independent historical claim.",
        },
    ]
    if ambiguous_count:
        canonical["editorial_observations"].append(
            {
                "code": "ambiguous-mention-referents-dropped",
                "note": f"{ambiguous_count} mention(s) dropped because a surface form in a verse was shared by two entities (ambiguous referent); the affected verses keep explicit complete_zero results.",
            }
        )
        edition["editorial_observations"] = [
            *edition.get("editorial_observations", []),
            {
                "code": "ambiguous-mention-referents-dropped",
                "note": f"{ambiguous_count} mention(s) dropped because a surface form in a verse was shared by two entities (ambiguous referent).",
            },
        ]

    data["passages"] = []
    for ch in book["chapters"]:
        for i, p in enumerate(cwb.chapter_passages(ch), start=1):
            data["passages"].append(
                {
                    "slug": f"wb-{osis.lower()}-{ch['n']}-p{i}",
                    "chapter": ch["n"],
                    "start": p["start_verse"],
                    "end": p["end_verse"],
                    "title": p["title"],
                }
            )
    return data


# ---------------------------------------------------------------------------
# job slicing + validation
# ---------------------------------------------------------------------------

def _chapter_of_verse_key(vk: str) -> int:
    return int(vk.split(":")[1].split(".")[1])


def _chapter_of_scope(sk: str) -> int | None:
    m = re.match(r"^scope:wb-[a-z0-9]+-(\d+)(?:-p\d+)?:", sk)
    return int(m.group(1)) if m else None


def slice_job(data: dict, book: dict, chapters: list[int]) -> dict:
    chapters = set(chapters)
    crec = data["canonical"]["records"]
    erec = data["edition"]["records"]
    lrec = data["locale"]["records"]
    canonical_groups = []
    for block in data["canonical"]["coverage"]:
        for g in block["groups"]:
            refs = [r for r in g["reference_keys"] if _chapter_of_verse_key(r) in chapters]
            if refs:
                canonical_groups.append({**g, "reference_keys": refs})
    edition_groups = []
    for block in data["edition"]["coverage"]:
        for g in block["groups"]:
            refs = [r for r in g["reference_keys"] if _chapter_of_verse_key(r) in chapters]
            if refs:
                edition_groups.append({**g, "reference_keys": refs})
    return {
        "attestations": [
            a for a in crec["attestations"] if _chapter_of_verse_key(a["reference_key"]) in chapters
        ],
        "relevance": [
            r
            for r in crec["relevance"]
            if _chapter_of_scope(r["scope_key"]) in chapters
        ],
        "mentions": [
            m for m in erec["mentions"] if _chapter_of_verse_key(m["verse_key"]) in chapters
        ],
        "coverage_canonical": {"annotation_class": "canonical_entity_attestation", "groups": canonical_groups},
        "coverage_edition": {"annotation_class": "translation_mention", "groups": edition_groups},
    }


def validate_job(
    job: dict,
    slice_data: dict,
    book: dict,
    verse_text: dict[tuple[int, int], str],
    canonical_attestation_keys: set[str],
) -> dict:
    errors: list[str] = []
    expected_verses = set(job_verse_keys(book, job["chapters"]))

    def check_group_partition(label: str, groups: list[dict]) -> None:
        seen: set[str] = set()
        for g in groups:
            for r in g["reference_keys"]:
                if r in seen:
                    errors.append(f"{label}: overlapping {r}")
                seen.add(r)
            if g["result"] == "complete_zero" and g["record_keys"]:
                errors.append(f"{label}: complete_zero with records")
            if g["result"] == "complete_with_records" and not g["record_keys"]:
                errors.append(f"{label}: complete_with_records without records")
        if seen != expected_verses:
            missing = sorted(expected_verses - seen)
            extra = sorted(seen - expected_verses)
            if missing:
                errors.append(f"{label}: {len(missing)} uncovered verse(s)")
            if extra:
                errors.append(f"{label}: {len(extra)} verse(s) outside job")

    check_group_partition("canonical", slice_data["coverage_canonical"]["groups"])
    check_group_partition("edition", slice_data["coverage_edition"]["groups"])

    for a in slice_data["attestations"]:
        for kind, key in (("attestation", a["attestation_key"]), ("entity", a["entity_key"]), ("verse", a["reference_key"])):
            if not KEY_PATTERNS[kind].match(key):
                errors.append(f"invalid {kind} key {key}")
    for m in slice_data["mentions"]:
        if not KEY_PATTERNS["mention"].match(m["mention_key"]):
            errors.append(f"invalid mention key {m['mention_key']}")
        if m["attestation_key"] not in canonical_attestation_keys:
            errors.append(f"mention {m['mention_key']} -> undefined attestation")
        _, c, v = m["verse_key"].split(":")[1].split(".")
        text = verse_text.get((int(c), int(v)))
        if text is None:
            errors.append(f"mention {m['mention_key']} -> unknown verse {m['verse_key']}")
            continue
        quote = m["selector"]["exact_quote"]
        pattern = re.compile(r"(?<![A-Za-z0-9])" + re.escape(quote) + r"(?![A-Za-z0-9])")
        matches = list(pattern.finditer(text))
        ordinal = m["selector"]["occurrence_ordinal"]
        if len(matches) < ordinal or ordinal < 1:
            errors.append(f"mention {m['mention_key']}: ordinal {ordinal} unresolved")
            continue
        match = matches[ordinal - 1]
        prefix = text[max(0, match.start() - 20) : match.start()]
        suffix = text[match.end() : match.end() + 20]
        if prefix != m["selector"]["prefix"] or suffix != m["selector"]["suffix"]:
            errors.append(f"mention {m['mention_key']}: prefix/suffix mismatch")

    spans: dict[str, list[tuple[int, int, str]]] = collections.defaultdict(list)
    for m in slice_data["mentions"]:
        _, c, v = m["verse_key"].split(":")[1].split(".")
        text = verse_text.get((int(c), int(v)), "")
        quote = m["selector"]["exact_quote"]
        pattern = re.compile(r"(?<![A-Za-z0-9])" + re.escape(quote) + r"(?![A-Za-z0-9])")
        matches = list(pattern.finditer(text))
        ordinal = m["selector"]["occurrence_ordinal"]
        if len(matches) < ordinal:
            continue
        match = matches[ordinal - 1]
        spans[m["verse_key"]].append((match.start(), match.end(), m["mention_key"]))
    for vk, items in spans.items():
        items.sort()
        for (s1, e1, k1), (s2, e2, k2) in zip(items, items[1:]):
            if s2 < e1:
                errors.append(f"overlapping mentions {k1}/{k2} in {vk}")

    digest = jcs_digest(slice_data)
    return {
        "valid": not errors,
        "errors": errors,
        "output_digest": digest,
        "counts": {
            "attestations": len(slice_data["attestations"]),
            "relevance": len(slice_data["relevance"]),
            "mentions": len(slice_data["mentions"]),
            "verses": len(expected_verses),
        },
    }


def job_input_digest(book: dict, chapters: list[int], registry_digest: str, knowledge_digest: str, source_digest: str) -> str:
    payload = {
        "generator": GENERATOR_VERSION,
        "book": book["osis"],
        "chapters": chapters,
        "registry": registry_digest,
        "knowledge": knowledge_digest,
        "source": source_digest,
    }
    return jcs_digest(payload)


# ---------------------------------------------------------------------------
# validation mirror for merged book packages
# ---------------------------------------------------------------------------

def validate_book_packages(data: dict, book: dict) -> list[str]:
    errors: list[str] = []
    canonical, edition, locale = data["canonical"], data["edition"], data["locale"]
    all_verses = set(canonical["scope"]["reference_keys"])

    for pkg, layer, family in (
        (canonical, "canonical", "canonical-context-draft"),
        (edition, "edition", "translation-mention-draft"),
        (locale, "locale", "locale-context-draft"),
    ):
        if pkg["contract_version"] != CONTRACT or pkg["schema_version"] != "2.0.0":
            errors.append(f"{book['osis']}/{layer}: version drift")
        if pkg["data_classification"] != DATA_CLASSIFICATION:
            errors.append(f"{book['osis']}/{layer}: data_classification")
        if pkg["review_status"] != "draft":
            errors.append(f"{book['osis']}/{layer}: not draft")
        if pkg["package_layer"] != layer or pkg["package_family"] != family:
            errors.append(f"{book['osis']}/{layer}: layer/family mismatch")
        if not KEY_PATTERNS["package"].match(pkg["package_key"]):
            errors.append(f"{book['osis']}/{layer}: bad package_key")
        if not pkg["dependencies"]:
            errors.append(f"{book['osis']}/{layer}: no dependencies")

    def partition(label: str, groups: list[dict]) -> None:
        seen: set[str] = set()
        for g in groups:
            for r in g["reference_keys"]:
                if r in seen:
                    errors.append(f"{book['osis']}/{label}: overlapping {r}")
                seen.add(r)
        if seen != all_verses:
            errors.append(
                f"{book['osis']}/{label}: coverage {len(seen)}/{len(all_verses)} verses"
            )

    partition("canonical", canonical["coverage"][0]["groups"])
    partition("edition", edition["coverage"][0]["groups"])

    crec, lrec = canonical["records"], locale["records"]
    entity_keys = {
        r["canonical_entity_key"]
        for r in crec.get("reconciliation_records", [])
        if r.get("canonical_entity_key")
    }
    attestation_keys = {a["attestation_key"] for a in crec["attestations"]}
    relevance_keys = {r["relevance_key"] for r in crec["relevance"]}

    for r in crec["relationships"]:
        for key in (r["subject_entity_key"], r["object_entity_key"]):
            if key not in entity_keys:
                errors.append(f"{book['osis']}: relationship entity {key} unresolved")
    for e in crec["events"]:
        for key in e["participant_entity_keys"] + e["place_entity_keys"]:
            if key not in entity_keys:
                errors.append(f"{book['osis']}: event participant {key} unresolved")
    for m in edition["records"]["mentions"]:
        if m["attestation_key"] not in attestation_keys:
            errors.append(f"{book['osis']}: mention {m['mention_key']} unresolved attestation")
    for p in lrec["entity_profiles"]:
        if p["entity_key"] not in entity_keys:
            errors.append(f"{book['osis']}: profile {p['profile_key']} unresolved entity")
    for r in lrec["relevance_localizations"]:
        if r["relevance_key"] not in relevance_keys:
            errors.append(f"{book['osis']}: localization {r['localization_key']} unresolved relevance")
        if r["entity_key"] not in entity_keys:
            errors.append(f"{book['osis']}: localization {r['localization_key']} unresolved entity")

    context_keys = {c["context_key"] for c in lrec["passage_contexts"]}
    for c in lrec["passage_contexts"]:
        for section in c["orientation"].values():
            qk = section["open_question_key"]
            if qk is not None and qk not in {q["question_key"] for q in locale["open_questions"]}:
                errors.append(f"{book['osis']}: context {c['context_key']} dangling question")
    for q in locale["open_questions"]:
        if q["record_key"] not in context_keys:
            errors.append(f"{book['osis']}: question {q['question_key']} dangling record")

    scope_keys = set(locale["scope"]["scope_keys"])
    for c in lrec["passage_contexts"]:
        if c["scope_key"] not in scope_keys:
            errors.append(f"{book['osis']}: context {c['context_key']} scope outside package")
    if {c["scope_key"] for c in lrec["passage_contexts"]} != scope_keys:
        errors.append(f"{book['osis']}: not every scope has a context")

    for label, kind, keys in (
        ("candidate", "candidate", [c["candidate_key"] for c in crec["entity_candidates"]]),
        ("attestation", "attestation", [a["attestation_key"] for a in crec["attestations"]]),
        ("relationship", "relationship", [r["relationship_key"] for r in crec["relationships"]]),
        ("event", "event", [e["event_key"] for e in crec["events"]]),
        ("relevance", "relevance", [r["relevance_key"] for r in crec["relevance"]]),
        ("profile", "profile", [p["profile_key"] for p in lrec["entity_profiles"]]),
        ("context", "context", [c["context_key"] for c in lrec["passage_contexts"]]),
        ("mention", "mention", [m["mention_key"] for m in edition["records"]["mentions"]]),
        ("question", "question", [q["question_key"] for q in locale["open_questions"]]),
    ):
        if len(keys) != len(set(keys)):
            errors.append(f"{book['osis']}: duplicate {label} keys")
        for key in keys:
            if not KEY_PATTERNS[kind].match(key):
                errors.append(f"{book['osis']}: invalid {label} key {key}")
    return errors


# ---------------------------------------------------------------------------
# reconciliation + coverage reports
# ---------------------------------------------------------------------------

def reconcile_book(books_by_osis: dict, osis: str, data: dict, registry_by_slug: dict, book_states: dict) -> dict:
    crec = data["canonical"]["records"]
    reused, created, unresolved = [], [], []
    for rec in crec.get("reconciliation_records", []):
        if rec["resolution_status"] == "resolved_existing":
            reused.append(rec["canonical_entity_key"])
        elif rec["resolution_status"] == "created_new_canonical":
            created.append(rec["canonical_entity_key"])
        elif rec.get("candidate_key"):
            unresolved.append(rec["candidate_key"])
    resolved_entity_keys = {
        rec["canonical_entity_key"]
        for rec in crec.get("reconciliation_records", [])
        if rec.get("canonical_entity_key")
    }
    unresolved.extend(
        c["candidate_key"]
        for c in crec["entity_candidates"]
        if f"entity:{c['candidate_key'].split('candidate:wb:', 1)[-1]}" not in resolved_entity_keys
    )

    labels: dict[str, list[str]] = collections.defaultdict(list)
    for c in crec["entity_candidates"]:
        labels[c["proposed_label"]].append(c["candidate_key"])

    conflicts = []
    for label, cands in sorted(labels.items()):
        if len(cands) > 1:
            conflicts.append({"proposed_label": label, "candidate_keys": sorted(cands)})

    report = {
        "report_version": "1.0.0",
        "scope": f"book:{osis}",
        "entities_referenced": len(crec["entity_candidates"]),
        "entities_reused": len(set(reused)),
        "entities_created": len(set(created)),
        "unresolved_candidates": sorted(unresolved),
        "same_label_distinct_candidates": conflicts,
        "relationships": len(crec["relationships"]),
        "events": len(crec["events"]),
    }
    return report


def reconcile_canon(
    book_reports: dict[str, dict], books_by_osis: dict, all_data: dict, registry_by_slug: dict
) -> dict:
    unresolved_books: dict[str, set[str]] = collections.defaultdict(set)
    for osis, report in sorted(book_reports.items()):
        for cand in report["unresolved_candidates"]:
            unresolved_books[cand].add(osis)

    # Cross-book identity: the same entity key must carry one type and label
    # wherever it appears, and the registry is the single source of that.
    entity_books: dict[str, set[str]] = collections.defaultdict(set)
    for osis, data in all_data.items():
        for a in data["canonical"]["records"]["attestations"]:
            entity_books[a["entity_key"]].add(osis)
    type_conflicts = []
    for ekey, books in entity_books.items():
        slug = ekey.split("entity:", 1)[1]
        entry = registry_by_slug.get(slug)
        if entry is None:
            type_conflicts.append({"entity_key": ekey, "issue": "not_in_registry"})
            continue
        # every attestation's kind must be consistent with the registry type
        kinds = set()
        for osis in books:
            for a in all_data[osis]["canonical"]["records"]["attestations"]:
                if a["entity_key"] == ekey:
                    kinds.add(a["kind"])
        if entry["type"] == "person" and "location" in kinds:
            type_conflicts.append({"entity_key": ekey, "issue": "person_attested_as_place"})
        if entry["type"] == "place" and "participant" in kinds:
            type_conflicts.append({"entity_key": ekey, "issue": "place_attested_as_participant"})

    return {
        "report_version": "1.0.0",
        "scope": "canon:prot-66",
        "books": len(book_reports),
        "entities_reused_total": sum(r["entities_reused"] for r in book_reports.values()),
        "entities_created_total": sum(r["entities_created"] for r in book_reports.values()),
        "entities_distinct": len(entity_books),
        "entities_in_multiple_books": sum(1 for v in entity_books.values() if len(v) > 1),
        "unresolved_candidates_total": sum(
            len(r["unresolved_candidates"]) for r in book_reports.values()
        ),
        "unresolved_candidates": sorted(
            {c for r in book_reports.values() for c in r["unresolved_candidates"]}
        ),
        "unresolved_books": {
            c: sorted(b) for c, b in sorted(unresolved_books.items())
        },
        "cross_book_type_conflicts": type_conflicts,
    }


def coverage_register(all_data: dict, books_by_osis: dict, job_states: dict, testament_by_osis: dict) -> dict:
    books_out = []
    totals = collections.Counter()
    chapters_total = 0
    for osis in sorted(all_data):
        book = books_by_osis[osis]
        data = all_data[osis]
        crec = data["canonical"]["records"]
        lrec = data["locale"]["records"]
        att_by_ch: dict[int, set[str]] = collections.defaultdict(set)
        for a in crec["attestations"]:
            att_by_ch[_chapter_of_verse_key(a["reference_key"])].add(a["attestation_key"])
        m_by_ch: dict[int, set[str]] = collections.defaultdict(set)
        for m in data["edition"]["records"]["mentions"]:
            m_by_ch[_chapter_of_verse_key(m["verse_key"])].add(m["mention_key"])
        ctx_by_ch: dict[int, set[str]] = collections.defaultdict(set)
        for c in lrec["passage_contexts"]:
            ch = _chapter_of_scope(c["scope_key"])
            if ch is not None:
                ctx_by_ch[ch].add(c["context_key"])
        # Explicit, per-annotation-class verse coverage. complete_zero is only
        # ever claimed for a class that was actually attempted; classes no
        # input produces are reported as not_attempted, never as zero.
        def class_counts(layer: str) -> tuple[int, int]:
            zero = records = 0
            for block in data[layer]["coverage"]:
                for g in block["groups"]:
                    n = len(g["reference_keys"])
                    if g["result"] == "complete_zero":
                        zero += n
                    else:
                        records += n
            return zero, records

        attest_zero, attest_records = class_counts("canonical")
        mention_zero, mention_records = class_counts("edition")
        verse_result: dict[int, str] = {}
        for block in data["canonical"]["coverage"]:
            for g in block["groups"]:
                for ref in g["reference_keys"]:
                    ch = _chapter_of_verse_key(ref)
                    if g["result"] == "complete_zero":
                        verse_result.setdefault(ch, "complete_zero")
                    else:
                        verse_result[ch] = "complete_with_records"
        chapters = []
        for ch in book["chapters"]:
            n = ch["n"]
            att = len(att_by_ch.get(n, ()))
            men = len(m_by_ch.get(n, ()))
            ctx = len(ctx_by_ch.get(n, ()))
            annotation_result = verse_result.get(n, "complete_zero")
            # The chapter has a registered context even where no annotation
            # applies; both facts are reported separately.
            context_result = "complete_with_records" if ctx else "complete_zero"
            chapters_total += 1
            chapters.append(
                {
                    "chapter": n,
                    "annotation_coverage_result": annotation_result,
                    "context_coverage_result": context_result,
                    "attestations": att,
                    "mentions": men,
                    "contexts": ctx,
                }
            )
        books_out.append(
            {
                "osis": osis,
                "name": book["name"],
                "testament": testament_by_osis.get(osis, "OT"),
                "chapters": chapters,
                "chapters_curated": len(chapters),
                "jobs": job_states.get(osis, {}).get("job_count", 0),
                "jobs_done": job_states.get(osis, {}).get("jobs_done", 0),
                "entities": len(crec["entity_candidates"]),
                "attestations": len(crec["attestations"]),
                "mentions": len(data["edition"]["records"]["mentions"]),
                "relationships": len(crec["relationships"]),
                "events": len(crec["events"]),
                "contexts": len(lrec["passage_contexts"]),
                "profiles": len(lrec["entity_profiles"]),
                "coverage_by_class": {
                    "canonical_entity_attestation": {
                        "verses_complete_zero": attest_zero,
                        "verses_complete_with_records": attest_records,
                    },
                    "translation_mention": {
                        "verses_complete_zero": mention_zero,
                        "verses_complete_with_records": mention_records,
                    },
                },
            }
        )
        for cls, (zero, records) in (
            ("canonical_entity_attestation", (attest_zero, attest_records)),
            ("translation_mention", (mention_zero, mention_records)),
        ):
            totals[f"{cls}:zero"] += zero
            totals[f"{cls}:records"] += records

    attempted = [
        "canonical_entity_attestation",
        "translation_mention",
        "canonical_relationship",
        "canonical_event",
        "canonical_entity_relevance",
        "passage_context_localization",
    ]
    not_attempted = [
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
    return {
        "register_version": "1.0.0",
        "register_kind": "whole-canon-coverage",
        "data_classification": DATA_CLASSIFICATION,
        "status": "DRAFT MACHINE-GENERATED — per-annotation-class coverage; classes marked not_attempted were never curated and are not claimed complete; nothing reviewed, approved or published.",
        "generated_by": "tools/curate_canon_queue.py",
        "books_total": len(books_out),
        "chapters_total": chapters_total,
        "verses_total": 31086,
        "annotation_class_coverage": {
            "canonical_entity_attestation": {
                "verses_complete_zero": totals["canonical_entity_attestation:zero"],
                "verses_complete_with_records": totals["canonical_entity_attestation:records"],
            },
            "translation_mention": {
                "verses_complete_zero": totals["translation_mention:zero"],
                "verses_complete_with_records": totals["translation_mention:records"],
            },
        },
        "attempted_annotation_classes": attempted,
        "not_attempted_annotation_classes": not_attempted,
        "not_attempted_note": (
            "Objects, roles, practices, lexical terms, themes, chronology and "
            "meaningful historical context are required by the curation spec but "
            "no approved input or pipeline produces them yet. Verses are NOT "
            "claimed complete for these classes."
        ),
        "books": books_out,
    }


# ---------------------------------------------------------------------------
# main queue
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Resumable whole-canon curation queue (English BSB).")
    parser.add_argument("--books", nargs="*", help="OSIS codes (default: all 66).")
    parser.add_argument("--force", action="store_true", help="Re-run jobs even if checkpointed.")
    parser.add_argument("--validate-only", action="store_true", help="Validate and report; write nothing.")
    parser.add_argument("--report", default=str(QUEUE / TRANSLATION / "run-report.json"))
    args = parser.parse_args()

    books = cwb.load_books("bsb")
    books_by_osis = {b["osis"]: b for b in books}
    for b in books:
        cwb.BSB_TO_OSIS[b["bsb"]] = b["osis"]

    knowledge_books = json.loads(KNOWLEDGE.read_text(encoding="utf-8"))["books"]
    persons, person_labels = cwb.load_persons()
    places = cwb.load_places()
    relationships = load_relationships()

    # Owner-approved identity bridge: the locked Nehemiah 2 identities are
    # canonical, registry entities that denote the same thing are renamed onto
    # them, and locked-only identities are added. The registry is rebuilt from
    # the reconciled entity set so the whole canon reuses one identity each.
    locked = locked_neh2.load_locked()
    persons, places, person_labels, relationships, identity_rename = locked_neh2.apply_identity(
        persons, places, person_labels, relationships, locked
    )
    valid_refs = {
        (b["osis"], c, v)
        for b in books
        for c, v, _ in cwb.book_verse_index(b)
    }
    registry = cwb.build_registry(persons, places, valid_refs)
    registry_by_slug = {e["slug"]: e for e in registry["entities"]}
    registry_keys = {f"entity:{slug}" for slug in registry_by_slug}

    # Home book: where the single authoritative entity/place/profile payload is
    # emitted. Locked Nehemiah 2 identities are homed in Nehemiah.
    home_by_slug: dict[str, str | None] = {}
    for slug, entry in registry_by_slug.items():
        first = entry.get("first_reference") or ""
        home_by_slug[slug] = first.split(".")[0] if first else None
    locked_entity_map = locked_neh2.locked_entities(locked)
    for locked_key in locked_entity_map:
        home_by_slug[locked_key.split("entity:", 1)[1]] = "Neh"

    # Creation provenance lives in the registry, not in per-book reconciliation.
    for entry in registry["entities"]:
        home = home_by_slug.get(entry["slug"])
        entry["provenance"] = "draft canonical identity; reused from the global registry"
        entry["created_from"] = f"draft:wb-{home.lower()}-canonical" if home else None
        entry["source"] = cwb.SOURCE_ATTRIBUTION
    registry["provenance_policy"] = (
        "Canon-scoped entity identity is defined once here; book packages carry "
        "attestations and registry-backed reconciliation references only."
    )

    registry_path = CURATED / "registry" / "entities.json"
    registry_text = json.dumps(registry, indent=2, ensure_ascii=False) + "\n"
    if not args.validate_only:
        registry_path.parent.mkdir(parents=True, exist_ok=True)
        registry_path.write_text(registry_text, encoding="utf-8")
    registry_digest = "sha256:" + hashlib.sha256(registry_text.encode("utf-8")).hexdigest()

    bridged_candidates = {}
    for c in locked["canonical"]["records"]["entity_candidates"]:
        bridged_candidates[c["candidate_key"].split(":")[-1]] = c

    uncertain = uncertain_person_slugs()
    knowledge_digest = cwb.sha256_file(KNOWLEDGE)

    selected = set(args.books) if args.books else set(books_by_osis)
    testament_by_osis = {
        b["osis"]: ("OT" if i < 39 else "NT") for i, b in enumerate(books)
    }
    cfg = cwb.TRANSLATIONS[TRANSLATION]

    manifest_path = QUEUE / TRANSLATION / "manifest.json"
    manifest = {}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest.setdefault("queue_version", "1.0.0")
    manifest.setdefault("translation", TRANSLATION)
    manifest.setdefault("canon", CANON)
    manifest["inputs"] = {
        "registry_digest": registry_digest,
        "knowledge_digest": knowledge_digest,
        "uncertain_slugs": sorted(uncertain),
    }
    manifest.setdefault("books", {})

    all_data: dict[str, dict] = {}
    book_reports: dict[str, dict] = {}
    job_states: dict[str, dict] = {}
    failures: list[dict] = []
    run: list[dict] = []

    for osis in sorted(selected):
        book = books_by_osis[osis]
        knowledge = knowledge_books.get(osis, {})
        source_digest = cwb.sha256_file(SCRIPTURE / "bsb" / f"{book['osis']}.json")
        jobs = plan_jobs(book)
        state = manifest["books"].setdefault(osis, {"jobs": {}})
        job_states[osis] = {"job_count": len(jobs), "jobs_done": 0}

        need_generate = args.force
        for job in jobs:
            recorded = state["jobs"].get(job["job_id"])
            input_digest = job_input_digest(book, job["chapters"], registry_digest, knowledge_digest, source_digest)
            if recorded and recorded.get("status") == "done" and recorded.get("input_digest") == input_digest and not args.force:
                job_states[osis]["jobs_done"] += 1
            else:
                need_generate = True

        if need_generate:
            data = cwb.generate_book(
                book, persons, person_labels, places, knowledge_books, registry_digest, cfg, None
            )
            verse_text = {(c, v): t for c, v, t in cwb.book_verse_index(book)}
            data = enrich_book_data(
                data, book, knowledge, relationships, registry_keys, uncertain, persons, places, verse_text, registry_by_slug, home_by_slug, bridged_candidates
            )
            if book["osis"] == "Neh":
                data = locked_neh2.merge_neh(data, locked, verse_text)
            all_data[osis] = data
        else:
            # Resume: load the merged packages for downstream reports.
            data = {
                layer: json.loads((CURATED / layer / f"{osis}.v2.json").read_text(encoding="utf-8"))
                for layer in ("canonical", "edition", "locale")
            }
            all_data[osis] = data
            job_states[osis]["jobs_done"] = len(jobs)
            report = reconcile_book(books_by_osis, osis, data, registry_by_slug, job_states)
            book_reports[osis] = report
            run.append({"book": osis, "skipped": True, "jobs": len(jobs)})
            continue

        canonical_attestation_keys = {a["attestation_key"] for a in data["canonical"]["records"]["attestations"]}

        book_ok = True
        for job in jobs:
            sl = slice_job(data, book, job["chapters"])
            result = validate_job(job, sl, book, verse_text, canonical_attestation_keys)
            input_digest = job_input_digest(book, job["chapters"], registry_digest, knowledge_digest, source_digest)
            entry = {
                "job_id": job["job_id"],
                "chapters": job["chapters"],
                "status": "done" if result["valid"] else "failed",
                "attempts": (state["jobs"].get(job["job_id"], {}).get("attempts", 0)) + 1,
                "input_digest": input_digest,
                "output_digest": result["output_digest"],
                "counts": result["counts"],
                "errors": result["errors"],
            }
            if result["valid"]:
                job_states[osis]["jobs_done"] += 1
            else:
                book_ok = False
                failures.append({"book": osis, "job_id": job["job_id"], "errors": result["errors"]})
            if not args.validate_only:
                state["jobs"][job["job_id"]] = entry
                write_json(QUEUE / TRANSLATION / osis / f"{job['job_id']}.json", entry)

        if book_ok:
            errors = validate_book_packages(data, book)
            if errors:
                failures.append({"book": osis, "job_id": "merge", "errors": errors})
                book_ok = False

        state["status"] = "done" if book_ok else "failed"
        if book_ok:
            # canonical depends on the registry; edition/locale on canonical.
            data["canonical"]["dependencies"] = [
                {"package_key": "registry:wb:entities", "revision": 1, "digest": registry_digest}
            ]
            canonical_digest = jcs_digest(data["canonical"])
            for layer in ("edition", "locale"):
                data[layer]["dependencies"] = [
                    {
                        "package_key": data["canonical"]["package_key"],
                        "revision": data["canonical"]["package_revision"],
                        "digest": canonical_digest,
                    }
                ]
            if not args.validate_only:
                for layer in ("canonical", "edition", "locale"):
                    write_json(CURATED / layer / f"{osis}.v2.json", data[layer])
            state["package_digests"] = {
                layer: jcs_digest(data[layer]) for layer in ("canonical", "edition", "locale")
            }
            state["counts"] = {
                "chapters": len(book["chapters"]),
                "entities": len(data["canonical"]["records"]["entity_candidates"]),
                "attestations": len(data["canonical"]["records"]["attestations"]),
                "mentions": len(data["edition"]["records"]["mentions"]),
                "contexts": len(data["locale"]["records"]["passage_contexts"]),
            }
        state["jobs_done"] = job_states[osis]["jobs_done"]

        report = reconcile_book(books_by_osis, osis, data, registry_by_slug, job_states)
        book_reports[osis] = report
        if not args.validate_only:
            write_json(RECON / f"{osis}.json", report)
        run.append(
            {
                "book": osis,
                "jobs": len(jobs),
                "jobs_done": job_states[osis]["jobs_done"],
                "status": state["status"],
            }
        )
        print(
            f"{osis:6} jobs={len(jobs):2} done={job_states[osis]['jobs_done']:2} "
            f"entities={report['entities_referenced']:4} reused={report['entities_reused']:4} "
            f"unresolved={len(report['unresolved_candidates']):2} status={state['status']}",
            flush=True,
        )

    if not args.validate_only:
        # Aggregate reports always cover the whole canon: books not selected
        # in this run are read back from their committed packages so a subset
        # run can never truncate the canon-wide reconciliation or coverage.
        full_data: dict[str, dict] = {}
        full_reports: dict[str, dict] = {}
        full_job_states: dict[str, dict] = {}
        for osis in sorted(books_by_osis):
            if osis in all_data:
                data = all_data[osis]
            else:
                try:
                    data = {
                        layer: json.loads(
                            (CURATED / layer / f"{osis}.v2.json").read_text(encoding="utf-8")
                        )
                        for layer in ("canonical", "edition", "locale")
                    }
                except FileNotFoundError:
                    continue
            full_data[osis] = data
            full_reports[osis] = book_reports.get(osis) or reconcile_book(
                books_by_osis, osis, data, registry_by_slug, job_states
            )
            state = manifest["books"].get(osis, {})
            full_job_states[osis] = {
                "job_count": len(state.get("jobs", {})),
                "jobs_done": sum(
                    1 for j in state.get("jobs", {}).values() if j.get("status") == "done"
                ),
            }
        manifest["book_reports"] = full_reports
        write_json(manifest_path, manifest)
        write_json(
            RECON / "canon.json",
            reconcile_canon(full_reports, books_by_osis, full_data, registry_by_slug),
        )
        write_json(
            COVERAGE,
            coverage_register(full_data, books_by_osis, full_job_states, testament_by_osis),
        )

    report = {
        "report_version": "1.0.0",
        "generated_by": "tools/curate_canon_queue.py",
        "books_processed": len(selected),
        "failures": failures,
        "runs": run,
    }
    write_json(Path(args.report), report)

    if failures:
        print(f"FAILED: {len(failures)} job(s)/merge(s) failed; completed checkpoints unchanged.", flush=True)
        return 1
    print("all jobs valid; book packages written.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
