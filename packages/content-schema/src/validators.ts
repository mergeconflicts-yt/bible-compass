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
