#!/bin/sh
# Supabase RLS test gate (R1-B, finding 4). Runs supabase/tests/*.sql
# against a reachable database; otherwise prints an explicit skip notice
# with the manual invocation. Never silent. Run as part of `npm run verify:all`.
# Full rebuild gate (release): supabase start && supabase db reset, then this.
# CI enforcement: the CI job provisions Postgres, applies the bootstrap plus
# migrations, and sets REQUIRE_SUPABASE_TESTS=1 so a skip fails the build
# instead of passing it. Local runs without a database keep the loud skip.
set -u

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"

fail_skip() {
  echo "$1"
  if [ "${REQUIRE_SUPABASE_TESTS:-0}" = "1" ]; then
    echo "FAIL: database tests are required (REQUIRE_SUPABASE_TESTS=1) but no database is reachable"
    exit 1
  fi
  exit 0
}

if ! command -v psql >/dev/null 2>&1; then
  fail_skip "SUPABASE_TESTS_SKIPPED: psql unavailable — run manually per docs/REGISTRY_MIGRATION_NOTES.md"
fi

if ! psql "$DB_URL" -c 'select 1' >/dev/null 2>&1; then
  fail_skip "SUPABASE_TESTS_SKIPPED: no database at \$DATABASE_URL — run 'supabase start && supabase db reset' then rerun, per docs/REGISTRY_MIGRATION_NOTES.md"
fi

# Nehemiah 2 curation import (Task EN-03): idempotent, so this is safe on a
# database that already has it. Requires python3; skipped loudly otherwise.
if command -v python3 >/dev/null 2>&1 && [ -f tools/import-neh2.py ]; then
  echo "IMPORT tools/import-neh2.py"
  python3 tools/import-neh2.py --database-url "$DB_URL" || exit 1
else
  echo "IMPORT-SKIPPED: python3 or tools/import-neh2.py unavailable"
fi

for f in supabase/tests/01_*.sql supabase/tests/02_*.sql supabase/tests/03_*.sql supabase/tests/04_*.sql supabase/tests/05_*.sql supabase/tests/06_*.sql supabase/tests/07_*.sql supabase/tests/08_*.sql; do
  echo "RUN $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f" || exit 1
done
echo "SUPABASE-TESTS-PASS"
