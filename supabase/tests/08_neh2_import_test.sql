-- Test: Nehemiah 2 curation import is complete, queryable, draft-only and private.
-- Task EN-03. Assumes `python3 tools/import-neh2.py --database-url "$DATABASE_URL"`
-- has been run against this database (tools/verify-supabase.sh runs it first).
-- Single transaction, rolls back. Read-only assertions.

begin;

-- 1. Exactly one import receipt, draft, with a payload digest.
DO $$
DECLARE
  n integer;
  d text;
  s text;
BEGIN
  SELECT count(*) INTO n FROM private_staging.curation_imports;
  IF n <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected 1 import receipt, found %', n;
  END IF;
  SELECT payload_digest, receipt->>'review_status' INTO d, s
  FROM private_staging.curation_imports
  WHERE package_key = 'import:neh2:canonical-locale-edition';
  IF d !~ '^sha256:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'FAIL: receipt payload digest missing or malformed: %', d;
  END IF;
  IF s <> 'draft' THEN
    RAISE EXCEPTION 'FAIL: receipt is not draft: %', s;
  END IF;
END $$;

-- 2. Imported rows exist at the expected counts.
DO $$
DECLARE
  r record;
BEGIN
  SELECT
    (SELECT count(*) FROM private_staging.entities) AS entities,
    (SELECT count(*) FROM private_staging.claims) AS claims,
    (SELECT count(*) FROM private_staging.claim_citations) AS citations,
    (SELECT count(*) FROM private_staging.reference_entity_attestations) AS attestations,
    (SELECT count(*) FROM private_staging.edition_mentions) AS mentions,
    (SELECT count(*) FROM private_staging.edition_render_spans) AS spans,
    (SELECT count(*) FROM private_staging.entity_relationship_assertions) AS relationships,
    (SELECT count(*) FROM private_staging.scope_entity_relevance) AS relevance,
    (SELECT count(*) FROM private_staging.context_artifacts) AS contexts,
    (SELECT count(*) FROM private_staging.translation_edition_verses) AS verses
  INTO r;
  IF r.entities <> 37 THEN RAISE EXCEPTION 'FAIL: entities % <> 37', r.entities; END IF;
  IF r.claims <> 33 THEN RAISE EXCEPTION 'FAIL: claims % <> 33', r.claims; END IF;
  IF r.citations <> 56 THEN RAISE EXCEPTION 'FAIL: citations % <> 56', r.citations; END IF;
  IF r.attestations <> 86 THEN RAISE EXCEPTION 'FAIL: attestations % <> 86', r.attestations; END IF;
  IF r.mentions <> 74 THEN RAISE EXCEPTION 'FAIL: mentions % <> 74', r.mentions; END IF;
  IF r.spans <> 74 THEN RAISE EXCEPTION 'FAIL: render spans % <> 74', r.spans; END IF;
  IF r.relationships <> 17 THEN RAISE EXCEPTION 'FAIL: relationships % <> 17', r.relationships; END IF;
  IF r.relevance <> 50 THEN RAISE EXCEPTION 'FAIL: relevance % <> 50', r.relevance; END IF;
  IF r.contexts <> 6 THEN RAISE EXCEPTION 'FAIL: contexts % <> 6', r.contexts; END IF;
  IF r.verses <> 20 THEN RAISE EXCEPTION 'FAIL: verses % <> 20', r.verses; END IF;
END $$;

-- 3. The curation is queryable end to end: entity -> description -> claim ->
-- citation -> evidence locator, and relevance role text.
DO $$
DECLARE
  short_desc text;
  predicate text;
  locator text;
  role_text text;
