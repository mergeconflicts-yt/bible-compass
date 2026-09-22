-- Test: upgrade convergence + publication safety for the whole-English import.
-- Findings 32, blocker 2, blocker 3. Runs after tools/import-english-canon.py
-- (verify-english-canon.sh runs test 11 first, then this). Single transaction,
-- rolls back.
--
-- Proves:
--   A. cross-revision ownership cleanup: a row owned by ANY English manifest
--      (e.g. a prior revision) is removed by the resync, while a row owned by
--      another package (NULL origin) survives (blocker 2);
--   B. a draft import cannot mutate an entity/claim that is a member of a
--      PUBLISHED package (blocker 3) — the same guard the importer's upsert
--      uses;
--   C. no orphan memberships and no duplicate natural keys.

begin;

-- 1. The English draft manifest exists and is the ownership anchor.
DO $$
DECLARE
  m uuid;
BEGIN
  SELECT id INTO m FROM private_staging.package_manifests WHERE key LIKE 'en.bsb.all@%';
  IF m IS NULL THEN
    RAISE EXCEPTION 'FAIL: English manifest missing; run the English import first';
  END IF;
END $$;

-- 2. Cross-revision cleanup: a row owned by a PRIOR English manifest is removed.
DO $$
DECLARE
  m_new uuid;
  m_old uuid;
  e uuid;
  s uuid;
  u uuid;
  n integer;
BEGIN
  SELECT id INTO m_new FROM private_staging.package_manifests WHERE key LIKE 'en.bsb.all@%' ORDER BY content_version DESC LIMIT 1;
  -- A synthetic prior-revision manifest (unpublished draft, no approval).
  INSERT INTO private_staging.package_manifests
    (key, locale, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at, rights_status)
    VALUES ('en.bsb.all@5:sha-deadbeef', 'en', '2.0.0', 5, 'sha256:' || repeat('d', 64), '0.0.0', NULL, NULL, 'unknown')
    ON CONFLICT (key) DO UPDATE SET content_version = excluded.content_version
    RETURNING id INTO m_old;

  SELECT a.entity_id, a.scope_id, a.reference_unit_id
    INTO e, s, u
    FROM private_staging.reference_entity_attestations a
    WHERE a.origin_package_id = m_new LIMIT 1;
  IF e IS NULL THEN
    RAISE EXCEPTION 'FAIL: no English-owned attestation found';
  END IF;

  -- A stale row owned by the PRIOR revision, plus a shared NULL-origin row.
  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state, origin_package_id)
    VALUES (e, s, u, 'topic', 'inferred', NULL, 'draft', m_old);
  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state, origin_package_id)
    VALUES (e, s, u, 'implied_referent', 'inferred', NULL, 'draft', NULL);

  -- Exactly the resync delete: every UNPUBLISHED English manifest, not only the
  -- newest. A published manifest's rows are immutable history and are spared.
  DELETE FROM private_staging.reference_entity_attestations
   WHERE origin_package_id IN (
     SELECT id FROM private_staging.package_manifests
     WHERE key LIKE 'en.bsb.all@%' AND published_at IS NULL
   );

  SELECT count(*) INTO n FROM private_staging.reference_entity_attestations
   WHERE entity_id = e AND scope_id = s AND reference_unit_id = u AND kind = 'topic';
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: prior-revision owned attestation survived resync (% rows)', n;
  END IF;
  SELECT count(*) INTO n FROM private_staging.reference_entity_attestations
   WHERE entity_id = e AND scope_id = s AND reference_unit_id = u
     AND kind = 'implied_referent' AND origin_package_id IS NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION 'FAIL: shared (NULL-origin) attestation was deleted (% rows)', n;
  END IF;
END $$;

-- 3. Published rows are immutable to a draft import: the importer's guard
--    (WHERE NOT EXISTS published membership) affects zero published rows.
DO $$
DECLARE
  appr uuid;
  pkg uuid;
  e_pub uuid;
  e_draft uuid;
  c_pub uuid;
  n integer;
