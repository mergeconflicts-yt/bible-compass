# Mobile UI Design Specification

> Transcription source: `png_out/IMG_4160.png` through `png_out/IMG_4189.png`, in numeric filename order.
> `IMG_4176` was not present in `png_out/` at transcription time and is therefore not included.
> This is a faithful transcription of the screenshot text. It does not approve Scripture text, translations,
> historical claims, illustrations, or licences. Those remain governed by `CONTENT_RIGHTS.md` and `CONTENT_GUIDELINES.md`.

## Document status

- **Product:** Context-aware Bible reader, working name only
- **Platforms:** iOS and Android from one Expo/React Native codebase
- **MVP content:** Nehemiah 2 complete vertical slice
- **Languages designed for:** English, Telugu and Tamil
- **Audience:** Readers who want to understand Scripture without feeling lost
- **Purpose:** This is the implementation contract for the MVP interface. It defines hierarchy, navigation, visual tokens, component behavior, responsive multilingual typography, accessibility and screen acceptance criteria.

This document does not approve Scripture text, translations, historical claims, illustrations or licences. Those remain governed by `CONTENT_RIGHTS.md` and `CONTENT_GUIDELINES.md`.

## 1. Experience goal

The product should feel like a calm, trustworthy Bible reader first and an educational tool second.

The interface must help a reader answer three questions without making Scripture feel like a textbook:

1. **Where am I?** — book, chapter, period and place
2. **What is happening?** — concise passage orientation
3. **Where can I go deeper?** — people, places, timeline and map

The visual hierarchy is always:

1. Scripture
2. Reading continuity
3. Immediate context
4. Optional exploration
5. Secondary utilities

Do not place historical facts, cards, controls or decorative artwork above Scripture in a way that makes them look more important than the biblical text.

### Product character

| Quality      | UI expression                                                      |
| ------------ | ------------------------------------------------------------------ |
| Calm         | Warm neutral canvas, limited color, generous line height           |
| Trustworthy  | Clear attribution, visible uncertainty, consistent hierarchy       |
| Welcoming    | Plain language, familiar navigation, no academic jargon by default |
| Exploratory  | Subtle anchors and maps that invite rather than interrupt          |
| Contemporary | Clean shapes and spacing without looking like a social-media app   |
| Multilingual | Native-script typography, no English-first layout assumptions      |

### Design principles

1. **Reading before features.** The chapter must remain pleasant if every context interaction is ignored.
2. **Progressive disclosure.** Show one sentence first; reveal detailed context only after user intent.
3. **Return without penalty.** Closing context, map, timeline or sharing must return to the same verse and focus position.
4. **One primary action per surface.** Secondary actions must not compete visually.
5. **Familiar, not derivative.** Daily verse sharing may use familiar conventions, but must have an original visual identity and must not imitate another app's layout or assets.
6. **Meaning is not color-only.** Labels, icons and text communicate selection, certainty and state.
7. **Language is a layout input.** Telugu and Tamil are tested during component development, not after the English interface is complete.

## 2. Information architecture and navigation

### Primary navigation

Use three bottom tabs:

| Tab   | Destination     | Purpose                                                     |
| ----- | --------------- | ----------------------------------------------------------- |
| Home  | `/(tabs)/home`  | Daily verse, continue reading and featured contextual entry |
| Bible | `/(tabs)/bible` | Book and chapter selection                                  |
| Saved | `/(tabs)/saved` | Bookmarks and recent reading                                |

**Reader is not a tab.** A passage is pushed from Home, Bible, Search, Saved or a deep link. The reader is a focused full-screen destination and hides the tab bar.

Search opens from a consistently placed search action on Home and Bible. Settings opens from the profile/preferences icon on Home and from the overflow menu in other root screens.

Flow:

- Home
  - Daily verse
    - Verse card composer
    - Passage reader
  - Bible -> Passage reader
  - Search -> Passage reader
  - Saved -> Passage reader
- Passage reader -> Context sheet -> Entity, timeline or map

### Navigation rules

- Back always returns to the prior surface and position.
- Opening and closing a sheet must not add duplicate history entries.
- A deep link to a passage opens the reader directly after resolving translation and availability.
- A deep link to a daily verse opens the daily screen; its primary action opens the surrounding passage.
- The current passage, translation and visible verse are part of reader state, not tab state.
- Preserve scroll and screen-reader focus when sheets close.
- On tablets, context may become a side panel; navigation meaning must remain identical.

### Tab bar specification

- Height: 64 dp plus bottom safe-area inset
- Icon: 24 dp
- Label: 11 sp, semibold
- Minimum target: 48 x 48 dp
- Active state: brand-colored icon and label plus a small top indicator
- Inactive state: muted icon and label
- Use text labels at all times; do not use icon-only tabs
- Use one approved outline icon family. Do not use emoji or miscellaneous Unicode symbols as product icons.

## 3. Visual system

### 3.1 Color tokens

- Use semantic tokens in components. Never reference raw palette values outside the theme definition.

#### Light theme

