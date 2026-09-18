#!/bin/sh
# Supabase RLS test gate (R1-B). Runs supabase/tests/*.sql against a local
# stack when one is reachable; otherwise prints an explicit skip notice with
# the manual invocation. Never silent. Run as part of `npm run verify:all`.
# Full rebuild gate (release): supabase start && supabase db reset, then this.
set -u

DB_URL="postgresql://postgres:postgres@localhost:54322/postgres"

if ! command -v psql >/dev/null 2>&1; then
  echo "SUPABASE_TESTS_SKIPPED: psql unavailable — run manually per docs/REGISTRY_MIGRATION_NOTES.md"
  exit 0
fi

if ! pg_isready -h localhost -p 54322 -q 2>/dev/null; then
  echo "SUPABASE_TESTS_SKIPPED: no local Postgres on localhost:54322 — run 'supabase start && supabase db reset' then rerun, per docs/REGISTRY_MIGRATION_NOTES.md"
  exit 0
fi

for f in supabase/tests/01_*.sql supabase/tests/02_*.sql supabase/tests/03_*.sql supabase/tests/04_*.sql supabase/tests/05_*.sql; do
  echo "RUN $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f" || exit 1
done
echo "SUPABASE-TESTS-PASS"
