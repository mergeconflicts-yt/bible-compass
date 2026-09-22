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
  IF d IS NULL OR d !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'FAIL: receipt digest malformed: %', d;
  END IF;
  -- Null-safe: a missing review flag must fail, never pass.
  IF s IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'FAIL: receipt is not draft (got %)', COALESCE(s, 'NULL');
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

-- 6b. Canon order and testament come from the ratified skeleton, never from
-- alphabetical file order: Acts is NT and late; Nehemiah is OT and mid-canon.
DO $$
DECLARE
  acts_t text;
  neh_t text;
  gen_order integer;
  rev_order integer;
  matt_order integer;
BEGIN
  SELECT testament INTO acts_t FROM private_staging.scripture_works WHERE osis_code = 'Acts';
  SELECT testament INTO neh_t FROM private_staging.scripture_works WHERE osis_code = 'Neh';
  SELECT order_index INTO gen_order FROM private_staging.canon_work_memberships m
   JOIN private_staging.scripture_works w ON w.id = m.work_id WHERE w.osis_code = 'Gen';
  SELECT order_index INTO rev_order FROM private_staging.canon_work_memberships m
   JOIN private_staging.scripture_works w ON w.id = m.work_id WHERE w.osis_code = 'Rev';
  SELECT order_index INTO matt_order FROM private_staging.canon_work_memberships m
   JOIN private_staging.scripture_works w ON w.id = m.work_id WHERE w.osis_code = 'Matt';
  IF acts_t IS DISTINCT FROM 'NT' THEN
    RAISE EXCEPTION 'FAIL: Acts testament is % (alphabetical import suspected)', COALESCE(acts_t, 'NULL');
  END IF;
  IF neh_t IS DISTINCT FROM 'OT' THEN
    RAISE EXCEPTION 'FAIL: Nehemiah testament is % (alphabetical import suspected)', COALESCE(neh_t, 'NULL');
  END IF;
  IF gen_order IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'FAIL: Genesis order % <> 1', gen_order; END IF;
  IF matt_order IS DISTINCT FROM 40 THEN RAISE EXCEPTION 'FAIL: Matthew order % <> 40', matt_order; END IF;
  IF rev_order IS DISTINCT FROM 66 THEN RAISE EXCEPTION 'FAIL: Revelation order % <> 66', rev_order; END IF;
END $$;

-- 6c. No stale identity rows survive an upgrade: source-ID names are gone
-- and no alias is shared across distinct place entities.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM private_staging.entity_names
  WHERE normalized_form ~ '^[a-z0-9]{4,10}$' AND normalized_form ~ '[0-9]';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % source-ID-like searchable names remain', n; END IF;
  SELECT count(*) INTO n FROM (
    SELECT n.normalized_form FROM private_staging.entity_names n
    JOIN private_staging.entities e ON e.id = n.entity_id
    WHERE e.type = 'place' AND n.language_tag = 'en'
    GROUP BY n.normalized_form HAVING count(DISTINCT n.entity_id) > 1
  ) s;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % place aliases shared across entities', n; END IF;
END $$;

