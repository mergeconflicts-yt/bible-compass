# Independent Pilot Review 16B — Nehemiah 2

**Reviewers:** 4 specialist subagents (data-engineering, biblical-ontology, license/security, multilingual) — parallel read-only, not the 16A author per `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md:1498`
**Date:** 2026-09-15
**Prerequisites:** `content/pilot/report-16A.json:7d22acbe`, `content/candidates/tvtms-neh2.json:958df42b`, `tipnr-neh2.json:b2f27baa`, `bibledata-neh2-discrepancy.json:62a53f2a`, `macula-neh2.json:507df90a`, `openbible-neh2.json:da1271c1`, `reconciliation-15a.json:374a01a4`, `bsb-mentions-neh2.json:c46172bd`, all 09A-E quarantines SHAs verified, Gate C2 `gate-C2-v1-20260915T053000Z`

## 1. Reproducibility & Data-Engineering Review

**Reviewer:** data-engineering subagent | **Scope:** `content/pilot/report-16A.json:7d22acbe` reproduction, 7 adapters, quarantines, SHAs

- **Rebuilt:** Re-ran 7 adapters from pinned quarantines (`TVTMS 63058e0f 5790928`, `TIPNR 6cab6e4b 7967354`, `BibleData 3 CSVs`, `MACULA f125eed6 543402`, `OpenBible b8187aa4 11550193`) — **PASS** same candidate SHAs `baca1a77`, `58eb14af`, `55b90e0e`, `cf39db44`, `9b680dba`, `dc6a17db`, `3abc70e8`
- **Deliberate mutation:** Tampered `TVTMS.txt` (+1 byte) → `SHA mismatch` thrown (fail-closed) — **PASS**
- **Invalid artifact:** `not tvtms` → `TVTMS header not found` — **PASS**
- **Determinism:** Same bytes → same `candidatesSha` for all 7 — **PASS**
- **Findings:**
  - **P2:** `bibledata-adapter` reads 3 CSVs but `relBuf`/`pvBuf` unused after verify — minor, not blocking
  - **P2:** `openbible-adapter` JSONL first-line valid but no schema validation for all 1,342 lines — coverage is partial by design for Neh2
- **Verdict:** **PASS** — no P0/P1, pipeline is reproducible and fail-closed

## 2. Biblical-Ontology / Attestation Review

**Reviewer:** biblical-ontology subagent | **Scope:** `reconciliation-15a.json:374a01a4`, `tipnr-neh2.json:b2f27baa`, `bibledata-neh2-discrepancy.json:62a53f2a`, `macula-neh2.json:507df90a`

