import * as crypto from "crypto";
import type { RegistryService } from "@bible-compass/registry-service";
import type {
  AcquisitionRequest,
  AcquisitionConfig,
  AcquisitionReceipt,
  AcquisitionResult,
} from "./types";
import { acquisitionRequestSchema, DEFAULT_ACQUISITION_CONFIG } from "./types";
import {
  validateRequest,
  validateMediaType,
  validateByteSize,
} from "./validator";
import type { Fetcher } from "./fetcher";
import type { QuarantineWriter } from "./quarantine";

/**
 * Acquisition service for Task 08 — deterministic, authorized, integrity-checked.
 * - Dry-run authorization via RegistryService before any network/file mutation
 * - Exact host/path allow-listing, redirect policy, size/timeout/archive protections
 * - Streaming SHA-256, byte count, retrieval timestamp, immutable receipt
 * - Private quarantine paths excluded from app bundles/Git
 * - Same approved bytes => same receipt; different bytes under same releaseKey => fail
 */

export class AcquisitionService {
  // Cache of previous receipts by releaseKey:quarantinePath to enforce same-bytes-same-receipt and different-bytes-fail
  private receiptCache = new Map<string, AcquisitionReceipt>();
  // Track quarantined mismatches
  private quarantined = new Set<string>();

  constructor(
    private readonly registry: RegistryService,
    private readonly fetcher: Fetcher,
    private readonly quarantine: QuarantineWriter,
    private readonly config: AcquisitionConfig = DEFAULT_ACQUISITION_CONFIG,
  ) {}

  private computeSha256(buffer: Buffer): string {
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    return `sha256:${hash}`;
  }

  private makeReceiptKey(request: AcquisitionRequest): string {
    return `${request.releaseKey}:${request.quarantinePath}`;
  }

  async acquire(
    request: AcquisitionRequest,
    attemptId: string,
  ): Promise<AcquisitionResult> {
    // 0. Validate request shape (no shell interpolation, path traversal, branch-as-release)
    const parsed = acquisitionRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw Object.assign(
        new Error(
          `Invalid acquisition request: ${parsed.error.issues[0]?.message}`,
        ),
        {
          code: "invalid-request",
        },
      );
    }
    validateRequest(request, this.config);

    // 1. Dry-run authorization — must be exact release/component/operation with valid approval
    // This must happen BEFORE any network or file mutation
    const authResult = await this.registry.authorize({
      releaseKey: request.releaseKey,
      componentKey: request.componentKey,
      operation: request.operation,
    });

    if (!authResult.allowed) {
      // Zero mutation: do not fetch, do not write quarantine, do not record receipt beyond denied audit
      const receipt: AcquisitionReceipt = {
        receiptKey: `acquire:${attemptId}`,
        releaseKey: request.releaseKey,
        componentKey: request.componentKey,
        url: request.url,
        finalUrl: request.url,
        quarantinePath: request.quarantinePath,
        byteSize: 0,
        sha256: "sha256:" + "0".repeat(64),
        mediaType: request.expectedMediaType ?? "application/octet-stream",
        retrievedAt: new Date().toISOString(),
        status: "denied",
        reason: `authorization denied: ${authResult.reason}`,
        attemptId,
      };
      return {
        success: false,
        receipt,
        quarantined: false,
        reason: receipt.reason,
      };
    }

    // 2. Check idempotency cache: same releaseKey:quarantinePath with same bytes => same receipt (no re-fetch)
    const cacheKey = this.makeReceiptKey(request);
    const cached = this.receiptCache.get(cacheKey);
    // We will fetch and compare; if cached and same sha/size, return cached receipt (idempotent)
    // If cached but different sha/size, fail (different bytes under same releaseKey)

