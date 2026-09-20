import { z } from "zod";
import {
  referenceSystemSchema,
  translationEditionSchema,
  entitySchema,
  claimSchema,
  claimCitationSchema,
  referenceEntityAttestationSchema,
  editionMentionSchema,
  scopeEntityRelevanceSchema,
  operationGrantSchema,
} from "./schemas";
import {
  draftPackageShellSchema,
  DRAFT_RECORD_SCHEMAS,
  PACKAGE_RECORD_KINDS,
  type DraftPackage,
  type DraftRecord,
} from "./drafts";
import {
  canonicalPackageSchema,
  editionPackageSchema,
  localePackageSchema,
  type CanonicalPackage,
  type EditionPackage,
  type LocalePackage,
  type PackageJobContext,
} from "./packages";

export type ValidationErrorCode =
  | "unknown-field"
  | "invalid-key"
  | "duplicate-key"
  | "dangling-reference"
  | "invalid-state"
  | "rights-unknown"
  | "invalid-format";

export class ValidationError extends Error {
  readonly code: ValidationErrorCode;
  readonly issues: z.ZodIssue[];
  constructor(
    code: ValidationErrorCode,
    message: string,
    issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
    this.issues = issues;
  }
}

function validate<T>(
  schema: z.ZodType<T>,
  data: unknown,
  code: ValidationErrorCode,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    // Map zod unknown-key to our code
    const hasUnknown = result.error.issues.some(
      (i) => i.code === "unrecognized_keys",
    );
    const mappedCode: ValidationErrorCode = hasUnknown ? "unknown-field" : code;
    throw new ValidationError(
      mappedCode,
      first?.message ?? "Validation failed",
      result.error.issues,
    );
  }
  return result.data;
}

export function validateReferenceSystem(data: unknown) {
  return validate(referenceSystemSchema, data, "invalid-format");
}

export function validateTranslationEdition(data: unknown) {
  return validate(translationEditionSchema, data, "invalid-state");
}

export function validateEntity(data: unknown) {
  return validate(entitySchema, data, "invalid-key");
}

export function validateClaim(data: unknown) {
  return validate(claimSchema, data, "invalid-format");
}

export function validateClaimCitation(data: unknown) {
  return validate(claimCitationSchema, data, "invalid-format");
}

export function validateAttestation(data: unknown) {
  return validate(referenceEntityAttestationSchema, data, "invalid-format");
}

export function validateEditionMention(data: unknown) {
  return validate(editionMentionSchema, data, "invalid-format");
}

export function validateRelevance(data: unknown) {
  return validate(scopeEntityRelevanceSchema, data, "invalid-format");
}

export function validateOperationGrant(data: unknown) {
  const result = operationGrantSchema.safeParse(data);
  if (!result.success) {
    // rights-unknown is a specific semantic failure
    const isRightsUnknown = result.error.issues.some((i) =>
      i.message.includes("unknown state must be treated as denied"),
    );
    throw new ValidationError(
      isRightsUnknown ? "rights-unknown" : "invalid-state",
      result.error.issues[0]?.message ?? "Grant validation failed",
      result.error.issues,
    );
  }
  if (result.data.state === "unknown") {
    throw new ValidationError(
      "rights-unknown",
      "Publication with unknown rights must fail",
      [],
    );
  }
  return result.data;
}

// Deterministic duplicate-key check for batch validation
export function checkDuplicateKeys<T extends { key: string }>(
  records: T[],
): void {
  const seen = new Set<string>();
  for (const r of records) {
    if (seen.has(r.key)) {
      throw new ValidationError(
        "duplicate-key",
        `Duplicate record key: ${r.key}`,
        [],
      );
    }
    seen.add(r.key);
  }
}

