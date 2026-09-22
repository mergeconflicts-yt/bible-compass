#!/usr/bin/env python3
"""Locked Nehemiah 2 identity bridge and content merge.

The locked Nehemiah 2 dataset (content/nehemiah-2/) is the quality reference
and uses hand-curated canonical identities (entity:jerusalem,
entity:nehemiah-governor, entity:cupbearer, ...). The whole-English registry
derives identities from BibleData/OpenBible (entity:pl-jerusalem-a15257a,
entity:p-nehemiah-1, ...).

This module implements the owner-approved reconciliation:

  * the locked identity is canonical wherever a locked entity exists;
  * registry entities that denote the same thing are renamed to the locked
    key (one logical identity per entity canon-wide);
  * locked-only identities (gates/structures, polity, collectives, roles,
    objects, practices, deity, unnamed queen) are added as new canonical
    entities with their Nehemiah 2 attestation references;
  * the locked canonical/edition/locale records are merged into the
    whole-book Nehemiah package, re-scoping the locked passage boundaries to
    the whole-book scope scheme and preferring locked records on collision.

Nothing here invents content: every merged record comes from the locked
dataset, and every new identity comes from a locked candidate.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LOCKED = REPO / "content" / "nehemiah-2"

# Locked entity key -> registry entity key that denotes the same entity.
# Curated by hand; the remaining locked entities are locked-only identities.
SAME_AS_REGISTRY: dict[str, str] = {
    "entity:nehemiah-governor": "entity:p-nehemiah-1",
    "entity:artaxerxes-i": "entity:p-artaxerxes-1",
    "entity:sanballat-the-horonite": "entity:p-sanballat-1",
    "entity:tobiah-ammonite": "entity:p-tobiah-1",
    "entity:geshem-arabian": "entity:p-geshem-1",
    "entity:susa": "entity:pl-susa-a033b84",
    "entity:jerusalem": "entity:pl-jerusalem-a15257a",
    "entity:beyond-the-river": "entity:pl-beyond-the-river-a88310a",
    "entity:valley-gate": "entity:pl-valley-gate-a81b7b1",
    "entity:dung-gate": "entity:pl-dung-gate-a1611b6",
    "entity:fountain-gate": "entity:pl-fountain-gate-a2fc4c4",
}

SCOPE_RE = re.compile(
    r"^scope:[A-Za-z0-9-]+(?::[A-Za-z0-9-]+)*:"
    r"(?P<b>[A-Za-z1-9][A-Za-z0-9]*)\.(?P<c>\d+)\.(?P<v>\d+)-"
    r"(?P<b2>[A-Za-z1-9][A-Za-z0-9]*)\.(?P<c2>\d+)\.(?P<v2>\d+)$"
)


def scope_range(scope_key: str):
    m = SCOPE_RE.match(scope_key)
    if not m:
        return None
    return tuple(int(m.group(g)) if g in ("c", "v", "c2", "v2") else m.group(g)
                 for g in ("b", "c", "v", "b2", "c2", "v2"))


def load_locked() -> dict:
    return {
        "canonical": json.loads((LOCKED / "canonical.v2.json").read_text(encoding="utf-8")),
        "edition": json.loads((LOCKED / "edition-bsb.v2.json").read_text(encoding="utf-8")),
        "locale": json.loads((LOCKED / "locale-en.v2.json").read_text(encoding="utf-8")),
    }


def locked_entities(locked: dict) -> dict[str, dict]:
    """entity_key -> {type, label, aliases, refs, evidence} from the locked data."""
    canonical = locked["canonical"]
    locale = locked["locale"]
    by_slug_label = {}
    for c in canonical["records"]["entity_candidates"]:
        slug = c["candidate_key"].split(":")[-1]
        by_slug_label[slug] = (c["entity_type"], c["proposed_label"])
    refs: dict[str, set] = {}
    for a in canonical["records"]["attestations"]:
        _, cv = a["reference_key"].split(":")
        b, ch, v = cv.split(".")
        refs.setdefault(a["entity_key"], set()).add((b, int(ch), int(v)))

    def add_scope(entity_key: str, scope: str) -> None:
        rng = scope_range(scope)
        if rng is None:
            return
        refs.setdefault(entity_key, set()).add((rng[0], rng[1], rng[2]))
        refs[entity_key].add((rng[3], rng[4], rng[5]))

    for m in locked["edition"]["records"]["mentions"]:
        try:
            _, cv = m["verse_key"].split(":")
            b, ch, v = cv.split(".")
            refs.setdefault(m["target"]["key"], set()).add((b, int(ch), int(v)))
        except ValueError:
            pass
    for e in canonical["records"]["events"]:
        for key in e["participant_entity_keys"] + e["place_entity_keys"]:
            for account in e["scripture_accounts"]:
                add_scope(key, account["scope_key"])
    for r in canonical["records"]["relationships"]:
        for key in (r["subject_entity_key"], r["object_entity_key"]):
            for scope in r["applicable_scope_keys"]:
                add_scope(key, scope)
    for r in canonical["records"]["relevance"]:
        add_scope(r["entity_key"], r["scope_key"])
    evidence: dict[str, str] = {}
    for p in canonical["records"]["places"]:
        for pos in p["geographic_positions"]:
            evidence[p["entity_key"]] = pos["evidence_item_key"]
            break
    aliases: dict[str, list] = {}
    for prof in locale["records"]["entity_profiles"]:
        aliases[prof["entity_key"]] = [a for a in prof.get("aliases", []) if a]

    out: dict[str, dict] = {}
    for key in sorted({r["canonical_entity_key"] for r in canonical["records"]["reconciliation_records"]
                       if r.get("canonical_entity_key")}):
        slug = key.split("entity:", 1)[1]
        etype, label = by_slug_label.get(slug, ("person", slug))
        entity_refs = refs.get(key, set())
        if not entity_refs:
            # Referenced only through claims/events with no direct attestation
            # (e.g. the role "King"): anchor to the locked Nehemiah 2 range.
            entity_refs = {("Neh", 2, 1), ("Neh", 2, 20)}
        out[key] = {
            "slug": slug,
            "type": etype,
            "name": label,
            "aliases": set(aliases.get(key, [])),
            "refs": entity_refs,
            "evidence": evidence.get(key, f"evidence:locked-neh2:{slug}"),
        }
    return out


def apply_identity(
    persons: dict, places: dict, person_labels: dict, relationships: list[dict], locked: dict
) -> tuple[dict, dict, dict, list[dict], dict]:
    """Rename same-entity registry slugs to the locked key and add locked-only
    entities. Returns (persons, places, person_labels, relationships, rename_map)."""
    entities = locked_entities(locked)
    persons = dict(persons)
    places = dict(places)
    person_labels = dict(person_labels)
    rename: dict[str, str] = {}

    for locked_key, reg_key in SAME_AS_REGISTRY.items():
        reg_slug = reg_key.split("entity:", 1)[1]
        locked_slug = locked_key.split("entity:", 1)[1]
        rename[reg_slug] = locked_slug
        if reg_slug in persons:
            entry = persons.pop(reg_slug)
            entry["slug"] = locked_slug
            entry["aliases"] = set(entry.get("aliases", set()))
            persons[locked_slug] = entry
        if reg_slug in places:
            entry = places.pop(reg_slug)
            entry["slug"] = locked_slug
            entry["aliases"] = set(entry.get("aliases", set()))
            places[locked_slug] = entry
        if reg_slug in person_labels:
            labels = person_labels.pop(reg_slug)
            person_labels.setdefault(locked_slug, set()).update(labels)
        # locked aliases enrich the profile
        if locked_slug in persons:
            persons[locked_slug]["aliases"] |= entities[locked_key]["aliases"]
        if locked_slug in places:
            places[locked_slug]["aliases"] |= entities[locked_key]["aliases"]

    # Locked-only identities become new canonical entities. Structures,
    # objects, practices, polity, collectives, roles and deity live in the
    # generic entity map; generation carries their type through.
    matched_slugs = {k.split("entity:", 1)[1] for k in SAME_AS_REGISTRY}
    for locked_key, entry in entities.items():
        slug = entry["slug"]
        if slug in matched_slugs:
            continue
        target = persons if entry["type"] == "person" else places
        target[slug] = {
            "slug": slug,
            "type": entry["type"],
            "name": entry["name"],
            "aliases": set(entry["aliases"]),
            "refs": set(entry["refs"]),
            "evidence": entry["evidence"],
        }

    def ren(slug: str) -> str:
        return rename.get(slug, slug)

    new_rels = []
    for rel in relationships:
        rel = dict(rel)
        rel["subject"] = ren(rel["subject"])
        rel["object"] = ren(rel["object"])
        new_rels.append(rel)
    return persons, places, person_labels, new_rels, rename


def _remap_scope(scope: str, scope_map: dict[str, str]) -> str:
    return scope_map.get(scope, scope)


def _range_index(scope_keys: list[str]) -> dict[tuple, str]:
    out: dict[tuple, str] = {}
    for sk in scope_keys:
        rng = scope_range(sk)
        if rng is not None:
            out.setdefault(rng, sk)
    return out


def _mention_span(mention: dict, verse_text: dict):
    try:
        _, cv = mention["verse_key"].split(":")
        parts = cv.split(".")
        c, v = parts[-2], parts[-1]
        text = verse_text.get((int(c), int(v)))
    except (ValueError, KeyError):
        return None
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


def _dedupe_mentions_locked(mentions: list[dict], verse_text: dict) -> list[dict]:
    """Drop overlapping spans, preferring locked mentions, then longer forms."""
    by_verse: dict[str, list] = {}
    kept: list[dict] = []
    for m in mentions:
        span = _mention_span(m, verse_text)
        if span is None:
            kept.append(m)
            continue
        by_verse.setdefault(m["verse_key"], []).append((span[0], span[1], m))
    for items in by_verse.values():
        items.sort(
            key=lambda t: (
                0 if t[2]["mention_key"].startswith("mention:bsb-") else 1,
                -(t[1] - t[0]),
                t[0],
                t[2]["mention_key"],
            )
        )
        chosen: list[tuple[int, int]] = []
        for s, e, m in items:
            if any(not (e <= cs or s >= ce) for cs, ce in chosen):
                continue
            chosen.append((s, e))
            kept.append(m)
    kept.sort(key=lambda m: m["mention_key"])
    return kept


def merge_neh(data: dict, locked: dict, verse_text: dict) -> dict:
    """Merge locked Nehemiah 2 records into the whole-book Nehemiah data."""
    canonical = data["canonical"]
    edition = data["edition"]
    locale = data["locale"]
    crec, erec, lrec = canonical["records"], edition["records"], locale["records"]
    lc, le, ll = locked["canonical"], locked["edition"], locked["locale"]

    # 1. Re-scope locked boundaries onto the whole-book scheme where the verse
    #    range already exists; otherwise add the curated scope.
    whole_ranges = _range_index(canonical["scope"]["scope_keys"])
    scope_map: dict[str, str] = {}
    extra_scopes: list[str] = []
    for sk in lc["scope"]["scope_keys"]:
        rng = scope_range(sk)
        mapped = whole_ranges.get(rng) if rng is not None else None
        if mapped:
            scope_map[sk] = mapped
        else:
            scope_map[sk] = sk
            extra_scopes.append(sk)
    for pkg in (canonical, edition, locale):
        for sk in extra_scopes:
            if sk not in pkg["scope"]["scope_keys"]:
                pkg["scope"]["scope_keys"].append(sk)

    def rs(scope: str) -> str:
        return scope_map.get(scope, scope)

    def remap_candidate(key: str) -> str:
        if key.startswith("candidate:neh2:"):
            return "candidate:wb:" + key.split(":", 2)[2]
        return key

    def dedupe(existing: list, incoming: list, key_fn, prefer_incoming: bool = True):
        index = {}
        for i, rec in enumerate(existing):
            index.setdefault(key_fn(rec), i)
        out = list(existing)
        for rec in incoming:
            k = key_fn(rec)
            if k in index:
                if prefer_incoming:
                    out[index[k]] = rec
            else:
                index[k] = len(out)
                out.append(rec)
        return out

    # 2. Canonical records.
    locked_candidates = [
        {**c, "candidate_key": remap_candidate(c["candidate_key"])}
        for c in lc["records"]["entity_candidates"]
    ]
    locked_recon = [
        {**r, "candidate_key": remap_candidate(r["candidate_key"])}
        for r in lc["records"].get("reconciliation_records", [])
    ]
    crec["entity_candidates"] = dedupe(
        crec["entity_candidates"], locked_candidates, lambda r: r["candidate_key"]
    )
    crec["reconciliation_records"] = dedupe(
        crec.get("reconciliation_records", []), locked_recon, lambda r: r["candidate_key"]
    )
    crec["claims"] = dedupe(crec["claims"], lc["records"]["claims"], lambda r: r["claim_key"])
    crec["citations"] = dedupe(
        crec["citations"], lc["records"]["citations"], lambda r: r["citation_key"]
    )
    # Attestations dedupe by (entity, verse), preferring the locked record.
    # Mentions that pointed at a superseded attestation are re-pointed so no
    # reference dangles.
    merged_attest = list(crec["attestations"])
    attest_index = {
        (a["entity_key"], a["reference_key"]): i for i, a in enumerate(merged_attest)
    }
    attest_remap: dict[str, str] = {}
    for a in lc["records"]["attestations"]:
        pair = (a["entity_key"], a["reference_key"])
        if pair in attest_index:
            old = merged_attest[attest_index[pair]]["attestation_key"]
            if old != a["attestation_key"]:
                attest_remap[old] = a["attestation_key"]
            merged_attest[attest_index[pair]] = a
        else:
            attest_index[pair] = len(merged_attest)
            merged_attest.append(a)
    crec["attestations"] = merged_attest
    locked_rels = [
        {**r, "applicable_scope_keys": [rs(s) for s in r["applicable_scope_keys"]]}
        for r in lc["records"]["relationships"]
    ]
    crec["relationships"] = dedupe(
        crec["relationships"], locked_rels, lambda r: r["relationship_key"]
    )
    locked_events = [
        {
            **e,
            "scripture_accounts": [
                {**a, "scope_key": rs(a["scope_key"])} for a in e["scripture_accounts"]
            ],
        }
        for e in lc["records"]["events"]
    ]
    crec["events"] = dedupe(crec["events"], locked_events, lambda r: r["event_key"])
    crec["places"] = dedupe(
        crec["places"], lc["records"]["places"], lambda r: r["entity_key"]
    )
    locked_relevance = [{**r, "scope_key": rs(r["scope_key"])} for r in lc["records"]["relevance"]]
    crec["relevance"] = dedupe(crec["relevance"], locked_relevance, lambda r: r["relevance_key"])

    # 3. Edition mentions: re-point superseded attestations, then prefer the
    #    locked mention for the same entity/verse/span.
    for m in erec["mentions"]:
        m["attestation_key"] = attest_remap.get(m["attestation_key"], m["attestation_key"])
    locked_mentions = list(le["records"]["mentions"])
    erec["mentions"] = dedupe(
        erec["mentions"],
        locked_mentions,
        lambda r: (
            r["target"]["key"],
            r["verse_key"],
            r["selector"]["exact_quote"],
            r["selector"]["occurrence_ordinal"],
        ),
    )
    erec["mentions"] = _dedupe_mentions_locked(erec["mentions"], verse_text)

    # 4. Locale records: locked profiles/contexts/localizations win.
    locked_profiles = ll["records"]["entity_profiles"]
    lrec["entity_profiles"] = dedupe(
        lrec["entity_profiles"], locked_profiles, lambda r: r["profile_key"]
    )
    locked_contexts = [
        {**c, "scope_key": rs(c["scope_key"])} for c in ll["records"]["passage_contexts"]
    ]
    lrec["passage_contexts"] = dedupe(
        lrec["passage_contexts"], locked_contexts, lambda r: r["context_key"]
    )
    locked_loc = [
        {**r, "scope_key": rs(r["scope_key"])} for r in ll["records"]["relevance_localizations"]
    ]
    lrec["relevance_localizations"] = dedupe(
        lrec["relevance_localizations"], locked_loc, lambda r: r["localization_key"]
    )
    locale["open_questions"] = dedupe(
        locale["open_questions"], ll["open_questions"], lambda r: r["question_key"]
    )

    # 5. Coverage is recomputed from the merged records, not inherited.
    _recompute_coverage(data)
    return data


def _reference_groups(all_verses: list[str], verse_to_records: dict[str, list[str]]) -> list[dict]:
    zero: list[str] = []
    by_set: dict[tuple, list[str]] = {}
    for vk in all_verses:
        records = sorted(set(verse_to_records.get(vk, [])))
        if not records:
            zero.append(vk)
        else:
            by_set.setdefault(tuple(records), []).append(vk)
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
    for key, verses in sorted(by_set.items()):
        groups.append(
            {
                "result": "complete_with_records",
                "reference_keys": sorted(verses),
                "record_keys": list(key),
                "blocker_question_keys": [],
            }
        )
    return groups


def _recompute_coverage(data: dict) -> None:
    canonical, edition, locale = data["canonical"], data["edition"], data["locale"]
    crec, erec, lrec = canonical["records"], edition["records"], locale["records"]
    all_verses = canonical["scope"]["reference_keys"]

    verse_to_attest: dict[str, list[str]] = {}
    for a in crec["attestations"]:
        verse_to_attest.setdefault(a["reference_key"], []).append(a["attestation_key"])
    canonical["coverage"] = [
        {
            "annotation_class": "canonical_entity_attestation",
            "groups": _reference_groups(all_verses, verse_to_attest),
        }
    ]
    verse_to_mention: dict[str, list[str]] = {}
    for m in erec["mentions"]:
        verse_to_mention.setdefault(m["verse_key"], []).append(m["mention_key"])
    edition["coverage"] = [
        {
            "annotation_class": "translation_mention",
            "groups": _reference_groups(all_verses, verse_to_mention),
        }
    ]

    complete: list[tuple[str, str]] = []
    blocked: list[tuple[str, str, list[str]]] = []
    for c in lrec["passage_contexts"]:
        blockers = sorted(
            {s["open_question_key"] for s in c["orientation"].values() if s["open_question_key"]}
        )
        if blockers:
            blocked.append((c["scope_key"], c["context_key"], blockers))
        else:
            complete.append((c["scope_key"], c["context_key"]))
    groups: list[dict] = []
    if complete:
        groups.append(
            {
                "result": "complete_with_records",
                "scope_keys": [s for s, _ in complete],
                "record_keys": [c for _, c in complete],
                "blocker_question_keys": [],
            }
        )
    if blocked:
        groups.append(
            {
                "result": "blocked",
                "scope_keys": [s for s, _, _ in blocked],
                "record_keys": [c for _, c, _ in blocked],
                "blocker_question_keys": sorted({q for _, _, qs in blocked for q in qs}),
            }
        )
    locale["coverage"] = [
        {"annotation_class": "passage_context_localization", "groups": groups}
    ]
