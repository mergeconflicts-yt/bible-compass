# Canonical Identifiers — Documentation Contract

**Status:** APPROVED per Gate A1 `gate-A1-v1-20260914T115751Z` sha `4cc1b7dc810f` — replaces PROPOSED draft. No code change in this task; code implementation in Task 04 must conform to this contract without changing public route strings.
**Applies to:** All Postgres, SQLite, API, analytics, and deep-link identifiers. Routes `Neh.2` / `Neh.2.1-Neh.2.8` remain as presentation identifiers (see §9).
**Prerequisites:** `docs/OWNER_GATE_A1_PACKET.md:1` (pilot `Neh.2.1-20`, canon `prot-66`, refsys `eng-v22`/`tel-v1`/`tam-v1`, locales `en`/`te`/`ta`, translations `bsb@20260912` / `tel_irv@20260913` / `tam_irv@20260913`), `docs/adr/001-multilingual-content-model.md:1`, `CONTEXT_DATA_ARCHUTECTURE.md:91-162`.

---

## 1. Principles

* **No bare global verse identity.** `Neh.2.4` alone never resolves to a database row. Every persisted reference is the composite `(reference_system_key, local_reference_key)` per `CONTEXT_DATA_ARCHUTECTURE.md:110-113`.
* **Presentation vs. storage.** Public URL ` /passage/Neh.2.1-Neh.2.8` is a *presentation* identifier. The qualified envelope `{"refsys":"refsys:eng-v22","local":"Neh.2.1-Neh.2.8"}` is the *storage* identity.
* **Translation work ≠ edition.** `trans:bsb` (work) is stable; `edition:bsb@20260912:sha-b2898c` (immutable text) is distinct per `OWNER_GATE_A1_PACKET.md §2 D-TRANS/D-EDITION`.
* **Source ≠ release.** `source:stepbible:tipnr` (identity) never authorizes bytes; `release:stepbible:tipnr@<commit>:sha-<artifact>` does.
* **ASCII-stable, language-independent.** Canonical keys use lowercase ASCII, hyphen/colon/@/dot as typed separators; no localized names as keys.

---

## 2. Canon keys

* **Grammar:** `canon:prot-66` | `canon:prot-66:ext-...` (future)
* **Rule:** One canon for MVP: `canon:prot-66` (66 books `Gen-Rev`). Order via `canon_work_memberships`.
* **Example:** `canon:prot-66`
* **DB:** `canons.key` immutable.

## 3. Reference-system keys

* **Grammar:** `refsys:<lang>-<kind>-<version>` where `<lang>` is `eng`|`tel`|`tam`, `<kind>` is `v` (versification), `<version>` is integer.
* **Allowed for MVP:**
  * `refsys:eng-v22` — English versification backing BSB (WW: v22 maps to `bsb@20260912` text)
  * `refsys:tel-v1` — Telugu versification for `tel_irv@20260913`
  * `refsys:tam-v1` — Tamil versification for `tam_irv@20260913`
* **Rule:** Every `reference_unit` and `reference_mapping` row is keyed by `refsys`. Unknown `refsys` → fail-closed for publication/search.

## 4. Work keys

* **Grammar:** `work:<OSIS>-<canon>` e.g. `work:Neh:prot-66`, `work:Gen:prot-66`
* **Rule:** OSIS-style code from `tools/build-bsb-assets.py:12` `OSIS` table; not localized.
* **Example:** `work:Neh:prot-66` → display names `Nehemiah` (`en`), `నెహెమ్యా` (`te` via `entity_localizations` future).

## 5. Reference-unit & local-reference keys

* **Local key grammar (presentation, ASCII):**
  * Whole chapter: `Neh.2`
  * Verse: `Neh.2.4`
  * Verse range (same book): `Neh.2.1-Neh.2.8`
  * Non-contiguous (future): `Neh.2.1,Neh.2.3,Neh.2.7` — registered scope only, not ad-hoc
  * Pattern: `^([A-Za-z1-9]+)\.(\d+)(?:\.(\d+))?(?:-(?:[A-Za-z1-9]+)\.(\d+)\.(\d+))?$` with additional commas for non-contiguous (future)
* **Qualified key:** `(refsys, local)` → `refsys:eng-v22:Neh.2.4`
* **DB:** `reference_units.key` = `Neh.2.4`, `reference_units.refsys` = `refsys:eng-v22`, unique `(refsys, key)`, `ordinal` for ordering.

## 6. Scope keys (curated passages)

