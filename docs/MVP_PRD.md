# First MVP Product Requirements

## Purpose

Build a familiar Bible-reading application that helps readers understand where a passage fits without interrupting normal Scripture reading. A polished Verse of the Day and image-sharing loop brings users into the deeper contextual reader.

## Hypothesis

Readers will continue and understand Scripture better when the product removes contextual disorientation.

## First release corpus

Nehemiah 2 is the first complete production slice. It proves the architecture and experience before contextual coverage expands.

> **Status note (whole-Bible draft track).** A machine-generated *draft* whole-English curation track now exists under `content/curated/` (66 books, contract 2.0.0, `data_classification: synthetic_fixture`, `review_status: draft`). It is unreviewed and unpublished. Nehemiah 2 remains the only publishable corpus, and full-Bible contextual coverage is still excluded from the first MVP; the draft track proves the pipeline and must never be mistaken for approved content.

## Target user

`OPEN OWNER DECISION`

Candidate starting audiences:

- Christians who want to read but repeatedly feel lost
- New Christians without historical orientation
- Young adults who prefer concise visual explanations
- Returning readers who find conventional plans dry

The owner must select one primary audience for beta recruitment and product copy.

## Core user journeys

### Continue reading

The user resumes the previous book, chapter and visible verse vicinity with the selected typography and translation.

### Browse and open a passage

The user selects a Bible book and chapter or searches a canonical reference. The user reads a continuous chapter without being forced into a guided scene.

### Understand the passage

The passage exposes concise structured context:

- Who
- Where
- When
- What is happening
- What happened before
- What is at stake

Context is optional and must not replace or obscure Scripture.

### Explore an entity

The user taps a subtly marked person, place, role, empire, object or custom. The product shows:

1. A reusable canonical profile
2. An `In this passage` explanation
3. Relevant map, timeline or source information where available

Closing the context layer returns the user to the same reading position.

### Use timeline and map

The user opens a timeline centered on the current passage and a reviewed historical map. Approximate dates and uncertain locations are clearly labelled.

### Verse of the Day

The Home screen shows a polished daily verse card. The full daily view includes:

- Verse and reference
- Translation attribution
- One concise `The moment` explanation
- Date, place and key people where relevant
- Read the surrounding passage
- Share and Download

### Create and share a verse image

The user chooses an approved theme and one format:

- 9:16
- 1:1
- 4:5

The app exports a clean high-resolution image without phone UI, with required attribution and restrained branding. It opens the native share sheet or saves the image after explicit user action.

### Offline use

After supported content is available locally, the user can:

- Read it without a network connection
- View its previously downloaded context, timeline and map
- Search downloaded Scripture and supported entities
- Save bookmarks and reading progress
- Synchronize pending actions after reconnecting if signed in

### Optional account sync

The complete reader works without an account. An account is offered only for cross-device progress, bookmarks and preferences.

## Required screens

| Screen              | Required outcome                                                    |
| ------------------- | ------------------------------------------------------------------- |
| Home                | Daily verse, Continue reading and supported-content entry           |
| Bible browser       | Select book and chapter                                             |
| Passage reader      | Continuous Scripture, context anchor and inline anchors             |
| Daily verse         | Verse, The moment and surrounding passage action                    |
| Verse card composer | Theme, ratio, preview, Share and Download                           |
| Context drawer      | Who, Where, When, What, Before and Stakes                           |
| Entity profile      | Reusable profile and In this passage                                |
| Timeline            | Passage-centered historical orientation                             |
| Historical map      | Reviewed asset, hotspots, legend and uncertainty                    |
| Search              | Reference-first plus downloaded content search                      |
| Saved               | Bookmarks and recent reading                                        |
| Settings            | Translation, typography, offline, notification, privacy and account |

## Functional requirements

- Use stable canonical passage identifiers across routes, storage, analytics and APIs.
- Identify translation and required attribution wherever Scripture appears.
- Never enable a licensed use not allowed by the translation rights record.
- Preserve reading position when content refreshes or a context layer opens.
- Handle missing context without blocking Scripture.
- Provide loading, empty, error, retry, unsupported and offline states.
- Use local date and locale for the daily verse, with a deterministic fallback.
- Reject image export rather than shrinking a long verse below the approved readable size.
- Use HTTPS canonical links that open the app or a safe web fallback.
- Keep notification reminders opt-in and configurable.

## Accessibility requirements

- Support dynamic text within defined usable bounds.
- Provide VoiceOver and TalkBack labels and logical focus order.
- Meet appropriate text and control contrast.
- Support dark mode and reduced motion.
- Provide accessible descriptions for maps and visual timelines.
- Maintain practical touch targets on both platforms.
- Do not communicate certainty, selection or state by color alone.

## Non-functional requirements

| Area                | Starting MVP target                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Cold start          | Cached Home or Reader usable within 2.5 seconds at p75 on defined mid-range test devices |
| Cached passage open | Content visible within 500 ms at p75                                                     |
| Reader scrolling    | No sustained visible jank for the supported chapter at default and maximum text sizes    |
| Image export        | Successful within 4 seconds at p75 with recoverable failure                              |
| Offline startup     | Cached content does not wait for a network timeout                                       |
| Sync                | Retried mutations do not duplicate bookmarks or lose progress                            |
| Reliability         | At least 99.5 percent crash-free sessions during beta before wider rollout               |

## Success measures

- Daily verse views that select Read in context
- Users who continue into the surrounding passage
- Passage completion and return-to-continue behavior
- Context, entity, timeline and map interactions
- Comprehension in structured beta interviews
- Successful share and download operations
- Shared-link recipients who enter the contextual reader
- Offline journey and sync success rates

## Anti-metrics

Do not optimize in isolation for:

- Maximum time in the app
- Isolated verse consumption
- Anxiety-driven notification opens
- Sharing volume without contextual reading
- Streaks or public comparison

## Explicit exclusions

The first MVP does not contain scenes, pathways, prayer systems, community, public content, an AI teacher, subscriptions, church tools, full-Bible context or complex gamification.

## MVP release gate

The release candidate must complete every core journey on iOS and Android, work for anonymous users, preserve content licensing constraints, pass RLS denial tests, work offline after download and satisfy the release checklist in IMPLEMENTATION_PLAN.md.