| Token                 | Value                    | Use                                        |
| --------------------- | ------------------------ | ------------------------------------------ |
| `color.canvas`        | `#F7F4EE`                | Main application background                |
| `color.surface`       | `#FFFCF7`                | Cards, sheets and raised reading surfaces  |
| `color.surfaceSubtle` | `#EFE9DD`                | Quiet grouped regions                      |
| `color.textPrimary`   | `#18242D`                | Primary UI text                            |
| `color.textSecondary` | `#59656E`                | Metadata and supporting text               |
| `color.textOnBrand`   | `#FFFFFF`                | Text on dark brand surfaces                |
| `color.brand`         | `#285C58`                | Primary actions and active navigation      |
| `color.brandPressed`  | `#1E4845`                | Pressed primary state                      |
| `color.accent`        | `#A86F28`                | Historical anchors and restrained emphasis |
| `color.accentSoft`    | `#F1E4CE`                | Context highlights                         |
| `color.border`        | `#DDD6CA`                | Dividers and card boundaries               |
| `color.focus`         | `#1D67D7`                | Keyboard/switch-control focus ring         |
| `color.success`       | `#2F6C4D`                | Confirmed success                          |
| `color.warning`       | `#8A5A17`                | Approximate or attention state             |
| `color.danger`        | `#B33A3A`                | Destructive/error state                    |
| `color.scrim`         | `rgba(15, 24, 30, 0.52)` | Modal background                           |

#### Dark theme

| Token                 | Value                 | Use                            |
| --------------------- | --------------------- | ------------------------------ |
| `color.canvas`        | `#101614`             | Main application background    |
| `color.surface`       | `#18201E`             | Cards and sheets               |
| `color.surfaceSubtle` | `#222C29`             | Quiet grouped regions          |
| `color.textPrimary`   | `#F3F0E8`             | Primary UI and Scripture text  |
| `color.textSecondary` | `#B9C1BC`             | Metadata                       |
| `color.textOnBrand`   | `#FFFFFF`             | Text on brand surfaces         |
| `color.brand`         | `#72AAA4`             | Primary interactive emphasis   |
| `color.brandPressed`  | `#8BBCB7`             | Pressed state                  |
| `color.accent`        | `#D6A65B`             | Historical anchors             |
| `color.accentSoft`    | `#392F21`             | Context highlights             |
| `color.border`        | `#34403C`             | Dividers and boundaries        |
| `color.focus`         | `#77A7FF`             | Focus ring                     |
| `color.success`       | `#78B993`             | Success                        |
| `color.warning`       | `#E2B766`             | Approximate or attention state |
| `color.danger`        | `#FF8E8E`             | Destructive/error state        |
| `color.scrim`         | `rgba(0, 0, 0, 0.64)` | Modal background               |

Requirements:

- Validate every text/background and control-state combination with an automated contrast test.
- Normal text must meet WCAG AA; large text and non-text controls must meet the applicable AA thresholds.
- Do not use the gold/accent color for small body text on the warm canvas without verified contrast.
- Scripture anchors use underline/background treatment plus accessibility semantics; color alone is insufficient.

### 3.2 Typography

#### Font families

| Content                         | English/Latin                        | Telugu            | Tamil            |
| ------------------------------- | ------------------------------------ | ----------------- | ---------------- |
| Interface                       | Inter or platform sans fallback      | Noto Sans Telugu  | Noto Sans Tamil  |
| Scripture and editorial reading | Source Serif 4                       | Noto Serif Telugu | Noto Serif Tamil |
| Verse-card export               | Same script-appropriate reading font | Noto Serif Telugu | Noto Serif Tamil |

Bundle only approved weights used by the app. Until fonts finish loading, keep the splash/loading surface visible or use a dimension-compatible fallback; do not let the reader visibly reflow after the user begins reading.

The app-interface locale chooses interface fonts. The selected Bible translation chooses Scripture fonts. Mixed-script entity names must render with script-appropriate fallback fonts per text run.

#### Type scale

| Style token      | Size / line height | Weight | Use                                      |
| ---------------- | ------------------ | ------ | ---------------------------------------- |
| `display`        | 36 / 43 sp         | 700    | Rare Home greeting or campaign title     |
| `title1`         | 30 / 38 sp         | 700    | Passage and major screen title           |
| `title2`         | 24 / 31 sp         | 700    | Sheet title and major card heading       |
| `title3`         | 20 / 27 sp         | 600    | Section heading                          |
| `body`           | 16 / 24 sp         | 400    | Interface body text                      |
| `bodyStrong`     | 16 / 24 sp         | 600    | Emphasized interface text                |
| `metadata`       | 13 / 18 sp         | 500    | Translation, dates and supportive labels |
| `label`          | 14 / 20 sp         | 600    | Buttons and controls                     |
| `caption`        | 12 / 17 sp         | 500    | Attribution and compact metadata         |
| `scripture`      | 20 / 32 sp         | 400    | English Scripture default                |
| `scriptureIndic` | 20 / 36 sp         | 400    | Telugu and Tamil Scripture default       |
| `verseNumber`    | 12 / 18 sp         | 600    | Verse number                             |

Typography rules:

