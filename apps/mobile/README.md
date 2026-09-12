# Mobile app (Expo, SDK 57)

Landing page (Home) of the context-aware Bible reader, built from
`docs/DESIGN_SPEC.md` §6.1 with the §3 token system.

## Status

Phase 0 is still OPEN (`docs/PRODUCT_DECISIONS.md`, `docs/CONTENT_RIGHTS.md`).
Single-translation build on the Berean Standard Bible (owner decision
2026-09-12, berean.bible terms basis; formal sign-off pending). All
on-screen context wording is a clearly labeled **prototype fixture**.
No licensed text beyond the BSB slice is imported.

## Run

Requires Node >= 22.13 (see `engines`).

```sh
cd apps/mobile
npm ci
npx expo start
```

Then open with Expo Go, an iOS simulator, or an Android emulator.
`npm run web` runs the web build.

Regenerate bundled Scripture after any `bsb/` dataset change (from repo root):

```sh
python3 tools/build-bsb-assets.py
```

Sync the unreviewed context draft after editing it (from repo root):

```sh
python3 tools/sync-context-draft.py
```

## Checks

```sh
npm run typecheck   # strict tsc --noEmit
npm run lint        # expo lint (Expo SDK 57 flat config)
npm run format:check
npm test            # jest-expo + React Native Testing Library
npm run verify      # all of the above
```

CI (`.github/workflows/ci.yml`) runs `npm run verify` on pushes/PRs touching
`apps/mobile`.

## Structure

- `app/(tabs)/home|bible|search|saved|settings.tsx` — thin tab routes (Settings renders full-screen; the demo sheet-over-tab has no native equivalent)
- `app/daily/[date].tsx` — full daily verse experience with validated date keys
- `app/passage/[reference].tsx` — one chapter per screen for any bundled book; reviewed context only for Nehemiah 2
- `src/components/` — Screen, AppText, Button, IconButton, ArtworkCard, NavRow, Segmented, Sheet, TranslationBadge, StateView, `*View` presentational views (all token-driven, no raw values)
- `src/components/sheets/` — Composer, Context + ContextFlow, Timeline, Map (schematic), Companion, Entity, Options
- `src/theme/tokens.ts` — color/spacing/type tokens from DESIGN_SPEC.md §3
- `src/theme/ThemeProvider.tsx` — appearance override + reading text size (no new deps)
- `src/lib/reference.ts` — canonical reference parser with typed errors
- `src/lib/search.ts` — reference-first search visibility over the prototype index
- `src/lib/daily.ts` — local-date daily keys with validation
- `src/content/bsb.ts` — active translation record + bundled chapter loader (version identity lives here, never hardcoded)
- `src/content/books.ts` — generated 66-book registry (see `tools/build-bsb-assets.py`)
- `src/content/neh2Draft.ts` — typed access to the unreviewed Nehemiah 2
  AI draft (DRAFT labeling mandatory; approval needs named reviewers)
- `src/fixtures/home.ts` — prototype-only home content; verse text sourced from the loader
- `src/fixtures/demo.ts` — prototype-only context copy; verse strings sourced from the loader
- `src/config.ts` — zod-validated public config (no secrets in the bundle)

## Deliberate follow-ups (not in this slice)

- Bundled reading/interface fonts (Inter, Source Serif 4, Noto Serif
  Telugu/Tamil) with splash-held loading — UI-1 theme task
- `expo-linear-gradient` artwork + `react-native-svg` reviewed map assets
  (both need owner approval; no new dependency added here)
- Full-chapter licensed text beyond BSB, Telugu/Tamil translations, and
  CONTENT_RIGHTS sign-off (owner)
- Translation-info destinations; Download enabled only after
  translation rights are confirmed (product fails closed per CONTENT_RIGHTS.md)
- SQLite content cache to replace the 4.7MB bundled JSON (Phase 8; cold-start budget)
- EAS project ID + preview/production builds on physical devices (Phase 12)
