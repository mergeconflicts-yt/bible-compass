# Product Decisions for Phase 0

> **Status note (whole-Bible draft track).** PD-002's Nehemiah 2 corpus remains the only reviewed/publishable slice. A machine-generated, unreviewed *draft* whole-English track under `content/curated/` (`synthetic_fixture`) exists solely to prove the pipeline; it does not change product scope or the excluded-feature boundary.

## Purpose

Resolve the product and operational choices required before the repository is initialized or production content is imported.

## Decision register

| ID     | Decision               | Status   | Current recommendation                                                                                                                                                                                                        | Owner action                                                                              |
| ------ | ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| PD-001 | Product scope          | DECIDED  | First MVP only as defined in `MVP_PRD.md`                                                                                                                                                                                     | Protect boundary                                                                          |
| PD-002 | Initial corpus         | DECIDED  | Nehemiah 2 complete slice                                                                                                                                                                                                     | Confirm exact verse ranges used for context units                                         |
| PD-003 | Platforms              | DECIDED  | iOS and Android from one Expo codebase                                                                                                                                                                                        | None                                                                                      |
| PD-004 | Backend                | DECIDED  | Supabase modular monolith                                                                                                                                                                                                     | None                                                                                      |
| PD-005 | Offline model          | DECIDED  | SQLite cache, local user state and outbox                                                                                                                                                                                     | None                                                                                      |
| PD-006 | Account requirement    | DECIDED  | Optional; anonymous reader remains complete                                                                                                                                                                                   | None                                                                                      |
| PD-007 | Historical maps        | DECIDED  | Reviewed static assets with hotspots                                                                                                                                                                                          | None                                                                                      |
| PD-008 | Final app name         | OPEN     | Use a neutral working name in development                                                                                                                                                                                     | Select final public name before store setup                                               |
| PD-009 | Primary beta audience  | OPEN     | Christians who want to read but feel contextually lost                                                                                                                                                                        | Select one audience                                                                       |
| PD-010 | Launch languages       | OPEN     | Begin with English, Telugu and Tamil                                                                                                                                                                                          | Select locale tags, region subtags and one translation per language with license evidence |
| PD-011 | Launch countries       | OPEN     | Limit to territories allowed by chosen license                                                                                                                                                                                | Select after rights review                                                                |
| PD-012 | Bible translations     | OPEN     | Choose one licensed translation per launch language, each with complete rights confirmation                                                                                                                                   | Select translations and provide license evidence per language                             |
| PD-013 | Theological lens       | OPEN     | Historical context first with disclosed interpretive differences                                                                                                                                                              | Approve editorial policy                                                                  |
| PD-014 | Review authority       | OPEN     | Qualified named reviewers approve production context                                                                                                                                                                          | Select reviewer model                                                                     |
| PD-015 | iOS bundle identifier  | OPEN     | Reverse-domain identifier owned by project                                                                                                                                                                                    | Provide domain and identifier                                                             |
| PD-016 | Android application ID | OPEN     | Match owned reverse-domain namespace                                                                                                                                                                                          | Provide identifier                                                                        |
| PD-017 | Canonical web domain   | PROPOSED | `https://biblecompass.com` (configurable via typed app config; ownership and HTTPS verification pending)                                                                                                                      | Confirm ownership/control and HTTPS/app-link readiness                                    |
| PD-018 | Sign-in methods        | DECIDED  | Apple + Google OAuth via system browser (owner decision 2026-09-15, evidence `docs/DECISION_M07_SYNC.md` D1; implemented as M07a; register transcribed 2026-09-18)                                                            | Done — recorded 2026-09-15                                                                |
| PD-019 | Analytics              | OPEN     | Explicit first-party event gateway plus crash reporting                                                                                                                                                                       | Approve provider, region and retention                                                    |
| PD-020 | Notification behavior  | DECIDED  | Local-only daily reminder at 08:00 local with approved copy (owner sign-off 2026-09-15, evidence `docs/DECISION_M07_SYNC.md`; `expo-notifications` approved 2026-09-18; implemented as M07c; register transcribed 2026-09-18) | Done — recorded 2026-09-15/18                                                             |

## Product boundary decision

The first MVP includes:

- Bible browser and reader
- Continue reading
- Verse of the Day
- Verse card generation, sharing and download
- Passage orientation
- Reusable entities and passage-specific roles
- Timeline and historical map
- Reference and downloaded-content search
- Bookmarks, recent reading and preferences
- Offline operation
- Optional account synchronization
- Deep links, minimal recipient fallback and opt-in notifications
- Accessibility, telemetry and release operations

It excludes:

- Scenes and pathways
- Prayer and community
- Public user content
- Open-ended AI teaching
- Subscriptions
- Church tools
- Full-Bible contextual coverage

## Required owner answers

Complete these before Phase 1:

1. What is the working project name?
2. Who is the primary beta user?
3. What language and locale launch first?
4. Which countries can access the beta?
5. Which Bible translation is selected?
6. Where is the written rights evidence?
7. Which domain will host canonical shared links?
8. What bundle ID and application ID will be permanently owned?
9. Who approves historical and theological content?
10. What interpretive lens and disagreement labels will be used?

## Phase 0 exit gate

Phase 0 is complete only when PD-008 through PD-017 are resolved and `CONTENT_RIGHTS.md` contains evidence for all intended translation uses.