- Scripture size is user-adjustable from 17–30 sp before OS-level scaling.
- Telugu and Tamil require at least 1.7 line-height at the default size and must be tested for vowel signs, conjuncts and clipping.
- Never apply uppercase transformation or forced letter spacing to Telugu or Tamil.
- English eyebrow labels may use sentence case with modest tracking; avoid all-caps as the default.
- Do not truncate Scripture, references, entity names or context headings.
- Allow interface text to wrap to at least two lines. Critical controls expand vertically rather than ellipsizing.
- Respect the platform text-size setting up to 200 percent. At large sizes, grids become vertical lists.

### 3.3 Spacing, size and shape

Use a 4 dp base grid.

| Token      | Value |
| ---------- | ----- |
| `space.1`  | 4 dp  |
| `space.2`  | 8 dp  |
| `space.3`  | 12 dp |
| `space.4`  | 16 dp |
| `space.5`  | 20 dp |
| `space.6`  | 24 dp |
| `space.8`  | 32 dp |
| `space.10` | 40 dp |
| `space.12` | 48 dp |

- Phone horizontal page padding: 20 dp; compact phones: 16 dp
- Maximum reading-column width: 680 dp
- Maximum general-content width: 760 dp
- Card padding: 16 or 20 dp
- Minimum interactive target: 48 x 48 dp
- Inline Scripture anchors need at least 44 dp effective touch height through hit slop without changing line layout
- Standard card radius: 16 dp
- Prominent card/sheet radius: 24 dp
- Button radius: 14 dp
- Chip radius: full pill or 12 dp; do not mix both within one component family
- Dividers: 1 physical pixel where possible
- Shadows: one restrained elevation level for floating surfaces only; borders separate normal cards

### 3.4 Iconography

- Recommended family: Lucide React Native, subject to dependency approval in Phase 2.
- Use 2 dp optical stroke at 24 dp.
- Pair unfamiliar icons with text.
- Mirror directional icons in right-to-left locales if those are introduced later.
- Decorative religious symbols are not navigation icons.
- Do not depict biblical people with invented portrait imagery in the MVP. Use initials, neutral symbols or approved illustrations clearly labelled as artistic representations.

### 3.5 Motion and feedback

- Standard transition: 180–240 ms, ease-out
- Sheet entry: translate and fade; no spring overshoot
- Button press: opacity/color change; scale no lower than 0.98
- Respect reduced motion by removing translation and cross-fading instead
- Use skeletons only when structure is known and load exceeds 300 ms
- Use a progress indicator for downloads and image export
- Success toasts persist long enough to read and are announced to assistive technology
- Never use motion to imply historical certainty or importance

## 4. Responsive behavior

### Breakpoints

| Layout                   | Width        | Behavior                                                           |
| ------------------------ | ------------ | ------------------------------------------------------------------ |
| Compact phone            | `< 360 dp`   | 16 dp margins, actions stack, compact card artwork                 |
| Standard phone           | `360–599 dp` | Default single-column layout                                       |
| Large phone/small tablet | `600–839 dp` | Centered content; some two-column sections                         |
| Tablet                   | `>= 840 dp`  | Max-width reader; context sheet may become a 360–420 dp side panel |

Do not use device names to choose layouts. Use available width, safe areas and text scale.

### Orientation

- Reading works in portrait and landscape.
- The Verse Card Composer can show controls beside the preview on tablet/landscape.
- Maps may use landscape effectively but cannot require it.
- Never reset the current verse, composer choices or open context when orientation changes.

## 5. Core component contracts

Every reusable component must support light/dark mode, English/Telugu/Tamil sample content, dynamic text, screen readers, disabled state and test identifiers only where necessary.

### AppHeader

Variants:

- Root: title plus optional profile/overflow action
- Pushed: back, title, optional subtitle and actions
- Reader: back, tappable passage title, translation indicator and overflow

Rules:

- Respect top safe area.
- Do not place more than two trailing actions.
- The title may wrap on large text; actions remain reachable.

### Button

Variants:

- Primary: filled brand
- Secondary: bordered surface
- Tertiary: text/icon only
- Destructive: danger treatment and confirmation where required

States: default, pressed, focused, disabled, loading and success when the action benefits from confirmation.

Rules:

- Height: minimum 48 dp
- Loading preserves width and label context
- Icon-only buttons require an accessible name and 48 dp target
- Avoid two adjacent filled primary buttons

### Card

Variants:

- Content card: border, surface, no elevation
- Interactive card: visible pressed/focus state and accessibility role
- Feature card: controlled art/color with content-safe region
- Notice card: semantic icon, heading and text

A whole card is clickable only when it has one destination. If it contains multiple actions, only the explicit controls are clickable.

### ContextChip

Used for Who, Where, When, What, Before and Stakes.

- Minimum height: 48 dp
- On standard text: horizontally scrollable row of labelled chips
- At large text or narrow width: vertical list or two-column grid when labels fit without truncation
- Include text labels; icons are optional
- Selected state is used only inside a multi-panel context surface, not in the reader shortcut row

### TranslationBadge