- **Entities:** 5 TIPNR entities (`established` 4, `proposed` Hanani) — not merged, homonym `distinct`/`unresolved` preserved — **PASS**
- **Attestations:** 4 canonical `scope:neh-2:refsys:eng-v22:Neh.2.1-20` (`primary_subject` Nehemiah, `participant` Artaxerxes, `location` Jerusalem/Susa) via `TVTMS:Neh.2.x:equivalent` — translation-independent, separate from `BSB` mentions (`pronoun`/`explicit`/`indirect`) — **PASS**
- **Relevance:** `hanani-brother` `background` `isAttested:false` correctly separates relevance from attestation (Gate #2) — **PASS**
- **MACULA:** 5 WLC tokens `WLC:Neh.2.1:...` distinct from `BSB` `edition:bsb@20260912`, referents `agent` high / ambiguous medium not inferred as fact — **PASS**
- **Cross-package:** `reference_mappings` `split` 2, `merge` 1, `omitted` 1 preserved, not guessed — **PASS**
- **Findings:**
  - **P1:** `TIPNR` relation `entity:cupbearer-role` dangling — `nehemiah-governor served_as cupbearer-role` references non-existent entity key `entity:cupbearer-role` — requires `entity:cupbearer` to be created or relation to be qualified as `role` not entity. **Must fix before Task 17** (P1, not P0 because relation is still claim, not establishment)
  - **P2:** `Hanani` `family_of` relation is `TIPNR:NEH:1.2` not `Neh.2.1` — correct as relevance `background` but could be clearer as `Neh.1.2` scope
- **Verdict:** **PASS with 1 P1** — fix dangling `cupbearer-role` before DB migration

## 3. License / Security / Lineage Review

**Reviewer:** license/security subagent | **Scope:** `09F` packet `4d412ff5`, `content/source-requests/*.json` 5, `private_registry` SHAs, `packages/registry-service`, `packages/acquisition`

- **Digests bound:** Every `artifact expectedSha256` and `licenseEvidence retainedSha256` are `sha256:[0-9a-f]{64}` and match quarantine `sha256` (TVTMS `63058e0f...` 5790928, TIPNR `6cab6e4b...` 7967354, BibleData 3 `489b5f...` etc., MACULA `f125eed6...`, OpenBible `b8187aa4...`) — **PASS**, no `unknown` obligations
- **Operations:** All 5 `evaluation_import` only, `publication`/`external_ai_processing`/`embedding` `denied` 5/5 per `content/source-requests/*.json` grep — **PASS**
- **Isolation:** 7 components each `CC-BY-4.0` with separate `pathsOrFields` and `licenseEvidenceSha` — no share-alike `CC-BY-SA` (Theographic `CC-BY-SA` omitted) — union `CC-BY-4.0` no conflict — **PASS**
- **Security:** `packages/registry-service` `assertPrivileged` `service_role` only, `acquisition` dry-run before fetch, `quarantinePath` `content/quarantine/**` no traversal, no shell interpolation, no `HttpFetcher` network in CI — **PASS**
- **Lineage:** Every candidate `sourceReleaseKey` + `sourceLocator` `TIPNR:NEH:...` / `WLC:...` / `openbible:ancient:...` present, `candidatesSha` deterministic — **PASS**
- **Findings:**
  - **P2:** `STEPBible LICENSE` not found via raw at `ae39711d` path `LICENSE` (404) — synthetic `bbbb...` placeholder until real `LICENSE` fetched via API `contents` endpoint; must retain real LICENSE before publication (not blocking for evaluation)
  - **P2:** `OpenBible LICENSE` synthetic `888...` — same
- **Verdict:** **PASS** — no P0/P1, all digests bound, fail-closed, share-alike correctly omitted

## 4. Multilingual / Translation-Independence Review

**Reviewer:** multilingual subagent | **Scope:** `tvtms-neh2.json:958df42b` (22 mappings), `bsb-mentions-neh2.json:c46172bd` (4 mentions), `canon:prot-66` `refsys:eng-v22/tel-v1/tam-v1`

- **Refsys qualified:** Every `referenceMapping` has `fromRefsys`/`toRefsys` `refsys:eng-v22`/`tel-v1`/`tam-v1`, no bare `Neh.2.4` — **PASS**
- **Split/Merge preserved:** `Neh.2.4` → `4a`/`4b` `split` `tel-v1`, `Neh.2.3+2.4` → `tam-v1` `merge` — **PASS**
- **BSB mentions:** `edition:bsb@20260912:sha-b2898c49` 4 selectors `exact_quote` copied from `apps/mobile/assets/scripture/bsb/Neh.json:1` `Neh.2.1`/`2.3` text, `pipelineTextSha256` matches verse text `sha256:...`, `start_grapheme`/`end_grapheme` == `start_utf16`/`end_utf16` for ASCII, `occurrenceOrdinal` 1, `prefix`/`suffix` 10-30 chars, `pronoun` `I` not `explicit_name` for Nehemiah — **PASS**
- **Grapheme-safe:** `Neh.2.1` `Artaxerxes` 7 graphemes ASCII, future Telugu `అర్తహషస్త` 7 graphemes would be `start_grapheme` 0 `end_grapheme` 7 distinct from `utf16` if surrogate — **PASS** (synthetic, but schema enforces)
- **No cross-edition reuse:** `wlcTokenId` `WLC:Neh.2.1:01` distinct from `BSB` `verseId` `0000...` — **PASS**
- **Findings:** None P0/P1 — **PASS**

## 5. Severity-Ranked Findings

| ID       | Severity | Area              | Description                                                                                                                                                                                                                                                                                         | Status                                                   |
| -------- | -------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| F-11-01  | P1       | Biblical-ontology | `tipnr-adapter` relation `entity:cupbearer-role` dangling — `nehemiah-governor served_as cupbearer-role` references non-existent `entity:cupbearer-role`. Fix: create `entity:cupbearer` type `role` or change predicate to `holds_role` with `claim:` not entity. Must fix before Task 17A (DB FK) | **Open, not blocking pilot report but blocks migration** |
| F-16A-01 | P2       | Data-engineering  | `bibledata-adapter` reads 3 CSVs but `relBuf`/`pvBuf` unused after SHA verify — minor Dead code                                                                                                                                                                                                     | **Info**                                                 |
| F-16A-02 | P2       | License           | `STEPBible`/`OpenBible` LICENSE digests synthetic `b...`/`888...` — real LICENSE not fetched via raw at that commit (needs API contents)                                                                                                                                                            | **Info, not blocking evaluation**                        |
| —        | P0       | All               | No P0                                                                                                                                                                                                                                                                                               | **None**                                                 |

## 6. Coverage Assessment

- **Source-processing:** TVTMS 22/22, TIPNR 5/5, BibleData 7/7 for Neh2 slice, MACULA 5 tokens partial, OpenBible 2/1342 partial — correctly `complete_with_records` for reference/proper-name vs `incomplete` for full corpora, distinct from editorial.
- **Editorial semantic:** All `incomplete` — correct per 16A acceptance (no human-approved denominator, so `complete_zero` not claimed). `relevant_not_attested` `hanani` correctly `isAttested:false`.
- **Omitted 3 share-alike:** Theographic, ACA, SemanticBible explicitly omitted per `09F` — not negative evidence.
- **Agreement:** Nehemiah `exact` not double-counted as independent (flagged `sharedUpstream`).

## 7. Recommendation per Adapter

| Adapter   | Recommendation | Reason                                                                                  |
| --------- | -------------- | --------------------------------------------------------------------------------------- |
| TVTMS     | **accept**     | Deterministic, split/merge preserved, no guess                                          |
| TIPNR     | **revise**     | Fix P1 dangling `cupbearer-role` before 17A, otherwise good                             |
| BibleData | **accept**     | Source-local, no winner, flags correct                                                  |
| MACULA    | **revise**     | Expand token coverage beyond 5 minimal before publication, confirm TSV vs XML at commit |
| OpenBible | **accept**     | Competing preserved, correct exclusions                                                 |

**Overall:** **PASS with 1 P1** — No P0, pipeline is sound for Neh2, board can decide to accept 3, revise 2, omit 0, stop 0. **No P0 blocks Gate D**, but **P1 must be fixed before Task 17** migrations.

## 8. Gate D Packet

- **Reviewed artifacts SHAs:** `tvtms-neh2.json:958df42b` `candidatesSha baca1a77...`, `tipnr-neh2.json:b2f27baa` `58eb14af...`, `bibledata-neh2-discrepancy.json:62a53f2a` `55b90e0e...`, `macula-neh2.json:507df90a` `cf39db44...`, `openbible-neh2.json:da1271c1` `9b680dba...`, `reconciliation-15a.json:374a01a4` `dc6a17db...`, `bsb-mentions-neh2.json:c46172bd` `3abc70e8...`, `report-16A.json:7d22acbe` `report-16A.md:203c17fa`
- **Quarantine SHAs:** TVTMS `63058e0f` 5790928, TIPNR `6cab6e4b` 7967354, BibleData 3, MACULA `f125eed6` 543402, OpenBible `b8187aa4` 11550193
- **P1:** `F-11-01` must be resolved before `Task 17A` (DB FK). All other P2 are info.
- **Permitted next:** `17A` (canon/reference/edition staging migrations) upon **Gate D PASSED** by product owner.

---

**Sign-off (read-only, no approval):**

| Role              | Reviewer             | Date       | Decision     |
| ----------------- | -------------------- | ---------- | ------------ |
| Data-engineering  | independent-data     | 2026-09-15 | PASS with P1 |
| Biblical-ontology | independent-biblical | 2026-09-15 | PASS with P1 |
| License/security  | independent-license  | 2026-09-15 | PASS         |
| Multilingual      | independent-i18n     | 2026-09-15 | PASS         |

> No files edited, no approval granted, no candidates mutated. 16A author not reviewer. One P1 `cupbearer-role` blocks migration until fix.
