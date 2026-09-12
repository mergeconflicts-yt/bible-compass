# First MVP Security and Privacy Requirements

## Security objectives

- Published content is readable only when its status, date, locale and license allow it.
- Draft and operational content is not exposed to mobile clients.
- Users can access only their own cloud bookmarks, progress, preferences and devices.
- Administrative credentials never enter the mobile bundle.
- Anonymous reading activity remains on the device.
- Logs and analytics do not capture sensitive text or identity unnecessarily.

## Trust boundaries

| Boundary | Trusted capabilities | Prohibited capabilities |
|---|---|---|
| Mobile app | Render, validate, cache and queue user actions | Publish content or hold admin credentials |
| Postgres and RLS | Enforce publication and ownership | Trust client-side button visibility |
| Edge Functions | Use server secrets and enforce idempotency | Act as an untyped proxy for every table |
| Import process | Validate and create approved content versions | Automatically approve AI output |
| CI and EAS | Build signed artifacts with scoped secrets | Print secrets or upload them into artifacts |

## Authentication

- Anonymous usage is the default.
- Ask for sign-in only when the user enables cross-device synchronization.
- Store sessions through the approved SecureStore-backed adapter.
- Handle token refresh, revocation, expiration, sign-out and account deletion.
- Never log access tokens, refresh tokens or authentication headers.
- If social login is added, confirm current Apple and Google platform requirements.

## Row Level Security

Enable RLS on every table accessible through the public API.

### Published content policy

Anonymous and authenticated clients may select content only when:

- Status is `published`
- `published_at` is not in the future
- Locale and territory constraints permit it
- The related translation is active
- The requested client behavior is allowed by the license record

Do not expose draft columns through public views.

## User ownership policy

For profiles, preferences, progress, bookmarks and devices:

`auth.uid() = user_id`

Apply ownership checks to select, insert, update and delete. Validate inserted ownership with `WITH CHECK`, not only visibility.

## Required policy tests

- Anonymous user can read published public content.
- Anonymous user cannot read drafts.
- Anonymous user cannot access user tables.
- User A can create, read, update and delete owned rows.
- User A cannot read or mutate User B rows.
- A forged `user_id` insert fails.
- A user cannot read push tokens through a general user endpoint.
- A public client cannot publish or approve content.

## Secrets

| Credential | Allowed location |
|---|---|
| Supabase URL and public client key | Typed public application configuration |
| Supabase service role | Server or CI secret store only |
| Push credentials | EAS or server secret store only |
| Sentry upload token | CI secret store only |
| Store signing credentials | EAS or platform-managed credential store |
| Licensed source credentials | Restricted import environment only |

The public Supabase client key is not an authorization mechanism. RLS is the authorization mechanism.

## Edge Function controls

- Validate request schema and authentication.
- Enforce an allow-listed operation.
- Use idempotency keys for retryable writes and push dispatch.
- Apply rate limits where abuse is possible.
- Return typed, minimal error responses.
- Never return administrative row shapes or secrets.
- Redact bodies and tokens from logs.

## Local data

- Auth sessions use SecureStore.
- SQLite may contain downloaded Scripture, context, bookmarks and progress.
- Do not claim general SQLite content is encrypted unless an approved encryption implementation is actually present.
- Account deletion must define whether local anonymous data remains, is offered for migration or is deleted.
- Provide a clear remove-download and clear-local-data action.

## Analytics policy

Allow only explicitly defined events and properties.

Never collect:

- Search query text
- Bookmark notes or private free text
- Selected or copied Scripture text
- Contact lists
- Share recipients
- Clipboard contents
- Auth tokens
- Precise location
- Prayer or journal data, which is outside the MVP

Use canonical content keys instead of raw text. Disable automatic screen or interaction capture unless reviewed and approved.

## Device permissions

- No location permission is needed for historical maps.
- Request notification permission only after the user enables reminders.
- Sharing a generated temporary file should not require photo-library permission.
- Request photo-library or media permission only when the user selects Download and the platform requires it.
- Remove unused permissions from both application manifests before release.

## Data retention

`OPEN OWNER DECISION`

Define retention for:

- Operational logs
- Raw product events
- Aggregated metrics
- Invalid push tokens
- Deleted account tombstones
- Database backups

Deletion and backup expiry must be documented before production launch.

## Privacy requirements

- Publish a privacy policy matching actual behavior and dependencies.
- Complete Apple App Privacy and Google Play Data Safety declarations from the final dependency and event inventory.
- Provide account deletion inside the app when accounts are offered.
- Provide an owner contact for privacy and support.
- Do not use reading behavior for advertising in the MVP.
- Do not upload anonymous reading history without explicit consent.

## Incident readiness

Before production:

- Record credential owners and recovery methods.
- Enable appropriate project audit records.
- Define who can pause publication, revoke keys and halt pushes.
- Test database restoration.
- Document content rollback and application update rollback.
- Define severity levels and a user-notification decision process.

## Release-blocking findings

- Missing or permissive RLS
- Service credentials in the app or source repository
- Unreviewed third-party data collection
- Undisclosed device permission
- Inability to delete an offered account
- Exposed draft or unlicensed content
- Sensitive data in logs or analytics
- Untested destructive migration
