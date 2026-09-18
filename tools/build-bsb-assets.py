#!/usr/bin/env python3
"""Build bundled Scripture assets from the local bsb/ dataset.

Reads bsb/api/<dataset> (never committed, see .gitignore) and writes:
  apps/mobile/assets/scripture/<asset dir>/<OSIS>.json  one compact file per book
  apps/mobile/src/content/books.ts                      book registry (names, chapters)

Only verse/heading text is kept; footnote markers and line breaks collapse
to a single space. English (BSB) is the registry source; every other
translation must carry the same 66 books and chapter counts. Run from the
repo root:
  python3 tools/build-bsb-assets.py
Normalize the generated books*.ts with prettier before committing (the
generator emits overlong lines that prettier expands).
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS = os.path.join(ROOT, "bsb", "api")
SCRIPTURE = os.path.join(ROOT, "apps", "mobile", "assets", "scripture")
BOOKS_TS = os.path.join(ROOT, "apps", "mobile", "src", "content", "books.ts")

# Dataset id -> bundled asset directory. BSB doubles as the registry source.
TRANSLATIONS = (
    ("BSB", "bsb"),
    ("tam_irv", "tam_irv"),
    ("tel_irv", "tel_irv"),
)

# BSB dataset id -> OSIS-style code used in canonical keys.
OSIS = {
    "GEN": "Gen", "EXO": "Exod", "LEV": "Lev", "NUM": "Num", "DEU": "Deut",
    "JOS": "Josh", "JDG": "Judg", "RUT": "Ruth", "1SA": "1Sam", "2SA": "2Sam",
    "1KI": "1Kgs", "2KI": "2Kgs", "1CH": "1Chr", "2CH": "2Chr", "EZR": "Ezra",
    "NEH": "Neh", "EST": "Esth", "JOB": "Job", "PSA": "Ps", "PRO": "Prov",
    "ECC": "Eccl", "SNG": "Song", "ISA": "Isa", "JER": "Jer", "LAM": "Lam",
    "EZK": "Ezek", "DAN": "Dan", "HOS": "Hos", "JOL": "Joel", "AMO": "Amos",
    "OBA": "Obad", "JON": "Jon", "MIC": "Mic", "NAM": "Nah", "HAB": "Hab",
    "ZEP": "Zeph", "HAG": "Hag", "ZEC": "Zech", "MAL": "Mal",
    "MAT": "Matt", "MRK": "Mark", "LUK": "Luke", "JHN": "John", "ACT": "Acts",
    "ROM": "Rom", "1CO": "1Cor", "2CO": "2Cor", "GAL": "Gal", "EPH": "Eph",
    "PHP": "Phil", "COL": "Col", "1TH": "1Thess", "2TH": "2Thess", "1TI": "1Tim",
    "2TI": "2Tim", "TIT": "Titus", "PHM": "Phlm", "HEB": "Heb", "JAS": "Jas",
    "1PE": "1Pet", "2PE": "2Pet", "1JN": "1John", "2JN": "2John", "3JN": "3John",
    "JUD": "Jude", "REV": "Rev",
}


def plain_text(items):
    parts = []
    for it in items:
        if isinstance(it, str):
            parts.append(it)
        elif isinstance(it, dict):
            # Poetry lines and descriptive spans carry their words under
            # "text" — extracting it (finding 1: 21k+ verses were lost by
            # dropping these objects). Footnote markers (noteId) and other
            # metadata carry no words and are dropped. Every structured
            # item is a span boundary, so a separating space follows it;
            # the collapse below keeps spacing exact.
            text = it.get("text")
            parts.append(text if isinstance(text, str) else " ")
            parts.append(" ")
        else:
            parts.append(" ")
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def build_translation(dataset_id, asset_dir):
    src = os.path.join(DATASETS, dataset_id)
    assets = os.path.join(SCRIPTURE, asset_dir)
    with open(os.path.join(src, "books.json"), encoding="utf-8") as fh:
        catalog = json.load(fh)
    os.makedirs(assets, exist_ok=True)
    registry = []
    total_bytes = 0
    for entry in catalog["books"]:
        src_id = entry["id"]
        osis = OSIS[src_id]
        name = entry.get("commonName") or entry["name"]
        order = entry["order"]
        testament = "OT" if order <= 39 else "NT"
        chapters = []
        for num in range(1, entry["numberOfChapters"] + 1):
            with open(os.path.join(src, src_id, f"{num}.json"), encoding="utf-8") as fh:
                chapter = json.load(fh)["chapter"]
            blocks = []
            for block in chapter["content"]:
                kind = block.get("type")
                if kind == "heading":
                    blocks.append({"t": "h", "text": plain_text(block["content"])})
                elif kind == "verse":
                    blocks.append(
                        {"t": "v", "n": block["number"], "text": plain_text(block["content"])}
                    )
            chapters.append({"n": num, "blocks": blocks})
        payload = {"osis": osis, "bsb": src_id, "name": name, "chapters": chapters}
        path = os.path.join(assets, f"{osis}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        total_bytes += os.path.getsize(path)
        registry.append(
            {"osis": osis, "bsb": src_id, "name": name,
             "chapters": entry["numberOfChapters"], "testament": testament}
        )
    return registry, total_bytes


def text_gaps(dataset_id):
    """Bundled blocks with no surviving text (verses and headings). Any hit
    means the extractor dropped structured content again — fail the build
    instead of shipping silent gaps (finding 1). Returns labels."""
    asset_dir = dict(TRANSLATIONS)[dataset_id]
    assets = os.path.join(SCRIPTURE, asset_dir)
    gaps = []
    for name in sorted(os.listdir(assets)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(assets, name), encoding="utf-8") as fh:
            book = json.load(fh)
        for chapter in book["chapters"]:
            for block in chapter["blocks"]:
                if block.get("t") in ("v", "h") and not (block.get("text") or "").strip():
                    gaps.append(
                        f"{dataset_id} {book['osis']} {chapter['n']}:{block.get('n', 'h')}"
                    )
    return gaps


def main():
    reference = None
    books_registry = []
    registries = {}
    failures = []
    for dataset_id, asset_dir in TRANSLATIONS:
        registry, total_bytes = build_translation(dataset_id, asset_dir)
        print(f"{dataset_id}: books: {len(registry)}, asset bytes: {total_bytes}")
        registries[dataset_id] = registry
        if reference is None:
            reference = [(item["osis"], item["chapters"]) for item in registry]
            books_registry = registry
        else:
            assert [(item["osis"], item["chapters"]) for item in registry] == reference, (
                f"{dataset_id} canon differs from BSB"
            )
        failures.extend(text_gaps(dataset_id))
    if failures:
        for item in failures[:20]:
            print(f"TEXT GAP: {item}")
        raise SystemExit(f"refusing output with {len(failures)} text gaps (finding 1)")
    print("text check: no empty verses or headings in any bundled translation")
    registry = books_registry
    lines = [
        "/** Generated by tools/build-bsb-assets.py — do not hand-edit. */",
        "export interface BookEntry {",
        "  osis: string;",
        "  bsb: string;",
        "  name: string;",
        "  chapters: number;",
        "  testament: 'OT' | 'NT';",
        "}",
        "",
        "export const BOOKS: BookEntry[] = [",
    ]
    for item in registry:
        lines.append(
            f"  {{ osis: '{item['osis']}', bsb: '{item['bsb']}', "
            f"name: '{item['name']}', chapters: {item['chapters']}, "
            f"testament: '{item['testament']}' }},"
        )
    lines += [
        "];",
        "",
        "const byOsis = new Map(BOOKS.map((book) => [book.osis, book]));",
        "",
        "export function bookByOsis(osis: string): BookEntry | null {",
        "  return byOsis.get(osis) ?? null;",
        "}",
        "",
        "export function booksByTestament(testament: 'OT' | 'NT'): BookEntry[] {",
        "  return BOOKS.filter((book) => book.testament === testament);",
        "}",
        "",
    ]
    os.makedirs(os.path.dirname(BOOKS_TS), exist_ok=True)
    with open(BOOKS_TS, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print(f"books: {len(registry)}, asset bytes: {total_bytes}")
    for dataset_id, const_name, filename in (
        ("tam_irv", "BOOKS_TA", "books_ta.ts"),
        ("tel_irv", "BOOKS_TE", "books_te.ts"),
    ):
        localized = [
            "/** Generated by tools/build-bsb-assets.py — do not hand-edit. */",
            "import type { BookEntry } from './books';",
            "",
            f"export const {const_name}: BookEntry[] = [",
        ]
        for item in registries[dataset_id]:
            name = item["name"].replace("'", "\\'")
            localized.append(
                f"  {{ osis: '{item['osis']}', bsb: '{item['bsb']}', "
                f"name: '{name}', chapters: {item['chapters']}, "
                f"testament: '{item['testament']}' }},"
            )
        localized += ["];", ""]
        with open(os.path.join(os.path.dirname(BOOKS_TS), filename), "w", encoding="utf-8") as fh:
            fh.write("\n".join(localized))
        print(f"{filename}: {len(registries[dataset_id])} books")


if __name__ == "__main__":
    main()