// Dangling reference check (example: attestation entity must exist)
export function checkDanglingReferences(
  attestations: { entityKey: string }[],
  entities: { key: string }[],
): void {
  const entityKeys = new Set(entities.map((e) => e.key));
  for (const a of attestations) {
    if (!entityKeys.has(a.entityKey)) {
      throw new ValidationError(
        "dangling-reference",
        `Attestation references unknown entity ${a.entityKey}`,
        [],
      );
    }
  }
}

// Cross-record reference check for draft packages (T-CUR-01): every
// claim/question/entity key a record cites must resolve inside the
// package or to the approved store snapshot. Entity keys resolve via
// same-package candidate mappings (proposed_editorial_label) or the
// approved list — never by localized-name guessing. Collects every
// dangling reference before throwing so reviewers see the full list.
export function checkDraftReferences(
  pkg: DraftPackage,
  approvedEntityKeys: string[] = [],
): void {
  const approved = new Set(approvedEntityKeys);
  const recordKeys = new Set<string>();
  const definedClaims = new Set<string>();
  const definedQuestions = new Set<string>(
    (pkg.open_questions ?? []).map((q) => q.question_key),
  );
  const proposedEntities = new Set<string>();
  for (const record of pkg.records) {
    recordKeys.add(record.record_key);
    if (record.record_kind === "claim") definedClaims.add(record.key);
    if (record.record_kind === "entity_candidate") {
      proposedEntities.add(record.proposed_editorial_label);
    }
  }
  const dangling: string[] = [];
  const seenRecords = new Set<string>();
  for (const record of pkg.records) {
    if (seenRecords.has(record.record_key)) {
      throw new ValidationError(
        "duplicate-key",
        `Duplicate record_key: ${record.record_key}`,
        [],
      );
    }
    seenRecords.add(record.record_key);
  }
  const resolveEntity = (pointer: string, key: string): void => {
    if (!approved.has(key) && !proposedEntities.has(key)) {
      dangling.push(`${pointer} -> ${key} (unresolved entity)`);
    }
  };
  const resolveClaims = (
    pointer: string,
    keys: readonly string[] | undefined,
  ): void => {
    for (const key of keys ?? []) {
      if (!definedClaims.has(key))
        dangling.push(`${pointer} -> ${key} (undefined claim)`);
    }
  };
  pkg.records.forEach((record, index) => {
    const at = `/records/${index}`;
    switch (record.record_kind) {
      case "entity_candidate":
        resolveClaims(
          `${at}/identifying_claim_keys`,
          record.identifying_claim_keys,
        );
        break;
      case "entity_profile":
        resolveEntity(`${at}/entity_key`, record.entity_key);
        resolveClaims(
          `${at}/short_description`,
          record.short_description.claim_keys,
        );
        if (record.extended_description) {
          resolveClaims(
            `${at}/extended_description`,
            record.extended_description.claim_keys,
          );
        }
        break;
      case "claim":
        break;
      case "canonical_attestation":
        resolveEntity(`${at}/entity_key`, record.entity_key);
        resolveClaims(`${at}/claim_keys`, record.claim_keys);
        break;
      case "entity_relationship":
        resolveEntity(`${at}/subject`, record.subject_entity_key);
        resolveEntity(`${at}/object`, record.object_entity_key);
        resolveClaims(`${at}/claim_keys`, record.claim_keys);
        break;
      case "event":
        // The event's own entity_key declares a new identity (resolved at
        // import against candidates/store); participants and places cite
        // existing ones and must already resolve.
        for (const key of record.participants)
          resolveEntity(`${at}/participants`, key);
        for (const key of record.places) resolveEntity(`${at}/places`, key);
        break;
      case "place":
        resolveEntity(`${at}/entity_key`, record.entity_key);
        break;
      case "passage_entity_role":
        resolveEntity(`${at}/entity_key`, record.entity_key);
        resolveClaims(`${at}/claim_keys`, record.claim_keys);
        break;
      case "passage_context": {
        const sections = [
          record.who,
          record.where,
          record.when,
          record.what,
          record.before,
          record.stakes,
          record.immediate_summary,
        ];
        const names = [
          "who",
          "where",
          "when",
          "what",
          "before",
          "stakes",
          "immediate_summary",
        ];
        sections.forEach((section, sectionIndex) => {
          resolveClaims(
            `${at}/${names[sectionIndex] ?? sectionIndex}`,
            section.claim_keys,
          );
          if (
            section.open_question_key !== undefined &&
            !definedQuestions.has(section.open_question_key)
          ) {
            dangling.push(
              `${at}/${names[sectionIndex] ?? sectionIndex} -> ${section.open_question_key} (undefined question)`,
            );
          }
        });
        break;
      }
      case "claim_localization":
        if (!definedClaims.has(record.claim_key)) {
          dangling.push(
            `${at}/claim_key -> ${record.claim_key} (undefined claim)`,
          );
        }
        break;
      case "coverage_result":
        for (const key of record.record_keys ?? []) {
          if (!recordKeys.has(key))
            dangling.push(`${at}/record_keys -> ${key} (unknown record)`);
        }
        for (const key of record.blocker_question_keys ?? []) {
          if (!definedQuestions.has(key)) {
            dangling.push(
              `${at}/blocker_question_keys -> ${key} (undefined question)`,
            );
          }
        }
        break;
    }
  });
  if (dangling.length > 0) {
    throw new ValidationError(
      "dangling-reference",
      `Unresolved references: ${dangling.join("; ")}`,
      [],
    );
  }
}

