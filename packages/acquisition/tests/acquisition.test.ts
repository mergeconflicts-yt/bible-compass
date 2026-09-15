import * as crypto from "crypto";
import { InMemoryRegistryRepository, RegistryService, serviceActor } from "@bible-compass/registry-service";
import { FixtureFetcher } from "../src/fetcher";
import { InMemoryQuarantineWriter } from "../src/quarantine";
import { AcquisitionService } from "../src/service";
import { DEFAULT_ACQUISITION_CONFIG } from "../src/types";

function sha256Hex(buf: Buffer): string {
  return `sha256:${crypto.createHash("sha256").update(buf).digest("hex")}`;
}

const SYNTH_SHA_B = "sha256:" + "b".repeat(64);

describe("Task 08 — Quarantined acquisition and integrity tooling", () => {
  async function setupRegistry(): Promise<{ service: RegistryService; releaseKey: string }> {
    const repo = new InMemoryRegistryRepository();
    const service = new RegistryService(repo);
    const actor = serviceActor();
    await repo.recordSource({ sourceKey: "source:stepbible:tipnr", publisher: "STEPBible" });
    const releaseKey = "release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c";
    await service.admitRelease(
      {
        releaseKey,
        sourceKey: "source:stepbible:tipnr",
        commitOrTag: "abc12345",
        artifactSha256: "sha256:" + "a".repeat(64),
        byteSize: 12345,
        licenseEvidenceSha256: SYNTH_SHA_B,
        requiredAttribution: "x",
        retrievedAt: "2026-09-14T00:00:00.000Z",
        status: "candidate",
      },
      actor,
    );
    await service.admitComponent(
      {
        componentKey: "tipnr-structured-fields",
        releaseKey,
        pathsOrFields: ["tipnr/person.csv"],
        licenseSpdx: "CC-BY-4.0",
        licenseEvidenceSha256: SYNTH_SHA_B,
      },
      actor,
    );
    await service.grantOperation(
      { componentKey: "tipnr-structured-fields", operation: "evaluation_import", state: "allowed", provenance: "synthetic" },
      actor,
    );
    await service.recordApproval(
      {
        subjectKey: `${releaseKey}:tipnr-structured-fields`,
        subjectDigest: "sha256:" + "a".repeat(64),
        reviewerId: "syn",
        reviewerRole: "rights_reviewer",
        decision: "approved",
        createdAt: "2026-09-14T00:00:00.000Z",
      },
      actor,
    );
    return { service, releaseKey };
  }

  it("unauthorized request performs zero network/file mutation", async () => {
    const { service, releaseKey } = await setupRegistry();
    const fetcher = new FixtureFetcher();
    const quarantine = new InMemoryQuarantineWriter();
    const acq = new AcquisitionService(service, fetcher, quarantine);
    const buf = Buffer.from("hello world");
    fetcher.setFixture("https://example.invalid/stepbible/tipnr/file.tsv", buf, "text/tab-separated-values");

    // Try with operation not granted (publication not allowed)
    const result = await acq.acquire(
      {
        releaseKey,
        componentKey: "tipnr-structured-fields",
        operation: "publication", // not granted -> denied
        url: "https://example.invalid/stepbible/tipnr/file.tsv",
        expectedSha256: sha256Hex(buf),
        quarantinePath: "content/quarantine/stepbible/tipnr/file.tsv",
      },
      "attempt-unauth-1",
    );
    expect(result.success).toBe(false);
    expect(result.quarantined).toBe(false);
    expect(fetcher.getFetchCount()).toBe(0);
    expect(quarantine.getWriteCount()).toBe(0);
    expect(result.receipt.status).toBe("denied");
  });

  it("digest mismatch quarantines artifact and fails", async () => {
    const { service, releaseKey } = await setupRegistry();
    const fetcher = new FixtureFetcher();
    const quarantine = new InMemoryQuarantineWriter();
    const acq = new AcquisitionService(service, fetcher, quarantine);
    const buf = Buffer.from("actual content");
    const wrongSha = "sha256:" + "f".repeat(64);
    fetcher.setFixture("https://example.invalid/stepbible/tipnr/file.tsv", buf, "text/tab-separated-values");

    const result = await acq.acquire(
      {
        releaseKey,
        componentKey: "tipnr-structured-fields",
        operation: "evaluation_import",
        url: "https://example.invalid/stepbible/tipnr/file.tsv",
        expectedSha256: wrongSha,
        quarantinePath: "content/quarantine/stepbible/tipnr/file.tsv",
      },
      "attempt-mismatch-1",
    );
    expect(result.success).toBe(false);
    expect(result.quarantined).toBe(true);
    expect(result.receipt.status).toBe("quarantined_mismatch");
    expect(quarantine.getWriteCount()).toBe(1);
    expect(await quarantine.exists("content/quarantine/stepbible/tipnr/file.tsv")).toBe(true);
  });

  it("size mismatch quarantines and fails", async () => {
    const { service, releaseKey } = await setupRegistry();
    const fetcher = new FixtureFetcher();
    const quarantine = new InMemoryQuarantineWriter();
    const acq = new AcquisitionService(service, fetcher, quarantine);
    const buf = Buffer.from("12345");
    fetcher.setFixture("https://example.invalid/stepbible/tipnr/file.tsv", buf, "text/tab-separated-values");
    const result = await acq.acquire(
      {
        releaseKey,
        componentKey: "tipnr-structured-fields",
        operation: "evaluation_import",
        url: "https://example.invalid/stepbible/tipnr/file.tsv",
        expectedSha256: sha256Hex(buf),
        expectedByteSize: 9999, // mismatch
        quarantinePath: "content/quarantine/stepbible/tipnr/file.tsv",
      },
      "attempt-size-mismatch",
    );
    expect(result.success).toBe(false);
    expect(result.quarantined).toBe(true);
  });

  it("media-type mismatch quarantines and fails", async () => {
    const { service, releaseKey } = await setupRegistry();
    const fetcher = new FixtureFetcher();
    const quarantine = new InMemoryQuarantineWriter();
    const acq = new AcquisitionService(service, fetcher, quarantine, {
      ...DEFAULT_ACQUISITION_CONFIG,
      allowedMediaTypes: ["text/tab-separated-values"],
    });
    const buf = Buffer.from("data");
    fetcher.setFixture("https://example.invalid/stepbible/tipnr/file.tsv", buf, "application/json"); // actual json but expected tsv
    const result = await acq.acquire(
      {
        releaseKey,
        componentKey: "tipnr-structured-fields",
        operation: "evaluation_import",
        url: "https://example.invalid/stepbible/tipnr/file.tsv",
        expectedSha256: sha256Hex(buf),
        expectedMediaType: "text/tab-separated-values",
        quarantinePath: "content/quarantine/stepbible/tipnr/file.tsv",
      },
      "attempt-mediatype-mismatch",
    );
    expect(result.success).toBe(false);
    expect(result.quarantined).toBe(true);
  });

  it("same approved bytes yield same receipt (idempotent)", async () => {
    const { service, releaseKey } = await setupRegistry();
    const fetcher = new FixtureFetcher();
    const quarantine = new InMemoryQuarantineWriter();
    const acq = new AcquisitionService(service, fetcher, quarantine);
    const buf = Buffer.from("deterministic content");
    const sha = sha256Hex(buf);
    fetcher.setFixture("https://example.invalid/stepbible/tipnr/file.tsv", buf, "text/tab-separated-values");

    const req = {
      releaseKey,
      componentKey: "tipnr-structured-fields",
      operation: "evaluation_import" as const,
      url: "https://example.invalid/stepbible/tipnr/file.tsv",
      expectedSha256: sha,
      quarantinePath: "content/quarantine/stepbible/tipnr/file.tsv",
    };
    const r1 = await acq.acquire(req, "attempt-same-1");
    const r2 = await acq.acquire(req, "attempt-same-2");
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.receipt.sha256).toBe(r2.receipt.sha256);
    expect(r1.receipt.byteSize).toBe(r2.receipt.byteSize);
    expect(r1.receipt.sha256).toBe(sha);
    // Second call should be idempotent — quarantine write count should be 1 (second is no-op if file exists)
    // Our implementation writes on first, second checks exists and skips if same, so writes =1
    expect(quarantine.getWriteCount()).toBe(1);
  });

  it("different bytes under same releaseKey fail", async () => {
    const { service, releaseKey } = await setupRegistry();
    const fetcher = new FixtureFetcher();
    const quarantine = new InMemoryQuarantineWriter();
    const acq = new AcquisitionService(service, fetcher, quarantine);
    const buf1 = Buffer.from("bytes version 1");
    const buf2 = Buffer.from("bytes version 2 different");
    const sha1 = sha256Hex(buf1);
    // First acquire with buf1
    fetcher.setFixture("https://example.invalid/stepbible/tipnr/file.tsv", buf1, "text/tab-separated-values");
    const r1 = await acq.acquire(
      {
        releaseKey,
        componentKey: "tipnr-structured-fields",
        operation: "evaluation_import",
        url: "https://example.invalid/stepbible/tipnr/file.tsv",
        expectedSha256: sha1,
        quarantinePath: "content/quarantine/stepbible/tipnr/file.tsv",
      },
      "attempt-diff-1",
    );
    expect(r1.success).toBe(true);
    // Second acquire with different bytes but same expectedSha still sha1 — should fail because actual sha mismatches and also different bytes under same releaseKey
    fetcher.setFixture("https://example.invalid/stepbible/tipnr/file.tsv", buf2, "text/tab-separated-values");
    const r2 = await acq.acquire(
      {
        releaseKey,
        componentKey: "tipnr-structured-fields",
        operation: "evaluation_import",
        url: "https://example.invalid/stepbible/tipnr/file.tsv",
        expectedSha256: sha1, // still expect sha1 but actual is buf2's sha
        quarantinePath: "content/quarantine/stepbible/tipnr/file.tsv",
      },
      "attempt-diff-2",
    );
    expect(r2.success).toBe(false);
    expect(r2.quarantined).toBe(true);
    expect(r2.receipt.sha256).not.toBe(sha1);
  });

  it("host not allowed fails without mutation", async () => {
    const { service, releaseKey } = await setupRegistry();
    const fetcher = new FixtureFetcher();
    const quarantine = new InMemoryQuarantineWriter();
    const acq = new AcquisitionService(service, fetcher, quarantine, {
      ...DEFAULT_ACQUISITION_CONFIG,
      allowedHosts: ["example.invalid"],
    });
    await expect(
      acq.acquire(
        {
          releaseKey,
          componentKey: "tipnr-structured-fields",
          operation: "evaluation_import",
          url: "https://evil.com/file.tsv",
          expectedSha256: "sha256:" + "a".repeat(64),
          quarantinePath: "content/quarantine/stepbible/tipnr/file.tsv",
        },
        "attempt-host",
      ),
    ).rejects.toThrow(/Host evil.com not in allow-list/);
    expect(fetcher.getFetchCount()).toBe(0);
    expect(quarantine.getWriteCount()).toBe(0);
  });

  it("path traversal in quarantinePath rejects without mutation", async () => {
    const { service, releaseKey } = await setupRegistry();
    const fetcher = new FixtureFetcher();
    const quarantine = new InMemoryQuarantineWriter();
    const acq = new AcquisitionService(service, fetcher, quarantine);
    fetcher.setFixture("https://example.invalid/file.tsv", Buffer.from("hi"), "text/plain");
    await expect(
      acq.acquire(
        {
          releaseKey,
          componentKey: "tipnr-structured-fields",
          operation: "evaluation_import",
          url: "https://example.invalid/file.tsv",
          expectedSha256: "sha256:" + "a".repeat(64),
          quarantinePath: "content/quarantine/../etc/passwd",
        },
        "attempt-traversal",
      ),
    ).rejects.toThrow(/traversal/);
    expect(fetcher.getFetchCount()).toBe(0);
  });

  it("shell interpolation in URL or path rejects", async () => {
    const { service, releaseKey } = await setupRegistry();
    const fetcher = new FixtureFetcher();
    const quarantine = new InMemoryQuarantineWriter();
    const acq = new AcquisitionService(service, fetcher, quarantine);
    await expect(
      acq.acquire(
        {
          releaseKey,
          componentKey: "tipnr-structured-fields",
          operation: "evaluation_import",
          url: "https://example.invalid/file.tsv; rm -rf /",
          expectedSha256: "sha256:" + "a".repeat(64),
          quarantinePath: "content/quarantine/stepbible/tipnr/file.tsv",
        },
        "attempt-shell",
      ),
    ).rejects.toThrow();
  });

  it("branch as release identity is rejected (no network)", async () => {
    const { service } = await setupRegistry();
    const fetcher = new FixtureFetcher();
    const quarantine = new InMemoryQuarantineWriter();
    const acq = new AcquisitionService(service, fetcher, quarantine);
    await expect(
      acq.acquire(
        {
          releaseKey: "release:source:stepbible:tipnr@main:sha-9f3e7d6c",
          componentKey: "tipnr-structured-fields",
          operation: "evaluation_import",
          url: "https://example.invalid/file.tsv",
          expectedSha256: "sha256:" + "a".repeat(64),
          quarantinePath: "content/quarantine/stepbible/tipnr/file.tsv",
        },
        "attempt-branch",
      ),
    ).rejects.toThrow(/branch/);
    expect(fetcher.getFetchCount()).toBe(0);
  });
});
