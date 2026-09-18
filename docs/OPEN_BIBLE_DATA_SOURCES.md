# OPEN_BIBLE_DATA_SOURCES

Open Bible Data Source Catalog

Status

Last source review: 2026-09-13.

operation still requires rights and editorial review. Public access to a repository does not by
itself grant reuse rights.
Nehemiah 2 remains the only first-MVP production slice. Cataloging whole-Bible sources does not
expand that scope.

How this catalog is used I

The Al curation pipeline may cite only an exact source release and component whose permitted
operation is active in the authenticated, append-only operational source registry. A status in
this Markdown catalog is descriptive and can never authorize a download, Al disclosure, import,
or publication. Every source in this first review remains candidate_only.
Source status values:
candidate_only : researched enough to consider, but not allowed in an Al evidence bundle or
production import.
approved_for_evaluation : may be downloaded into an isolated evaluation environment.
approved_for_drafting : may support Al or human draft assertions under stated constraints.
approved_for_publication : a specific pinned release and set of fields may support reviewed
production records.
rejected : must not be used; retain the record so the decision is auditable.
superseded : replaced by a newer reviewed source entry or release.
Catalog statuses mirror reviewed decisions for human discovery; the operational registry is the
authorization boundary. Approval is operation-specific. Permission to evaluate does not imply
permission to redistribute, store offline, send to an external Al provider, generate embeddings,
or publish derived data.

Executive assessment

There is no single open database that satisfies the complete model in
WHOLE BIBLE CURATION SPEC.md. The strongest starting combination
is:

1. STEPBible TIPNR and TVTMS for proper-name candidates, references, relationships, original-name
   forms, and versification mappings.
2. MACULA Greek and Hebrew for original-language linguistic structure and participant-referent
   candidates.
3. OpenBible.info Geocoding for place-identification candidates, competing locations, evidence,
   and geographic confidence.
4. OpenBible.info Cross References for untyped related-passage candidates.
5. BibleData as a comparison source for people, relationships, and person-to-verse coverage.
   Theographic and ACAl Realia are valuable enrichment sources but require share-alike isolation and
   legal review. SemanticBible NT Names is useful as an ontology reference, but its reuse license is
   not clear enough for ingestion.
   No source becomes the canonical identity system. Bible Compass owns stable canonical keys and
   maps every upstream identifier through source-versioned crosswalks.

Most entries below are downloadable datasets, not hosted databases. TSV, CSV, JSON, XML, KML,
and RDF can all be normalized into the authoritative Postgres model. Theographic additionally
provides Neo4j material, but its existence does not require Bible Compass to operate a graph
database. SemanticBible is the only candidate here whose native interchange model is RDF/OWL.

Coverage matrix

Legend: strong means directly useful coverage is stated by the publisher; partial means useful
but incomplete, indirect, or not sufficiently typed; means not a material source for that
area. These are acquisition assessments, not claims of correctness.

Candidate People and Verse Relationship Places Events Linguistics/r Passage
names attestations S eferents relations

STEPBible strong strong for strong for strong partial strong
Data named family data candidates
proper
nouns I

Theographic strong partial partial strong periods/parti partial
candidates al references

BibleData strong strong for strong in progress in progress partial
people candidates Strong's
data

OpenBible place names strong place geographic strong
Geocoding only references containment candidates
only

OpenBible indirect indirect strong but
Cross untyped
References

MACULA participant strong semantic indirect indirect strong discourse-
Greek candidates word-level roles, not candidates level only
candidates biographies

MACULA participant word-level semantic indirect indirect strong discourse-
Hebrew candidates candidates; roles, not morphology/ level only
referents biographies syntax;
require referents
completenes partial
s review

ACAI Realia linked explicit and partial linked place other referent speech/refer
entity/realia implicit candidates realia/partial candidates ence links
candidates candidates

SemanticBib NT-only, partial partial partial
le NT Names incomplete coordinates

Candidate source records

STEPBible Data

Field Detail

Proposed source keys source:stepbible:tipnr,source:stepbible:tvtms,
source:stepbible:tahot,source:stepbible:tagnt

Maintainer STEPBible; data initially created by Tyndale House
I Cambridge and now curated by STEPBible

Primary page STEPBible Data repository

License evidence Repository states CC BY 4.0 and requests credit to "STEP
Bible" linked to stepbible.org

