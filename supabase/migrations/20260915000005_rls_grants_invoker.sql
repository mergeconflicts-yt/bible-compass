-- Migration: 20260915000005_rls_grants_invoker
-- R1-B: least-privilege SELECT grants for published reads plus
-- security_invoker public views.
--
-- Design (fail-closed):
-- - Grants alone expose nothing: every table below stays RLS-enabled, and
--   the allow policies filter to published rows only. Draft, raw, review,
--   and quarantine data remain invisible to anon/authenticated.
-- - Views run with caller rights (security_invoker), so RLS — not view
--   ownership — decides. Without this, views would execute as the table
--   owner and bypass RLS entirely.
-- - Authenticated readers see at least what anonymous readers see; the
--   pre-existing anon-only allow policies are mirrored for authenticated
--   (applied migrations are never edited).

-- Schema usage is required before any table grant is usable. No table
-- access on private_registry is granted to anyone but the owner/service.
GRANT USAGE ON SCHEMA private_staging TO anon, authenticated;

-- Published-read tables backing the security_invoker public views.
GRANT SELECT ON private_staging.entities TO anon, authenticated;
GRANT SELECT ON private_staging.reference_entity_attestations TO anon, authenticated;
GRANT SELECT ON private_staging.translation_edition_verses TO anon, authenticated;
GRANT SELECT ON private_staging.translation_editions TO anon, authenticated;
GRANT SELECT ON private_staging.package_members TO anon, authenticated;
GRANT SELECT ON private_staging.package_manifests TO anon, authenticated;

-- Authenticated mirror of the published-only allow policies (anon variants
-- already exist from 20260915000004; applied migrations are not edited).
CREATE POLICY allow_authenticated_published_manifests ON private_staging.package_manifests
  FOR SELECT TO authenticated USING (published_at IS NOT NULL AND published_at <= now());

CREATE POLICY allow_authenticated_published_entities ON private_staging.entities
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM private_staging.package_members pm
      JOIN private_staging.package_manifests pkg ON pkg.id = pm.package_id
      WHERE pm.entity_id = entities.id
        AND pkg.published_at IS NOT NULL AND pkg.published_at <= now()
    )
  );

CREATE POLICY allow_authenticated_published_attestations ON private_staging.reference_entity_attestations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM private_staging.claims c
      JOIN private_staging.package_members pm ON pm.claim_id = c.id
      JOIN private_staging.package_manifests pkg ON pkg.id = pm.package_id
      WHERE c.id = reference_entity_attestations.claim_id
        AND pkg.published_at IS NOT NULL AND pkg.published_at <= now()
    )
  );

CREATE POLICY allow_authenticated_published_verses ON private_staging.translation_edition_verses
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM private_staging.translation_editions ed
      WHERE ed.id = translation_edition_verses.edition_id AND ed.status = 'published'
    )
  );

CREATE POLICY allow_authenticated_published_editions ON private_staging.translation_editions
  FOR SELECT TO authenticated USING (status = 'published');

CREATE POLICY allow_authenticated_published_members ON private_staging.package_members
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM private_staging.package_manifests pkg
      WHERE pkg.id = package_members.package_id
        AND pkg.published_at IS NOT NULL AND pkg.published_at <= now()
    )
  );

-- Public views execute with caller rights (Postgres 15+).
ALTER VIEW public_content.published_entities SET (security_invoker = true);
ALTER VIEW public_content.published_attestations SET (security_invoker = true);
ALTER VIEW public_content.published_verses SET (security_invoker = true);
