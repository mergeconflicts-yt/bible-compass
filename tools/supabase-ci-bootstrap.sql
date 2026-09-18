-- CI bootstrap for vanilla PostgreSQL (finding 4).
--
-- The local Supabase stack provides these primitives natively; a stock
-- postgres/postgis image does not. This file creates ONLY the primitives
-- the migrations and tests assume — roles named by GRANTs and RLS
-- policies, plus auth.uid() with Supabase-compatible JWT-claim semantics
-- (reads request.jwt.claims, null when absent). It creates no product
-- tables and grants no privileges beyond role existence; every GRANT in
-- the migrations still runs explicitly afterwards.
--
-- Apply once, before supabase/migrations/*.sql, as a superuser:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tools/supabase-ci-bootstrap.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

-- Fail closed against a real Supabase stack: replacing its auth.uid()
-- there would silently change authorization semantics.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
    RAISE EXCEPTION 'refusing: real Supabase auth schema present — this bootstrap is for vanilla CI Postgres only';
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'sub'
$$;
