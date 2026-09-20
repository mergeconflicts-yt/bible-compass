#!/usr/bin/env python3
"""Sync the Nehemiah 2 context draft into the mobile app bundle.

Source of truth: content/nehemiah-2/legacy/context-draft.json (AI draft, UNREVIEWED).
(The legacy single-file draft is kept under legacy/ so glob-based importers of the
CUR-01 *.v2.json packages beside it cannot pick it up by mistake.)
Output: apps/mobile/assets/content/nehemiah-2.draft.json (verbatim copy).

The app renders this only behind explicit DRAFT labeling — see
src/content/neh2Draft.ts. Reviewer approval never happens here.
Run from the repo root:
  python3 tools/sync-context-draft.py
"""
import hashlib
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "content", "nehemiah-2", "legacy", "context-draft.json")
DST = os.path.join(ROOT, "apps", "mobile", "assets", "content", "nehemiah-2.draft.json")


def main():
    with open(SRC, encoding="utf-8") as fh:
        draft = json.load(fh)
    assert draft.get("review_status") == "draft", "refusing to sync non-draft content as draft"
    required = ("who", "where", "when", "what", "before", "stakes", "entities",
                "passage_entities", "timeline", "sources")
    missing = [key for key in required if key not in draft]
    assert not missing, f"draft missing required keys: {missing}"
    slugs = {entity["slug"] for entity in draft["entities"]}
    orphans = [role["entity_id"] for role in draft["passage_entities"]
               if role["entity_id"] not in slugs]
    assert not orphans, f"roles without entities: {orphans}"
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    with open(DST, "w", encoding="utf-8") as fh:
        json.dump(draft, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    with open(SRC, "rb") as fh:
        digest = hashlib.sha256(fh.read()).hexdigest()[:12]
    print(f"synced {len(draft['entities'])} entities, "
          f"{len(draft['timeline'])} events (src sha {digest})")


if __name__ == "__main__":
    main()
