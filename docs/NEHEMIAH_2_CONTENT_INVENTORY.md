# Nehemiah 2 First Slice Content Inventory

## Purpose

Define the smallest complete, reviewed corpus required to prove the MVP architecture. This is an inventory, not approved production content.

## Status legend

- `OPEN` : not created or selected
- `DRAFT` : prepared but not reviewed
- `APPROVED` : reviewed and permitted for staging
- `PUBLISHED` : released as an immutable version
- `BLOCKED RIGHTS` : cannot proceed without license evidence

## Scripture

| Item | Canonical key | Status | Requirement |
|---|---|---|---|
| Complete chapter | `Neh.2.1-Neh.2.20` | BLOCKED RIGHTS | Licensed text, hashes and attribution |
| Daily verse candidate | `Neh.2.4` | BLOCKED RIGHTS | Confirm selected translation wording and sharing rights |
| Surrounding passage | `Neh.2.1-Neh.2.8` | BLOCKED RIGHTS | Reader and context entry |
| Inspection passage | `Neh.2.11-Neh.2.16` | BLOCKED RIGHTS | Map and later chapter context |

The owner must decide whether the beta context model covers the full chapter or begins with `Neh.2.1-Neh.2.8` while still allowing continuous chapter reading.

## Passage context

Required for `Neh.2.1-Neh.2.8`:

| Field | Status | Reviewer need |
|---|---|---|
| Who | DRAFT (`content/nehemiah-2/context-draft.json`) | Biblical and copy review |
| Where | DRAFT (`content/nehemiah-2/context-draft.json`) | Historical and geographic review |
| When | DRAFT (`content/nehemiah-2/context-draft.json`) | Chronology review and precision label |
| What | DRAFT (`content/nehemiah-2/context-draft.json`) | Biblical and copy review |
| Before | DRAFT (`content/nehemiah-2/context-draft.json`) | Canonical narrative review |
| Stakes | DRAFT (`content/nehemiah-2/context-draft.json`) | Historical and literary review |
| The moment for Nehemiah 2:4 | DRAFT (`content/nehemiah-2/context-draft.json`) | Biblical and copy review |

Draft covers the full chapter (`Neh.2.1–Neh.2.20`); the implemented app
context unit remains `Neh.2.1–Neh.2.8` until reviewers approve. AI-drafted,
unapproved — see `CONTENT_GUIDELINES.md` (AI cannot approve or publish).

Potential additional context unit for `Neh.2.11-Neh.2.16` is out of the first implementation task unless approved.

## Reusable entities

| Entity | Proposed slug | Type | Status |
|---|---|---|---|
| Nehemiah | `nehemiah-governor` | Person | DRAFT |
| Artaxerxes I | `artaxerxes-i` | Person | DRAFT |
| Jerusalem | `jerusalem` | Place | DRAFT |
| Susa | `susa` | Place | DRAFT |
| Persian Empire | `persian-empire` | Empire | DRAFT |
| Cupbearer | `cupbearer` | Role | DRAFT |
| Governors Beyond the River | `governors-beyond-the-river` | Political group or role | OPEN (covered as `beyond-the-river` place in draft; slug decision pending) |
| Asaph keeper of the royal park | `asaph-royal-park` | Person | DRAFT |
| Sanballat the Horonite | `sanballat-the-horonite` | Person | DRAFT |
| Valley Gate | `valley-gate` | Place or structure | DRAFT |
| King's Pool | `kings-pool` | Place | DRAFT |

First milestone minimum:

- Nehemiah
- Artaxerxes I
- Jerusalem
- Susa
- Persian Empire
- Cupbearer

## Passage-specific entity roles

Create `In this passage` text for every published entity. At minimum:

- Nehemiah as the king's cupbearer who is preparing a consequential request
- Artaxerxes as the ruler with authority over permission, protection and resources
- Susa as the Persian court setting before the journey
- Jerusalem as the damaged ancestral city Nehemiah seeks to help
- Cupbearer as a trusted court role with access to the king

All wording remains `OPEN` until sourced and reviewed.

## Interactive anchors

Translation selected: BSB. 19 anchors implemented as DRAFT in
`content/nehemiah-2/context-draft.json` (translation ID, verse ID, character
offsets, matched text, target entity — all validated against the bundled
BSB text by `tools/sync-context-draft.py` and `__tests__/draft.test.ts`):

