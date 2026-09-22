-- Test: whole-English canon import is consolidated, separate and draft-only.
-- Task CUR-WB-EN-FINALIZE. Assumes
--   python3 tools/import-english-canon.py --database-url "$DATABASE_URL"
-- has been run against this database (tools/verify-english-canon.sh runs it).
-- Single transaction, rolls back. Read-only assertions. Tolerant of the
-- Nehemiah 2 import being present in the same database.

begin;

-- 1. Exactly one import receipt for the English canon, draft, well-formed.
DO $$
DECLARE
  d text;
  s text;
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM private_staging.curation_imports
  WHERE package_key = 'import:english-canon:canonical-locale-edition';
  IF n <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected 1 English canon receipt, found %', n;
  END IF;
  SELECT payload_digest, receipt->>'review_status' INTO d, s
  FROM private_staging.curation_imports
  WHERE package_key = 'import:english-canon:canonical-locale-edition';
  IF d !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'FAIL: receipt digest malformed: %', d;
  END IF;
  IF s <> 'draft' THEN
    RAISE EXCEPTION 'FAIL: receipt is not draft: %', s;
  END IF;
END $$;

-- 2. ONE entity row per canonical key (the registry is authoritative).
DO $$
DECLARE
  total integer;
  distinct_keys integer;
BEGIN
  SELECT count(*), count(DISTINCT key) INTO total, distinct_keys
  FROM private_staging.entities;
  IF total <> distinct_keys THEN
    RAISE EXCEPTION 'FAIL: % entity rows but only % distinct keys', total, distinct_keys;
  END IF;
  IF total < 4000 THEN
    RAISE EXCEPTION 'FAIL: expected the whole-canon registry, found % entities', total;
  END IF;
END $$;

-- 3. Jerusalem is exactly one entity row, and its attestations, English
-- localization and BSB mentions live in SEPARATE tables.
DO $$
DECLARE
  entity_rows integer;
  attestations integer;
  descriptions integer;
  mentions integer;
  jerusalem_id uuid;
BEGIN
  SELECT count(*) INTO entity_rows
  FROM private_staging.entities WHERE key = 'entity:jerusalem';
  IF entity_rows <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected 1 entity:jerusalem row, found %', entity_rows;
  END IF;
  SELECT id INTO jerusalem_id FROM private_staging.entities WHERE key = 'entity:jerusalem';

  SELECT count(*) INTO attestations
  FROM private_staging.reference_entity_attestations WHERE entity_id = jerusalem_id;
  IF attestations < 1 THEN
    RAISE EXCEPTION 'FAIL: entity:jerusalem has no canonical attestations';
  END IF;

  SELECT count(*) INTO descriptions
  FROM private_staging.entity_descriptions
  WHERE entity_id = jerusalem_id AND locale = 'en';
  IF descriptions <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected 1 English description for entity:jerusalem, found %', descriptions;
  END IF;

  SELECT count(*) INTO mentions
  FROM private_staging.edition_mentions WHERE entity_id = jerusalem_id;
  IF mentions < 1 THEN
    RAISE EXCEPTION 'FAIL: entity:jerusalem has no BSB mentions';
  END IF;
END $$;

-- 4. Structural separation: the entity row carries no description or mention
-- payload; those live only in their own tables.
DO $$
DECLARE
  leaked integer;
BEGIN
  SELECT count(*) INTO leaked
  FROM information_schema.columns
  WHERE table_schema = 'private_staging' AND table_name = 'entities'
    AND column_name IN ('quote', 'short_desc', 'extended_desc', 'mention_form');
  IF leaked <> 0 THEN
    RAISE EXCEPTION 'FAIL: entities table carries description/mention columns';
  END IF;
END $$;

-- 5. Every attestation and mention resolves to a real entity and reference.
DO $$
DECLARE
  orphan integer;
BEGIN
  SELECT count(*) INTO orphan
  FROM private_staging.reference_entity_attestations a
  LEFT JOIN private_staging.entities e ON e.id = a.entity_id
  LEFT JOIN private_staging.scripture_scopes s ON s.id = a.scope_id
  LEFT JOIN private_staging.reference_units u ON u.id = a.reference_unit_id
  WHERE e.id IS NULL OR s.id IS NULL OR u.id IS NULL;
  IF orphan <> 0 THEN
    RAISE EXCEPTION 'FAIL: % orphaned attestations', orphan;
  END IF;

  SELECT count(*) INTO orphan
  FROM private_staging.edition_mentions m
  LEFT JOIN private_staging.entities e ON e.id = m.entity_id
  LEFT JOIN private_staging.translation_edition_verses v ON v.id = m.verse_id
  WHERE e.id IS NULL OR v.id IS NULL;
  IF orphan <> 0 THEN
    RAISE EXCEPTION 'FAIL: % orphaned mentions', orphan;
  END IF;
END $$;

-- 6. Whole canon present: 66 works, all 1189 chapters addressable, all verses.
DO $$
DECLARE
  works integer;
  verses integer;
  chapters integer;
BEGIN
  SELECT count(*) INTO works FROM private_staging.scripture_works;
  IF works <> 66 THEN RAISE EXCEPTION 'FAIL: % works, expected 66', works; END IF;
  SELECT count(*) INTO verses FROM private_staging.translation_edition_verses;
  IF verses <> 31086 THEN RAISE EXCEPTION 'FAIL: % BSB verses, expected 31086', verses; END IF;
  SELECT count(DISTINCT (book_id, chapter)) INTO chapters
  FROM private_staging.translation_edition_verses;
  IF chapters <> 1189 THEN RAISE EXCEPTION 'FAIL: % chapters, expected 1189', chapters; END IF;
END $$;

-- 7. Draft-only.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM private_staging.reference_entity_attestations WHERE review_state <> 'draft';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % non-draft attestations', n; END IF;
  SELECT count(*) INTO n FROM private_staging.edition_mentions WHERE review_state <> 'draft';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % non-draft mentions', n; END IF;
  SELECT count(*) INTO n FROM private_staging.entity_descriptions WHERE review_state <> 'draft';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % non-draft descriptions', n; END IF;
END $$;

-- 8. Anonymous clients cannot read the imported drafts.
SET ROLE anon;
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM private_staging.entities;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: anon saw % draft entities', n; END IF;
END $$;
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM private_staging.reference_entity_attestations;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: anon saw % draft attestations', n; END IF;
END $$;
RESET ROLE;

rollback;
