# Domain & Content-Schema Workspace — Exact Proposal for Gate A2 (Task 03)

**Status:** PROPOSAL — read-only, no install in this task. Exact versions must be listed in Gate A2 receipt; generic “add needed deps” is invalid per `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md:746-748`.

**Prerequisite:** `docs/DATA_MODEL.md:16` (§16) and `docs/CANONICAL_IDENTIFIERS.md:1`.

## 1. Root workspace change

Add to repo-root `package.json` (currently absent at root; `apps/mobile/package.json:1` only):

```json
{
  "private": true,
  "workspaces": ["apps/mobile", "packages/domain", "packages/content-schema"],
  "engines": {"node": ">=22.13"}
}
```

*No other root changes.* `apps/mobile` remains the Expo app; its `name: mobile` unchanged.

## 2. Existing `apps/mobile` pins — keep exact

From `apps/mobile/package.json:10-35`:

* `expo@~57.0.22`, `react@19.2.3`, `react-native@0.86.3`, `expo-router@~57.0.21`, `zod@3.23.8`, `typescript@~6.0.3`, `jest@~29.7.0`, `jest-expo@~57.0.0`, `eslint@^9.39.5`, `prettier@^3.9.6`
* `package-lock.json` must be committed after `npm install` → `npm ci` reproduces exact tree.

## 3. New package: `packages/domain`

* **Type:** pure TypeScript, `private:true`, no runtime deps.
* **Dev:** `typescript@~6.0.3` exact.
* **Structure:**
  ```
  packages/domain/
    src/index.ts          # public API
    src/canon.ts          # canon/refsys/work keys
    src/reference.ts      # VerseCoordinate/PassageReference types + typed errors
    src/entity.ts         # EntityType, identification_status enums
    src/claim.ts          # evidence_status, textual_basis, date/location precision
    tsconfig.json
  ```
* **Rule:** No `react-native`/`expo`/`supabase`/`sqlite` imports (`AGENTS.md:46`).

## 4. New package: `packages/content-schema`

* **Deps:** `zod@3.23.8` **exact** (no `^`), `typescript@~6.0.3` dev.
* **Structure:**
  ```
  packages/content-schema/
    src/schemas.ts        # Zod schemas for translation_editions, attestations, mentions, relevance, claims
    src/validators.ts     # deterministic validation entry points (unknown → denied)
    tests/                # fixture matrix (valid/invalid per rejection category)
    tsconfig.json
  ```
* **Rule:** `allowedOperations` defaults to `denied` when `unknown`; share-alike obligations union checked.

## 5. Scripts (root `package.json`)

```json
"scripts": {
  "typecheck": "tsc --noEmit --workspaces",
  "lint": "eslint .",
  "format:check": "prettier --check .",
  "test": "jest --workspaces",
  "verify": "npm run typecheck && npm run lint && npm run format:check && npm run test"
}
```

Covers mobile + new packages without regressing `apps/mobile` verify.

## 6. Alternative if owner rejects new deps

Reuse existing `zod@3.23.8` via `apps/mobile/src/lib/schemas` — no new `packages/*`, no new dependency. Still requires Gate A2 sign-off for that path.

## 7. Installation verification

After Gate A2 receipt lists *exact* paths above:

* `npm install` → `npm ci` → `npm run verify` must pass for `apps/mobile` + new packages.
* No `any`, `@ts-ignore`, unchecked casts, skipped tests (`AGENTS.md:78`).

## 8. Digests

* This proposal `docs/DOMAIN_WORKSPACE_PROPOSAL.md` sha256 `(computed on save)` — synthetic, not an install.
