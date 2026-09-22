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
  * revision-gated resync: the import deletes the rows owned by this
    package (English wb-* scopes, the BSB edition's mentions, payload
    entities/events/places/claims) and reinserts the payload, so an
    upgrade converges to the clean-import state instead of leaving stale
    rows beside new ones; identical replay is a no-op via the receipt
  * exactly one entity row per canonical key (the registry is authoritative)
  * book attestations, English localization and BSB mentions stay separate
  * a receipt in private_staging.curation_imports records the payload
  * changed replay for the same package without a revision bump exits 3
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import canon_order  # noqa: E402
import relationship_ontology  # noqa: E402

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
# Revision 6: whole-canon draft manifest + package membership, lossless
# witness links (all attestation claims, every relationship scope, event/
# place claim links), real citation provenance (evidence key as locator +
# deterministic release), edition render spans so imported mentions are
# anchorable in the app, ownership-scoped resync (origin_package_id) so a
# refresh never deletes another package's rows, and package-driven place
# precision/license. Revision 5: divine identities (Jesus Christ, God, Holy
# Spirit) with anchor-graded attestations, retained-phrase mentions,
# per-reference sense classification, registry identification statuses and
# canonical language tags. Revisions 1-3 used ON CONFLICT DO NOTHING / WHERE
# NOT EXISTS for most tables, so an upgrade left stale rows beside new ones;
# revision 4 added owned-row resync, which revision 6 narrows to explicit
# per-row ownership.
# A revision bump authorizes re-import over an older receipt.
IMPORT_REVISION = 6
# The whole-English canon is one draft package; its manifest is created
# unpublished. MANIFEST_REVISION tracks the import revision so a content bump
# produces a new manifest key (`en.bsb.all@<rev>:sha-<digest8>`).
MANIFEST_REVISION = IMPORT_REVISION
PROVENANCE = "draft import from content/curated English v2 packages (unverified curation)"
UNKNOWN_LICENSE = "unknown"
UNKNOWN_RELEASE_ID = str(uuid.uuid5(uuid.NAMESPACE_URL, "release:unknown:bsb"))

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


def _locate_mention(text: str, selector: dict) -> tuple[int, int] | None:
    """Character span of a mention's selector in a verse, or None."""
    quote = selector["exact_quote"]
    pattern = re.compile(r"(?<![A-Za-z0-9])" + re.escape(quote) + r"(?![A-Za-z0-9])")
    matches = list(pattern.finditer(text))
    ordinal = selector["occurrence_ordinal"]
    if ordinal < 1 or len(matches) < ordinal:
        return None
    match = matches[ordinal - 1]
    return match.start(), match.end()


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
    """Books in authoritative canon order (never alphabetical file order)."""
    books = []
    for path in sorted(SCRIPTURE.glob("*.json")):
        books.append(json.loads(path.read_text(encoding="utf-8")))
    return canon_order.ordered(books)


# ---------------------------------------------------------------------------
# validation
# ---------------------------------------------------------------------------

def validate(books: list[dict], registry: dict) -> dict:
    errors: list[str] = []
    reg_keys = {e["entity_key"] for e in registry["entities"]}
    reg_slugs = {e["slug"] for e in registry["entities"]}
    chapter_scope_re = re.compile(r"^scope:(wb-[a-z0-9]+-\d+):")
    # Registry identification status is authoritative: unresolved source
    # identities must never validate as established.
    allowed_status = {"established", "traditional", "proposed", "disputed", "unknown"}
    for e in registry["entities"]:
        if e.get("identification_status") not in allowed_status:
            errors.append(f"registry {e.get('entity_key')}: invalid identification_status")
        if e.get("language_tag") != "en":
            errors.append(f"registry {e.get('entity_key')}: untagged display name")
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
        # Relationship predicates are enforced against the controlled
        # ontology: a package can never introduce a new predicate by import.
        for rel in canonical["records"].get("relationships", []):
            if not relationship_ontology.is_allowed(rel["predicate_key"]):
                errors.append(
                    f"{osis}: relationship {rel['relationship_key']} predicate "
                    f"{rel['predicate_key']} outside the controlled ontology"
                )
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

