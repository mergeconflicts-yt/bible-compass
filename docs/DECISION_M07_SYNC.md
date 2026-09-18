# Decision Packet: M07 Optional Sync / Auth / Notifications

Status: `AWAITING OWNER` — M07 stays BLOCKED until every decision below is
recorded with a named owner decision. AI cannot pass the gate alone.

## Context

- Mobile plan: `docs/MOBILE_INSTALL_PLAN.md` (M01–M06b DONE; M07 BLOCKED).
- Phase 9 spec: `docs/IMPLEMENTATION_PLAN.md:188-202` (minimal sign-in,
  anonymous default, SecureStore sessions, idempotent push + cursored pull,
  conflict policies, sign-out + deletion, first-sign-in migration, two-device
  - denial tests).
- Server tables exist: `supabase/migrations/20260915000006_user_library.sql`
  (`private_staging.profiles`, `private_staging.bookmarks` with owner RLS).
  No Edge Functions, no push infra, no production Supabase project wired.
- Client facts: bookmarks are the ONLY entity with an outbox (`003_library`);
  recents are locations-only and local by design (M06b); reading progress was
  never built; preferences are unpersisted (`ThemeProvider.tsx:39-40`); no
  `supabase-js`, `expo-secure-store`, `expo-notifications`, or auth UI exists.

## D1 — Sign-in method (Phase 9.1)

- Recommended: Supabase email magic link. First-party auth (no Sign in with
  Apple mandate triggered), no OAuth credentials to provision, works with an
  `biblecompass://` scheme redirect (no Universal Links required for v1).
- Alternatives: (a) Supabase anonymous auth — least friction but weak
  account portability/deletion story; (b) Apple + Google OAuth — familiar
  UX but App Store review burden, credential provisioning, and both
  platforms' token handling.
- Impact: magic link needs email delivery (Supabase built-in) + scheme
  redirect config + SecureStore sessions (D-dep below).
- Evidence required: owner records the chosen method + support-contact email.

## D2 — Sync scope for v1 (Phase 9.4–9.5)

- Recommended: bookmarks ONLY. It is the only outbox-backed entity; payloads
  carry locations (translation, book, chapter), never verse text, so sync
  inherits the existing privacy posture.
- Explicitly out: recents (local-only by M06b design), preferences
  (unpersisted — nothing to sync), reading progress (DOES NOT EXIST — see gap).
- Scope gap for owner: MVP_PRD wants saved reading progress, but no progress
  tracking was ever built. Either authorize a small progress task before M07
  (last-read chapter per translation, same outbox pattern) or formally defer
  progress sync post-MVP.
- Evidence required: owner confirms bookmarks-only + progress verdict.

## D3 — Convergence, identity, first-sign-in merge (Phase 9.5, 9.7)

- Recommended: op-log replay. Client outbox ops already carry stable client
  UUIDs; the server applies `bookmark.add` / `bookmark.remove` idempotently
  by client op identity, so replay converges without wall-clock dependence.
  Tombstone-wins for removes at the same location.
- Identity mapping (required — shapes differ): local
  `(translation_id, book, chapter)` → server `(refsys, local_key)`.
  Recommended v1: BSB-only sync (`BSB` → `refsys:eng-v22`,
  `local_key = {book}.{chapter}`); other translations stay local-only,
  fail-closed, until their refsys mappings are defined.
- First sign-in: recommended union merge — upload all local bookmarks as
  add-ops, dedupe by location server-side, keep earliest `created_at`.
- Alternatives: last-write-wins by timestamp (simpler, loses removes under
  clock skew); server-wins (destroys local data — rejected).
- Evidence required: owner confirms BSB-only v1 + union merge.

## D4 — Notifications in M07 (MVP_PRD:115,128; PD-020 PARTIAL; Phase 10)

- Recommended: local-only daily reminder (expo-notifications, explicit
  opt-in, user-selected time, same-day idempotency). No server, no push
  credentials, no token storage. Full push dispatch (Phase 10.4–10.6) deferred
  post-MVP.
- Requires PD-020 completion: approve default reminder copy + scheduling
  policy (exact time? quiet hours?).
- Alternatives: (a) defer ALL notifications post-MVP (smallest M07);
  (b) full push now (needs EAS/secret-store credentials, device-token
  backend, web fallback — a second project, not a task).
- Evidence required: owner picks local-only / defer / full-push + PD-020 copy.

## D5 — Sign-out and account deletion (Phase 9.6)

- Recommended: sign-out keeps the on-device library (anonymous usage stays
  complete); delete-account wipes cloud profile + bookmarks and offers (not
  forces) a local wipe. Server orphan cleanup is already flagged follow-up
  work in the migration header.
- Alternatives: sign-out wipes local (destroys anonymous-default promise —
  rejected); delete-account keeps cloud rows (privacy violation — rejected).
- Evidence required: owner confirms, + privacy-review sign-off for deletion.

## Dependencies requiring written approval (per AGENTS.md)

- `@supabase/supabase-js` (exact SDK-57-compatible version at install time).
- `expo-secure-store` (Phase 9.3 sessions).
- `expo-notifications` ONLY if D4 = local-only reminders.
- Device permission: notifications (D4 only, after explicit user action per
  SECURITY.md:118). No other new permission.

## Runtime the owner must provide for the M07 exit gate

- Supabase project with Auth enabled + `20260915000006_user_library.sql`
  applied (RLS runtime tests need a live project; none exists here).
- Two physical devices (iOS + Android) for two-device tests.
- Expired-session and cross-user-denial test accounts.

## Sign-off table (decided 2026-09-15)

| Decision                                                                                                                                                         | Owner answer                                                                                                                                                                                                                                  | Date       | Name  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----- |
| D1 sign-in method                                                                                                                                                | Apple + Google OAuth (overrides magic-link recommendation; owner accepts store-review + credential burden)                                                                                                                                    | 2026-09-15 | owner |
| D2 sync scope                                                                                                                                                    | Bookmarks only; recents stay local                                                                                                                                                                                                            | 2026-09-15 | owner |
| D2 progress verdict                                                                                                                                              | Build progress tracking first (authorized as M06c, precedes M07)                                                                                                                                                                              | 2026-09-15 | owner |
| D3 convergence + BSB-only + union merge                                                                                                                          | Approved as recommended                                                                                                                                                                                                                       | 2026-09-15 | owner |
| D4 notifications                                                                                                                                                 | Local-only daily reminder (push deferred post-MVP)                                                                                                                                                                                            | 2026-09-15 | owner |
| D5 sign-out / deletion                                                                                                                                           | Sign-out WIPES local library (overrides keep-local recommendation — sign-out must warn: destructive); delete-account wipes cloud + offers local wipe                                                                                          | 2026-09-15 | owner |
| Dependency approvals                                                                                                                                             | `@supabase/supabase-js` + `expo-secure-store` APPROVED 2026-09-15 (SDK-57-pinned, exact + lockfile); `expo-notifications` APPROVED 2026-09-18 (57.0.20 exact + lockfile, owner grants notification permission for the M07c local reminder) | 2026-09-18 | owner |
| PD-020 reminder copy + scheduling policy                                                                                                                         | APPROVED 2026-09-15: “Your verse of the day is ready · Nehemiah 2:4”, 08:00 local, opt-in only                                                                                                                                                | 2026-09-15 | owner |
| Runtime (Supabase project + applied user_library migration, iOS + Android devices, expired-session + cross-user test accounts, Apple + Google OAuth credentials) | OPEN — required for the M07 exit gate                                                                                                                                                                                                         |            |       |
