# Scripture and Content Rights Register

## Status

`BLOCKED - TRANSLATION AND ASSET RIGHTS NOT YET PROVIDED`

Do not import production Scripture or enable production sharing or offline content until this file is completed with evidence.

## Selected translation

| Field | Value |
|---|---|
| Translation name | OPEN |
| Translation code | OPEN |
| Publisher or rights holder | OPEN |
| License contact | OPEN |
| Agreement or policy reference | OPEN |
| Effective date | OPEN |
| Expiry or review date | OPEN |
| Approved territories | OPEN |
| Approved languages | OPEN |
| Required attribution | OPEN |

## Permission matrix

Record explicit permission and evidence for every use.

| Use | Allowed | Conditions | Evidence |
|---|---|---|---|
| Mobile in-app display | OPEN | OPEN | OPEN |
| Full chapter display | OPEN | OPEN | OPEN |
| Verse of the Day | OPEN | OPEN | OPEN |
| Generated image | OPEN | OPEN | OPEN |
| Native social sharing | OPEN | OPEN | OPEN |
| Image download | OPEN | OPEN | OPEN |
| Offline storage | OPEN | OPEN | OPEN |
| Local search index | OPEN | OPEN | OPEN |
| Web fallback excerpt | OPEN | OPEN | OPEN |
| Deep-link preview metadata | OPEN | OPEN | OPEN |
| Audio playback | OUT OF SCOPE | Not required for first MVP | N/A |
| Future translation or simplification | OUT OF SCOPE | Requires separate permission | N/A |

## Enforcement requirements

The translation record must expose machine-readable flags:

```
display_allowed
offline_allowed
image_sharing_allowed
web_excerpt_allowed
```

The product must fail closed. Missing or unknown permission means the feature is disabled.

Required attribution must be rendered:

- In the passage reader
- On the full daily verse
- On exported verse cards where required
- On the web fallback where required
- In legal or acknowledgements screens where required

## Historical and map assets

| Asset or source | Owner | Permitted uses | Attribution | Evidence | Status |
|---|---|---|---|---|---|
| Nehemiah 2 historical map | OPEN | App, offline, share or web as applicable | OPEN | OPEN | OPEN |
| Background images for verse themes | OPEN | Generated cards and download | OPEN | OPEN | OPEN |
| Icons and fonts | OPEN | iOS, Android and exported images | OPEN | OPEN | OPEN |

## Contextual writing

Original contextual writing must be based on documented sources and reviewed. Do not copy protected commentary prose. Record sources as evidence for claims and write original summaries.

## Prohibited assumptions

- Public availability is not permission to redistribute.
- Permission to display is not permission to store offline.
- Permission to show a verse is not permission to generate downloadable images.
- Permission in one territory or language does not apply globally.
- Attribution alone does not create a license.
- A prototype using placeholder wording does not grant production rights.

## Approval

| Role | Name | Date | Decision |
|---|---|---|---|
| Product owner | OPEN | OPEN | OPEN |
| Rights or legal reviewer | OPEN | OPEN | OPEN |
| Content editor | OPEN | OPEN | OPEN |

## Exit gate

This gate passes only when every intended first-MVP use is explicitly allowed, evidence is retained, attribution text is final and the owner signs the matrix.
