import { z } from "zod";

export const referenceMappingCandidateSchema = z
  .object({
    fromRefsys: z.enum(["refsys:eng-v22", "refsys:tel-v1", "refsys:tam-v1"]),
    toRefsys: z.enum(["refsys:eng-v22", "refsys:tel-v1", "refsys:tam-v1"]),
    from: z.string().regex(/^[A-Za-z1-9]+\.\d+(\.\d+)?$/),
    to: z.string().regex(/^[A-Za-z1-9]+\.\d+(\.\d+)?(a|b)?$/),
    kind: z.enum([
      "equivalent",
      "split",
      "merge",
      "overlap",
      "renumbered",
      "omitted",
      "added",
      "uncertain",
    ]),
    sourceReleaseKey: z.string().regex(/^release:source:stepbible:tvtms@/),
    sourceLocator: z.string().min(1),
    confidence: z.enum([
      "established",
      "probable",
      "possible",
      "disputed",
      "unknown",
    ]),
  })
  .strict();

export type ReferenceMappingCandidate = z.infer<
  typeof referenceMappingCandidateSchema
>;

export interface ParseResult {
  candidates: ReferenceMappingCandidate[];
  rejects: { line: number; reason: string; raw: string }[];
  coverage: {
    totalLines: number;
    neh2RelevantLines: number;
    produced: number;
    rejected: number;
    kinds: Record<string, number>;
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