- Shows short translation name such as BSB or IRV
- Opens translation information, attribution and language options
- Must appear wherever Scripture could otherwise be ambiguous
- Must not imply the app owns the translation

### ScriptureVerse

Structure:

- Stable verse container
- Verse number in a separate accessible element
- Scripture text in the translation's reading font
- Optional validated inline anchors
- Optional selection/bookmark state

Rules:

- A screen reader reads “Verse 4” followed by its complete text.
- Do not split text into a separate pressable element for every word.
- Anchors must be visually subtle and provide a larger invisible hit area.
- Long-press selection and anchor tap need separate tested gestures.
- Paragraph and poetry structure from the source is preserved; do not render every verse as a visually separate card.

### ContextAnchor

A compact passage-level block directly below the reader header:

- First line: date/period and place, for example `445 BC · Persian Empire`
- Second line: brief relative orientation, for example `After the exile · Before Jesus`
- Tap destination: full passage context
- Optional trailing chevron

If date or place is uncertain, include visible wording such as `about`, `probable` or `disputed` rather than only an icon.

### AdaptiveContextSurface

- Phone: modal bottom sheet, 92 percent maximum height
- Tablet: right-side panel where space allows
- Drag handle is supplementary; always provide an accessible Close button
- Sheet title remains visible when content scrolls
- Escape closes on supported keyboards
- Background cannot receive focus while modal
- Closing restores the triggering control and reader position

### StateView

Variants: loading, empty, error, offline, unavailable and unsupported.

Every state defines:

- Plain-language title
- Short explanation
- Primary recovery action when available
- Secondary safe route when recovery is unavailable
- Accessible announcement behavior

Do not show an empty blank region or endless spinner.

## 6. Screen specifications

### 6.1 Home

**Goal:** Start the daily habit and resume reading without decision fatigue.

Order:

1. Compact header: greeting or app name, profile/settings action
2. Verse of the Day feature card
3. Explicit actions: `Read in context`, `Share`, `Download`
4. Continue Reading card
5. Optional supported-content discovery row

The daily card is the most visually prominent object. Continue Reading is the strongest non-daily action.

#### Daily card

- Recommended phone aspect ratio: 4:5 within the Home feed, capped so its actions remain discoverable without excessive scrolling
- Verse, reference and translation remain inside the artwork
- Share and Download are explicit controls below the artwork
- `Read in context` is the filled primary action
- Tapping artwork opens the full Daily Verse screen; it does not immediately share
- If image sharing is forbidden by translation rights, hide Share/Download and explain availability in translation information

#### Continue Reading

- Book and chapter
- Last visible verse or `Start chapter`
- Translation badge
- One restrained context label, not a miniature timeline
- Entire card opens the passage; bookmark/options remain separate controls

States:

- First launch: replace Continue Reading with `Start reading Nehemiah 2`
- Offline with cached data: no warning banner unless an unavailable action is attempted
- Daily content unavailable: deterministic fallback plus a non-blocking freshness note
- Loading: show cached layout immediately when valid cache exists

Acceptance criteria:

- Daily verse, reference, translation and three actions are unambiguous.
- A new user can reach Scripture in one tap.
- At 200 percent text scale, content order remains intact and actions stack.
- Telugu and Tamil samples do not clip or overlap artwork.

### 6.2 Bible browser

**Goal:** Open a book and chapter with minimal friction.

Structure:

1. Header: `Bible`, translation badge, search action
2. Testament segmented control or filter
3. Book list grouped by testament/category
4. Selecting a book reveals a chapter grid on a new pushed screen or adaptive panel

Rules:

- Use localized book names with optional English name only in translation settings or search clarification.
- Chapter targets are at least 48 x 48 dp.
- Remember the last testament and scroll position.
- Do not show unavailable context coverage as if the book is unavailable. Scripture availability and enhanced-context availability are separate.
- Mark downloaded books and context-supported passages with distinct, labelled indicators.

### 6.3 Passage reader

**Goal:** Read continuously with context close at hand but never forced.

Structure:

1. Reader header: Back, `Nehemiah 2`, translation badge, overflow
2. Expanded horizontal era rail, auto-centered on the current passage
3. Slim context anchor after the expanded rail scrolls away
4. Optional single-sentence `Story so far` block, collapsible after first exposure
5. Chapter title and translation attribution
6. Continuous structured Scripture
7. Floating `Understand` action above the bottom safe area

Do not show the primary tab bar. The full screen belongs to reading.

#### Horizontal era rail

- Show the expanded rail when the reader is at the top of a newly opened passage.
- Keep it approximately 80–110 dp high so the beginning of Scripture remains discoverable.
- Auto-center the rail on the current passage and show roughly four nearby meaningful landmarks.
- Permit horizontal touch scrolling without intercepting vertical reader scrolling.
- Use proportional spacing where it remains legible. Where compression is necessary, show a visible break marker; never imply that unequal time gaps are equal.
- Show the active historical period as a labelled band behind the event line.
- The expanded rail scrolls away naturally as the reader moves into Scripture.
- Once it leaves the viewport, show the slim sticky anchor: `445 BC · Persian period · Jerusalem`.
- Returning to the top restores the expanded rail. A manual collapse preference may persist for the current reading session only.
- Tapping either form opens the complete vertical timeline.
- Provide the same order and uncertainty information through an accessible text alternative.

