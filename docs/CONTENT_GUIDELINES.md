# Content and Editorial Guidelines

## Core rule

The application presents reviewed knowledge. AI may assist with drafting, structuring, consistency checks and test data, but it is not the theological or historical authority and cannot publish content.

## Content layers

### Scripture

Licensed translation text with canonical coordinates, attribution and usage permissions.

### Reusable entity profile

A concise description of a person, place, empire, group, role, object, custom or term that remains broadly valid wherever the entity appears.

### Passage-specific context

An explanation of why the entity or fact matters at this moment in the passage.

The six required orientation fields are:

- Who
- Where
- When
- What
- Before
- Stakes

### Visual context

Reviewed timeline events, maps, routes, hotspots and accessible descriptions.

### Daily verse context

One concise `The moment` statement and a link to the surrounding passage.

## Writing standards

- Use clear international English suitable for non-native speakers.
- Explain unfamiliar terminology when first used.
- Keep the Scripture visually and structurally distinct from commentary.
- Prefer concrete facts and immediate relevance over long background essays.
- Avoid sensational, manipulative or certainty-inflating language.
- Avoid presenting one denominational interpretation as universal when responsible traditions differ materially.
- State uncertainty plainly without making the product unreadable.

## Reusable entity template

```
canonical_name: Artaxerxes I
type: person
short_description: "..."
extended_description: "..."
aliases: []
temporal_range: {}
confidence: high | medium | low
sources: []
review_status: draft | in_review | approved | published | retired
```

The short description should identify the entity, not retell one passage.

## Passage context template

```
passage: Neh.2.1-Neh.2.8
who: "..."
where: "..."
when: "..."
what: "..."
before: "..."
stakes: "..."
immediate_summary: "..."
entities:
  - entity: artaxerxes-i
    role_in_passage: "..."
sources: []
review_status: draft
```

## Source requirements

Every important historical, geographical, cultural, linguistic or interpretive claim must have a source record. A citation should record enough information for a reviewer to find the supporting material.

Preferred source categories:

- Licensed Bible translation and publisher documentation
- Peer-reviewed or academically responsible biblical reference works
- Reputable atlases and archaeological resources
- Primary historical sources used with appropriate scholarly framing
- Established language resources

Do not cite an AI response as a source.

## Certainty

Use structured confidence and human-readable qualification.

Examples:

- Exact or strongly established
- Approximate
- Traditional identification
- Proposed identification
- Disputed
- Unknown

Visual precision must not exceed evidence. A marker on a map is not permission to imply that a location is certain.

## Timeline rules

- Store date ranges and precision, not only a single display string.
- Label approximate or disputed dates.
- Keep parallel world-history events selective and relevant.
- Do not force chronologies from different scholarly traditions into artificial agreement.
- Explain relationships to the passage rather than presenting trivia.

## Map rules

- Use reviewed assets with explicit attribution and rights.
- Record time period, geographic scope, uncertainty and projection notes.
- Provide accessible descriptions.
- Use normalized hotspot coordinates so assets can scale.
- Distinguish ancient and modern names where reliable.
- Do not request user location for the MVP.

## Translation rights

Rights must be evaluated independently for:

- In-app display
- Offline storage
- Search indexing
- Audio
- Verse of the Day
- Image generation
- Social sharing
- Web excerpts
- Territories and languages

Do not infer one permission from another.

## Verse card rules

- Scripture, reference and required attribution are mandatory.
- Branding is restrained and must not cover Scripture.
- Text and background meet readability requirements.
- The exporter must reject content that cannot fit legibly.
- The default card is simple. Context is optional.
- Generated output contains no app controls or phone UI.
- User-selected backgrounds are not in the first MVP unless separately approved.

## AI usage

AI may:

- Convert reviewed material into structured drafts
- Identify missing required fields
- Check names, IDs, references and anchor consistency
- Propose plain-language alternatives for reviewer selection
- Create synthetic test fixtures clearly marked as non-production

AI may not:

- Invent Scripture text
- Invent citations or licensing permissions
- Approve a draft
- Publish content
- Resolve a disputed interpretation without disclosure
- Claim what God is personally telling a user
- Make authoritative medical, legal or financial claims

## Editorial workflow

1. Draft records with sources and rights metadata.
2. Run schema, canonical reference, anchor, citation and asset validation.
3. Conduct historical, biblical, language and copy review appropriate to the claim.
4. Mark an exact content package version approved.
5. Import into staging.
6. Review every affected screen and generated card.
7. Publish an immutable production version.
8. Correct through a new version with a change reason and audit trail.

## Required reviewer decisions

`OPEN OWNER DECISION`

- Primary theological and historical lens
- How denominational differences are labelled
- Reviewer qualifications
- Whether one or multiple reviewers are required by content type
- Source hierarchy
- Correction and dispute process
- Translation-review process for future locales
