import { z } from "zod";

export const discrepancyRecordSchema = z
  .object({
    personKey: z.string().min(1),
    tipnrLocator: z.string().min(1).nullable(),
    bibleDataLocator: z.string().min(1).nullable(),
    status: z.enum(["exact", "probable", "possible", "conflict", "missing_in_bibledata", "missing_in_tipnr", "unresolved"]),
    details: z.string().min(1),
    sharedUpstream: z.boolean(),
    requiresReview: z.boolean(),
  })
  .strict();

export type DiscrepancyRecord = z.infer<typeof discrepancyRecordSchema>;

export interface ComparisonReport {
  sourceReleaseKey: string;
  bibleDataReleaseKey: string;
  tipnrCandidatesSha: string;
  bibleDataShas: Record<string, string>;
  records: DiscrepancyRecord[];
  coverage: {
    totalBibleDataPersons: number;
    neh2Persons: number;
    exact: number;
    probable: number;
    conflict: number;
    missing: number;
    unresolved: number;
  };
  flags: {
    consequentialClassifications: string[];
    sharedAncestry: string[];
  };
  receipt: {
    parsedAt: string;
    reportSha256: string;
  };
}