#### Reader controls

- Tapping the title opens book/chapter selection.
- Tapping the translation badge opens translation selection and licence details.
- Overflow contains typography, theme, bookmark chapter and download status.
- `Understand` opens the passage overview with Who, Where, When, What, Before and Stakes.
- Timeline and Map are destinations inside the context overview, not permanent competing buttons over Scripture.
- The horizontal era rail and its collapsed anchor are the only persistent timeline entry points in the reader.
- Reader chrome may reduce on downward scroll and return on upward scroll, but this enhancement is deferred until the static experience is stable and accessible.

#### Inline anchors

- Use a fine accent underline and a very light accent background on the final 20 percent of glyph height.
- No more than the editorially approved useful anchors; do not highlight every named entity.
- Tapping opens a Verse Companion tied to that exact phrase and verse, not the generic reusable profile immediately.
- The Verse Companion shows the Scripture excerpt, `At this moment` explanation and an optional action to the reusable person/place profile.
- It also provides `Understand the whole passage` so readers can move from moment-level context to passage-level orientation.
- The reusable profile continues to show `In this passage` before general identity information.
- Verse Companions appear only after explicit user action in the MVP; they do not update automatically while scrolling.

Acceptance criteria:

- The first viewport is primarily Scripture or immediate passage orientation, not controls.
- Opening any context surface and returning preserves the visible verse within one verse.
- English, Telugu and Tamil render paragraph/poetry structure correctly.
- The reader remains usable offline and at the largest supported text size.

### 6.4 Passage context overview

**Goal:** Explain the passage in under one minute and provide paths to depth.

Phone presentation: bottom sheet. Tablet presentation: side panel.

Order:

1. `Understand Nehemiah 2`
2. Passage range and estimated reading time
3. Three tabs: Essential, History and Connections
4. Sources and review information

The popup uses progressive depth without leaving the passage:

| Tab         | Required contents                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Essential   | A 30-second story flow — Before this, Right now and What is at stake — followed by people in this passage |
| History     | When and where, political setting, cultural context, Timeline and Map actions                             |
| Connections | Reviewed prior, parallel and following Scripture connections                                              |

Open on Essential every time the popup is invoked for a newly opened passage. Preserve the selected tab while the same popup remains open. Tabs must use real accessibility tab semantics, expose selected state and remain usable at 200 percent text scale. If labels do not fit, the tab bar may scroll horizontally but labels may not be truncated.

The Essential tab intentionally starts with story comprehension. Present its three steps as one connected vertical flow rather than unrelated fact cards. `Right now` is the emphasized current step. People appear below as compact profile cards with neutral monograms or approved visuals. Selecting a person opens the reusable entity profile, with `In this passage` shown first.

- Do not add a generic six-column context row. Who, Where, When, What, Before and Stakes remain content fields in the data model, but the popup groups them into a clearer reader-facing narrative.

### 6.5 Entity profile

**Goal:** Answer “Why does this person/place matter here?” before giving encyclopedic detail.

Order:

1. Entity type, name and optional neutral approved visual
2. `In this passage`
3. Reusable short profile
4. Relevant relationships
5. Map/timeline action when available
6. Sources, certainty and reviewed date

Do not use fictional photorealistic portraits as factual depictions. If an illustration is used later, label it as an artistic representation.

### 6.6 Timeline

**Goal:** Place the passage within biblical history without implying false precision.

Phone design:

- Use a vertical timeline, not four tiny nodes spread horizontally.
- The current passage is highlighted with label and description.
- Earlier and later events remain visible in chronological order.
- Parallel world history appears in a separate `Elsewhere at this time` section.
- Approximate dates include `c. / about`; disputed chronologies include an explicit label and explanation.

Tablet may use a horizontal overview paired with a vertical event list.

Provide a text alternative that contains the same event order and certainty.

### 6.7 Historical map

**Goal:** Show relevant place relationships, not simulate a modern navigation map.

Structure:

1. Header and historical period
2. Reviewed static map
3. Labelled hotspots
4. Legend for accepted, probable and disputed
5. Ancient/modern comparison only when evidence and rights allow it
6. Text description and attribution

Rules:

- Do not request device location.
- Do not use unlabeled color alone for certainty.
- Pinch/zoom is optional for the first slice; accessible hotspot navigation is required.
- Provide `View as text` listing places and relationships.
- Maintain map label readability at 200 percent text through alternate text/list mode rather than scaling labels into collision.

### 6.8 Daily Verse

**Goal:** Offer a familiar daily verse experience and lead naturally to surrounding context.

Order:

1. Header with date and back action
2. Verse artwork
3. Share and Download secondary actions
4. `Read in context` primary action
5. `The moment` one-sentence explanation
6. Key people/place/time chips
7. Surrounding passage preview and reading-time estimate
8. Translation attribution and source information

