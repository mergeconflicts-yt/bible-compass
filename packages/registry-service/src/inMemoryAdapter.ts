import type { RegistryRepository, PrivilegedActor } from "./repository";
import { assertPrivileged } from "./repository";
import type {
  SourceRecord,
  SourceRelease,
  RightsComponent,
  OperationGrant,
  ApprovalRecord,
  AuditReceipt,
  AuthorizationRequest,
  AuthorizationResult,
} from "./types";
import {
  sourceReleaseSchema,
  createAuditReceipt,
  evaluateAuthorizationPure,
} from "./types";

/**
 * In-memory adapter for Task 07B tests and local dev.
 * Mirrors Postgres constraints: unique releaseKey, append-only approvals, idempotent no-op vs changed-payload reject.
 * No logs of protected source data — only digests and keys are retained in audit.
 */
export class InMemoryRegistryRepository implements RegistryRepository {
  private sources = new Map<string, SourceRecord & { id: string }>();
  private releases = new Map<string, SourceRelease & { id: string }>();
  private components = new Map<string, RightsComponent & { id: string }>(); // key: releaseKey:componentKey
  private grants = new Map<string, (OperationGrant & { id: string; componentKey: string })[]>();
  private approvals = new Map<string, ApprovalRecord[]>();
  private audits = new Map<string, AuditReceipt>();

  // For deterministic IDs in tests
  private nextId = 1;
  private genId(): string {
    return `00000000-0000-0000-0000-${String(this.nextId++).padStart(12, "0")}`;
  }

  async recordSource(source: SourceRecord): Promise<{ created: boolean; id: string }> {
    const existing = this.sources.get(source.sourceKey);
    if (existing) {
      if (existing.publisher !== source.publisher) {
        throw Object.assign(new Error(`Changed payload under same sourceKey ${source.sourceKey} rejected (idempotent)`), {
          code: "conflict-changed-payload",
        });
      }
      return { created: false, id: existing.id };
    }
    const id = this.genId();
    this.sources.set(source.sourceKey, { ...source, id });
    return { created: true, id };
  }

  async findSourceByKey(sourceKey: string): Promise<SourceRecord | null> {
    const r = this.sources.get(sourceKey);
    return r ? { sourceKey: r.sourceKey, publisher: r.publisher, description: r.description } : null;
  }

  async recordRelease(release: SourceRelease): Promise<{ created: boolean; id: string }> {
    const parsed = sourceReleaseSchema.safeParse(release);
    if (!parsed.success) {
      throw Object.assign(new Error(`Invalid release: ${parsed.error.issues[0]?.message}`), {
        code: "invalid-release",
      });
    }
    const existing = this.releases.get(release.releaseKey);
    if (existing) {
      // Idempotent if same bytes/digests, else reject
      const same =
        existing.artifactSha256 === release.artifactSha256 &&
        existing.byteSize === release.byteSize &&
        existing.licenseEvidenceSha256 === release.licenseEvidenceSha256 &&
        existing.commitOrTag === release.commitOrTag;
      if (!same) {
        throw Object.assign(
          new Error(`Changed bytes under same releaseKey ${release.releaseKey} rejected — append new release, do not overwrite`),
          { code: "conflict-changed-payload" },
        );
      }
      return { created: false, id: existing.id };
    }
    // Enforce source exists
    if (!this.sources.has(release.sourceKey)) {
      throw Object.assign(new Error(`Source ${release.sourceKey} not found for release`), { code: "not-found-source" });
    }
    const id = this.genId();
    this.releases.set(release.releaseKey, { ...release, id });
    return { created: true, id };
  }

  async findReleaseByKey(releaseKey: string): Promise<SourceRelease | null> {
    const r = this.releases.get(releaseKey);
    if (!r) return null;
    const { id: _id, ...rest } = r;
    return rest as SourceRelease;
  }

  async recordComponent(component: RightsComponent): Promise<{ created: boolean; id: string }> {
    const key = `${component.releaseKey}:${component.componentKey}`;
    const existing = this.components.get(key);
    if (existing) {
      const same =
        existing.licenseSpdx === component.licenseSpdx &&
        existing.licenseEvidenceSha256 === component.licenseEvidenceSha256 &&
        JSON.stringify(existing.pathsOrFields) === JSON.stringify(component.pathsOrFields);
      if (!same) {
        throw Object.assign(new Error(`Changed component payload under ${key} rejected`), {
          code: "conflict-changed-payload",
        });
      }
      return { created: false, id: existing.id };
    }
    if (!this.releases.has(component.releaseKey)) {
      throw Object.assign(new Error(`Release ${component.releaseKey} not found`), { code: "not-found-release" });
    }
    const id = this.genId();
    this.components.set(key, { ...component, id });
    return { created: true, id };
  }

  async findComponentsByRelease(releaseKey: string): Promise<RightsComponent[]> {
    const out: RightsComponent[] = [];
    for (const c of this.components.values()) {
      if (c.releaseKey === releaseKey) {
        const { id: _id, ...rest } = c;
        out.push(rest as RightsComponent);
      }
    }
    return out;
  }

