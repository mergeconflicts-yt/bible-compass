#!/usr/bin/env python3
"""Build bundled Scripture assets from the local bsb/ dataset.

Reads bsb/api/<dataset> (never committed, see .gitignore) and writes:
  apps/mobile/assets/scripture/<asset dir>/<OSIS>.json  one compact file per book
  apps/mobile/src/content/books.ts                      book registry (names, chapters)

Atomic output (finding-1 follow-up): every translation builds into a
staging directory first; the staged trees are validated (canon parity,
no blank verses/headings) and only then swapped into the committed
asset directories with atomic renames. A failed build exits with the
committed output exactly as it was — never partially replaced.

Only verse/heading text is kept; footnote markers and line breaks collapse
to a single space. English (BSB) is the registry source; every other
translation must carry the same 66 books and chapter counts. Run from the
repo root:
  python3 tools/build-bsb-assets.py
Registry rows render prettier-stable by construction, so byte-identical
rebuilds stay byte-identical with no normalize step.
"""
import hashlib
import json
import os
import re
import shutil
import tempfile

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


def build_translation(dataset_id, asset_dir, out_root):
    """Build one translation's per-book files under out_root/asset_dir.
    out_root is a staging directory during the build; nothing under the
    committed asset tree is touched until validation passes and main()
    swaps the staged tree into place (finding-1 follow-up)."""
    src = os.path.join(DATASETS, dataset_id)
    assets = os.path.join(out_root, asset_dir)
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


def text_gaps(dataset_id, out_root):
    """Staged blocks with no surviving text (verses and headings). Any hit
    means the extractor dropped structured content again — fail the build
    instead of shipping silent gaps (finding 1). Returns labels."""
    asset_dir = dict(TRANSLATIONS)[dataset_id]
    assets = os.path.join(out_root, asset_dir)
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


def write_text_atomic(path, content):
    """Write a generated file atomically: readers never see a torn file."""
    tmp = f"{path}.tmp-{os.getpid()}"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(content)
    os.replace(tmp, path)


def clear_stale_workdirs():
    """Remove staging leftovers from a killed run. Never touches a .prev
    backup — recovery decides its fate before anything else runs."""
    if not os.path.isdir(SCRIPTURE):
        return
    for name in os.listdir(SCRIPTURE):
        if name.startswith(".staging-"):
            shutil.rmtree(os.path.join(SCRIPTURE, name), ignore_errors=True)


def recover_package():
    """Restore the last good asset tree when a previous run died mid-swap
    (live tree parked at scripture.prev, live path missing), and drop a
    stale backup when the live tree is healthy. Runs before anything else
    touches the committed tree."""
    prev = SCRIPTURE + ".prev"
    if not os.path.isdir(SCRIPTURE) and os.path.isdir(prev):
        print("recovered scripture tree from an interrupted swap")
        os.replace(prev, SCRIPTURE)
    elif os.path.isdir(SCRIPTURE):
        shutil.rmtree(prev, ignore_errors=True)
    clear_stale_workdirs()


def swap_package(staging):
    """Activate the staged package with one parent-directory exchange: the
    live scripture tree is parked at .prev, then the staged tree (all
    three translations plus the manifest) takes its place. Both renames
    are atomic on the same filesystem; a crash between them is repaired
    by recover_package on the next run. No validation or fallible work
    happens between the renames."""
    prev = SCRIPTURE + ".prev"
    name = os.path.basename(staging)
    if not os.path.isdir(SCRIPTURE):
        raise SystemExit("scripture tree missing and no backup — refusing to publish")
    shutil.rmtree(prev, ignore_errors=True)
    os.replace(SCRIPTURE, prev)
    try:
        os.replace(os.path.join(prev, name), SCRIPTURE)
    except Exception:
        os.replace(prev, SCRIPTURE)
        raise
    shutil.rmtree(prev, ignore_errors=True)


