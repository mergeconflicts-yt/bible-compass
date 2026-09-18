# Mobile Install Plan (separate from plan 1.2.0)

Status: ACTIVE. Owner gate E2 (void) grants nothing; this plan installs only
already-licensed bundled Scripture already displayed from JSON today, plus
unapproved-content scaffolding that stays empty until human-approved content
exists. No candidate, draft, or staging data enters the app bundle.

## Task register

| Task | Deliverable                                                                                                                                                                                                                                                                                                                            | Status                                                            | Exit gate                                                              |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| M01  | SQLite foundation: `expo-sqlite` + `expo-crypto` (SDK-pinned), versioned migration runner, `001` core schema (installations, units, verses), 12 migration tests, sqlite3 CLI validation                                                                                                                                                | DONE                                                              | Runner + schema verified; zero new type/lint failures                  |
| M02  | SQLite projection: bundled BSB chapter → units/verses/installations, transactional, idempotent, checksum-verified, keep-last-healthy; 9 tests (7 unit + 2 real-engine)                                                                                                                                                                 | DONE                                                              | Real Neh.2 (20 verses) installs end to end on a real engine            |
| M03  | Reader repository + UI wiring behind a feature interface: `PassageRepository` port, JSON + SQLite adapters, `passageStore` (SQLite-first, JSON fallback), headings table `002`, 3 call sites wired; 27 tests                                                                                                                           | DONE                                                              | Reader reads offline from SQLite; JSON path retired behind a flag      |
| M04  | Context, timeline, map from approved content only                                                                                                                                                                                                                                                                                      | BLOCKED on human-approved content                                 | No draft data projected (guard test)                                   |
| M05  | Daily verse + share composer on SQLite reads: `resolveDailyVerseText` (SQLite-first, fail-closed), fixtures rewired, hardcoded fallback removed; 4 tests (stub routing, JSON fallback, fail-closed, real-engine)                                                                                                                       | DONE                                                              | Cards render offline                                                   |
| M06a | Durable bookmarks + outbox: migration `003_library`, `BookmarkRepository` port + SQLite adapter (same-transaction outbox ops, stable client UUIDs), OptionsSheet persistence with saving/error-retry, Saved lists real bookmarks with empty state; 9 tests (fake contract + file-backed restart)                                       | DONE                                                              | Bookmark survives force-close; every mutation has a durable outbox row |
| M06b | Offline verse-text search + recents: `searchVerses` port (SQLite LIKE with ESCAPE + bounded bundle-scan fallback), `004_recents` + `RecentRepository` (upsert, cap 10, locations only — never query strings), Search VERSES section, real recents in Search/Saved, passage-open recording; 19 tests incl. file-backed airplane journey | DONE                                                              | Airplane-mode journey passes                                           |
| M06c | Reading progress: `005_progress` (one row per translation), `ProgressRepository` port + SQLite adapter, ReaderView records chapter entry + verse landings, Home continue-reading sourced from store with pilot default; local-only (D2 syncs bookmarks-only, so no outbox queue)                                                       | DONE                                                              | Reopen continues where the reader left off; survives force-close       |
| M07a | Auth: supabase-js 2.116.0 + secure-store 57.0.4 (approved, pinned), SecureStore sessions, Apple/Google OAuth via WebBrowser, anonymous default, Settings account section, sign-out wipes library (destructive confirm); 14 tests                                                                                                       | DONE                                                              | Anonymous default preserved; sign-out wipes library                    |
| M07b | Sync engine: idempotent outbox push + cursored pull, op-log replay, BSB-only identity, first-sign-in union merge; cloud account deletion needs an Edge Function (not built)                                                                                                                                                                                            | DONE (code + headless tests; live + two-device + denial tests await runtime) | Two-device + denial tests pass                                         |
| M07c | Local daily reminder (copy + 08:00 policy approved)                                                                                                                                                                                                                                                                                    | DONE (code + headless tests; fires-once + tap routing await devices) | Reminder fires once per local day, opt-in only                         |
| M08  | Hardening + release                                                                                                                                                                                                                                                                                                                                     | PARTIAL (headless tripwires DONE: dep/permission/secrets/error-copy gates; device budgets + crash reporting await runtime/approval) | Budgets + checklist pass                                               |

## Scope guard (binding)

Projection covers Scripture verses/units ONLY. Entity, attestation,
mention, and relevance tables are deliberately absent from the mobile
schema until human-approved content exists: every publication gate is
VOID (`docs/receipts/gate-void-registry.json`), so projecting candidate
identity data would violate content trust. `projection.ts` header states
this; a guard test belongs in M04.

## Conventions

- One task per dispatch; screens never touch SQLite/Supabase directly.
- `SqliteExecutor` is the only seam (fakes in unit tests, `node:sqlite`
  adapter in integration tests, `expo-sqlite` adapter on device).
- Hashing is injected (`HashSql`): `expo-crypto` on device, `node:crypto`
  in integration tests, deterministic fakes in unit tests.
- Mobile is NOT an npm workspace (standalone install via its own
  lockfile); root `verify:all` covers it explicitly.
