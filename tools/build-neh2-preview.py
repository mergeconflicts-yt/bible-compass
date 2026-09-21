#!/usr/bin/env python3
"""Nehemiah 2 curated mobile preview projection.

Reads the three EN-01 contract packages plus the evidence catalog:
  content/nehemiah-2/canonical.v2.json
  content/nehemiah-2/locale-en.v2.json
  content/nehemiah-2/edition-bsb.v2.json
  content/nehemiah-2/evidence-catalog.json

Validates the packages and every BSB mention selector against the bundled
BSB verse text, then generates ONE bounded mobile asset:
  apps/mobile/assets/content/nehemiah-2.preview.json

The asset is a deterministic projection for preview only. It is never a
source of truth: the app must treat it as unverified draft content and must
show an explicit unavailable/error state when it fails validation instead of
falling back to any legacy draft.

Usage:
  python3 tools/build-neh2-preview.py          # regenerate the asset
  python3 tools/build-neh2-preview.py --check  # fail on drift (CI gate)
"""

from __future__ import annotations

import hashlib
import json
import re
import sys

CHECK = "--check" in sys.argv[1:]
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
NEH2 = REPO / "content" / "nehemiah-2"
BSB_NEH = REPO / "apps" / "mobile" / "assets" / "scripture" / "bsb" / "Neh.json"
OUT = REPO / "apps" / "mobile" / "assets" / "content" / "nehemiah-2.preview.json"

OSIS_NAMES = {"Neh": "Nehemiah", "Ezra": "Ezra"}

PREDICATE_LABELS = {
    "holds_role": "holds the role",
    "serves": "serves",
    "rules": "rules",
    "grants": "grants",
    "provides": "provides",
    "keeper_of": "keeps",
    "opposes": "opposes",
    "located_in": "is located in",
    "ancestral_city_of": "is the ancestral city of",
    "part_of": "is part of",
    "governs": "governs",
    "prays_to": "prays to",
    "inspects": "inspects",
    "agrees_to_rebuild": "agrees to rebuild",
    "will_grant_success": "will grant success to",
    "has_no_claim_in": "has no claim in",
    "broken_down": "is broken down:",
    "destroyed_by_fire": "is destroyed by fire:",
    "preceded_by": "is preceded by",
    "present_at": "is present at",
    "completed_in": "is completed in",
}

PREVIEW_NOTICE = (
    "UNVERIFIED DRAFT PREVIEW — Curated from unreviewed draft packages. "
    "Requires named editorial review before production. Scripture and commentary remain separate."
)


