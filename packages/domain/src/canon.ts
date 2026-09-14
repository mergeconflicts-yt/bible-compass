import { DomainError } from "./errors";

export type CanonKey = "canon:prot-66";

export const ALLOWED_CANONS: ReadonlySet<string> = new Set<string>([
  "canon:prot-66",
]);

export function parseCanonKey(input: string): CanonKey {
  if (!input || input.trim().length === 0) {
    throw new DomainError("empty", "Canon key is empty.");
  }
  if (!ALLOWED_CANONS.has(input.trim())) {
    throw new DomainError(
      "invalid-canon",
      `"${input}" is not a supported canon. Expected canon:prot-66.`,
    );
  }
  return input.trim() as CanonKey;
}

export type ReferenceSystemKey =
  "refsys:eng-v22" | "refsys:tel-v1" | "refsys:tam-v1";
export const ALLOWED_REFSYS: ReadonlySet<string> = new Set<string>([
  "refsys:eng-v22",
  "refsys:tel-v1",
  "refsys:tam-v1",
]);

export function parseReferenceSystemKey(input: string): ReferenceSystemKey {
  if (!input || input.trim().length === 0) {
    throw new DomainError("empty", "Reference system key is empty.");
  }
  const trimmed = input.trim();
  if (!ALLOWED_REFSYS.has(trimmed)) {
    throw new DomainError(
      "unsupported-reference-system",
      `"${trimmed}" is not a supported reference system. Expected one of ${[...ALLOWED_REFSYS].join(", ")}.`,
    );
  }
  return trimmed as ReferenceSystemKey;
}

export type WorkKey = `work:${string}:prot-66`;
const WORK_PATTERN = /^work:[A-Za-z1-9]+:prot-66$/;

export function parseWorkKey(input: string): WorkKey {
  if (!input || input.trim().length === 0) {
    throw new DomainError("empty", "Work key is empty.");
  }
  const trimmed = input.trim();
  if (!WORK_PATTERN.test(trimmed)) {
    throw new DomainError(
      "invalid-work",
      `"${trimmed}" is not a valid work key. Expected work:<OSIS>:prot-66.`,
    );
  }
  if (/[^\x00-\x7F]/.test(trimmed)) {
    throw new DomainError(
      "invalid-unicode",
      `"${trimmed}" contains non-ASCII where ASCII is required.`,
    );
  }
  return trimmed as WorkKey;
}

export type ScopeKey = `scope:${string}:refsys:${string}:${string}`;
const SCOPE_PATTERN =
  /^scope:[a-z0-9-]+:refsys:(eng-v22|tel-v1|tam-v1):[A-Za-z1-9]+\.\d+(?:\.\d+)?(?:-[A-Za-z1-9]+\.\d+\.\d+)?$/;

export function parseScopeKey(input: string): ScopeKey {
  if (!input || input.trim().length === 0) {
    throw new DomainError("empty", "Scope key is empty.");
  }
  const trimmed = input.trim();
  if (!SCOPE_PATTERN.test(trimmed)) {
    throw new DomainError(
      "invalid-scope",
      `"${trimmed}" is not a valid scope key.`,
    );
  }
  if (/[^\x00-\x7F]/.test(trimmed)) {
    throw new DomainError(
      "invalid-unicode",
      `"${trimmed}" contains non-ASCII where ASCII is required.`,
    );
  }
  return trimmed as ScopeKey;
}

export type TranslationWorkKey = `trans:${string}`;
const TRANS_WORK_PATTERN = /^trans:(bsb|tel_irv|tam_irv)$/;

export function parseTranslationWorkKey(input: string): TranslationWorkKey {
  if (!input || input.trim().length === 0) {
    throw new DomainError("empty", "Translation work key is empty.");
  }
  const trimmed = input.trim();
  if (!TRANS_WORK_PATTERN.test(trimmed)) {
    throw new DomainError(
      "invalid-translation-work",
      `"${trimmed}" is not a valid translation work.`,
    );
  }
  return trimmed as TranslationWorkKey;
}

export type TranslationEditionKey = `edition:${string}@${string}:sha-${string}`;
const EDITION_PATTERN =
  /^edition:(bsb|tel_irv|tam_irv)@[0-9]{8}:sha-[0-9a-f]{8}$/;

export function parseTranslationEditionKey(
  input: string,
): TranslationEditionKey {
  if (!input || input.trim().length === 0) {
    throw new DomainError("empty", "Translation edition key is empty.");
  }
  const trimmed = input.trim();
  if (!EDITION_PATTERN.test(trimmed)) {
    throw new DomainError(
      "invalid-translation-edition",
      `"${trimmed}" is not a valid edition key. Expected edition:<trans>@YYYYMMDD:sha-<8>.`,
    );
  }
  return trimmed as TranslationEditionKey;
}

export type SourceKey = `source:${string}`;
const SOURCE_PATTERN = /^source:[a-z0-9:.-]+$/;

export function parseSourceKey(input: string): SourceKey {
  if (!input || input.trim().length === 0) {
    throw new DomainError("empty", "Source key is empty.");
  }
  const trimmed = input.trim();
  if (!SOURCE_PATTERN.test(trimmed)) {
    throw new DomainError(
      "invalid-source",
      `"${trimmed}" is not a valid source key.`,
    );
  }
  return trimmed as SourceKey;
}

export type SourceReleaseKey = `release:${string}@${string}:sha-${string}`;
const RELEASE_PATTERN =
  /^release:source:[a-z0-9:.-]+@[a-z0-9._-]+:sha-[0-9a-f]{8,64}$/;

export function parseSourceReleaseKey(input: string): SourceReleaseKey {
  if (!input || input.trim().length === 0) {
    throw new DomainError("empty", "Source release key is empty.");
  }
  const trimmed = input.trim();
  if (!RELEASE_PATTERN.test(trimmed)) {
    throw new DomainError(
      "invalid-source-release",
      `"${trimmed}" is not a valid source release key. Expected release:<source>@<commit>:sha-<hex>.`,
    );
  }
  if (trimmed.includes("branch") || trimmed.includes("main")) {
    throw new DomainError(
      "invalid-source-release",
      `"${trimmed}" must use immutable commit/tag, not branch.`,
    );
  }
  return trimmed as SourceReleaseKey;
}

export type CandidateKey = `candidate:${string}:${string}:${string}`;
const CANDIDATE_PATTERN =
  /^candidate:(person|place|collective|polity|role|object|structure|practice|institution|theme):refsys:(eng-v22|tel-v1|tam-v1):[a-z0-9-]+$/;

export function parseCandidateKey(input: string): CandidateKey {
  if (!input || input.trim().length === 0) {
    throw new DomainError("empty", "Candidate key is empty.");
  }
  const trimmed = input.trim();
  if (!CANDIDATE_PATTERN.test(trimmed)) {
    throw new DomainError(
      "invalid-candidate",
      `"${trimmed}" is not a valid candidate key.`,
    );
  }
  return trimmed as CandidateKey;
}
