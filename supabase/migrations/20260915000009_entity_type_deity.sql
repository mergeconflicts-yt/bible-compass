-- Migration: 20260915000009_entity_type_deity
-- Task EN-01 follow-up — add the canonical 'deity' entity type to the
-- private_staging.entities CHECK constraint so divine-being candidates can be
-- imported (packages/content-schema/src/packages.ts, packages/domain/src/canon.ts).
-- Additive only: no column, table, RLS policy or grant changes.

alter table private_staging.entities
  drop constraint if exists entities_type_check;

alter table private_staging.entities
  add constraint entities_type_check
  check (type in (
    'person','deity','place','collective','polity','role','object',
    'structure','practice','institution','theme','event'
  ));
