# Acquisition Request Packet — Task 09 (Gate C1)

**Status:** CANDIDATE — requires rights_reviewer + owner Gate C1 before any 09A-E fetch.
**Date:** 2026-09-14
**Scope:** Nehemiah 2 minimal slice only; not whole-Bible. No download, parse, AI, or import until Gate C1.

## Overview

Five isolated requests, one per `content/source-requests/*.json`. Each identifies immutable `commit/sha256`, trustworthy upstream checksum placeholder (`synthetic` until real fetch), expected `byteSize` (OPEN until measured), `licenseSpdx` + retained `LICENSE` digest, attribution, quarantine `content/quarantine/**` retention, `evaluation_import` only, `external_ai_processing` + `embedding` **denied**, explicit exclusions. Theographic / ACA / SemanticBible are **not** requested (share-alike / unclear license).

## Requests

| #   | File                                              | Source                        | Component                                                               | Paths/Fields                                                                                       | License               | Op                  |
| --- | ------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------- | ------------------- |
| 1   | `content/source-requests/stepbible-tvtms.json`    | `source:stepbible:tvtms`      | `tvtms-mappings`                                                        | `Data/TVTMS/TVTMS.tsv`                                                                             | CC-BY-4.0             | `evaluation_import` |
| 2   | `content/source-requests/stepbible-tipnr.json`    | `source:stepbible:tipnr`      | `tipnr-structured-fields`                                               | `Data/TIPNR/TIPNR.tsv:person,place,thing,originalName,familyRelation,reference` (6 fields)         | CC-BY-4.0             | `evaluation_import` |
| 3   | `content/source-requests/bibledata-people.json`   | `source:bibledata:structured` | `bibledata-people`, `bibledata-person-verse`, `bibledata-relationships` | `data/people.csv`, `data/person-verse.csv`, `data/relationships.csv`                               | CC-BY-4.0             | `evaluation_import` |
| 4   | `content/source-requests/macula-hebrew-neh2.json` | `source:macula:hebrew`        | `macula-hebrew-{tokens,morphology,participants}`                        | `hebrew/Tanach.tsv:token`, `Morphology.tsv:lemma/morph`, `Participants.tsv:referent/semantic_role` | CC-BY-4.0             | `evaluation_import` |
| 5   | `content/source-requests/openbible-geodata.json`  | `source:openbible:geocoding`  | `openbible-core-geocoding`                                              | `data/geocoding.jsonl:place/coordinates/confidence/verseReference`                                 | CC-BY-4.0 (core only) | `evaluation_import` |

## Exact isolation per source

- **TVTMS:** only `TVTMS.tsv`; excludes `TAHOT`/`TAGNT` and any embedded Scripture text.
- **TIPNR:** 6 structured fields only; excludes Claude-3 `brief/short/article descriptions` (not evidence), geodata, any Scripture/lexicon prose.
- **BibleData:** 3 CSVs for discrepancy analysis only; excludes `books/places/events/epochs/Strong’s/dictionary/polyglot/Ussher` (incomplete or separate rights).
- **MACULA:** 3 TSVs (tokens/morphology/participants) bounded to Neh.2; excludes BSB offsets, unapproved gloss/sense, word studies, `qere/ketiv` flattening, canonical identity.
- **OpenBible:** `geocoding.jsonl` core only; excludes `images/**`, `openstreetmap/**` (ODbL), KMZ/KML, site prose/ESV quotations, tiles.

## For every component

- `artifact.url` is exact file at immutable `commitOrTag` (no branch).
- `expectedSha256` / `byteSize` are synthetic placeholders (`a…`, 0) until Gate C1-authorized `09A-E` computes real `sha256` and `byteSize`.
- `licenseEvidence` retains `LICENSE` at same commit with digest; `requiredAttribution` reviewed.
- `external_ai_processing` and `embedding` default **denied**; `publication` not requested.
- `retentionPolicy: opaque-quarantine-only` — bytes in `content/quarantine/**` (git-ignored) until Gate C2 parsing authorization.

## What this packet does NOT authorize

No download, no parsing, no normalization, no AI, no canonical import, no share-alike. One Markdown `candidate` status never authorizes use — only `private_registry` `operation_grants.state=allowed` + valid `approval_records` digest-bound (`packages/content-schema/src/registry.ts:297` + `packages/registry-service/src/service.ts:1`) does.

## Gate C1 checklist (human)

For each of the 5 files, verify:

1. `commitOrTag` exists and is immutable (not `main`/`master`/`HEAD`).
2. `artifact.url` resolves to exact file at that commit.
3. `LICENSE` at same commit is CC-BY-4.0 (or as stated) and digest will be retained.
4. `pathsOrFields` are minimal and excludes are honored.
5. `external_ai_processing`/`embedding` remain `denied`.
6. No Theographic/ACA/SemanticBible is included.

On approval, the controller mints `gate-C1-v1-...` with `permitted_next_tasks: [09A]` etc., one acquisition at a time.

## Next

After Gate C1 PASSED, `09A` acquires `stepbible-tvtms` as opaque bytes (no parse), records `artifact_sha256`/`byteSize` receipt, stops.

## Verification

- `cat content/source-requests/*.json | jq .` — valid JSON
- `rg -n "external_ai_processing.*denied" content/source-requests/` — 5x
