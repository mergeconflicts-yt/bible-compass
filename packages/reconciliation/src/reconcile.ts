import * as crypto from "crypto";
import type { ReconciliationResult } from "./types";
import { externalMappingSchema, canonicalAttestationSchema, relevanceSchema } from "./types";

/**
 * Task 15A — Identity and attestation reconciliation
 * - External-ID mappings with exact/probable/possible/distinct/unresolved/composite/split
 * - Canonical attestations separate from relevance
 * - No merge by name equality, no counting unresolved as occurrences
 */
export function reconcile15A(): ReconciliationResult {
  const mappings = [
    {
      sourceKey: "source:stepbible:tipnr",
      sourceReleaseKey: "release:source:stepbible:tipnr@ae39711d:sha-6cab6e4b",
      upstreamKind: "person",
      upstreamId: "tipnr:person:nehemiah:001",
      canonicalEntityKey: "entity:nehemiah-governor",
      mappingState: "exact" as const,
      evidence: "TIPNR:NEH:2:person:nehemiah-governor:001 -> entity:nehemiah-governor exact (same person, Neh2 cupbearer)",
    },
    {
      sourceKey: "source:stepbible:tipnr",
      sourceReleaseKey: "release:source:stepbible:tipnr@ae39711d:sha-6cab6e4b",
      upstreamKind: "person",
      upstreamId: "tipnr:person:artaxerxes-i:002",
      canonicalEntityKey: "entity:artaxerxes-i",
      mappingState: "exact" as const,
      evidence: "TIPNR:NEH:2:person:artaxerxes-i:002 -> entity:artaxerxes-i exact",
    },
    {
      sourceKey: "source:bibledata:structured",
      sourceReleaseKey: "release:source:bibledata:structured@8799b409:sha-489b5f58",
      upstreamKind: "person",
      upstreamId: "bibledata:person:artaxerxes",
      canonicalEntityKey: "entity:artaxerxes-i",
      mappingState: "probable" as const,
      evidence: "BibleData Artaxerxes (no I/II disambiguation) -> entity:artaxerxes-i probable (requires chronology review per 12)",
    },
    {
      sourceKey: "source:bibledata:structured",
      sourceReleaseKey: "release:source:bibledata:structured@8799b409:sha-489b5f58",
      upstreamKind: "person",
      upstreamId: "bibledata:person:hanani",
      canonicalEntityKey: "entity:hanani-brother",
      mappingState: "possible" as const,
      evidence: "BibleData Hanani at Neh1.2 vs TIPNR Hanani at Neh2 — possible same person, not exact for Neh2.1 scope",
    },
    {
      sourceKey: "source:stepbible:tipnr",
      sourceReleaseKey: "release:source:stepbible:tipnr@ae39711d:sha-6cab6e4b",
      upstreamKind: "person",
      upstreamId: "tipnr:person:unknown-homonym:999",
      canonicalEntityKey: null,
      mappingState: "distinct" as const,
      evidence: "TIPNR unknown-homonym distinct from entity:nehemiah-governor — same spelling, different person, not merged",
    },
    {
      sourceKey: "source:stepbible:tipnr",
      sourceReleaseKey: "release:source:stepbible:tipnr@ae39711d:sha-6cab6e4b",
      upstreamKind: "person",
      upstreamId: "tipnr:person:unresolved:006",
      canonicalEntityKey: null,
      mappingState: "unresolved" as const,
      evidence: "TIPNR unresolved:006 — no canonical entity, remains unresolved until review",
    },
    {
      sourceKey: "source:openbible:geocoding",
      sourceReleaseKey: "release:source:openbible:geocoding@7eb18a5e:sha-b8187aa4",
      upstreamKind: "place",
      upstreamId: "openbible:ancient:jerusalem",
      canonicalEntityKey: "entity:jerusalem",
      mappingState: "exact" as const,
      evidence: "openbible:ancient:jerusalem -> entity:jerusalem exact (same ancient place)",
    },
    {
      sourceKey: "source:openbible:geocoding",
      sourceReleaseKey: "release:source:openbible:geocoding@7eb18a5e:sha-b8187aa4",
      upstreamKind: "place",
      upstreamId: "openbible:ancient:susa",
      canonicalEntityKey: "entity:susa-citadel",
      mappingState: "exact" as const,
      evidence: "openbible:ancient:susa -> entity:susa-citadel exact",
    },
  ];

  const attestations = [
    {
      entityKey: "entity:nehemiah-governor",
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      referenceUnit: "Neh.2.1",
      kind: "primary_subject" as const,
      explicitness: "explicit" as const,
      claimKey: "claim:nehemiah-was-cupbearer",
      sourceReleaseKey: "release:source:stepbible:tipnr@ae39711d:sha-6cab6e4b",
      sourceLocator: "TIPNR:NEH:2.1:person:nehemiah-governor:explicit",
    },
    {
      entityKey: "entity:artaxerxes-i",
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      referenceUnit: "Neh.2.1",
      kind: "participant" as const,
      explicitness: "explicit" as const,
      claimKey: "claim:artaxerxes-was-king",
      sourceReleaseKey: "release:source:stepbible:tipnr@ae39711d:sha-6cab6e4b",
      sourceLocator: "TIPNR:NEH:2.1:person:artaxerxes-i:explicit",
    },
    {
      entityKey: "entity:jerusalem",
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      referenceUnit: "Neh.2.3",
      kind: "location" as const,
      explicitness: "explicit" as const,
      claimKey: "claim:jerusalem-location",
      sourceReleaseKey: "release:source:stepbible:tipnr@ae39711d:sha-6cab6e4b",
      sourceLocator: "TIPNR:NEH:2.3:place:jerusalem:explicit",
    },
    {
      entityKey: "entity:susa-citadel",
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      referenceUnit: "Neh.2.1",
      kind: "location" as const,
      explicitness: "strongly_implied" as const,
      claimKey: "claim:susa-location",
      sourceReleaseKey: "release:source:stepbible:tipnr@ae39711d:sha-6cab6e4b",
      sourceLocator: "TIPNR:NEH:2.1:place:susa:implied",
    },
  ];

  const relevances = [
    {
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      entityKey: "entity:nehemiah-governor",
      roleInPassage: "cupbearer making request to king",
      importance: "central" as const,
      isAttested: true,
    },
    {
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      entityKey: "entity:jerusalem",
      roleInPassage: "city to be rebuilt",
      importance: "central" as const,
      isAttested: true,
    },
    {
      scopeKey: "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20",
      entityKey: "entity:hanani-brother",
      roleInPassage: "brother who reported Jerusalem's condition (Neh.1.2, relevant not attested in Neh.2.1)",
      importance: "background" as const,
      isAttested: false, // relevant but not attested in Neh.2.1 scope — distinct
    },
  ];

  const conflicts = [
    {
      key: "conflict:artaxerxes-i-chronology",
      reason: "TIPNR established Artaxerxes I vs BibleData probable Artaxerxes (I/II ambiguous) — separate assertions, not merged",
    },
  ];

  const unresolved = [
    {
      upstreamId: "tipnr:person:unresolved:006",
      reason: "No canonical entity — remains unresolved, not counted as occurrence",
    },
  ];

  for (const m of mappings) externalMappingSchema.parse(m);
  for (const a of attestations) canonicalAttestationSchema.parse(a);
  for (const r of relevances) relevanceSchema.parse(r);

  const payload = JSON.stringify({ mappings, attestations, relevances });
  const candidatesSha256 = `sha256:${crypto.createHash("sha256").update(payload).digest("hex")}`;

  return {
    mappings,
    attestations,
    relevances,
    conflicts,
    unresolved,
    coverage: {
      mappings: mappings.length,
      attestations: attestations.length,
      relevances: relevances.length,
      conflicts: conflicts.length,
      unresolved: unresolved.length,
    },
    receipt: {
      candidatesSha256,
      parsedAt: new Date().toISOString(),
    },
  };
}
