# Canonical Identifier Decisions

## Status

The technical format is proposed. Final validation against the selected translation and canon is `OPEN`.

## Principles

- Identifiers are stable and independent of display language.
- Routes, APIs, SQLite, Postgres, analytics and tests use the same canonical key.
- Display labels may change without changing identifiers.
- Translation-specific text never defines semantic entity identity.

## Bible book identifiers

Use OSIS-style codes, subject to final canon validation.

Examples:

```
Neh
John
1Cor
```

Do not use localized book names as database keys.

## Verse coordinate

```
{book}.{chapter}.{verse}
```

Examples:

```
Neh.2.4
Neh.2.1
```

## Passage range

```
{start}-{end}
```

Example:

```
Neh.2.1-Neh.2.8
```

Single verse:

```
Neh.2.4
```

## URL encoding

Canonical application path:

```
/passage/Neh.2.1-Neh.2.8
```

Daily verse path:

```
/daily/2026-09-11
```

Entity path:

```
/entity/artaxerxes-i?passage=Neh.2.1-Neh.2.8
```

All deep-link input must be parsed and validated. Invalid values route to a safe not-found or unsupported screen.

## Database identifiers

- Use UUID primary keys for rows.
- Use immutable `canonical_key` or `slug` fields for public references.
- Never expose sequential internal database IDs in public links.

## Entity slugs

Rules:

- Lowercase ASCII
- Hyphen separated
- Stable after publication
- Disambiguate identities explicitly

Examples:

```
nehemiah-governor
artaxerxes-i
jerusalem
susa
persian-empire
cupbearer
```

If a published slug must change, retain a redirect or alias.

## Content versions

Every content package has:

```
schema_version
content_version
package_key
checksum
minimum_app_version
```

Example package key:

```
en.translation-code.nehemiah-2
```

Published content versions are immutable.

## Translation identifiers

Use a short stable code approved by the rights holder or an internal code that does not misrepresent ownership.

`OPEN` : final translation code and attribution.

## Locale identifiers

Use BCP 47 language tags. Launch locales: English, Telugu, Tamil.

```
en
te
ta
```

Region subtags (e.g. `te-IN`, `ta-IN`) are `OPEN` pending the launch-country decision.
`OPEN` : confirm final launch locale tags.

## Date and time

- Daily verse key: user's local calendar date in `YYYY-MM-DD`.
- Stored timestamps: UTC ISO 8601 / Postgres `timestamptz`.
- Timezone: IANA identifier.
- Ancient dates: structured bounds plus precision and display label; never force uncertain dates into a precise timestamp.

## Phase 0 decisions required

- Selected canon and handling of canon differences
- Selected translation code per launch language (English, Telugu, Tamil)
- Launch locales and region subtags
- Canonical web domain
- Permanent iOS bundle identifier
- Permanent Android application ID
- Final public product name and entity namespace