Format UTF-8 tab-separated text; some datasets use hierarchical
multi-line records rather than one row per line

Stated coverage Proper nouns, Hebrew/Greek forms, individualized
people/places/things, named references, family relations,
place geolocation, versification, tagged Hebrew OT and
Greek NT, lexicons and morphology

Current catalog status candidate_only

Best fit:

TiPNR entity candidates, names, aliases, original-language forms, named Scripture attestations,
family relationship assertions, and place candidates.
TVTMS reference-system and versification mappings.
TAHOT/TAGNT lexical and morphological enrichment when the corresponding textual basis and
component rights have been separately approved.
Risks and restrictions:

TiPNR brief, short, and article-length descriptions are identified by the repository as created
with Claude 3. They may be used only as untrusted draft leads; they are not evidence and cannot
be imported as approved descriptions.
"Exhaustive" coverage is an upstream assertion that Bible Compass must test, not repeat as an
internal guarantee.
Proper-name identity resolution can encode disputed identifications. Import identities and
relationships as sourced candidates, never destructive merges.
Tags or data derived from a named Bible edition may carry different text or publisher rights.
Dataset-level CC BY must not be assumed to license embedded Scripture text.
Normalize STEPBible reference abbreviations through a reviewed crosswalk rather than treating
them as Bible Compass canonical identifiers.

Recommended disposition: highest-priority source for a Nehemiah 2 evaluation import after a

Theographic Bible Metadata

Field Detail

Proposed source key source:theographic:metadata

Maintainer Robert Rouse /Viz.Bible project

Primary page Theographic Bible Metadata repository

License evidence Repository license and README state CC BY-SA 4.0

Format Nested JSON is the publisher's preferred import; CSV and
Neo4j material are also provided

Stated coverage Knowledge graph of biblical people, places, periods, and
passages
Current catalog status I candidate_only

Best fit:
Independent entity, passage, place, and time-period candidates.
• Comparison of graph traversal and source-to-canonical crosswalk design.
A useful prototype corpus for testing graph-shaped queries without selecting Neo4j as the
authoritative database.
Risks and restrictions:
CC BY-SA is a share-alike license. Do not combine its records irreversibly with CC BY or
proprietary material until legal review defines the derivative-database and distribution
obligations.
· Retain source lineage at assertion level and produce a separable source-derived projection.
CSV files are not normalized relational tables; arrays and implicit relationships require a
deterministic staging transform.
The dataset is not a substitute for claim-level sources or Bible Compass editorial review.
The source is framed around a Protestant 66-book, KJV-oriented inventory; that scope must not
silently define future canon or edition policy.
Easton-derived prose, traditional writer attributions, incomplete event fields, and precise

profiles, authorship facts, or product chronology.
Scripture references and chapter records do not establish reviewed passage segmentation or
passage context.
Recommended disposition: evaluate in a quarantined, source-separable schema; do not use as the
canenical production backbone until share-alike obligations are approved.

BibleData

Field Detail

Proposed source key source:bibledata:structured

Maintainer Brady Stephenson and listed contributors

Primary page BibleData repository

License evidence Repository states CC BY 4.0

Format CSV

Stated completed coverage Named people, labels, relationships, person-to-verse
references, reference skeleton, Hebrew Strong's data, and
several legacy reference works

Stated incomplete coverage I Books, epochs, events, places, place labels, and place-to-
verse records are marked in progress; significant things are
planned

Current catalog status candidate_only

Best fit:
• Independent person, alias, relationship, and verse-attestation candidates.
· Relational import and cross-source discrepancy testing.
· Detecting possible gaps in STEPBible-derived person coverage.
Risks and restrictions:
· Upstream "every named individual" and "every person mentioned" claims require coverage tests.
· Dataset completion differs by file. Never infer that an existing place or event file is complete.
Included legacy dictionaries, chronologies, polyglot texts, and Strong's-derived files can have
distinct editorial quality, textual basis, and upstream rights. Admit them as separate source
components, not under one blanket approval.
Chronology data such as Ussher represents a particular system and must be modeled as a sourced
position, not as the product chronology.
Consequential upstream classifications—including divine or angelic figures as persons,
eponymous ancestors versus collectives/polities, sex classifications, and the traditional 613
commandments—require specialist identity and perspective review.
Recommended disposition: priority comparison source for people and explicit verse references;
defer events and places until their upstream status and file quality are reviewed.