BEGIN
  INSERT INTO private_staging.approval_records
    (subject_key, subject_digest, subject_revision, reviewer_id, reviewer_role, decision)
    VALUES ('en.bsb.probe@1:sha-aaaaaaa1', 'sha256:' || repeat('a', 64), 1, 'probe', 'editorial_reviewer', 'approved')
    RETURNING id INTO appr;
  INSERT INTO private_staging.package_manifests
    (key, locale, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at, rights_status)
    VALUES ('en.bsb.probe@1:sha-aaaaaaa1', 'en', '2.0.0', 1, 'sha256:' || repeat('a', 64), '0.0.0', appr, now() - interval '1 day', 'cleared')
    RETURNING id INTO pkg;

  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-published', 'probe-published', 'person', 'established', 'probe')
    RETURNING id INTO e_pub;
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-draft', 'probe-draft', 'person', 'established', 'probe')
    RETURNING id INTO e_draft;
  INSERT INTO private_staging.package_members (package_id, entity_id) VALUES (pkg, e_pub);

  INSERT INTO private_staging.claims
    (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state)
    VALUES ('claim:probe-published', 'entity', e_pub, 'probe', 'text', '"x"', 'established', 'explicit', 'published')
    RETURNING id INTO c_pub;
  INSERT INTO private_staging.package_members (package_id, claim_id) VALUES (pkg, c_pub);

  -- Guarded entity upsert: published row is skipped, draft row is updated.
  UPDATE private_staging.entities SET type = 'role', identification_status = 'proposed'
   WHERE id = e_pub
     AND NOT EXISTS (
       SELECT 1 FROM private_staging.package_members pm
       JOIN private_staging.package_manifests pk ON pk.id = pm.package_id
       WHERE pm.entity_id = entities.id AND pk.published_at IS NOT NULL AND pk.published_at <= now());
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: published entity was mutated (% rows)', n; END IF;

  UPDATE private_staging.entities SET type = 'role'
   WHERE id = e_draft
     AND NOT EXISTS (
       SELECT 1 FROM private_staging.package_members pm
       JOIN private_staging.package_manifests pk ON pk.id = pm.package_id
       WHERE pm.entity_id = entities.id AND pk.published_at IS NOT NULL AND pk.published_at <= now());
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: draft entity was not updatable (% rows)', n; END IF;

  -- Guarded claim upsert: published claim is skipped.
  UPDATE private_staging.claims SET review_state = 'draft'
   WHERE id = c_pub
     AND NOT EXISTS (
       SELECT 1 FROM private_staging.package_members pm
       JOIN private_staging.package_manifests pk ON pk.id = pm.package_id
       WHERE pm.claim_id = claims.id AND pk.published_at IS NOT NULL AND pk.published_at <= now());
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: published claim was reset to draft (% rows)', n; END IF;
END $$;

-- 4. No orphan memberships: every member resolves to a real row.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM private_staging.package_members pm
  LEFT JOIN private_staging.entities e ON e.id = pm.entity_id
  LEFT JOIN private_staging.claims c ON c.id = pm.claim_id
  LEFT JOIN private_staging.context_revisions cr ON cr.id = pm.context_revision_id
  WHERE (pm.entity_id IS NOT NULL AND e.id IS NULL)
     OR (pm.claim_id IS NOT NULL AND c.id IS NULL)
     OR (pm.context_revision_id IS NOT NULL AND cr.id IS NULL);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % orphan package memberships', n; END IF;
END $$;

-- 5. Natural uniqueness holds: no duplicate mention or citation rows.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT edition_id, verse_id, entity_id, quote, occurrence_ordinal
    FROM private_staging.edition_mentions
    WHERE entity_id IS NOT NULL
    GROUP BY 1, 2, 3, 4, 5 HAVING count(*) > 1
  ) d;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % duplicate edition mentions', n; END IF;

  SELECT count(*) INTO n FROM (
    SELECT claim_id, source_release_id, locator
    FROM private_staging.claim_citations
    GROUP BY 1, 2, 3 HAVING count(*) > 1
  ) d;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % duplicate claim citations', n; END IF;
END $$;

rollback;