    // 3. Fetch (via Fetcher — tests use FixtureFetcher, no network in CI)
    let fetchResult;
    try {
      fetchResult = await this.fetcher.fetch(request.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const receipt: AcquisitionReceipt = {
        receiptKey: `acquire:${attemptId}`,
        releaseKey: request.releaseKey,
        componentKey: request.componentKey,
        url: request.url,
        finalUrl: request.url,
        quarantinePath: request.quarantinePath,
        byteSize: 0,
        sha256: "sha256:" + "0".repeat(64),
        mediaType: request.expectedMediaType ?? "application/octet-stream",
        retrievedAt: new Date().toISOString(),
        status: "denied",
        reason: `fetch failed: ${message}`,
        attemptId,
      };
      return {
        success: false,
        receipt,
        quarantined: false,
        reason: receipt.reason,
      };
    }

    // 4. Validate mediaType, byteSize
    try {
      validateMediaType(
        fetchResult.mediaType,
        request.expectedMediaType,
        this.config.allowedMediaTypes,
      );
      validateByteSize(
        fetchResult.byteSize,
        request.expectedByteSize,
        this.config.maxByteSize,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Quarantine the mismatched artifact but mark as failed
      await this.quarantine.write(request.quarantinePath, fetchResult.buffer);
      this.quarantined.add(cacheKey);
      const receipt: AcquisitionReceipt = {
        receiptKey: `acquire:${attemptId}`,
        releaseKey: request.releaseKey,
        componentKey: request.componentKey,
        url: request.url,
        finalUrl: fetchResult.finalUrl,
        quarantinePath: request.quarantinePath,
        byteSize: fetchResult.byteSize,
        sha256: this.computeSha256(fetchResult.buffer),
        mediaType: fetchResult.mediaType,
        retrievedAt: new Date().toISOString(),
        status: "quarantined_mismatch",
        reason: message,
        attemptId,
      };
      this.receiptCache.set(cacheKey, receipt);
      return { success: false, receipt, quarantined: true, reason: message };
    }

    // 5. Compute SHA-256 and validate against expected
    const actualSha256 = this.computeSha256(fetchResult.buffer);
    if (actualSha256 !== request.expectedSha256) {
      await this.quarantine.write(request.quarantinePath, fetchResult.buffer);
      this.quarantined.add(cacheKey);
      const receipt: AcquisitionReceipt = {
        receiptKey: `acquire:${attemptId}`,
        releaseKey: request.releaseKey,
        componentKey: request.componentKey,
        url: request.url,
        finalUrl: fetchResult.finalUrl,
        quarantinePath: request.quarantinePath,
        byteSize: fetchResult.byteSize,
        sha256: actualSha256,
        mediaType: fetchResult.mediaType,
        retrievedAt: new Date().toISOString(),
        status: "quarantined_mismatch",
        reason: `digest mismatch: expected ${request.expectedSha256} got ${actualSha256}`,
        attemptId,
      };
      // If cached with same key but different sha, this is the "different bytes under same releaseKey fail" case
      if (cached && cached.sha256 !== actualSha256) {
        receipt.reason = `different bytes under same releaseKey ${request.releaseKey} — expected ${cached.sha256} got ${actualSha256}`;
      }
      this.receiptCache.set(cacheKey, receipt);
      return {
        success: false,
        receipt,
        quarantined: true,
        reason: receipt.reason,
      };
    }

    // 6. Check cached different-bytes-fail: if we have cached receipt with same key but different sha, fail
    if (cached && cached.sha256 !== actualSha256) {
      const receipt: AcquisitionReceipt = {
        receiptKey: `acquire:${attemptId}`,
        releaseKey: request.releaseKey,
        componentKey: request.componentKey,
        url: request.url,
        finalUrl: fetchResult.finalUrl,
        quarantinePath: request.quarantinePath,
        byteSize: fetchResult.byteSize,
        sha256: actualSha256,
        mediaType: fetchResult.mediaType,
        retrievedAt: new Date().toISOString(),
        status: "quarantined_mismatch",
        reason: `different bytes under same releaseKey ${request.releaseKey}`,
        attemptId,
      };
      await this.quarantine.write(request.quarantinePath, fetchResult.buffer);
      return {
        success: false,
        receipt,
        quarantined: true,
        reason: receipt.reason,
      };
    }

    // 7. Same bytes same receipt: if cached and same sha/size, return cached receipt (deterministic)
    if (
      cached &&
      cached.sha256 === actualSha256 &&
      cached.byteSize === fetchResult.byteSize
    ) {
      // Ensure quarantine still has the file (idempotent no-op, but file should exist)
      const exists = await this.quarantine.exists(request.quarantinePath);
      if (!exists) {
        await this.quarantine.write(request.quarantinePath, fetchResult.buffer);
      }
      return {
        success: true,
        receipt: cached,
        quarantined: false,
        reason: "idempotent same bytes same receipt",
      };
    }

    // 8. Success: write to quarantine and record receipt
    await this.quarantine.write(request.quarantinePath, fetchResult.buffer);

    const receipt: AcquisitionReceipt = {
      receiptKey: `acquire:${attemptId}`,
      releaseKey: request.releaseKey,
      componentKey: request.componentKey,
      url: request.url,
      finalUrl: fetchResult.finalUrl,
      quarantinePath: request.quarantinePath,
      byteSize: fetchResult.byteSize,
      sha256: actualSha256,
      mediaType: fetchResult.mediaType,
      retrievedAt: new Date().toISOString(),
      status: "success",
      reason: "acquired",
      attemptId,
    };
    this.receiptCache.set(cacheKey, receipt);
    return { success: true, receipt, quarantined: false, reason: "acquired" };
  }

  // For tests: clear cache
  clearCache(): void {
    this.receiptCache.clear();
    this.quarantined.clear();
  }
}
