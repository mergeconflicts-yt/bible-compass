# Remediation Task R1 — Source of Truth (single root verify)

## Status

`CANDIDATE — awaiting owner-approved plan amendment before dispatch.`
Authored 2026-09-15 by owner direction (remediation items 2-5). This task
reinstates the one-task-at-a-time controller contract: it is exactly one
dispatchable unit. Do not split it across agents and do not bundle further
work into it.

Execution record 2026-09-15 (under "implement next items," serving as the
amendment authorizing R1): R1-A complete; R1-B files complete with runtime
pending (no docker/CLI in this environment); R1-C complete except the 10
triaged jest items (docs/R1_JEST_TRIAGE.md) and the supabase runtime leg;
overall PARTIAL. Details: docs/handoffs/task-R1-remediation.json.

## Task

Make the repository verify cleanly from a fresh clone with one root
command, using committed synthetic fixtures and enforceable database
policy tests. Concretely: (1) committed, clearly-marked synthetic fixtures
for every adapter test so no test depends on git-ignored
`content/quarantine/` artifacts; (2) rewritten Supabase RLS tests with real
failing assertions, role impersonation, cross-user denial, and runtime
verification of `security_invoker` public views; (3) a single root verify
command covering backend packages and the mobile app, with mobile
TypeScript at zero errors and formatting scoped to tracked sources.

## User value

A fresh clone, a new agent, and CI all prove the same thing with one
command. No test passes vacuously, no draft content can be mistaken for
approved content, and no device-dependent claim goes unverified.

## Read first

1. `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md` — status block (rev 20,
   BLOCKED), repair notice 2026-09-15, repaired ledgers, new history rows
2. `docs/receipts/gate-void-registry.json` — void gates stay void
3. `AGENTS.md` — execution contract, architecture/content/security/quality
   rules, stop conditions (this task changes no product scope)
4. `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DATA_MODEL.md`
5. Existing tests that must keep passing: `packages/domain` (8),
   `packages/content-schema` (61), `packages/registry-service` (12),
   `packages/acquisition` (10), adapter suites, `apps/mobile`
   `reference.test.ts` (11) and `sqlite-migrations.test.ts` (12)
6. Failing baselines to eliminate: mobile `tsc` (7 errors, all in
   `__tests__/bsb.test.ts` + 6 component files), `expo lint` (6 errors,
   `react-hooks/*` in sheets), 8 `react-native-reanimated` jest suites,
   root `prettier --check .` (438 files)

## In scope

### R1-A. Committed synthetic fixtures (reproducible clean-clone tests)

- Add one small synthetic fixture per adapter under a committed,
  clearly-separated path (e.g. `packages/<adapter>/tests/fixtures/`,
  each file header-marked `SYNTHETIC — not production, never publish`).
  Fixture sizes stay tiny (bytes, not megabytes).
- Rewire every adapter parser test to its fixture through the existing
  `quarantinePath` (or equivalent) option. Production default paths
  (`content/quarantine/**`) stay git-ignored and stay the production
  contract; tests must not reference them.
- Keep `content/quarantine/` git-ignored. Add an explicit assertion (or
  docs check) that quarantine artifacts are absent from git.
- `npm ci` from a clean clone followed by the unit suites must pass with
  no network beyond the registry.

### R1-B. Enforceable RLS tests (no string PASS/FAIL)

- Rewrite `supabase/tests/01_*.sql` through `04_*.sql` so every check is a
  real assertion: any violation raises `EXCEPTION` (aborts the run).
  String-returning `SELECT 'PASS'` checks are forbidden.
- Impersonate roles: `SET LOCAL ROLE anon` / `authenticated` (plus a
  synthetic second user via `auth.uid()` simulation where the harness
  allows) and assert: anonymous reads published fixtures only; anonymous
  cannot read drafts, private registry, or user tables; `User A` full
  CRUD on owned rows; `User A` denied on `User B` rows (select, insert,
  update, delete); forged `user_id` insert fails.
- Convert public projections to `WITH (security_invoker = true)` views
  (or document per-view why not, with owner sign-off) and add runtime
  verification: as `anon`, `SELECT` from each public view returns only
  published synthetic fixtures while direct table access is denied.
- Keep migrations additive (new migration files only; never edit applied
  ones). Document `supabase db reset` + test invocation in
  `docs/REGISTRY_MIGRATION_NOTES.md`.

### R1-C. Single root verify for backend and mobile

- Add one root command (extend root `package.json`, e.g. `verify:all`)
  that verifies backend packages AND the mobile app end-to-end:
  workspaces typecheck/lint/test, mobile `typecheck`, `lint`,
  `format:check`, `test`, plus Supabase SQL tests when docker is
  available (skip with explicit `SUPABASE_TESTS_SKIPPED` notice when not,
  never silent).
- Fix the 7 mobile TypeScript errors and 6 lint errors (all pre-existing
  in components/sheets/tests). No behavior change beyond what the type
  checker requires; each fix stays minimal and is listed in the handoff.
- Scope formatting: replace bare `prettier --check .` (438 files) with
  an explicit include list plus `.prettierignore` for generated output
  (`content/quarantine/`, `content/pilot/raw-responses/`, build dirs).
  The command must fail on any unformatted tracked source.
