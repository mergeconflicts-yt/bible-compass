import { InMemoryRegistryRepository } from "../src/inMemoryAdapter";
import { RegistryService, serviceActor, unprivilegedActor } from "../src/service";
import type { SourceRelease, RightsComponent, OperationGrant, ApprovalRecord } from "../src/types";

const SYNTH_SHA = "sha256:" + "a".repeat(64);
const SYNTH_SHA_B = "sha256:" + "b".repeat(64);
const SYNTH_SHA_C = "sha256:" + "c".repeat(64);

function makeRelease(overrides: Partial<SourceRelease> = {}): SourceRelease {
  return {
    releaseKey: "release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c",
    sourceKey: "source:stepbible:tipnr",
    commitOrTag: "abc12345",
    artifactSha256: SYNTH_SHA,
    byteSize: 12345,
    licenseEvidenceSha256: SYNTH_SHA_B,
    requiredAttribution: "STEPBible CC BY 4.0 — synthetic",
    retrievedAt: "2026-09-14T00:00:00.000Z",
    status: "candidate",
    ...overrides,
  };
}

function makeComponent(overrides: Partial<RightsComponent> = {}): RightsComponent {
  return {
    componentKey: "tipnr-structured-fields",
    releaseKey: "release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c",
    pathsOrFields: ["tipnr/person.csv"],
    licenseSpdx: "CC-BY-4.0",
    licenseEvidenceSha256: SYNTH_SHA_B,
    ...overrides,
  };
}

function makeGrant(overrides: Partial<OperationGrant> & { componentKey?: string } = {}): OperationGrant & { componentKey: string } {
  return {
    componentKey: "tipnr-structured-fields",
    operation: "evaluation_import",
    state: "allowed",
    provenance: "synthetic-test",
    ...overrides,
  } as OperationGrant & { componentKey: string };
}