BEGIN
  SELECT d.short_desc INTO short_desc
  FROM private_staging.entities e
  JOIN private_staging.entity_descriptions d ON d.entity_id = e.id
  WHERE e.key = 'entity:nehemiah-governor' AND d.locale = 'en' AND d.revision = 1;
  IF short_desc IS NULL OR short_desc = '' THEN
    RAISE EXCEPTION 'FAIL: Nehemiah description not queryable';
  END IF;

  SELECT c.predicate, cc.locator INTO predicate, locator
  FROM private_staging.entities e
  JOIN private_staging.entities role_entity
    ON role_entity.key = 'entity:cupbearer'
  JOIN private_staging.claims c
    ON c.subject_id = e.id AND c.predicate = 'holds_role' AND c.object->>'key' = role_entity.key
  JOIN private_staging.claim_citations cc ON cc.claim_id = c.id
  WHERE e.key = 'entity:nehemiah-governor'
  LIMIT 1;
  IF predicate IS NULL OR locator IS NULL OR locator = '' THEN
    RAISE EXCEPTION 'FAIL: Nehemiah/cupbearer claim or citation not queryable';
  END IF;

  SELECT r.role_in_passage INTO role_text
  FROM private_staging.scope_entity_relevance r
  JOIN private_staging.entities e ON e.id = r.entity_id
  JOIN private_staging.scripture_scopes s ON s.id = r.scope_id
  WHERE e.key = 'entity:nehemiah-governor'
    AND s.key = 'scope:neh-2-request:refsys:eng-v22:Neh.2.1-Neh.2.8';
  IF role_text IS NULL OR length(role_text) < 10 THEN
    RAISE EXCEPTION 'FAIL: passage role text not queryable';
  END IF;
END $$;

-- 4. Mentions are queryable with a resolved render span, including the
-- ordinal-sensitive Neh.2.8 mention (second "the king").
DO $$
DECLARE
  span_start integer;
  span_end integer;
  ordinal_hit integer;
BEGIN
  SELECT rs.start_utf16, rs.end_utf16 INTO span_start, span_end
  FROM private_staging.edition_mentions m
  JOIN private_staging.edition_render_spans rs ON rs.mention_id = m.id
  JOIN private_staging.entities e ON e.id = m.entity_id
  JOIN private_staging.translation_edition_verses v ON v.id = m.verse_id
  WHERE e.key = 'entity:nehemiah-governor' AND v.chapter = 2 AND v.verse_number = 1;
  IF span_start IS NULL OR span_end IS NULL OR span_end <= span_start THEN
    RAISE EXCEPTION 'FAIL: Nehemiah Neh.2.1 render span missing';
  END IF;

  SELECT m.occurrence_ordinal INTO ordinal_hit
  FROM private_staging.edition_mentions m
  JOIN private_staging.entities e ON e.id = m.entity_id
  JOIN private_staging.translation_edition_verses v ON v.id = m.verse_id
  WHERE e.key = 'entity:artaxerxes-i' AND v.chapter = 2 AND v.verse_number = 8;
  IF ordinal_hit <> 2 THEN
    RAISE EXCEPTION 'FAIL: Neh.2.8 second "the king" ordinal not preserved (got %)', ordinal_hit;
  END IF;
END $$;

-- 5. Passage context is queryable: 6 scopes, 7 sections each, claimed.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM private_staging.context_sections s
  JOIN private_staging.context_revisions r ON r.id = s.revision_id
  JOIN private_staging.context_artifacts a ON a.id = r.artifact_id
  JOIN private_staging.scripture_scopes sc ON sc.id = a.scope_id
  WHERE sc.key = 'scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20';
  IF n <> 7 THEN
    RAISE EXCEPTION 'FAIL: chapter context has % sections, expected 7', n;
  END IF;
END $$;

-- 6. Draft-only: no imported row is approved or published.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM private_staging.claims WHERE review_state <> 'draft';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % non-draft claims', n; END IF;
  SELECT count(*) INTO n FROM private_staging.reference_entity_attestations WHERE review_state <> 'draft';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % non-draft attestations', n; END IF;
  SELECT count(*) INTO n FROM private_staging.edition_mentions WHERE review_state <> 'draft';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % non-draft mentions', n; END IF;
  SELECT count(*) INTO n FROM private_staging.entity_descriptions WHERE review_state <> 'draft';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % non-draft descriptions', n; END IF;
END $$;

-- 7. Anonymous clients cannot read drafts: anon sees no imported entities
-- (published-only policy, nothing published) and is denied on gated tables.
SET ROLE anon;
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM private_staging.entities;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: anon saw % draft entities', n; END IF;
END $$;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.claims LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon read private_staging.claims';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.edition_mentions LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon read private_staging.edition_mentions';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.curation_imports LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon read private_staging.curation_imports';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

rollback;
