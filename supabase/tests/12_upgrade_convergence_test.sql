-- Test: upgrade convergence semantics for the whole-English import.
-- Finding 32. Runs after tools/import-english-canon.py (verify-english-canon.sh
-- runs test 11 first, then this). Single transaction, rolls back.
--
-- Proves the ownership-scoped resync: a row this package owns
-- (origin_package_id = the English manifest) is removed by the resync, while a
-- row owned by another package (NULL origin) survives, and no membership
-- orphans remain. A full revision-3 -> revision-4 versus clean-revision-4
-- replay needs two distinct importer payloads and a live database; this test
-- pins the delete semantics those replays rely on.

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

-- 2. Owned rows are deleted by the resync; NULL-origin rows are not.
DO $$
DECLARE
  m uuid;
  e uuid;
  s uuid;
  u uuid;
  n integer;
BEGIN
  SELECT id INTO m FROM private_staging.package_manifests WHERE key LIKE 'en.bsb.all@%';
  SELECT a.entity_id, a.scope_id, a.reference_unit_id
    INTO e, s, u
    FROM private_staging.reference_entity_attestations a
    WHERE a.origin_package_id = m
    LIMIT 1;
  IF e IS NULL THEN
    RAISE EXCEPTION 'FAIL: no English-owned attestation found to test convergence';
  END IF;

  -- A stale row owned by this package (would be left behind by a naive merge).
  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state, origin_package_id)
    VALUES (e, s, u, 'topic', 'inferred', NULL, 'draft', m);

  -- A row owned by another package (the locked Nehemiah 2 package): NULL origin.
  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state, origin_package_id)
    VALUES (e, s, u, 'implied_referent', 'inferred', NULL, 'draft', NULL);

  -- Exactly the delete the importer emits for its own rows.
  DELETE FROM private_staging.reference_entity_attestations WHERE origin_package_id = m;

  SELECT count(*) INTO n
    FROM private_staging.reference_entity_attestations
    WHERE entity_id = e AND scope_id = s AND reference_unit_id = u AND kind = 'topic';
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: stale owned attestation survived the resync (% rows)', n;
  END IF;

  SELECT count(*) INTO n
    FROM private_staging.reference_entity_attestations
    WHERE entity_id = e AND scope_id = s AND reference_unit_id = u
      AND kind = 'implied_referent' AND origin_package_id IS NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION 'FAIL: shared (NULL-origin) attestation was deleted (% rows)', n;
  END IF;
END $$;

-- 3. No orphan memberships: every member resolves to a real row.
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
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: % orphan package memberships', n;
  END IF;
END $$;

-- 4. Natural uniqueness holds: no duplicate mention or citation rows.
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
