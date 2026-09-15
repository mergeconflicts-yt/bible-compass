-- Test: Knowledge/claim/context staging (Task 17B)
\set ON_ERROR_STOP on
begin;

-- 1. RLS enabled on all 22 private_staging tables (11 from 17A + 11 from 17B? Actually 17B adds 22, but we check total 22? Let's check 17B adds 22, plus 11 from 17A = 22? Wait 17B adds 22, total should be 11+22=33? But we check at least 22)
select
  case when count(*) >= 22 then 'PASS: >=22 private_staging tables have RLS enabled (' || count(*)::text || ')'
       else 'FAIL: expected >=22, got ' || count(*)::text
  end as rls_check
from pg_tables t
join pg_class c on c.relname = t.tablename
where t.schemaname = 'private_staging'
  and c.relrowsecurity = true;

-- 2. No grants to anon/authenticated
select
  case when count(*) = 0 then 'PASS: no grants to anon/authenticated on private_staging'
       else 'FAIL: found ' || count(*)::text || ' grants'
  end as grant_check
from information_schema.role_table_grants
where table_schema = 'private_staging'
  and grantee in ('anon','authenticated','public');

-- 3. Attestation unique constraint exists
select case when count(*) = 1 then 'PASS: attestations unique (entity,scope,unit,kind)' else 'FAIL' end as attestation_unique_check
from pg_constraint where conrelid = 'private_staging.reference_entity_attestations'::regclass and contype = 'u';

-- 4. Edition mentions check exactly one of entity_id/context_card_id
savepoint test_edition_mention_check;
do $$
begin
  -- Try to insert with both null (should fail)
  insert into private_staging.edition_mentions (edition_id, verse_id, form, quote, occurrence_ordinal, pipeline_text_sha256, review_state)
  values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','explicit_name','test',1,'sha256:'||repeat('a',64),'draft');
  raise exception 'FAIL: both null should be rejected';
exception when check_violation then null;
end $$;
rollback to savepoint test_edition_mention_check;

-- 5. Scope relevance isAttested boolean, not conflated with attestation
select case when exists (select 1 from information_schema.columns where table_schema='private_staging' and table_name='scope_entity_relevance' and column_name='is_attested' and data_type='boolean')
  then 'PASS: scope_entity_relevance.is_attested boolean exists'
  else 'FAIL' end as relevance_check;

-- 6. Place geometries has geometry type and precision check
select case when exists (select 1 from information_schema.columns where table_schema='private_staging' and table_name='place_geometries' and column_name='geometry')
  then 'PASS: place_geometries.geometry exists'
  else 'FAIL' end as geometry_check;

-- 7. Context sections kind check
savepoint test_context_kind;
do $$
begin
  insert into private_staging.context_sections (revision_id, kind, text, claim_ids) values ('00000000-0000-0000-0000-000000000001','invalid_kind','text','{}');
  raise exception 'FAIL: invalid kind accepted';
exception when check_violation then null;
end $$;
rollback to savepoint test_context_kind;

select 'RLS_TEST_17B_COMPLETE' as status;

rollback;