Detail
Field
source:openbible:geocoding
Proposed source key

Maintainer OpenBible.info

Primary page Bible Geocoding

Raw-data link Bible Geocoding Data repository

License evidence Core data is stated as CC BY 4.0; OpenStreetMap-derived
data is ODbL 1.0 and images have separate licenses

Format Raw repository documents JSON Lines, GeoJSON, KML,
and separately licensed image archives; the project page
also offers KMZ display downloads

Stated coverage Possible modern locations for identifiable biblical places,
confidence, source links, book/chapter layers and verse
associations

Current catalog status candidate_only

Best fit:

Place identity and candidate-site assertions.
Point/area candidates, verse attestations, location precision, and evidence links.
Testing the model for multiple proposed modern identifications of one ancient place.

Risks and restrictions:
The publisher explicitly acknowledges likely errors and does not claim specialist credentials;
geographic review is mandatory.
"Most likely" is a source conclusion, not permission to store an exact established location.
OpenStreetMap components retain their own license obligations.
Photographs have varied licenses and must not be imported under the dataset license.
Page-level ESV quotations are separately copyrighted; ingest geographic data only, not displayed
Scripture or page prose.
Recommended disposition: primary geographic candidate source after a field-level provenance and
license audit. Preserve all plausible candidates and the source's confidence rather than selecting
one coordinate during import.

OpenBible.info Cross References

Field Detail

Proposed source key source:openbible:cross-references

Maintainer OpenBible.info

Primary page Bible Cross References

License evidence Page links to CC BY 4.0 unless otherwise indicated; it says
the data draws primarily from public-domain sources,
especially Treasury of Scripture Knowledge

Format Downloadable compressed dataset

Stated coverage About 340,000 ranked/commonality links between Bible
passages

Best fit:

Candidate scope_relations and discovery/search suggestions.
Input to a human or Al classification job that assigns a controlled relation only when evidence
supports it.

Risks and restrictions:

A link may reflect a similar theme, word, event, or person. It does not establish quotation,
allusion, fulfillment, parallel account, cause, or chronology.
Store the imported edge initially as an untyped related_candidate ; never guess a stronger
predicate from proximity or ranking.
Preserve originating-source, vote/rank, and transformation lineage. Rank is a discovery signal,
never evidential confidence.
Do not import the separately copyrighted ESV quotations displayed on the site.
Verify the exact license version and attribution for the downloaded artifact before use.

Recommended disposition: discovery-only candidate graph until each reader-visible relation is
classified, cited, and reviewed.

MACULA Greek and MACULA Hebrew

Field Detail

Proposed source keys source:macula:greek,source:macula:hebrew

Maintainer Clear Bible and credited source partners

Primary pages MACULA Greek and MACULA Hebrew

License evidence Greek license and Hebrew license; repositories
describe CC BY 4.0 components and enumerate upstream
sources

Format Greek provides TEl, nested-node XML, lowfat XML, and
TSV; Hebrew documents node XML, lowfat XML, and TSV

Stated coverage Original-language text linkage, morphology, syntax, word
senses/glosses, semantic roles, and participant referents;
exact components differ between Greek and Hebrew

Current catalog status candidate_only

Best fit:

Original-language token and linguistic annotations.
Pronoun, implicit-participant, speaker, agent, and patient candidates.
Evidence for canonical attestations and edition-specific mention selectors after reference and
textual-basis alignment.
Risks and restrictions:

Each repository combines multiple upstream components. Record license, attribution, source, and
transformation lineage at component or field level; do not reduce everything to "MACULA."
Participant referents are annotations that require validation, especially ambiguous or
disputed identities.
Original-language tokenization and versification will not necessarily align one-to-one with an
English translation. Never reuse source offsets as English edition offsets.
Morphological, sense, gloss, syntactic, and textual components may have different update rates
and evidence bases.

rights review and deterministic alignment tests.

BibleAquifer ACAI Realia

Field Detail

Proposed source key source:bibleaquifer:acai-realia

Maintainer BibleAquifer / ACAl contributors

Primary page ACAI Realia README

License evidence Current ACAl release is stated as CC BY-SA 4.0; its
enumerated upstream inputs include both CC BY 4.0 and
CC BY-SA 4.0 components

