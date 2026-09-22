#!/usr/bin/env python3
"""Authoritative Protestant canon order and testament assignment.

Parsed from the committed, generated canon skeleton
(apps/mobile/src/content/books.ts) so the queue and the importer can never
drift from the ratified order. Alphabetical file order is NOT canon order:
sorting assets by filename previously made Acts "OT" and Nehemiah "NT".
"""

from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BOOKS_TS = REPO / "apps" / "mobile" / "src" / "content" / "books.ts"

_ENTRY = re.compile(
    r"osis:\s*'(?P<osis>[A-Za-z1-9]+)'.*?testament:\s*'(?P<testament>OT|NT)'"
)


def _parse() -> list[tuple[str, str]]:
    text = BOOKS_TS.read_text(encoding="utf-8")
    entries = _ENTRY.findall(text)
    if len(entries) != 66:
        raise SystemExit(
            f"canon_order: expected 66 books in {BOOKS_TS}, found {len(entries)}"
        )
    return entries


_ENTRIES = _parse()
CANON_ORDER: list[str] = [osis for osis, _ in _ENTRIES]
TESTAMENT_BY_OSIS: dict[str, str] = {osis: t for osis, t in _ENTRIES}


def order_index(osis: str) -> int:
    return CANON_ORDER.index(osis) + 1


def ordered(books: list[dict]) -> list[dict]:
    """Sort book dicts into canonical order (raises on an unknown OSIS)."""
    return sorted(books, key=lambda b: order_index(b["osis"]))
