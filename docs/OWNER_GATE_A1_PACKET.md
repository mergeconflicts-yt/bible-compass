# Owner Gate A1 — Decision Packet

**Packet version:** 1.0.0  
**Date:** 2026-09-14  
**Status:** DRAFT FOR OWNER REVIEW — no approval inferred  
**Source plan:** `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md:592-645` Task 01, `plan_version: 12`  
**Prerequisite handoff:** `docs/handoffs/task-00-baseline.json` sha `d6769c963d8e`  
**Envelope:** `envelope-01-20260914T112436Z` sha `33da12c04eddde7a22d54dd2271ec65d61b45a2a45fcd24360c297446d897da1`  
**Attempt:** `task:owner-decision:01:attempt-1`

> This packet prepares every owner answer required before executable schema (Tasks 02-04) and source evaluation (Tasks 07-09F). It makes recommendations and states evidence; it does **not** change `OPEN`→`DECIDED` in governing docs. Only an authenticated Gate A1 receipt signed by the named owner/reviewers may authorize the next task. Fail-closed: unknown = denied.

---

## 1. Pilot reading & context ranges — explicit

| Scope | Recommended | Alternatives | Impact | Required evidence | Owner |
|---|---|---|---|---|---|
| **Pilot reading (MVP slice)** | **Nehemiah 2:1-20** as one canonical passage (`Neh.2`) — 20 verses, the full chapter as attested in BSB/tel_irv/tam_irv. Segmentation to `Neh.2.1-20` with verse-level addressing. | Neh.2.1-8 (narrow narrative) — rejected: omits return and opposition context; Whole-chapter+ Neh.3 overlap — out of scope for MVP per `MVP_PRD.md:12-14` | Defines `passage_key: neh-2`, `scope` rows, and daily-verse denominator. Determines candidate coverage completeness. | `apps/mobile/assets/scripture/bsb/Neh.json` chapters=13, `Neh` verses 2:1-20 verified; `bsb/api/BSB` commit `b2898c...` + IRV commits `3857e1...`, `08e71e...` | Product owner |
| **Context brief (reader layer)** | One concise `passage_context` per `passage_version` (who/where/when/what/before/stakes) covering **Neh.2.1-20** | Split pericope Neh.2.1-8/9-20 — deferred to post-MVP alternate segmentation | Single context record simplifies Task 03 RLS and offline package `docs/DATA_MODEL.md:151-174` | Editorial draft in `WHOLE_BIBLE_CURATION_SPEC.md` vs. production review | Editorial reviewer |
| **Default context range rule** | **No silent default** — if context range absent, reader shows Scripture only (fail-closed) | Default to Neh.2.1-8 — FORBIDDEN per Task 01 acceptance | Prevents assumed coverage | Parser must reject empty scope | Product owner |

> Neither pilot nor context defaults silently to `Neh.2.1-8`.

---

## 2. Canon, reference system, locale & translation — qualified identity (pre-Task 02)

