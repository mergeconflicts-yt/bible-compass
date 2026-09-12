# Mobile app (Expo, SDK 57)

Landing page (Home) of the context-aware Bible reader, built from
`docs/DESIGN_SPEC.md` §6.1 with the §3 token system.

## Status

Phase 0 is still OPEN (`docs/PRODUCT_DECISIONS.md`, `docs/CONTENT_RIGHTS.md`).
All on-screen wording is a clearly labeled **prototype fixture**
(`src/fixtures/home.ts`, World English Bible — Public Domain). Nothing here is
licensed production content, and no licensed text is imported.

## Run

Requires Node >= 22.13 (see `engines`).

```sh
cd apps/mobile
npm ci
npx expo start
```

Then open with Expo Go, an iOS simulator, or an Android emulator.
`npm run web` runs the web build.

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

- `app/(tabs)/home.tsx` — Home route (thin; wires router + Share sheet)
- `app/passage/[reference].tsx` — honest unavailable state until the UI-5
  reader slice; validates canonical refs (`Neh.2.4`, `Neh.2.1-Neh.2.8`)
- `src/components/` — Screen, AppText, Button, TranslationBadge, DailyCard,
  ContinueCard, StateView, HomeView (all token-driven, no raw values)
- `src/theme/tokens.ts` — color/spacing/type tokens from DESIGN_SPEC.md §3
- `src/lib/reference.ts` — canonical reference parser with typed errors
- `src/fixtures/home.ts` — prototype-only content (see Status above)
- `src/config.ts` — zod-validated public config (no secrets in the bundle)

## Deliberate follow-ups (not in this slice)

- Bundled reading/interface fonts (Inter, Source Serif 4, Noto Serif
  Telugu/Tamil) with splash-held loading — UI-1 theme task
- Bible + Saved tabs, reader, context/timeline/map — UI-4/5/6/8 tasks
- Settings/translation-info destinations; Download enabled only after
  translation rights are confirmed (product fails closed per CONTENT_RIGHTS.md)
- EAS project ID + preview/production builds on physical devices (Phase 12)
