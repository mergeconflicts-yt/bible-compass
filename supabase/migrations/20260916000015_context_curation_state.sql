-- Migration: 20260916000015_context_curation_state
-- Task CUR-WB-EN-REVIEW-2 — preserve open-question state for context sections.
--
-- The whole-English importer previously skipped orientation fields whose text
-- is null with an open_question_key, so the database could not distinguish
-- "not curated" (an open question blocks publication) from "not applicable".
-- This migration makes that state explicit per section:
--   curated       — the section text is present
--   open_question — the text is not yet supported by approved inputs; the
--                   package's blocking open question is referenced by key
--   not_applicable— reserved for sections a reviewer marks inapplicable
--
-- Additive only: no table, RLS policy or grant changes. private_staging
-- stays revoked from public/anon/authenticated; the table's deny-all
-- policies continue to cover the new columns.

alter table private_staging.context_sections
  add column if not exists curation_state text not null default 'curated';

alter table private_staging.context_sections
  add column if not exists open_question_key text;

alter table private_staging.context_sections
  drop constraint if exists context_sections_curation_state_check;

alter table private_staging.context_sections
  add constraint context_sections_curation_state_check
  check (curation_state in ('curated', 'open_question', 'not_applicable'));

alter table private_staging.context_sections
  drop constraint if exists context_sections_question_consistency_check;

alter table private_staging.context_sections
  add constraint context_sections_question_consistency_check
  check (
    (curation_state = 'open_question' and open_question_key is not null)
    or (curation_state <> 'open_question' and open_question_key is null)
  );