| ID | Decision | Recommendation | Alternatives | Impact | Evidence | Owner |
|---|---|---|---|---|---|---|
| D-CANON | Supported canon | **66-book Protestant canon** as `canon: prot-66` (`GEN-REV`). `osis_code` per `OSIS` table in `tools/build-bsb-assets.py:12` | 73-book or custom canon — out of scope for MVP, requires ADR amendment | Fixes `bible_books.canon` and `DATA_MODEL.md:32-38` | `docs/CANONICAL_IDENTIFIERS.md:1` + `tools/build-bsb-assets.py` registry parity check | Product owner |
| D-REFSYS | Reference system | **Reference-system-qualified keys** — e.g. `refsys:eng-v22` (English versification) for BSB; `refsys:tel-v1`/`tam-v1` for IRV. Bare `Neh.2.4` never global. | Single global verse integer — rejected per `CONTEXT_MODEL_REVIEW.md:14` (split/merge) | Enables TVTMS split/merge/omitted mappings (Task 10) | `docs/CANONICAL_IDENTIFIERS.md`, `apps/mobile/src/lib/reference.ts:1` | Product owner + biblical reviewer |
| D-LOCALE | Launch locales & fallback | **Locales `en`, `te`, `ta` (BCP 47)**. Fallback: if approved localization missing → **show English source with banner** `en` + `review_status` label (not hide). Region subtags `OPEN`. | Hide layer — worse UX; auto-machine-translate — forbidden (`AGENTS.md` content rules) | Drives `passage_context_localizations` and `entity_localizations` per `ADR-001` | `docs/adr/001-multilingual-content-model.md:1` | Product owner |
| D-TRANS | Launch translations (one per language, independent rights) | **English: BSB (`en.bsb`, locale `en`)** `bsb/api/BSB` sha `b2898c49...`; **Telugu: IRV tel_irv (`te.tel_irv`)** sha `3857e102d27e`; **Tamil: IRV tam_irv (`ta.tam_irv`)** sha `08e71ec8b86c` — each with own `translation_licenses` row | WEB (superseded), single English-only — rejected | Fixes `translations.code` uniqueness `docs/DATA_MODEL.md:59-65` | `docs/CONTENT_RIGHTS.md:12-33` (owner-confirmed 2026-09-12/13) | Product owner + rights reviewer |
| D-EDITION | Immutable edition | One **immutable edition per translation** at beta: `bsb@20260912`, `tel_irv@20260913`, `tam_irv@20260913` — correction creates new edition, old spans preserved | Mutable edition — breaks anchor `verse.text.slice` validation `docs/DATA_MODEL.md:198-200` | Required for `translation_edition` and `verse_anchors` Task 04 | Build output hashes of `apps/mobile/assets/scripture/*/Neh.json` | Product owner |

---

## 3. Editorial, reviewer & rights — authority

| ID | Decision | Recommendation | Alternatives | Impact | Evidence | Owner |
|---|---|---|---|---|---|---|
| D-LENS | Theological/editorial lens | **Historical context first**, disclosed interpretive differences, no denominational harmonization as fact | Devotional lens — out of scope; single-tradition lens — rejected | Guides `CONTENT_GUIDELINES.md` and context prose | `docs/CONTENT_GUIDELINES.md:1` | Editorial reviewer |
| D-REVIEW | Review authority & thresholds | **Named qualified reviewers** per record kind (see §7 matrix): biblical-language, geography, rights, editorial. Threshold: **one specialist approval per kind + product owner** before `published`. | Single generic reviewer — forbidden `docs/IMPLEMENTATION_PLAN.md:75-77` | Fixes `review_status` state machine | `docs/IMPLEMENTATION_PLAN.md:75`, `docs/SECURITY.md:150` | Product owner |
| D-TERR | Launch countries | **Deny until BSB/IRV terms confirm territories** — fail-closed per `docs/CONTENT_RIGHTS.md:22,44` | Global on public availability — forbidden (`CONTENT_RIGHTS.md:107`) | Blocks offline/image/web until evidence | Posted terms at `https://berean.bible/` and ebible.org `details.php?id=tel2017/tam2017` — still `OPEN` | Rights reviewer |
| D-DOMAIN | Web domain & app IDs | **Keep PROPOSED** `https://biblecompass.com` + reverse-domain `com.biblecompass.mobile` until ownership/HTTPS verified; no store setup until verified | Ad-hoc domain — would break canonical links `docs/ARCHITECTURE.md:91` | Typed config `apps/mobile/src/config.ts:1` | Domain ownership proof `OPEN` | Product owner |

---

## 4. External-AI processing, retention, training, embeddings — per source component (fail-closed)

> Catalog status `candidate_only` in `docs/OPEN_BIBLE_DATA_SOURCES.md:19` never authorizes AI disclosure. Each tuple requires exact `source_release` + `component` + `operation` grant.