def build_sql(books: list[dict], registry: dict, digest_hex: str) -> tuple[str, dict]:
    stmts: list[str] = []

    def add(sql: str) -> None:
        stmts.append(sql)

    # The whole-English canon is ONE draft package. Its manifest is created
    # unpublished and unapproved: a draft import records membership but can
    # never be published until a matching approval exists and rights are
    # cleared (private_staging.package_is_published + the manifest trigger).
    manifest_key = f"en.bsb.all@{MANIFEST_REVISION}:sha-{digest_hex[:8]}"
    manifest_digest = "sha256:" + digest_hex

    # --- canon / works / reference system ---------------------------------

    for i, book in enumerate(books, start=1):
        osis = book["osis"]
        work_key = f"work:{osis}:prot-66"
        add(
            "insert into private_staging.scripture_works (key, osis_code, name, testament) values ("
            f"{esc(work_key)}, {esc(osis)}, {esc(book['name'])}, "
            f"{esc(canon_order.TESTAMENT_BY_OSIS[osis])}) "
            "on conflict (key) do update set name = excluded.name, testament = excluded.testament;"
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
    # Move existing ordinals out of the way so the unique (refsys, ordinal)
    # constraint cannot collide while the corrective updates land.
    add(
        "update private_staging.reference_units set ordinal = ordinal + 100000000 "
        f"where reference_system_id = {refsys_id};"
    )
    unit_upsert = "on conflict (reference_system_id, local_key) do update set ordinal = excluded.ordinal, chapter_label = excluded.chapter_label, verse_label = excluded.verse_label, kind = excluded.kind"
    for i, book in enumerate(books, start=1):
        osis = book["osis"]
        base = i * 1_000_000
        add(
            "insert into private_staging.reference_units (reference_system_id, local_key, work_id, chapter_label, verse_label, kind, ordinal) values ("
            f"{refsys_id}, {esc(osis.lower())}, {work(osis)}, '0', null, 'book', {base}) {unit_upsert};"
        )
        for ch in book["chapters"]:
            chapter_key = f"{osis}.{ch['n']}"
            add(
                "insert into private_staging.reference_units (reference_system_id, local_key, work_id, chapter_label, verse_label, kind, ordinal) values ("
                f"{refsys_id}, {esc(chapter_key.lower())}, {work(osis)}, {esc(str(ch['n']))}, null, 'chapter', {base + ch['n'] * 1000}) {unit_upsert};"
            )
            for b in ch["blocks"]:
                if b.get("t") != "v":
                    continue
                add(
                    "insert into private_staging.reference_units (reference_system_id, local_key, work_id, chapter_label, verse_label, kind, ordinal) values ("
                    f"{refsys_id}, {esc(f'{osis.lower()}.{ch['n']}.{b['n']}')}, {work(osis)}, {esc(str(ch['n']))}, {esc(str(b['n']))}, 'verse', {base + ch['n'] * 1000 + b['n']}) {unit_upsert};"
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
            f"{esc(sk)}, {refsys_id}, {esc(kind)}, {start}, {end}, {esc(sk.split(':', 2)[1])}, 'established') "
            "on conflict (key) do update set kind = excluded.kind;"
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

    # --- whole-English draft manifest (unpublished, unapproved) -----------
    add(
        "insert into private_staging.package_manifests "
        "(key, locale, translation_edition_id, scope_id, schema_version, content_version, "
        "checksum, minimum_app_version, approval_id, published_at, rights_status) values ("
        f"{esc(manifest_key)}, 'en', {edition_id}, null, '2.0.0', {MANIFEST_REVISION}, "
        f"{esc(manifest_digest)}, '0.0.0', null, null, 'unknown') "
        "on conflict (key) do update set checksum = excluded.checksum, content_version = excluded.content_version;"
    )
    manifest = f"(select id from private_staging.package_manifests where key={esc(manifest_key)})"

    # --- ownership-scoped resync (revision-safe coexistence) --------------
    # Delete ONLY rows this package owns (origin_package_id = this manifest).
    # Rows first written by another package (e.g. the locked Nehemiah 2
    # package) keep a NULL origin and are never removed, so a later English
    # refresh cannot destroy another package's reviewed rows or break the
    # restrictive foreign keys on their Telugu/Tamil localizations. Dependent
    # rows are deleted before the rows they reference (on delete restrict).
    add(f"delete from private_staging.edition_render_spans where mention_id in "
        f"(select id from private_staging.edition_mentions where origin_package_id = {manifest});")
    add(f"delete from private_staging.edition_mentions where origin_package_id = {manifest};")
    add(f"delete from private_staging.reference_entity_attestation_claims where attestation_id in "
        f"(select id from private_staging.reference_entity_attestations where origin_package_id = {manifest});")
    add(f"delete from private_staging.reference_entity_attestations where origin_package_id = {manifest};")
    add(f"delete from private_staging.entity_relationship_assertion_claims where assertion_id in "
        f"(select id from private_staging.entity_relationship_assertions where origin_package_id = {manifest});")
    add(f"delete from private_staging.entity_relationship_assertions where origin_package_id = {manifest};")
    add(f"delete from private_staging.scope_entity_relevance where origin_package_id = {manifest};")
    add(f"delete from private_staging.event_participant_claims where (event_id, entity_id, role) in "
        f"(select event_id, entity_id, role from private_staging.event_participants where origin_package_id = {manifest});")
    add(f"delete from private_staging.event_place_claims where (event_id, place_id) in "
        f"(select event_id, place_id from private_staging.event_places where origin_package_id = {manifest});")
    add(f"delete from private_staging.event_scripture_account_claims where (event_id, scope_id) in "
        f"(select event_id, scope_id from private_staging.event_scripture_accounts where origin_package_id = {manifest});")
    add(f"delete from private_staging.event_participants where origin_package_id = {manifest};")
    add(f"delete from private_staging.event_places where origin_package_id = {manifest};")
    add(f"delete from private_staging.event_scripture_accounts where origin_package_id = {manifest};")
    add(f"delete from private_staging.events where origin_package_id = {manifest};")
    add(f"delete from private_staging.place_geometries where origin_package_id = {manifest};")
    add(f"delete from private_staging.entity_names where origin_package_id = {manifest};")
    add(f"delete from private_staging.entity_descriptions where origin_package_id = {manifest};")
    add(f"delete from private_staging.context_sections where revision_id in "
        f"(select cr.id from private_staging.context_revisions cr "
        f"join private_staging.context_artifacts ca on ca.id = cr.artifact_id "
        f"where ca.origin_package_id = {manifest});")
    add(f"delete from private_staging.context_revisions where artifact_id in "
        f"(select id from private_staging.context_artifacts where origin_package_id = {manifest});")
    add(f"delete from private_staging.context_artifacts where origin_package_id = {manifest};")
    add(f"delete from private_staging.package_members where package_id = {manifest};")

    # --- entities (ONE row per canonical key; the registry is authoritative)
    # Upsert (never delete: every other table references entities): an
    # upgrade corrects a stale type/slug/status instead of keeping it. The
    # identification status comes from the registry, so source-unresolved
    # identities (proposed) are never written as established.
    entity_upsert = (
        "on conflict (key) do update set slug = excluded.slug, type = excluded.type, "
        "identification_status = excluded.identification_status, provenance = excluded.provenance"
    )
    for e in sorted(registry["entities"], key=lambda x: x["entity_key"]):
        add(
            "insert into private_staging.entities (key, slug, type, identification_status, provenance) values ("
            f"{esc(e['entity_key'])}, {esc(e['slug'])}, {esc(e['type'])}, {esc(e.get('identification_status', 'established'))}, {esc(PROVENANCE)}) {entity_upsert};"
        )
    # event entities (canonical events are entities of type event)
    for book in books:
        canonical = load_json(CURATED / "canonical" / f"{book['osis']}.v2.json")
        for ev in canonical["records"].get("events", []):
            slug = ev["event_key"].split("event:", 1)[1]
            add(
                "insert into private_staging.entities (key, slug, type, identification_status, provenance) values ("
                f"{esc('entity:' + slug)}, {esc(slug)}, 'event', 'established', {esc(PROVENANCE)}) {entity_upsert};"
            )
    ent = lambda key: f"(select id from private_staging.entities where key={esc(key)})"

    # --- structured external identifiers (finding 26) ---------------------
    # Source row ids are retained as (source, external_id, evidence) mappings
    # instead of being embedded in the canonical key and forgotten.
    for e in sorted(registry["entities"], key=lambda x: x["entity_key"]):
        for ext in e.get("external_ids", []) or []:
            source = (ext.get("source") or "").strip()
            external_id = (ext.get("id") or "").strip()
            if not (source and external_id):
                continue
            label = ext.get("label")
            evidence = ext.get("evidence")
            add(
                "insert into private_staging.entity_external_ids (entity_id, source, external_id, label, evidence_key) values ("
                f"{ent(e['entity_key'])}, {esc(source)}, {esc(external_id)}, "
                f"{esc(label) if label else 'null'}, {esc(evidence) if evidence else 'null'}) on conflict do nothing;"
            )

    # --- entity names + English descriptions ------------------------------
    # Source identifiers (e.g. OpenBible a15257a) are never searchable
    # English names, even if one ever regresses into the registry. The
    # digit-required shape is a backstop; the queue drops them by exact set.
    source_id = re.compile(r"^(?=.*\d)[a-z0-9]{4,10}$")
    for e in sorted(registry["entities"], key=lambda x: x["entity_key"]):
        forms = [("preferred", e["preferred_name"])] + [
            ("alias", a)
            for a in e.get("aliases", [])
            if a and a != e["preferred_name"] and not source_id.fullmatch(a.strip())
        ]
        seen_norm: set[str] = set()
        for kind, form in forms:
            norm = form.strip().lower()
            if not norm or norm in seen_norm:
                continue
            seen_norm.add(norm)
            add(
                "insert into private_staging.entity_names (entity_id, language_tag, form, normalized_form, kind, origin_package_id) values ("
                f"{ent(e['entity_key'])}, 'en', {esc(form)}, {esc(norm)}, {esc(kind)}, {manifest}) on conflict do nothing;"
            )
    for book in books:
        osis = book["osis"]
        locale = load_json(CURATED / "locale" / f"{osis}.v2.json")
        for prof in locale["records"].get("entity_profiles", []):
            short = prof["short_description"]["text"]
            extended = prof.get("extended_description")
            add(
                "insert into private_staging.entity_descriptions (entity_id, locale, revision, short_desc, extended_desc, source_locale, review_state, origin_package_id) values ("
                f"{ent(prof['entity_key'])}, 'en', 1, {esc(short)}, "
                f"{esc(extended['text']) if extended else 'null'}, 'en', 'draft', {manifest}) on conflict do nothing;"
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
            # Claims are upserted, never deleted: attestations, citations and
            # geometries reference them, including rows of a co-installed
            # Nehemiah-2 package that shares claim keys.
            add(
                "insert into private_staging.claims (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state) values ("
                f"{esc(claim['claim_key'])}, {esc(subject_type)}, {subject_id}, {esc(claim['predicate'])}, "
                f"{esc(claim['object']['type'])}, {jsonb(claim['object'])}, {esc(claim['evidence_status'])}, {esc(claim['textual_basis'])}, 'draft') "
                "on conflict (key) do update set subject_type = excluded.subject_type, subject_id = excluded.subject_id, "
                "predicate = excluded.predicate, object_type = excluded.object_type, object = excluded.object, "
                "evidence_status = excluded.evidence_status, textual_basis = excluded.textual_basis, review_state = excluded.review_state;"
            )
        claim_id = lambda key: f"(select id from private_staging.claims where key={esc(key)})"
        for citation in canonical["records"].get("citations", []):
            # Provenance is preserved: the citation keeps its evidence-item
            # key as locator and a deterministic release derived from it,
            # instead of a placeholder "unknown" release and a hashed locator.
            locator = citation["evidence_item_key"]
            release = local_uuid(locator)
            add(
                "insert into private_staging.claim_citations (claim_id, source_release_id, source_edition_id, locator, support_kind, digest) "
                f"select {claim_id(citation['claim_keys'][0])}, {esc(release)}::uuid, {edition_id}, {esc(locator)}, {esc(citation['stance'])}, {esc(sha256_text(locator))} "
                "where not exists (select 1 from private_staging.claim_citations c where "
                f"c.claim_id={claim_id(citation['claim_keys'][0])} and c.source_release_id={esc(release)}::uuid and c.locator={esc(locator)});"
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
                "insert into private_staging.reference_entity_attestations (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state, origin_package_id) values ("
                f"{ent(a['entity_key'])}, {scope_id(sc)}, {unit(f'{osis}.{ch}.{v}')}, {esc(a['kind'])}, {esc(a['textual_basis'])}, {cid}, 'draft', {manifest}) on conflict do nothing;"
            )
            # Every supporting claim is preserved, not only the first: the
            # single claim_id column keeps the first for back-compat, and the
            # link table holds the complete set.
            for claim_key in a["claim_keys"]:
                add(
                    "insert into private_staging.reference_entity_attestation_claims (attestation_id, claim_id) "
                    "select a.id, " + claim_id(claim_key) + " from private_staging.reference_entity_attestations a where "
                    f"a.entity_id={ent(a['entity_key'])} and a.scope_id={scope_id(sc)} "
                    f"and a.reference_unit_id={unit(f'{osis}.{ch}.{v}')} and a.kind={esc(a['kind'])} "
                    "on conflict do nothing;"
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
                "insert into private_staging.edition_mentions (edition_id, verse_id, entity_id, form, quote, occurrence_ordinal, pipeline_text_sha256, review_state, origin_package_id) "
                f"select {edition_id}, {verse_id(osis, ch, v)}, {ent(m['target']['key'])}, {esc(m['mention_form'])}, {esc(m['selector']['exact_quote'])}, {m['selector']['occurrence_ordinal']}, {esc(sha256_text(text))}, 'draft', {manifest} "
                "where not exists (select 1 from private_staging.edition_mentions em where "
                f"em.edition_id={edition_id} and em.verse_id={verse_id(osis, ch, v)} and em.entity_id={ent(m['target']['key'])} "
                f"and em.quote={esc(m['selector']['exact_quote'])} and em.occurrence_ordinal={m['selector']['occurrence_ordinal']});"
            )
            # Render span: the interactive anchor the app needs. Character
            # offsets are derived from the exact BSB verse text and the
            # selector, exactly as the Nehemiah 2 importer does; without this
            # the public bundle (which inner-joins edition_render_spans)
            # returned zero imported mention anchors.
            match = _locate_mention(text, m["selector"])
            if match is not None:
                start, end = match
                start_utf16 = len(text[:start].encode("utf-16-le")) // 2
                end_utf16 = len(text[:end].encode("utf-16-le")) // 2
                add(
                    "insert into private_staging.edition_render_spans (mention_id, start_grapheme, end_grapheme, start_utf16, end_utf16) "
                    f"select em.id, {start}, {end}, {start_utf16}, {end_utf16} "
                    "from private_staging.edition_mentions em where "
                    f"em.edition_id={edition_id} and em.verse_id={verse_id(osis, ch, v)} and em.entity_id={ent(m['target']['key'])} "
                    f"and em.quote={esc(m['selector']['exact_quote'])} and em.occurrence_ordinal={m['selector']['occurrence_ordinal']} "
                    "on conflict (mention_id) do nothing;"
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
                "insert into private_staging.scope_entity_relevance (scope_id, entity_id, role_in_passage, importance, is_attested, origin_package_id) values ("
                f"{scope_id(r['scope_key'])}, {ent(r['entity_key'])}, {esc(role)}, {esc(r['importance'])}, {str(r['is_attested']).lower()}, {manifest}) on conflict do nothing;"
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
            # Every applicable scope is materialised, not only the first, and
            # the package's certainty is written through instead of a hardcoded
            # "established". Each assertion is then linked to all its claims.
            certainty = rel.get("certainty", "unknown")
            for sc in rel["applicable_scope_keys"]:
                add(
                    "insert into private_staging.entity_relationship_assertions (subject_entity_id, predicate, object_entity_id, scope_id, certainty, origin_package_id) "
                    f"select {ent(rel['subject_entity_key'])}, {esc(rel['predicate_key'])}, {ent(rel['object_entity_key'])}, {scope_id(sc)}, {esc(certainty)}, {manifest} "
                    "where not exists (select 1 from private_staging.entity_relationship_assertions a where "
                    f"a.subject_entity_id={ent(rel['subject_entity_key'])} and a.predicate={esc(rel['predicate_key'])} "
                    f"and a.object_entity_id={ent(rel['object_entity_key'])} and a.scope_id={scope_id(sc)});"
                )
                for claim_key in rel.get("claim_keys", []):
                    add(
                        "insert into private_staging.entity_relationship_assertion_claims (assertion_id, claim_id) "
                        "select a.id, " + claim_id(claim_key) + " from private_staging.entity_relationship_assertions a where "
                        f"a.subject_entity_id={ent(rel['subject_entity_key'])} and a.predicate={esc(rel['predicate_key'])} "
                        f"and a.object_entity_id={ent(rel['object_entity_key'])} and a.scope_id={scope_id(sc)} "
                        "on conflict do nothing;"
                    )

    # --- events -----------------------------------------------------------
    for book in books:
        canonical = load_json(CURATED / "canonical" / f"{book['osis']}.v2.json")
        for ev in canonical["records"].get("events", []):
            ev_key = "entity:" + ev["event_key"].split("event:", 1)[1]
            add(
                "insert into private_staging.events (entity_id, event_kind, origin_package_id) values ("
                f"{ent(ev_key)}, {esc(ev['event_type'])}, {manifest}) on conflict (entity_id) do nothing;"
            )
            claim_keys = ev.get("claim_keys", [])
            first_claim = claim_id(claim_keys[0]) if claim_keys else "null"
            for p in ev["participant_entity_keys"]:
                add(
                    "insert into private_staging.event_participants (event_id, entity_id, role, claim_id, origin_package_id) values ("
                    f"{ent(ev_key)}, {ent(p)}, 'participant', {first_claim}, {manifest}) on conflict do nothing;"
                )
                for claim_key in claim_keys:
                    add(
                        "insert into private_staging.event_participant_claims (event_id, entity_id, role, claim_id) values ("
                        f"{ent(ev_key)}, {ent(p)}, 'participant', {claim_id(claim_key)}) on conflict do nothing;"
                    )
            for pl in ev["place_entity_keys"]:
                add(
                    "insert into private_staging.event_places (event_id, place_id, claim_id, origin_package_id) values ("
                    f"{ent(ev_key)}, {ent(pl)}, {first_claim}, {manifest}) on conflict do nothing;"
                )
                for claim_key in claim_keys:
                    add(
                        "insert into private_staging.event_place_claims (event_id, place_id, claim_id) values ("
                        f"{ent(ev_key)}, {ent(pl)}, {claim_id(claim_key)}) on conflict do nothing;"
                    )
            for account in ev["scripture_accounts"]:
                add(
                    "insert into private_staging.event_scripture_accounts (event_id, scope_id, relation, claim_id, origin_package_id) values ("
                    f"{ent(ev_key)}, {scope_id(account['scope_key'])}, {esc(account['relation'])}, {first_claim}, {manifest}) on conflict do nothing;"
                )
                for claim_key in claim_keys:
                    add(
                        "insert into private_staging.event_scripture_account_claims (event_id, scope_id, claim_id) values ("
                        f"{ent(ev_key)}, {scope_id(account['scope_key'])}, {claim_id(claim_key)}) on conflict do nothing;"
                    )

    # --- place geometries (home places) -----------------------------------
    for book in books:
        canonical = load_json(CURATED / "canonical" / f"{book['osis']}.v2.json")
        for place in canonical["records"].get("places", []):
            for pos in place["geographic_positions"]:
                # Precision, license and certainty come from the package
                # blueprint (which records them explicitly), never from a
                # hardcoded "unknown"/EPSG value here. A geometry is written
                # only when the package actually carries coordinates.
                crs = esc(pos["crs"]) if pos.get("crs") else "null"
                component_license = esc(pos.get("component_license") or "unknown")
                add(
                    "insert into private_staging.place_geometries (entity_id, crs, precision, evidence_claim_id, component_license, origin_package_id) values ("
                    f"{ent(place['entity_key'])}, {crs}, {esc(pos['precision'])}, null, {component_license}, {manifest}) on conflict (entity_id) do nothing;"
                )

    # --- passage contexts -------------------------------------------------
    for book in books:
        locale = load_json(CURATED / "locale" / f"{book['osis']}.v2.json")
        for ctx in locale["records"].get("passage_contexts", []):
            sid = scope_id(ctx["scope_key"])
            add(
                "insert into private_staging.context_artifacts (scope_id, origin_package_id) values ("
                f"{sid}, {manifest}) on conflict (scope_id) do nothing;"
            )
            artifact = f"(select id from private_staging.context_artifacts where scope_id={sid})"
            add(
                "insert into private_staging.context_revisions (artifact_id, revision) values ("
                f"{artifact}, 1) on conflict do nothing;"
            )
            revision = f"(select id from private_staging.context_revisions where artifact_id={artifact} and revision=1)"
            for kind, section in ctx["orientation"].items():
                text = section.get("text")
                qkey = section.get("open_question_key")
                if text:
                    state, stored_text, stored_q = "curated", text, "null"
                elif qkey:
                    # Not curated, and not silently absent: the blocking open
                    # question is preserved so the database can tell the two
                    # apart.
                    state, stored_text, stored_q = "open_question", "", esc(qkey)
                else:
                    continue
                keys = section.get("claim_keys", []) if text else []
                claim_select = (
                    "array[]::uuid[]"
                    if not keys
                    else "array[" + ",".join(claim_id(k) for k in keys) + "]::uuid[]"
                )
                add(
                    "insert into private_staging.context_sections (revision_id, kind, text, claim_ids, curation_state, open_question_key) "
                    f"select {revision}, {esc(kind)}, {esc(stored_text)}, {claim_select}, {esc(state)}, {stored_q} "
                    "where not exists (select 1 from private_staging.context_sections s where "
                    f"s.revision_id={revision} and s.kind={esc(kind)});"
                )

    # --- package membership (publication gating + resync ownership) ------
    # One membership row per entity, claim and context revision. Membership
    # is what the public publication gates read, and what lets a later
    # English refresh know which rows it owns (never another package's).
    member_values: list[tuple[str, str]] = []
    for e in registry["entities"]:
        member_values.append(("entity_id", ent(e["entity_key"])))
    for book in books:
        canonical = load_json(CURATED / "canonical" / f"{book['osis']}.v2.json")
        for ev in canonical["records"].get("events", []):
            slug = ev["event_key"].split("event:", 1)[1]
            member_values.append(("entity_id", ent(f"entity:{slug}")))
        for claim in canonical["records"].get("claims", []):
            member_values.append(("claim_id", claim_id(claim["claim_key"])))
    for book in books:
        locale = load_json(CURATED / "locale" / f"{book['osis']}.v2.json")
        for ctx in locale["records"].get("passage_contexts", []):
            artifact = f"(select id from private_staging.context_artifacts where scope_id={scope_id(ctx['scope_key'])})"
            revision = f"(select id from private_staging.context_revisions where artifact_id={artifact} and revision=1)"
            member_values.append(("context_revision_id", revision))
    for column, value in member_values:
        add(
            "insert into private_staging.package_members (package_id, " + column + ") "
            f"select {manifest}, {value} where not exists (select 1 from private_staging.package_members pm where "
            f"pm.package_id = {manifest} and pm.{column} = {value});"
        )

    # --- receipt ----------------------------------------------------------
    return "\n".join(stmts), {}


def payload_digest(books: list[dict], registry: dict) -> str:
    parts = [jcs([b["osis"] for b in books]), jcs(registry)]
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

    body, _ = build_sql(books, registry, digest.split(":", 1)[1])
    digest_hex = digest.split(":", 1)[1]
    manifest_key = f"en.bsb.all@{MANIFEST_REVISION}:sha-{digest_hex[:8]}"
    receipt = {
        "kind": "english-canon",
        "books": counts["books"],
        "entities": counts["registry_entities"],
        "attestations": counts["attestations"],
        "mentions": counts["mentions"],
        "payload_digest": digest,
        "manifest_key": manifest_key,
        "manifest_published": False,
        "review_status": "draft",
        "canon_order": [b["osis"] for b in books],
    }
    header = (
        f"insert into private_staging.curation_imports (package_key, package_revision, payload_digest, receipt) values ("
        f"{esc(IMPORT_PACKAGE_KEY)}, {IMPORT_REVISION}, {esc(digest)}, {jsonb(receipt)}) "
        "on conflict (package_key) do update set package_revision = excluded.package_revision, "
        "payload_digest = excluded.payload_digest, receipt = excluded.receipt, imported_at = now();\n"
    )
    # The same conflict guard the Python preflight applies is emitted inside
    # the transaction, so an --emit-sql replay (which cannot query first) still
    # fails closed on a conflicting or newer receipt instead of silently
    # overwriting it (finding 33). Applied in one transaction, so the guard and
    # the writes are atomic.
    guard = (
        "do $$\n"
        "declare cur_rev integer; cur_digest text;\n"
        "begin\n"
        "  select package_revision, payload_digest into cur_rev, cur_digest\n"
        "    from private_staging.curation_imports\n"
        f"    where package_key = {esc(IMPORT_PACKAGE_KEY)};\n"
        "  if cur_rev is not null then\n"
        f"    if cur_rev > {IMPORT_REVISION} or (cur_rev = {IMPORT_REVISION} and cur_digest <> {esc(digest)}) then\n"
        "      raise exception 'english-canon import guard: conflicting or newer receipt for % (stored rev %, digest %)', "
        f"{esc(IMPORT_PACKAGE_KEY)}, cur_rev, cur_digest;\n"
        "    end if;\n"
        "  end if;\n"
        "end $$;\n"
    )
    sql = guard + header + body

    if args.emit_sql:
        print(sql)
        return 0

    existing = psql(
        args.database_url,
        f"select payload_digest || '|' || package_revision from private_staging.curation_imports where package_key={esc(IMPORT_PACKAGE_KEY)}",
    )
    if existing:
        current = existing.splitlines()[0]
        stored_digest, _, stored_revision = current.partition("|")
        if current == f"{digest}|{IMPORT_REVISION}":
            print("replay: identical payload — no-op")
            return 0
        # A bumped revision authorizes a content migration over an older
        # receipt; anything else that changes under the same key fails closed.
        if int(stored_revision or 0) < IMPORT_REVISION:
            print(
                f"replay: stored revision {stored_revision} older than {IMPORT_REVISION} — migrating"
            )
        else:
            fail(
                f"replay: conflicting payload or newer receipt for {IMPORT_PACKAGE_KEY} (was {current})",
                3,
            )

    psql(args.database_url, sql, single_transaction=True)
    print(f"imported: {jcs(counts)} payload_digest={digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