-- 6d. Collective and tribal identity: the cited verses resolve to the
-- group, never to the patriarch, and no patriarch-person attestation sits
-- on a verse whose text uses a collective or tribal phrase.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  JOIN private_staging.entities e ON e.id = a.entity_id
  JOIN private_staging.reference_units u ON u.id = a.reference_unit_id
  WHERE e.key = 'entity:p-jacob-1' AND u.local_key IN ('ezra.6.16', 'judg.3.2');
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % collective-verse attestations still target Jacob', n; END IF;
  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  JOIN private_staging.entities e ON e.id = a.entity_id
  JOIN private_staging.reference_units u ON u.id = a.reference_unit_id
  WHERE e.key = 'entity:israelites' AND u.local_key IN ('ezra.6.16', 'judg.3.2');
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: Israelites attestations on Ezra 6:16 / Judg 3:2 = % (expected 2)', n; END IF;
  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  JOIN private_staging.entities e ON e.id = a.entity_id
  JOIN private_staging.reference_units u ON u.id = a.reference_unit_id
  WHERE e.key IN ('entity:p-judah-1', 'entity:p-reuben-1', 'entity:p-gad-1')
    AND u.local_key = 'rev.7.5';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % Rev 7:5 attestations still target patriarchs', n; END IF;
  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  JOIN private_staging.entities e ON e.id = a.entity_id
  JOIN private_staging.reference_units u ON u.id = a.reference_unit_id
  WHERE e.key IN ('entity:tribe-of-judah', 'entity:tribe-of-reuben', 'entity:tribe-of-gad')
    AND u.local_key = 'rev.7.5';
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL: tribe attestations on Rev 7:5 = % (expected 3)', n; END IF;
  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  JOIN private_staging.entities e ON e.id = a.entity_id
  JOIN private_staging.reference_units u ON u.id = a.reference_unit_id
  JOIN private_staging.translation_edition_verses v ON v.reference_unit_id = u.id
  JOIN private_staging.translation_editions ed ON ed.id = v.edition_id
  WHERE e.key = 'entity:p-jacob-1'
    AND ed.key = 'edition:bsb@20260912:sha-b2898c49'
    AND (v.text ~ '\y(people|children|sons|house|tribes|tribe|elders|men|generations|remnant|descendants|congregation|assembly|families|communities|princes|leaders|judges|officers|rulers|God|Holy One|Redeemer|Glory|Rock|Strength|Shepherd|Prince|Firstborn) of Israel\y'
      OR v.text ~ '\yall Israel\y|\yIsraelites\y|\yO Israel\y'
      OR v.text ~ '\y(house|descendants|offspring|tent|tribes|tribe|assembly|congregation) of Jacob\y'
      OR v.text ~ '\ytribes? of the sons of Jacob\y'
      OR v.text ~ '\yoffspring of His servant Israel\y')
    -- Mixed verses that genuinely name Jacob (genealogy, renaming formula,
    -- patriarchal address) keep their person attestation by design; only a
    -- Jacob-less group verse must never target him.
    AND v.text !~ '\yJacob\y'
    AND v.text !~ 'Israel shall be your name|\ynamed Israel\b|\ycalled Israel\b';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % Jacob attestations on Jacob-less group verses', n; END IF;
  -- The cited sense cases resolve to the group in full.
  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  JOIN private_staging.entities e ON e.id = a.entity_id
  JOIN private_staging.reference_units u ON u.id = a.reference_unit_id
  WHERE (e.key = 'entity:p-jacob-1' AND u.local_key IN ('hos.1.11', 'num.31.4', 'num.31.5', 'judg.3.8'))
     OR (e.key = 'entity:p-judah-1' AND u.local_key IN ('jer.32.30', 'ezek.37.19', 'rev.7.5'))
     OR (e.key IN ('entity:p-joseph-1', 'entity:p-ephraim-1') AND u.local_key = 'ezek.37.19');
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % cited-verse attestations still target patriarchs', n; END IF;
  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  JOIN private_staging.entities e ON e.id = a.entity_id
  JOIN private_staging.reference_units u ON u.id = a.reference_unit_id
  WHERE (e.key = 'entity:israelites' AND u.local_key IN ('hos.1.11', 'num.31.4', 'num.31.5', 'judg.3.8', 'ezek.39.25', 'mic.1.5', 'obad.1.18'))
     OR (e.key = 'entity:tribe-of-judah' AND u.local_key IN ('jer.32.30', 'ezek.37.19'));
  IF n <> 9 THEN RAISE EXCEPTION 'FAIL: cited-verse group attestations = % (expected 9)', n; END IF;
END $$;

