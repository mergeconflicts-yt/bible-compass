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