/** Full draft-package gate: strict shell, per-record schemas with
 * pointers, package-kind gating, then reference resolution. */
export function validateDraftPackage(
  data: unknown,
  approvedEntityKeys: string[] = [],
): DraftPackage {
  const shell = draftPackageShellSchema.safeParse(data);
  if (!shell.success) {
    const first = shell.error.issues[0];
    const hasUnknown = shell.error.issues.some(
      (i) => i.code === "unrecognized_keys",
    );
    throw new ValidationError(
      hasUnknown ? "unknown-field" : "invalid-format",
      first?.message ?? "Invalid draft package",
      shell.error.issues,
    );
  }
  const allowed = PACKAGE_RECORD_KINDS[shell.data.package_kind as string] ?? [];
  const records: DraftRecord[] = [];
  for (let index = 0; index < shell.data.records.length; index += 1) {
    const raw = shell.data.records[index] as { record_kind?: unknown };
    const kind = raw?.record_kind;
    if (typeof kind !== "string" || DRAFT_RECORD_SCHEMAS[kind] === undefined) {
      throw new ValidationError(
        "unknown-field",
        `/records/${index}: unknown record_kind ${String(kind)}`,
        [],
      );
    }
    const schema = DRAFT_RECORD_SCHEMAS[kind] as z.ZodTypeAny;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const hasUnknown = parsed.error.issues.some(
        (i) => i.code === "unrecognized_keys",
      );
      throw new ValidationError(
        hasUnknown ? "unknown-field" : "invalid-format",
        `/records/${index}: ${first?.message ?? "invalid record"}`,
        parsed.error.issues,
      );
    }
    if (!allowed.includes(kind)) {
      throw new ValidationError(
        "invalid-format",
        `/records/${index}: record_kind ${kind} not allowed in ${shell.data.package_kind}`,
        [],
      );
    }
    records.push(parsed.data as DraftRecord);
  }
  const pkg: DraftPackage = { ...shell.data, records };
  checkDraftReferences(pkg, approvedEntityKeys);
  return pkg;
}

// ---------------------------------------------------------------------------
// Layered package validation v2 — canonical / edition / locale (CUR-01)
// ---------------------------------------------------------------------------
// Two phases per package: strict structural parse first (every failure
// carries its pointer), then semantic resolution against the injected job
// context. Semantic violations are collected per category and thrown once:
// dangling references as dangling-reference, coverage contradictions and
// snapshot mismatches as invalid-state. Unknown translations, languages,
// or uses fail closed: absent snapshot sets mean nothing is authorized.
// ---------------------------------------------------------------------------