- King Artaxerxes (2:1), city where fathers are buried (2:3, 2:5), Judah (2:5),
  governors west of the Euphrates (2:7, 2:9), Asaph (2:8),
  Sanballat the Horonite (2:10, 2:19), Tobiah the Ammonite official (2:10, 2:19),
  Jerusalem (2:11, 2:12, 2:17, 2:20), Valley Gate (2:13, 2:15),
  King's Pool (2:14), Geshem the Arab (2:19)

Still without an entity target (no anchor until one exists): "I was very much
afraid" (2:2), "Gates destroyed by fire", "Letters to the governors" as a
standalone concept, Dung Gate, Fountain Gate, the unnamed queen.

Every anchor requires:

- Translation ID
- Verse ID
- Start and end character offset
- Matched text
- Target entity or context card
- Validation against the exact licensed verse text

## Timeline inventory

| Event | Status | Required fields |
|---|---|---|
| Abraham | DRAFT (draft JSON, traditional dating) | Date range, precision, description, relevance and sources |
| Exodus from Egypt | DRAFT (draft JSON, traditional dating) | Date range, precision, description, relevance and sources |
| David king in Jerusalem | DRAFT (draft JSON) | Date range, precision, description, relevance and sources |
| Babylonian destruction of Jerusalem | DRAFT (draft JSON) | Date range, precision, description, relevance and sources |
| Persian conquest of Babylon | DRAFT (draft JSON) | Date range, description and sources |
| Return from exile | OPEN | Clarify which return and avoid overgeneralization |
| Ezra's earlier return or ministry | DRAFT (draft JSON, traditional dating flagged disputed) | Chronology and relevance |
| Peace of Callias | DRAFT (draft JSON, disputed) | Date range, precision, description, relevance and sources |
| Parthenon begun | DRAFT (draft JSON) | Date range, description and sources |
| Nehemiah before Artaxerxes | DRAFT (draft JSON) | Approximate date and precision |
| Rebuilding Jerusalem's wall | DRAFT (draft JSON, via Neh 6:15) | Date range and relation to passage |
| Jesus born | DRAFT (draft JSON, traditional dating) | Date range, precision, description, relevance and sources |
| Crucifixion and resurrection | DRAFT (draft JSON, traditional dating) | Date range, precision, description, relevance and sources |
| Selected Athens parallel | Covered above (Callias, Parthenon) | Include only if it meaningfully orients the reader |

## Map inventory

### MVP map

Susa to Jerusalem overview.

Required:

- Reviewed base asset
- Time-period scope
- Susa and Jerusalem hotspots
- Route shown as approximate unless evidence supports more precision
- Legend
- Ancient and modern comparison where reliable
- Uncertainty note
- Accessible description
- Asset license and attribution
- Offline and mobile distribution rights

### Deferred map

Nehemiah's Jerusalem inspection route should be deferred unless reliable, reviewable data and a clear user need are available.

## Verse card assets

First MVP themes:

- Dawn
- Night
- Parchment

For each theme:

- Background source and rights
- 9:16 safe region
- 1:1 safe region
- 4:5 safe region
- Text and overlay colors
- Contrast verification
- Required asset attribution
- Longest supported verse fit test

## Sources

`DRAFT` — 4 source records live in `content/nehemiah-2/context-draft.json`
(BSB text + 3 reviewer-to-select references). Reviewer must confirm editions,
pages, and every map claim before any status moves past DRAFT.

Create source records for:

- Selected Bible translation and rights documentation
- Nehemiah historical context
- Persian administration and Artaxerxes
- Susa and Jerusalem geography
- Chronology
- Cupbearer role
- Map base and route claims
- Any world-history parallel

Do not copy commentary prose. Write original summaries supported by recorded sources.

## Acceptance checklist

- Translation rights matrix is approved.
- The chapter and daily verse use licensed exact text.
- Every content record validates against the schema.
- Every important claim has a source.
- Every record has a confidence and review status.
- Every anchor matches exact translation text.
- Timeline uncertainty is visible.
- Map rights, attribution and accessible description are complete.
- All three verse card ratios pass long-text and contrast checks.
- A reviewer signs the exact content package version.
