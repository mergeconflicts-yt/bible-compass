# First MVP Technical Architecture

## Decision

Build one Expo and React Native TypeScript client, one Supabase modular backend and one versioned reviewed-content pipeline. Use SQLite for resilient local behavior. Prove the complete Nehemiah 2 slice before expanding content coverage.

## Selected stack

| Area | Choice | Rule |
|---|---|---|
| Client | Current stable Expo SDK and React Native | Pin exact versions and commit the lockfile |
| Language | TypeScript strict mode | Avoid unsafe type escapes |
| Navigation | Expo Router with typed routes | Every shareable destination has a canonical route |
| Remote state | TanStack Query | Repositories own query keys and mapping |
| UI state | Zustand | Ephemeral cross-screen UI only |
| Validation | Zod | Validate imports, APIs, persistence and deep links |
| Backend | Supabase Postgres, Auth, Storage and Edge Functions | Use migrations and RLS |
| Offline | Expo SQLite | Versioned migrations, transactions and outbox |
| Session secrets | Expo SecureStore | Never log session material |
| Maps | Reviewed static SVG or raster assets with hotspots | Do not request device location |
| Verse images | View capture, native sharing and explicit media save | Enforce rights and safe regions |
| Tests | Jest, React Native Testing Library, database policy tests and Maestro | Test contracts and critical journeys |
| Delivery | EAS Build, Update and Submit with CI | Development, preview and production profiles |

Use the versions compatible with the Expo SDK selected when the repository is initialized. Do not hard-code a future SDK version in this document.

## System boundaries

### Mobile application

Owns:

- Presentation and navigation
- Validated local data
- Offline content and outbox
- Reading progress capture
- Device sharing, download, notifications and linking

Does not own:

- Content publication
- Authorization truth
- Administrative secrets
- Theological or historical approval

### Supabase backend

Owns:

- Published content source of truth
- User authentication and authorization
- Cross-device synchronization
- Asset distribution
- Scheduled daily publication and push dispatch
- Audit history and version metadata

### Content pipeline

Owns:

- Schema validation
- Translation rights metadata
- Sources and citations
- Review status and certainty
- Immutable content versions
- Checksums and asset manifests

AI may prepare candidates. Only an explicitly approved package may be published.

## Repository structure

```
apps/
  mobile/
    app/                     # Expo Router route files
    src/
      components/            # Shared visual primitives
      features/              # Product feature modules
      infrastructure/        # Supabase, SQLite and device adapters
packages/
  domain/                    # Pure TypeScript domain models and interfaces
  content-schema/            # Zod schemas for content and APIs
supabase/
  migrations/
  functions/
  tests/
content/
  nehemiah-2/
tests/
  maestro/
docs/
  adr/
```

Start with only the packages needed by an active task. Do not generate speculative abstractions.

## Dependency direction

```
Route -> Feature screen -> Use case -> Repository interface
                                    -> Domain model

Infrastructure adapter -> Repository interface
Infrastructure adapter -> Supabase, SQLite or Expo API
```

Rules:

- Routes may import feature public APIs and shared visual primitives.
- Features may import domain contracts and shared primitives.
- Features may not import another feature's internal files.
- Domain code imports no framework or infrastructure package.
- Infrastructure does not leak database row shapes into UI components.
- Screens never call Supabase or SQLite directly.

## Route map

| Route | Purpose |
|---|---|
| `/(tabs)/home` | Daily verse and Continue reading |
| `/(tabs)/bible` | Book and chapter browser |
| `/passage/[reference]` | Continuous reader |
| `/daily/[date]` | Full daily verse experience |
| `/share/[date]` | Verse card composer |
| `/entity/[slug]` | Reusable profile plus passage role |
| `/timeline/[passageId]` | Passage-centered timeline |
| `/map/[assetId]` | Reviewed historical map |
| `/search` | Reference and downloaded content search |
| `/(tabs)/saved` | Bookmarks and recents |
| `/settings` | User preferences, downloads, privacy and account |

## Feature module layout

A feature can contain:

```
feature/
  components/
  screens/
  hooks/
  queries.ts
  mappers.ts
  schemas.ts
  index.ts
  __tests__/
```

`index.ts` is the feature's public API. Do not import internal paths from another feature.

## State ownership

| State | Owner | Persistence |
|---|---|---|
| Published content | Query cache and content repository | SQLite by content version |
| Reading progress | Reading progress service | SQLite immediately; server if signed in |
| Bookmarks | Bookmark service and outbox | SQLite immediately; server if signed in |
| Auth session | Auth adapter | SecureStore |
| Typography | Preferences store | Local, optionally synchronized |
| Open context drawer | Local component or Zustand | Not persistent |
| Connectivity | Infrastructure service | Derived state |

## Reader architecture

- Render stable verse blocks rather than one giant text node.
- Store the last visible verse and a small relative offset, not only raw pixels.
- Preserve reading position during background refresh and context navigation.
- Validate translation-specific anchors against verse text before display.
- Use an accessible bottom sheet on phones and adaptive side panel on larger screens.
- Missing context must never block Scripture.

## Backend modules

- Content catalog
- Daily content
- Identity
- User library
- Asset distribution
- Operations and publication
- Allow-listed telemetry

Keep them inside one Postgres project for the MVP. Do not create microservices.

## Edge Function rule

Use an Edge Function only when:

- A server secret is required
- Rate limiting or idempotency must be enforced centrally
- A privileged operation spans protected tables
- Push dispatch or another trusted integration is required

Do not build a generic function wrapper around safe RLS-protected reads.

## Offline architecture

Local groups:

- Versioned content cache
- User preferences and progress
- Bookmarks
- Pending mutation outbox
- Synchronization cursors

Read path:

1. Return a valid local snapshot immediately.
2. Revalidate content version in the background when online.
3. Validate schema and checksum for changed content.
4. Install the new version in one transaction.
5. Keep the previous complete version if installation fails.

Write path:

1. Apply the user action locally.
2. Add an outbox mutation in the same transaction.
3. Send mutations with stable IDs when signed in and online.
4. Make server application idempotent.
5. Pull remote changes from a stored cursor.

## Conflict rules

- Bookmark additions and deletions use stable client IDs and deletion tombstones.
- Progress uses the latest credible client timestamp, with a near-simultaneous same-chapter preference for the furthest position.
- Preferences use field-level latest-write-wins where practical.
- Published content is replaced by immutable server versions.

## Architecture change process

Changing a selected framework, state owner, data boundary, route contract, public schema, security boundary or offline policy requires a new ADR and owner approval before implementation.