function snapshotViolations(
  label: string,
  value: string | null,
  allowed: readonly string[] | undefined,
  pointer: string,
  errors: string[],
): void {
  if (value === null || allowed === undefined) return;
  if (!allowed.includes(value)) {
    errors.push(`${pointer}: ${label} ${value} not in job snapshot`);
  }
}

function duplicateKeys(
  label: string,
  keys: readonly string[],
  pointer: string,
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) errors.push(`${pointer}: duplicate ${label} ${key}`);
    seen.add(key);
  }
}

interface CoverageGroupView {
  result: string;
  refs: readonly string[];
  record_keys: readonly string[];
  blocker_question_keys: readonly string[];
}

function checkCoverageGroups(
  layer: string,
  annotationClass: string,
  expectedClass: string,
  groups: readonly CoverageGroupView[],
  definedKeys: ReadonlySet<string>,
  definedQuestions: ReadonlySet<string>,
  authoritative: readonly string[] | undefined,
  refLabel: string,
  errors: string[],
): void {
  if (annotationClass !== expectedClass) {
    errors.push(
      `coverage: annotation_class ${annotationClass} not allowed in ${layer} layer`,
    );
    return;
  }
  const seenRefs = new Set<string>();
  const unionRefs: string[] = [];
  for (const [index, group] of groups.entries()) {
    const at = `coverage[${index}]`;
    for (const ref of group.refs) {
      if (seenRefs.has(ref))
        errors.push(`${at}: overlapping ${refLabel} ${ref}`);
      seenRefs.add(ref);
      unionRefs.push(ref);
    }
    if (group.result === "complete_zero" && group.record_keys.length > 0) {
      errors.push(
        `${at}: contradictory complete_zero with ${group.record_keys.length} records`,
      );
    }
    if (
      group.result === "complete_with_records" &&
      group.record_keys.length === 0
    ) {
      errors.push(`${at}: complete_with_records with no records`);
    }
    for (const key of group.record_keys) {
      if (!definedKeys.has(key)) errors.push(`${at}: undefined record ${key}`);
    }
    if (
      group.result === "blocked" &&
      group.blocker_question_keys.length === 0
    ) {
      errors.push(`${at}: blocked result without blocker questions`);
    }
    for (const key of group.blocker_question_keys) {
      if (!definedQuestions.has(key))
        errors.push(`${at}: undefined question ${key}`);
    }
  }
  if (authoritative !== undefined) {
    const authorized = new Set(authoritative);
    for (const ref of unionRefs) {
      if (!authorized.has(ref))
        errors.push(`coverage: ${refLabel} ${ref} outside job authority`);
    }
    for (const ref of authorized) {
      if (!seenRefs.has(ref))
        errors.push(`coverage: gap — ${refLabel} ${ref} uncovered`);
    }
  }
}

function throwSemantic(errors: string[]): void {
  if (errors.length === 0) return;
  const joined = errors.join("; ");
  const code = /unresolved|undefined|unknown record/i.test(joined)
    ? "dangling-reference"
    : /\bduplicate \w+ \S/i.test(joined)
      ? "duplicate-key"
      : "invalid-state";
  throw new ValidationError(code, `Semantic violations: ${joined}`, []);
}

function structuralError(issues: z.ZodIssue[]): never {
  const first = issues[0];
  const hasUnknown = issues.some((i) => i.code === "unrecognized_keys");
  throw new ValidationError(
    hasUnknown ? "unknown-field" : "invalid-format",
    first?.message ?? "Invalid package",
    issues,
  );
}

function parseLayer<S>(schema: z.ZodType<S>, data: unknown): S {
  const parsed = schema.safeParse(data);
  if (!parsed.success) structuralError(parsed.error.issues);
  return parsed.data;
}

