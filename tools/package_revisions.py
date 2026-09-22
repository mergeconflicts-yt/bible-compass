#!/usr/bin/env python3
"""Deterministic package content digests and monotonic package revisions.

A package's `content_digest` covers everything a consumer would observe except
the revision-bearing envelope fields (package_revision / attempt /
submission_id / produced_for_job_id / content_digest itself), so it changes if
and only if the content changes. `package_revision` is a monotonic counter per
package stem, held in a committed register and incremented only when the digest
changes. Together they let immutable consumers detect AND order upgrades, which
revision-1-forever packages could not (finding 16).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

_VOLATILE = (
    "content_digest",
    "package_revision",
    "attempt",
    "submission_id",
    "produced_for_job_id",
)


def content_digest(pkg: dict) -> str:
    clone = {k: v for k, v in pkg.items() if k not in _VOLATILE}
    text = json.dumps(clone, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_register(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_register(path: Path, register: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(register, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def stamp(pkg: dict, stem: str, register: dict) -> tuple[str, int]:
    """Set content_digest + package_revision/attempt/submission on `pkg`.

    Mutates `pkg` and `register`; returns (digest, revision).
    """
    digest = content_digest(pkg)
    prev = register.get(stem)
    if prev is not None and prev.get("digest") == digest:
        revision = int(prev["revision"])
    else:
        revision = int(prev["revision"]) + 1 if prev is not None else 1
    register[stem] = {"digest": digest, "revision": revision}
    pkg["package_revision"] = revision
    pkg["content_digest"] = digest
    pkg["attempt"] = revision
    pkg["submission_id"] = f"submission:{stem}:attempt-{revision}"
    return digest, revision
