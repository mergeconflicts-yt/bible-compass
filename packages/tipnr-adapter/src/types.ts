import { z } from "zod";

export const entityCandidateSchema = z
  .object({
    key: z.string().regex(/^entity:[a-z0-9-]+$/),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    type: z.enum([
      "person",
      "deity",
      "event",
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
    sourceReleaseKey: z.string().regex(/^release:source:stepbible:tipnr@/),
    sourceLocator: z.string().min(1),
    upstreamId: z.string().min(1),
  })
  .strict();

export const nameCandidateSchema = z
  .object({
    entityKey: z.string().regex(/^entity:[a-z0-9-]+$/),
    languageTag: z.enum(["en", "te", "ta"]),
    form: z.string().min(1),
    normalizedForm: z.string().min(1),
    kind: z.enum(["preferred", "alias", "title", "epithet", "transliteration"]),
    sourceLocator: z.string().min(1),
  })
  .strict();

export const attestationCandidateSchema = z
  .object({
    entityKey: z.string().regex(/^entity:[a-z0-9-]+$/),
    scopeKey: z.string().regex(/^scope:[a-z0-9-]+:refsys:/),
    referenceSystem: z.enum([
      "refsys:eng-v22",
      "refsys:tel-v1",
      "refsys:tam-v1",
    ]),
    localKey: z.string().regex(/^[A-Za-z1-9]+\.\d+(\.\d+)?$/),
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
    reviewState: z.enum(["draft", "in_review", "approved", "published"]),
    sourceReleaseKey: z.string().regex(/^release:source:stepbible:tipnr@/),
    sourceLocator: z.string().min(1),
    mappingVia: z.string().min(1), // TVTMS mapping reference
  })
  .strict();

export const relationCandidateSchema = z
  .object({
    subjectEntityKey: z.string().regex(/^entity:[a-z0-9-]+$/),
    predicate: z.string().min(1),
    objectEntityKey: z.string().regex(/^entity:[a-z0-9-]+$/),
    claimKey: z.string().regex(/^claim:[a-z0-9-]+$/),
    sourceLocator: z.string().min(1),
    sourceReleaseKey: z.string().regex(/^release:source:stepbible:tipnr@/),
  })
  .strict();

export type EntityCandidate = z.infer<typeof entityCandidateSchema>;
export type NameCandidate = z.infer<typeof nameCandidateSchema>;
export type AttestationCandidate = z.infer<typeof attestationCandidateSchema>;
export type RelationCandidate = z.infer<typeof relationCandidateSchema>;

export interface ParseResult {
  entities: EntityCandidate[];
  names: NameCandidate[];
  attestations: AttestationCandidate[];
  relations: RelationCandidate[];
  rejects: { line: number; reason: string; raw: string }[];
  unresolved: { upstreamId: string; reason: string }[];
  coverage: {
    totalLines: number;
    neh2Relevant: number;
    produced: {
      entities: number;
      names: number;
      attestations: number;
      relations: number;
    };
    rejected: number;
    unresolved: number;
  };
  receipt: {
    sourceReleaseKey: string;
    quarantinePath: string;
    sha256: string;
    byteSize: number;
    parsedAt: string;
    candidatesSha256: string;
  };
}