The full daily screen is not a duplicate social card. It is a bridge from inspiration to contextual reading.

### 6.9 Verse Card Composer

**Goal:** Generate a polished image quickly without turning the MVP into a general design editor.

Structure:

1. Header with Close and `Verse card`
2. Live preview
3. Format selector: Status 9:16, Square 1:1, Portrait 4:5
4. Approved theme selector with visual thumbnails
5. Optional `Include context line` toggle only when reviewed copy fits
6. Download secondary action and Share primary action

MVP customization is intentionally limited. Users cannot upload photos, drag text, choose arbitrary colors or remove legally required attribution.

#### Export dimensions

| Format   | Output         | Primary use                      |
| -------- | -------------- | -------------------------------- |
| Status   | 1080 x 1920 px | WhatsApp Status and stories      |
| Square   | 1080 x 1080 px | WhatsApp groups and social posts |
| Portrait | 1080 x 1350 px | Social feeds                     |

#### Export safe regions

- Outer safe margin: 8 percent of the shorter edge
- Status format: keep essential content outside the top 250 px and bottom 300 px where social UI commonly overlays
- Translation attribution: at least 28 px at 1080 px output, adjusted upward for complex scripts
- App branding: visually smaller than reference and attribution
- Verse text must pass actual font measurement before capture
- If the verse does not fit at the minimum approved size, block export and offer a reviewed shorter selection when rights permit
- Preview and exported output must use the same layout engine and fonts

States:

- Preparing fonts/assets
- Ready
- Generating image with cancellable progress where practical
- Native share opened
- Saved successfully
- Permission required
- Export unavailable under translation rights
- Text cannot fit
- Recoverable generation error

### 6.10 Search

**Goal:** Reach a passage quickly even with partial or localized input.

Order:

1. Search field focused on entry
2. Reference interpretation result
3. Recent searches stored on-device only
4. Scripture results where licensed and downloaded
5. Entity/context results

Rules:

- Reference result appears before full-text results.
- Support localized and English book aliases for Telugu/Tamil users.
- Clearly label current translation and downloaded-only limitations.
- Never send private search strings to telemetry.
- Empty query shows recent references, not generic promotional content.

### 6.11 Saved

**Goal:** Return to intentional reading moments.

Use two top-level sections or tabs:

- Bookmarks
- Recent

Each row shows reference, short licensed excerpt when permitted, translation, saved/read date and offline state. Swipe actions must have equivalent visible menu actions.

### 6.12 Settings

Group settings in this order:

1. Bible translation and Scripture language
2. App language
3. Reading appearance
4. Downloads and storage
5. Daily reminder
6. Account and sync
7. Privacy
8. Translation licences and attributions
9. About and support

Keep app language and Bible translation independent. A user may use an English interface with Telugu Scripture or vice versa.

## 7. Multilingual implementation rules

English, Telugu and Tamil must be fixture languages in the component gallery from Phase 2.

### Required behavior

- All interface strings come from localization resources; no user-facing string is hard-coded in components.
- Use locale-aware book names, dates, numerals and plural rules.
- Store canonical book/passage identifiers independently of translated display names.
- Reserve at least 30 percent label expansion over the English baseline.
- Prefer flexible rows and content-driven height over fixed-height cards.
- Do not reduce font size merely because translated text is longer.
- Ensure Telugu combining marks and Tamil vowel signs are not clipped by line boxes, masks or view capture.
- Validate the exact export fonts on both operating systems before enabling sharing.
- Use reviewed human translations for production UI, context and share text. AI output may be a draft but cannot publish automatically.

### Test strings

The component gallery must include:

- Short and long book names in each language
- A long verse with punctuation and quotation marks
- Two-line and four-line buttons/headings at maximum text scale
- Mixed English/reference text with Telugu and Tamil
- Missing glyph detection fixture
- Long attribution and licence text

### Language selection

On first launch:

1. Default the app language to the device locale when supported.
2. Let the user change it without changing the Bible translation silently.
3. Recommend an available translation for that language, but require confirmation.
4. Explain translation download size and rights-dependent feature availability.

## 8. Accessibility contract

Accessibility is an exit gate, not a later polish phase.

### Required checks

- VoiceOver on a supported iPhone
- TalkBack on a supported Android phone
- 200 percent text scale
- Bold text/accessibility font where applicable
- Light and dark mode
- Reduce Motion
- Increased contrast where available
- Keyboard and switch-style focus traversal for key surfaces
- Color-vision simulation for certainty and selection indicators

### Semantics

- Headings expose correct heading roles.
- Cards with one destination expose button/link role and useful names.
- Verse numbers are included in the reading order without becoming separate noisy stops unless navigation mode requires them.
- Inline anchors announce their type, for example `King Artaxerxes, person, opens context`.
- Modal sheets announce their title, trap focus and return focus on close.
- Loading, error, download and export results use polite live announcements.
- Maps and timelines provide equivalent structured text, not merely an image description.

### Touch and gesture

- Every action has a minimum 48 dp target.
- Swipe, long press, drag and pinch interactions have a visible non-gesture alternative.
- Destructive actions are never gesture-only.