- Update `.github/workflows/ci.yml` so CI runs the same single command
  (mobile job folds into it or is removed with justification recorded).

### R1-D. Process reinstatement (no code)

- Plan amendment (owner-approved, `plan_version` bump): add an `R1`
  ledger row, set it the sole READY task, keep every later row BLOCKED.
- Controller resumes with fresh envelopes/leases; one task, one agent,
  no batching. Normative prose repair (garbled lines ~27-120) happens
  only as a reviewed diff inside this amendment, never silently.

## Out of scope

- New features, new content coverage, new adapters, new dependencies
  (use only pinned versions; any new dep needs separate owner approval).
- Approving, publishing, or installing any content; touching gate
  receipts (void stays void), eligibility (DENIED stays DENIED), or
  package-23 (INELIGIBLE stays INELIGIBLE).
- Fixing the 8 `react-native-reanimated` jest suites beyond documenting
  them: if they cannot pass headless, convert them to an explicit
  device-gated check with owner sign-off rather than silent skips.
- Rewriting controller-contract prose outside the narrow R1-D diff.

## Allowed changes

- `packages/*/tests/fixtures/**` (new, synthetic-only), adapter test
  files (fixture wiring only, no production-path changes).
- `supabase/migrations/*` (new files only), `supabase/tests/*.sql`
  (assertion rewrite), `supabase/config.toml` (only if the test harness
  requires it), `docs/REGISTRY_MIGRATION_NOTES.md`.
- Root `package.json` scripts, `.prettierignore` (new),
  `.github/workflows/ci.yml`, `apps/mobile` source files strictly
  limited to the 7 type-error and 6 lint-error fixes.
- `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md` (R1 amendment row +
  revision bump only, via controller).

## Forbidden changes

- No edits to `docs/receipts/gate-*-v1-*.json`, `gate-void-registry.json`,
  `content/pilot/eligibility-22.json`, `content/pilot/package-23.json`.
- No real network fetches in tests; no quarantine bytes committed; no
  production seeds; no `service_role` keys anywhere near the repo.
- No `--legacy-peer-deps`, no disabled RLS, no `SECURITY DEFINER`
  without a recorded justification, no skipped tests without a written,
  reviewed reason.
- No second state-management, navigation, database, or UI framework.

## Acceptance criteria

1. Gates C1/C2/D/D2/E1/E2 still VOID; eligibility still DENIED;
   package-23 still INELIGIBLE (verified by grep in CI or the verify
   command itself).
2. Clean clone: `npm ci` (root) + single verify command passes backend
   unit suites with zero network beyond the registry.
3. Every adapter suite runs against committed fixtures; deleting
   `content/quarantine/` changes no test outcome.
4. Every RLS test fails (non-zero exit) when its assertion is violated;
   verified by deliberate mutation (e.g. temporarily permissive policy
   must turn the suite red).
5. `anon`/`authenticated` impersonation, cross-user denial, and
   `security_invoker` public-view checks all pass against a rebuilt
   backend (`supabase db reset` where docker exists).
6. Mobile `tsc` and `expo lint` pass with zero errors and zero new
   suppressions; scoped `prettier --check` passes; `jest` executes all
   13 suites headless with zero import crashes (10 suites / 109 tests
   green, up from 5 runnable). The remaining 3 suites hold 10
   content-assertion mismatches that predate headless execution (they
   crashed at import under the old setup) and need product decisions
   per the triage in the R1 handoff — listed explicitly, never silently
   skipped. They gate the final green of `verify:all` until the owner
   resolves each item (fix app, fix test, or device-gate with sign-off).
7. Plan amendment merged: R1 row READY, later rows BLOCKED, revision
   bumped, one-task-at-a-time restated.

## Tests

- Unit: existing suites (must stay green) + fixture-wired adapter suites.
- Database: rewritten `supabase/tests/*.sql` via `supabase db test`
  (or documented `psql` invocation); mutation check per criterion 4.
- Negative: quarantine-absent run; unknown-rights publication attempt;
  cross-user access attempt.
- Commands (exact, from repo root unless noted):
  - `npm ci`
  - `npm run verify:all` (the new single command; name fixed at review)
  - `git diff --check`
  - `grep -R '"decision": "VOID"' docs/receipts/gate-*-v1-*.json`
  - `python3 -m json.tool` on every edited JSON file

## Commands

See Tests. Supabase-gated steps run only where `supabase` CLI + docker
exist; elsewhere they report `SUPABASE_TESTS_SKIPPED` with the reason
and the SQL still receives static review.

## Stop conditions

Stop and ask the owner if: a mobile type-error fix requires behavior or
scope change beyond the checker; RLS runtime cannot run anywhere
(no docker/CLI) and static review is insufficient; a new dependency,
permission, or schema-breaking change becomes necessary; any gate,
eligibility, or package file would need alteration; unrelated failures
make ownership unclear.

## Required handoff

Standard handoff (AGENTS.md) plus: fixture inventory with paths and
sizes; RLS assertion-to-requirement mapping (`docs/SECURITY.md:55-65`);
before/after error counts for typecheck/lint/jest; exact commands run
and their results; explicit list of checks not run (with reasons);
confirmation that no content was approved, published, or installed and
no gate file was modified.