function makeApproval(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    subjectKey: "release:source:stepbible:tipnr@abc12345:sha-9f3e7d6c:tipnr-structured-fields",
    subjectDigest: SYNTH_SHA,
    reviewerId: "synthetic-rights-reviewer-001",
    reviewerRole: "rights_reviewer",
    decision: "approved",
    createdAt: "2026-09-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("Task 07B — Registry service and authorization evaluator", () => {
  async function setupAllowed(): Promise<{
    repo: InMemoryRegistryRepository;
    service: RegistryService;
    release: SourceRelease;
    serviceActor: ReturnType<typeof serviceActor>;
  }> {
    const repo = new InMemoryRegistryRepository();
    const service = new RegistryService(repo);
    const actor = serviceActor();
    await repo.recordSource({ sourceKey: "source:stepbible:tipnr", publisher: "STEPBible synthetic" });
    const release = makeRelease();
    await service.admitRelease(release, actor);
    const comp = makeComponent();
    await service.admitComponent(comp, actor);
    const grant = makeGrant();
    await service.grantOperation(grant, actor);
    const approval = makeApproval();
    await service.recordApproval(approval, actor);
    return { repo, service, release, serviceActor: actor };
  }

  it("allows exact release/component/operation/context with valid approval", async () => {
    const { service, release } = await setupAllowed();
    const result = await service.authorize({
      releaseKey: release.releaseKey,
      componentKey: "tipnr-structured-fields",
      operation: "evaluation_import",
    });
    expect(result.allowed).toBe(true);
  });

  it("denies unknown grant (fail-closed)", async () => {
    const { service, release } = await setupAllowed();
    const result = await service.authorize({
      releaseKey: release.releaseKey,
      componentKey: "missing-component",
      operation: "evaluation_import",
    });
    expect(result.allowed).toBe(false);
    expect(result.deniedCode).toBe("no-grant");
  });

  it("denies expired grant", async () => {
    const repo = new InMemoryRegistryRepository();
    const service = new RegistryService(repo);
    const actor = serviceActor();
    await repo.recordSource({ sourceKey: "source:stepbible:tipnr", publisher: "s" });
    const release = makeRelease();
    await service.admitRelease(release, actor);
    await service.admitComponent(makeComponent(), actor);
    await service.grantOperation(makeGrant({ effectiveTo: "2025-01-01" }), actor);
    await service.recordApproval(makeApproval(), actor);
    const result = await service.authorize({
      releaseKey: release.releaseKey,
      componentKey: "tipnr-structured-fields",
      operation: "evaluation_import",
      evaluationDate: "2026-09-14",
    });
    expect(result.allowed).toBe(false);
    expect(result.deniedCode).toBe("grant-expired");
  });

  it("denies not-yet-effective grant", async () => {
    const repo = new InMemoryRegistryRepository();
    const service = new RegistryService(repo);
    const actor = serviceActor();
    await repo.recordSource({ sourceKey: "source:stepbible:tipnr", publisher: "s" });
    const release = makeRelease();
    await service.admitRelease(release, actor);
    await service.admitComponent(makeComponent(), actor);
    await service.grantOperation(makeGrant({ effectiveFrom: "2027-01-01" }), actor);
    await service.recordApproval(makeApproval(), actor);
    const result = await service.authorize({
      releaseKey: release.releaseKey,
      componentKey: "tipnr-structured-fields",
      operation: "evaluation_import",
      evaluationDate: "2026-09-14",
    });
    expect(result.allowed).toBe(false);
  });

  it("denies revoked approval (latest rejected supersedes prior approved)", async () => {
    const { service, release } = await setupAllowed();
    const actor = serviceActor();
    await service.recordApproval(
      makeApproval({ decision: "rejected", createdAt: "2026-09-15T00:00:00.000Z", subjectDigest: SYNTH_SHA_C }),
      actor,
    );
    const result = await service.authorize({
      releaseKey: release.releaseKey,
      componentKey: "tipnr-structured-fields",
      operation: "evaluation_import",
    });
    expect(result.allowed).toBe(false);
    expect(result.deniedCode).toBe("no-approval");
  });

  it("denies prohibited external_ai_processing unless explicitly allowed", async () => {
    const repo = new InMemoryRegistryRepository();
    const service = new RegistryService(repo);
    const actor = serviceActor();
    await repo.recordSource({ sourceKey: "source:stepbible:tipnr", publisher: "s" });
    const release = makeRelease();
    await service.admitRelease(release, actor);
    await service.admitComponent(makeComponent(), actor);
    await service.grantOperation(makeGrant({ operation: "external_ai_processing", state: "denied" }), actor);
    await service.recordApproval(makeApproval(), actor);
    const result = await service.authorize({
      releaseKey: release.releaseKey,
      componentKey: "tipnr-structured-fields",
      operation: "external_ai_processing",
    });
    expect(result.allowed).toBe(false);
  });

  it("idempotent release: same payload is no-op, changed payload rejects", async () => {
    const repo = new InMemoryRegistryRepository();
    const service = new RegistryService(repo);
    const actor = serviceActor();
    await repo.recordSource({ sourceKey: "source:stepbible:tipnr", publisher: "s" });
    const release = makeRelease();
    const r1 = await service.admitRelease(release, actor);
    expect(r1.created).toBe(true);
    const r2 = await service.admitRelease(release, actor);
    expect(r2.created).toBe(false);
    await expect(service.admitRelease(makeRelease({ artifactSha256: SYNTH_SHA_C }), actor)).rejects.toThrow(/Changed bytes/);
  });

  it("idempotent component: same is no-op, changed rejects", async () => {
    const repo = new InMemoryRegistryRepository();
    const service = new RegistryService(repo);
    const actor = serviceActor();
    await repo.recordSource({ sourceKey: "source:stepbible:tipnr", publisher: "s" });
    await service.admitRelease(makeRelease(), actor);
    const comp = makeComponent();
    const c1 = await service.admitComponent(comp, actor);
    expect(c1.created).toBe(true);
    const c2 = await service.admitComponent(comp, actor);
    expect(c2.created).toBe(false);
    await expect(service.admitComponent(makeComponent({ licenseSpdx: "CC-BY-SA-4.0" }), actor)).rejects.toThrow(
      /Changed component/,
    );
  });

  it("only privileged server identity can record decisions", async () => {
    const repo = new InMemoryRegistryRepository();
    const service = new RegistryService(repo);
    const unpriv = unprivilegedActor();
    const approval = makeApproval();
    await expect(service.recordApproval(approval, unpriv)).rejects.toThrow(/Only privileged/);
    await expect(service.admitRelease(makeRelease(), unpriv)).rejects.toThrow(/Only service_role/);
  });

  it("audit receipt is recorded and does not log protected source data", async () => {
    const { repo, service, release } = await setupAllowed();
    await service.authorize({
      releaseKey: release.releaseKey,
      componentKey: "tipnr-structured-fields",
      operation: "evaluation_import",
    });
    const audit = await repo.findAuditByAttempt(
      `eval:${release.releaseKey}:tipnr-structured-fields:evaluation_import`,
    );
    expect(audit).not.toBeNull();
    expect(audit?.requestDigest).toMatch(/^sha256:/);
    expect(audit?.releaseDigest).toMatch(/^sha256:/);
    expect(audit?.decision).toBe("allowed");
    // Ensure no raw payload in receipt
    expect(JSON.stringify(audit)).not.toContain("person.csv");
  });

  it("markdown status cannot authorize — no grant means deny", async () => {
    const repo = new InMemoryRegistryRepository();
    const service = new RegistryService(repo);
    const actor = serviceActor();
    await repo.recordSource({ sourceKey: "source:stepbible:tipnr", publisher: "s" });
    await service.admitRelease(makeRelease(), actor);
    // No grant, no approval
    const result = await service.authorize({
      releaseKey: makeRelease().releaseKey,
      componentKey: "tipnr-structured-fields",
      operation: "publication",
    });
    expect(result.allowed).toBe(false);
  });

  it("requireAuthorization throws on denied", async () => {
    const { service, release } = await setupAllowed();
    await expect(
      service.requireAuthorization({
        releaseKey: release.releaseKey,
        componentKey: "tipnr-structured-fields",
        operation: "publication", // not granted
      }),
    ).rejects.toThrow(/Authorization denied/);
  });
});
