export type EntityType =
  | "person"
  | "deity"
  | "event"
  | "place"
  | "collective"
  | "polity"
  | "role"
  | "object"
  | "structure"
  | "practice"
  | "institution"
  | "theme";

export type IdentificationStatus =
  "established" | "traditional" | "proposed" | "disputed" | "unknown";

export type EvidenceStatus =
  "established" | "probable" | "possible" | "disputed" | "unknown";

export type TextualBasis =
  "explicit" | "strongly_implied" | "inferred" | "disputed";

export type DatePrecision =
  "exact" | "range" | "decade" | "century" | "unknown";

export type LocationPrecision =
  "exact_site" | "approximate" | "area" | "candidates" | "unknown";

export interface EntityIdentity {
  key: string;
  slug: string;
  type: EntityType;
  identificationStatus: IdentificationStatus;
}

export interface LocalizedEntityName {
  entityKey: string;
  languageTag: "en" | "te" | "ta";
  form: string;
  kind: "preferred" | "alias" | "title" | "epithet" | "transliteration";
}
