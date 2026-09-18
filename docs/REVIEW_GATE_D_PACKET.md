# Gate D — Independent Pilot Review Packet (Task 16B)

**Packet version:** 1.0.0  
**Date:** 2026-09-15  
**Reviewers:** Independent specialist subagents (data-engineering, biblical-ontology, license/security, multilingual) — parallel read-only, not the 16A author per `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md:1498`  
**Prerequisites:** `content/pilot/report-16A.json:7d22acbe`, `content/candidates/tvtms-neh2.json:958df42b`, `tipnr-neh2.json:b2f27baa`, `bibledata-neh2-discrepancy.json:62a53f2a`, `macula-neh2.json:507df90a`, `openbible-neh2.json:da1271c1`, `reconciliation-15a.json:374a01a4`, `bsb-mentions-neh2.json:c46172bd`  
**Review artifact:** `content/pilot/review-16B.md:22d58f46`  
**Attempt:** `task:pilot-review:16B:attempt-1` — read-only, no file edits except this packet

---

## Summary

- **Reproducibility:** 7 adapters deterministic from pinned quarantines, SHA mismatch fail-closed — **PASS**
- **Biblical-ontology:** Attestations translation-independent, relevance separate, split/merge preserved, no homonym merge — **PASS with 1 P1** (`cupbearer-role` dangling)
- **License/security:** All digests bound, CC-BY-4.0 union no conflict, share-alike omitted, service_role privileged only — **PASS**
- **Multilingual:** RefSys qualified, split/merge preserved, BSB grapheme-safe, no cross-edition reuse — **PASS**
- **Coverage:** Source-processing vs editorial distinct, omitted explicit, agreement not double-counted — **PASS**

## Findings

| ID       | Severity | Area              | Description                                                                                                                                                          | Status                                        |
| -------- | -------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| F-11-01  | P1       | Biblical-ontology | `tipnr-adapter` relation `entity:cupbearer-role` dangling — `nehemiah-governor served_as cupbearer-role` references non-existent entity. Fix before Task 17A (DB FK) | Open, not blocking pilot but blocks migration |
| F-16A-01 | P2       | Data-engineering  | Dead code `relBuf`/`pvBuf` unused                                                                                                                                    | Info                                          |
| F-16A-02 | P2       | License           | STEPBible/OpenBible LICENSE synthetic until real fetch via API                                                                                                       | Info                                          |

**P0:** None

## Recommendation per Adapter

- TVTMS: accept
- TIPNR: revise (fix P1)
- BibleData: accept
- MACULA: revise (expand tokens)
- OpenBible: accept

**Overall:** **PASS with 1 P1** — No P0 blocks Gate D, but P1 must be fixed before 17A. Permitted next: `17A` upon Gate D PASSED by product owner.

## Sign-off

| Role              | Reviewer             | Date       | Decision     |
| ----------------- | -------------------- | ---------- | ------------ |
| Data-engineering  | independent-data     | 2026-09-15 | PASS with P1 |
| Biblical-ontology | independent-biblical | 2026-09-15 | PASS with P1 |
| License/security  | independent-license  | 2026-09-15 | PASS         |
| Multilingual      | independent-i18n     | 2026-09-15 | PASS         |

> This review is read-only. No files edited, no approval granted, no candidates mutated. 16A author not reviewer.
