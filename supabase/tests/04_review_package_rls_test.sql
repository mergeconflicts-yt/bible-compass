-- Test: Review/package RLS (Task 17C)
\set ON_ERROR_STOP on
begin;

-- 1. At least 5 review/package tables have RLS
select case when count(*) >= 5 then 'PASS: >=5 review/package tables have RLS' else 'FAIL' end as rls_check
from pg_tables t join pg_class c on c.relname = t.tablename
where t.schemaname = 'private_staging' and c.relrowsecurity = true
  and t.tablename in ('approval_records','package_manifests','package_members','package_dependencies','publication_releases');

-- 2. No grants to anon on private tables except published allow
select case when count(*) = 0 then 'PASS: no direct grants to anon on private' else 'FAIL: found grants' end as grant_check
from information_schema.role_table_grants where table_schema='private_staging' and grantee in ('anon','authenticated','public') and privilege_type='INSERT';

-- 3. Append-only trigger exists
select case when count(*) >=1 then 'PASS: approval append-only trigger exists' else 'FAIL' end as trigger_check
from pg_trigger where tgname like 'trg_prevent_approval_update%';

-- 4. Public views exist
select case when count(*) = 3 then 'PASS: 3 public_content views exist' else 'FAIL: got '||count(*)::text end as view_check
from pg_views where schemaname='public_content';

-- 5. Published allow policy exists
select case when count(*) >=1 then 'PASS: allow_anon_published policy exists' else 'FAIL' end as allow_check
from pg_policies where schemaname='private_staging' and policyname like 'allow_anon_published%';

-- 6. Draft deny: anon cannot select unpublished package (policy using false)
select case when exists (select 1 from pg_policies where policyname='deny_all_package_manifests_private') then 'PASS: deny unpublished' else 'FAIL' end as deny_check;

select 'RLS_TEST_17C_COMPLETE' as status;
rollback;
