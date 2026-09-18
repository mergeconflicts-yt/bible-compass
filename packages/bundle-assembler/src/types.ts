import { z } from "zod";

export const jobManifestSchema = z
  .object({
    schema_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    job_id: z.string().regex(/^job:[a-z0-9-]+$/),
    job_kind: z.string().min(1),
    target: z.object({
      canon_key: z.string().regex(/^canon:prot-66$/),
      reference_system_key: z.string().regex(/^refsys:eng-v22$/),
      scope_key: z
        .string()
        .regex(/^scope:neh-2:refsys:eng-v22:Neh\.2\.1-Neh\.2\.20$/),
      language_tag: z.enum(["en", "te", "ta"]),
      translation_edition_key: z.string().nullable(),
    }),
    contract: z.object({
      expected_submission_id: z.string().regex(/^submission:/),
      expected_package_key: z.string().min(1),
      expected_draft_revision: z.number().int().positive(),
      expected_attempt: z.number().int().positive(),
      output_schema_version: z.string().min(1),
      vocabulary_version: z.string().min(1),
      allowed_package_kinds: z.string().array().min(1),
      maximum_records: z.number().int().positive(),
      maximum_output_bytes: z.number().int().positive(),
    }),
    input_bundle: z.object({
      bundle_key: z.string().min(1),
      bundle_sha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
      scripture_snapshot_sha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
      entity_catalog_sha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
      source_catalog_sha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    }),
    policies: z.object({
      allowed_source_keys: z.string().array().min(1),
      allow_new_entity_candidates: z.boolean(),
      allow_new_source_candidates: z.boolean(),
      internet_access: z.boolean(),
      required_claim_citations: z.boolean(),
      ai_may_approve: z.boolean(),
    }),
    provider: z.object({
      provider_class: z.string().min(1),
      model_class: z.string().min(1),
      prompt_version: z.string().min(1),
      retention_days: z.number().int().positive(),
      training_allowed: z.boolean(),
    }),
  })
  .strict();

export type JobManifest = z.infer<typeof jobManifestSchema>;

export interface Bundle {
  manifest: JobManifest;
  excerpts: {
    sourceKey: string;
    componentKey: string;
    locator: string;
    text: string;
    sha256: string;
  }[];
  bundleDigest: string;
}
