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

// Typed repository interface — infrastructure adapters implement this
// per ARCHITECTURE.md: Infrastructure adapter -> Repository interface
export interface RegistryRepository {
  // Sources
  recordSource(source: SourceRecord): Promise<{ created: boolean; id: string }>;
  findSourceByKey(sourceKey: string): Promise<SourceRecord | null>;

  // Releases — idempotent, changed payload under same releaseKey rejects
  recordRelease(release: SourceRelease): Promise<{ created: boolean; id: string }>;
  findReleaseByKey(releaseKey: string): Promise<SourceRelease | null>;

  // Components — unique (release_id, component_key)
  recordComponent(component: RightsComponent): Promise<{ created: boolean; id: string }>;
  findComponentsByRelease(releaseKey: string): Promise<RightsComponent[]>;

  // Grants
  recordGrant(grant: OperationGrant & { componentKey: string }): Promise<{ created: boolean; id: string }>;
  listGrantsForComponent(componentKey: string): Promise<OperationGrant[]>;

  // Approvals — append-only, revocation via latest decision
  recordApproval(
    approval: ApprovalRecord,
    actor: PrivilegedActor,
  ): Promise<{ created: boolean; id: string }>;
  listApprovalsForSubject(subjectKey: string): Promise<ApprovalRecord[]>;

  // Audit
  recordAuditReceipt(receipt: AuditReceipt): Promise<{ created: boolean }>;
  findAuditByAttempt(attemptId: string): Promise<AuditReceipt | null>;

  // Authorization evaluator (deterministic, fail-closed)
  evaluateAuthorization(
    request: AuthorizationRequest,
  ): Promise<AuthorizationResult>;
}

export interface PrivilegedActor {
  principalId: string;
  role: "service_role" | "rights_reviewer" | "product_owner" | "editorial_reviewer" | "anon" | "authenticated";
  isPrivileged: boolean;
}

export const PRIVILEGED_ROLES: ReadonlySet<string> = new Set([
  "service_role",
]);

export function assertPrivileged(actor: PrivilegedActor): void {
  if (!actor.isPrivileged || actor.role !== "service_role") {
    throw Object.assign(new Error(`Only privileged server identity can record decisions (actor ${actor.principalId} role ${actor.role} denied)`), {
      code: "forbidden-not-privileged",
    });
  }
}
