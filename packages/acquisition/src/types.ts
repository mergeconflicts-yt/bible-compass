import { z } from "zod";

export const acquisitionRequestSchema = z
  .object({
    releaseKey: z.string().regex(/^release:source:[a-z0-9:.-]+@[a-z0-9._-]+:sha-[0-9a-f]{8,64}$/),
    componentKey: z.string().min(1),
    operation: z.enum(["evaluation_import", "drafting", "publication", "external_ai_processing", "embedding"]),
    url: z.string().url(),
    expectedSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    expectedByteSize: z.number().int().positive().optional(),
    expectedMediaType: z.string().min(1).optional(),
    quarantinePath: z.string().regex(/^content\/quarantine\/.+$/),
  })
  .strict();

export type AcquisitionRequest = z.infer<typeof acquisitionRequestSchema>;

export interface AcquisitionConfig {
  allowedHosts: string[];
  allowedPathPrefixes?: string[];
  maxByteSize: number;
  timeoutMs: number;
  maxArchiveDepth: number;
  maxFileCount: number;
  allowedMediaTypes: string[];
  maxRedirects: number;
}

export const DEFAULT_ACQUISITION_CONFIG: AcquisitionConfig = {
  allowedHosts: ["example.invalid", "github.com", "raw.githubusercontent.com", "stepbible.github.io"],
  allowedPathPrefixes: ["/", "/STEPBible/"],
  maxByteSize: 50 * 1024 * 1024, // 50MB
  timeoutMs: 30000,
  maxArchiveDepth: 3,
  maxFileCount: 10000,
  allowedMediaTypes: [
    "application/zip",
    "application/gzip",
    "text/tab-separated-values",
    "text/csv",
    "application/json",
    "text/plain",
    "application/octet-stream",
  ],
  maxRedirects: 1,
};

export interface AcquisitionReceipt {
  receiptKey: string;
  releaseKey: string;
  componentKey: string;
  url: string;
  finalUrl: string;
  quarantinePath: string;
  byteSize: number;
  sha256: string;
  mediaType: string;
  retrievedAt: string;
  status: "success" | "quarantined_mismatch" | "denied";
  reason: string;
  attemptId: string;
}

export interface FetchResult {
  buffer: Buffer;
  mediaType: string;
  byteSize: number;
  finalUrl: string;
  redirects: number;
}

export interface AcquisitionResult {
  success: boolean;
  receipt: AcquisitionReceipt;
  quarantined: boolean;
  reason: string;
}
