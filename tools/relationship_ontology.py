#!/usr/bin/env python3
"""Controlled relationship-predicate ontology (single source of truth).

The predicate vocabulary is a closed ontology, not free text. Source
relationship types are mapped onto ontology keys; anything unmapped (including
titles and abuse actions) is dropped and reported. The importer and validators
enforce the ontology, so a package can never introduce a new predicate by
being imported. Adding a predicate requires editing this ontology after review.

The committed JSON is mirrored by TypeScript validators/tests so generators,
importers and readers agree.
"""

from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ONTOLOGY_PATH = REPO / "content" / "curation" / "relationship-ontology.json"


def load() -> dict:
    return json.loads(ONTOLOGY_PATH.read_text(encoding="utf-8"))


_ONTOLOGY = load()

#: Every allowed predicate key (e.g. "relationship:son").
ALLOWED: frozenset[str] = frozenset(_ONTOLOGY["mapping"].values())

#: Source relationship type -> ontology predicate key.
MAPPING: dict[str, str] = dict(_ONTOLOGY["mapping"])

#: Explicitly rejected source types with their rationale.
DROPPED: dict[str, str] = dict(_ONTOLOGY["dropped"])


def map_predicate(source_type: str) -> str | None:
    """Map a source relationship type to an ontology predicate, or None.

    Unknown or explicitly dropped types return None: the caller drops the
    relationship and records it, never inventing a predicate.
    """
    return MAPPING.get((source_type or "").strip())


def is_allowed(predicate_key: str) -> bool:
    return predicate_key in ALLOWED