## 9. Content, trust and rights in the UI

- Show translation short name beside every daily verse, shared image and reader attribution.
- Make complete licence and source details reachable within two taps from Scripture.
- The sharing service checks machine-readable rights before presenting Share or Download.
- Historical and contextual claims may link to reviewed sources.
- Display certainty as text: `Approximate date`, `Probable location`, `Disputed identification`.
- Separate Scripture visually and semantically from commentary. Never render commentary in a style that could be mistaken for a Bible verse.
- Label prototype or unreviewed fixtures visibly outside production builds.
- Do not generate a missing contextual explanation at runtime with AI.

For HelloAO-imported translations, HelloAO is ingestion provenance, while the original translation/publisher licence remains the authority shown in legal metadata.

## 10. Loading, empty, offline and error behavior

| Situation                   | Required UI                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Cached passage exists       | Render immediately; revalidate quietly                                                     |
| No cache and loading        | Reader-shaped skeleton, then content or actionable error                                   |
| Offline with cached passage | Read normally; small offline indicator only when relevant                                  |
| Offline without passage     | Explain it is not downloaded; offer downloaded content                                     |
| Context missing             | Scripture remains available; say context is not available yet                              |
| Image right unavailable     | Disable/hide export with clear translation-specific explanation                            |
| Export fails                | Preserve composer state; Retry and Cancel                                                  |
| Download interrupted        | Preserve last healthy content; show resumable/retry state                                  |
| Search has no results       | Suggest reference format, translation and download coverage                                |
| Sync conflict               | Resolve by documented policy; do not show a technical modal unless user action is required |

Avoid persistent full-width banners. Use banners only when a condition changes what the user can safely do.

## 11. Analytics hooks for design validation

The UI may emit only approved, typed events. Never include verse text, search text, user notes, contact/recipient information or tokens.

Minimum design events:

- `home_daily_opened`
- `home_continue_opened`
- `daily_read_context_selected`
- `daily_share_started`
- `daily_export_completed` with ratio/theme identifiers only
- `reader_context_opened` with context type identifier
- `reader_anchor_opened` with approved entity identifier
- `timeline_opened`
- `map_opened`
- `reader_position_restored` with coarse success/failure reason

Analytics are not allowed until the provider, schema, consent behavior and retention are approved under `PRODUCT_DECISIONS.md` and `SECURITY.md`.

## 12. Implementation sequence for an AI coding agent

The agent must implement this design in bounded tasks. Do not ask one agent to “build the UI” in a single pass.

### UI-1 Theme and fonts

1. Create semantic light/dark color tokens.
2. Add spacing, radius, typography and motion tokens.
3. Add locale-to-font-family selection.
4. Load approved font weights and prevent visible reader reflow.
5. Add token unit tests and contrast validation.

**Exit:** Tokens render correctly in three languages, two themes and three text sizes.

### UI-2 Primitive gallery

1. Implement Text, Screen, AppHeader and Divider.
2. Implement Button, IconButton, Card, Chip and TranslationBadge.
3. Implement StateView and accessible adaptive sheet.
4. Create an internal component gallery excluded from production navigation.
5. Populate every component with English, Telugu and Tamil fixtures.

**Exit:** All states pass component, accessibility and screenshot review on iOS and Android.

### UI-3 Navigation shell

1. Implement three root tabs: Home, Bible and Saved, with Search as a pushed route.
2. Add pushed routes from `ARCHITECTURE.md`.
3. Hide root tabs on focused reader/detail routes.
4. Verify back, deep-link and state-restoration behavior.

**Exit:** Every route can be reached and dismissed predictably without placeholder interactions that lie.

### UI-4 Home and browser

1. Implement Home content hierarchy.
2. Implement Verse of the Day card states.
3. Implement Continue Reading states.
4. Implement book and chapter browsing.
5. Connect only to repository interfaces or safe fixtures.

**Exit:** A first-time or returning user reaches Nehemiah 2 in one clear action.

### UI-5 Reader

1. Build structured chapter rendering.
2. Add reader header, translation badge and context anchor.
3. Add appearance and bookmark controls.
4. Implement validated inline anchors.
5. Persist and restore the visible verse vicinity.

**Exit:** Long-form reading is stable, accessible and visually correct in all three scripts.

### UI-6 Context, timeline and map

1. Implement context overview in the adaptive surface.
2. Implement entity profiles with `In this passage` first.
3. Implement vertical phone timeline and text alternative.
4. Implement reviewed static map, accessible hotspots and text alternative.
5. Restore reader scroll and focus after close.

**Exit:** Context helps without displacing the reading experience.

### UI-7 Daily verse and sharing

1. Implement full Daily Verse hierarchy.
2. Implement composer using the same VerseCard layout engine as export.
3. Add formats, approved themes and text-fit validation.
4. Enforce rights before exposing actions.
5. Test generated pixels and native sharing on physical iOS and Android devices.

**Exit:** All three formats export legibly in all three scripts with correct attribution.

### UI-8 Search, Saved and Settings