export function validateCanonicalPackage(
  data: unknown,
  ctx: PackageJobContext,
): CanonicalPackage {
  const pkg = parseLayer(canonicalPackageSchema, data);
  const errors: string[] = [];
  snapshotViolations(
    "canon",
    pkg.scope.canon_key,
    ctx.canonKeys,
    "/scope/canon_key",
    errors,
  );
  snapshotViolations(
    "reference system",
    pkg.scope.reference_system_key,
    ctx.referenceSystemKeys,
    "/scope/reference_system_key",
    errors,
  );

  // Reconciliation map: the ONLY trusted promotion path (CUR-01 #8).
  // Candidate labels are display text and are never consulted here.
  const reconciled = new Map<string, string>();
  for (const rec of pkg.records.reconciliation_records ?? []) {
    const known = pkg.records.entity_candidates.some(
      (c) => c.candidate_key === rec.candidate_key,
    );
    if (!known) {
      errors.push(`reconciliation for unknown candidate ${rec.candidate_key}`);
      continue;
    }
    if (rec.canonical_entity_key !== undefined)
      reconciled.set(rec.candidate_key, rec.canonical_entity_key);
  }
  const approved = new Set(ctx.approvedEntityKeys ?? []);
  const resolveEntity = (pointer: string, key: string): void => {
    if (approved.has(key)) return;
    for (const canonical of reconciled.values()) {
      if (canonical === key) return;
    }
    errors.push(`${pointer} -> ${key} (unresolved entity)`);
  };

  const definedClaims = new Set(pkg.records.claims.map((c) => c.claim_key));
  const approvedClaims = new Set(ctx.approvedClaimKeys ?? []);
  const resolveClaims = (pointer: string, keys: readonly string[]): void => {
    for (const key of keys) {
      if (!definedClaims.has(key) && !approvedClaims.has(key)) {
        errors.push(`${pointer} -> ${key} (undefined claim)`);
      }
    }
  };

  duplicateKeys(
    "candidate",
    pkg.records.entity_candidates.map((c) => c.candidate_key),
    "/records/entity_candidates",
    errors,
  );
  duplicateKeys(
    "claim",
    pkg.records.claims.map((c) => c.claim_key),
    "/records/claims",
    errors,
  );
  duplicateKeys(
    "attestation",
    pkg.records.attestations.map((a) => a.attestation_key),
    "/records/attestations",
    errors,
  );
  duplicateKeys(
    "relationship",
    pkg.records.relationships.map((r) => r.relationship_key),
    "/records/relationships",
    errors,
  );
  duplicateKeys(
    "event",
    pkg.records.events.map((e) => e.event_key),
    "/records/events",
    errors,
  );
  duplicateKeys(
    "relevance",
    pkg.records.relevance.map((r) => r.relevance_key),
    "/records/relevance",
    errors,
  );
  duplicateKeys(
    "question",
    pkg.open_questions.map((q) => q.question_key),
    "/open_questions",
    errors,
  );
  for (const c of pkg.records.claims) {
    if (c.subject.type === "entity")
      resolveEntity(`/claims/${c.claim_key}/subject`, c.subject.key);
    if (c.object.type === "entity")
      resolveEntity(`/claims/${c.claim_key}/object`, c.object.key);
    if (c.object.type === "scope") validateScopeRef(c.object.key, ctx, errors);
  }
  const definedCitations = new Set(
    pkg.records.citations.map((c) => c.citation_key),
  );
  duplicateKeys(
    "citation",
    pkg.records.citations.map((c) => c.citation_key),
    "/records/citations",
    errors,
  );
  for (const c of pkg.records.claims) {
    for (const key of c.citation_keys) {
      if (!definedCitations.has(key)) {
        errors.push(`/claims/${c.claim_key} -> ${key} (undefined citation)`);
      }
    }
  }
  for (const citation of pkg.records.citations) {
    resolveClaims(
      `/citations/${citation.citation_key}/claims`,
      citation.claim_keys,
    );
    if (!ctx.evidenceItemKeys.includes(citation.evidence_item_key)) {
      errors.push(
        `/citations/${citation.citation_key} -> ${citation.evidence_item_key} (undefined evidence)`,
      );
    }
  }
  for (const a of pkg.records.attestations) {
    resolveEntity(`/attestations/${a.attestation_key}/entity`, a.entity_key);
    resolveClaims(`/attestations/${a.attestation_key}/claims`, a.claim_keys);
  }
  for (const r of pkg.records.relationships) {
    resolveEntity(
      `/relationships/${r.relationship_key}/subject`,
      r.subject_entity_key,
    );
    resolveEntity(
      `/relationships/${r.relationship_key}/object`,
      r.object_entity_key,
    );
    resolveClaims(`/relationships/${r.relationship_key}/claims`, r.claim_keys);
    for (const scope of r.applicable_scope_keys)
      validateScopeRef(scope, ctx, errors);
  }
  for (const e of pkg.records.events) {
    for (const key of e.participant_entity_keys)
      resolveEntity(`/events/${e.event_key}/participants`, key);
    for (const key of e.place_entity_keys)
      resolveEntity(`/events/${e.event_key}/places`, key);
    for (const account of e.scripture_accounts)
      validateScopeRef(account.scope_key, ctx, errors);
  }
  for (const p of pkg.records.places) {
    for (const position of p.geographic_positions) {
      if (!ctx.evidenceItemKeys.includes(position.evidence_item_key)) {
        errors.push(
          `/places/${p.entity_key} -> ${position.evidence_item_key} (undefined evidence)`,
        );
      }
      resolveClaims(`/places/${p.entity_key}/claims`, position.claim_keys);
    }
  }
  for (const r of pkg.records.relevance) {
    resolveEntity(`/relevance/${r.relevance_key}/entity`, r.entity_key);
    resolveClaims(`/relevance/${r.relevance_key}/claims`, r.claim_keys);
    validateScopeRef(r.scope_key, ctx, errors);
  }

  const definedKeys = new Set<string>([
    ...pkg.records.entity_candidates.map((c) => c.candidate_key),
    ...definedClaims,
    ...definedCitations,
    ...pkg.records.attestations.map((a) => a.attestation_key),
    ...pkg.records.relationships.map((r) => r.relationship_key),
    ...pkg.records.events.map((e) => e.event_key),
    ...pkg.records.relevance.map((r) => r.relevance_key),
  ]);
  const definedQuestions = new Set(
    pkg.open_questions.map((q) => q.question_key),
  );
  for (const q of pkg.open_questions) {
    if (!definedKeys.has(q.record_key) && !definedQuestions.has(q.record_key)) {
      // record_key must name a defined record or question context; entity/scope keys are not records.
      errors.push(
        `/open_questions/${q.question_key}: unknown record ${q.record_key}`,
      );
    }
  }
  for (const block of pkg.coverage) {
    checkCoverageGroups(
      "canonical",
      block.annotation_class,
      "canonical_entity_attestation",
      block.groups.map((g) => ({
        result: g.result,
        refs: g.reference_keys,
        record_keys: g.record_keys,
        blocker_question_keys: g.blocker_question_keys,
      })),
      definedKeys,
      definedQuestions,
      ctx.authoritativeReferenceKeys,
      "reference",
      errors,
    );
  }
  throwSemantic(errors);
  return pkg;
}

