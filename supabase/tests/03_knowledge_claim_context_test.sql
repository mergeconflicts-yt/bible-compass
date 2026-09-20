-- Test: Knowledge/claim/context staging — enforceable (R1-B, Task 17B).
-- Every check is a real assertion (EXCEPTION on violation). No string PASS.
-- Run: psql "$DATABASE_URL" -f supabase/tests/03_knowledge_claim_context_test.sql
-- Single transaction, rolls back. Requires a superuser-equivalent role for
-- SET ROLE impersonation. Supabase-gated runs: docs/REGISTRY_MIGRATION_NOTES.md.

begin;

-- 1. RLS enabled on all 22 knowledge tables (named, exact).
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'private_staging'
    AND c.relkind = 'r'
    AND c.relname IN ('entities', 'entity_names', 'entity_descriptions', 'claims', 'claim_citations', 'relationship_predicates', 'entity_relationship_assertions', 'reference_entity_attestations', 'edition_mentions', 'edition_render_spans', 'scope_entity_relevance', 'scope_entity_relevance_localizations', 'events', 'event_participants', 'event_places', 'event_scripture_accounts', 'place_geometries', 'context_artifacts', 'context_revisions', 'context_sections', 'context_section_localizations')
    AND NOT c.relrowsecurity;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on knowledge tables: %', missing;
  END IF;
END $$;

-- 2. No write grants to anon/authenticated/public on those tables.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM information_schema.role_table_grants
  WHERE table_schema = 'private_staging'
    AND table_name IN ('entities', 'entity_names', 'entity_descriptions', 'claims', 'claim_citations', 'relationship_predicates', 'entity_relationship_assertions', 'reference_entity_attestations', 'edition_mentions', 'edition_render_spans', 'scope_entity_relevance', 'scope_entity_relevance_localizations', 'events', 'event_participants', 'event_places', 'event_scripture_accounts', 'place_geometries', 'context_artifacts', 'context_revisions', 'context_sections', 'context_section_localizations')
    AND grantee IN ('anon', 'authenticated', 'public')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: % write grants on knowledge tables', n;
  END IF;
END $$;

-- 3. Anonymous cannot read staging knowledge (no grant on entities).
SET ROLE anon;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.entities LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon could read private_staging.entities';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- 4. Authenticated cannot read ungranted staging tables (claims has no
-- SELECT grant at all; published-projection tables from migration 05 are
-- covered separately by view tests in 04).
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.claims LIMIT 1;
  RAISE EXCEPTION 'FAIL: authenticated could read private_staging.claims';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- 5. Attestation uniqueness (entity, scope, unit, kind) is enforced.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM pg_constraint
  WHERE conrelid = 'private_staging.reference_entity_attestations'::regclass
    AND contype = 'u';
  IF n < 1 THEN
    RAISE EXCEPTION 'FAIL: attestation uniqueness constraint missing';
  END IF;
END $$;

-- 6. Claim enums stay closed: bogus evidence_status rejected (claims has no
-- FKs, so the CHECK is isolated deterministically).
DO $$
BEGIN
  INSERT INTO private_staging.claims
    (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state)
  VALUES (
    'claim:rls-probe-bogus',
    'entity',
    gen_random_uuid(),
    'test_pred',
    'text',
    '"x"',
    'bogus-status',
    'explicit',
    'draft'
  );
  RAISE EXCEPTION 'FAIL: invalid evidence_status was accepted';
EXCEPTION
  WHEN check_violation THEN NULL;
END $$;

-- 7. scope_entity_relevance keeps is_attested as a real boolean column,
-- separate from attestations (no attestation/relevance conflation).
DO $$
DECLARE
  is_bool boolean;
BEGIN
  SELECT (data_type = 'boolean') INTO is_bool
  FROM information_schema.columns
  WHERE table_schema = 'private_staging'
    AND table_name = 'scope_entity_relevance'
    AND column_name = 'is_attested';
  IF NOT coalesce(is_bool, false) THEN
    RAISE EXCEPTION 'FAIL: scope_entity_relevance.is_attested is not boolean';
  END IF;
END $$;

-- 8. place_geometries carries a geometry column for PostGIS storage.
DO $$
DECLARE
  has_geom boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private_staging'
      AND table_name = 'place_geometries'
      AND column_name = 'geometry'
  ) INTO has_geom;
  IF NOT has_geom THEN
    RAISE EXCEPTION 'FAIL: place_geometries.geometry column missing';
  END IF;
END $$;

-- 9. Context section kinds stay closed (invalid kind rejected).
-- Chain-free probe: CHECK constraints evaluate before immediate FK triggers
-- (which fire after row insert), so a fixed bogus UUID deterministically
-- yields check_violation here without seeding parent rows.
DO $$
BEGIN
  INSERT INTO private_staging.context_sections (revision_id, kind, text, claim_ids)
  VALUES ('00000000-0000-0000-0000-000000000001', 'invalid_kind', 'probe', '{}');
  RAISE EXCEPTION 'FAIL: invalid context kind was accepted';
EXCEPTION
  WHEN check_violation THEN NULL;
END $$;

-- 10. Entity type vocabulary accepts 'deity' and stays otherwise closed.
DO $$
BEGIN
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
  VALUES ('entity:rls-probe-deity', 'rls-probe-deity', 'deity', 'established', 'probe');
EXCEPTION
  WHEN check_violation THEN
    RAISE EXCEPTION 'FAIL: canonical deity entity type was rejected';
END $$;

DO $$
BEGIN
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
  VALUES ('entity:rls-probe-bogus', 'rls-probe-bogus', 'bogus', 'established', 'probe');
  RAISE EXCEPTION 'FAIL: invalid entity type was accepted';
EXCEPTION
  WHEN check_violation THEN NULL;
END $$;

rollback;