1. Implement reference-first search.
2. Implement bookmarks and recents.
3. Implement translation, app language, appearance and downloads settings.
4. Add privacy, rights and attribution surfaces.

**Exit:** Secondary journeys meet the same state and accessibility contract.

### UI-9 Visual QA and hardening

1. Capture the approved screen matrix.
2. Compare against tokens and component contracts.
3. Run automated accessibility and contrast checks.
4. Test with real Telugu/Tamil Scripture fixtures and reviewed UI strings.
5. Profile reader scrolling, font loading and card export.
6. Fix root causes; do not add one-off screen styling.

**Exit:** The release screen matrix passes owner review on representative devices.

## 13. Required validation matrix

At minimum, capture and review:

| Dimension          | Required cases                                                         |
| ------------------ | ---------------------------------------------------------------------- |
| Platform           | Current supported iOS, current supported Android                       |
| Device             | Small phone, standard phone, lower-performance Android, tablet         |
| Theme              | Light, dark                                                            |
| UI language        | English, Telugu, Tamil                                                 |
| Scripture language | English, Telugu, Tamil, including mixed UI/Scripture choices           |
| Text scale         | 100%, 150%, 200%                                                       |
| Network            | Online, slow, offline cached, offline uncached                         |
| Content            | Short verse, long verse, poetry, missing context, uncertain date/place |
| Rights             | Share allowed, share forbidden, attribution required                   |
| Input              | Touch, screen reader, hardware keyboard where supported                |

## 14. Design acceptance checklist

### Hierarchy

- [ ] Home prioritizes Daily Verse, Read in Context and Continue Reading.
- [ ] Reader is full-screen and not a permanent tab.
- [ ] Scripture is visually dominant over commentary and controls.
- [ ] Each screen has one obvious primary action.
- [ ] Context starts concise and expands on demand.

### Consistency

- [ ] All colors, spacing, type, radii and motion use tokens.
- [ ] One icon family is used; emoji are absent from product controls.
- [ ] Cards and buttons use documented variants rather than screen-specific copies.
- [ ] Loading, empty, error, offline and unavailable states are implemented.

### Multilingual

- [ ] English, Telugu and Tamil fixtures pass every major screen.
- [ ] Indic glyphs are not clipped in the reader or exported images.
- [ ] Labels wrap instead of shrinking or truncating.
- [ ] App language and Scripture translation can differ.
- [ ] Production translations are human-reviewed.

### Accessibility

- [ ] Touch targets are at least 48 dp.
- [ ] Text and controls pass contrast validation.
- [ ] VoiceOver and TalkBack flows are logical.
- [ ] 200 percent text scale remains usable.
- [ ] Reduced motion and dark mode work.
- [ ] Maps and timelines have equivalent text presentations.

### Trust and rights

- [ ] Translation is identifiable wherever Scripture appears.
- [ ] Licence and source information is reachable.
- [ ] Share/Download respects translation rights.
- [ ] Approximate and disputed claims are labelled in text.
- [ ] Commentary cannot be mistaken for Scripture.

### Continuity

- [ ] Closing context returns to the triggering verse and control.
- [ ] Orientation and theme changes do not lose position.
- [ ] Offline startup does not wait for a network timeout when valid cache exists.
- [ ] Export errors preserve composer choices.

## 15. Explicit redesign decisions from the HTML prototype

The existing HTML prototype proves the feature concept but is not the production UI specification. Apply these corrections during implementation:

| Prototype behavior                              | Production decision                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Home, Bible and Reader tabs                     | Home, Bible and Saved tabs; Search and Reader are pushed routes      |
| Emoji/Unicode navigation icons                  | One approved accessible vector icon family                           |
| Five tiny context buttons in one row            | Flexible chips/list inside a single Understand entry point           |
| Timeline as four compressed horizontal nodes    | Vertical phone timeline with descriptions and certainty              |
| Timeline, Context and Map sticky reader toolbar | One restrained Understand action; depth options inside context       |
| Generic Georgia/system typography               | Script-aware bundled reading and interface fonts                     |
| Fixed English-sized labels and cards            | Content-driven multilingual layout and 200% text support             |
| Reusable profile appears before passage meaning | `In this passage` appears first                                      |
| Decorative portrait placeholders                | Neutral approved visuals; no invented factual portraits              |
| Browser-only share fallback assumptions         | Native iOS/Android share, explicit media save and rights enforcement |
| Style values embedded per screen                | Semantic design tokens and reusable primitives                       |

## 16. Agent handoff contract

For every UI implementation task, the AI agent must report:

1. User-visible result
2. Screens and states changed
3. Tokens and reusable components added or modified
4. English, Telugu and Tamil fixtures tested
5. Accessibility checks performed
6. iOS and Android checks performed
7. Screenshot matrix produced
8. Tests and commands with results
9. Known deviations from this specification
10. Any new dependency, permission, right or owner decision required

If a proposed implementation conflicts with this document, `MVP_PRD.md`, `CONTENT_RIGHTS.md`, `ARCHITECTURE.md` or accessibility requirements, stop and ask the owner rather than silently choosing a new pattern.
