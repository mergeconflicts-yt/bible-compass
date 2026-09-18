import { z } from "zod";

export const ancientPlaceCandidateSchema = z
  .object({
    ancientPlaceId: z.string().min(1),
    name: z.string().min(1),
    sourceReleaseKey: z.string().regex(/^release:source:openbible:geocoding@/),
    sourceLocator: z.string().min(1),
    confidence: z.enum([
      "exact",
      "approximate",
      "area",
      "candidates",
      "unknown",
    ]),
    reviewStatus: z.enum(["draft", "in_review", "approved", "published"]),
  })
  .strict();

export const modernSiteCandidateSchema = z
  .object({
    ancientPlaceId: z.string().min(1),
    modernSiteId: z.string().min(1),
    geometry: z.object({
      type: z.enum(["Point"]),
      coordinates: z.tuple([z.number(), z.number()]),
      crs: z.string().min(1),
      precision: z.enum([
        "exact_site",
        "approximate",
        "area",
        "candidates",
        "unknown",
      ]),
      period: z.string().nullable(),
      evidence: z.string().min(1),
      componentLicense: z.string().min(1),
    }),
    sourceLocator: z.string().min(1),
    sourceReleaseKey: z.string().regex(/^release:source:openbible:geocoding@/),
    sourceConfidence: z.enum(["high", "medium", "low", "unknown"]),
    externalId: z.string().nullable(),
    verseReference: z.string().min(1),
  })
  .strict();

export type AncientPlaceCandidate = z.infer<typeof ancientPlaceCandidateSchema>;
export type ModernSiteCandidate = z.infer<typeof modernSiteCandidateSchema>;

export interface ParseResult {
  ancientPlaces: AncientPlaceCandidate[];
  modernSites: ModernSiteCandidate[];
  rejects: { line: number; reason: string; raw: string }[];
  coverage: {
    totalAncient: number;
    neh2Relevant: number;
    produced: {
      ancient: number;
      modern: number;
    };
    rejected: number;
    competingLocations: number;
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
