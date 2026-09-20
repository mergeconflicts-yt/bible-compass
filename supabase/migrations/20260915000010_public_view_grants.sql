-- Migration: 20260915000010_public_view_grants
-- Task: grant SELECT on the public_content published views to anon and
-- authenticated readers. Applied migrations are never edited.
--
-- Fail-closed: the views filter to published rows only and run with
-- security_invoker (migration 20260915000005), so underlying RLS policies
-- still decide row visibility. Draft, raw, review and quarantine data remain
-- invisible. No grants on private_staging are changed here.

grant select on public_content.published_entities to anon, authenticated;
grant select on public_content.published_attestations to anon, authenticated;
grant select on public_content.published_verses to anon, authenticated;

-- The published_entities view (and direct published-only entity reads) join
-- entities through package_members. Authenticated readers already have the
-- published-only members policy (migration 20260915000005); anon was missing
-- its mirror, so every anon published-entity read returned zero rows.
-- Mirrors allow_authenticated_published_members exactly.
create policy allow_anon_published_members on private_staging.package_members
  for select to anon using (
    exists (
      select 1 from private_staging.package_manifests pkg
      where pkg.id = package_members.package_id
        and pkg.published_at is not null and pkg.published_at <= now()
    )
  );