function validateScopeRef(
  scope: string,
  ctx: PackageJobContext,
  errors: string[],
): void {
  if (
    ctx.authoritativeScopeKeys !== undefined &&
    !ctx.authoritativeScopeKeys.includes(scope)
  ) {
    errors.push(`scope ${scope} outside job authority`);
  }
}

export function validateEditionPackage(
  data: unknown,
  ctx: PackageJobContext,
): EditionPackage {
  const pkg = parseLayer(editionPackageSchema, data);
  const errors: string[] = [];
  snapshotViolations(
    "canon",
    pkg.scope.canon_key,
    ctx.canonKeys,
    "/scope/canon_key",
    errors,
  );
  snapshotViolations(
    "reference system",
    pkg.scope.reference_system_key,
    ctx.referenceSystemKeys,
    "/scope/reference_system_key",
    errors,
  );
  snapshotViolations(
    "language",
    pkg.scope.language_tag,
    ctx.languageTags,
    "/scope/language_tag",
    errors,
  );
  snapshotViolations(
    "edition",
    pkg.scope.translation_edition_key,
    ctx.translationEditionKeys,
    "/scope/translation_edition_key",
    errors,
  );

  const approvedClaims = new Set(ctx.approvedClaimKeys ?? []);
  const approvedAttestations = new Set(ctx.approvedAttestationKeys ?? []);
  const definedMentions = new Set(
    pkg.records.mentions.map((m) => m.mention_key),
  );
  duplicateKeys(
    "mention",
    pkg.records.mentions.map((m) => m.mention_key),
    "/records/mentions",
    errors,
  );
  for (const m of pkg.records.mentions) {
    if (!approvedAttestations.has(m.attestation_key)) {
      errors.push(
        `/mentions/${m.mention_key} -> ${m.attestation_key} (undefined attestation)`,
      );
    }
    if (
      ctx.authoritativeReferenceKeys !== undefined &&
      !ctx.authoritativeReferenceKeys.includes(m.verse_key)
    ) {
      errors.push(
        `/mentions/${m.mention_key}: verse ${m.verse_key} outside job authority`,
      );
    }
    for (const key of m.claim_keys) {
      if (!approvedClaims.has(key))
        errors.push(`/mentions/${m.mention_key} -> ${key} (undefined claim)`);
    }
  }
  const definedQuestions = new Set(
    pkg.open_questions.map((q) => q.question_key),
  );
  for (const q of pkg.open_questions) {
    if (!definedMentions.has(q.record_key)) {
      errors.push(
        `/open_questions/${q.question_key}: unknown record ${q.record_key}`,
      );
    }
  }
  for (const block of pkg.coverage) {
    checkCoverageGroups(
      "edition",
      block.annotation_class,
      "translation_mention",
      block.groups.map((g) => ({
        result: g.result,
        refs: g.reference_keys,
        record_keys: g.record_keys,
        blocker_question_keys: g.blocker_question_keys,
      })),
      definedMentions,
      definedQuestions,
      ctx.authoritativeReferenceKeys,
      "reference",
      errors,
    );
  }
  throwSemantic(errors);
  return pkg;
}