* **Grammar:** `scope:<slug>:<refsys>:<local>` e.g. `scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20`
* **Pilot:** `scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20` — the MVP curated passage for Neh.2 (Task 02/03). The historical public route `Neh.2.1-Neh.2.8` (Task 00 baseline) maps to this qualified scope for display, but storage uses `scope:neh-2:...`.
* **Rule:** Scopes are registered rows in `scripture_scopes`; arbitrary ranges are not scopes until registered.

## 7. Translation-work & translation-edition keys

* **Translation-work (stable):** `trans:<code>` e.g. `trans:bsb`, `trans:tel_irv`, `trans:tam_irv` — one per `translations` language `docs/DATA_MODEL.md:59`.
* **Translation-edition (immutable):** `edition:<trans>@<revision>:sha-<8>` e.g. `edition:bsb@20260912:sha-b2898c49`, `edition:tel_irv@20260913:sha-3857e102`, `edition:tam_irv@20260913:sha-08e71ec8`
* **Rule:** Edition distinct from work; correction → new edition, old edition and its `verse_anchors` preserved `docs/DATA_MODEL.md:198-200`. `edition_mentions` reference `edition:<...>` not `trans:<...>`.

## 8. Source & source-release keys

* **Source (identity):** `source:<publisher>:<dataset>` e.g. `source:stepbible:tipnr`, `source:stepbible:tvtms`, `source:bibledata:structured`, `source:macula:hebrew`, `source:openbible:geocoding`
* **Release (immutable bytes):** `release:<source>@<commit-or-tag>:sha-<artifact-sha256-8>` e.g. `release:stepbible:tipnr@a1b2c3d4:sha-9f3e...` — commit/tag + artifact `sha256` per `docs/OPEN_BIBLE_DATA_SOURCES.md:459-502`. Branch name **never** a release.
* **Rule:** Rights grants bind `release` + `component` + `operation`; `source` alone grants nothing.

## 9. Qualified resolution envelope & external namespace keys

* **Qualified envelope (DB/storage identifier, canonical JSON):**
  ```json
  {"canon":"canon:prot-66","refsys":"refsys:eng-v22","local":"Neh.2.4","work":"work:Neh:prot-66","scope":null}
  ```
  For passage: `{"refsys":"refsys:eng-v22","local":"Neh.2.1-Neh.2.8","scope":"scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20","refsysQualified":"refsys:eng-v22:Neh.2.1-Neh.2.8"}`
* **Candidate key (global stable, non-public):** `candidate:<kind>:<refsys>:<slug>` e.g. `candidate:person:refsys:eng-v22:artaxerxes-i` (future Task 10+).
* **External namespace (upstream, mapped):**
  * `tipnr:entity:<id>` (STEPBible TIPNR person)
  * `tvtms:map:<id>` (TVTMS versification)
  * `bibledata:person:<id>` (BibleData person)
  * `openbible:place:<id>` (OpenBible geocoding)
  * Never exposed as global identity; must map via `entity_identity_assertions` with `source:stepbible:tipnr` crosswalk.

## 10. Compatibility table — existing public routes remain unchanged

| Public presentation identifier (validated, not storage) | Qualified resolution (storage) | Notes |
|---|---|---|
| `Neh.2` | `refsys:eng-v22:Neh.2` → `scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20` (chapter overview) | Route `/(tabs)/bible` + `/passage/Neh.2` unchanged `apps/mobile/app/passage/[reference].tsx:1` |
| `Neh.2.4` | `refsys:eng-v22:Neh.2.4` | Single-verse verse anchor target `apps/mobile/src/lib/reference.ts:54` |
| `Neh.2.1-Neh.2.8` | `refsys:eng-v22:Neh.2.1-Neh.2.8` → maps to `scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20` (display still `Neh.2.1-Neh.2.8` for backward compat) | Preserve exact string; old links remain valid `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md:661-662` |
| `/passage/Neh.2.1-Neh.2.8` | qualifies as above | Typed route `expo-router` `apps/mobile/app.json:38` |
| `/daily/2026-09-14` | `locale:en` + `edition:bsb@20260912` + `scope:neh-2...` | Daily verse key is local date `docs/CANONICAL_IDENTIFIERS.md:148` |

Invalid input → safe `+not-found` / unsupported screen, never 500 — `apps/mobile/app/+not-found.tsx:1`.

## 11. Parser / validation examples — for Task 04 implementation

> Existing parser `apps/mobile/src/lib/reference.ts:88` accepts bare `Neh.2.4`; Task 04 must add `refsys` qualification while keeping public routes compatible. All examples below must be covered by static tests per plan `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md:680-682`.

