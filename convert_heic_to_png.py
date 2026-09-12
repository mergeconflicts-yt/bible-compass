#!/usr/bin/env python3
"""Convert HEIC/HEIF files to PNG.

Usage:
    python convert_heic_to_png.py input_path [-o output_dir] [-r] [--overwrite]

    input_path: a single .heic/.heif file or a directory containing such files.
    -o / --output: output file or directory. Defaults to same directory as input
                   with a .png extension.
    -r / --recursive: recurse into subdirectories when input is a directory.
    --overwrite: overwrite existing PNGs. By default existing files are skipped.

Requires:
    pip install pillow pillow-heif
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SUPPORTED_SUFFIXES = {".heic", ".heif"}


def _ensure_deps():
    try:
        from pillow_heif import register_heif_opener  # type: ignore
        from PIL import Image  # type: ignore
    except ImportError:
        print(
            "Missing dependencies. Install with:\n"
            '  pip install pillow pillow-heif',
            file=sys.stderr,
        )
        raise SystemExit(2)
    register_heif_opener()
    return Image


def convert_file(src: Path, dst: Path, overwrite: bool = False) -> bool:
    """Convert one file. Returns True if written, False if skipped."""
    Image = _ensure_deps()

    if dst.exists() and not overwrite:
        print(f"SKIP (exists, use --overwrite): {dst}")
        return False

    with Image.open(src) as im:
        dst.parent.mkdir(parents=True, exist_ok=True)
        # Handle multi-frame HEIC (bursts / sequences): save first frame.
        # Pillow-heif exposes n_frames; seek(0) is default, so just save.
        im.save(dst, format="PNG", optimize=True)

    print(f"OK: {src} -> {dst}")
    return True


def collect_inputs(input_path: Path, recursive: bool) -> list[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise SystemExit(f"Input not found: {input_path}")
    pattern = "**/*" if recursive else "*"
    return sorted(
        p
        for p in input_path.glob(pattern)
        if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES
    )


def resolve_output(src: Path, input_root: Path, output: Path | None) -> Path:
    if output is None:
        return src.with_suffix(".png")
    if input_root.is_file():
        # Output is either an explicit file or a directory.
        if output.suffix.lower() == ".png":
            return output
        return output / (src.stem + ".png")
    # Input is a directory: mirror relative structure.
    try:
        rel = src.relative_to(input_root)
    except ValueError:
        rel = Path(src.name)
    return output / rel.with_suffix(".png")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert HEIC/HEIF files to PNG.")
    parser.add_argument("input", type=Path, help="Input .heic/.heif file or directory")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output PNG file or directory (default: alongside input)",
    )
    parser.add_argument(
        "-r",
        "--recursive",
        action="store_true",
        help="Recurse into subdirectories when input is a directory",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing PNG files",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    src_root: Path = args.input

    if src_root.is_file() and src_root.suffix.lower() not in SUPPORTED_SUFFIXES:
        print(f"Input file is not .heic/.heif: {src_root}", file=sys.stderr)
        return 2

    files = collect_inputs(src_root, args.recursive)
    if not files:
        print(f"No HEIC/HEIF files found in: {src_root}")
        return 1

    failures = 0
    converted = 0
    for src in files:
        try:
            dst = resolve_output(src, src_root, args.output)
            if convert_file(src, dst, args.overwrite):
                converted += 1
        except Exception as exc:  # keep going on batch conversions
            print(f"FAIL: {src}: {exc}", file=sys.stderr)
            failures += 1

    print(f"\nDone: {converted} converted, {failures} failed, {len(files)} total.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
