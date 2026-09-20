-- Migration: 20260915000011_publication_rules
-- Task: complete the SECURITY.md published-content policy in the public views
-- and the RLS allow policies. Applied migrations are never edited.
--
-- Fail-closed design (what is enforced here):
-- - published_entities: package published_at set and not future; locale
--   en/te/ta; entity is a member of that package. Entities carry no
--   review_state, so package publication is the gate.
-- - published_attestations: same package gates PLUS the attestation itself
--   must have review_state = 'published' (SECURITY.md: status must allow it).
-- - published_verses: owning edition must have status = 'published'
--   (the translation-active gate the schema can express).
-- - P2 explicit columns: the views list client-safe columns only. Internal
--   surrogate ids, provenance text, created_at and any future private column
--   can never leak through SELECT * again.
-- - RLS allow policies mirror the view gates so direct reads and
--   security_invoker views agree (mismatches previously hid rows or, worse,
--   could expose them).
--
-- NOT enforceable with the current schema (recorded, not silently dropped):
-- licensing, territory and effective-date windows have no binding columns on
-- packages or editions (rights live in private_registry without a link), so
-- they cannot be enforced here. Adding that binding is a product schema
-- decision and must come with its own migration, RLS and tests.

-- ---------------------------------------------------------------------------
-- 1. Explicit client-safe public views (recreated: column lists change, so
-- CREATE OR REPLACE is not allowed; grants and security_invoker are re-applied
-- below because DROP removes them).
-- ---------------------------------------------------------------------------

drop view if exists public_content.published_entities;
create view public_content.published_entities as
select e.key, e.slug, e.type, e.identification_status
from private_staging.entities e
join private_staging.package_members pm on pm.entity_id = e.id
join private_staging.package_manifests pkg on pkg.id = pm.package_id
where pkg.published_at is not null
  and pkg.published_at <= now()
  and pkg.locale in ('en','te','ta');

drop view if exists public_content.published_attestations;
create view public_content.published_attestations as
select a.entity_id, a.scope_id, a.reference_unit_id, a.kind, a.explicitness, a.review_state
from private_staging.reference_entity_attestations a
join private_staging.package_members pm on pm.claim_id = a.claim_id
join private_staging.package_manifests pkg on pkg.id = pm.package_id
where pkg.published_at is not null
  and pkg.published_at <= now()
  and a.review_state = 'published';

drop view if exists public_content.published_verses;
create view public_content.published_verses as
select v.edition_id, v.reference_unit_id, v.book_id, v.chapter, v.verse_number, v.text, v.text_sha256
from private_staging.translation_edition_verses v
join private_staging.translation_editions ed on ed.id = v.edition_id
where ed.status = 'published';

alter view public_content.published_entities set (security_invoker = true);
alter view public_content.published_attestations set (security_invoker = true);
alter view public_content.published_verses set (security_invoker = true);

grant select on public_content.published_entities to anon, authenticated;
grant select on public_content.published_attestations to anon, authenticated;
grant select on public_content.published_verses to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. RLS allow policies aligned with the view gates.
-- ---------------------------------------------------------------------------

-- Attestations: require the row's own published review_state and a direct
-- package-membership link (the old EXISTS over claims could never match:
-- claims rows are deny_all for every client role).
drop policy if exists allow_anon_published_attestations on private_staging.reference_entity_attestations;
create policy allow_anon_published_attestations on private_staging.reference_entity_attestations
  for select to anon using (
    review_state = 'published'
    and exists (
      select 1 from private_staging.package_members pm
      join private_staging.package_manifests pkg on pkg.id = pm.package_id
      where pm.claim_id = reference_entity_attestations.claim_id
        and pkg.published_at is not null and pkg.published_at <= now()
    )
  );

drop policy if exists allow_authenticated_published_attestations on private_staging.reference_entity_attestations;
create policy allow_authenticated_published_attestations on private_staging.reference_entity_attestations
  for select to authenticated using (
    review_state = 'published'
    and exists (
      select 1 from private_staging.package_members pm
      join private_staging.package_manifests pkg on pkg.id = pm.package_id
      where pm.claim_id = reference_entity_attestations.claim_id
        and pkg.published_at is not null and pkg.published_at <= now()
    )
  );

-- translation_editions: anon mirror of the authenticated published-only
-- policy, so anon published_verses reads have a satisfiable chain.
drop policy if exists allow_anon_published_editions on private_staging.translation_editions;
create policy allow_anon_published_editions on private_staging.translation_editions
  for select to anon using (status = 'published');