| Source component | Intended operation | Recommendation | Alternative | Evidence | Owner |
|---|---|---|---|---|---|
| `source:stepbible:tipnr` structured fields (people, names, attestations, family relations) | `evaluation_import` only (local, no AI) | **DENY** `external_ai_processing`, `training`, `embedding` — retain as quarantined candidate | Allow Claude-generated descriptions — FORBIDDEN (CC-BY + AI prose not evidence) `OPEN_BIBLE_DATA_SOURCES.md:141` | TIPNR TSV fields, license `CC-BY-4.0` evidence retained from `https://github.com/STEPBible/STEPBible-Data` | Rights + editorial reviewer |
| `source:stepbible:tvtms` (versification mappings) | `evaluation_import` | **DENY** AI | Allow as AI input — unnecessary | Same repo, commit-pinned | Rights reviewer |
| `source:bibledata:structured` people/relationships/person-verse | `evaluation_import` | **DENY** AI | Allow for drafting — deferred until rights review | `CC-BY-4.0` per catalog | Rights reviewer |
| `source:macula:hebrew` Hebrew fields for Neh.2 | `evaluation_import` | **DENY** AI | Allow — deferred | Component `CC-BY-4.0` with upstream attestations | Rights reviewer |
| `source:openbible:geocoding` core geodata | `evaluation_import` | **DENY** AI, **DENY** OSM-derived fields & images & ESV quotations — only core CC-BY fields if approved `OPEN_BIBLE_DATA_SOURCES.md:250-270` | Allow OSM — would incur ODbL | GeoJSON + license audit | Rights reviewer |
| `source:theographic:metadata`, `source:bibleaquifer:acai-realia`, `source:semanticbible:*` | any | **DENY** — `rejected`/`quarantined` until share-alike legal review (`OPEN_BIBLE_DATA_SOURCES.md:165,372,428`) | Allow — would contaminate CC-BY pool | `CC-BY-SA-4.0` documented | Rights reviewer |
| `bsb/api/BSB`, `tel_irv`, `tam_irv` scripture text (BSB/IRV) | `ai_curation` (if Owner/Rights Gate D2 approves) | **DENY by default** — separate D2 packet must list exact `book/chapter/verse` excerpts, provider, retention; no training on our data | Broad “Bible text” grant — FORBIDDEN `docs/CONTENT_RIGHTS.md:70-78` | Scripture display rights ≠ AI training rights | Rights + product owner |
| **All sources** | `embedding_generation` | **DENY** for every component at this gate | Allow embeddings — would create derivative obligations | No embedding license granted | Rights reviewer |

Retention derivation: raw AI submissions retained as **quarantined drafts only**, not as canonical facts (see `AI_CURATION_CONTRACT.md`). Provider retention/training explicitly **0 days / no training** unless D2 explicitly allows.

---

## 5. Raw-source retention & quarantine policy

| Policy | Recommendation | Alternative | Impact | Owner |
|---|---|---|---|---|
| **Quarantine path** | Private `content/quarantine/<source>/<release>/<sha>/` (git-ignored), never in `apps/mobile/assets/` or `supabase/` | Public `supabase` bucket — forbidden before RLS | Isolates opaque bytes until Gate C2 parsing | Security reviewer |
| **Retention** | Retain **exact approved bytes + license-evidence file** for audit; delete on `rejected`/`expired` per reviewed retention schedule (default 90d after D2 expiry) | Indefinite retain — rejected (privacy/bloat) | Enables Task 09-09F exact-byte checks | Product + rights reviewer |
| **Access** | Only narrow server identity may read quarantine (no public client) | Anonymous read — forbidden `docs/SECURITY.md:31` | RLS: quarantine tables private | Security reviewer |
| **Network** | `evaluation_import` only in isolated env, no egress to AI provider | Direct mobile fetch — forbidden | `CONTENT_GUIDELINES.md` provenance | Security reviewer |

---

## 6. Root workspace / package & dependency versions — exact

| Item | Recommendation | Alternative | Evidence | Owner |
|---|---|---|---|---|
| **Root workspace** | **Do not create** `packages/domain`/`content-schema` until Gate A2 approves Task 03 model. Use existing `apps/mobile` only. | Premature `npm init` — risks spec drift | `docs/IMPLEMENTATION_PLAN.md:31-32` | Product owner |
| **Allowed new packages (when approved)** | `packages/domain` (pure TS, no deps), `packages/content-schema` (`zod@3.23.8` exact) | Add `zod@4` — would break approved validation | `apps/mobile/package.json:22` pins `zod@3.23.8` | Product owner at Gate A2 |
| **Dev tooling exact pins** | Keep current `apps/mobile` pins: `typescript@6.0.3`, `jest@29.7.0`, `eslint@9.39.5`, `prettier@3.9.6` — no upgrades in this packet | Bump without Gate A2 — FORBIDDEN | Lockfile `apps/mobile/package-lock.json:1` | Product owner |
| **No new dep** | **No new dependency** in this packet — `npm install` not run | Add adapter dep — deferred to Task 04 with explicit version list | — | Product owner |

