-- Seed: synthetic registry data for local development only
-- Never contains real source bytes or production approvals
-- All digests are synthetic (sha256: a/b repeated) and marked synthetic=true

-- Insert synthetic source
insert into private_registry.sources (id, source_key, publisher, description)
values
  ('00000000-0000-0000-0000-000000000001', 'source:stepbible:tipnr', 'STEPBible (synthetic seed)', 'Synthetic TIPNR seed — not production'),
  ('00000000-0000-0000-0000-000000000002', 'source:stepbible:tvtms', 'STEPBible (synthetic seed)', 'Synthetic TVTMS seed — not production')
on conflict (source_key) do nothing;

-- Synthetic release for TIPNR (evaluation import only)
insert into private_registry.source_releases (id, source_id, release_key, commit_or_tag, artifact_sha256, byte_size, retrieved_at, license_evidence_sha256, required_attribution, status)
values
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c',
    'abc12345',
    'sha256:' || repeat('a', 64),
    12345,
    now(),
    'sha256:' || repeat('b', 64),
    'STEPBible CC BY 4.0 — synthetic seed',
    'candidate'
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000002',
    'release:source:stepbible:tvtms@def67890:sha-aaaa1111',
    'def67890',
    'sha256:' || repeat('c', 64),
    5432,
    now(),
    'sha256:' || repeat('d', 64),
    'STEPBible CC BY 4.0 — synthetic seed',
    'candidate'
  )
on conflict (release_key) do nothing;

-- Quarantine artifact metadata (no bytes stored in DB, only paths)
insert into private_registry.source_artifacts (id, release_id, url, media_type, byte_size, sha256, quarantine_path)
values
  (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000010',
    'https://example.invalid/stepbible/tipnr/synthetic.zip',
    'application/zip',
    12345,
    'sha256:' || repeat('a', 64),
    'content/quarantine/stepbible/tipnr/synthetic.zip'
  )
on conflict (id) do nothing;

-- Rights component with explicit pathsOrFields (single component per release)
insert into private_registry.rights_components (id, release_id, component_key, paths_or_fields, license_spdx, license_evidence_sha256, required_attribution)
values
  (
    '00000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000010',
    'tipnr-structured-fields',
    '["tipnr/person.csv","tipnr/place.csv"]'::jsonb,
    'CC-BY-4.0',
    'sha256:' || repeat('b', 64),
    'STEPBible CC BY 4.0'
  ),
  (
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000011',
    'tvtms-mappings',
    '["tvtms/mappings.tsv"]'::jsonb,
    'CC-BY-4.0',
    'sha256:' || repeat('d', 64),
    'STEPBible CC BY 4.0'
  )
on conflict (release_id, component_key) do nothing;

-- Operation grant: evaluation_import allowed (fail-closed)
insert into private_registry.operation_grants (id, component_id, operation, state, provenance)
values
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000030', 'evaluation_import', 'allowed', 'synthetic-seed'),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000031', 'evaluation_import', 'allowed', 'synthetic-seed')
on conflict (id) do nothing;

-- Denied grant for external_ai_processing (must be explicit; synthetic seed denies)
insert into private_registry.operation_grants (id, component_id, operation, state, provenance)
values
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000030', 'external_ai_processing', 'denied', 'synthetic-seed — AI requires Gate D2')
on conflict (id) do nothing;

-- Synthetic approval: binds release:component to synthetic digest (clearly not production)
insert into private_registry.approval_records (id, subject_key, subject_digest, reviewer_id, reviewer_role, decision)
values
  (
    '00000000-0000-0000-0000-000000000050',
    'release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c:tipnr-structured-fields',
    'sha256:' || repeat('a', 64),
    'synthetic-rights-reviewer-001',
    'rights_reviewer',
    'approved'
  )
on conflict (id) do nothing;
