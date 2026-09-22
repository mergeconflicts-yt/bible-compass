#!/usr/bin/env python3
"""Idempotent Nehemiah 2 curation importer (Task EN-03).

Reads the four EN-01 packages, validates them (layers, dependencies,
references, BSB anchors, digests), then imports them transactionally into the
existing private_staging schema using stable keys.

  canonical.v2.json   entities, claims, citations, attestations,
                      relationships, events, places, relevance
  locale-en.v2.json   names, descriptions, passage contexts, role relevance
  edition-bsb.v2.json BSB mentions (+ derived render spans)
  evidence-catalog.json  provenance used by citations

Guarantees
  * validation happens before any write
  * all writes run in ONE transaction (psql -1); any failure rolls back
  * inserts are idempotent (on conflict / where not exists)
  * a receipt row in private_staging.curation_imports records the payload
  * re-importing identical bytes is a no-op
  * replaying changed bytes for the same package fails clearly (exit 3)
  * drafts only: every review_state is draft; no publication, no anon access

Usage
  python3 tools/import-neh2.py --check
  python3 tools/import-neh2.py --database-url "$DATABASE_URL"
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import uuid
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
NEH2 = REPO / "content" / "nehemiah-2"
BSB_NEH = REPO / "apps" / "mobile" / "assets" / "scripture" / "bsb" / "Neh.json"

CANON_PKG_KEY = "draft:neh2:canonical"
IMPORT_PACKAGE_KEY = "import:neh2:canonical-locale-edition"
IMPORT_REVISION = 1
CANON = "canon:prot-66"
REFSYS = "refsys:eng-v22"
EDITION_KEY = "edition:bsb@20260912:sha-b2898c49"
BSB_ARTIFACT_SHA = (
    "sha256:b2898c49cadb50fd8763feb9e2f74a90a3817e33408a24b6cbf09e7a950dde97"
)
PROVENANCE = "draft import from content/nehemiah-2 v2 packages (unverified curation)"
UNKNOWN_LICENSE = "unknown"

SCOPE_KINDS = {
    "neh-2": "chapter",
    "neh-2-request": "pericope",
    "neh-2-journey": "pericope",
    "neh-2-inspection": "pericope",
    "neh-2-rally": "pericope",
    "neh-2-answer": "pericope",
}


def fail(message: str, code: int = 1) -> None:
    print(f"import-neh2: ERROR: {message}", file=sys.stderr)
    sys.exit(code)


def load(name: str) -> dict:
    path = NEH2 / name
    if not path.exists():
        fail(f"missing input {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def jcs(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_text(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def local_uuid(stable_key: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, stable_key))


def esc(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def jsonb(value: object) -> str:
    return esc(jcs(value)) + "::jsonb"


def text_array(values: list[str]) -> str:
    return "array[" + ",".join(esc(v) for v in values) + "]::text[]"


def uuid_array(values: list[str]) -> str:
    return "array[" + ",".join(esc(v) for v in values) + "]::uuid[]"


def bsb_verses() -> dict[int, str]:
    data = json.loads(BSB_NEH.read_text(encoding="utf-8"))
    chapter = next(c for c in data["chapters"] if c["n"] == 2)
    return {b["n"]: b["text"] for b in chapter["blocks"] if b.get("t") == "v"}


def mention_matches(text: str, quote: str) -> list[re.Match[str]]:
    return list(re.finditer(rf"(?<![A-Za-z0-9]){re.escape(quote)}(?![A-Za-z0-9])", text))


# ---------------------------------------------------------------------------
# validation
# ---------------------------------------------------------------------------


def validate(canonical: dict, locale: dict, edition: dict, catalog: dict, verses: dict[int, str]) -> dict:
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
    if canonical["package_key"] != CANON_PKG_KEY:
        fail("canonical package_key changed")
    if canonical["scope"]["language_tag"] is not None or canonical["scope"]["translation_edition_key"] is not None:
        fail("canonical scope must be translation-independent")
    if locale["scope"]["language_tag"] != "en" or locale["scope"]["translation_edition_key"] is not None:
        fail("locale scope must be en with no edition")
    if edition["scope"]["translation_edition_key"] != EDITION_KEY:
        fail("edition scope must be the ratified BSB edition")
    if edition["scope"]["language_tag"] != "en" or edition["scope"]["reference_system_key"] != REFSYS:
        fail("edition scope language/refsys mismatch")

    # dependency digests: locale and edition must depend on the exact canonical
    canonical_digest = sha256_text(jcs(canonical))
    for name, pkg in (("locale-en", locale), ("edition-bsb", edition)):
        deps = pkg.get("dependencies", [])
        if len(deps) != 1 or deps[0].get("package_key") != canonical["package_key"]:
            fail(f"{name}: must depend on the exact canonical package")
        if deps[0].get("digest") != canonical_digest:
            fail(f"{name}: canonical dependency digest mismatch")

    # reference coverage
    expected = {f"verse:Neh.2.{n}" for n in range(1, 21)}
    for name, pkg in (("canonical", canonical), ("locale-en", locale), ("edition-bsb", edition)):
        if set(pkg["scope"]["reference_keys"]) != expected:
            fail(f"{name}: reference_keys must be exactly Neh.2.1-20")
    if set(verses) != set(range(1, 21)):
        fail("bundled BSB Neh.2 must have verses 1-20")

    # entity identity: candidates reconciled to canonical keys
    entity_keys = {r["canonical_entity_key"] for r in canonical["records"]["reconciliation_records"]}
    candidate_keys = {c["candidate_key"] for c in canonical["records"]["entity_candidates"]}
    for rec in canonical["records"]["reconciliation_records"]:
        if rec["candidate_key"] not in candidate_keys:
            fail(f"reconciliation for unknown candidate {rec['candidate_key']}")

    claim_keys = {c["claim_key"] for c in canonical["records"]["claims"]}
    citation_keys = {c["citation_key"] for c in canonical["records"]["citations"]}
    attestation_keys = {a["attestation_key"] for a in canonical["records"]["attestations"]}
    relevance_keys = {r["relevance_key"] for r in canonical["records"]["relevance"]}
    scope_keys = set(canonical["scope"]["scope_keys"])
    evidence_keys = {i["evidence_item_key"] for i in catalog["items"]}

    for claim in canonical["records"]["claims"]:
        for key in claim["citation_keys"]:
            if key not in citation_keys:
                fail(f"claim {claim['claim_key']} -> missing citation {key}")
        if claim["subject"]["type"] == "entity" and claim["subject"]["key"] not in entity_keys:
            fail(f"claim {claim['claim_key']} -> unknown subject {claim['subject']['key']}")
        if claim["subject"]["type"] == "scope" and claim["subject"]["key"] not in scope_keys:
            fail(f"claim {claim['claim_key']} -> unknown subject scope")
    for citation in canonical["records"]["citations"]:
        if citation["evidence_item_key"] not in evidence_keys:
            fail(f"citation {citation['citation_key']} -> unsigned evidence")
        for key in citation["claim_keys"]:
            if key not in claim_keys:
                fail(f"citation {citation['citation_key']} -> unknown claim {key}")
    for attestation in canonical["records"]["attestations"]:
        if attestation["entity_key"] not in entity_keys:
            fail(f"attestation -> unknown entity {attestation['entity_key']}")
        if attestation["reference_key"] not in expected:
            fail(f"attestation -> unknown verse {attestation['reference_key']}")
    for rel in canonical["records"]["relationships"]:
        for key in (rel["subject_entity_key"], rel["object_entity_key"]):
            if key not in entity_keys:
                fail(f"relationship -> unknown entity {key}")
        for scope in rel["applicable_scope_keys"]:
            if scope not in scope_keys:
                fail(f"relationship -> unknown scope {scope}")
    for event in canonical["records"]["events"]:
        for key in event["participant_entity_keys"] + event["place_entity_keys"]:
            if key not in entity_keys:
                fail(f"event {event['event_key']} -> unknown entity {key}")
        for account in event["scripture_accounts"]:
            if account["scope_key"] not in scope_keys:
                fail(f"event {event['event_key']} -> unknown scope")
    for place in canonical["records"]["places"]:
        if place["entity_key"] not in entity_keys:
            fail(f"place -> unknown entity {place['entity_key']}")
    for relevance in canonical["records"]["relevance"]:
        if relevance["entity_key"] not in entity_keys or relevance["scope_key"] not in scope_keys:
            fail(f"relevance {relevance['relevance_key']} -> unresolved")

    profiles = {p["entity_key"]: p for p in locale["records"]["entity_profiles"]}
    for key in entity_keys:
        if key not in profiles:
            fail(f"locale: entity {key} has no profile")
    contexts = {c["scope_key"]: c for c in locale["records"]["passage_contexts"]}
    for scope in scope_keys:
        if scope not in contexts:
            fail(f"locale: scope {scope} has no context")
    for loc in locale["records"]["relevance_localizations"]:
        if loc["relevance_key"] not in relevance_keys:
            fail(f"locale: localization -> unknown relevance {loc['relevance_key']}")

    # anchors: word-bounded resolution, occurrence ordinal, no overlaps
    verse_spans: dict[int, list[tuple[int, int, str]]] = {}
    for mention in edition["records"]["mentions"]:
        if mention["attestation_key"] not in attestation_keys:
            fail(f"mention {mention['mention_key']} -> unknown attestation")
        if mention["target"]["key"] not in entity_keys:
            fail(f"mention {mention['mention_key']} -> unknown entity")
        verse = int(mention["verse_key"].rsplit(".", 1)[1])
        text = verses[verse]
        sel = mention["selector"]
        matches = mention_matches(text, sel["exact_quote"])
        if len(matches) < sel["occurrence_ordinal"]:
            fail(f"mention {mention['mention_key']}: quote/ordinal not found")
        m = matches[sel["occurrence_ordinal"] - 1]
        if text[max(0, m.start() - 20) : m.start()] != sel["prefix"]:
            fail(f"mention {mention['mention_key']}: prefix mismatch")
        if text[m.end() : m.end() + 20] != sel["suffix"]:
            fail(f"mention {mention['mention_key']}: suffix mismatch")
        verse_spans.setdefault(verse, []).append((m.start(), m.end(), mention["mention_key"]))
    for verse, spans in verse_spans.items():
        ordered = sorted(spans)
        for (_, end_a, key_a), (start_b, _, key_b) in zip(ordered, ordered[1:]):
            if start_b < end_a:
                fail(f"Neh.2.{verse}: overlapping mentions {key_a} and {key_b}")

    return {
        "canonical_digest": canonical_digest,
        "entity_keys": entity_keys,
        "claim_keys": claim_keys,
        "attestation_keys": attestation_keys,
        "relevance_keys": relevance_keys,
        "scope_keys": scope_keys,
        "counts": {
            "entities": len(entity_keys) + len(canonical["records"]["events"]),
            "claims": len(claim_keys),
            "citations": len(citation_keys),
            "attestations": len(attestation_keys),
            "mentions": len(edition["records"]["mentions"]),
        },
    }


# ---------------------------------------------------------------------------
# SQL construction
# ---------------------------------------------------------------------------


def stable_key_sets(canonical: dict) -> dict[str, list[str]]:
    entity_keys = [r["canonical_entity_key"] for r in canonical["records"]["reconciliation_records"]]
    entity_keys += [
        f"entity:{e['event_key'].split('event:', 1)[1]}" for e in canonical["records"]["events"]
    ]
    return {
        "entities": entity_keys,
        "claims": [c["claim_key"] for c in canonical["records"]["claims"]],
        "scopes": canonical["scope"]["scope_keys"],
    }


def planned_counts(canonical: dict, locale: dict, edition: dict, verses: dict[int, str]) -> dict[str, int]:
    sets = stable_key_sets(canonical)
    return {
        "entities": len(sets["entities"]),
        "claims": len(sets["claims"]),
        "citations": len(canonical["records"]["citations"]),
        "attestations": len(canonical["records"]["attestations"]),
        "mentions": len(edition["records"]["mentions"]),
        "relationships": len(canonical["records"]["relationships"]),
        "relevance": len(canonical["records"]["relevance"]),
        "contexts": len(locale["records"]["passage_contexts"]),
        "verses": len(verses),
    }


def existing_counts(url: str, canonical: dict) -> dict[str, int]:
    """Rows already present for our stable keys, so the receipt can report
    inserted vs unchanged (the import itself is conflict-guarded)."""
    sets = stable_key_sets(canonical)
    ent = text_array(sets["entities"])
    cl = text_array(sets["claims"])
    sc = text_array(sets["scopes"])
    edition = f"(select id from private_staging.translation_editions where key={esc(EDITION_KEY)})"
    queries = {
        "entities": f"select count(*) from private_staging.entities where key = any({ent})",
        "claims": f"select count(*) from private_staging.claims where key = any({cl})",
        "citations": f"select count(*) from private_staging.claim_citations c join private_staging.claims cl on cl.id=c.claim_id where cl.key = any({cl})",
        "attestations": f"select count(*) from private_staging.reference_entity_attestations a join private_staging.entities e on e.id=a.entity_id where e.key = any({ent})",
        "mentions": f"select count(*) from private_staging.edition_mentions where edition_id={edition}",
        "relationships": f"select count(*) from private_staging.entity_relationship_assertions a join private_staging.entities e on e.id=a.subject_entity_id where e.key = any({ent})",
        "relevance": f"select count(*) from private_staging.scope_entity_relevance r join private_staging.scripture_scopes s on s.id=r.scope_id where s.key = any({sc})",
        "contexts": f"select count(*) from private_staging.context_artifacts a join private_staging.scripture_scopes s on s.id=a.scope_id where s.key = any({sc})",
        "verses": f"select count(*) from private_staging.translation_edition_verses where edition_id={edition}",
    }
    return {name: int(psql(url, query) or "0") for name, query in queries.items()}


def build_receipt_counts(planned: dict[str, int], existing: dict[str, int]) -> dict:
    by_table: dict[str, dict] = {}
    inserted = 0
    unchanged = 0
    for name, total in planned.items():
        already = min(existing.get(name, 0), total)
        new = total - already
        by_table[name] = {"inserted": new, "unchanged": already, "rejected": 0, "total": total}
        inserted += new
        unchanged += already
    return {
        "inserted": inserted,
        "unchanged": unchanged,
        "rejected": 0,
        "total": inserted + unchanged,
        "by_table": by_table,
    }


def build_sql(canonical: dict, locale: dict, edition: dict, catalog: dict, verses: dict[int, str], payload_digest: str, receipt_counts: dict | None = None) -> str:
    stmts: list[str] = []

    def add(sql: str) -> None:
        stmts.append(sql.strip())

    ENT = lambda key: f"(select id from private_staging.entities where key={esc(key)})"
    SCOPE = lambda key: f"(select id from private_staging.scripture_scopes where key={esc(key)})"
    CLAIM = lambda key: f"(select id from private_staging.claims where key={esc(key)})"
    REFSYS_ID = f"(select id from private_staging.reference_systems where key={esc(REFSYS)})"
    WORK_ID = "(select id from private_staging.scripture_works where osis_code='Neh')"
    EDITION_ID = f"(select id from private_staging.translation_editions where key={esc(EDITION_KEY)})"

    def unit(local_key: str) -> str:
        return (
            "(select id from private_staging.reference_units where "
            f"local_key={esc(local_key)} and reference_system_id={REFSYS_ID})"
        )

    # --- reference skeleton -------------------------------------------------
    add("insert into private_staging.canons (key, name) values ('canon:prot-66','Protestant 66') on conflict (key) do nothing;")
    add("insert into private_staging.scripture_works (key, osis_code, name, testament) values ('work:Neh:prot-66','Neh','Nehemiah','OT') on conflict (key) do nothing;")
    add("insert into private_staging.canon_work_memberships (canon_id, work_id, order_index) select (select id from private_staging.canons where key='canon:prot-66'), (select id from private_staging.scripture_works where osis_code='Neh'), 16 on conflict do nothing;")
    add(f"insert into private_staging.reference_systems (key, canon_id, version, status) values ({esc(REFSYS)}, (select id from private_staging.canons where key='canon:prot-66'), 22, 'active') on conflict (key) do nothing;")
    add(f"insert into private_staging.reference_units (reference_system_id, local_key, work_id, chapter_label, verse_label, kind, ordinal) values ({REFSYS_ID}, 'Neh.2', {WORK_ID}, '2', null, 'chapter', 2000) on conflict do nothing;")
    for n in range(1, 21):
        add(f"insert into private_staging.reference_units (reference_system_id, local_key, work_id, chapter_label, verse_label, kind, ordinal) values ({REFSYS_ID}, 'Neh.2.{n}', {WORK_ID}, '2', '{n}', 'verse', {2000 + n}) on conflict do nothing;")
    for scope in canonical["scope"]["scope_keys"]:
        slug = scope.split(":")[1]
        span = scope.rsplit(":", 1)[1]
        start_ref, _, end_ref = span.partition("-")
        start_local = start_ref
        end_local = end_ref
        add(
            "insert into private_staging.scripture_scopes (key, reference_system_id, kind, start_unit_id, end_unit_id, display_name, certainty) values ("
            f"{esc(scope)}, {REFSYS_ID}, {esc(SCOPE_KINDS[slug])}, {unit(start_local)}, {unit(end_local)}, {esc(span)}, 'established') on conflict (key) do nothing;"
        )
    add(f"insert into private_staging.translation_works (key, language_tag, name, publisher) values ('trans:bsb','en','Berean Standard Bible','Bible Hub (berean.bible)') on conflict (key) do nothing;")
    add(
        "insert into private_staging.translation_editions (work_id, key, language_tag, reference_system_id, revision_date, source_artifact_sha256, attribution, status) values ("
        f"(select id from private_staging.translation_works where key='trans:bsb'), {esc(EDITION_KEY)}, 'en', {REFSYS_ID}, '2026-09-12', {esc(BSB_ARTIFACT_SHA)}, 'Berean Standard Bible · BSB', 'draft') on conflict (key) do nothing;"
    )
    for n in range(1, 21):
        text = verses[n]
        add(
            "insert into private_staging.translation_edition_verses (edition_id, reference_unit_id, book_id, chapter, verse_number, text, text_sha256) values ("
            f"{EDITION_ID}, {unit(f'Neh.2.{n}')}, {WORK_ID}, 2, {n}, {esc(text)}, {esc(sha256_text(text))}) on conflict do nothing;"
        )

    # --- draft manifest (row ownership anchor) ------------------------------
    # The locked Nehemiah 2 package is an unpublished draft manifest. Its rows
    # carry origin_package_id so that, once this manifest is published, only its
    # own rows are exposed by the public API (NULL-origin rows are never
    # treated as publishable).
    digest8 = payload_digest.split("sha256:", 1)[-1][:8]
    manifest_key = f"en.bsb.neh-2@1:sha-{digest8}"
    add(
        "insert into private_staging.package_manifests "
        "(key, locale, translation_edition_id, scope_id, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at, rights_status) values ("
        f"{esc(manifest_key)}, 'en', {EDITION_ID}, null, '2.0.0', 1, {esc(payload_digest)}, '0.0.0', null, null, 'unknown') "
        "on conflict (key) do update set checksum = excluded.checksum;"
    )
    PKG = f"(select id from private_staging.package_manifests where key={esc(manifest_key)})"

    # --- entities -----------------------------------------------------------
    def entity_rows(pairs: list[tuple[str, str, str, str]]) -> None:
        for key, slug, etype, ident in pairs:
            add(
                "insert into private_staging.entities (key, slug, type, identification_status, provenance) values ("
                f"{esc(key)}, {esc(slug)}, {esc(etype)}, {esc(ident)}, {esc(PROVENANCE)}) on conflict (key) do nothing;"
            )

    candidates = canonical["records"]["entity_candidates"]
    reconciliations = {r["candidate_key"]: r["canonical_entity_key"] for r in canonical["records"]["reconciliation_records"]}
    entity_pairs = []
    for candidate in candidates:
        key = reconciliations[candidate["candidate_key"]]
        entity_pairs.append((key, key.split("entity:", 1)[1], candidate["entity_type"], "established"))
    for event in canonical["records"]["events"]:
        slug = event["event_key"].split("event:", 1)[1]
        entity_pairs.append((f"entity:{slug}", slug, "event", "established"))
    entity_rows(entity_pairs)

    # --- names + descriptions from the English locale -----------------------
    for profile in locale["records"]["entity_profiles"]:
        entity_key = profile["entity_key"]
        forms = [(profile["preferred_name"], "preferred")] + [(a, "alias") for a in profile.get("aliases", [])]
        for form, kind in forms:
            normalized = form.strip().lower()
            if not normalized:
                continue
            add(
                "insert into private_staging.entity_names (entity_id, language_tag, form, normalized_form, kind, origin_package_id) values ("
                f"{ENT(entity_key)}, 'en', {esc(form)}, {esc(normalized)}, {esc(kind)}, {PKG}) on conflict do nothing;"
            )
        extended = profile.get("extended_description")
        add(
            "insert into private_staging.entity_descriptions (entity_id, locale, revision, short_desc, extended_desc, source_locale, review_state, origin_package_id) values ("
            f"{ENT(entity_key)}, 'en', 1, {esc(profile['short_description']['text'])}, "
            f"{esc(extended['text']) if extended else 'null'}, 'en', 'draft', {PKG}) on conflict do nothing;"
        )

    # --- claims -------------------------------------------------------------
    for claim in canonical["records"]["claims"]:
        subject = claim["subject"]
        if subject["type"] == "entity":
            subject_type, subject_id = "entity", ENT(subject["key"])
        elif subject["type"] == "scope":
            subject_type, subject_id = "scope", SCOPE(subject["key"])
        else:
            fail(f"claim {claim['claim_key']}: unsupported subject type {subject['type']}")
        add(
            "insert into private_staging.claims (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state) values ("
            f"{esc(claim['claim_key'])}, {esc(subject_type)}, {subject_id}, {esc(claim['predicate'])}, "
            f"{esc(claim['object']['type'])}, {jsonb(claim['object'])}, {esc(claim['evidence_status'])}, {esc(claim['textual_basis'])}, 'draft') on conflict (key) do nothing;"
        )

    # --- citations ----------------------------------------------------------
    evidence = {i["evidence_item_key"]: i for i in catalog["items"]}
    for citation in canonical["records"]["citations"]:
        item = evidence[citation["evidence_item_key"]]
        release_id = local_uuid(item["release_key"])
        edition_id = EDITION_ID if item["source_key"] == "source:bsb:edition" else "null"
        digest = sha256_text(jcs(item))
        add(
            "insert into private_staging.claim_citations (claim_id, source_release_id, source_edition_id, locator, support_kind, digest) "
            f"select {CLAIM(citation['claim_keys'][0])}, {esc(release_id)}::uuid, {edition_id}, {esc(item['locator'])}, 'supports', {esc(digest)} "
            "where not exists (select 1 from private_staging.claim_citations c where "
            f"c.claim_id={CLAIM(citation['claim_keys'][0])} and c.source_release_id={esc(release_id)}::uuid and c.locator={esc(item['locator'])});"
        )

    # --- attestations -------------------------------------------------------
    chapter_scope = canonical["scope"]["scope_keys"][0]
    for attestation in canonical["records"]["attestations"]:
        verse = attestation["reference_key"].rsplit(".", 1)[1]
        claim_id = CLAIM(attestation["claim_keys"][0]) if attestation["claim_keys"] else "null"
        add(
            "insert into private_staging.reference_entity_attestations (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state, origin_package_id) values ("
            f"{ENT(attestation['entity_key'])}, {SCOPE(chapter_scope)}, {unit(f'Neh.2.{verse}')}, {esc(attestation['kind'])}, {esc(attestation['textual_basis'])}, {claim_id}, 'draft', {PKG}) on conflict do nothing;"
        )

    # --- relationship predicates + assertions -------------------------------
    predicates = sorted({r["predicate_key"].split("relationship:", 1)[1] for r in canonical["records"]["relationships"]})
    for predicate in predicates:
        add(
            "insert into private_staging.relationship_predicates (key, inverse, is_symmetric) values ("
            f"{esc(predicate)}, null, false) on conflict (key) do nothing;"
        )
    for rel in canonical["records"]["relationships"]:
        predicate = rel["predicate_key"].split("relationship:", 1)[1]
        scope_id = SCOPE(rel["applicable_scope_keys"][0])
        add(
            "insert into private_staging.entity_relationship_assertions (subject_entity_id, predicate, object_entity_id, scope_id, certainty, origin_package_id) "
            f"select {ENT(rel['subject_entity_key'])}, {esc(predicate)}, {ENT(rel['object_entity_key'])}, {scope_id}, 'established', {PKG} "
            "where not exists (select 1 from private_staging.entity_relationship_assertions a where "
            f"a.subject_entity_id={ENT(rel['subject_entity_key'])} and a.predicate={esc(predicate)} and a.object_entity_id={ENT(rel['object_entity_key'])} and a.scope_id={scope_id});"
        )

    # --- events -------------------------------------------------------------
    for event in canonical["records"]["events"]:
        event_entity = f"entity:{event['event_key'].split('event:', 1)[1]}"
        add(
            "insert into private_staging.events (entity_id, event_kind, origin_package_id) values ("
            f"{ENT(event_entity)}, {esc(event['event_type'])}, {PKG}) on conflict (entity_id) do nothing;"
        )
        for participant in event["participant_entity_keys"]:
            add(
                "insert into private_staging.event_participants (event_id, entity_id, role, origin_package_id) values ("
                f"{ENT(event_entity)}, {ENT(participant)}, 'participant', {PKG}) on conflict do nothing;"
            )
        for place in event["place_entity_keys"]:
            add(
                "insert into private_staging.event_places (event_id, place_id, origin_package_id) values ("
                f"{ENT(event_entity)}, {ENT(place)}, {PKG}) on conflict do nothing;"
            )
        for account in event["scripture_accounts"]:
            add(
                "insert into private_staging.event_scripture_accounts (event_id, scope_id, relation, origin_package_id) values ("
                f"{ENT(event_entity)}, {SCOPE(account['scope_key'])}, {esc(account['relation'])}, {PKG}) on conflict do nothing;"
            )

    # --- place geometries ---------------------------------------------------
    for place in canonical["records"]["places"]:
        position = place["geographic_positions"][0]
        claim_id = CLAIM(position["claim_keys"][0]) if position["claim_keys"] else "null"
        add(
            "insert into private_staging.place_geometries (entity_id, crs, precision, evidence_claim_id, component_license, origin_package_id) values ("
            f"{ENT(place['entity_key'])}, 'EPSG:4326', {esc(position['precision'])}, {claim_id}, {esc(UNKNOWN_LICENSE)}, {PKG}) on conflict (entity_id) do nothing;"
        )

    # --- relevance (English role text) --------------------------------------
    localizations = {(l["scope_key"], l["entity_key"]): l for l in locale["records"]["relevance_localizations"]}
    for relevance in canonical["records"]["relevance"]:
        loc = localizations.get((relevance["scope_key"], relevance["entity_key"]))
        role_text = loc["role_text"] if loc else ""
        add(
            "insert into private_staging.scope_entity_relevance (scope_id, entity_id, role_in_passage, importance, is_attested, origin_package_id) values ("
            f"{SCOPE(relevance['scope_key'])}, {ENT(relevance['entity_key'])}, {esc(role_text)}, {esc(relevance['importance'])}, {str(relevance['is_attested']).lower()}, {PKG}) on conflict do nothing;"
        )

    # --- passage contexts (English) -----------------------------------------
    for context in locale["records"]["passage_contexts"]:
        scope_id = SCOPE(context["scope_key"])
        add("insert into private_staging.context_artifacts (scope_id, origin_package_id) values (" + scope_id + f", {PKG}) on conflict do nothing;")
        add(
            "insert into private_staging.context_revisions (artifact_id, revision) select (select id from private_staging.context_artifacts where scope_id="
            + scope_id + "), 1 on conflict do nothing;"
        )
        for kind, section in context["orientation"].items():
            if section["text"] is None:
                continue
            claims = section["claim_keys"]
            claim_select = "array[" + ",".join(
                "(select id from private_staging.claims where key=" + esc(k) + ")" for k in claims
            ) + "]::uuid[]" if claims else "array[]::uuid[]"
            add(
                "insert into private_staging.context_sections (revision_id, kind, text, claim_ids) "
                "select (select r.id from private_staging.context_revisions r join private_staging.context_artifacts a on a.id=r.artifact_id where a.scope_id="
                + scope_id + " and r.revision=1), "
                f"{esc(kind)}, {esc(section['text'])}, {claim_select} where not exists (select 1 from private_staging.context_sections s where s.revision_id="
                "(select r.id from private_staging.context_revisions r join private_staging.context_artifacts a on a.id=r.artifact_id where a.scope_id="
                + scope_id + " and r.revision=1) and s.kind=" + esc(kind) + ");"
            )

    # --- edition mentions + render spans ------------------------------------
    def verse_id(verse: int) -> str:
        return (
            "(select v.id from private_staging.translation_edition_verses v where "
            f"v.edition_id={EDITION_ID} and v.chapter=2 and v.verse_number={verse})"
        )

    for mention in edition["records"]["mentions"]:
        verse = int(mention["verse_key"].rsplit(".", 1)[1])
        sel = mention["selector"]
        text = verses[verse]
        m = mention_matches(text, sel["exact_quote"])[sel["occurrence_ordinal"] - 1]
        start_utf16 = len(text[: m.start()].encode("utf-16-le")) // 2
        end_utf16 = len(text[: m.end()].encode("utf-16-le")) // 2
        add(
            "insert into private_staging.edition_mentions (edition_id, verse_id, entity_id, form, quote, occurrence_ordinal, pipeline_text_sha256, review_state, origin_package_id) "
            f"select {EDITION_ID}, {verse_id(verse)}, {ENT(mention['target']['key'])}, {esc(mention['mention_form'])}, {esc(sel['exact_quote'])}, {sel['occurrence_ordinal']}, {esc(sha256_text(text))}, 'draft', {PKG} "
            "where not exists (select 1 from private_staging.edition_mentions em where "
            f"em.edition_id={EDITION_ID} and em.verse_id={verse_id(verse)} and em.entity_id={ENT(mention['target']['key'])} and em.quote={esc(sel['exact_quote'])} and em.occurrence_ordinal={sel['occurrence_ordinal']});"
        )
        add(
            "insert into private_staging.edition_render_spans (mention_id, start_grapheme, end_grapheme, start_utf16, end_utf16) "
            "select em.id, " + str(m.start()) + ", " + str(m.end()) + ", " + str(start_utf16) + ", " + str(end_utf16) + " "
            "from private_staging.edition_mentions em where "
            f"em.edition_id={EDITION_ID} and em.verse_id={verse_id(verse)} and em.entity_id={ENT(mention['target']['key'])} and em.quote={esc(sel['exact_quote'])} and em.occurrence_ordinal={sel['occurrence_ordinal']} "
            "on conflict (mention_id) do nothing;"
        )

    # --- package membership (entities, claims, context revisions) -----------
    for key, _slug, _etype, _ident in entity_pairs:
        add(
            "insert into private_staging.package_members (package_id, entity_id) "
            f"select {PKG}, {ENT(key)} where not exists (select 1 from private_staging.package_members pm where pm.package_id={PKG} and pm.entity_id={ENT(key)});"
        )
    for claim in canonical["records"]["claims"]:
        add(
            "insert into private_staging.package_members (package_id, claim_id) "
            f"select {PKG}, {CLAIM(claim['claim_key'])} where not exists (select 1 from private_staging.package_members pm where pm.package_id={PKG} and pm.claim_id={CLAIM(claim['claim_key'])});"
        )
    for context in locale["records"]["passage_contexts"]:
        artifact = "(select id from private_staging.context_artifacts where scope_id=" + SCOPE(context["scope_key"]) + ")"
        revision = f"(select id from private_staging.context_revisions where artifact_id={artifact} and revision=1)"
        add(
            "insert into private_staging.package_members (package_id, context_revision_id) "
            f"select {PKG}, {revision} where not exists (select 1 from private_staging.package_members pm where pm.package_id={PKG} and pm.context_revision_id={revision});"
        )

    # --- verification + receipt --------------------------------------------
    counts = {
        "entities": len(entity_pairs),
        "claims": len(canonical["records"]["claims"]),
        "citations": len(canonical["records"]["citations"]),
        "attestations": len(canonical["records"]["attestations"]),
        "mentions": len(edition["records"]["mentions"]),
        "relationships": len(canonical["records"]["relationships"]),
        "relevance": len(canonical["records"]["relevance"]),
        "contexts": len(locale["records"]["passage_contexts"]),
        "verses": len(verses),
    }
    entity_key_array = text_array([p[0] for p in entity_pairs])
    claim_key_array = text_array([c["claim_key"] for c in canonical["records"]["claims"]])
    checks = [
        ("entities", f"select count(*) from private_staging.entities where key = any({entity_key_array})", counts["entities"]),
        ("claims", f"select count(*) from private_staging.claims where key = any({claim_key_array})", counts["claims"]),
        ("attestations", f"select count(*) from private_staging.reference_entity_attestations a join private_staging.entities e on e.id=a.entity_id where e.key = any({entity_key_array})", counts["attestations"]),
        ("mentions", f"select count(*) from private_staging.edition_mentions em where em.edition_id={EDITION_ID}", counts["mentions"]),
        ("verses", f"select count(*) from private_staging.translation_edition_verses v where v.edition_id={EDITION_ID}", counts["verses"]),
        ("contexts", "select count(*) from private_staging.context_artifacts", counts["contexts"]),
    ]
    checks_sql = "\n".join(
        f"  select {expr[7:]} into n; if n <> {expected} then raise exception 'import verification failed: {name}=% expected {expected}', n; end if;"
        for name, expr, expected in checks
    )
    add(f"do $$\ndeclare n integer;\nbegin\n{checks_sql}\nend $$;")

    receipt = {
        "importer": "tools/import-neh2.py",
        "package_key": IMPORT_PACKAGE_KEY,
        "package_revision": IMPORT_REVISION,
        "payload_digest": payload_digest,
        "packages": {
            "canonical": canonical["package_key"],
            "locale": locale["package_key"],
            "edition": edition["package_key"],
        },
        "canonical_digest": sha256_text(jcs(canonical)),
        "counts": receipt_counts or build_receipt_counts(counts, {}),
        "review_status": "draft",
        "note": "Draft private import. Registry source_release rows are not created (rights gate); citation source_release_id values are deterministic local references and digests hash the evidence catalog entries.",
    }
    add(
        "insert into private_staging.curation_imports (package_key, package_revision, payload_digest, receipt) values ("
        f"{esc(IMPORT_PACKAGE_KEY)}, {IMPORT_REVISION}, {esc(payload_digest)}, {jsonb(receipt)}) on conflict (package_key) do nothing;"
    )
    return "\n".join(stmts) + "\n"


# ---------------------------------------------------------------------------
# database helpers
# ---------------------------------------------------------------------------


def psql(database_url: str, sql: str, single_transaction: bool = False) -> str:
    cmd = ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-tA"]
    if single_transaction:
        cmd.append("-1")
    if single_transaction:
        result = subprocess.run(cmd, input=sql, text=True, capture_output=True)
    else:
        result = subprocess.run(cmd + ["-c", sql], text=True, capture_output=True)
    if result.returncode != 0:
        fail(f"psql failed: {result.stderr.strip()}", 4)
    return result.stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Idempotent Nehemiah 2 curation importer.")
    parser.add_argument("--database-url", help="PostgreSQL connection string (writes).")
    parser.add_argument("--check", action="store_true", help="Validate only; no database writes.")
    parser.add_argument("--emit-sql", action="store_true", help="Print the transaction SQL and exit (no database).")
    args = parser.parse_args()

    canonical = load("canonical.v2.json")
    locale_pkg = load("locale-en.v2.json")
    edition = load("edition-bsb.v2.json")
    catalog = load("evidence-catalog.json")
    verses = bsb_verses()

    summary = validate(canonical, locale_pkg, edition, catalog, verses)
    payload_digest = sha256_text(jcs({"canonical": canonical, "locale": locale_pkg, "edition": edition, "evidence": catalog}))
    planned = planned_counts(canonical, locale_pkg, edition, verses)
    if args.emit_sql:
        sys.stdout.write(
            build_sql(
                canonical, locale_pkg, edition, catalog, verses, payload_digest,
                build_receipt_counts(planned, {}),
            )
        )
        return 0
    print(f"validated: counts={json.dumps(summary['counts'])} payload_digest={payload_digest}")
    if args.check or not args.database_url:
        if not args.check:
            print("no --database-url supplied; validation only")
        return 0

    url = args.database_url
    existing = psql(url, f"select payload_digest || '|' || package_revision from private_staging.curation_imports where package_key={esc(IMPORT_PACKAGE_KEY)}")
    if existing:
        digest, _, revision = existing.partition("|")
        if digest == payload_digest and int(revision) == IMPORT_REVISION:
            # Identical replay: report the no-op with inserted=0 and the
            # already-present rows counted as unchanged.
            noop = {
                "status": "no_op",
                "inserted": 0,
                "unchanged": sum(planned.values()),
                "rejected": 0,
                "total": sum(planned.values()),
                "by_table": {
                    name: {"inserted": 0, "unchanged": total, "rejected": 0, "total": total}
                    for name, total in planned.items()
                },
            }
            print(f"no-op: identical payload already imported (payload_digest={payload_digest})")
            print(json.dumps(noop, ensure_ascii=False))
            return 0
        fail(f"changed replay: {IMPORT_PACKAGE_KEY} was imported with digest {digest}; refusing to overwrite (rollback, no writes)", 3)

    # inserted vs unchanged is measured against rows already present for our
    # stable keys, before the single transaction writes anything.
    receipt_counts = build_receipt_counts(planned, existing_counts(url, canonical))
    sql = build_sql(canonical, locale_pkg, edition, catalog, verses, payload_digest, receipt_counts)
    psql(url, sql, single_transaction=True)
    print(f"imported: {IMPORT_PACKAGE_KEY} payload_digest={payload_digest}")
    print(psql(url, f"select receipt::text from private_staging.curation_imports where package_key={esc(IMPORT_PACKAGE_KEY)}"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
