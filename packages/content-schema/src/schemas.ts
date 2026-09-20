import { z } from "zod";

export const canonKeySchema = z
  .string()
  .regex(/^canon:prot-66$/, "Invalid canon key");
export const refsysKeySchema = z.enum([
  "refsys:eng-v22",
  "refsys:tel-v1",
  "refsys:tam-v1",
]);
export const workKeySchema = z
  .string()
  .regex(/^work:[A-Za-z1-9]+:prot-66$/, "Invalid work key");
export const scopeKeySchema = z
  .string()
  .regex(
    /^scope:[a-z0-9-]+:refsys:(eng-v22|tel-v1|tam-v1):[A-Za-z1-9]+\.\d+.*$/,
    "Invalid scope key",
  );
export const transWorkSchema = z
  .string()
  .regex(/^trans:(bsb|tel_irv|tam_irv)$/, "Invalid translation work");
export const editionKeySchema = z
  .string()
  .regex(
    /^edition:(bsb|tel_irv|tam_irv)@[0-9]{8}:sha-[0-9a-f]{8}$/,
    "Invalid edition key",
  );
export const sourceKeySchema = z
  .string()
  .regex(/^source:[a-z0-9:.-]+$/, "Invalid source key");
export const sourceReleaseKeySchema = z
  .string()
  .regex(
    /^release:source:[a-z0-9:.-]+@[a-z0-9._-]+:sha-[0-9a-f]{8,64}$/,
    "Invalid source release key",
  );

export const referenceSystemSchema = z
  .object({
    key: refsysKeySchema,
    canon: canonKeySchema,
    version: z.number().int().positive(),
    status: z.enum(["active", "draft", "retired"]),
  })
  .strict();

export const translationEditionSchema = z
  .object({
    key: editionKeySchema,
    work: transWorkSchema,
    languageTag: z.enum(["en", "te", "ta"]),
    referenceSystem: refsysKeySchema,
    revisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    sourceArtifactSha256: z
      .string()
      .regex(/^sha256:[0-9a-f]{64}$/, "Invalid sha256"),
    attribution: z.string().min(1),
    status: z.enum(["draft", "approved", "published", "retired"]),
  })
  .strict()
  .superRefine((data, ctx) => {
    const langToRefsys: Record<string, string> = {
      en: "refsys:eng-v22",
      te: "refsys:tel-v1",
      ta: "refsys:tam-v1",
    };
    if (langToRefsys[data.languageTag] !== data.referenceSystem) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `languageTag ${data.languageTag} mismatched refsys ${data.referenceSystem}`,
        path: ["referenceSystem"],
      });
    }
  });

export const entitySchema = z
  .object({
    key: z.string().regex(/^entity:[a-z0-9-]+$/, "Invalid entity key"),
    slug: z.string().regex(/^[a-z0-9-]+$/, "Invalid slug"),
    type: z.enum([
      "person",
      "deity",
      "place",
      "collective",
      "polity",
      "role",
      "object",
      "structure",
      "practice",
      "institution",
      "theme",
    ]),
    identificationStatus: z.enum([
      "established",
      "traditional",
      "proposed",
      "disputed",
      "unknown",
    ]),
    provenance: z.string().min(1),
  })
  .strict();

export const claimSchema = z
  .object({
    key: z.string().regex(/^claim:[a-z0-9-]+$/, "Invalid claim key"),
    subjectType: z.enum(["entity", "scope", "event", "place"]),
    subjectId: z.string().min(1),
    predicate: z.string().min(1),
    object: z.unknown(),
    evidenceStatus: z.enum([
      "established",
      "probable",
      "possible",
      "disputed",
      "unknown",
    ]),
    textualBasis: z.enum([
      "explicit",
      "strongly_implied",
      "inferred",
      "disputed",
    ]),
    reviewState: z.enum(["draft", "in_review", "approved", "published"]),
  })
  .strict();

export const claimCitationSchema = z
  .object({
    claimId: z.string().regex(/^claim:[a-z0-9-]+$/, "Invalid claimId"),
    sourceReleaseId: sourceReleaseKeySchema,
    locator: z.string().min(1),
    supportKind: z.enum(["supports", "qualifies", "disputes", "background"]),
    digest: z.string().regex(/^sha256:[0-9a-f]{64}$/, "Invalid digest"),
  })
  .strict();

export const referenceEntityAttestationSchema = z
  .object({
    entityKey: z.string().regex(/^entity:[a-z0-9-]+$/, "Invalid entityKey"),
    scopeKey: scopeKeySchema,
    referenceSystem: refsysKeySchema,
    localKey: z
      .string()
      .regex(
        /^[A-Za-z1-9]+\.\d+(\.\d+)?(-[A-Za-z1-9]+\.\d+\.\d+)?$/,
        "Invalid localKey",
      ),
    kind: z.enum([
      "primary_subject",
      "participant",
      "location",
      "topic",
      "genealogical_member",
      "implied_referent",
      "disputed_referent",
    ]),
    explicitness: z.enum([
      "explicit",
      "strongly_implied",
      "inferred",
      "disputed",
    ]),
    claimKey: z.string().regex(/^claim:[a-z0-9-]+$/, "Invalid claimKey"),
    reviewState: z.enum(["draft", "in_review", "approved", "published"]),
  })
  .strict();

export const editionMentionSchema = z
  .object({
    editionKey: editionKeySchema,
    verseId: z.string().uuid(),
    entityKey: z
      .string()
      .regex(/^entity:[a-z0-9-]+$/)
      .optional(),
    contextCardId: z.string().uuid().optional(),
    form: z.enum([
      "explicit_name",
      "alias",
      "title",
      "pronoun",
      "indirect",
      "collective",
      "unnamed",
    ]),
    quote: z.string().min(1),
    occurrenceOrdinal: z.number().int().positive(),
    pipelineTextSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    reviewState: z.enum(["draft", "in_review", "approved", "published"]),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasEntity = !!data.entityKey;
    const hasCard = !!data.contextCardId;
    if (hasEntity === hasCard) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one of entityKey or contextCardId must be present",
        path: ["entityKey"],
      });
    }
  });

export const scopeEntityRelevanceSchema = z
  .object({
    scopeKey: scopeKeySchema,
    entityKey: z.string().regex(/^entity:[a-z0-9-]+$/),
    roleInPassage: z.string().min(1),
    importance: z.enum(["central", "supporting", "background"]),
    isAttested: z.boolean(),
  })
  .strict();

export const operationGrantSchema = z
  .object({
    componentKey: z.string().min(1),
    operation: z.enum([
      "evaluation_import",
      "drafting",
      "publication",
      "external_ai_processing",
      "embedding",
    ]),
    state: z.enum(["allowed", "denied", "unknown"]),
    territory: z.string().optional(),
    languageTag: z.enum(["en", "te", "ta"]).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.state === "unknown") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "unknown state must be treated as denied — publication must fail",
        path: ["state"],
      });
    }
  });

// Re-export for validators
export const schemas = {
  referenceSystem: referenceSystemSchema,
  translationEdition: translationEditionSchema,
  entity: entitySchema,
  claim: claimSchema,
  claimCitation: claimCitationSchema,
  attestation: referenceEntityAttestationSchema,
  editionMention: editionMentionSchema,
  relevance: scopeEntityRelevanceSchema,
  operationGrant: operationGrantSchema,
};
