import { z } from "zod";

export const externalMappingSchema = z
  .object({
    sourceKey: z.string().regex(/^source:[a-z0-9:.-]+$/),
    sourceReleaseKey: z.string().regex(/^release:source:/),
    upstreamKind: z.string().min(1),
    upstreamId: z.string().min(1),
    canonicalEntityKey: z
      .string()
      .regex(/^entity:[a-z0-9-]+$/)
      .nullable(),
    mappingState: z.enum([
      "exact",
      "probable",
      "possible",
      "distinct",
      "unresolved",
      "composite",
      "split",
    ]),
    evidence: z.string().min(1),
  })
  .strict();

export const canonicalAttestationSchema = z
  .object({
    entityKey: z.string().regex(/^entity:[a-z0-9-]+$/),
    scopeKey: z.string().regex(/^scope:/),
    referenceUnit: z.string().min(1),
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
    claimKey: z.string().regex(/^claim:[a-z0-9-]+$/),
    sourceReleaseKey: z.string().min(1),
    sourceLocator: z.string().min(1),
  })
  .strict();

export const relevanceSchema = z
  .object({
    scopeKey: z.string().regex(/^scope:/),
    entityKey: z.string().regex(/^entity:[a-z0-9-]+$/),
    roleInPassage: z.string().min(1),
    importance: z.enum(["central", "supporting", "background"]),
    isAttested: z.boolean(),
  })
  .strict();

export type ExternalMapping = z.infer<typeof externalMappingSchema>;
export type CanonicalAttestation = z.infer<typeof canonicalAttestationSchema>;
export type Relevance = z.infer<typeof relevanceSchema>;

export interface ReconciliationResult {
  mappings: ExternalMapping[];
  attestations: CanonicalAttestation[];
  relevances: Relevance[];
  conflicts: { key: string; reason: string }[];
  unresolved: { upstreamId: string; reason: string }[];
  coverage: {
    mappings: number;
    attestations: number;
    relevances: number;
    conflicts: number;
    unresolved: number;
  };
  receipt: {
    candidatesSha256: string;
    parsedAt: string;
  };
}