def fail(message: str) -> None:
    print(f"build-neh2-preview: ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def load(name: str) -> dict:
    path = NEH2 / name
    if not path.exists():
        fail(f"missing input {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as exc:
        fail(f"invalid JSON in {name}: {exc}")
    if not isinstance(data, dict):
        fail(f"{name} must be a JSON object")
    return data


def jcs(obj: dict) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def humanize(slug: str) -> str:
    return " ".join(word.capitalize() for word in slug.split("-"))


def scope_slug(scope_key: str) -> str:
    return scope_key.split(":")[1]


def scope_range(scope_key: str) -> str:
    return scope_key.rsplit(":", 1)[1]


def display_range(scope_key: str) -> str:
    start, _, end = scope_range(scope_key).partition("-")
    if not end or start == end:
        return start
    return f"{start}–{end}"


def bsb_texts() -> tuple[dict[int, str], dict[int, str | None]]:
    data = json.loads(BSB_NEH.read_text(encoding="utf-8"))
    chapter = next(c for c in data["chapters"] if c["n"] == 2)
    texts: dict[int, str] = {}
    # Heading that directly opens a verse (the immediately preceding block).
    headings: dict[int, str | None] = {}
    pending: str | None = None
    for block in chapter["blocks"]:
        if block.get("t") == "h":
            pending = block["text"]
        elif block.get("t") == "v":
            texts[block["n"]] = block["text"]
            headings[block["n"]] = pending
            pending = None
    return texts, headings


def mention_matches(text: str, quote: str) -> list[re.Match[str]]:
    """Word-bounded matches: 'us' must never match inside 'Jerusalem'."""
    pattern = re.compile(rf"(?<![A-Za-z0-9]){re.escape(quote)}(?![A-Za-z0-9])")
    return list(pattern.finditer(text))


def check_selector(text: str, quote: str, ordinal: int, prefix: str, suffix: str, where: str) -> tuple[int, int]:
    matches = mention_matches(text, quote)
    if len(matches) < ordinal:
        fail(f"{where}: quote {quote!r} ordinal {ordinal} not found")
    m = matches[ordinal - 1]
    if text[max(0, m.start() - 20) : m.start()] != prefix:
        fail(f"{where}: prefix mismatch")
    if text[m.end() : m.end() + 20] != suffix:
        fail(f"{where}: suffix mismatch")
    return m.start(), m.end()


def main() -> int:
    canonical = load("canonical.v2.json")
    locale = load("locale-en.v2.json")
    edition = load("edition-bsb.v2.json")
    catalog = load("evidence-catalog.json")
    texts, headings = bsb_texts()

    # --- envelope + layer separation ---
    for name, pkg, layer, family in (
        ("canonical", canonical, "canonical", "canonical-context-draft"),
        ("locale-en", locale, "locale", "locale-context-draft"),
        ("edition-bsb", edition, "edition", "translation-mention-draft"),
    ):
        if pkg.get("contract_version") != "2.0.0" or pkg.get("schema_version") != "2.0.0":
            fail(f"{name}: version drift")
        if pkg.get("data_classification") != "synthetic_fixture":
            fail(f"{name}: data_classification must stay synthetic_fixture")
        if pkg.get("review_status") != "draft":
            fail(f"{name}: review_status must stay draft")
        if pkg.get("package_layer") != layer or pkg.get("package_family") != family:
            fail(f"{name}: wrong layer/family")
    if canonical["package_key"] != "draft:neh2:canonical":
        fail("canonical package_key changed")
    if locale["scope"].get("language_tag") != "en" or locale["scope"].get("translation_edition_key") is not None:
        fail("locale must carry en and no edition")
    if edition["scope"].get("language_tag") != "en" or not edition["scope"].get("translation_edition_key"):
        fail("edition must carry en and the BSB edition")

    # --- exact canonical dependency ---
    canonical_digest = "sha256:" + hashlib.sha256(jcs(canonical).encode("utf-8")).hexdigest()
    for name, pkg in (("locale-en", locale), ("edition-bsb", edition)):
        deps = pkg.get("dependencies", [])
        if len(deps) != 1 or deps[0].get("package_key") != canonical["package_key"]:
            fail(f"{name}: must depend on the exact canonical package")
        if deps[0].get("digest") != canonical_digest:
            fail(f"{name}: canonical digest mismatch")

    # --- reference coverage ---
    expected = [f"verse:Neh.2.{n}" for n in range(1, 21)]
    for name, pkg in (("canonical", canonical), ("locale-en", locale), ("edition-bsb", edition)):
        if set(pkg["scope"].get("reference_keys", [])) != set(expected):
            fail(f"{name}: reference_keys must be exactly Neh.2.1-20")

    # --- record indexes ---
    attestations = {a["attestation_key"]: a for a in canonical["records"]["attestations"]}
    profiles = {p["entity_key"]: p for p in locale["records"]["entity_profiles"]}
    localizations = {(r["scope_key"], r["entity_key"]): r for r in locale["records"]["relevance_localizations"]}
    contexts = {c["scope_key"]: c for c in locale["records"]["passage_contexts"]}
    scope_keys = canonical["scope"]["scope_keys"]
    if sorted(locale["scope"]["scope_keys"]) != sorted(scope_keys):
        fail("locale scope_keys must match canonical scope_keys")

    # --- mentions resolve against BSB text and canonical attestations ---
    mentions_out = []
    verse_spans: dict[int, list[tuple[int, int, str]]] = {}
    for m in edition["records"]["mentions"]:
        verse_key = m.get("verse_key", "")
        match = re.fullmatch(r"verse:Neh\.2\.(\d+)", verse_key)
        if not match:
            fail(f"mention {m.get('mention_key')}: bad verse_key")
        verse = int(match.group(1))
        text = texts.get(verse)
        if text is None:
            fail(f"mention {m.get('mention_key')}: verse missing from BSB")
        sel = m.get("selector", {})
        start, end = check_selector(text, sel.get("exact_quote", ""), sel.get("occurrence_ordinal", 0),
                                    sel.get("prefix", ""), sel.get("suffix", ""), m.get("mention_key", "?"))
        if m.get("attestation_key") not in attestations:
            fail(f"mention {m.get('mention_key')}: unknown attestation")
        verse_spans.setdefault(verse, []).append((start, end, m.get("mention_key", "?")))
        mentions_out.append({
            "verse": verse,
            "quote": sel["exact_quote"],
            "ordinal": sel["occurrence_ordinal"],
            "prefix": sel["prefix"],
            "suffix": sel["suffix"],
            "entity_slug": m["target"]["key"].split("entity:", 1)[1],
            "form": m.get("mention_form", "explicit_name"),
        })
    # Overlapping selectors in one verse cannot both be tapped; the source
    # packages must resolve this rather than the app silently dropping one.
    for verse, spans in sorted(verse_spans.items()):
        ordered = sorted(spans)
        for (_, end_a, key_a), (start_b, _, key_b) in zip(ordered, ordered[1:]):
            if start_b < end_a:
                fail(f"Neh.2.{verse}: overlapping mentions {key_a} and {key_b}")
    mentions_out.sort(key=lambda m: (m["verse"], m["quote"]))

    # --- scope display metadata (titles derived from BSB headings or ranges) ---
    scope_meta: dict[str, dict] = {}
    for scope in scope_keys:
        first_verse = int(re.search(r"Neh\.2\.(\d+)", scope_range(scope)).group(1))
        heading = headings.get(first_verse)
        last_match = re.search(r"-Neh\.2\.(\d+)$", scope_range(scope))
        last_verse = int(last_match.group(1)) if last_match else first_verse
        if scope_slug(scope) == "neh-2":
            title = "Nehemiah 2"
        elif heading and last_verse > first_verse:
            title = heading
        elif last_verse > first_verse:
            title = f"Nehemiah 2:{first_verse}–{last_verse}"
        else:
            title = heading or f"Nehemiah 2:{first_verse}"
        scope_meta[scope] = {"title": title, "range": display_range(scope)}

    # --- entities with roles, appearances, and resolved relevance ---
    relevance = canonical["records"]["relevance"]
    entities_out = []
    for cand in canonical["records"]["entity_candidates"]:
        slug = cand["candidate_key"].split("candidate:neh2:", 1)[1]
        entity_key = f"entity:{slug}"
        profile = profiles.get(entity_key)
        if profile is None:
            fail(f"entity {entity_key} has no locale profile")
        roles = []
        for rel in relevance:
            if rel["entity_key"] != entity_key:
                continue
            loc = localizations.get((rel["scope_key"], entity_key))
            if loc is None:
                fail(f"relevance {rel['relevance_key']} has no localization")
            roles.append({
                "scope_key": rel["scope_key"],
                "scope_slug": scope_slug(rel["scope_key"]),
                "scope_title": scope_meta[rel["scope_key"]]["title"],
                "range": display_range(rel["scope_key"]),
                "role_text": loc["role_text"],
                "importance": rel["importance"],
            })
        verses = sorted({m["verse"] for m in mentions_out if m["entity_slug"] == slug})
        entities_out.append({
            "slug": slug,
            "name": profile["preferred_name"],
            "type": cand["entity_type"],
            "aliases": profile.get("aliases", []),
            "short_description": profile["short_description"]["text"],
            "extended_description": (profile.get("extended_description") or {}).get("text"),
            "roles": roles,
            "appearances": [{"ref": f"Neh.2.{v}", "passageKey": f"Neh.2.{v}"} for v in verses],
        })
    entities_out.sort(key=lambda e: e["slug"])

    # --- contexts for all six scopes ---
    contexts_out = []
    for scope in scope_keys:
        ctx = contexts.get(scope)
        if ctx is None:
            fail(f"scope {scope} has no locale context")
        title = scope_meta[scope]["title"]
        orientation = ctx["orientation"]
        blockers = [q for q in [orientation[f].get("open_question_key") for f in
                                ("who", "where", "when", "what", "before", "stakes", "immediate_summary")]
                    if q]
        contexts_out.append({
            "scope_key": scope,
            "slug": scope_slug(scope),
            "title": title,
            "range": display_range(scope),
            "passageKey": scope_range(scope).replace("–", "-"),
            "who": orientation["who"]["text"],
            "where": orientation["where"]["text"],
            "when": orientation["when"]["text"],
            "what": orientation["what"]["text"],
            "before": orientation["before"]["text"],
            "stakes": orientation["stakes"]["text"],
            "immediate_summary": orientation["immediate_summary"]["text"],
            "blocked": len(blockers) > 0,
        })

    # --- events with resolved participant/place names ---
    names = {e["slug"]: e["name"] for e in entities_out}
    events_out = []
    for ev in canonical["records"]["events"]:
        scope = ev["scripture_accounts"][0]["scope_key"]
        events_out.append({
            "key": ev["event_key"].split("event:", 1)[1],
            # Title is the event name only; the range is rendered separately
            # (same-book short form) so the book is never repeated.
            "title": humanize(ev["event_key"].split("event:", 1)[1]),
            "range": display_range(scope),
            "scope_key": scope,
            "participants": [{"slug": k.split("entity:", 1)[1], "name": names[k.split("entity:", 1)[1]]}
                             for k in ev["participant_entity_keys"]],
            "places": [{"slug": k.split("entity:", 1)[1], "name": names[k.split("entity:", 1)[1]]}
                       for k in ev["place_entity_keys"]],
        })

    # --- relationships with resolved names ---
    relationships_out = []
    for rel in canonical["records"]["relationships"]:
        subj = rel["subject_entity_key"].split("entity:", 1)[1]
        obj = rel["object_entity_key"].split("entity:", 1)[1]
        pred = rel["predicate_key"].split("relationship:", 1)[1]
        relationships_out.append({
            "subject_slug": subj,
            "subject_name": names[subj],
            "predicate": PREDICATE_LABELS.get(pred, pred.replace("_", " ")),
            "object_slug": obj,
            "object_name": names[obj],
            "ranges": sorted({display_range(s) for s in rel["applicable_scope_keys"]}),
        })
    relationships_out.sort(key=lambda r: (r["subject_slug"], r["predicate"], r["object_slug"]))

    # --- cross-passage connections from out-of-scope evidence ---
    evidence = {e["evidence_item_key"]: e for e in catalog.get("items", [])}
    connections: dict[tuple[str, str], dict] = {}
    for claim in canonical["records"]["claims"]:
        for citation_key in claim["citation_keys"]:
            citation = next(c for c in canonical["records"]["citations"] if c["citation_key"] == citation_key)
            item = evidence.get(citation["evidence_item_key"])
            if item is None or item.get("kind") != "scripture":
                continue
            locator = item["locator"]
            match = re.fullmatch(r"([A-Za-z1-9]+)\.(\d+)\.(\d+)", locator)
            if not match or (match.group(1) == "Neh" and match.group(2) == "2"):
                continue
            book, chapter = match.group(1), match.group(2)
            passage_key = f"{book}.{chapter}"
            title = f"{OSIS_NAMES.get(book, book)} {chapter}"
            note = render_claim(claim, names)
            key = (passage_key, note)
            if key not in connections:
                connections[key] = {"title": title, "note": note, "passageKey": passage_key}
    connections_out = sorted(connections.values(), key=lambda c: c["passageKey"])

    asset = {
        "schema_version": 1,
        "generator": "tools/build-neh2-preview.py",
        "packages": {
            "canonical": canonical["package_key"],
            "locale": locale["package_key"],
            "edition": edition["package_key"],
        },
        "canonical_digest": canonical_digest,
        "review_status": "draft",
        "preview_notice": PREVIEW_NOTICE,
        "passage": "Neh.2.1-Neh.2.20",
        "contexts": contexts_out,
        "entities": entities_out,
        "mentions": mentions_out,
        "events": events_out,
        "relationships": relationships_out,
        "connections": connections_out,
    }
    summary = (f"contexts={len(contexts_out)} entities={len(entities_out)} mentions={len(mentions_out)} "
               f"events={len(events_out)} relationships={len(relationships_out)} connections={len(connections_out)}")

    # --check: drift detection. Regenerate in memory and compare byte-for-byte
    # with the committed asset so CI can fail when the projection is stale.
    if CHECK:
        expected = json.dumps(asset, indent=2, ensure_ascii=False) + "\n"
        if not OUT.exists():
            fail(f"drift: {OUT} is missing; run tools/build-neh2-preview.py")
        actual = OUT.read_text(encoding="utf-8")
        if actual != expected:
            fail(
                "drift: apps/mobile/assets/content/nehemiah-2.preview.json is out of date "
                "with the Nehemiah 2 packages; run tools/build-neh2-preview.py"
            )
        print(f"preview asset is up to date ({summary})")
        return 0

    OUT.write_text(json.dumps(asset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(summary)
    print(f"wrote {OUT}")
    return 0


def render_claim(claim: dict, names: dict) -> str:
    subject = render_ref(claim["subject"], names)
    obj = render_ref(claim["object"], names)
    pred = PREDICATE_LABELS.get(claim["predicate"], claim["predicate"].replace("_", " "))
    return f"{subject} {pred} {obj}".strip()


def render_ref(ref: dict, names: dict) -> str:
    if ref["type"] == "entity":
        return names.get(ref["key"].split("entity:", 1)[1], ref["key"])
    if ref["type"] == "scope":
        return display_range(ref["key"])
    return str(ref.get("value", ref.get("key", "")))


if __name__ == "__main__":
    sys.exit(main())
