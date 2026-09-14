# agent_implementation

Al-Agent Next Implementation Plan

Status and objective

plan_version: 12
plan_status: ACTIVE
state_revision: 13
active_task: "05"
active_task_status: READY
active_attempt_id: null
active_dispatch_envelope_sha256: null
active_controller_lease_id: null
state_receipt_id: state-r13-task04-done-05ready-20260914T124824Z
state_receipt_sha256: e666b32726b181d0d26bdcd058699e66ebf3c479804e2f1d9c8af19a00ae59a8
last_completed_task: "04"

state_updated_at: "2026-09-14T12:48:24Z"
state_updated_by: "owner:theone (controller bootstrap-trust-v1)"

This is the step-by-step execution plan for converting the accepted logical context architecture
into executable contracts, evaluating external data for Nehemiah 2, and preparing a secure
Supabase staging implementation. Give an agent exactly one task block at a time. Do not ask one
agent to "continue with the plan," implement several tasks, or infer approval for the next task.
The target outcome is a reproducible Nehemiah 2 candidate-data pipeline and staging backend. It is
not whole-Bible publication. Full-Bible contextual coverage remains outside the first MVP.

Instructions to every Al agent opening this file
This file is an execution state machine, not a list of suggestions.
1. Read the status block and task ledger below.

not authorize a worker to self-dispatch.

an exact task card. That instruction is not sufficiently bounded.

when performing an explicitly assigned read-only plan review.

updating this ledger.

not choose one silently.

Completed planning prerequisites

orovals.
Status Evidence
arequisite Meaning
re曰on唯曰xtarchtecture DONE CONTEXT_PLATFORM SPEC. Logical design exists
crication specifications d and companion

erdennodelree DONE CONTEXT_MODEL REVIEW.nd Design findings recorded
二三三二十十二二十十年 DONE ADR-003 Logical model selected
ton migrationsstilabsent
一一一一一一一一 DONE md OPEN_BIBLE_DATA_SOURCES Candidates documented:
moneapproved
DONE This document version 1.2.0 Task definitions are ready;
execution awaitsGateo

conflict task this gest-
DONE
recelpt ROGRESS releases, or external-Al
dispatch RESS or pubLished
PASS
FAILED

plan_status is plan-level st usable but the queue has OGRESS nsitions: OGRESS -> DONE nses,
Status BLOCKED READY ONE SUPERSEDED SUPERSEDED
ls Invent Sc

Controller protocor
The orchestrating agent must follow this protocol for every task:

explicitly allowed, and that no open stop condition remains.
2. Send only the current task block, plus the repository path and relevant prior handoff artifacts.
3. Require the worker to restate outcome, affected files/contracts, out-of-scope work, and planned
validation before editing.
4. Require git status --short before editing. Existing changes belong to the owner unless the
handoff proves otherwise.
5. Permit changes only to the task's Allowed changes paths.
6. Do not let implementation and independent review happen in the same agent turn.
7. Require all named commands and tests. A command that was not run must be reported as not run.
8. Require the standard handoff below. Reject "done" without evidence.
9. Assign the next task only after checking the current exit gate.
10. At an owner gate, stop the queue until the exact decision is recorded. Silence is not approval.
The controller is a distinct trusted orchestration principal, never the worker or a subagent of
the worker for the same attempt. Before dispatch, it must hold a compare-and-swap lease in the
trusted orchestration audit store, bound to plan version, state revision, repository-state digest,
task key, and attempt ID. A second or stale controller must fail closed rather than overwrite the
card grants no authority. lease. Editing this Markdown file, claiming to be the controller, or constructing an unsigned JSON
Execution-state update protocol
Before dispatch:
1. Verify the prior handoff/gate receipt and repository-state receipt.
2. Verify exactly one ledger row is READY and it matches active_task.
3. Create a new immutable attempt ID and task card with concrete paths and commands.
4. Change only that row from READY to IN_PROGRESS ; keep every later row BLOCKED .
5. Build and authenticate the envelope against the prior authenticated READY -state receipt. The
envelope must not reference the not-yet-created IN_PRoGREss state/dispatch receipt.
6. Use compare-and-swap against that prior receipt to acquire the controller lease and create a
separate authenticated dispatch receipt. The dispatch receipt binds the finalized envelope
READY -> IN_PROGRESS transition. digest, task key, attempt ID, lease ID, repository receipt, prior/new state revisions, and the
7. Atomically project the new state into the top status block and ledger, including the attempt,
dispatch-envelope digest, lease, dispatch/state-receipt ID/digest, and state-update timestamp.
Persist this before sending both envelope and dispatch receipt to the worker. Any
state/ledger/lease/receipt mismatch blocks dispatch.
After handoff:
1. Independently reproduce required commands and verify output artifact/validation digests.
2. If verification passes and no human gate follows, mark the task DoNE and append execution
history. Leave already-terminal DoNE / OMITTED rows unchanged, scan forward in ledger order,
and mark exactly one earliest nonterminal successor READY only when its complete dependency
successor or null when none is eligible. predicate is satisfied; otherwise stop at the pending blocker/gate. Update active_task to that
3. If a human gate follows, mark the task DoNE, set the gate AWAITING_DECISION, append
execution history, and set active_task: null. Do not mark a successor ready.
4. If verification fails, mark the attempt FAILED or BLOCKED, append execution history, set
5. Never rewrite or delete an old history row A ret active_task: null, and dispatch nothing until a new corrective attempt is authorized.

Every after-handoff transition increments state_revision, clears the completed attempt's active
lease, and writes a new authenticated state receipt with compare-and-swap semantics.
Changing the ledger is orchestration bookkeeping, not part of the worker's allowed file changes.
The worker reports status; only the controller records it.
Agents may use subagents only when the assigned task explicitly permits parallel read-only review.
Subagents may not share editing ownership of the same files.

Required dispatch envelope
The controller wraps the selected task block in a system-owned task card. Agents may not alter the
card, its scope, or its prerequisite digests:

{
"task_schema_version": "1.0.0",
"task_key": "07",
"attempt_id": "task:context-pipeline:07:attempt-1",
"resolved_task_block": {
"encoding": "UTF-8",
"media_type": "text/markdown",
"content": "<exact complete resolved task bytes for this task key only>"
},
"resolved_task_block_sha256": "<digest of the exact UTF-8 content bytes above>",
"plan_version": "1.2.0",
"plan_definition_sha256": "<digest of task definitions, excluding mutable state views>",
"prior_ready_state_revision": 1,
"prior_ready_state_receipt_id": "<authenticated READY-state receipt>",
"prior_ready_state_receipt_sha256": "<digest>",
"repository_state_receipt": "<commit or approved working-tree receipt>",
"issuer": {
"principal_id": "<trusted controller principal>",
"role": "CONTROLLER",
"authorization_receipt_id": "<controller authorization receipt>",
"authorization_receipt_sha256": "<digest>"
},
"issued_at": "<server timestamp>",
"expires_at": "<server timestamp>",
"prerequisites": [
{
"artifact_key": "handoff:task-06",
"sha256": "<verified digest>",
"controller_verification_receipt_id": "<immutable receipt ID>",
"controller_verification_receipt_sha256": "<digest>",
"ledger_transition_revision": 1,
"required_task_status": "DONE"
}
],
"gate_receipts": [],
"allowed_paths": ["<exact path or path prefix>"],
"forbidden_paths": ["<exact path or path prefix>"],
"required_rights_operations": [],
"acceptance_commands": ["<exact command>"],
"expected_artifacts": ["<artifact key and path>"],
"successor_task_keys": ["<exact allowed successor task key>"],
"requires_owner_gate": false,
"envelope_authentication": {
"mode": "record",
"algorithm": "<owner-approved signature or MAC algorithm>",
"key_id": "<approved controller key ID>",

"record_id": "<immutable authentication record ID>",
enecnrd sha256", "<diaest of

the worker does not choose one version.
The trusted orchestration system signs or MACs the canonical envelope. Authentication is a tagged
union: mode: "record" requires only record_id and record_sha256; mode: "inline" requires only

and canonical-envelope digest. The example above uses record mode.
After authenticating the envelope, the controller creates a separate authenticated dispatch/lease
receipt that binds the envelope digest and records the compare-and-swap transition to
IN_PRoGREss ; this avoids circular hashing. The worker receives and verifies both objects,
including issuer authority, signature/MAC, timestamps, plan/task/prior-state digests, active lease,
repository-state receipt, prerequisites, gates, rights, and path boundaries. A missing, expired,
revoked, or changed proof produces BLockED ; it is not recreated or waived by the worker.
Every owner gate produces an authenticated, append-only machine-readable receipt containing the
gate ID/version, exact subject artifact keys and digests, human actor/role, decision, constraints,
server timestamp, expiry, revocation/supersession state, and permitted next task IDs. A Markdown
edit or conversational "looks good" does not release the queue.
Bootstrap trust before Task 00 and Task 07A
Bootstrap Gate 0 is a prerequisite outside the Al task queue. The owner must appoint the initial
human actors and controller principal and approve a receipt/lease service before Task 00 becomes
READY. Gates A1, A2, and B then use that owner-approved service outside the repository because the
private operational registry does not exist yet. Markdown or an agent-created file is not a trust
mechanism.
The bootstrap service provides authenticated actor identity, canonical JSON serialization,
SHA-256 digesting, detached signature or MAC verification, server timestamps, compare-and-swap
controller leases, append-only/WORM retention, expiry, revocation, supersession, and audit export.
Its service/configuration identifier is recorded in Gate 0 and every early receipt. Task 07A imports
and verifies the full bootstrap audit export without changing its original IDs, bytes, digests,
signatures, or timestamps. If no such approved mechanism is available, Gate 0 remains
AWAITING_DECISION，Task O0 remains BLOCKED,and no Al implementation task is dispatched.

Standard handoff contract
Every worker returns:
1. Task ID and result: PASS，FAIL，BLOCKED，or OWNER_ACTION_REQUIRED
2. User-visible outcome
3. Files changed, with purpose
4. Commands executed and exact results
5. Automated tests added or changed
6. Manual checks completed and checks not run
7. Database migrations, RLS, permissions, dependencies, or configuration changes
8. Source artifacts, versions, checksums, license components, and provenance affected
9. Known limitations, rejected records, open questions, and follow-up work
10. Confirmation that no content was approved or published by Al
11. Task attempt and repository revision/working-tree receipt before and after
12. Prerequisite artifact keys/digests and approval receipt IDs/digests consumed
13. Every output artifact key, path, digest, validation-report digest, and supersession state
14. Whether every output contains real, synthetic, licensed, or Al-generated data
The controller records the handoff hefore dionete

The plan is authored, but Bootstrap Gate O is AWAITING_DECISION ; therefore no task is currently
dispatchable. After a valid Gate 0 receipt, the appointed controller may atomically mark Task 00 as
the sole READY task. Task 00 has no allowed worker changes and requires a read-only baseline
handoff. This prose is explanatory and never acts as a third execution lock.

Authoritative task-status ledger

The controller updates this table only after validating an immutable handoff or gate receipt. A
worker treats every BLockED row as non-executable even if it believes it can do the work.

Order Task Status Blocked by / required Exit gate or output
input

00 Baseline and conflict DONE Bootstrap Gate 0 PASSED Repository-state
audit receipt handoff (attempt task:baseline:00:attempt-1 lease lease-00-attempt-1-20260914T111317Z handoff docs/handoffs/task-00-baseline.json sha d6769c963d8e)

01 Owner decision DONE Task 00 DONE Owner Gate A1 packet (attempt task:owner-decision:01:attempt-1 handoff docs/handoffs/task-01-packet.json sha ef5d052f packet docs/OWNER_GATE_A1_PACKET.md sha 91555a0d)

02 Canonical identifier DONE Gate A1 PASSED (receipt gate-A1-v1-20260914T115751Z sha 4cc1b7dc810f) Identifier specification
contract (attempt task:canonical-id:02:attempt-1 handoff docs/handoffs/task-02-identifiers.json sha 287b8dab spec docs/CANONICAL_IDENTIFIERS.md sha 91d92f2f)

03 Physical model and DONE Task 02 DONE Owner Gate A2 (attempt task:physical-model:03:attempt-1 handoff docs/handoffs/task-03-physical-model.json sha 287d6438 spec docs/DATA_MODEL.md sha 4153b51f proposal docs/DOMAIN_WORKSPACE_PROPOSAL.md sha 7f5dbc4e)
dependency proposal packet

04 Domain and content- DONE Gate A2 PASSED (receipt gate-A2-v1-20260914T123525Z sha 26f517c69a5a) Executable schemas (attempt task:domain-workspace:04:attempt-1 handoff docs/handoffs/task-04-workspace.json sha 2bb7032d packages/domain,content-schema)
schema workspace

05 Golden adoption READY Task 04 DONE Fixture matrix I
fixtures

6 Independent BLOCKED Task 05 DONE Architecture Gate B
adoption-gate review packet

Operational source- BLOCKED Gate B receipt Registry schemas
registry contract

7A Private registry BLOCKED Task 07 DONE Registry DB handoff
migration and
privileges

7B Registry service and BLOCKED Task O7A DONE Authorization service
authorization
evaluator

8 Acquisition and BLOCKED Task O7B DONE Safe acquisition
quarantine tooling tooling

9 Exact acquisition- BLOCKED Task 08 DONE Owner/Rights Gate C1
request packet packet

9A Acquire opaque BLOCKED Gate C1 TVTMS TVTMS receipt or
TVTMS artifact selection or omission OMITTED
receipt

9B Acquire opaque BLOCKED Task 09A resolved TIPNR receipt or
TIPNR artifact and TIPNR Gate C1 OMITTED
selection/omission
receipt

09C Acquire opaque BLOCKED Task 09B resolved BibleData receipt or
BibleData artifact(s) and BibleData Gate OMITTED
C1 selection/omission
receipt

09D Acquire opaque BLOCKED Task 09C resolved MACULA receipt or
MACULA Hebrew and MACULA Gate C1 OMITTED
artifact selection/omission
receipt

09E Acquire opaque BLOCKED Task 09D resolved
OpenBible artifact OpenBible receipt or
and OpenBible Gate OMITTED
C1 selection/omission
receipt

9F Exact- BLOCKED Tasks 09A-09E Owner/Rights Gate C2
byte/component resolved as packet
decision packet DONE/OMITTED

0 TVTMS reference- BLOCKED TVTMS Gate C2 Reference mappings
mapping adapter receipt or authorized or OMITTED
source omission

7 TIPNR proper-name BLOCKED Task 10 DONE plus Named candidates or
adapter TIPNR Gate C2 OMITTED
receipt, or TIPNR
omission receipt

2 BibleData BLOCKED Task 11 DONE plus Comparison report or
discrepancy adapter BibleData Gate C2 OMITTED
receipt, or BibleData I
omission receipt

3 MACULA Hebrew BLOCKED Task 12 resolved, Linguistic candidates
linguistic adapter Task 10 DONE,plus or OMITTED
MACULA Gate C2
receipt; or MACULA
omission receipt

4 OpenBible BLOCKED Task 13 resolved, Geographic
geographic adapter Task 11 DONE,plus candidates or
OpenBible Gate C2 OMITTED
receipt; or OpenBible
omission receipt

5A Identity and BLOCKED Tasks 10-14 resolved Identity/attestation
attestation as DONE/OMITTED proposals
reconciliation

5B BSB mention-selector BLOCKED Task 15A D0NE and Edition mentions
generation exact BSB
rights/edition receipt

6A Pilot report BLOCKED Task 15B DONE Digest-bound pilot
generation report

6B Independent pilot BLOCKED Task 16A DONE Owner Gate D packet
review

7A Canon/reference/editi BLOCKED Gate D receipt Scripture/reference
on staging migrations schema

17B Knowledge/claim/cont BLOCKED Task 17A DONE Knowledge schema
ext staging migrations

17C Review/package BLOCKED Task 17B DONE Secure staging
schemas, projections, schema
and RLS

18 Idempotent candidate BLOCKED Task 17C DONE Candidate import
import service handoff

8A External-Al input BLOCKED Task 18 DONE Owner/Rights Gate D2
authorization packet packet

9A Al curation input- BLOCKED Gate D2 receipt Deterministic input
bundle assembler bundle

9B One-attempt provider BLOCKED Task 19A DONE Raw-response receipt
runner

9C Al submission BLOCKED Task 19B DONE Validated/rejected
validator and draft
quarantine

OA Entity/name draft BLOCKED Task 19C DONE and Task 20A draft
package Task 20A card handoff

OB Canonical-attestation BLOCKED Task 20A DONE and Task 20B draft
draft package Task 20B card handoff

20C Relationship draft BLOCKED Task 20B DONE and Task 20C draft
package Task 20C card handoff I

20D Event/place draft BLOCKED Task 20C DONE and Task 20D draft
package Task 20D card handoff

20E Passage-relevance BLOCKED Task 20D DONE and Task 20E draft
draft package Task 20E card handoff

20F Passage-context BLOCKED Task 20E DONE and Task 20F draft
draft package Task 20F card handoff

20G English-localization BLOCKED Task 2OF DONE and Task 20G draft
draft package Task 20G card handoff

20H Independent draft-set BLOCKED Task 20G DONE Draft-set review
consistency review

21 Human review-bundle BLOCKED Task 20H DONE Owner/Editorial Gate
E1 packet
construction

22 Exact approval- BLOCKED Gate E1 receipts Eligibility report
receipt verification
23 Immutable staging- BLOCKED Task 22 DONE Owner Gate E2
packet
package build

Tasks are serialized even where code could be developed independently. This keeps schema, source,
mapping, and file ownership reviewable. Parallel work is allowed only where the active task body
explicitly permits read-only specialist review.
In dependency text, resolved means DoNE or OMITTED with a valid omission receipt. It never
means FAILED，BLockED,or merely absent. Gate C1 produces a digest-bound selected-source
manifest. Every candidate source is explicitly selected, omitted_optional,or

denied_required ; the last state blocks the pilot. Tasks 09F, 15A, 16A, and 16B must carry the
reduced-source manifest forward and report its coverage and limitations.

The selected-source manifest must also be dependency-closed: TIPNR requires TVTMS reference
mappings; BibleData comparison requires TIPNR; MACULA requires TVTMS reference mappings; and
OpenBible identity matching requires TIPNR (and therefore TVTMS). Omitting a prerequisite forces
every dependent source/task to be omitted unless a reviewed plan amendment defines and validates a
replacement mapping path. The Gate C1 and C2 validators reject a non-closed selection.

Gate-state machine

Gate states are separate from task states:

NOT_STARTED -> AWAITING_DECISION
AWAITING_DECISION -> PARTIALLY_APPROVED | PASSED | DENIED
PARTIALLY_APPROVED -> PASSED | DENIED | EXPIRED | REVOKED | SUPERSEDED
PASSED -> EXPIRED I REVOKED | SUPERSEDED
DENIED -> SUPERSEDED
EXPIRED/REVOKED/SUPERSEDED -> AWAITING_DECISION only through a new gate version

PARTIALLY_APPROVED releases only task/source IDs explicitly listed in valid receipts. DENIED
releases no implementation work, but an optional source-specific denial may authorize the
controller to mark its acquisition and adapter tasks 0MITTED . Required-source denial blocks the
pilot. EXPIRED，REVOKED，and SUPERSEDED trigger transitive invalidation before any further
dispatch.

Gate-status ledger

Gate Status Produced by Human authority Releases
required I

0 PASSED (receipt gate-0-v1-20260914T110348Z sha c450dea4c3b3 @ bootstrap-trust-v1) Owner bootstrap Product owner Task 00
setup outside the appoints controller
task queue and approves
trust/lease
mechanism

A1 PASSED (receipt gate-A1-v1-20260914T115751Z sha 4cc1b7dc810f @ bootstrap-trust-v1) Task 01 DONE Product owner plus Task 02
named rights/editorial (packet docs/OWNER_GATE_A1_PACKET.md sha 91555a0d)
roles as applicable

A2 PASSED (receipt gate-A2-v1-20260914T123525Z sha 26f517c69a5a @ bootstrap-trust-v1) Task 03 DONE Product owner for Task 04
exact (spec docs/DATA_MODEL.md sha 4153b51f proposal docs/DOMAIN_WORKSPACE_PROPOSAL.md sha 7f5dbc4e)
workspace/dependen
cies

B NOT_STARTED Task 06 Independent Task 07
technical review;
owner accepts
architecture gate

C1 NOT_STARTED Task 09 Rights reviewer for Tasks 09A-09E one at
opaque a time
acquisition/retention

C2 NOT_STARTED Task 09F Rights reviewer for Tasks 10-14
exact-byte
parsing/normalization

D NOT_STARTED Task 16B Product owner Task 17A
accepts/rejects pilot

D2 NOT_STARTED Task 18A Rights reviewer for Task 19A
exact provider-bound
inputs and retention

E1 NOT_STARTED Task 21 Required specialist Task 22
reviewers for exact
review digests

E2 NOT_STARTED Task 23 Product owner Following plan only
decides whether to
plan mobile/SQLite
installation

Gate status in this Markdown file is informational. Only its authenticated receipt authorizes the
next operation.

Append-only execution history

The controller appends one row after independently validating each attempt. Never edit or remove a
prior row. Handoff locations must point to immutable or checksum-verified artifacts; do not put
secrets or protected source content in this table.

Attempt ID Task Result Handoff Handoff Validation Completed Controller
location SHA-256 receipt at
gate-0-v1-20260914T110348Z | Gate 0 | PASSED | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/gate-0-v1-20260914T110348Z.json | c450dea4c3b3143dfb327e98ecc5bc33cc30533cd7a60d3a8e557e25604e2676 | gate-0-v1-20260914T110348Z | 2026-09-14T11:03:48Z | owner:theone (bootstrap-trust-v1)
state-r1-gate0-passed-20260914T110348Z | state r1 | READY | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r1-gate0-passed-20260914T110348Z.json | ca14d59fcd668f74fae7fcad2b60695277827634bd21fdfdbc07e7f8353e145b | state-r1-gate0-passed-20260914T110348Z | 2026-09-14T11:03:48Z | owner:theone (bootstrap-trust-v1) — Task 00 READY (CAS 0→1, repo commit c65f0813)
envelope-00-20260914T111317Z | Task 00 envelope | AUTH | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/envelope-00-20260914T111317Z.json | f2419356d2027ea3b89112ed3f50eca92e4f59d3fd6ce809ad4fd3e77a5d53cf | envelope-00-20260914T111317Z | 2026-09-14T11:13:17Z | owner:theone (bootstrap-trust-v1) — attempt task:baseline:00:attempt-1
dispatch-00-20260914T111317Z | Task 00 dispatch | LEASE | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/dispatch-00-20260914T111317Z.json | 16b6a44278ed51f1b9b5f7de7deb89c0ec4d3a7f3e0e76cd91641cad42dc2d22 | dispatch-00-20260914T111317Z | 2026-09-14T11:13:17Z | owner:theone — CAS READY→IN_PROGRESS rev1→2
state-r2-task00-inprogress-20260914T111317Z | state r2 | IN_PROGRESS | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r2-task00-inprogress-20260914T111317Z.json | 3d90a7d75463328721697bc0824fd751cf78d1a13e1e8e932e909af465b4c803 | state-r2-task00-inprogress-20260914T111317Z | 2026-09-14T11:13:17Z | owner:theone — Task 00 IN_PROGRESS
task:baseline:00:attempt-1 | 00 | PASS | docs/handoffs/task-00-baseline.json | d6769c963d8e3d13da0c2ae1ea0f243cb1f831b4f6e401b6ad442b3d45ec7ca9 (raw) c96c28034350 (canon) | state-r3-task00-done-01ready-20260914T112020Z | 2026-09-14T11:20:20Z | owner:theone (bootstrap-trust-v1) — Task 00 DONE → Task 01 READY (CAS 2→3, verify PASS despite baseline type/lint/test failures attributed)
state-r3-task00-done-01ready-20260914T112020Z | state r3 | DONE→READY | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r3-task00-done-01ready-20260914T112020Z.json | da67f774c8e635c54d52900b4e34545bf94773a959ffc7734c6bd4c97eeb18f5 | state-r3-task00-done-01ready-20260914T112020Z | 2026-09-14T11:20:20Z | owner:theone — released lease-00-attempt-1-20260914T111317Z, active_task=01 READY
envelope-01-20260914T112436Z | Task 01 envelope | AUTH | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/envelope-01-20260914T112436Z.json | 33da12c04eddde7a22d54dd2271ec65d61b45a2a45fcd24360c297446d897da1 | envelope-01-20260914T112436Z | 2026-09-14T11:24:36Z | owner:theone (bootstrap-trust-v1) — attempt task:owner-decision:01:attempt-1
dispatch-01-20260914T112436Z | Task 01 dispatch | LEASE | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/dispatch-01-20260914T112436Z.json | bbbad97268f6f93985adef8185ab1c737cdf7aa29f4cf63cffd7cc63a627b895 | dispatch-01-20260914T112436Z | 2026-09-14T11:24:36Z | owner:theone — CAS READY→IN_PROGRESS rev3→4
state-r4-task01-inprogress-20260914T112436Z | state r4 | IN_PROGRESS | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r4-task01-inprogress-20260914T112436Z.json | 2454bc1e5b8253a5c17d8121379938231ba46f5e47378d0d7b5679e649142ed7 | state-r4-task01-inprogress-20260914T112436Z | 2026-09-14T11:24:36Z | owner:theone — Task 01 IN_PROGRESS
task:owner-decision:01:attempt-1 | 01 | PASS | docs/handoffs/task-01-packet.json | ef5d052ffe61 (handoff) + docs/OWNER_GATE_A1_PACKET.md sha 91555a0d | state-r5-task01-done-gatea1await-20260914T114710Z | 2026-09-14T11:47:10Z | owner:theone (bootstrap-trust-v1) — Task 01 DONE → Gate A1 AWAITING_DECISION (packet 91555a0d, no governing doc status changed)
state-r5-task01-done-gatea1await-20260914T114710Z | state r5 | DONE→GATE | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r5-task01-done-gatea1await-20260914T114710Z.json | cbcc3c97f79d6b3ef12439c3f15d9869fcb6af20b0a0c3807b70abe456c940dc | state-r5-task01-done-gatea1await-20260914T114710Z | 2026-09-14T11:47:10Z | owner:theone — released lease-01-attempt-1-20260914T112436Z, active_task=null, Gate A1 AWAITING_DECISION
gate-A1-v1-20260914T115751Z | Gate A1 | PASSED | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/gate-A1-v1-20260914T115751Z.json | 4cc1b7dc810f49c6df68dfcef6169270144543d76e34a0756ca9a33d0e4c0435 | gate-A1-v1-20260914T115751Z | 2026-09-14T11:57:51Z | owner:theone (bootstrap-trust-v1) — 14 decisions approved as packet 91555a0d, permitted_next_tasks [02]
state-r6-gatea1-passed-02ready-20260914T115751Z | state r6 | GATE→READY | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r6-gatea1-passed-02ready-20260914T115751Z.json | 1cd0a53947cfdcd54d333ccf4a3f3538f79159cfeb241aa7a5c7d1a90c05cb76 | state-r6-gatea1-passed-02ready-20260914T115751Z | 2026-09-14T11:57:51Z | owner:theone — Gate A1 PASSED CAS 5→6, active_task=02 READY
envelope-02-20260914T120106Z | Task 02 envelope | AUTH | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/envelope-02-20260914T120106Z.json | c31fb51e358e9a2905683149bf8ce555fd064fe367bf6d9126481d34c1eb7ed3 | envelope-02-20260914T120106Z | 2026-09-14T12:01:06Z | owner:theone (bootstrap-trust-v1) — attempt task:canonical-id:02:attempt-1
dispatch-02-20260914T120106Z | Task 02 dispatch | LEASE | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/dispatch-02-20260914T120106Z.json | 2e6516c30aee470b73c77e47fd750b7b1eb62bfc3c55fa68ed3e3fb2ec8178b5 | dispatch-02-20260914T120106Z | 2026-09-14T12:01:06Z | owner:theone — CAS READY→IN_PROGRESS rev6→7
state-r7-task02-inprogress-20260914T120106Z | state r7 | IN_PROGRESS | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r7-task02-inprogress-20260914T120106Z.json | b1d32cdcea051fded3ff1166e19960f392a5e3553f9cf9f7a31590c35447221b | state-r7-task02-inprogress-20260914T120106Z | 2026-09-14T12:01:06Z | owner:theone — Task 02 IN_PROGRESS
task:canonical-id:02:attempt-1 | 02 | PASS | docs/handoffs/task-02-identifiers.json | 287b8dab9010 (handoff) + docs/CANONICAL_IDENTIFIERS.md sha 91d92f2f | state-r8-task02-done-03ready-20260914T120414Z | 2026-09-14T12:04:14Z | owner:theone (bootstrap-trust-v1) — Task 02 DONE → Task 03 READY (spec 91d92f2f, route compatibility preserved)
state-r8-task02-done-03ready-20260914T120414Z | state r8 | DONE→READY | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r8-task02-done-03ready-20260914T120414Z.json | f4f14d3fd835249712bb6ac08ed41f6695d8d0b4c339fb77cee065b5282df5d6 | state-r8-task02-done-03ready-20260914T120414Z | 2026-09-14T12:04:14Z | owner:theone — released lease-02-attempt-1-20260914T120106Z, active_task=03 READY
envelope-03-20260914T122835Z | Task 03 envelope | AUTH | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/envelope-03-20260914T122835Z.json | 3e0245187f2db59937d21dd5bdeb565e25b3518dbdf27836439f9f1397082c4b | envelope-03-20260914T122835Z | 2026-09-14T12:28:35Z | owner:theone (bootstrap-trust-v1) — attempt task:physical-model:03:attempt-1
dispatch-03-20260914T122835Z | Task 03 dispatch | LEASE | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/dispatch-03-20260914T122835Z.json | 2a0f2984a8fa6fcd941fcb68120d40503d4cc0905bd29841428866cd9e3c216b | dispatch-03-20260914T122835Z | 2026-09-14T12:28:35Z | owner:theone — CAS READY→IN_PROGRESS rev8→9
state-r9-task03-inprogress-20260914T122835Z | state r9 | IN_PROGRESS | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r9-task03-inprogress-20260914T122835Z.json | 4021dc28635de2c46459f13c5800db6c5c7ff3c2999661101e7c77ce72811a39 | state-r9-task03-inprogress-20260914T122835Z | 2026-09-14T12:28:35Z | owner:theone — Task 03 IN_PROGRESS
task:physical-model:03:attempt-1 | 03 | PASS | docs/handoffs/task-03-physical-model.json | 287d6438364e (handoff) + docs/DATA_MODEL.md sha 4153b51f proposal 7f5dbc4e | state-r10-task03-done-gatea2await-20260914T123240Z | 2026-09-14T12:32:40Z | owner:theone (bootstrap-trust-v1) — Task 03 DONE → Gate A2 AWAITING_DECISION (spec 4153b51f, traceability 12/12, proposal exact pins)
gate-A2-v1-20260914T123525Z | Gate A2 | PASSED | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/gate-A2-v1-20260914T123525Z.json | 26f517c69a5ac6d2811f7f329683e61eb4e80b1fb86a04d2745bd07851fdd95e | gate-A2-v1-20260914T123525Z | 2026-09-14T12:35:25Z | owner:theone (bootstrap-trust-v1) — workspace proposal exact pins approved, permitted_next_tasks [04]
state-r11-gatea2-passed-04ready-20260914T123525Z | state r11 | GATE→READY | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r11-gatea2-passed-04ready-20260914T123525Z.json | 56c8592c6409516f09e3e939aeb8ba6cf1da639e9d18d40887d5ad78380dacd9 | state-r11-gatea2-passed-04ready-20260914T123525Z | 2026-09-14T12:35:25Z | owner:theone — Gate A2 PASSED CAS 10→11, active_task=04 READY
envelope-04-20260914T123701Z | Task 04 envelope | AUTH | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/envelope-04-20260914T123701Z.json | a162556ee0f5deba6f9dc9dc8b53856f0bcc0afd181db186ab325eed3df4fae5 | envelope-04-20260914T123701Z | 2026-09-14T12:37:01Z | owner:theone (bootstrap-trust-v1) — attempt task:domain-workspace:04:attempt-1
dispatch-04-20260914T123701Z | Task 04 dispatch | LEASE | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/dispatch-04-20260914T123701Z.json | f372ac800104f15d9991450fa879d8024c5479d65fb14b4417242f9b26db9219 | dispatch-04-20260914T123701Z | 2026-09-14T12:37:01Z | owner:theone — CAS READY→IN_PROGRESS rev11→12
state-r12-task04-inprogress-20260914T123701Z | state r12 | IN_PROGRESS | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r12-task04-inprogress-20260914T123701Z.json | ec43fb0f167b5114c02b6175bbb0d58cd010cf70571fad5675c4f32c0660ef31 | state-r12-task04-inprogress-20260914T123701Z | 2026-09-14T12:37:01Z | owner:theone — Task 04 IN_PROGRESS
task:domain-workspace:04:attempt-1 | 04 | PASS | docs/handoffs/task-04-workspace.json | 2bb7032d0ac9 (handoff) + packages/domain,content-schema | state-r13-task04-done-05ready-20260914T124824Z | 2026-09-14T12:48:24Z | owner:theone (bootstrap-trust-v1) — Task 04 DONE → Task 05 READY (domain 8 tests, schema 9 tests, fresh install exact pins)
state-r13-task04-done-05ready-20260914T124824Z | state r13 | DONE→READY | /var/folders/xh/rxz8t6cs06jc_k4p0bqt62180000gn/T/opencode/bible-compass-bootstrap-trust/receipts/state-r13-task04-done-05ready-20260914T124824Z.json | e666b32726b181d0d26bdcd058699e66ebf3c479804e2f1d9c8af19a00ae59a8 | state-r13-task04-done-05ready-20260914T124824Z | 2026-09-14T12:48:24Z | owner:theone — released lease-04-attempt-1-20260914T123701Z, active_task=05 READY

Controller integrity invariants

Validate all of these conditions before and after every status edit. If any condition fails, set
plan_status: BLockED, set active_task: null, describe the inconsistency in a new execution-history
row, and dispatch nothing until a reviewed repair restores the invariants.
The task ledger contains every task ID defined below exactly once. Grouped headings such as
Tasks 09A-09E and Tasks 20A-20G still represent separately dispatched ledger rows.
At most one task is READY or IN_PRoGRESs . When one exists, its ID and status exactly match
active_task and active_task_status in the top status block.
A READY task satisfies every dependency edge's declared terminal-status predicate. This is
normally DONE ; an edge that explicitly permits. resolved may use OMITTED only with its valid
omission receipt. Every required gate has a valid, unexpired, unrevoked receipt whose
permitted-next-task list contains that task ID.
Every IN_PRoGREss task has exactly one immutable attempt ID, dispatch-envelope digest, and
repository-state receipt recorded before worker execution begins.
Every DONE, FAILED,BLOCKED，OMITTED,or SUPERSEDED attempt has an
append-only execution-history row with a handoff or decision receipt and its digest.
A task cannot be DoNE when a required acceptance command was skipped, failed, or produced
unverifiable output. The controller records such an attempt as FAILED or BLOCKED.
A gate cannot release work based only on this Markdown status. The controller verifies the
authenticated gate receipt against the exact subject artifact digests.
Task wording, allowed paths, acceptance criteria, or dependency edges never change during an
active attempt. A reviewed task-definition change increments plan_version, invalidates stale
resolved-task-block digests, and receives a new attempt.
Status-only updates do not alter task bodies, acceptance criteria, prior history rows, artifact

contents, or approval recelpts.
The next task remains BLockED until the current worker has stopped and the controller has
independently accepted its handoff. A worker response cannot both nish one task and begin the
next.

Transitive invalidation and correction attempts

revoked, expired, changed, or superseded, the controller immediately cancels the active lease,
interrupts affected work, and computes the full descendant set. Affected completed outputs become
SUPERSEDED ; affected ready/in-progress work becomes BLOCKED ; none remains publishable or usable
as a prerequisite. The controller then selects the earliest invalid task, creates a new attempt of
that same task key, and makes only that row READY after valid prerequisites are restored.
A correction that stays inside an existing task's scope uses the same task key and a new immutable
attempt ID; old attempts and artifacts remain in history. A correction that changes scope, allowed
paths, dependencies, or acceptance criteria requires a reviewed plan amendment, a plan_version
increment, a new task-definition digest, descendant invalidation, and an explicit ledger row before
dispatch. Reviewers do not invent or execute correction tasks in their review turn.

Task O0 - Baseline and conflict audit

Task
Establish the exact repository, documentation, test, dependency, and worktree baseline without
changing files.
User value
Prevents an agent from overwriting current work or designing against stale contracts.
Read first
AGENTS. md,every document in its "Read before editing" list, ADR-001, ADR-003,
CONTEXT_PLATFORM_SPEC.md，CONTEXT_MODEL_REVIEW.md，and relevant existing tests.
In scope
Inspect tracked/untracked changes and identify likely ownership overlap
Inventory packages, scripts, tests, Supabase state, and content fixtures
Run the existing verification command
Compare current implementation to ADR-003's next steps

Out of scope

Allowed changes
None.
Forbidden changes
Do not format, stash, reset delete rename or "fiv" onud

Handoff lists every changed/untracked path and flags overlapping ownership risk
Existing test status is reported with exact failures
Missing repository foundations are listed without implementing them
Active architecture and open owner decisions are correctly identified

Tests
Run the current mobile verification suite unchanged.

Commands

git status --short
rg --files
npm --prefix apps/mobile run verify

Stop conditions
Stop with BLockEd if required documents conflict, the worktree contains ambiguous overlapping
changes, or baseline failures cannot be attributed without editing.
Required handoff
Standard handoff plus a prerequisite matrix for Tasks 01-04.

Task 01 - Owner decision packet

Task

source evaluation work. Prepare one decision packet containing every owner answer required before executable schema and

User value

the responsible humans. Lets Al do all preparatory research while keeping legal, product, and editorial authority with

Read first

ADR-OO3,and OPEN_BIBLE_DATA_SOURCES.md.
In scope
Draft recommended choices and evidence fields for:

EJitnriallons d

External-Al processing, retention, training, and embedding permission per source component
Raw-source retention and quarantine policy
• Root workspace/package changes and exact new dependency versions, if needed

Out of scope
Choosing reviewers, granting rights, signing approvals, importing content, or changing product
behavior.

Allowed changes
Documentation decision packet only. Update governing decision/rights documents only with exact
owner-provided decisions, never inferred decisions.

Forbidden changes
Do not change OPEN to DECIDED, allowed, or approved based on Al research alone.

Acceptance criteria
Every decision has recommendation, alternatives, impact, required evidence, and named owner
Pilot reading and context ranges are explicit; neither defaults silently to Neh.2.1-Neh.2.8
Unknowns remain visibly unknown and fail closed
Exact source components and intended operations are separated
Packet ends with a sign-off table and no pre-filled human approval

Tests
Check internal links, decision-ID consistency, and absence of contradictory rights statements.
Commands

git diff --check
rg n "OPEN|OWNER ACTIONlapprovedlallowed" docs/PRODUCT_DECISIONS.md docs/CONTENT_RIGHTS.md
docs/CONTEXT_PLATFORM_SPEC.md docs/OPEN_BIBLE_DATA_SOURCES.md

Stop conditions
Return OWNER_ACTION_REQUIRED until the owner and required rights/editorial reviewers record the
decisions. Al cannot pass Owner Gate A1.

Required handoff
Standard handoff plus a decision table of resolved, open, and blocking items.

Owner Gate A1

Task
Make the reference-system-qualified identifiers in ADR-003 precise as a documentation contract,
without changing code or the existing reader's public routes.

User value
Prevents one English versification or translation spelling from becoming global identity.

Read first
Gate A1 decisions, CANONICAL_IDENTIFIERS.md,ADR-001, ADR-003,
CONTEXT_DATA_ARCHITECTURE.md,and current reference parser/tests.

In scope
• Define canon, reference system, work, reference-unit, scope, translation-work,
translation-edition, source, source-release, and candidate key grammars
Define qualified resolution envelopes and external namespace keys
Preserve existing public Neh.2/Neh.2.1-Neh.2.8 route strings as presentation identifiers
Specify parser/validation examples for invalid, split, merged, reordered, and ambiguous references

Out of scope
Database migrations, source imports, Ul redesign, or changing published routes.
Allowed changes
docs/CANONICAL_IDENTIFIERS.md only.
Forbidden changes
No global bare-verse database identity, localized-name identity, invented canonical entity key, or
silent route break.

Acceptance criteria
Every Scripture identifier resolves with a named reference system
Translation work and immutable edition keys are distinct
Source release keys cannot be confused with source identity keys
Existing public route syntax remains unchanged in the documented compatibility table
Expected typed-error cases are specified for Task 04 to implement

Tests
Static example review for all key grammars, old route compatibility, Unicode rejection where AsCll
is required, and split/merge examples. Executable tests are added in Task 04.
Commands
npm --prefix apps/mobile test reference.test.ts
git diff

Stop conditions

system conflicts with existing stored reader state.
Required handoff
Standard handoff plus an identifier compatibility table.

Task 03 - Nehemiah 2 physical data-model specification and dependency propos

Task
Translate ADR-O03's logical architecture into a concrete, DDL-ready first slice for Nehemiah 2.

User value
Creates one implementable relational graph without prematurely migrating the full future model.
Read first
Task O2 handoff, DATA_MODEL.md，CONTEXT_DATA_ARCHITECTURE.md,
CONTEXT_MODEL_REVIEW.md，WHOLE_BIBLE_CURATION_SPEC.md，ADR-OO3,SECURITY.md，and existing
database conventions if any.
In scope
Concrete table/column types, primary/foreign/unique/check constraints, indexes, revision rules,
and RLS intent for the Nehemiah 2 slice
Private source registry, releases, artifacts, rights components, operation grants, raw records,
import runs, external mappings, assertion lineage, and findings
Canon/reference systems, editions/text units, scopes, entities/names, claims/citations,
attestations, edition mentions, relevance, events, places, context, review, and packages needed by
the adoption fixtures
Explicit deferred-table inventory for later whole-Bible needs
Read-only proposal for the exact root workspace changes, existing/new package versions, and test
tools required by Task 04, with a no-new-dependency alternative where feasible

Out of scope
SQL migrations, source-specific fields in canonical tables, production credentials, or data import.
Allowed changes
docs/DATA_MODEL.md and directly relevant model documentation.
Forbidden changes

Acceptance criteria
• Every ADR-003 adoption-gate scenario has a storage path
• Attestation, edition mention, and passage relevance remain distinct
• Claims have exact source-edition/release locators and immutable approval bindings
• Share-alike/component obligations can propagate to package builds
• Deletion/supersession and rollback are non-destructive
• An independent relational and security review finds no P0 issue
• Exact dependency/workspace proposal is ready for owner approval; nothing is installed

Tests
Structured walkthrough of all twelve adoption-gate scenarios and sample constraint violations.

Commands

git diff --check
rg n "entity_appearances/free-text temporal/display_allowed boolean/global verse" docs/DAT

Stop conditions
Stop if the physical slice requires an unapproved service, schema-breaking migration, unresolved
rights assumption, or contradicts ADR-003.
Required handoff
Standard handoff plus table inventory, deferred inventory, constraint matrix, RLS matrix, and
adoption-gate traceability matrix, plus exact dependency/workspace proposal.
Owner Gate A2
Before Task 04, the owner approves or rejects each exact workspace, package, and version change.
The immutable gate receipt lists the only changes Task 04 may make. Generic permission to "add
needed dependencies" is invalid.

Task 04 - Domain and content-schema workspace

Task
Create the smallest approved pure-TypeScript workspace that makes the adopted content contracts
executable.
User value

Read first
Task O3 handoff, ARCHITECTURE md AI CuPATToN coNTRAcT md phuoioaL modeL cpecification

scope
Approved root workspace scaffolding
Identifier/parser implementation from Task 02's approved documentation contract
packages/domain with framework-free types/errors
packages/content-schema with strict Zod schemas and deterministic validation entry points
Root scripts for format, lint, typecheck, unit tests, and full verification
• Positive and malformed synthetic fixtures only

Out of scope
Supabase, SQLite, network calls, real external data, mobile feature changes, and publication.

Allowed changes
Approved root workspace files, packages/domain，packages/content-schema,tests, and lockfile.

Forbidden changes
No unapproved dependency, loose version, any，@ts-ignore, unchecked cast, skipped test, hidden
network access, or infrastructure import in domain code.

Acceptance criteria
• Fresh install resolves exact approved versions
External and persisted inputs are strictly validated
Unknown fields, invalid keys, duplicate record keys, dangling references, invalid states, and
rights-unknown publication fail with actionable typed errors
npm run verify covers mobile plus new packages without regressing existing behavior

Tests
Unit/property-style boundary cases using existing approved test tooling; malformed fixture tests
must prove each rejection category.
Commands

npm install
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run verify
git diff-check

Stop conditions
Stop before editing if root workspace changes or exact dependency versions were not approved at
Gate A2. Stop on unrelated baseline failures rather than suppressing them.
Required handoff

change justification. Standard handoff plus public package APls, schema-version list, error taxonomy, and dependency

Task 05 - Golden adoption fixtures

Task
Implement the complete synthetic golden-fixture suite required by ADR-003 before migrations.

User value
Proves the model handles multilingual, multi-edition, disputed, and offline realities before the
database shape becomes expensive to change.

Read first
Task O4 handoff, CONTEXT_MODEL_REVIEW.md，AI_CURATION_CONTRACT.md,ADR-OO3, and schema tests

In scope
Synthetic fixtures for:
• One entity shared across English, Telugu, and Tamil names/descriptions
Relevant-but-not-mentioned entity
Named, pronoun, indirect, collective, repeated-name, and genealogy attestations
Split/merged/reordered/omitted reference mapping
• Corrected immutable edition preserving old selectors/spans
Competing identity and chronology positions
Cross-chapter, overlapping, alternate, and non-contiguous scope segmentation
Event participants, places, and multiple Scripture accounts
• Grapheme-safe Telugu/Tamil selectors and generated UTF-16 projections
Exact source locator plus checksum-bound human approval fixture
• Complete-zero, complete-with-records, incomplete, blocked, and not-applicable coverage
Rights-unknown failures for every operation
Atomic NDJSON failure and release rollback

Out of scope
Real Scripture, real historical claims, production sources, and reviewer approvals.
Allowed changes
Content-schema test fixtures, fixture builders, validators, and tests.
Forbidden changes
Do not label synthetic fixtures as production or copy real unapproved translation text.
Acceptance criteria
Every adoption-gate row has one valid fixture and at least one targeted invalid fixture; every
invalid fixture fails for the expected error code.
Tests
Golden snapshot/semantic assertions, Unicode grapheme tests, rights matrix tests, atomic-package

Stop conditions

Required handoff
Standard handoff plus adoption-gate-to-test mapping and fixture licensing statement.

Task 06 - Independent adoption-gate review

Task
Perform read-only architecture, biblical-ontology, Al-security, multilingual, and rights reviews of
Tasks 02-05.
User value
Finds structural defects before source adapters and database migrations depend on them.
Read first

CONTENT_GUIDELINES.md
In scope
Independent review and reproduction of the full verification suite. Parallel read-only specialist
subagents are permitted.
Out of scope
Editing, approving content/licenses, or accepting failures based on intent.
Allowed changes
None; findings are returned in the handoff.
Forbidden changes
The authoring agent may not review its own task as the sole reviewer.
Acceptance criteria
All required tests reproduce
No unresolved Po/P1 architecture, rights, provenance, multilingual, or content-trust finding
Every adoption-gate scenario is executable, not documentation-only

Task 07 - Operational source-registry contract

Task
Implement the machine-readable, fail-closed source registry that authorizes exact
source-release/component/operation tuples.

User value
Prevents a Markdown edit or generic "open source" label from authorizing data use.

Read first
Gate B handoff, OPEN_BIBLE_DATA_SOURCES.md，AI_CURATION_CONTRACT.md，CONTENT_RIGHTS.md,
SECURITY.md,and source-related physical model tables.

In scope
Candidate acquisition requests
• Immutable source releases/artifacts and SHA-256 manifests
• Component/path/field selectors
Retained license-evidence digests and attribution rules
Per-operation grants, prohibitions, expiry/territory/language limits, and Al-provider policy
Append-only approval/revocation records bound to authenticated actor and exact digest
• Schema, fixtures, evaluator, and audit receipt

Out of scope
Downloading sources, granting approval, database migrations, or reader-facing source content.
Allowed changes
Domain/content schemas, private registry fixtures, evaluator, tests, and registry documentation.
Forbidden changes
Markdown status cannot authorize use
Missing/expired/ambiguous grants cannot default to allowed
One top-level license cannot govern mixed-license components

Acceptance criteria

License evidence and acquired bytes are digest-bound
Fixture approvals are clearly synthetic

Task O7A - Private operational-registry migration and privileges

Task
Create only the private Postgres/Supabase source-registry, release, component-rights, approval
artifact-receipt, quarantine metadata, and audit tables needed to authorize acquisition.
User value
Makes the append-only operational registry real before any source operation depends on it.
Read first
Task O7 handoff, Task O3 physical model, ARCHITECTURE.md, SECuRITY.md, and existing databas
state/tests.
In scope
Private schemas/tables, constraints, indexes, immutable approval/digest rules, privileged write
boundaries, synthetic seeds, RLS/revoked public access, migration tests, and recovery notes.
Out of scope
Canonical Bible/context tables, actual source bytes, public content views, source parsing, or
production deployment.
Allowed changes
supabase/migrations,supabase/tests, synthetic local seeds, generated types through approv
tooling, and registry migration documentation.
Forbidden changes
No public access to registry/quarantine data, service keys in the repository, dashboard-only
changes, mutable approval digests, or disabled RLS.
Acceptance criteria
Clean local rebuild creates the private registry
Approval records are append-only and bind exact subject/policy digests

Public clients cannot authorize source operations
Migration has reviewed forward-fix/rollback guidance

Task O7B - Registry service and authorization evaluator

Task
Implement the narrow server-side repository/service that records acquisition requests, admits
verified releases, and evaluates one exact release/component/operation authorization.

User value
Provides the deterministic authorization boundary used by acquisition and all later processing.

Read first
Task O7A handoff, source-registry contracts, database types, security rules, and architecture
dependency boundaries.

In scope
Typed repository interface, Postgres adapter, append-only transitions, authorization evaluator,
idempotency, revocation/supersession handling, and safe audit receipts.

Out of scope
Artifact download, parsing, Al execution, canonical content, generic admin APl, or production.

Allowed changes
Approved backend/tool package, repository/service tests, narrow CLI, and documentation.

Forbidden changes I
No authorization from Markdown, broad CRUD endpoint, client-side privileged write, in-place
approval mutation, or protected source data in logs.

Acceptance criteria
Authorization requires exact release, component, operation, context, policy version, and valid
authenticated approval receipt
●1 Unknown/expired/revoked/prohibited requests deny
Idempotent retries are no-ops and changed payloads under one identity reject
Only privileged server identity can record decisions

Task 08 - Quarantined acquisition and integrity tooling

Task
Implement a deterministic acquisition tool that fetches only an authorized exact artifact into
private quarantine and records its integrity receipt.

User value
Makes source acquisition reproducible and prevents mutable or unexpected data from entering the
pipeline.

Read first
Task O7B handoff, SEcuRITY.md， source registry schemas/service, and repository tooling
conventions.

In scope
Dry-run authorization
Exact host/path allow-listing and redirect policy
• Size, timeout, archive depth/count, decompression, media-type, and filename protections
Streaming SHA-256, byte count, retrieval timestamp, response metadata, and immutable receipt
Private quarantine paths excluded from app bundles and Git unless retention rights explicitly
permit a reviewed fixture
• Fully local tests using fixture artifacts; no network in Cl

I
Out of scope
Parsing biblical semantics, external Al, production import, arbitrary URLs, or secrets in clients.
Allowed changes
Source-ingestion tooling, local synthetic fixtures, tests, scripts, and safe ignore rules.

Forbidden changes
No shell interpolation of source metadata, path traversal, moving branch as release identity,
unbounded archive extraction, logging credentials, or network fallback.

Acceptance criteria
Unauthorized request performs zero network/file mutation
Digest/size/type mismatch quarantines the artifact and fails
Same approved bytes yield the same receipt
Different bytes under one release key fail

Task 09 - Exact acquisition-request packet

Task
Research and prepare exact isolated-acquisition requests for the smallest Nehemiah 2-relevant
source artifacts; obtain the required human decision before fetching opaque bytes.

User value
Avoids cloning broad mixed-license repositories when only a few files are needed.

Read first
Task 08 handoff, OPEN_BIBLE_DATA_SoURCES.md,source registry contract, and Gate A1 policy.

In scope
Prepare separate component requests for:
• STEPBible TVTMS reference mappings
STEPBible TIPNR structured fields, explicitly excluding Al-generated descriptions and geodata
BibleData people/labels/relationships/person-verse files for discrepancy analysis only
MACULA Hebrew fields required for Nehemiah 2 linguistic/referent evaluation
OpenBible raw core geodata, excluding images and separately licensed OSM-derived fields unless
specifically approved
Each request identifies immutable commit/artifact, trustworthy upstream checksum when available,
expected size, license evidence, attribution, opaque-byte quarantine retention, acquisition-only
operation, external-Al denial, and exclusions.
I
Out of scope
Download, parse, import, Al processing, or any share-alike source.

Allowed changes
Candidate registry requests and supporting rights/evidence documentation.

Forbidden changes
Do not self-approve, use Theographic/ACAl/SemanticBible, include Scripture text, or infer that a
repository license covers every embedded component.

Acceptance criteria
Every component has exact scope and exclusions

External-Al and embeddings default to denied

Tasks O9A-O9E - Acquire one opaque source artifact per task

next row only after independently verifying the prior receipt.

plus exactly that row's task key, source component, request path, concrete commands, allowed paths,
expected artifacts, prerequisite receipts, and successor. The envelope hashes and embeds that
resolved block; it must not expose or authorize any other row. A grouped-section hash, unresolved
placeholder, or card containing multiple rows is invalid.

Task Source component Request path

09A STEPBible TVTMS content/source-
requests/stepbible-tvtms.json

09B STEPBible TIPNR structured fields content/source-
requests/stepbible-tipnr.json

09C BibleData comparison files content/source-
requests/bibledata-people.json

09D MACULA Hebrew approved content/source-requests/macula-
components hebrew-neh2.json

09E OpenBible core geodata content/source-
requests/openbible-geodata.json

Task
I
Acquire exactly one Gate-C1-authorized artifact as opaque bytes, retain the applicable license
evidence, compute integrity metadata, and stop without opening or parsing it.

User value
Separates permission to fetch a known location from permission to process the actual bytes found
there.

Read first
Task 08 handoff, the exact Gate C1 receipt, source request, and acquisition runbook.

In scope
Authorized URL/commit only, opaque streaming download, redirects under policy, size/media metadata,
SHA-256, license-evidence capture/digest, quarantine receipt, and idempotent retry.

Out of scope
Opening, parsing, extracting archives, inspecting semantic fields, normalization, Al processing,
or canonical/staging import.

Allowed changes
Private quarantine artifact/metadata, append-only acquisition receipt, and operational log allowed
by policy.

Forbidden changes
No additional URL/file, moving branch as release identity, arbitrary redirect, execution,
decompression, source content logging, or tracked mobile/content data.

Accentance criteria

Acceptance criteria
• Artifact and retained license evidence have byte sizes and SHA-256 diges
• Upstream checksum is verified when independently available
• Changed bytes never overwrite a prior receipt/artifact
Receipt binds request, exact URL/commit, bytes, actor, and server time
No parser accessed the artifact

Task O9F - Exact-byte/component decision packet

Task
Profile only non-semantic container/manifest metadata permitted by policy, bind component selectors
and license evidence to each acquired digest, and obtain human authorization for evaluation parsing
and normalization.

User value
Ensures processing permission applies to the bytes actually acquired, not merely the requested URL.

Read first
Resolved Tasks 09A-09E receipts, including omission receipts, retained license evidence for
acquired sources, registry policy, selected-source manifest, and source catalog.

In scope
Exact artifact/license digests, file/component selectors, approved parser operation, retention,
attribution, prohibited fields, and discovered-rights findings. If safe profiling requires opening
content beyond Gate C1, request a narrower human authorization first.

Out of scope
Semantic extraction, canonical transformation, external Al, embeddings, publication, or self-
approval.

Allowed changes
Append-only release/component proposals, technical consistency report, and authenticated human
approval/denial receipts written only through the registry workflow.

Forbidden changes
No Al-created approval, URL-only approval, umbrella-license assumption, or operation not explicitly
listed.

Acceptance criteria
Each parsing grant binds exact artifact digest, license-evidence digest, componert selector,
parser operation, retention, attribution, and exclusions
Unknown/unapproved components remain opaque and denied
External Al, embeddings, and publication remain denied
Every source slot is resolved as acquired/authorized or digest-bound omitted, and the packet
reports reduced-source coverage and limitations

Task 10 - TVTMS reference-mapping adapter

Task
Open the exact Gate-C2-approved TVTMS artifact and convert only the Nehemiah-relevant reference
mappings into validated candidate records.

User value
Ensures later attestations resolve through explicit versification rather than assumed English
coordinates.

Read first
Gate C2 approval and exact Task 09A receipt, identifier contract, source schema, and TVTMS
documentation.

In scope
Open only the quarantined artifact identified by the Task 09A receipt, re-verify its SHA-256 before
parsing, apply strict TSV/hierarchical parsing, preserve upstream references, map to reference-
system-qualified candidate records, and produce rejects, coverage, and import receipt.

Out of scope
Semantic passage relationships, entity extraction, canonical approval, or non-Nehemiah mappings.

Allowed changes
TVTMS adapter, source-specific mapping schema/fixtures, tests, receipts, and generated candidate
artifacts in approved non-production paths.

Forbidden changes
No network access or reacquisition, bare global verse key, silent split/merge loss, guessed
mapping, or canonical-table write.

Acceptance criteria
Every output maps to named source and target reference systems I
Exact/split/merge/reordered/omitted/uncertain states are preserved
Unresolved mappings are rejected or quarantined, never guessed

Task 11 - TIPNR proper-name adapter

Task

Open the exact Gate-C2-approved TiPNR artifact and create Nehemiah 2 proper-name entity, name,
named-attestation, and family-relation candidates.

User value
Bootstraps people/place identity and explicit references without treating upstream data as truth.

Read first
Task 10 DoNE handoff, Task 09A/09B resolution receipts, dependency-closed selected-source
manifest, exact TIPNR Gate C2 approval, TIPNR docs, curation specification,
entity/claim/attestation schemas, and identity policies from Gate A1.

In scope
Upstream identities and original-language/name forms
Explicit named Scripture-reference candidates mapped through Task 10
Family relationship candidates with exact raw locators
• Coverage and unresolved external-ID records

Out of scope
Al descriptions, biographies, geodata, pronouns, implicit referents, passage relevance, events,
canonical merges, or production content.

Allowed changes
TIPNR adapter, source schemas/fixtures, tests, candidate output, rejects, and receipt.

Forbidden changes
No network access or reacquisition. Do not import Claude-generated descriptions, adopt Strong's/
name spelling as canonical identity, merge homonyms, or inherit upstream approval/completeness
claims. Re-verify the Task O9B artifact digest before parsing.

Acceptance criteria
Every candidate traces to release, raw record/field, transform, and mapping decision I
Same/probable/possible/distinct/unresolved identities remain separate statuses
Named attestations never imply pronoun or contextual relevance coverage
Family relations remain claims requiring review
Rebuild is deterministic

Task 12 - BibleData discrepancy adapter

Task
Open the exact Gate-C2-approved BibleData files and compare their Nehemiah 2 people, labels,
relations, and person-verses with TIPNR without adding canonical claims.
User value
Exposes gaps and disagreements before reviewers rely on one compilation.
Read first
Task 11 D0NE handoff, Task 09C resolution receipt, dependency-closed selected-source manifest,
exact BibleData Gate C2 approval, BibleData docs, source catalog cautions, and discrepancy schema.
In scope
Read-only normalization into source-local identities; exact, probable, possible, conflict, missing,
and unresolved comparisons; per-file coverage and provenance report.
Out of scope
Canonical entity creation, chronology, places/events, commandments, dictionaries, polyglot text,
Strong's lexicon ingestion, or automatic corroboration.
Allowed changes
BibleData adapter, source-local fixtures/tests, discrepancy report, rejects, and receipt.
Forbidden changes
No network access or reacquisition. No "two sources agree" evidence claim when sources may share
upstream material; no automatic winner, ontology inheritance, or write into canonical candidate
assertions. Re-verify every Task O9C artifact digest before parsing.
Acceptance criteria
Comparison is source-local and reversible
Every difference links both raw locators
Shared upstream dependence is recorded where known
Consequential person/divine/collective classifications are flagged for specialist review

Task 13 - MACULA Hebrew linguistic adapter

Task
Open exact Gate-C2-approved MACULA Hebrew components and produce Nehemiah 2 source-language token,
morphology, semantic-role, speech, and referent candidates.

User value
Supplies linguistic evidence for implicit/pronominal references without pretending Hebrew offsets
apply to English or future translations.

Read first
Task 12 handoff or omission receipt for serialized ordering, Task 10 DoNE reference-mapping
handoff, exact Task 09D receipt and MACULA Gate C2 approval, dependency-closed selected-source
manifest, MACULA license component manifest, Hebrew format docs, identifier/reference mapping, and
mention/attestation schemas.

In scope
Approved fields only; WLC text-unit/token identifiers; lemmas/morphology; speech/semantic-role and
participant-referent candidates; mapping confidence, coverage, rejects, and lineage.

Out of scope
BSB.offsets, English/Telugu/Tamil mention text, theological word studies, canonical identity
approval, reader prose, or unapproved gloss/sense fields.
Allowed changes
MACULA Hebrew adapter, approved source-component schemas, fixtures/tests, candidate output, and
receipts.

Forbidden changes
No network access or reacquisition, cross-edition offset reuse, silent qere/ketiv or word-part
flattening, inferred person identity, or promotion of referent annotations to approved facts.
Re-verify the Task O9D artifact digest before parsing.

Acceptance criteria
Every field retains component-level license/provenance I
Source token and app-edition identity remain separate
Ambiguous/missing referents remain unresolved
Hebrew referent coverage is reported as partial unless measured otherwise
Deterministic output and rejects are produced

Task 14 - OpenBible geographic adapter

Task
Open the exact Gate-C2-approved OpenBible core geodata and produce Nehemiah 2 place,
candidate-site, geometry, source-link, external-ID, and confidence candidates.

User value
Provides useful geographic orientation while preserving disputed or approximate locations.

Read first
Task 13 handoff or omission receipt for serialized ordering, Task 11 DoNE proper-name handoff,
exact Task 09E receipt and OpenBible Gate C2 approval, dependency-closed selected-source manifest,
OpenBible component exclusions, map/place schema, and content map rules.

In scope
Approved core fields only; ancient place candidates, possible modern sites, geometry with CRS,
source-stated confidence, source links, external IDs, verse references, and location precision.
Out of scope
Images, map tiles, OSM-derived fields unless separately approved, routes, static map assets,
choosing a winning location, or reader-facing claims.

Allowed changes
OpenBible adapter, source fixtures/tests, candidate output, rejects, and receipt.

Forbidden changes
No network access or reacquisition. Do not turn one coordinate into established identity, merge
ancient and modern places, infer routes, copy ESV quotations/page prose, or exceed evidence
precision. Re-verify the Task O9E artifact digest before parsing.

Acceptance criteria
Competing locations remain separate candidates
Geometry records CRS, precision, period/applicability, evidence, and component license
Source confidence is distinct from Bible Compass review status
Excluded asset/OSM/Scripture fields cannot enter output

Task 15A - Canonical identity and attestation reconciliation

Task
Reconcile source-local candidates into reviewable canonical-identity and canonical-attestation
proposals without approving them.

User value
Connects one proposed canonical person/place to multiple sources while avoiding duplicate
identities and false textual attestations.

Read first
Tasks 10-14 handoffs or omission receipts, dependency-closed reduced-source manifest, canonical
identity policy, Al curation contract, and available reference mappings.

In scope
External-ID mappings with exact/probable/possible/broader/narrower/split/composite/distinct/
unresolved states
Canonical attestation candidates separated from passage relevance
Conflict, coverage, and unresolved-identity records

Out of scope
Automatic merges, edition selectors/offsets, prose context, approval, publication, or inference
from English name equality.

Allowed changes
Reconciliation tooling, candidate crosswalks/attestations, fixtures/tests, and reports.

Forbidden changes
Al must not generate trusted keys, expand passage relevance into verse mentions, resolve identities
by name equality, or count unresolved candidates as occurrences.

Acceptance criteria
Every proposal traces to source releases and mapping decisions
Identity and attestation decisions are separate atomic outputs
A canonical attestation can exist without an English surface mention I
Counts and reverse links are generated only from approved atomic fixtures in tests
Selected-source dependency closure is revalidated; omitted sources and resulting evidence/
coverage gaps remain explicit and cannot be interpreted as negative evidence

Task 15B - BSB mention-selector generation

Task
Create exact BSB edition mention selectors for the Gate-A-approved Nehemiah 2 edition and derive
hashes/spans deterministically.

User value
Connects canonical attestations to exact English surface wording without leaking source-language
or old-edition offsets.

Read first
Task 15A handoff, exact immutable BSB snapshot/checksum and rights record, edition-mention schema,
and selector/Unicode policy.

In scope
Draft exact selectors copied only from the supplied BSB text
Mention form, occurrence ordinal, prefix/suffix disambiguation, and target attestation proposal
Pipeline-generated edition text hash, grapheme-safe match, non-overlapping render spans, and
explicit React Native UTF-16 half-open projection
Context-card selectors modeled separately from entity mentions

Out of scope
Canonical identity changes, Hebrew offsets, Telugu/Tamil selectors, Scripture correction,
approval, or publication.

Allowed changes
Selector generator, edition-specific draft artifacts, fixtures/tests, and validation reports.

Forbidden changes
No Al-generated offsets/hashes, selector reuse across editions, context-only entity span, guessed
repeated occurrence, or mutation of BSB text.

Acceptance criteria
Zero/ambiguous matches fail and repeated text requires deterministic disambiguation
A draft entity selector targets an approved or proposed canonical attestation explicitly; an I
approved entity mention may not exist without an approved canonical attestation
Context-card spans use their separate non-entity target contract
Correcting text creates a new edition and preserves old spans
All generated spans reproduce the original text at grapheme boundaries

Task 16A - Nehemiah 2 pilot report generation

Task
Reproduce the complete candidate pipeline and produce a digest-bound pilot report without
performing or claiming independent review.

User value
Produces the evidence specialists need to judge whether the selected datasets save enough work and
where human curation remains necessary before backend investment.

Read first
Resolved Tasks 10-14 handoffs/omission receipts, Tasks 15A-15B handoffs, selected-source manifest,
source catalog, curation specification, adoption review, and all receipts.

In scope
Reproduce all converters from pinned artifacts
Report source contribution, conflicts, rejected records, unresolved identities, coverage by
annotation class, geographic uncertainty, reference failures, license obligations, and reviewer
workload
Report source-processing coverage separately from editorial semantic coverage; semantic
complete_zero/complete_with_records requires a human-approved inclusion policy and audited
verse-by-verse denominator
Verify agreement is not counted as independent evidence when sources share ancestry
Recommend accept, revise, omit, or stop for each adapter

Out of scope
Independent review, fixing adapters, approving claims, publishing content, or widening beyond
Nehemiah 2.

Allowed changes
Pilot report and generated non-production reports only. Source/candidate records are read-only.

Forbidden changes
No hidden manual correction, last-source-wins rule, unexplained exclusion, or inflated completeness. I

Acceptance criteria
Clean rebuild reproduces output digests
Every row has lineage and effective rights component
Source-processing coverage and editorial semantic coverage are distinct; semantic coverage
distinguishes complete-zero, complete-with-records, incomplete, blocked, and not-applicable
Omitted sources and resulting coverage limitations are explicit
Report clearly separates machine findings, author assessment, and pending human decisions

Task 16B - Independent Nehemiah 2 pilot review

Task
Independently review the immutable Task 16A report and candidate artifacts without editing them,
then prepare the exact evidence for Owner Gate D.

User value
Separates pipeline authorship from technical, biblical, rights-consistency, security, and
multilingual challenge before backend investment.

Read first
Task 16A handoff and exact artifact digests, all upstream handoffs/receipts, selected-source
manifest, curation specification, content/security/rights rules, and reviewer-role requirements.

In scope
Read-only independent data-engineering and reproducibility review
Read-only biblical ontology, attestation/relevance, and uncertainty review
Read-only technical license-consistency, security, and lineage review
Read-only multilingual/translation-independence review
Severity-ranked findings and accept/revise/omit/stop recommendation per adapter
Owner Gate D packet bound to exact reviewed artifact digests
Only qualified humans can make rights, editorial, biblical, or product decisions. Specialist Al
agents may identify issues but cannot fill a required human role.
Out of scope
Generating or editing the report/candidates, fixing adapters, resolving disputes, approving rights
or content, publishing, or widening beyond Nehemiah 2.
Allowed changes
Independent review report and Gate D decision packet only. Reviewed artifacts are read-only.
Parallel read-only specialist subagents are permitted; the Task 16A author cannot act as the
independent reviewer/controller for this attempt.
Forbidden changes
No hidden correction, source-priority winner, self-approval, review-role impersonation, candidate
mutation, or passing recommendation with an unresolved Po finding.
I
Acceptance criteria
Reviewed inputs and Task 16A output match their handoff digests
Clean rebuild and deliberate mutation evidence are independently checked
Source-processing and editorial-semantic coverage remain distinct
Omitted sources and reduced-source limitations are assessed explicitly
Findings distinguish technical defects, evidence gaps, responsible disagreement, and human
decisions

Task 17A - Canon/reference/edition staging migrations

Task
Implement the approved canon, reference-system, mapping, translation-work, immutable-edition, and
text-unit slice as reproducible private Supabase migrations.
User value
Creates the immutable Scripture/reference foundation used by the remaining staging model.
Read first
Gate D decision, Task 03 model, ARCHITECTURE.md，SECURITY. md,Supabase conventions, and current
tests.

In scope
• Canon/reference systems, works, units, mappings, scopes, translation works/editions, text units,
edition rights references, constraints, indexes, and private staging access
• Synthetic test data only
• Backup, rollback, and forward-fix notes

Out of scope
Production deployment, dashboard edits, whole-Bible population, app Ul, and real publication.
Allowed changes
supabase/migrations,supabase/tests, synthetic local seeds, generated database types through
approved tooling, and database documentation.
Forbidden changes
No service-role key, public content view, RLS disablement, destructive migration, dashboard-only
schema, real Scripture seed, or global bare reference identity.
Acceptance criteria
Empty database rebuild succeeds
All applicable reference/edition constraints and indexes from Task 03 exist
Split/merge mapping and corrected-edition fixtures work without overwriting history
Ordinary clients cannot mutate private staging rows I
Rollback/forward-fix is documented and tested where possible

Task 17B - Knowledge, claim, and context staging migrations

Task
Implement the approved private staging tables for entities/names, identity assertions, claims,
sources/citations, attestations, edition mentions, relevance, relationships, events, places,
context, localization, coverage, and lineage references.

User value
Creates the relational knowledge graph while preserving provenance, disagreement, and multilingual
boundaries.

Read first
Task 17A handoff, Task 03 model, ADR-003, adoption fixtures, and content/security contracts.

In scope
Only Nehemiah 2-required knowledge/evidence tables, constraints/indexes, private privileges,
synthetic fixtures, and deferred-table documentation.

Out of scope
Review/package/public projections, real pilot import, mobile APl, or publication.

Allowed changes
New ordered migrations, database tests, generated types, synthetic seeds, and documentation.

Forbidden changes
No attestation/relevance conflation, free-text core predicates, destructive identity merge, coarse
certainty, orphan claim/citation, public access, or real content.

Acceptance criteria
Adoption fixtures for relevant-not-mentioned, disagreement, events, places, multilingual data,
and lineage persist correctly
Required FK/check/index/immutability rules hold
Ordinary clients cannot access private staging knowledge
Clean rebuild and upgrade from Task 17A pass

Task 17C - Review/package schemas, public projections, and RLS

Task
Implement review/approval/package metadata plus the narrow public projections and policies needed
to prove fail-closed publication behavior using synthetic data only.

User value
Ensures drafts remain private and only exact eligible releases could become readable later.

Read first
Task 17B handoff, review/package contracts, rights policy, SEcuRITY.md,and RLS requirements.

In scope
Append-only reviews, package/release/dependency/active-pointer tables, attribution/BOM metadata,
synthetic published-view fixtures, public projection shapes, and full RLS allow/deny tests.

Out of scope
Real content activation, SQLite projection/install, production deployment, or mobile changes.

Allowed changes
Ordered migrations, database policy tests, synthetic seeds, generated types, and documentation.

Forbidden changes
No real record marked published, draft/raw public fields, partial package activation, Al-authored
approval, service key in clients, or disabled RLS.

Acceptance criteria
Clean rebuild and sequential upgrade pass
Anonymous clients see only eligible synthetic published fixtures
Draft/raw/import/review-private data is denied

Active-pointer rollback preserves immutable release history

Task 18 - Idempotent candidate import service

Task
Import the reviewed pilot output into private Supabase staging with complete lineage and no
publication transition.

User value
Proves candidate data can be rebuilt, inspected, corrected, and rolled back safely.

Read first
Task 17C handoff, candidate package schemas/receipts, source registry evaluator, and database types.

In scope
Validated transaction/batch import, deterministic external mappings, raw-to-staging lineage,
semantic diff, rejects, audit receipt, idempotent replay, supersession, and rollback/forward-fix.

Out of scope
Approval, publication, public APl exposure, production database, and Al drafting.

Allowed changes
Narrow import service/tooling, repository adapter, tests, safe staging fixtures, and documentation.

Forbidden changes
No direct raw-to-canonical write, untyped SQL, partial successful package, last-write-wins conflict
resolution, or public client privilege.

Acceptance criteria
Same package replay creates no duplicate semantic record
Changed bytes under same release/package key fail
One invalid record fails the atomic package or bounded batch per approved policy
Every staged assertion resolves complete lineage and rights obligations
Import actor cannot approve or publish

Task 18A - External-Al input authorization packet

Task

Prepare and obtain exact human rights decisions for every BSB and external-source component that a
curation job may send to an approved Al provider or retain in derived draft form.

User value
Prevents local evaluation permission from being silently broadened into external Al disclosure.

Read first
Task 18 handoff, Gate A1 provider policy, source registry, exact BSB rights evidence, pilot report,
and Al curation contract.

In scope
Exact source/edition release, artifact/component/field/excerpt selectors, provider/model class,
external_ai_processing,provider retention/training constraints, prompt/output retention,
draft_derivative_storage，expiry, territory/language, attribution, and prohibitions.
The packet must also identify an approved scholarly evidence corpus for historical/context claims.
If none is approved, later context jobs are limited to direct Scripture observations and must emit
open questions for When, Before, Stakes, biographies, and historical/interpretive explanations not
supported by the allowed input.

Out of scope
Calling a provider, generating drafts, granting rights, embeddings, publication, or assuming Gate
C2 evaluation permission covers Al.

Allowed changes
Registry proposals, retained rights evidence, technical consistency report, and human decisions
through the authenticated append-only workflow.

Forbidden changes
No Al approval, broad repository-level grant, unspecific "Bible content" permission, or inclusion
of a field/excerpt absent from the exact request.

Acceptance criteria
Every provider-bound byte class is covered by an exact component-operation decision
BSB is independently represented; source dataset approval cannot license Scripture text
Provider retention/training and project draft-retention rules are explicit I
No scholarly corpus means historical/context output constraints are machine-readable
External Al remains denied for every unlisted source/component

Task 19A - Al curation input-bundle assembler

Task
Implement deterministic job manifests and rights-filtered input bundles for one Nehemiah 2 package
kind without calling an Al provider.

User value
Gives an Al only the exact bounded evidence it is authorized to process.

Read first
Gate D2 receipt, Task 18 handoff, AI_CURATION_CONTRACT. md, registry evaluator, content schemas,
and security/privacy rules.

In scope
Server-created job/submission/package keys, limits, nonces/attempts, and input digests
Registry-authorized minimal source excerpts and exact locators
Provider/model/prompt/version/retention requirements in the manifest
Internet-disabled prompt template, deterministic ordering, and bundle digest

Out of scope
Provider invocation, response parsing, model fine-tuning, embeddings, open-ended Bible teacher,
production publishing, or approval workflow UI.

Allowed changes
Bundle assembler/domain service, schemas, fixtures, tests, and documentation.

Forbidden changes
No secrets/client SDK in mobile, unsupplied source, external URLs for model retrieval, unmanifested
attachment, oversized excerpt, or Al-generated system metadata.
Acceptance criteria
Input bundle contains only authorized exact source components
Registry denial prevents bundle creation
Byte-identical inputs produce one deterministic digest I
Bundle is one scope and one package kind with explicit output/size limits
No scholarly corpus produces explicit context-claim restrictions

Task 19B - One-attempt provider runner

Task
Execute exactly one authorized job bundle against one approved provider/model configuration and
capture the raw response plus trusted generation receipt.

User value
Separates external execution from bundle construction and output trust decisions.

Read first
Task 19A handoff, exact bundle digest, Gate D2 provider authorization, security rules, and prompt.

In scope
One attempt, provider/model/settings validation, cost/rate/concurrency limit enforcement, raw
response quarantine, input/output digests, safe metadata receipt, and timeout/error handling.
Out of scope
Parsing/repairing output, follow-up calls, approval, canonical import, or publication.
Allowed changes
Provider adapter, server-only configuration interface, raw-response quarantine, synthetic provider
fixture, tests, and receipt.
Forbidden changes
No mobile secret, tool/web access absent from manifest, extra source, fallback model, automatic
retry as a new attempt, chain-of-thought retention, or downstream mutation.
Acceptance criteria
Provider call cannot start unless manifest/bundle/authorization digests match
One attempt produces one immutable receipt and quarantined response
Failure/timeout remains a recorded failed attempt without a hidden retry
Logs exclude secrets and protected content under retention poliey

Task 19C - Al submission validator and quarantine

Task
Parse and validate one raw Al response, derive only system-owned deterministic fields, and retain
the result as a quarantined draft or rejection.

User value
Prevents malformed, invented, unsupported, or unlicensed model output from entering review.

Read first
Task 19B handoff, job/bundle/generation receipts, schemas/vocabularies, source registry, and Al
contract.

In scope
Duplicate-key-safe strict JSON/NDJSON parsing, job/snapshot binding, stable-key/reference/citation/
rights checks, candidate isolation, deterministic selectors/spans where applicable, replay
protection, and structured findings.

Out of scope
Auto-repair, a second model call, human approval, staging import, or publication.

Allowed changes
Validator, quarantine records/artifacts, findings, fixtures/tests, and audit receipt.

Forbidden changes
No unknown-field dropping, invented citation repair, Al-owned trusted metadata, status beyond
draft,partial package mutation, or warning-to-approval conversion.
Acceptance criteria
No downstream mutation occurs before complete validation
Findings have stable codes/pointers and system-derived blocking state

rejects atomically
Replay of one response cannot create a second draft revision

Tasks 20A-20G - One draft package per separately dispatched task

Each table row is a separate task card, Al attempt, raw-response receipt, validation report,
artifact digest, and handoff. The controller must not dispatch the next row until the previous row
has passed and its output is an exact prerequisite. One agent turn never runs more than one row.

For a row, the controller composes a canonical resolved_task_block from the common headings below
plus exactly that row's task key, package kind, manifest path, concrete commands/draft path, allowed
paths, expected artifacts, prerequisite receipts, and successor. The envelope hashes and embeds
that resolved block; it must not expose or authorize another row. A grouped-section hash,
unresolved placeholder, or card containing multiple rows is invalid.

Task One package kind Concrete manifest path

20A Entity and name candidates content/pilot/jobs/20a-entity-
names.json

20B Canonical attestation candidates content/pilot/jobs/20b-
attestations.json

20C Relationship claim candidates content/pilot/jobs/20c-
relationships.json

20D Event and place claim candidates content/pilot/jobs/20d-events-
places.json

20E Passage relevance candidates content/pilot/jobs/20e-
relevance.json

20F Passage context draft content/pilot/jobs/20f-passage-
context.json

20G English localization draft content/pilot/jobs/20g-en-
localization.json

Task
Run exactly one manifest through the already-implemented bundle-assembly, provider-runner, and
submission-validation pipeline stages created by Tasks 19A, 19B, and 19C. Record each stage in this
one attempt and produce one validated quarantined draft package or one atomic rejection artifact.
This does not reopen, modify, redispatch, or change the status of Tasks 19A-19C.

User value
Creates one independently reviewable data layer at a time and prevents one failed job from
partially contaminating other content kinds.

Read first
Task 19C handoff, the immediately preceding 20-series handoff where applicable, exact manifest/
bundle, curation specification, content guidelines, Gate D2 authorization, and approved evidence.

In scope
Only the table row's package kind and manifest scope. Every task has its own attempt, limits,
source allow-list, output schema, receipt, findings, and draft artifact.
Task 20F may draft only claims supported by the approved evidence corpus. Scripture observation,
historical-source assertion, and editorial inference are distinct claim/evidence kinds. If no
scholarly source is approved, unsupported When, Before, Stakes, biography, historical background,
or interpretation fields become null/open questions rather than plausible prose.

nd U AL AGENT_NEXT_IMPLEMENTATION_PLAN.Md U Cursor Settings VS Code Settings
NEXT_IMPLEMENTATION_PLAN.md

Out of scope
Every other table row, Scripture composition/translation, Telugu/Tamil production localization,
trusted offsets/hashes, new sources, web research, unsupported coordinates/dates, approval, or
publication.
Allowed changes
The exact manifest's quarantined raw response, validated/rejected draft, findings, and receipts.
Forbidden changes
No follow-up attempt, uncited substantive claim, fabricated locator, silent dispute resolution,
protected prose copy, cross-package repair, or status beyond draft.
Acceptance criteria
One job validates against one exact manifest and package schema
Every substantive claim cites an authorized source release/component and supplied locator
Unknowns are null/open questions
Relevance is not converted into an attestation or mention
Deterministic fields are generated only by Task 19C tooling
A validated draft returns worker PAss and may become task DoNE after controller verification
An atomic rejection proves fail-closed behavior but returns worker FAIL; the task becomes
FAILED, no successor is released, and any retry requires a new attempt ID

Tests

Task 20H - Independent draft-set consistency review

Task
Perform a read-only cross-package review of Tasks 20A-20G and report conflicts without editing or
repairing drafts.

User value
Finds identity, citation, reference, relevance, chronology, geography, and localization conflicts
before a human review bundle is constructed.

Read first
Every 20A-20G handoff/artifact, curation specification, review policy, source registry, and pilot
coverage policy.

In scope
Cross-package key/reference integrity, claim/citation consistency, identity/event/place conflicts,
attestation/mention/relevance separation, evidence-kind distinctions, open questions, and coverage
status consistency.

Out of scope
Editing/repair, another Al call, human approval, rights decision, package building, or publication.

Allowed changes
Consistency report only. Parallel read-only specialist subagents are permitted.

Forbidden changes
No conflict resolution, source-priority winner, inferred completeness, or draft mutation.

Acceptance criteria
All artifacts/digests match their handoffs
Every cross-package reference resolves or is a blocking finding
Findings distinguish technical failure, evidence gap, and responsible disagreement
No P0/P1 inconsistency remains before Task 21

Task 21 - Human review-bundle construction

Task
Assemble exact validated drafts, evidence, findings, and coverage into a digest-bound human review
bundle, then stop for named human decisions.

User value
Lets qualified reviewers approve/reject exact bytes without trusting an Al summary.

Read first
Task 20H handoff, record-kind review policy, source evidence, rights rules, and all draft lineage.

In scope
Claim-by-claim views with exact source locator and original candidate
Enforceable record-kind reviewer matrix:
o Reference-system specialist for split/merge mappings
o Biblical-language/textual reviewer for Hebrew referents and attestation semantics
o BSB/edition-language reviewer for mention targets and selectors
o Historical-geography reviewer for ancient/modern place identity and geometry
o Biblical/editorial reviewer for relevance and passage context
o Rights reviewer for source/edition/asset operations and obligations
o Native-language reviewer for each future localization
Identity, chronology, theology, copy, and accessibility queues as required
Exact review-bundle digest, coverage report, attribution preview, and unresolved blockers

Out of scope
Recording decisions as Al, package building, installation, publication, or silent correction.

Allowed changes
Review-bundle tooling/artifact, validation tests, and documentation.

Forbidden changes
No generic reviewer may satisfy a specialist role, no approval inferred from comments, no mutable I
review target, and no Al-authored decision.

Acceptance criteria
Every record kind maps to required role/count and exact digest
Bundle includes source evidence, lineage, findings, conflicts, and open questions
Changing any reviewed byte changes the digest and invalidates pending decisions
Bundle ends with no approval state written by the constructing agent

Task 22 - Exact approval-receipt verification

Task
Verify all required human approval/rejection receipts against the Task 21 bundle and produce a
machine-readable eligibility report without building a package.

User value
Prevents stale, incomplete, wrong-role, or wrong-digest approvals from authorizing a release.

Read first
Gate E1 receipts, Task 21 bundle/handoff, reviewer policy, rights registry, and package contract.

In scope
Actor-role authorization, exact digests, record revisions, expiry/revocation/supersession,
constraints, unresolved blockers, rights obligations, and eligibility report.

Out of scope
Content repair, package build/install, approval creation, or publication.

Allowed changes
Approval verifier, eligibility report, fixtures/tests, and audit receipt.

Forbidden changes
No inferred approval, missing-role waiver, stale approval reuse, or Al decision.

Acceptance criteria
Every required record/review discipline has a valid exact receipt
Any rejection, stale digest, missing role, unknown right, or unresolved required blocker denies
Report is deterministic and binds all consumed receipts

Task 23 - Immutable staging-package build

Task
Build and validate one immutable non-production package artifact from the exact Task 22-eligible
records without installing or activating it.

User value
Proves the content graph can be packaged reproducibly while keeping SQLite/mobile activation in a
later plan.

Read first
Task 22 eligibility report, package/dependency contracts, source registry, rights obligations, and
attribution rules.

In scope
Immutable manifest/members/dependencies, effective obligation union, attribution manifest,
data/license bill of materials, deterministic derived fields, package checksum, and structural
validation.

Out of scope
SQLite projection, install, active-release pointer, mobile exposure, production publication, or
whole-Bible expansion.

Allowed changes
Package builder, immutable staging artifact, BOM/attribution artifacts, fixtures/tests, and docs.

Forbidden changes
No missing approval, unknown/incompatible obligation, partial dependency, mutable package bytes,
installation, activation, or deletion of history.

Acceptance criteria
Same approved inputs/build version reproduce the package digest
Builder rejects stale approval, broken dependency, invalid selector, incomplete required I
coverage, and unknown/incompatible license obligation
BOM lists every source release/component/checksum/transform/contribution/notice/approval
Artifact is clearly staging_candidate, not installed or published

Owner Gate E2

The owner decides whether this staging package may proceed into the separate mobile/SQLite install
plan. This plan grants no installation or production authority.

Global completion criteria

This plan is complete only when:

Gate 0 and every later required gate have valid authorized-human receipts
• Every required or selected task from 00-23, including lettered tasks, is DoNE in dependency
order; optional source tasks are DONE or OMITTED with valid omission receipts
The ADR-003 adoption fixture suite passes
Exact approved source releases reproduce the Nehemiah 2 candidate output
· Every external record and claim has complete lineage and effective rights obligations
Supabase staging rebuild and RLS denial tests pass
Al jobs are bounded, rights-filtered, auditable, draft-only, and deterministic at their contract
boundaries
The immutable staging-package artifact rebuilds deterministically and remains uninstalled
Nothing was published to production

Following plan
After Gate E2, write a separate implementation plan for mobile repository adapters, SQLite content
projections, context Ul integration, offline installation, accessibility/device QA, and production
publication. Do not append those tasks to an in-progress execution queue.