### Invalid (must throw typed error, not guess)

| Input | Expected | Error code (Task 04 `ReferenceParseError`) |
|---|---|---|
| `""` / `"  "` | throw | `empty` |
| `"Nehemiah 2"` | throw | `format` (localized name not allowed) |
| `"Neh..2.4"` / `"Neh.2.4-"` / `"Neh.2.4-Neh.2.8-Neh.2.9"` | throw | `format` |
| `"Neh.2.8-Neh.2.1"` | throw | `reversed` |
| `"Gen.1.1-Exod.1.1"` (cross-book) | throw | `format` (unsupported cross-book range) |
| `"Neh.2.4 "` with `refsys:unknown` | throw | `unsupported-reference-system` (new) |
| `"Neh.2.4"` with `trans:bsb` but `refsys:tel-v1` | throw | `mismatched-refsys-edition` (new) |

### Split (one source verse → two target verses)

* TVTMS: `refsys:eng-v22:Neh.2.4` (BSB) `equivalent` → `refsys:tel-v1:Neh.2.4` **split** into `refsys:tel-v1:Neh.2.4a` + `Neh.2.4b` (future Telugu versification evidence).
* Parser must preserve `mapping_kind: split` in `reference_mappings`, not silently drop second unit. Input `Neh.2.4` with `refsys:eng-v22` resolves to two Telugu units via mapping table; without mapping → `unmapped` error, not guess.

### Merge (two source verses → one target verse)

* `refsys:eng-v22:Neh.2.3` + `Neh.2.4` `merge` → `refsys:tam-v1:Neh.2.3` (combined). Query for `Neh.2.4` in `refsys:tam-v1` must return `omitted` or `merged_into: Neh.2.3`.

### Reordered (same content, different order)

* `refsys:eng-v22:Ps.10.5` renumbered → `refsys:tel-v1:Ps.10.4` with `mapping_kind: renumbered`. Ordinal ordering via `reference_units.ordinal` must be used, not lexical chapter/verse compare `apps/mobile/src/lib/reference.ts:81`.

### Ambiguous (multiple plausible resolutions)

* Input `Neh.2` with `refsys:eng-v22` is ambiguous between `chapter overview` vs `scope:neh-2` passage. Parser must return `disambiguation_required` and require explicit `scope` or default to `scope:neh-2:...` per product rule, not auto-pick. If `pericope` param missing → throw `ambiguous-scope`.

### Unicode / ASCII (where ASCII is required)

* `canon:prot-66` must be ASCII lowercase/ hyphen; `Neh.2.4` book code `Neh` ASCII. Reject `נח.2.4` or `Neh．2．4` (fullwidth dot) with `format` error. `entity slug` `artaxerxes-i` ASCII only `docs/CANONICAL_IDENTIFIERS.md:88`.

## 12. Typed-error taxonomy — to be implemented in Task 04 (`apps/mobile/src/lib/reference.ts:10`)

| Code | When | HTTP/UI |
|---|---|---|
| `empty` | blank input | show hint `Enter a reference like Neh.2.4.` |
| `format` | regex fail / unsupported pattern | show `not a reference` message |
| `reversed` | end before start | show `ends before it starts` |
| `unsupported-book` | `book` not in `BOOKS` registry | show `not available in this build` |
| `unsupported-reference-system` | `refsys` not in `reference_systems` | deny publication/search (fail-closed) |
| `mismatched-refsys-edition` | `edition` refsys ≠ `refsys` | deny `display_allowed` per `docs/CONTENT_RIGHTS.md:78` |
| `unmapped` | no `reference_mapping` for split/merge target | show `reference not mapped in this versification` |
| `ambiguous-scope` | chapter vs passage ambiguous | require explicit scope |
| `invalid-unicode` | non-ASCII where ASCII required | show `use English book codes` |

Task 04 must add property-style boundary tests for each rejection category `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md:785`.

---

## 13. Migration & compatibility notes

* Existing SQLite `content_installations` and `sync_cursors` remain valid; new columns are `refsysQualified` composite, not a migration that rewrites `Neh.2.4` bare keys.
* Analytics must switch from bare `Neh.2.4` to `refsys:eng-v22:Neh.2.4` as canonical key per `docs/ARCHITECTURE.md:119`.
* No DB writes in this task — Task 04 will implement `reference_systems`, `reference_units`, `reference_mappings` schemas; Task 17 will migrate.
