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
| Who | OPEN | Biblical and copy review |
| Where | OPEN | Historical and geographic review |
| When | OPEN | Chronology review and precision label |
| What | OPEN | Biblical and copy review |
| Before | OPEN | Canonical narrative review |
| Stakes | OPEN | Historical and literary review |
| The moment for Nehemiah 2:4 | OPEN | Biblical and copy review |

Potential additional context unit for `Neh.2.11-Neh.2.16` is out of the first implementation task unless approved.

## Reusable entities

| Entity | Proposed slug | Type | Status |
|---|---|---|---|
| Nehemiah | `nehemiah-governor` | Person | OPEN |
| Artaxerxes I | `artaxerxes-i` | Person | OPEN |
| Jerusalem | `jerusalem` | Place | OPEN |
| Susa | `susa` | Place | OPEN |
| Persian Empire | `persian-empire` | Empire | OPEN |
| Cupbearer | `cupbearer` | Role | OPEN |
| Governors Beyond the River | `governors-beyond-the-river` | Political group or role | OPEN |
| Asaph keeper of the royal park | `asaph-royal-park` | Person | OPEN |
| Sanballat the Horonite | `sanballat-the-horonite` | Person | OPEN |
| Valley Gate | `valley-gate` | Place or structure | OPEN |
| King's Pool | `kings-pool` | Place | OPEN |

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

Anchor locations are translation-specific and cannot be finalized before the translation is selected.

Candidate concepts:

- King Artaxerxes
- I was very much afraid
- City where my ancestors are buried
- Gates destroyed by fire
- Letters to the governors
- Asaph keeper of the royal park
- Sanballat the Horonite
- Valley Gate
- King's Pool

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
| Babylonian destruction of Jerusalem | OPEN | Date range, precision, description, relevance and sources |
| Persian conquest of Babylon | OPEN | Date range, description and sources |
| Return from exile | OPEN | Clarify which return and avoid overgeneralization |
| Ezra's earlier return or ministry | OPEN | Chronology and relevance |
| Nehemiah before Artaxerxes | OPEN | Approximate date and precision |
| Rebuilding Jerusalem's wall | OPEN | Date range and relation to passage |
| Selected Athens parallel | OPTIONAL | Include only if it meaningfully orients the reader |

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

`OPEN`

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
