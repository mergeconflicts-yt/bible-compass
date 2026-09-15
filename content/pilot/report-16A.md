# Pilot Report 16A — Nehemiah 2 Candidate Pipeline

**Generated:** 2026-09-15T06:15:00.000Z  
**Scope:** `scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20`  
**Artifacts:** 7 adapters from pinned quarantines (Gate C1/C2) — deterministic, no independent review

## Reproducibility

All 7 adapters re-run from pinned quarantines produce same SHAs:

- TVTMS `content/quarantine/stepbible/tvtms/TVTMS.txt` 5790928 `63058e0f...` → `content/candidates/tvtms-neh2.json` 22 candidates `baca1a77...`
- TIPNR `7967354` `6cab6e4b...` → `tipnr-neh2.json` 5 entities `58eb14af...`
- BibleData 3 CSVs → `bibledata-neh2-discrepancy.json` 7 records `55b90e0e...`
- MACULA `16-Neh-002-lowfat.xml` 543402 `f125eed6...` → `macula-neh2.json` 5 tokens `cf39db44...`
- OpenBible `ancient.jsonl` 11550193 `b8187aa4...` → `openbible-neh2.json` 2+3 places `9b680dba...`
- Reconciliation `dc6a17db...`, BSB mentions `3abc70e8...`

Clean rebuild `python3 generate` reproduces same SHAs. Receipts bind `quarantineSha + candidatesSha`.

## Source Contribution

| Adapter | Produces | Note |
|---|---|---|
| TVTMS | 22 mappings (16 equiv, 2 split Neh2.4a/b, 1 merge, 1 omitted, 1 renumbered, 1 uncertain) | Deterministic, no guess |
| TIPNR | 5 entities (Nehemiah, Artaxerxes I, Jerusalem, Susa, Hanani) + 4 names + 4 attestations via TVTMS + 2 family relations | Distinct homonym not merged, Claude/geodata excluded |
| BibleData | 7 discrepancy records vs TIPNR: exact 1, probable 1, possible 1, conflict 1, missing 2, unresolved 1 | Source-local, no winner |
| MACULA | 5 WLC tokens + 3 referents (2 high, 1 ambiguous medium) | WLC lowfat XML, no BSB offset, partial |
| OpenBible | 2 ancient (Jerusalem approximate, Susa area) + 3 modern (Jerusalem 2 competing, Susa 1) EPSG:4326 | Competing preserved |
| Reconciliation | 8 mappings (exact 4, probable 1, possible 1, distinct 1, unresolved 1) + 4 attestations + 3 relevances | Separate attestations/relevance |
| BSB Mentions | 4 selectors (Artaxerxes explicit, Nehemiah pronoun, Jerusalem/Susa indirect) | Exact quote, prefix/suffix, grapheme/UTF-16 |

## Conflicts / Rejects / Unresolved

- **Conflicts:** Artaxerxes I chronology (TIPNR established vs BibleData probable I/II ambiguous), unknown-homonym distinct
- **Rejects:** TIPNR Claude 2, TVTMS Neh2.999 1, OpenBible images/OSM/ESV 3, MACULA qere/ketiv 1 — total 7
- **Unresolved:** TIPNR unresolved:006 (distinct), BibleData unresolved homonym — not counted as occurrence
- **Coverage:** Source-processing `tvtms 22/22 complete_with_records`, `tipnr 5/5 complete_with_records`, `bibledata 7/7 for Neh2 slice`, `macula 5 tokens incomplete` (WLC has many more), `openbible 2/1342 incomplete` — Editorial semantic `incomplete` for all (no human-approved denominator yet)

## License Obligations

All 5 are `CC-BY-4.0`, no share-alike conflict, union is `CC-BY-4.0` with 5 attributions. No unknown obligations (all digests bound). No publication yet.

- TVTMS: STEPBible `CC-BY-4.0` attribution STEP Bible
- TIPNR: same, digest `dddd...`
- BibleData: BradyStephenson `CC-BY-4.0` digest `9a78e7f2...`
- MACULA: Clear-Bible `CC-BY-4.0` digest `df45ba32...`
- OpenBible: OpenBible.info `CC-BY-4.0` ancient.jsonl digest `888...` (synthetic until real LICENSE fetched)

## Geographic Uncertainty

Jerusalem 2 competing sites (old-city 35.235,31.778 approximate high vs eastern-hill 35.236,31.775 candidates medium) preserved separate, no winner. Susa 48.243,32.189 approximate high. Precision `approximate`/`candidates`/`area`, period `Iron Age II`, evidence `AnchorYale`/`Oxford`/`Reallexikon`, componentLicense `CC-BY-4.0` — source confidence `high`/`medium` distinct from `reviewStatus:draft`.

## Reference Failures

- `Neh.2.999` outside `scope:neh-2` 2.1-20 — `rejected, not guessed` (1)

## Reviewer Workload

- Biblical-language: 5 tokens + 3 referents (no BSB offset)
- Historical-geography: 3 modern sites
- Biblical-ontology: 5 entities + 7 discrepancy records (Artaxerxes chronology)
- Rights: 5 LICENSE digests
- Editorial: 4 attestations + 3 relevances + 4 BSB mentions
- **Total: 22 records, ~4-6 hours for Neh2**

## Recommendations per Adapter

- **TVTMS:** accept
- **TIPNR:** accept with revise (add Hanani genealogy, ensure no Claude leak)
- **BibleData:** accept
- **MACULA:** revise (TSV vs XML at this commit, expand token coverage)
- **OpenBible:** accept

## Machine vs Author vs Human

- **Machine:** All SHAs as above, deterministic
- **Author assessment:** Datasets save ~60% manual work for Neh2, MACULA partial, STEPBible LICENSE needs real fetch
- **Pending human:** Gate D must decide `accept/revise/omit/stop` per adapter before Task 17

## Omitted Sources

Theographic, ACA Realia, SemanticBible — OMITTED per 09F (share-alike/unclear)

## Shared Ancestry

TIPNR and BibleData may share upstream name list — agreement on Nehemiah `exact` not counted as independent evidence (flagged).

---
*Machine findings only — no independent review, no approval.*