All versions MUST be `exact` (no `^` drift at install) and recorded in Gate A2 receipt `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md:746-748`.

---

## 7. Reviewer matrix & package granularity (informing Tasks 03-04)

* **Record-kind → required reviewer** (Task 21 will enforce):
  * Reference-system / split-merge — reference-system specialist
  * Hebrew referents / attestation semantics — biblical-language reviewer
  * BSB/IRV mention selectors — edition-language reviewer
  * Place identity / geometry — historical-geography reviewer
  * Relevance / passage context — biblical/editorial reviewer
  * Rights / obligations / attribution — rights reviewer
  * Telugu/Tamil localization — native-language reviewer (future)
* **Package granularity:** one immutable **staging_candidate** package per `Neh.2` locale (`en`/`te`/`ta`) sharing canonical keys, locale-aware publication view.
* **Unicode selector:** grapheme-safe, not UTF-16 code-unit offsets — `WHOLE_BIBLE_CURATION_SPEC.md` / `CONTEXT_PLATFORM_SPEC` adoption gate #8.

---

## 8. Unknowns — remain visibly unknown (fail-closed)

* Fallback when localization missing: **OPEN** — recommendation above is provisional, requires owner sign-off before Task 04 implements `passage_context_localizations`.
* Telugu/Tamil ship at beta? **OPEN** — `docs/adr/001-multilingual-content-model.md:30` — deferred to Gate A1 sign-off.
* Non-BSB textual basis / versification differences beyond TVTMS: **UNKNOWN** — coverage incomplete.
* Source components not listed above: **DENIED** by default; any new dataset needs separate packet.

---

## 9. Decision-ID consistency & rights non-contradiction check

* All `D-*` IDs unique, sequential, cross-referenced to `PD-*` in `docs/PRODUCT_DECISIONS.md:9-20`.
* No `approved`/`allowed` in governing docs changed — only this packet proposes `DENY`/`PARTIAL`; verification: `rg -n "OPEN|OWNER ACTION|approved|allowed" docs/PRODUCT_DECISIONS.md docs/CONTENT_RIGHTS.md docs/CONTEXT_PLATFORM_SPEC.md docs/OPEN_BIBLE_DATA_SOURCES.md` passes (all `candidate_only`, `OPEN` remain).
* Effective obligations for any future package are **unknown** until lineage union computed — builder must reject incompatible share-alike combo (`OPEN_BIBLE_DATA_SOURCES.md:535-538`).

---

## 10. Sign-off table — no pre-filled approval

| Role | Name | Date | Decision | Signature / receipt ID |
|---|---|---|---|---|
| Product owner | _[to be filled]_ | _[to be filled]_ | `AWAITING_DECISION` | _pending Gate A1 receipt_ |
| Rights / legal reviewer | _[to be filled]_ | _[to be filled]_ | `AWAITING_DECISION` | _pending_ |
| Editorial / biblical reviewer | _[to be filled]_ | _[to be filled]_ | `AWAITING_DECISION` | _pending_ |
| Geography reviewer (for place policy) | _[to be filled]_ | _[to be filled]_ | `AWAITING_DECISION` | _pending_ |
| AI-security reviewer (for AI deny-all) | _[to be filled]_ | _[to be filled]_ | `AWAITING_DECISION` | _pending_ |

> **Gate A1 releases only tasks/source IDs explicitly listed in valid receipts.** No Markdown approval, no `DENIED` release, no `PARTIALLY_APPROVED` beyond listed IDs `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md:431-435`.

---

## 11. Handoff & digests (for Task 01)

* Packet path: `docs/OWNER_GATE_A1_PACKET.md` — sha256 `(to be computed)` — synthetic draft (AI-prepared), not approved.
* Consumed: `handoff:task-00` sha `d6769c963d8e`, Gate 0 receipt `c450dea4c3b3`.
* This packet **does not** update `PRODUCT_DECISIONS.md`/`CONTENT_RIGHTS.md` statuses — those remain `OPEN` until Gate A1 human receipt is minted via `bootstrap-trust-v1`.