Format Structured repository files with realia, localization,
reference, instance, referent, and speech data

Stated coverage Realia records plus localized labels/descriptions, lemma
links, references, explicit instances, pronominal/subject
referents, and speech data; linked entities may include
people, places, and other referents

Maturity Publisher marks the material draft/incomplete, including
gaps in Hebrew word-level referents

Current catalog status candidate_only

Best fit:

Entity and localization candidates.
Explicit and implicit canonical attestations.
Edition mention, pronoun/subject referent, and speech attribution candidates.

Risks and restrictions:

Draft/incomplete data cannot establish whole-Bible coverage.
Mixed CC BY and CC BY-SA inputs require per-record or per-component provenance and separable
storage. A repository-level label is insufficient.
Entity identity and implicit referents may embody interpretive judgments; retain uncertainty and
competing assertions.
Localized labels still require language review and do not replace the project's independently
versioned localization workflow.

Recommended disposition: high-value enrichment source in a share-alike quarantine; not the first
canonical import.

SemanticBible New Testament Names

Field Detail

Proposed source key source:semanticbible:nt-names

Maintainer Sean Boisen/ SemanticBible

Primary pages NT Names documentation and downloads/status

Format OWL/RDF expressed in XML; ontology and instance files
are separate

Stated coverage New Testament named entities, selected relationships and
place coordinates; available status page describes
complete women but incomplete men

Currency Documentation identifies a 2006-era version and describes
itself as an incomplete draft

License evidence No sufficiently clear reusable data license was established
in this review; accompanying material displays copyright
notices

Current catalog status candidate_only; ingestion blocked on license clarification

Best fit:

Ontology-design comparison, stable-URl patterns, name disambiguation, and RDF import experiments
using synthetic data.
Risks and restrictions:
NT-only, old, and explicitly incomplete.
English name forms are documented against the ESV, so translation-specific assumptions require
separate rights and alignment review.
Public download is not a reuse license. Do not ingest or redistribute until the rights holder
provides clear terms applicable to the data.
· Do not inherit OWL class assertions as product ontology. Modeling choices such as treating a
person, people, place, or polity under one primary class are comparison inputs, not canonical
classifications.
Recommended disposition: reference-only; reject production ingestion unless licensing is
clarified and the dated/incomplete coverage provides unique value.

Reauired source-registry record

Required source-registry record

Before a download, register a candidate acquisition request containing the intended source,
artifact URL, purpose, retention policy, and proposed operations. After authorized acquisition,
but before opening, parsing, Al use, or import, bind the exact bytes and license evidence to an
append-only release record equivalent to the following illustrative structure:

"source_key": "source:stepbible:tipnr",
"source_release_key": "source-release:stepbible:tipnr:<immutable-revision>",
"catalog_status": "approved_for_evaluation",
"publisher": "STEPBible",
"canonical_url": "https://github.com/STEPBible/STEPBible-Data",
"artifact": {
"url": "<exact file or immutable archive URL>",
"release_tag_or_commit": "<immutable revision>",
"retrieved_at": "<UTC timestamp>",
"byte_size": 0,
"sha256": "<artifact checksum>"
},
"components": [
{
"component_key": "tipnr-structured-fields",
"paths_or_fields": ["<exact paths or field selectors>"],
"license_spdx": "CC-BY-4.0",
"license_evidence": {
"url": "<exact license or terms URL>",
"retrieved_at": "<UTC timestamp>",
"retained_artifact_sha256": "<license-text checksum>"
},
"required_attribution": "<reviewed exact wording>",
"approved_operations": ["evaluation_import"],
"prohibited_operations": [
"production_publication",
"external_ai_processing",
"embedding_generation"
1
} I
].
"excluded_components": ["AI-generated descriptions"],
"textual_basis": "<edition or corpus basis>",
"reference_system": "<upstream reference convention>",
"review": {
"rights_reviewer": null,
"content_reviewer": null,
"decision_date": null
山
}

Never use a moving branch name as the reproducible release identity. Pin a tag or commit and hash
the acquired artifact. If upstream changes, admit it as a new source release and generate a diff;
do not silently replace imported data.
Composite sources require one component entry per distinct rights boundary, with exact artifact,
path, record-partition, or field selectors. A source cannot move past isolated evaluation when
component applicability or operation grants are ambiguous.

Import and provenance rules

Staging boundary
Load each source release into a source-specific staging schema or immutable raw package. Preserve
raw field names and upstream identifiers. Transformation into canonical tables occurs only after
schema validation and produces an import receipt containing row counts, rejected rows, reference
mapping results, and checksums.

Canonical identity
An upstream identifier maps through an explicit crosswalk:

(source_key, release, upstream_kind, upstream_id)
-> canonical_entity_key or unresolved candidate key

Never overwrite one source's identifier with another, infer same_as from matching English names,
or destructively merge a disputed identity. Conflicts become separate sourced assertions and, when
necessary, explicit interpretive positions.

Assertion-level lineage
Every imported attestation, relationship, coordinate, date, name, or other claim retains:
Source key, pinned release, upstream record identifier, and transformation version
Original reference or locator
License component key, evidence digest, and required attribution
Source-stated confidence separately from Bible Compass review status
Import time, checksum, and validation result
Supersession history when corrected
Generated counts, reverse edges, search records, and mobile projections inherit the contributing
source-release set and build checksum.
Before publication, the release builder computes the union of effective obligations from every
assertion-lineage edge. It must reject unknown obligations and license/package incompatibilities,
including incompatible share-alike combinations, and generate a data-and-license bill of materials
listing source releases, components, checksums, transformation versions, contributed assertions,
required notices, and reviewer approvals.

License isolation
Keep CC BY-SA-derived assertions identifiable and exportable as a separable projection until a
rights reviewer approves the intended combined-database treatment.
Do not copy website prose, images, map tiles, or displayed Scripture merely because adjacent raw
data is open.
Record component-specific licenses for composite repositories.
Treat absent, ambiguous, or versionless license terms as denied.
Approval for database publication does not grant external Al processing or embedding rights.

Editorial and theological safety
External data enters as draft_candidate ; it never receives approved or published from an
importer.
Al-generated upstream prose is not evidence.
Preserve separate evidence, textual-basis, identification, date, and location certainty.
Classify passage relationships only when the evidence supports the controlled predicate.
Human reviewers resolve reader-visible descriptions, disputed identitles, geographic choioee

Admission checklist

Required attribution and notice placement approved

Canon, versification, book-code, Unicode, and textual-basis mappings documented
Import schema and deterministic converter reviewed
Duplicate, malformed, missing-reference, and unresolved-identity behavior tested
Coverage claims measured against a known reference inventory
Sample records reviewed by biblical, language, geographic, and editorial specialists as relevant
Conflicts remain sourced assertions rather than silent overwrites
Raw source, normalized output, rejects, and import receipt remain reproducible
Rollback or forward-fix plan exists

Recommended evaluation sequence

1. Audit and pin only the relevant STEPBible TIPNR and TVTMS files.
2. Import Nehemiah 2 into isolated staging and produce entity/reference candidates without prose.
3. Compare people and verse references against BibleData.
4. Add OpenBible geographic candidates for places in the slice.
5. Evaluate MACULA referents needed to resolve pronouns or implicit participants.
6. Measure disagreements, unresolved identities, false coordinate precision, and reference mapping
   failures.
   approved_for_drafting. 7. Have rights and content reviewers decide whether any exact source release may advance to
7. Consider Theographic and ACAl only after the share-alike isolation design is approved.
   This sequence evaluates usefulness without importing a whole canon or changing the MVP corpus.
   Known gaps after combining these sources
   Even a successful combined import will not provide production-ready:
   Reviewed book, chapter, and passage context
   Context-specific explanations of why an entity matters in a passage
   Complete typed events, event participation, and competing chronologies
   Reliably typed quotations, allusions, echoes, fulfillments, and parallel accounts
   Claim-level scholarly citations for every historical or interpretive statement
   Complete objects, practices, institutions, roles, laws, covenants, themes, and concepts
   Reviewed identity policy for divine, angelic, demonic, and other spiritual beings
   Metonymic person/people/place/polity references and eponymous ancestor/collective distinctions
   Approved multilingual descriptions, relationship renderings, and search aliases
   Translation-edition mention spans validated against each exact edition
   Rights-approved maps, images, accessibility copy, or reader-facing prose
   versions Editorial approval, theological-perspective handling, corrections, and immutable publication