-- 6e. Central identities exist with anchored references: Jesus Christ
-- (person), God (deity), and the Holy Spirit (deity) attest and anchor
-- their explicit surfaces; corrected identities keep their mentions.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM private_staging.entities
  WHERE key = 'entity:jesus-christ' AND type = 'person' AND identification_status = 'established';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: entity:jesus-christ missing or mistyped'; END IF;
  SELECT count(*) INTO n FROM private_staging.entities
  WHERE key = 'entity:god' AND type = 'deity' AND identification_status = 'established';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: entity:god missing or mistyped'; END IF;
  SELECT count(*) INTO n FROM private_staging.entities
  WHERE key = 'entity:holy-spirit' AND type = 'deity' AND identification_status = 'established';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: entity:holy-spirit missing or mistyped'; END IF;

  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  JOIN private_staging.entities e ON e.id = a.entity_id
  JOIN private_staging.reference_units u ON u.id = a.reference_unit_id
  WHERE e.key = 'entity:god' AND u.local_key = 'gen.1.1' AND a.explicitness = 'explicit';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: Gen 1:1 has no explicit God attestation'; END IF;
  SELECT count(*) INTO n
  FROM private_staging.edition_mentions m
  JOIN private_staging.entities e ON e.id = m.entity_id
  JOIN private_staging.translation_edition_verses v ON v.id = m.verse_id
  JOIN private_staging.scripture_works w ON w.id = v.book_id
  WHERE e.key = 'entity:god' AND w.osis_code = 'Gen' AND v.chapter = 1 AND v.verse_number = 1
    AND m.quote = 'God';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: Gen 1:1 has no anchored God mention'; END IF;

  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  JOIN private_staging.entities e ON e.id = a.entity_id
  JOIN private_staging.reference_units u ON u.id = a.reference_unit_id
  WHERE e.key = 'entity:jesus-christ' AND u.local_key = 'matt.1.1' AND a.explicitness = 'explicit';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: Matt 1:1 has no explicit Jesus attestation'; END IF;
  SELECT count(*) INTO n
  FROM private_staging.edition_mentions m
  JOIN private_staging.entities e ON e.id = m.entity_id
  JOIN private_staging.translation_edition_verses v ON v.id = m.verse_id
  JOIN private_staging.scripture_works w ON w.id = v.book_id
  WHERE e.key = 'entity:jesus-christ' AND w.osis_code = 'Matt' AND v.chapter = 1 AND v.verse_number = 1
    AND m.quote = 'Jesus Christ';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: Matt 1:1 has no anchored Jesus mention'; END IF;

  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  JOIN private_staging.entities e ON e.id = a.entity_id
  WHERE e.key = 'entity:holy-spirit';
  IF n < 100 THEN RAISE EXCEPTION 'FAIL: only % Holy Spirit attestations', n; END IF;

  -- Corrected identities anchor their disambiguating phrases.
  SELECT count(*) INTO n
  FROM private_staging.edition_mentions m
  JOIN private_staging.entities e ON e.id = m.entity_id
  WHERE e.key = 'entity:israelites' AND m.quote IN ('people of Israel', 'generations of Israel')
    AND m.form = 'collective';
  IF n < 2 THEN RAISE EXCEPTION 'FAIL: Israelites retained-phrase mentions = %', n; END IF;
  SELECT count(*) INTO n
  FROM private_staging.edition_mentions m
  JOIN private_staging.entities e ON e.id = m.entity_id
  JOIN private_staging.translation_edition_verses v ON v.id = m.verse_id
  JOIN private_staging.scripture_works w ON w.id = v.book_id
  WHERE e.key = 'entity:tribe-of-judah' AND w.osis_code = 'Num' AND v.chapter = 1 AND v.verse_number = 26
    AND m.quote = 'sons of Judah';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: Num 1:26 has no anchored tribe-of-Judah mention'; END IF;
END $$;

-- 6f. Attestation grading is honest and unresolved identities stay
-- proposed: unanchored references grade inferred, and the eleven
-- source-uncertain persons (e.g. Sheshbazzar) are never established.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM private_staging.reference_entity_attestations
  WHERE explicitness = 'inferred';
  IF n < 1000 THEN RAISE EXCEPTION 'FAIL: only % inferred attestations', n; END IF;
  -- Honesty property: every explicit attestation is anchored by an edition
  -- mention over the same entity and verse. Reviewed locked grades
  -- (strongly_implied) and inferred rows are legitimate as-is.
  SELECT count(*) INTO n
  FROM private_staging.reference_entity_attestations a
  WHERE a.explicitness = 'explicit'
    AND NOT EXISTS (
      SELECT 1 FROM private_staging.edition_mentions m
      JOIN private_staging.translation_edition_verses v ON v.id = m.verse_id
      WHERE m.entity_id = a.entity_id AND v.reference_unit_id = a.reference_unit_id
    );
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % explicit attestations without an anchor', n; END IF;
  SELECT count(*) INTO n FROM private_staging.entities
  WHERE key = 'entity:p-sheshbazzar-1' AND identification_status = 'proposed';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: Sheshbazzar is not recorded as proposed'; END IF;
  SELECT count(*) INTO n FROM private_staging.entities
  WHERE identification_status = 'proposed';
  IF n <> 11 THEN RAISE EXCEPTION 'FAIL: proposed entities = % (expected 11)', n; END IF;
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

-- 7b. Open-question state is preserved, not skipped: sections without
-- supported text carry curation_state='open_question' with their blocking
-- question key, so the database distinguishes them from curated ones.
DO $$
DECLARE
  open_sections integer;
  unkeyed integer;
  keyed_curated integer;
BEGIN
  SELECT count(*) INTO open_sections
  FROM private_staging.context_sections WHERE curation_state = 'open_question';
  IF open_sections < 1 THEN
    RAISE EXCEPTION 'FAIL: no open_question context sections preserved';
  END IF;
  SELECT count(*) INTO unkeyed
  FROM private_staging.context_sections
  WHERE curation_state = 'open_question' AND open_question_key IS NULL;
  IF unkeyed <> 0 THEN
    RAISE EXCEPTION 'FAIL: % open_question sections lack their question key', unkeyed;
  END IF;
  SELECT count(*) INTO keyed_curated
  FROM private_staging.context_sections
  WHERE curation_state = 'curated' AND open_question_key IS NOT NULL;
  IF keyed_curated <> 0 THEN
    RAISE EXCEPTION 'FAIL: % curated sections carry a question key', keyed_curated;
  END IF;
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
