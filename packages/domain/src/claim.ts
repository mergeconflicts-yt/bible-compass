import type {
  EvidenceStatus,
  TextualBasis,
  DatePrecision,
  LocationPrecision,
} from "./entity";

export type ClaimPredicate =
  | "was_cupbearer_to"
  | "ruled"
  | "located_at"
  | "member_of"
  | "participated_in"
  | "related_to";

export interface Claim {
  key: string;
  subjectType: "entity" | "scope" | "event" | "place";
  subjectId: string;
  predicate: ClaimPredicate;
  object: unknown;
  evidenceStatus: EvidenceStatus;
  textualBasis: TextualBasis;
  datePrecision?: DatePrecision;
  locationPrecision?: LocationPrecision;
  reviewState: "draft" | "in_review" | "approved" | "published";
}

export type CitationSupportKind =
  "supports" | "qualifies" | "disputes" | "background";

export interface ClaimCitation {
  claimId: string;
  sourceReleaseId: string;
  locator: string;
  supportKind: CitationSupportKind;
  digest: string;
}