  async recordGrant(
    grant: OperationGrant & { componentKey: string },
  ): Promise<{ created: boolean; id: string }> {
    const list = this.grants.get(grant.componentKey) ?? [];
    // Territory/language/operation tuple uniqueness
    const existing = list.find(
      (g) =>
        g.operation === grant.operation &&
        g.territory === grant.territory &&
        g.languageTag === grant.languageTag,
    );
    if (existing) {
      if (existing.state !== grant.state || existing.provenance !== grant.provenance) {
        throw Object.assign(new Error(`Changed grant payload for ${grant.componentKey}:${grant.operation} rejected`), {
          code: "conflict-changed-payload",
        });
      }
      return { created: false, id: existing.id };
    }
    // Ensure component exists (at least one component with this key)
    const hasComponent = [...this.components.values()].some((c) => c.componentKey === grant.componentKey);
    if (!hasComponent) {
      throw Object.assign(new Error(`Component ${grant.componentKey} not found`), { code: "not-found-component" });
    }
    const id = this.genId();
    const entry = { ...grant, id };
    list.push(entry);
    this.grants.set(grant.componentKey, list);
    return { created: true, id };
  }

  async listGrantsForComponent(componentKey: string): Promise<OperationGrant[]> {
    const list = this.grants.get(componentKey) ?? [];
    return list.map(({ id: _id, ...rest }) => rest as unknown as OperationGrant);
  }

  async recordApproval(approval: ApprovalRecord, actor: PrivilegedActor): Promise<{ created: boolean; id: string }> {
    assertPrivileged(actor);
    // Validate digest-bound
    if (!approval.subjectDigest.match(/^sha256:[0-9a-f]{64}$/)) {
      throw Object.assign(new Error("approval digest not bound"), { code: "digest-not-bound" });
    }
    const list = this.approvals.get(approval.subjectKey) ?? [];
    // Idempotent if exact same record (same subjectDigest+reviewer+decision+createdAt) already exists
    const duplicate = list.find(
      (a) =>
        a.subjectDigest === approval.subjectDigest &&
        a.reviewerId === approval.reviewerId &&
        a.decision === approval.decision &&
        a.createdAt === approval.createdAt,
    );
    if (duplicate) {
      return { created: false, id: duplicate.subjectKey };
    }
    // Append-only: allow new revision (later createdAt) even if prior was approved and new is rejected (revocation)
    list.push(approval);
    // Keep sorted by createdAt for evaluator's findLatestApproval
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    this.approvals.set(approval.subjectKey, list);
    return { created: true, id: approval.subjectKey };
  }

  async listApprovalsForSubject(subjectKey: string): Promise<ApprovalRecord[]> {
    return [...(this.approvals.get(subjectKey) ?? [])];
  }

  async recordAuditReceipt(receipt: AuditReceipt): Promise<{ created: boolean }> {
    const existing = this.audits.get(receipt.attemptId);
    if (existing) {
      // Idempotent if same digests/decision
      const same =
        existing.requestDigest === receipt.requestDigest &&
        existing.releaseDigest === receipt.releaseDigest &&
        existing.decision === receipt.decision;
      if (!same) {
        throw Object.assign(new Error(`Changed audit payload under attempt ${receipt.attemptId} rejected`), {
          code: "conflict-changed-payload",
        });
      }
      return { created: false };
    }
    this.audits.set(receipt.attemptId, receipt);
    return { created: true };
  }

  async findAuditByAttempt(attemptId: string): Promise<AuditReceipt | null> {
    return this.audits.get(attemptId) ?? null;
  }

  async evaluateAuthorization(request: AuthorizationRequest): Promise<AuthorizationResult> {
    // Gather required data from in-memory store
    const release = await this.findReleaseByKey(request.releaseKey);
    if (!release) {
      return { allowed: false, reason: "release not found", deniedCode: "invalid-release" };
    }
    const grants = await this.listGrantsForComponent(request.componentKey);
    // Need approvals for subjectKey = releaseKey:componentKey
    const subjectKey = `${request.releaseKey}:${request.componentKey}`;
    const approvals = await this.listApprovalsForSubject(subjectKey);
    // Delegate to pure evaluator from content-schema (fail-closed, digest-bound, expiry, etc.)
    // We synthesize a SourceRelease-like object expected by pure evaluator: need full release
    const fullRelease = release as SourceRelease;
    // Use pure function
    const result = evaluateAuthorizationPure(request, grants, approvals, fullRelease);
    // Record audit receipt (safe: only digests, not protected payload)
    const receipt = createAuditReceipt(
      `eval:${request.releaseKey}:${request.componentKey}:${request.operation}`,
      request,
      result,
      fullRelease,
      grants,
      approvals,
    );
    // Best-effort audit; ignore conflict for idempotent eval
    try {
      await this.recordAuditReceipt(receipt);
    } catch {
      // ignore audit conflict for repeated eval
    }
    return result;
  }
}
