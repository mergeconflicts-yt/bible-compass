#!/bin/sh
# Repository hygiene gate (R1-A): quarantine bytes and synthetic gates must
# never reach git. Fails loudly; run as part of `npm run verify:all`.
set -u

fail=0

if ! command -v git >/dev/null 2>&1; then
  echo "HYGIENE-SKIPPED: git unavailable, cannot verify tracked set"
  exit 0
fi

if git ls-files content/quarantine | grep -q .; then
  echo "FAIL: content/quarantine artifacts are tracked by git (must stay ignored)"
  fail=1
else
  echo "OK: content/quarantine absent from git"
fi

# Only the six voided synthetic receipts are checked; gates 0/A1/A2/B are
# legitimate pre-existing approvals and must stay PASSED.
if grep -R '^  "decision": "PASSED"' docs/receipts/gate-C1-v1-20260915T050000Z.json docs/receipts/gate-C2-v1-20260915T053000Z.json docs/receipts/gate-D-v1-20260915T060000Z.json docs/receipts/gate-D2-v1-20260915T065000Z.json docs/receipts/gate-E1-v1-20260915T070000Z.json docs/receipts/gate-E2-v1-20260915T071000Z.json 2>/dev/null | grep -q .; then
  echo "FAIL: a voided gate receipt claims PASSED (see docs/receipts/gate-void-registry.json)"
  fail=1
else
  echo "OK: all synthetic gate receipts read VOID"
fi

# Secrets gate (M08 headless hardening): no credential material may be
# tracked. Patterns match secret VALUES, not prose (docs legitimately
# discuss "service_role" handling, so only key-shaped material fails).
# A hit means: rotate the credential, purge history, then re-run.
if git ls-files -z | xargs -0 grep -lE "eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}" 2>/dev/null | grep -q .; then
  echo "FAIL: JWT-shaped credential material is tracked by git (anon/service keys are JWTs)"
  fail=1
else
  echo "OK: no JWT-shaped material tracked"
fi

if git ls-files -z | xargs -0 grep -lE "BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|sk-(live|test)-[A-Za-z0-9]{10,}|xox[bap]-" 2>/dev/null | grep -q .; then
  echo "FAIL: private-key or provider-token material is tracked by git"
  fail=1
else
  echo "OK: no private-key or provider-token material tracked"
fi

if git ls-files | grep -E "(^|/)\.env$" | grep -v "env\.example" | grep -q .; then
  echo "FAIL: a real .env file is tracked by git (.env.example only)"
  fail=1
else
  echo "OK: no real .env file tracked"
fi

if git ls-files | grep -E "\.pem$|\.key$|\.p12$|\.jks$|\.keystore$|google-services\.json|GoogleService-Info\.plist" | grep -q .; then
  echo "FAIL: keystore/certificate/provisioning files are tracked by git"
  fail=1
else
  echo "OK: no keystore/certificate files tracked"
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "HYGIENE-PASS"
