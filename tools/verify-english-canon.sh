#!/bin/sh
# Whole-English canon gate: idempotent import + consolidated-entity proof.
# Runs tools/import-english-canon.py twice (second run must be a no-op) and
# then supabase/tests/11_english_canon_import_test.sql. Loud skip without a DB.
set -u

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"

fail_skip() {
  echo "$1"
  if [ "${REQUIRE_SUPABASE_TESTS:-0}" = "1" ]; then
    echo "FAIL: English canon database tests are required (REQUIRE_SUPABASE_TESTS=1) but no database is reachable"
    exit 1
  fi
  exit 0
}

if ! command -v psql >/dev/null 2>&1; then
  fail_skip "ENGLISH_CANON_SKIPPED: psql unavailable"
fi
if ! psql "$DB_URL" -c 'select 1' >/dev/null 2>&1; then
  fail_skip "ENGLISH_CANON_SKIPPED: no database at \$DATABASE_URL"
fi
if ! command -v python3 >/dev/null 2>&1; then
  fail_skip "ENGLISH_CANON_SKIPPED: python3 unavailable"
fi

echo "IMPORT tools/import-english-canon.py"
python3 tools/import-english-canon.py --database-url "$DB_URL" || exit 1

echo "REPLAY tools/import-english-canon.py (must be a no-op)"
REPLAY_OUTPUT="$(python3 tools/import-english-canon.py --database-url "$DB_URL")" || exit 1
echo "$REPLAY_OUTPUT"
case "$REPLAY_OUTPUT" in
  *"no-op"*) : ;;
  *) echo "FAIL: identical replay was not a no-op: $REPLAY_OUTPUT"; exit 1 ;;
esac

echo "RUN supabase/tests/11_english_canon_import_test.sql"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/11_english_canon_import_test.sql || exit 1

echo "RUN supabase/tests/12_upgrade_convergence_test.sql"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/12_upgrade_convergence_test.sql || exit 1

echo "ENGLISH-CANON-TESTS-PASS"
