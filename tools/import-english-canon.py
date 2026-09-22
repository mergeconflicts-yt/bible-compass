#!/usr/bin/env python3
"""Idempotent whole-English canon importer.

Imports the finalized English canonical / locale / edition draft packages into
the private_staging schema using stable keys.

  content/curated/registry/entities.json        one authoritative entity row
  content/curated/canonical/<OSIS>.v2.json      claims, citations, attestations,
                                                relationships, events, places,
                                                relevance, registry-backed
                                                reconciliation
  content/curated/locale/<OSIS>.v2.json         English names/descriptions,
                                                passage contexts, relevance copy
  content/curated/edition/<OSIS>.v2.json        BSB mentions

Guarantees (mirrors tools/import-neh2.py)
  * validation happens before any write
  * all writes run in ONE transaction (psql -1); any failure rolls back
  * inserts are idempotent (on conflict / where not exists)
  * exactly one entity row per canonical key (the registry is authoritative)
  * book attestations, English localization and BSB mentions stay separate
  * a receipt in private_staging.curation_imports records the payload
  * identical replay is a no-op; changed replay for the same package exits 3
  * drafts only; no publication, no anon access

Usage
  python3 tools/import-english-canon.py --check
  python3 tools/import-english-canon.py --emit-sql
  python3 tools/import-english-canon.py --database-url "$DATABASE_URL"
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
CURATED = REPO / "content" / "curated"
SCRIPTURE = REPO / "apps" / "mobile" / "assets" / "scripture" / "bsb"

CANON = "canon:prot-66"
REFSYS = "refsys:eng-v22"
EDITION_KEY = "edition:bsb@20260912:sha-b2898c49"
BSB_ARTIFACT_SHA = (
    "sha256:b2898c49cadb50fd8763feb9e2f74a90a3817e33408a24b6cbf09e7a950dde97"
)
IMPORT_PACKAGE_KEY = "import:english-canon:canonical-locale-edition"
IMPORT_REVISION = 1
PROVENANCE = "draft import from content/curated English v2 packages (unverified curation)"
UNKNOWN_LICENSE = "unknown"
UNKNOWN_RELEASE_ID = str(uuid.uuid5(uuid.NAMESPACE_URL, "release:unknown:bsb"))

OT_ORDER = None
SCOPE_RE = re.compile(
    r"^scope:[A-Za-z0-9-]+(?::[A-Za-z0-9-]+)*:"
    r"(?P<b>[A-Za-z1-9][A-Za-z0-9]*)\.(?P<c>\d+)\.(?P<v>\d+)-"
    r"(?P<b2>[A-Za-z1-9][A-Za-z0-9]*)\.(?P<c2>\d+)\.(?P<v2>\d+)$"
)


def fail(message: str, code: int = 1) -> None:
    print(f"import-english-canon: ERROR: {message}", file=sys.stderr)
    sys.exit(code)


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
    if not values:
        return "array[]::text[]"
    return "array[" + ",".join(esc(v) for v in values) + "]::text[]"


def uuid_array(values: list[str]) -> str:
    if not values:
        return "array[]::uuid[]"
    return "array[" + ",".join(esc(v) for v in values) + "]::uuid[]"


def load_json(path: Path) -> dict:
    if not path.exists():
        fail(f"missing input {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_books() -> list[dict]:
    books = []
    for path in sorted(SCRIPTURE.glob("*.json")):
        books.append(json.loads(path.read_text(encoding="utf-8")))
    order = [b["osis"] for b in books]
    books.sort(key=lambda b: order.index(b["osis"]))
    return books


# ---------------------------------------------------------------------------
# validation
# ---------------------------------------------------------------------------

def validate(books: list[dict], registry: dict) -> dict:
    errors: list[str] = []
    reg_keys = {e["entity_key"] for e in registry["entities"]}
    reg_slugs = {e["slug"] for e in registry["entities"]}
    chapter_scope_re = re.compile(r"^scope:(wb-[a-z0-9]+-\d+):")
    total_mentions = 0
    total_attest = 0
    for book in books:
        osis = book["osis"]
        canonical = load_json(CURATED / "canonical" / f"{osis}.v2.json")
        edition = load_json(CURATED / "edition" / f"{osis}.v2.json")
        locale = load_json(CURATED / "locale" / f"{osis}.v2.json")
        for pkg, layer, family in (
            (canonical, "canonical", "canonical-context-draft"),
            (edition, "edition", "translation-mention-draft"),
            (locale, "locale", "locale-context-draft"),
        ):
            if pkg.get("contract_version") != "2.0.0" or pkg.get("schema_version") != "2.0.0":
                errors.append(f"{osis}/{layer}: version drift")
            if pkg.get("package_layer") != layer or pkg.get("package_family") != family:
                errors.append(f"{osis}/{layer}: layer/family mismatch")
            if pkg.get("review_status") != "draft":
                errors.append(f"{osis}/{layer}: not draft")
        # canonical identities are translation-neutral
        if "bsb" in canonical["package_key"].lower() or "-en-" in canonical["package_key"].lower():
            errors.append(f"{osis}: canonical identity not translation-neutral")
        if "bsb" not in edition["package_key"].lower():
            errors.append(f"{osis}: edition identity must name BSB")
        # registry references
        for c in canonical["records"].get("entity_candidates", []):
            slug = c["candidate_key"].split("candidate:wb:", 1)[-1]
            if slug not in reg_slugs:
                errors.append(f"{osis}: candidate {slug} not in registry")
        for r in canonical["records"].get("reconciliation_records", []):
            key = r.get("canonical_entity_key")
            if key is not None and key not in reg_keys:
                errors.append(f"{osis}: reconciliation {key} not in registry")
        # coverage partitions
        for label, pkg in (("canonical", canonical), ("edition", edition)):
            authoritative = set(pkg["scope"]["reference_keys"])
            seen: set[str] = set()
            for block in pkg["coverage"]:
                for g in block["groups"]:
                    for ref in g["reference_keys"]:
                        if ref in seen:
                            errors.append(f"{osis}/{label}: overlapping coverage {ref}")
                        seen.add(ref)
            if seen != authoritative:
                errors.append(f"{osis}/{label}: coverage {len(seen)}/{len(authoritative)}")
        # mentions resolve against BSB
        verse_text = {
            (c["n"], b["n"]): b["text"]
            for c in book["chapters"]
            for b in c["blocks"]
            if b.get("t") == "v"
        }
        for m in edition["records"]["mentions"]:
            _, cv = m["verse_key"].split(":")
            parts = cv.split(".")
            text = verse_text.get((int(parts[-2]), int(parts[-1])))
            if text is None:
                errors.append(f"{osis}: mention {m['mention_key']} unknown verse")
                continue
            pattern = re.compile(
                r"(?<![A-Za-z0-9])" + re.escape(m["selector"]["exact_quote"]) + r"(?![A-Za-z0-9])"
            )
            matches = list(pattern.finditer(text))
            ordinal = m["selector"]["occurrence_ordinal"]
            if ordinal < 1 or len(matches) < ordinal:
                errors.append(f"{osis}: mention {m['mention_key']} anchor unresolved")
                continue
            match = matches[ordinal - 1]
            if (
                text[max(0, match.start() - 20) : match.start()] != m["selector"]["prefix"]
                or text[match.end() : match.end() + 20] != m["selector"]["suffix"]
            ):
                errors.append(f"{osis}: mention {m['mention_key']} prefix/suffix mismatch")
        total_mentions += len(edition["records"]["mentions"])
        total_attest += len(canonical["records"]["attestations"])
    if errors:
        for e in errors[:40]:
            print(f"  - {e}", file=sys.stderr)
        fail(f"{len(errors)} validation error(s)")
    return {
        "books": len(books),
        "registry_entities": len(registry["entities"]),
        "attestations": total_attest,
        "mentions": total_mentions,
    }


# ---------------------------------------------------------------------------
# SQL generation
# ---------------------------------------------------------------------------

def build_sql(books: list[dict], registry: dict) -> tuple[str, dict]:
    stmts: list[str] = []

    def add(sql: str) -> None:
        stmts.append(sql)

    # --- canon / works / reference system ---------------------------------
    add("insert into private_staging.canons (key, name) values ('canon:prot-66','Protestant 66') on conflict (key) do nothing;")
    for i, book in enumerate(books, start=1):
        osis = book["osis"]
        work_key = f"work:{osis}:prot-66"
        add(
            "insert into private_staging.scripture_works (key, osis_code, name, testament) values ("
            f"{esc(work_key)}, {esc(osis)}, {esc(book['name'])}, "
            f"{esc('OT' if i <= 39 else 'NT')}) on conflict (key) do nothing;"
        )
        add(
            "insert into private_staging.canon_work_memberships (canon_id, work_id, order_index) "
            f"select (select id from private_staging.canons where key='canon:prot-66'), "
            f"(select id from private_staging.scripture_works where osis_code={esc(book['osis'])}), {i} "
            "on conflict do nothing;"
        )
    add(
        "insert into private_staging.reference_systems (key, canon_id, version, status) "
        f"values ({esc(REFSYS)}, (select id from private_staging.canons where key='canon:prot-66'), 22, 'active') "
        "on conflict (key) do nothing;"
    )

    # --- reference units (book, chapter, verse) ---------------------------
    refsys_id = f"(select id from private_staging.reference_systems where key={esc(REFSYS)})"
    work = lambda osis: f"(select id from private_staging.scripture_works where osis_code={esc(osis)})"
    for i, book in enumerate(books, start=1):
        osis = book["osis"]
        base = i * 1_000_000
        add(
            "insert into private_staging.reference_units (reference_system_id, local_key, work_id, chapter_label, verse_label, kind, ordinal) values ("
            f"{refsys_id}, {esc(osis.lower())}, {work(osis)}, '0', null, 'book', {base}) on conflict do nothing;"
        )
        for ch in book["chapters"]:
            chapter_key = f"{osis}.{ch['n']}"
            add(
                "insert into private_staging.reference_units (reference_system_id, local_key, work_id, chapter_label, verse_label, kind, ordinal) values ("
                f"{refsys_id}, {esc(chapter_key.lower())}, {work(osis)}, {esc(str(ch['n']))}, null, 'chapter', {base + ch['n'] * 1000}) on conflict do nothing;"
            )
            for b in ch["blocks"]:
                if b.get("t") != "v":
                    continue
                add(
                    "insert into private_staging.reference_units (reference_system_id, local_key, work_id, chapter_label, verse_label, kind, ordinal) values ("
                    f"{refsys_id}, {esc(f'{osis.lower()}.{ch['n']}.{b['n']}')}, {work(osis)}, {esc(str(ch['n']))}, {esc(str(b['n']))}, 'verse', {base + ch['n'] * 1000 + b['n']}) on conflict do nothing;"
                )

    unit = lambda local: f"(select id from private_staging.reference_units ru where ru.reference_system_id={refsys_id} and ru.local_key={esc(local.lower())})"

    # --- scopes -----------------------------------------------------------
    scope_kinds: dict[str, str] = {}
    for book in books:
        osis = book["osis"]
        canonical = load_json(CURATED / "canonical" / f"{osis}.v2.json")
        for sk in canonical["scope"]["scope_keys"]:
            if sk.startswith(f"scope:wb-{osis.lower()}:refsys"):
                scope_kinds[sk] = "book"
            elif sk.startswith(f"scope:wb-{osis.lower()}-"):
                tail = sk.split(":", 1)[1]
                scope_kinds[sk] = "pericope" if "-p" in tail.split(":", 1)[0] else "chapter"
            else:
                scope_kinds[sk] = "pericope"
    for sk, kind in sorted(scope_kinds.items()):
        rng = SCOPE_RE.match(sk)
        if not rng:
            continue
        start = unit(f"{rng.group('b')}.{rng.group('c')}.{rng.group('v')}")
        end = unit(f"{rng.group('b2')}.{rng.group('c2')}.{rng.group('v2')}")
        # The schema requires non-degenerate ranges except for chapter scopes.
        if (rng.group("b"), rng.group("c"), rng.group("v")) == (
            rng.group("b2"),
            rng.group("c2"),
            rng.group("v2"),
        ):
            kind = "chapter"
        add(
            "insert into private_staging.scripture_scopes (key, reference_system_id, kind, start_unit_id, end_unit_id, display_name, certainty) values ("
            f"{esc(sk)}, {refsys_id}, {esc(kind)}, {start}, {end}, {esc(sk.split(':', 2)[1])}, 'established') on conflict (key) do nothing;"
        )
    scope_id = lambda sk: f"(select id from private_staging.scripture_scopes where key={esc(sk)})"

    # --- translation edition + verses -------------------------------------
    add(
        "insert into private_staging.translation_works (key, language_tag, name, publisher) values ('trans:bsb','en','Berean Standard Bible','Bible Hub (berean.bible)') on conflict (key) do nothing;"
    )
    add(
        "insert into private_staging.translation_editions (work_id, key, language_tag, reference_system_id, revision_date, source_artifact_sha256, attribution, status) values ("
        f"(select id from private_staging.translation_works where key='trans:bsb'), {esc(EDITION_KEY)}, 'en', {refsys_id}, '2026-09-12', {esc(BSB_ARTIFACT_SHA)}, 'Berean Standard Bible · BSB', 'draft') on conflict (key) do nothing;"
    )
    edition_id = f"(select id from private_staging.translation_editions where key={esc(EDITION_KEY)})"
    for book in books:
        osis = book["osis"]
        for ch in book["chapters"]:
            for b in ch["blocks"]:
                if b.get("t") != "v":
                    continue
                add(
                    "insert into private_staging.translation_edition_verses (edition_id, reference_unit_id, book_id, chapter, verse_number, text, text_sha256) values ("
                    f"{edition_id}, {unit(f'{osis}.{ch['n']}.{b['n']}')}, {work(osis)}, {ch['n']}, {b['n']}, {esc(b['text'])}, {esc(sha256_text(b['text']))}) on conflict do nothing;"
                )
    verse_id = lambda osis, ch, v: (
        f"(select id from private_staging.translation_edition_verses where edition_id={edition_id} "
        f"and book_id={work(osis)} and chapter={ch} and verse_number={v})"
    )

    # --- entities (ONE row per canonical key; the registry is authoritative)
    for e in sorted(registry["entities"], key=lambda x: x["entity_key"]):
        add(
            "insert into private_staging.entities (key, slug, type, identification_status, provenance) values ("
            f"{esc(e['entity_key'])}, {esc(e['slug'])}, {esc(e['type'])}, 'established', {esc(PROVENANCE)}) on conflict (key) do nothing;"
        )
    # event entities (canonical events are entities of type event)
    for book in books:
        canonical = load_json(CURATED / "canonical" / f"{book['osis']}.v2.json")
        for ev in canonical["records"].get("events", []):
            slug = ev["event_key"].split("event:", 1)[1]
            add(
                "insert into private_staging.entities (key, slug, type, identification_status, provenance) values ("
                f"{esc('entity:' + slug)}, {esc(slug)}, 'event', 'established', {esc(PROVENANCE)}) on conflict (key) do nothing;"
            )
    ent = lambda key: f"(select id from private_staging.entities where key={esc(key)})"

    # --- entity names + English descriptions ------------------------------
    for e in sorted(registry["entities"], key=lambda x: x["entity_key"]):
        forms = [("preferred", e["preferred_name"])] + [
            ("alias", a) for a in e.get("aliases", []) if a and a != e["preferred_name"]
        ]
        seen_norm: set[str] = set()
        for kind, form in forms:
            norm = form.strip().lower()
            if not norm or norm in seen_norm:
                continue
            seen_norm.add(norm)
            add(
                "insert into private_staging.entity_names (entity_id, language_tag, form, normalized_form, kind) values ("
                f"{ent(e['entity_key'])}, 'en', {esc(form)}, {esc(norm)}, {esc(kind)}) on conflict do nothing;"
            )
    for book in books:
        osis = book["osis"]
        locale = load_json(CURATED / "locale" / f"{osis}.v2.json")
        for prof in locale["records"].get("entity_profiles", []):
            short = prof["short_description"]["text"]
            extended = prof.get("extended_description")
            add(
                "insert into private_staging.entity_descriptions (entity_id, locale, revision, short_desc, extended_desc, source_locale, review_state) values ("
                f"{ent(prof['entity_key'])}, 'en', 1, {esc(short)}, "
                f"{esc(extended['text']) if extended else 'null'}, 'en', 'draft') on conflict do nothing;"
            )

    # --- claims + citations ----------------------------------------------
    for book in books:
        osis = book["osis"]
        canonical = load_json(CURATED / "canonical" / f"{osis}.v2.json")
        for claim in canonical["records"].get("claims", []):
            subject = claim["subject"]
            if subject["type"] == "entity":
                subject_id = ent(subject["key"])
                subject_type = "entity"
            elif subject["type"] == "scope":
                subject_id = scope_id(subject["key"])
                subject_type = "scope"
            else:
                continue
            add(
                "insert into private_staging.claims (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state) values ("
                f"{esc(claim['claim_key'])}, {esc(subject_type)}, {subject_id}, {esc(claim['predicate'])}, "
                f"{esc(claim['object']['type'])}, {jsonb(claim['object'])}, {esc(claim['evidence_status'])}, {esc(claim['textual_basis'])}, 'draft') on conflict (key) do nothing;"
            )
        claim_id = lambda key: f"(select id from private_staging.claims where key={esc(key)})"
        for citation in canonical["records"].get("citations", []):
            locator = citation["evidence_item_key"]
            add(
                "insert into private_staging.claim_citations (claim_id, source_release_id, source_edition_id, locator, support_kind, digest) "
                f"select {claim_id(citation['claim_keys'][0])}, {esc(UNKNOWN_RELEASE_ID)}::uuid, {edition_id}, {esc(locator)}, {esc(citation['stance'])}, {esc(sha256_text(locator))} "
                "where not exists (select 1 from private_staging.claim_citations c where "
                f"c.claim_id={claim_id(citation['claim_keys'][0])} and c.source_release_id={esc(UNKNOWN_RELEASE_ID)}::uuid and c.locator={esc(locator)});"
            )

    # --- book attestations (separate from mentions/localization) ----------
    for book in books:
        osis = book["osis"]
        canonical = load_json(CURATED / "canonical" / f"{osis}.v2.json")
        ch_scope = {
            int(m.group(1)): sk
            for sk in canonical["scope"]["scope_keys"]
            if (m := re.match(rf"^scope:wb-{osis.lower()}-(\d+):", sk))
        }
        for a in canonical["records"]["attestations"]:
            _, cv = a["reference_key"].split(":")
            parts = cv.split(".")
            ch, v = int(parts[-2]), int(parts[-1])
            sc = ch_scope.get(ch)
            if sc is None:
                continue
            cid = claim_id(a["claim_keys"][0]) if a["claim_keys"] else "null"
            add(
                "insert into private_staging.reference_entity_attestations (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state) values ("
                f"{ent(a['entity_key'])}, {scope_id(sc)}, {unit(f'{osis}.{ch}.{v}')}, {esc(a['kind'])}, {esc(a['textual_basis'])}, {cid}, 'draft') on conflict do nothing;"
            )

    # --- BSB edition mentions --------------------------------------------
    for book in books:
        osis = book["osis"]
        edition = load_json(CURATED / "edition" / f"{osis}.v2.json")
        verse_text = {
            (c["n"], b["n"]): b["text"]
            for c in book["chapters"]
            for b in c["blocks"]
            if b.get("t") == "v"
        }
        for m in edition["records"]["mentions"]:
            _, cv = m["verse_key"].split(":")
            parts = cv.split(".")
            ch, v = int(parts[-2]), int(parts[-1])
            text = verse_text.get((ch, v), "")
            add(
                "insert into private_staging.edition_mentions (edition_id, verse_id, entity_id, form, quote, occurrence_ordinal, pipeline_text_sha256, review_state) "
                f"select {edition_id}, {verse_id(osis, ch, v)}, {ent(m['target']['key'])}, {esc(m['mention_form'])}, {esc(m['selector']['exact_quote'])}, {m['selector']['occurrence_ordinal']}, {esc(sha256_text(text))}, 'draft' "
                "where not exists (select 1 from private_staging.edition_mentions em where "
                f"em.edition_id={edition_id} and em.verse_id={verse_id(osis, ch, v)} and em.entity_id={ent(m['target']['key'])} "
                f"and em.quote={esc(m['selector']['exact_quote'])} and em.occurrence_ordinal={m['selector']['occurrence_ordinal']});"
            )

    # --- relevance + English role copy -----------------------------------
    for book in books:
        osis = book["osis"]
        canonical = load_json(CURATED / "canonical" / f"{osis}.v2.json")
        locale = load_json(CURATED / "locale" / f"{osis}.v2.json")
        role_by_relevance = {
            loc["relevance_key"]: loc["role_text"]
            for loc in locale["records"].get("relevance_localizations", [])
        }
        for r in canonical["records"].get("relevance", []):
            role = role_by_relevance.get(r["relevance_key"], "Named in this passage.")
            add(
                "insert into private_staging.scope_entity_relevance (scope_id, entity_id, role_in_passage, importance, is_attested) values ("
                f"{scope_id(r['scope_key'])}, {ent(r['entity_key'])}, {esc(role)}, {esc(r['importance'])}, {str(r['is_attested']).lower()}) on conflict do nothing;"
            )

    # --- relationships ----------------------------------------------------
    predicates: dict[str, None] = {}
    for book in books:
        canonical = load_json(CURATED / "canonical" / f"{book['osis']}.v2.json")
        for rel in canonical["records"].get("relationships", []):
            predicates.setdefault(rel["predicate_key"], None)
    for pred in sorted(predicates):
        add(
            "insert into private_staging.relationship_predicates (key, inverse, is_symmetric) values ("
            f"{esc(pred)}, null, false) on conflict (key) do nothing;"
        )
    for book in books:
        osis = book["osis"]
        canonical = load_json(CURATED / "canonical" / f"{osis}.v2.json")
        for rel in canonical["records"].get("relationships", []):
            sc = rel["applicable_scope_keys"][0]
            add(
                "insert into private_staging.entity_relationship_assertions (subject_entity_id, predicate, object_entity_id, scope_id, certainty) "
                f"select {ent(rel['subject_entity_key'])}, {esc(rel['predicate_key'])}, {ent(rel['object_entity_key'])}, {scope_id(sc)}, 'established' "
                "where not exists (select 1 from private_staging.entity_relationship_assertions a where "
                f"a.subject_entity_id={ent(rel['subject_entity_key'])} and a.predicate={esc(rel['predicate_key'])} "
                f"and a.object_entity_id={ent(rel['object_entity_key'])} and a.scope_id={scope_id(sc)});"
            )

    # --- events -----------------------------------------------------------
    for book in books:
        canonical = load_json(CURATED / "canonical" / f"{book['osis']}.v2.json")
        for ev in canonical["records"].get("events", []):
            ev_key = "entity:" + ev["event_key"].split("event:", 1)[1]
            add(
                "insert into private_staging.events (entity_id, event_kind) values ("
                f"{ent(ev_key)}, {esc(ev['event_type'])}) on conflict (entity_id) do nothing;"
            )
            for p in ev["participant_entity_keys"]:
                add(
                    "insert into private_staging.event_participants (event_id, entity_id, role) values ("
                    f"{ent(ev_key)}, {ent(p)}, 'participant') on conflict do nothing;"
                )
            for pl in ev["place_entity_keys"]:
                add(
                    "insert into private_staging.event_places (event_id, place_id) values ("
                    f"{ent(ev_key)}, {ent(pl)}) on conflict do nothing;"
                )
            for account in ev["scripture_accounts"]:
                add(
                    "insert into private_staging.event_scripture_accounts (event_id, scope_id, relation) values ("
                    f"{ent(ev_key)}, {scope_id(account['scope_key'])}, {esc(account['relation'])}) on conflict do nothing;"
                )

    # --- place geometries (home places) -----------------------------------
    for book in books:
        canonical = load_json(CURATED / "canonical" / f"{book['osis']}.v2.json")
        for place in canonical["records"].get("places", []):
            for pos in place["geographic_positions"]:
                add(
                    "insert into private_staging.place_geometries (entity_id, crs, precision, evidence_claim_id, component_license) values ("
                    f"{ent(place['entity_key'])}, 'EPSG:4326', {esc(pos['precision'])}, null, {esc(UNKNOWN_LICENSE)}) on conflict (entity_id) do nothing;"
                )

    # --- passage contexts -------------------------------------------------
    for book in books:
        locale = load_json(CURATED / "locale" / f"{book['osis']}.v2.json")
        for ctx in locale["records"].get("passage_contexts", []):
            sid = scope_id(ctx["scope_key"])
            add(
                "insert into private_staging.context_artifacts (scope_id) values ("
                f"{sid}) on conflict (scope_id) do nothing;"
            )
            artifact = f"(select id from private_staging.context_artifacts where scope_id={sid})"
            add(
                "insert into private_staging.context_revisions (artifact_id, revision) values ("
                f"{artifact}, 1) on conflict do nothing;"
            )
            revision = f"(select id from private_staging.context_revisions where artifact_id={artifact} and revision=1)"
            for kind, section in ctx["orientation"].items():
                if not section.get("text"):
                    continue
                keys = section.get("claim_keys", [])
                claim_select = (
                    "array[]::uuid[]"
                    if not keys
                    else "array[" + ",".join(claim_id(k) for k in keys) + "]::uuid[]"
                )
                add(
                    "insert into private_staging.context_sections (revision_id, kind, text, claim_ids) "
                    f"select {revision}, {esc(kind)}, {esc(section['text'])}, {claim_select} "
                    "where not exists (select 1 from private_staging.context_sections s where "
                    f"s.revision_id={revision} and s.kind={esc(kind)});"
                )

    # --- receipt ----------------------------------------------------------
    return "\n".join(stmts), {}


def payload_digest(books: list[dict], registry: dict) -> str:
    parts = [jcs(registry)]
    for book in books:
        osis = book["osis"]
        for layer in ("canonical", "edition", "locale"):
            parts.append(jcs(load_json(CURATED / layer / f"{osis}.v2.json")))
    return "sha256:" + hashlib.sha256("".join(parts).encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# database
# ---------------------------------------------------------------------------

def psql(url: str, sql: str, single_transaction: bool = False) -> str:
    args = ["psql", url, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-q"]
    if single_transaction:
        args.append("-1")
    proc = subprocess.run(
        args, input=sql, capture_output=True, text=True
    )
    if proc.returncode != 0:
        fail(f"psql failed: {proc.stderr.strip()}")
    return proc.stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Idempotent whole-English canon importer.")
    parser.add_argument("--database-url", help="PostgreSQL URL (enables writes).")
    parser.add_argument("--check", action="store_true", help="Validate only; no writes.")
    parser.add_argument("--emit-sql", action="store_true", help="Print the transaction SQL.")
    args = parser.parse_args()

    books = load_books()
    registry = load_json(CURATED / "registry" / "entities.json")
    counts = validate(books, registry)
    digest = payload_digest(books, registry)

    if args.check or (not args.database_url and not args.emit_sql):
        print(f"validated: {jcs(counts)} payload_digest={digest}")
        return 0

    body, _ = build_sql(books, registry)
    receipt = {
        "kind": "english-canon",
        "books": counts["books"],
        "entities": counts["registry_entities"],
        "attestations": counts["attestations"],
        "mentions": counts["mentions"],
        "payload_digest": digest,
        "review_state": "draft",
    }
    header = (
        f"insert into private_staging.curation_imports (package_key, package_revision, payload_digest, receipt) values ("
        f"{esc(IMPORT_PACKAGE_KEY)}, {IMPORT_REVISION}, {esc(digest)}, {jsonb(receipt)}) "
        "on conflict (package_key) do nothing;\n"
    )
    sql = header + body

    if args.emit_sql:
        print(sql)
        return 0

    existing = psql(
        args.database_url,
        f"select payload_digest || '|' || package_revision from private_staging.curation_imports where package_key={esc(IMPORT_PACKAGE_KEY)}",
    )
    if existing:
        current = existing.splitlines()[0]
        if current == f"{digest}|{IMPORT_REVISION}":
            print("replay: identical payload — no-op")
            return 0
        fail(
            f"replay: changed payload for {IMPORT_PACKAGE_KEY} (was {current.split('|')[0]})",
            3,
        )

    psql(args.database_url, sql, single_transaction=True)
    print(f"imported: {jcs(counts)} payload_digest={digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
