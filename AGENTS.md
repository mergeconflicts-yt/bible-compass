Al Engineering Instructions
Role
You are implementing a production cross-platform Bible context application. Protect architecture, content trust, privacy, accessibility and user data as first-class requirements.
Read before editing
Read the following before making changes:
1. docs/MVP_PRD.md
2. docs/PRODUCT_DECISIONS.md
3. docs/CONTENT_RIGHTS.md
4. docs/ARCHITECTURE.md
5. docs/DATA_MODEL.md
6. docs/SECURITY.md
7. docs/CONTENT_GUIDELINES.md
8. The active phase in docs/IMPLEMENTATION_PLAN.md
9. Relevant ADRs and existing tests
If these documents conflict, stop and ask the owner. Do not choose silently.
Execution contract
Before editing:
• Restate the requested outcome.
• Identify the files and contracts affected.
• State what is explicitly out of scope.
• State the tests and validation you will run.
• Inspect existing code and reuse current conventions.
While editing:
• Implement only the assigned task.
• Make the smallest complete, reviewable change.
• Keep routes and screens thin.
• Add or update tests with the implementation.
• Preserve existing behavior unless the task changes it explicitly.
• Fix root causes. Do not suppress type, lint or test errors.
At handoff, report:
1. User-visible outcome
2. Files changed
3. Commands executed and their results
4. Automated tests added or changed
5. Manual iOS and Android checks
6. Database migrations, permissions or configuration changes
7. Known limitations and follow-up work

Never claim completion when a required check was not run.
Architecture rules
• Use Expo, React Native and TypeScript for one shared mobile application.
• Use Expo Router with typed routes.
• Use Supabase as one modular backend: Postgres, Auth, Storage and narrow Edge Functions.
• Use SQLite for local content, reading state, bookmarks and the offline outbox.
• Screens and presentation components must not call Supabase, SQLite, notifications, file storage or telemetry directly.
• Domain code must not import React Native, Expo, Supabase, SQLite or Ul libraries.
• Infrastructure adapters implement repository interfaces defined by the domain or feature boundary.
• Use TanStack Query for remote server state.
• Use Zustand only for cross-screen ephemeral Ul state.
• Validate external data, persisted data and deep-link inputs with approved Zod schemas.
• Do not add a second state-management, navigation, database or Ul framework.
• Do not add a dependency unless the task authorizes it or the owner approves a written justification.
• Install Expo-compatible native dependencies with the command recommended by the pinned Expo SDK.
• Pin exact dependency versions and commit the lockfile.
Content rules
• Production Scripture and contextual content live in structured content packages or the content database, never in screen components.
• Do not invent or paraphrase Scripture as production text.
• Do not invent historical claims, theological claims, citations, licenses, map coordinates or certainty levels.
•Al may create drafts and validation fixtures. Al cannot approve or publish production content.
•Only records with approved editorial status and valid licensing may be published.
• Semantic passage relationships are translation-independent.
• Exact verse text and interactive character offsets are translation-specific.
• Validate an anchor's stored matched_text against the referenced verse substring before publishing.
•Dates and places must visibly preserve uncertainty where the evidence is approximate or disputed.
• Never enable image export or offline storage for a translation unless its rights record allows that exact use.
Security and privacy rules
•Never place a Supabase service-role key, signing secret, push credential or administrative token in the app bundle.
•The public Supabase client key is acceptable only with correct Row Level Security.
• Enable RLS on every client-accessible table.
• Test allowed and denied access, including cross-user denial.
• Do not disable RLS to make a feature work.
• Do not log sessions, tokens, user-generated notes, searches, selected Scripture text, contact data or share recipients.
• Do not add a device permission, analytics property or third-party SDK without approval and a privacy review.
• Anonymous users keep reading history and bookmarks on-device unless they explicitly enable account sync.
• Account creation is optional for the first MVP.

Quality rules
• TypeScript strict mode is mandatory.
• Do not use any, @ts-ignore, unchecked casts, empty catch blocks or skipped tests without a written, reviewed reason.
•Every async Ul state must handle loading, empty, unavailable, error, retry and offline behavior where applicable.
• Test accessibility labels, focus order, dynamic text, dark mode, reduced motion and touch targets.
• Device-dependent features require checks on iS and Android preview builds.
• Database changes require migrations and RLS tests. Do not rely on dashboard-only edits.
• Content changes require schema, license, citation, anchor and asset validation.
COr
Mandatory stop conditions
Stop and ask the owner if:
• The requirement conflicts with the PRD, security model, content policy or an ADR.
• A translation license or publication approval is missing.
• A new dependency, service, native module, permission, public API or schema-breaking change is needed.
•The task would change product scope or implement an excluded feature.
•Existing unrelated changes or failures make ownership unclear.
• Data must be deleted or migrated without a reviewed backup, rollback or forward-fix plan.
• Production credentials, store access or reviewer approval are required.
Features excluded from the first MVP
• Curated scenes and spiritual pathways
• Prayer requests, prayer audio and community feeds
• Public reflections, journals and user content
• An open-ended Al Bible teacher
• Church administration
• Subscriptions and paywalls
• Full-Bible contextual coverage
• A live historical map engine
• Complex gamification
Do not create speculative tables, services or screens for excluded features.
Task template
Every task must specify:
• Task
• User value
• Read first
• In scope
• Out of scope
• Allowed changes
• Forbidden changes
• Acceptance criteria
• Tests
• Commands
• Stop conditions
• Required handoff