def sha256_bytes(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def sha256_file(path):
    with open(path, "rb") as fh:
        return sha256_bytes(fh.read())


def build_manifest(staging, registry_texts):
    """Content-derived manifest for the staged package: per-book digests,
    counts, registry digests, and a version that IS the digest of that
    core — identical rebuilds yield identical versions, so the release is
    idempotent and the committed tree is verifiable without trust."""
    translations = {}
    for _, asset_dir in TRANSLATIONS:
        files = {}
        verses = 0
        total_bytes = 0
        for name in sorted(os.listdir(os.path.join(staging, asset_dir))):
            if not name.endswith(".json"):
                continue
            path = os.path.join(staging, asset_dir, name)
            with open(path, encoding="utf-8") as fh:
                book = json.load(fh)
            for chapter in book["chapters"]:
                verses += sum(1 for block in chapter["blocks"] if block.get("t") == "v")
            files[name] = sha256_file(path)
            total_bytes += os.path.getsize(path)
        translations[asset_dir] = {
            "books": len(files),
            "bytes": total_bytes,
            "files": files,
            "verses": verses,
        }
    core = {
        "registries": {
            name: sha256_bytes(content.encode("utf-8")) for name, content in registry_texts.items()
        },
        "translations": translations,
    }
    version = sha256_bytes(
        json.dumps(core, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )
    return {
        "built_by": "tools/build-bsb-assets.py",
        "manifest_version": 1,
        "package": "scripture-assets",
        "registries": core["registries"],
        "translations": core["translations"],
        "version": version,
    }


def render_entry(osis, bsb, name, chapters, testament):
    """One registry row in prettier-stable form: single line up to the
    print width (100, see apps/mobile/.prettierrc), otherwise the exact
    multi-line expansion prettier produces — so generated output is
    already formatted and byte-identical rebuilds stay byte-identical
    (no normalize step)."""
    single = (
        f"  {{ osis: '{osis}', bsb: '{bsb}', "
        f"name: '{name}', chapters: {chapters}, "
        f"testament: '{testament}' }},"
    )
    if len(single) <= 100:
        return single
    return "\n".join(
        [
            "  {",
            f"    osis: '{osis}',",
            f"    bsb: '{bsb}',",
            f"    name: '{name}',",
            f"    chapters: {chapters},",
            f"    testament: '{testament}',",
            "  },",
        ]
    )


def render_books_ts(registry):
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
            render_entry(item["osis"], item["bsb"], item["name"], item["chapters"], item["testament"])
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
    return "\n".join(lines)


def render_localized_ts(const_name, items):
    localized = [
        "/** Generated by tools/build-bsb-assets.py — do not hand-edit. */",
        "import type { BookEntry } from './books';",
        "",
        f"export const {const_name}: BookEntry[] = [",
    ]
    for item in items:
        name = item["name"].replace("'", "\\'")
        localized.append(
            render_entry(item["osis"], item["bsb"], name, item["chapters"], item["testament"])
        )
    localized += ["];", ""]
    return "\n".join(localized)


def write_registry(path, content):
    """Write a generated registry only when its bytes actually changed.
    Unchanged registries keep their committed bytes, so routine rebuilds
    narrow the release to the single parent-directory swap."""
    try:
        with open(path, encoding="utf-8") as fh:
            if fh.read() == content:
                print(f"unchanged: {os.path.basename(path)}")
                return
    except FileNotFoundError:
        pass
    write_text_atomic(path, content)
    print(f"updated: {os.path.basename(path)}")


def main():
    reference = None
    books_registry = []
    registries = {}
    failures = []
    recover_package()
    staging = tempfile.mkdtemp(prefix=".staging-", dir=SCRIPTURE)
    try:
        for dataset_id, asset_dir in TRANSLATIONS:
            registry, total_bytes = build_translation(dataset_id, asset_dir, staging)
            print(f"{dataset_id}: books: {len(registry)}, asset bytes: {total_bytes}")
            registries[dataset_id] = registry
            if reference is None:
                reference = [(item["osis"], item["chapters"]) for item in registry]
                books_registry = registry
            else:
                assert [(item["osis"], item["chapters"]) for item in registry] == reference, (
                    f"{dataset_id} canon differs from BSB"
                )
            failures.extend(text_gaps(dataset_id, staging))
        if failures:
            for item in failures[:20]:
                print(f"TEXT GAP: {item}")
            raise SystemExit(f"refusing output with {len(failures)} text gaps (finding 1)")
        print("text check: no empty verses or headings in any staged translation")
        registry_texts = {
            "books.ts": render_books_ts(books_registry),
            "books_ta.ts": render_localized_ts("BOOKS_TA", registries["tam_irv"]),
            "books_te.ts": render_localized_ts("BOOKS_TE", registries["tel_irv"]),
        }
        os.makedirs(os.path.dirname(BOOKS_TS), exist_ok=True)
        for filename, content in registry_texts.items():
            write_registry(os.path.join(os.path.dirname(BOOKS_TS), filename), content)
        manifest = build_manifest(staging, registry_texts)
        with open(os.path.join(staging, "manifest.json"), "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, ensure_ascii=False, indent=2, sort_keys=True)
            fh.write("\n")
        print(f"package {manifest['version']}: 3 translations, 3 registries, manifest")
        swap_package(staging)
    finally:
        shutil.rmtree(staging, ignore_errors=True)
    print(f"books: {len(books_registry)}")


if __name__ == "__main__":
    main()
