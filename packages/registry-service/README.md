# Registry Service — Task 07B

Narrow server-side repository/service that records acquisition requests, admits verified releases, and evaluates one exact `release/component/operation` authorization per `docs/DATA_MODEL.md:43` + `packages/content-schema/src/registry.ts:1`.

## Architecture

- `src/repository.ts` — `RegistryRepository` interface (typed, no broad CRUD).
- `src/inMemoryAdapter.ts` — in-memory Postgres-faithful adapter (unique `releaseKey`, append-only approvals, idempotent no-op vs changed-payload reject, safe audit receipts with only digests).
- `src/service.ts` — `RegistryService` (privileged checks, `authorize` delegates to `evaluateAuthorizationPure` fail-closed, `admitRelease`/`admitComponent`/`grantOperation`/`recordApproval` require `service_role`).
- `src/cli.ts` — narrow CLI (`--releaseKey --componentKey --operation`), server-side only, never logs protected payload.

`private_registry.*` tables live in `supabase/migrations/20260914000001_private_registry_init.sql:1`; `service_role` bypasses RLS, `anon`/`authenticated` denied.

## Usage (test / local)

```ts
import { InMemoryRegistryRepository } from "@bible-compass/registry-service/src/inMemoryAdapter";
import { RegistryService, serviceActor } from "@bible-compass/registry-service/src/service";

const repo = new InMemoryRegistryRepository();
const service = new RegistryService(repo);
const actor = serviceActor();

await repo.recordSource({ sourceKey: "source:stepbible:tipnr", publisher: "STEPBible" });
await service.admitRelease(release, actor);
await service.admitComponent(component, actor);
await service.grantOperation(grant, actor);
await service.recordApproval(approval, actor);

const result = await service.authorize({ releaseKey, componentKey, operation });
```

## Guarantees

- Authorization requires exact `releaseKey` + `componentKey` + `operation` + valid `ApprovalRecord` digest-bound (`subjectDigest sha256`) + not expired/revoked/prohibited.
- `unknown`/`expired`/`revoked`/`denied` → `allowed:false` fail-closed.
- Idempotent retries with same digest are no-ops; changed bytes under same `releaseKey` reject (`conflict-changed-payload`).
- Only `service_role` (`isPrivileged:true`) can `recordApproval`/`admitRelease`; `anon`/`authenticated` → `forbidden-not-privileged`.
- Audit receipts (`private_registry.audit_receipts`) store only `sha256` digests, never raw payload — no protected source data in logs.
- No authorization from Markdown; `OPEN_BIBLE_DATA_SOURCES.md` remains candidate_only.

## Tests

`npm --prefix packages/registry-service run test` — 12 tests covering all Task 07B acceptance criteria.

## Next

Task 08 will use this service to gate `content/quarantine/**` acquisition (dry-run authorization before any network/file mutation).