export function validateLocalePackage(
  data: unknown,
  ctx: PackageJobContext,
): LocalePackage {
  const pkg = parseLayer(localePackageSchema, data);
  const errors: string[] = [];
  snapshotViolations(
    "canon",
    pkg.scope.canon_key,
    ctx.canonKeys,
    "/scope/canon_key",
    errors,
  );
  snapshotViolations(
    "reference system",
    pkg.scope.reference_system_key,
    ctx.referenceSystemKeys,
    "/scope/reference_system_key",
    errors,
  );
  snapshotViolations(
    "language",
    pkg.scope.language_tag,
    ctx.languageTags,
    "/scope/language_tag",
    errors,
  );

  const approvedEntities = new Set(ctx.approvedEntityKeys ?? []);
  const approvedClaims = new Set(ctx.approvedClaimKeys ?? []);
  const resolveEntity = (pointer: string, key: string): void => {
    if (!approvedEntities.has(key))
      errors.push(`${pointer} -> ${key} (unresolved entity)`);
  };
  const resolveClaims = (pointer: string, keys: readonly string[]): void => {
    for (const key of keys) {
      if (!approvedClaims.has(key))
        errors.push(`${pointer} -> ${key} (undefined claim)`);
    }
  };
  const approvedRelevance = new Set(ctx.approvedRelevanceKeys ?? []);
  for (const p of pkg.records.entity_profiles) {
    resolveEntity(`/profiles/${p.profile_key}/entity`, p.entity_key);
    resolveClaims(
      `/profiles/${p.profile_key}/short`,
      p.short_description.claim_keys,
    );
    if (p.extended_description) {
      resolveClaims(
        `/profiles/${p.profile_key}/extended`,
        p.extended_description.claim_keys,
      );
    }
    snapshotViolations(
      "language",
      p.language_tag,
      ctx.languageTags,
      `/profiles/${p.profile_key}/language`,
      errors,
    );
  }
  const definedContexts = new Set(
    pkg.records.passage_contexts.map((c) => c.context_key),
  );
  duplicateKeys(
    "context",
    pkg.records.passage_contexts.map((c) => c.context_key),
    "/records/passage_contexts",
    errors,
  );
  duplicateKeys(
    "profile",
    pkg.records.entity_profiles.map((p) => p.profile_key),
    "/records/entity_profiles",
    errors,
  );
  duplicateKeys(
    "localization",
    pkg.records.relevance_localizations.map((r) => r.localization_key),
    "/records/relevance_localizations",
    errors,
  );
  duplicateKeys(
    "question",
    pkg.open_questions.map((q) => q.question_key),
    "/open_questions",
    errors,
  );
  const definedQuestions = new Set(
    pkg.open_questions.map((q) => q.question_key),
  );
  for (const c of pkg.records.passage_contexts) {
    validateScopeRef(c.scope_key, ctx, errors);
    snapshotViolations(
      "language",
      c.language_tag,
      ctx.languageTags,
      `/contexts/${c.context_key}/language`,
      errors,
    );
    (
      Object.entries(c.orientation) as [
        name: string,
        section: (typeof c.orientation)["who"],
      ][]
    ).forEach(([name, section]) => {
      resolveClaims(`/contexts/${c.context_key}/${name}`, section.claim_keys);
      if (
        section.open_question_key !== null &&
        !definedQuestions.has(section.open_question_key)
      ) {
        errors.push(
          `/contexts/${c.context_key}/${name} -> ${section.open_question_key} (undefined question)`,
        );
      }
    });
  }
  for (const r of pkg.records.relevance_localizations) {
    if (!approvedRelevance.has(r.relevance_key)) {
      errors.push(
        `/localizations/${r.localization_key} -> ${r.relevance_key} (undefined relevance)`,
      );
    }
    resolveEntity(`/localizations/${r.localization_key}/entity`, r.entity_key);
    resolveClaims(`/localizations/${r.localization_key}/claims`, r.claim_keys);
    validateScopeRef(r.scope_key, ctx, errors);
    snapshotViolations(
      "language",
      r.language_tag,
      ctx.languageTags,
      `/localizations/${r.localization_key}/language`,
      errors,
    );
  }
  for (const q of pkg.open_questions) {
    if (!definedContexts.has(q.record_key)) {
      errors.push(
        `/open_questions/${q.question_key}: unknown record ${q.record_key}`,
      );
    }
  }
  for (const block of pkg.coverage) {
    checkCoverageGroups(
      "locale",
      block.annotation_class,
      "passage_context_localization",
      block.groups.map((g) => ({
        result: g.result,
        refs: g.scope_keys,
        record_keys: g.record_keys,
        blocker_question_keys: g.blocker_question_keys,
      })),
      definedContexts,
      definedQuestions,
      ctx.authoritativeScopeKeys,
      "scope",
      errors,
    );
  }
  throwSemantic(errors);
  return pkg;
}
