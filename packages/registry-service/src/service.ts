import type { RegistryRepository, PrivilegedActor } from "./repository";
import type {
  SourceRelease,
  RightsComponent,
  OperationGrant,
  ApprovalRecord,
  AuthorizationRequest,
  AuthorizationResult,
} from "./types";

/**
 * Narrow server-side service for Task 07B.
 * - Typed repository interface
 * - Append-only transitions
 * - Authorization evaluator (exact release/component/operation/context/policy + valid approval)
 * - Idempotency, revocation/supersession, safe audit receipts
 * - No public client can authorize; only privileged server identity can record decisions
 */
export class RegistryService {
  constructor(private readonly repo: RegistryRepository) {}

  // --- Acquisition request recording (admit verified release) ---

  async admitRelease(
    release: SourceRelease,
    actor: PrivilegedActor,
  ): Promise<{ created: boolean; id: string }> {
    // Only privileged can admit releases
    if (!actor.isPrivileged) {
      throw Object.assign(new Error("Only service_role can admit releases"), {
        code: "forbidden-not-privileged",
      });
    }
    return this.repo.recordRelease(release);
  }

  async admitComponent(
    component: RightsComponent,
    actor: PrivilegedActor,
  ): Promise<{ created: boolean; id: string }> {
    if (!actor.isPrivileged) {
      throw Object.assign(new Error("Only service_role can admit components"), {
        code: "forbidden-not-privileged",
      });
    }
    return this.repo.recordComponent(component);
  }

  async grantOperation(
    grant: OperationGrant & { componentKey: string },
    actor: PrivilegedActor,
  ): Promise<{ created: boolean; id: string }> {
    if (!actor.isPrivileged) {
      throw Object.assign(new Error("Only service_role can grant operations"), {
        code: "forbidden-not-privileged",
      });
    }
    return this.repo.recordGrant(grant);
  }

  async recordApproval(
    approval: ApprovalRecord,
    actor: PrivilegedActor,
  ): Promise<{ created: boolean; id: string }> {
    return this.repo.recordApproval(approval, actor);
  }

  // --- Authorization: exact release/component/operation + context + policy + valid approval ---

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    // Fail-closed: evaluator requires exact match; unknown/expired/revoked => denied
    // This method is exposed to server-side callers only; public clients must not call directly.
    // The Narrow API does not expose broad CRUD — only this evaluation plus append-only admits.
    return this.repo.evaluateAuthorization(request);
  }

  // --- Convenience: check if request is allowed (throws on denied with code) ---

  async requireAuthorization(request: AuthorizationRequest): Promise<void> {
    const result = await this.authorize(request);
    if (!result.allowed) {
      throw Object.assign(new Error(`Authorization denied: ${result.reason}`), {
        code: result.deniedCode ?? "denied",
        result,
      });
    }
  }
}

// Helper to create a privileged service actor for tests/synthetic seeds
export function serviceActor(
  principalId = "service-role-test",
): PrivilegedActor {
  return { principalId, role: "service_role", isPrivileged: true };
}

export function unprivilegedActor(principalId = "anon-test"): PrivilegedActor {
  return { principalId, role: "anon", isPrivileged: false };
}
