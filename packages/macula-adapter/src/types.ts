import { z } from "zod";

export const tokenCandidateSchema = z
  .object({
    wlcTokenId: z.string().min(1),
    surface: z.string().min(1),
    lemma: z.string().min(1),
    morph: z.string().min(1),
    verse: z.string().regex(/^Neh\.2\.\d+$/),
    sourceReleaseKey: z.string().regex(/^release:source:macula:hebrew@/),
    sourceLocator: z.string().min(1),
  })
  .strict();

export const referentCandidateSchema = z
  .object({
    tokenId: z.string().min(1),
    referent: z.string().min(1),
    semanticRole: z.enum([
      "agent",
      "patient",
      "experiencer",
      "beneficiary",
      "instrument",
      "location",
      "unknown",
    ]),
    mappingConfidence: z.enum(["high", "medium", "low", "unknown"]),
    isAmbiguous: z.boolean(),
    sourceLocator: z.string().min(1),
    sourceReleaseKey: z.string().regex(/^release:source:macula:hebrew@/),
  })
  .strict();

export type TokenCandidate = z.infer<typeof tokenCandidateSchema>;
export type ReferentCandidate = z.infer<typeof referentCandidateSchema>;

export interface ParseResult {
  tokens: TokenCandidate[];
  referents: ReferentCandidate[];
  rejects: { line: number; reason: string; raw: string }[];
  coverage: {
    totalTokens: number;
    neh2Tokens: number;
    produced: {
      tokens: number;
      referents: number;
    };
    rejected: number;
    ambiguous: number;
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
