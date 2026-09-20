#!/usr/bin/env python3
"""Nehemiah 2 reference curation (Task EN-01).

Builds three separate CUR-01 contract v2.0.0 packages plus an evidence catalog:

  content/nehemiah-2/canonical.v2.json      canonical (translation-independent)
  content/nehemiah-2/locale-en.v2.json      English locale context
  content/nehemiah-2/edition-bsb.v2.json    BSB edition mentions + selectors
  content/nehemiah-2/evidence-catalog.json  lightweight source provenance

The edition/locale packages depend on the exact canonical package (package key,
revision and a deterministic RFC-8785-style digest). Selectors are computed from
the bundled BSB text and verified by packages/content-schema/tests/neh2-global.test.ts.

Nothing here is approved, verified or production-ready: every record carries
review_status "draft" and the package data_classification stays the contract's
"synthetic_fixture". Unknown or unsupported context is expressed as an open
question, never as invented prose. Regeneration is deterministic.

Usage: python3 tools/curate_neh2.py
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BSB_NEH = REPO / "apps" / "mobile" / "assets" / "scripture" / "bsb" / "Neh.json"
OUT = REPO / "content" / "nehemiah-2"

CANON = "canon:prot-66"
REFSYS = "refsys:eng-v22"
EDITION = "edition:bsb@20260912:sha-b2898c49"
CONTRACT = "2.0.0"
VOCAB = "1.0.0"
COVERAGE_POLICY = "1.0.0"
DATA_CLASSIFICATION = "synthetic_fixture"

CANON_PKG = "draft:neh2:canonical"
LOCALE_PKG = "draft:neh2:locale-en"
EDITION_PKG = "draft:neh2:edition-bsb"
REGISTRY_PKG = "registry:prot-66:canon-skeleton"

# --- ratified scope keys (docs/CANONICAL_IDENTIFIERS.md §6) ---
S_CHAPTER = "scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20"
S_REQUEST = "scope:neh-2-request:refsys:eng-v22:Neh.2.1-Neh.2.8"
S_JOURNEY = "scope:neh-2-journey:refsys:eng-v22:Neh.2.9-Neh.2.10"
S_INSPECTION = "scope:neh-2-inspection:refsys:eng-v22:Neh.2.11-Neh.2.16"
S_RALLY = "scope:neh-2-rally:refsys:eng-v22:Neh.2.17-Neh.2.18"
S_ANSWER = "scope:neh-2-answer:refsys:eng-v22:Neh.2.19-Neh.2.20"
SCOPES = [S_CHAPTER, S_REQUEST, S_JOURNEY, S_INSPECTION, S_RALLY, S_ANSWER]

VERSES = [f"verse:Neh.2.{n}" for n in range(1, 21)]

PROVENANCE = (
    "Curated from the bundled Berean Standard Bible (BSB) text with structured "
    "name and reference evidence from STEPBible TIPNR, BibleData and OpenBible "
    "(all CC BY 4.0). Draft machine-assisted curation; not reviewed, approved or "
    "published."
)

# ---------------------------------------------------------------------------
# evidence catalog (job-supplied provenance; the validator authorizes against it)
# ---------------------------------------------------------------------------

TIPNR = "release:source:stepbible:tipnr@ae39711d:sha-6cab6e4b"
BIBLEDATA = "release:source:bibledata:structured@8799b409:sha-489b5f58"
OPENBIBLE = "release:source:openbible:geocoding@7eb18a5e:sha-b8187aa4"

SCRIPTURE_VERSES = {
    "neh-1-11": "Neh.1.11",
    "neh-5-14": "Neh.5.14",
    "neh-6-15": "Neh.6.15",
    "ezra-4-21": "Ezra.4.21",
    "ezra-4-23": "Ezra.4.23",
    **{f"neh-2-{n}": f"Neh.2.{n}" for n in range(1, 21)},
}

EVIDENCE: list[dict] = []
for slug, locator in SCRIPTURE_VERSES.items():
    EVIDENCE.append(
        {
            "evidence_item_key": f"evidence:bsb:{slug}",
            "source_key": "source:bsb:edition",
            "release_key": EDITION,
            "kind": "scripture",
            "locator": locator,
            "note": "BSB verse text supplied in the immutable job snapshot.",
        }
    )

_LOCAL = [
    ("tipnr", TIPNR, "source:stepbible:tipnr", [
        ("nehemiah", "Nehemiah@Neh.1.1", "Nehemiah son of Hacaliah, brother of Hanani"),
        ("artaxerxes", "Artaxerxes@Ezr.4.7-Neh", "Artaxerxes Longimanus; some identify a different Artaxerxes in Ezra 4"),
        ("sanballat", "Sanballat@Neh.2.10", "Sanballat, first named at Neh.2.10"),
        ("tobiah", "Tobiah@Neh.2.10", "Tobiah the Ammonite, Nehemiah's adversary"),
        ("geshem", "Geshem@Neh.2.19", "Geshem, first named at Neh.2.19"),
        ("asaph", "Asaph@1Ch.9.15-Neh", "Asaph is a name borne by several men; the keeper of the king's forest is not further identified"),
        ("jerusalem", "Jerusalem", "Jerusalem place entry"),
        ("susa", "Susa", "Susa, Persian administrative centre"),
    ]),
    ("bibledata", BIBLEDATA, "source:bibledata:structured", [
        ("nehemiah-1", "Nehemiah_1", "Nehemiah_1: cup-bearer to King Artaxerxes (NEH 2:1)"),
        ("artaxerxes-1", "Artaxerxes_1", "Artaxerxes_1 person record"),
        ("sanballat-1", "Sanballat_1", "Sanballat_1 person record"),
        ("tobiah-2", "Tobiah_2", "Tobiah_2 person record"),
        ("geshem-1", "Geshem_1", "Geshem_1 person record"),
    ]),
    ("openbible", OPENBIBLE, "source:openbible:geocoding", [
        ("jerusalem", "a15257a", "OpenBible place a15257a"),
        ("valley-gate", "a81b7b1", "OpenBible place a81b7b1"),
        ("fountain-gate", "a2fc4c4", "OpenBible place a2fc4c4"),
        ("dung-gate", "a1611b6", "OpenBible place a1611b6"),
        ("beyond-the-river", "a88310a", "OpenBible place a88310a"),
        ("susa", "a033b84", "OpenBible place a033b84"),
    ]),
]
for _prefix, _release, _source, _items in _LOCAL:
    for _slug, _locator, _note in _items:
        EVIDENCE.append(
            {
                "evidence_item_key": f"evidence:{_prefix}:{_slug}",
                "source_key": _source,
                "release_key": _release,
                "kind": "structured_local_source",
                "locator": _locator,
                "note": _note,
            }
        )

EVIDENCE_KEYS = {e["evidence_item_key"] for e in EVIDENCE}

# ---------------------------------------------------------------------------
# entities
# ---------------------------------------------------------------------------


def ent(slug, type_, label, aliases, ident, short, ext, claims):
    return {
        "slug": slug,
        "type": type_,
        "label": label,
        "aliases": aliases,
        "identification_status": ident,
        "short": short,
        "extended": ext,
        "claims": claims,
    }


ENTITIES = [
    ent("nehemiah-governor", "person", "Nehemiah", ["Nehemiah the governor", "the cupbearer"], "established",
        "Jewish official in the Persian court who returned to rebuild Jerusalem's walls.",
        "Nehemiah son of Hacaliah served King Artaxerxes I as cupbearer. In the king's twentieth year he asked permission to rebuild Jerusalem, travelled to Judah with royal letters and an escort, secretly inspected the ruined walls, and rallied the people to rebuild.",
        ["nehemiah-cupbearer", "nehemiah-serves-artaxerxes"]),
    ent("artaxerxes-i", "person", "Artaxerxes I", ["King Artaxerxes"], "established",
        "Persian king who granted Nehemiah permission, letters, timber and an escort.",
        "The Persian king addressed in Nehemiah 2. He notices Nehemiah's sadness, asks about his request, and grants letters for safe passage, timber from the royal forest and a military escort. Ancient regnal-year reckoning means the exact year is approximate.",
        ["artaxerxes-reigns", "artaxerxes-rules-persia", "artaxerxes-grants-request"]),
    ent("queen", "person", "The queen", [], "established",
        "The queen seated beside Artaxerxes during Nehemiah's request; the text does not name her.",
        "Nehemiah 2:6 notes that the queen was seated beside the king when he questioned Nehemiah. She is not named and no further detail is given in the chapter.",
        ["queen-present"]),
    ent("asaph-royal-park", "person", "Asaph", ["keeper of the king's forest"], "proposed",
        "Keeper of the king's forest, asked to supply timber for the rebuilding.",
        "Nehemiah asks for a letter to Asaph, keeper of the king's forest, so that timber may be given for the gates of the citadel, the city wall and Nehemiah's house. Several men named Asaph appear in Scripture; the chapter does not identify this Asaph further.",
        ["asaph-keeper-forest"]),
    ent("sanballat-the-horonite", "person", "Sanballat the Horonite", [], "established",
        "Regional opponent of the rebuilding, first named as Nehemiah arrives.",
        "Sanballat is introduced in Nehemiah 2:10 as deeply disturbed that someone had come to seek the well-being of the Israelites, and in 2:19 he mocks the builders. He reappears throughout Nehemiah's account.",
        ["sanballat-opposes"]),
    ent("tobiah-ammonite", "person", "Tobiah the Ammonite official", [], "established",
        "Ammonite official who opposes Nehemiah alongside Sanballat.",
        "Tobiah is named with Sanballat in Nehemiah 2:10 and 2:19 as an opponent of the rebuilding. His title in the BSB is 'the Ammonite official'.",
        ["tobiah-opposes"]),
    ent("geshem-arabian", "person", "Geshem the Arab", [], "established",
        "Arabian figure who joins Sanballat and Tobiah in mocking the rebuilding.",
        "Geshem is named in Nehemiah 2:19 with Sanballat and Tobiah when they mock the builders and accuse them of rebelling against the king.",
        ["geshem-opposes"]),
    ent("god-of-heaven", "deity", "The God of heaven", [], "established",
        "The God to whom Nehemiah prays and on whom he relies for success.",
        "Nehemiah prays to the God of heaven before answering the king (2:4) and declares that the God of heaven will grant success to the builders (2:20). The God of heaven is typed with the canonical 'deity' entity type, not 'person'.",
        ["nehemiah-prays", "god-will-grant-success"]),
    ent("susa", "place", "Susa", ["Shushan"], "traditional",
        "Persian administrative centre traditionally associated with the court scene.",
        "Nehemiah 2 does not name the city of the royal court. Nehemiah 1:1 places Nehemiah in Susa, and the court scene of chapter 2 is traditionally read as taking place there.",
        ["artaxerxes-rules-persia"]),
    ent("jerusalem", "place", "Jerusalem", [], "established",
        "The ruined ancestral city Nehemiah seeks to restore.",
        "Jerusalem is the city whose walls and gates lie in ruins. Nehemiah calls it the city where his fathers are buried, inspects its damage by night, and rallies the people to rebuild.",
        ["jerusalem-in-judah", "jerusalem-ancestral-city"]),
    ent("judah", "place", "Judah", ["Yehud"], "established",
        "The province and homeland to which Nehemiah asks to be sent.",
        "Nehemiah asks the king to send him to Judah, to the city where his fathers are buried, so that he may rebuild it (2:5).",
        ["jerusalem-in-judah", "nehemiah-governor-of-judah"]),
    ent("beyond-the-river", "place", "Beyond the River", ["west of the Euphrates"], "established",
        "The Persian province west of the Euphrates through which Nehemiah travels.",
        "Nehemiah asks for letters to the governors west of the Euphrates so that they will grant him safe passage until he reaches Judah (2:7), and he delivers those letters to them on the way (2:9).",
        ["beyond-river-part-of-persia"]),
    ent("kings-pool", "place", "The King's Pool", [], "traditional",
        "Water feature on Nehemiah's night route near the Fountain Gate.",
        "Nehemiah 2:14 records that he went on to the Fountain Gate and the King's Pool, where there was no room for the animal under him to get through. Its exact location is not established by the chapter.",
        []),
    ent("kings-forest", "place", "The king's forest", [], "unknown",
        "Royal forest from which timber is requested.",
        "Nehemiah asks for a letter to Asaph, keeper of the king's forest, for timber to make beams (2:8). The chapter does not locate the forest.",
        ["asaph-keeper-forest"]),
    ent("well-of-the-serpent", "place", "The Well of the Serpent", [], "unknown",
        "Landmark on Nehemiah's night inspection route.",
        "Nehemiah 2:13 records that he went out by night through the Valley Gate toward the Well of the Serpent and the Dung Gate. Its identification is uncertain.",
        []),
    ent("jerusalem-wall", "structure", "The wall of Jerusalem", ["the city wall"], "established",
        "The wall of Jerusalem, broken down in Nehemiah's time and rebuilt by the people.",
        "Nehemiah 2:13 and 2:17 describe the wall of Jerusalem as broken down. Nehemiah inspects the damage by night and calls the people to rebuild the wall; the chapter does not say the wall itself was burned.",
        ["wall-broken-down", "jerusalem-wall-part-of-jerusalem", "nehemiah-inspects-wall", "people-agree-rebuild"]),
    ent("jerusalem-gates", "structure", "The gates of Jerusalem", ["its gates"], "established",
        "The city gates, which had been destroyed by fire.",
        "Jerusalem's gates are described as destroyed and burned by fire (2:3, 2:13, 2:17). Rebuilding them is part of the work Nehemiah and the people undertake.",
        ["gates-destroyed-by-fire"]),
    ent("valley-gate", "structure", "The Valley Gate", [], "traditional",
        "Gate marking the start and end of Nehemiah's night inspection.",
        "Nehemiah goes out through the Valley Gate (2:13) and re-enters through it (2:15). Its Persian-period location is reconstructed rather than certain.",
        ["valley-gate-part-of-jerusalem"]),
    ent("dung-gate", "structure", "The Dung Gate", [], "traditional",
        "Gate on Nehemiah's night inspection route.",
        "Nehemiah 2:13 names the Dung Gate as he inspects the broken walls and burned gates.",
        ["dung-gate-part-of-jerusalem"]),
    ent("fountain-gate", "structure", "The Fountain Gate", [], "traditional",
        "Gate near the King's Pool on Nehemiah's night route.",
        "Nehemiah 2:14 records that he went on to the Fountain Gate and the King's Pool.",
        ["fountain-gate-part-of-jerusalem"]),
    ent("persian-empire", "polity", "The Persian Empire", ["Achaemenid Empire"], "established",
        "The empire governing Judah and the province Beyond the River.",
        "Artaxerxes' empire authorises Nehemiah's journey, letters, timber and escort; Judah lies within its province Beyond the River.",
        ["artaxerxes-rules-persia", "beyond-river-part-of-persia"]),
    ent("governors-beyond-the-river", "collective", "The governors west of the Euphrates", [], "established",
        "Provincial governors who receive the king's letters for Nehemiah's passage.",
        "Nehemiah asks for letters to the governors west of the Euphrates so that they grant him safe passage to Judah (2:7), and he delivers the king's letters to them (2:9).",
        ["governors-govern-beyond-river"]),
    ent("israelites", "collective", "The Israelites", [], "established",
        "The people whose well-being Nehemiah came to seek.",
        "Nehemiah 2:10 says Sanballat and Tobiah were deeply disturbed that someone had come to seek the well-being of the Israelites.",
        ["sanballat-opposes", "tobiah-opposes"]),
    ent("judean-people", "collective", "The Jews, priests, nobles and officials", ["the people of Jerusalem"], "established",
        "The Jerusalem community Nehemiah rallies to rebuild the wall.",
        "Nehemiah 2:16 names the Jews, priests, nobles, officials and other workers; in 2:17-18 he calls them to rebuild and they set their hands to the work.",
        ["people-agree-rebuild"]),
    ent("royal-escort", "collective", "The army officers and cavalry", ["the king's escort"], "established",
        "Military escort sent with Nehemiah by the king.",
        "Nehemiah 2:9 records that the king had sent army officers and cavalry with him.",
        ["royal-escort-provided"]),
    ent("cupbearer", "role", "Cupbearer", ["the king's cupbearer"], "established",
        "Court office giving Nehemiah trusted access to the king.",
        "Nehemiah is identified elsewhere as the king's cupbearer (Neh.1.11; BibleData 'cup-bearer to King Artaxerxes'). In Nehemiah 2 he serves the king wine, and this access explains his opportunity to speak.",
        ["nehemiah-cupbearer"]),
    ent("king", "role", "King", [], "established",
        "The royal office held by Artaxerxes.",
        "Artaxerxes is repeatedly called 'the king' in Nehemiah 2 and holds sole authority to grant Nehemiah's request.",
        ["artaxerxes-reigns"]),
    ent("royal-letters", "object", "The king's letters", [], "established",
        "Written authorisation Nehemiah requests and carries.",
        "Nehemiah asks for letters to the governors west of the Euphrates for safe passage (2:7) and delivers the king's letters to them (2:9).",
        []),
    ent("timber", "object", "Timber", [], "established",
        "Beams requested from the king's forest for gates, wall and house.",
        "Nehemiah asks for timber to make beams for the gates of the citadel, the city wall and the house he will occupy (2:8).",
        ["asaph-keeper-forest"]),
    ent("wine", "object", "The wine", [], "established",
        "The wine Nehemiah served the king when his sadness was noticed.",
        "Nehemiah 2:1 records that wine was set before the king and that Nehemiah took it and gave it to him.",
        []),
    ent("prayer-to-god-of-heaven", "practice", "Prayer to the God of heaven", [], "established",
        "Nehemiah's prayer between the king's question and his answer.",
        "When the king asks what Nehemiah wants, Nehemiah first prays to the God of heaven before answering (2:4).",
        ["nehemiah-prays"]),
]

ENTITY_KEYS = {f"entity:{e['slug']}" for e in ENTITIES}

# ---------------------------------------------------------------------------
# claims (subject, predicate, object, evidence)
# ---------------------------------------------------------------------------


def claim(slug, subj, pred, obj, evidence, textual_basis, evidence_status="established"):
    return {
        "slug": slug,
        "subject": subj,
        "predicate": pred,
        "object": obj,
        "evidence": evidence,
        "textual_basis": textual_basis,
        "evidence_status": evidence_status,
    }


CLAIMS = [
    claim("nehemiah-cupbearer", ("entity", "nehemiah-governor"), "holds_role", ("entity", "cupbearer"),
          ["bsb:neh-1-11", "bibledata:nehemiah-1"], "explicit"),
    claim("nehemiah-serves-artaxerxes", ("entity", "nehemiah-governor"), "serves", ("entity", "artaxerxes-i"),
          ["bsb:neh-2-1", "bibledata:nehemiah-1"], "explicit"),
    claim("artaxerxes-reigns", ("entity", "artaxerxes-i"), "holds_role", ("entity", "king"),
          ["bsb:neh-2-1", "tipnr:artaxerxes"], "explicit"),
    claim("artaxerxes-rules-persia", ("entity", "artaxerxes-i"), "rules", ("entity", "persian-empire"),
          ["bsb:neh-2-1", "tipnr:artaxerxes"], "strongly_implied"),
    claim("queen-present", ("entity", "queen"), "present_at", ("scope", S_REQUEST),
          ["bsb:neh-2-6"], "explicit"),
    claim("jerusalem-in-judah", ("entity", "jerusalem"), "located_in", ("entity", "judah"),
          ["bsb:neh-2-5", "openbible:jerusalem"], "explicit"),
    claim("jerusalem-ancestral-city", ("entity", "jerusalem"), "ancestral_city_of", ("entity", "nehemiah-governor"),
          ["bsb:neh-2-3", "bsb:neh-2-5"], "explicit"),
    claim("beyond-river-part-of-persia", ("entity", "beyond-the-river"), "part_of", ("entity", "persian-empire"),
          ["bsb:neh-2-7", "openbible:beyond-the-river"], "strongly_implied"),
    claim("governors-govern-beyond-river", ("entity", "governors-beyond-the-river"), "governs", ("entity", "beyond-the-river"),
          ["bsb:neh-2-7", "bsb:neh-2-9"], "explicit"),
    claim("asaph-keeper-forest", ("entity", "asaph-royal-park"), "keeper_of", ("entity", "kings-forest"),
          ["bsb:neh-2-8", "tipnr:asaph"], "explicit", "probable"),
    claim("sanballat-opposes", ("entity", "sanballat-the-horonite"), "opposes", ("entity", "nehemiah-governor"),
          ["bsb:neh-2-10", "bsb:neh-2-19", "tipnr:sanballat"], "explicit"),
    claim("tobiah-opposes", ("entity", "tobiah-ammonite"), "opposes", ("entity", "nehemiah-governor"),
          ["bsb:neh-2-10", "bsb:neh-2-19", "tipnr:tobiah"], "explicit"),
    claim("geshem-opposes", ("entity", "geshem-arabian"), "opposes", ("entity", "nehemiah-governor"),
          ["bsb:neh-2-19", "tipnr:geshem"], "explicit"),
    claim("nehemiah-prays", ("scope", S_REQUEST), "prays_to", ("entity", "god-of-heaven"),
          ["bsb:neh-2-4", "bsb:neh-2-20"], "explicit"),
    claim("artaxerxes-grants-request", ("entity", "artaxerxes-i"), "grants",
          ("text", "Nehemiah's request for safe passage, letters and timber"),
          ["bsb:neh-2-6", "bsb:neh-2-8"], "explicit"),
    claim("royal-escort-provided", ("entity", "artaxerxes-i"), "provides", ("entity", "royal-escort"),
          ["bsb:neh-2-9"], "explicit"),
    claim("wall-broken-down", ("entity", "jerusalem-wall"), "broken_down",
          ("text", "the wall of Jerusalem"),
          ["bsb:neh-2-13", "bsb:neh-2-17"], "explicit"),
    claim("gates-destroyed-by-fire", ("entity", "jerusalem-gates"), "destroyed_by_fire",
          ("text", "the gates of Jerusalem"),
          ["bsb:neh-2-3", "bsb:neh-2-13", "bsb:neh-2-17"], "explicit"),
    claim("nehemiah-inspects-wall", ("scope", S_INSPECTION), "inspects", ("entity", "jerusalem-wall"),
          ["bsb:neh-2-13", "bsb:neh-2-15"], "explicit"),
    claim("people-agree-rebuild", ("entity", "judean-people"), "agrees_to_rebuild", ("entity", "jerusalem-wall"),
          ["bsb:neh-2-17", "bsb:neh-2-18"], "explicit"),
    claim("god-will-grant-success", ("entity", "god-of-heaven"), "will_grant_success", ("scope", S_ANSWER),
          ["bsb:neh-2-20"], "explicit"),
    claim("sanballat-no-claim", ("entity", "sanballat-the-horonite"), "has_no_claim_in", ("entity", "jerusalem"),
          ["bsb:neh-2-20"], "explicit", "probable"),
    claim("tobiah-no-claim", ("entity", "tobiah-ammonite"), "has_no_claim_in", ("entity", "jerusalem"),
          ["bsb:neh-2-20"], "explicit", "probable"),
    claim("geshem-no-claim", ("entity", "geshem-arabian"), "has_no_claim_in", ("entity", "jerusalem"),
          ["bsb:neh-2-20"], "explicit", "probable"),
    claim("nehemiah-governor-of-judah", ("entity", "nehemiah-governor"), "governs", ("entity", "judah"),
          ["bsb:neh-5-14"], "explicit", "probable"),
    claim("wall-completed-in-52-days", ("entity", "jerusalem-wall"), "completed_in",
          ("text", "52 days (Neh.6.15)"),
          ["bsb:neh-6-15"], "explicit", "probable"),
    claim("prior-stop-order", ("scope", S_REQUEST), "preceded_by",
          ("text", "an imperial order to stop the city's rebuilding, forcibly enforced"),
          ["bsb:ezra-4-21", "bsb:ezra-4-23"], "explicit", "probable"),
    claim("jerusalem-wall-part-of-jerusalem", ("entity", "jerusalem-wall"), "part_of", ("entity", "jerusalem"),
          ["bsb:neh-2-13", "bsb:neh-2-17"], "explicit"),
    claim("valley-gate-part-of-jerusalem", ("entity", "valley-gate"), "part_of", ("entity", "jerusalem"),
          ["bsb:neh-2-13"], "strongly_implied"),
    claim("dung-gate-part-of-jerusalem", ("entity", "dung-gate"), "part_of", ("entity", "jerusalem"),
          ["bsb:neh-2-13"], "strongly_implied"),
    claim("fountain-gate-part-of-jerusalem", ("entity", "fountain-gate"), "part_of", ("entity", "jerusalem"),
          ["bsb:neh-2-14"], "strongly_implied"),
    claim("kings-pool-part-of-jerusalem", ("entity", "kings-pool"), "part_of", ("entity", "jerusalem"),
          ["bsb:neh-2-14"], "strongly_implied"),
    claim("well-of-serpent-part-of-jerusalem", ("entity", "well-of-the-serpent"), "part_of", ("entity", "jerusalem"),
          ["bsb:neh-2-13"], "strongly_implied"),
]

CLAIM_SLUGS = {c["slug"] for c in CLAIMS}

# ---------------------------------------------------------------------------
# attestations: verse -> [(entity_slug, kind, identification_status, textual_basis)]
# ---------------------------------------------------------------------------

# Nehemiah is the first-person narrator of the chapter and is never named in it,
# so his attestations are strongly_implied rather than explicit.
ATTEST: dict[int, list[tuple[str, str, str, str]]] = {
    1: [("nehemiah-governor", "primary_subject", "established", "strongly_implied"),
        ("artaxerxes-i", "participant", "established", "explicit"),
        ("wine", "topic", "established", "explicit"),
        ("cupbearer", "implied_referent", "established", "inferred")],
    2: [("artaxerxes-i", "participant", "established", "explicit"),
        ("nehemiah-governor", "participant", "established", "strongly_implied")],
    3: [("nehemiah-governor", "participant", "established", "strongly_implied"),
        ("artaxerxes-i", "participant", "established", "explicit"),
        ("jerusalem", "location", "established", "strongly_implied"),
        ("jerusalem-gates", "topic", "established", "explicit")],
    4: [("artaxerxes-i", "participant", "established", "explicit"),
        ("nehemiah-governor", "participant", "established", "strongly_implied"),
        ("god-of-heaven", "topic", "established", "explicit"),
        ("prayer-to-god-of-heaven", "topic", "established", "explicit")],
    5: [("nehemiah-governor", "participant", "established", "strongly_implied"),
        ("artaxerxes-i", "participant", "established", "explicit"),
        ("judah", "location", "established", "explicit"),
        ("jerusalem", "location", "established", "strongly_implied")],
    6: [("artaxerxes-i", "participant", "established", "explicit"),
        ("queen", "participant", "established", "explicit"),
        ("nehemiah-governor", "participant", "established", "strongly_implied")],
    7: [("nehemiah-governor", "participant", "established", "strongly_implied"),
        ("artaxerxes-i", "participant", "established", "explicit"),
        ("royal-letters", "topic", "established", "explicit"),
        ("governors-beyond-the-river", "participant", "established", "explicit"),
        ("beyond-the-river", "location", "established", "explicit"),
        ("judah", "location", "established", "explicit")],
    8: [("nehemiah-governor", "participant", "established", "strongly_implied"),
        ("artaxerxes-i", "participant", "established", "explicit"),
        ("asaph-royal-park", "participant", "proposed", "explicit"),
        ("timber", "topic", "established", "explicit"),
        ("kings-forest", "location", "proposed", "strongly_implied"),
        ("jerusalem-wall", "topic", "established", "explicit"),
        ("jerusalem", "location", "established", "inferred")],
    9: [("nehemiah-governor", "participant", "established", "strongly_implied"),
        ("governors-beyond-the-river", "participant", "established", "explicit"),
        ("beyond-the-river", "location", "established", "explicit"),
        ("royal-letters", "topic", "established", "explicit"),
        ("royal-escort", "participant", "established", "explicit"),
        ("artaxerxes-i", "implied_referent", "established", "strongly_implied")],
    10: [("nehemiah-governor", "implied_referent", "established", "strongly_implied"),
         ("sanballat-the-horonite", "participant", "established", "explicit"),
         ("tobiah-ammonite", "participant", "established", "explicit"),
         ("israelites", "participant", "established", "explicit")],
    11: [("nehemiah-governor", "participant", "established", "strongly_implied"),
         ("jerusalem", "location", "established", "explicit")],
    12: [("nehemiah-governor", "participant", "established", "strongly_implied"),
         ("jerusalem", "location", "established", "explicit"),
         ("god-of-heaven", "topic", "established", "explicit")],
    13: [("nehemiah-governor", "participant", "established", "strongly_implied"),
         ("valley-gate", "location", "established", "explicit"),
         ("well-of-the-serpent", "location", "established", "explicit"),
         ("dung-gate", "location", "established", "explicit"),
         ("jerusalem-wall", "topic", "established", "explicit"),
         ("jerusalem-gates", "topic", "established", "explicit"),
         ("jerusalem", "location", "established", "explicit")],
    14: [("nehemiah-governor", "participant", "established", "strongly_implied"),
         ("fountain-gate", "location", "established", "explicit"),
         ("kings-pool", "location", "established", "explicit"),
         ("jerusalem-wall", "topic", "established", "strongly_implied")],
    15: [("nehemiah-governor", "participant", "established", "strongly_implied"),
         ("jerusalem-wall", "topic", "established", "explicit"),
         ("valley-gate", "location", "established", "explicit")],
    16: [("nehemiah-governor", "participant", "established", "strongly_implied"),
         ("judean-people", "participant", "established", "explicit")],
    17: [("nehemiah-governor", "participant", "established", "strongly_implied"),
         ("jerusalem-wall", "topic", "established", "explicit"),
         ("jerusalem-gates", "topic", "established", "explicit"),
         ("jerusalem", "location", "established", "explicit"),
         ("judean-people", "participant", "established", "inferred")],
    18: [("nehemiah-governor", "participant", "established", "strongly_implied"),
         ("judean-people", "participant", "established", "explicit"),
         ("artaxerxes-i", "implied_referent", "established", "strongly_implied")],
    19: [("sanballat-the-horonite", "participant", "established", "explicit"),
         ("tobiah-ammonite", "participant", "established", "explicit"),
         ("geshem-arabian", "participant", "established", "explicit"),
         ("nehemiah-governor", "participant", "established", "strongly_implied"),
         ("judean-people", "participant", "established", "strongly_implied"),
         ("artaxerxes-i", "implied_referent", "established", "strongly_implied")],
    20: [("nehemiah-governor", "participant", "established", "strongly_implied"),
         ("god-of-heaven", "topic", "established", "explicit"),
         ("judean-people", "participant", "established", "explicit"),
         ("jerusalem", "location", "established", "explicit"),
         ("sanballat-the-horonite", "implied_referent", "established", "strongly_implied"),
         ("tobiah-ammonite", "implied_referent", "established", "strongly_implied"),
         ("geshem-arabian", "implied_referent", "established", "strongly_implied")],
}

# ---------------------------------------------------------------------------
# relationships: (slug, subject, predicate, object, scopes, claims)
# ---------------------------------------------------------------------------

RELS = [
    ("nehemiah-holds-cupbearer", "nehemiah-governor", "holds_role", "cupbearer", [S_CHAPTER, S_REQUEST], ["nehemiah-cupbearer"]),
    ("nehemiah-serves-artaxerxes", "nehemiah-governor", "serves", "artaxerxes-i", [S_REQUEST], ["nehemiah-serves-artaxerxes"]),
    ("artaxerxes-rules-persia", "artaxerxes-i", "rules", "persian-empire", [S_CHAPTER], ["artaxerxes-rules-persia"]),
    ("artaxerxes-provides-escort", "artaxerxes-i", "provides", "royal-escort", [S_JOURNEY], ["royal-escort-provided"]),
    ("asaph-keeps-kings-forest", "asaph-royal-park", "keeper_of", "kings-forest", [S_REQUEST], ["asaph-keeper-forest"]),
    ("sanballat-opposes-nehemiah", "sanballat-the-horonite", "opposes", "nehemiah-governor", [S_JOURNEY, S_ANSWER], ["sanballat-opposes"]),
    ("tobiah-opposes-nehemiah", "tobiah-ammonite", "opposes", "nehemiah-governor", [S_JOURNEY, S_ANSWER], ["tobiah-opposes"]),
    ("geshem-opposes-nehemiah", "geshem-arabian", "opposes", "nehemiah-governor", [S_ANSWER], ["geshem-opposes"]),
    ("jerusalem-located-in-judah", "jerusalem", "located_in", "judah", [S_CHAPTER], ["jerusalem-in-judah"]),
    ("beyond-river-part-of-persia", "beyond-the-river", "part_of", "persian-empire", [S_JOURNEY], ["beyond-river-part-of-persia"]),
    ("governors-over-beyond-river", "governors-beyond-the-river", "governs", "beyond-the-river", [S_JOURNEY], ["governors-govern-beyond-river"]),
    ("jerusalem-wall-part-of-jerusalem", "jerusalem-wall", "part_of", "jerusalem", [S_INSPECTION], ["jerusalem-wall-part-of-jerusalem"]),
    ("valley-gate-part-of-jerusalem", "valley-gate", "part_of", "jerusalem", [S_INSPECTION], ["valley-gate-part-of-jerusalem"]),
    ("dung-gate-part-of-jerusalem", "dung-gate", "part_of", "jerusalem", [S_INSPECTION], ["dung-gate-part-of-jerusalem"]),
    ("fountain-gate-part-of-jerusalem", "fountain-gate", "part_of", "jerusalem", [S_INSPECTION], ["fountain-gate-part-of-jerusalem"]),
    ("kings-pool-part-of-jerusalem", "kings-pool", "part_of", "jerusalem", [S_INSPECTION], ["kings-pool-part-of-jerusalem"]),
    ("well-of-serpent-part-of-jerusalem", "well-of-the-serpent", "part_of", "jerusalem", [S_INSPECTION], ["well-of-serpent-part-of-jerusalem"]),
]

# ---------------------------------------------------------------------------
# events
# ---------------------------------------------------------------------------

EVENTS = [
    {
        "slug": "audience-with-artaxerxes",
        "type": "audience",
        "participants": ["nehemiah-governor", "artaxerxes-i", "queen"],
        "places": [],
        "accounts": [(S_REQUEST, "reports")],
        "claims": ["artaxerxes-grants-request", "queen-present", "nehemiah-prays"],
    },
    {
        "slug": "journey-to-jerusalem",
        "type": "journey",
        "participants": ["nehemiah-governor", "royal-escort", "governors-beyond-the-river"],
        "places": ["beyond-the-river", "judah", "jerusalem"],
        "accounts": [(S_JOURNEY, "reports")],
        "claims": ["royal-escort-provided", "governors-govern-beyond-river"],
    },
    {
        "slug": "opposition-at-arrival",
        "type": "opposition",
        "participants": ["sanballat-the-horonite", "tobiah-ammonite", "nehemiah-governor", "israelites"],
        "places": ["jerusalem"],
        "accounts": [(S_JOURNEY, "reports")],
        "claims": ["sanballat-opposes", "tobiah-opposes"],
    },
    {
        "slug": "night-inspection",
        "type": "inspection",
        "participants": ["nehemiah-governor"],
        "places": ["jerusalem", "valley-gate", "well-of-the-serpent", "dung-gate", "fountain-gate", "kings-pool"],
        "accounts": [(S_INSPECTION, "reports")],
        "claims": ["nehemiah-inspects-wall"],
    },
    {
        "slug": "community-commitment",
        "type": "assembly",
        "participants": ["nehemiah-governor", "judean-people"],
        "places": ["jerusalem"],
        "accounts": [(S_RALLY, "reports")],
        "claims": ["people-agree-rebuild"],
    },
    {
        "slug": "opponents-mock-rebuilding",
        "type": "opposition",
        "participants": ["sanballat-the-horonite", "tobiah-ammonite", "geshem-arabian", "nehemiah-governor"],
        "places": ["jerusalem"],
        "accounts": [(S_ANSWER, "reports")],
        "claims": ["sanballat-no-claim", "tobiah-no-claim", "geshem-no-claim", "god-will-grant-success"],
    },
]

# ---------------------------------------------------------------------------
# place positions: (entity_slug, evidence_key, precision, [claims])
# ---------------------------------------------------------------------------

PLACES = [
    ("susa", "openbible:susa", "approximate", []),
    ("jerusalem", "openbible:jerusalem", "approximate", ["jerusalem-in-judah"]),
    ("judah", "bsb:neh-2-5", "area", ["jerusalem-in-judah"]),
    ("beyond-the-river", "openbible:beyond-the-river", "area", ["beyond-river-part-of-persia"]),
    ("kings-pool", "bsb:neh-2-14", "unknown", []),
    ("kings-forest", "bsb:neh-2-8", "unknown", []),
    ("well-of-the-serpent", "bsb:neh-2-13", "unknown", []),
    ("jerusalem-wall", "bsb:neh-2-13", "unknown", ["jerusalem-wall-part-of-jerusalem"]),
    ("valley-gate", "openbible:valley-gate", "candidates", ["valley-gate-part-of-jerusalem"]),
    ("dung-gate", "openbible:dung-gate", "candidates", ["dung-gate-part-of-jerusalem"]),
    ("fountain-gate", "openbible:fountain-gate", "candidates", ["fountain-gate-part-of-jerusalem"]),
]

# ---------------------------------------------------------------------------
# relevance + "in this passage" role text
# ---------------------------------------------------------------------------

RELEVANCE = [
    # request 2.1-8
    (S_REQUEST, "nehemiah-governor", "central", True, ["nehemiah-cupbearer", "artaxerxes-grants-request"]),
    (S_REQUEST, "artaxerxes-i", "central", True, ["artaxerxes-grants-request"]),
    (S_REQUEST, "cupbearer", "supporting", True, ["nehemiah-cupbearer"]),
    (S_REQUEST, "queen", "background", True, ["queen-present"]),
    (S_REQUEST, "jerusalem", "central", True, ["jerusalem-ancestral-city"]),
    (S_REQUEST, "jerusalem-gates", "supporting", True, ["gates-destroyed-by-fire"]),
    (S_REQUEST, "judah", "supporting", True, ["jerusalem-in-judah"]),
    (S_REQUEST, "royal-letters", "supporting", True, []),
    (S_REQUEST, "governors-beyond-the-river", "supporting", True, ["governors-govern-beyond-river"]),
    (S_REQUEST, "beyond-the-river", "background", True, ["beyond-river-part-of-persia"]),
    (S_REQUEST, "asaph-royal-park", "supporting", True, ["asaph-keeper-forest"]),
    (S_REQUEST, "kings-forest", "background", True, ["asaph-keeper-forest"]),
    (S_REQUEST, "timber", "background", True, ["asaph-keeper-forest"]),
    (S_REQUEST, "susa", "background", False, ["artaxerxes-rules-persia"]),
    (S_REQUEST, "prayer-to-god-of-heaven", "supporting", True, ["nehemiah-prays"]),
    (S_REQUEST, "god-of-heaven", "supporting", True, ["nehemiah-prays"]),
    (S_REQUEST, "wine", "background", True, []),
    # journey 2.9-10
    (S_JOURNEY, "nehemiah-governor", "central", True, []),
    (S_JOURNEY, "royal-letters", "supporting", True, []),
    (S_JOURNEY, "governors-beyond-the-river", "supporting", True, ["governors-govern-beyond-river"]),
    (S_JOURNEY, "beyond-the-river", "supporting", True, ["beyond-river-part-of-persia"]),
    (S_JOURNEY, "royal-escort", "supporting", True, ["royal-escort-provided"]),
    (S_JOURNEY, "sanballat-the-horonite", "central", True, ["sanballat-opposes"]),
    (S_JOURNEY, "tobiah-ammonite", "central", True, ["tobiah-opposes"]),
    (S_JOURNEY, "israelites", "supporting", True, []),
    # inspection 2.11-16
    (S_INSPECTION, "nehemiah-governor", "central", True, ["nehemiah-inspects-wall"]),
    (S_INSPECTION, "jerusalem", "central", True, []),
    (S_INSPECTION, "jerusalem-wall", "central", True, ["nehemiah-inspects-wall", "wall-broken-down"]),
    (S_INSPECTION, "jerusalem-gates", "supporting", True, ["gates-destroyed-by-fire"]),
    (S_INSPECTION, "valley-gate", "supporting", True, ["valley-gate-part-of-jerusalem"]),
    (S_INSPECTION, "well-of-the-serpent", "background", True, []),
    (S_INSPECTION, "dung-gate", "supporting", True, ["dung-gate-part-of-jerusalem"]),
    (S_INSPECTION, "fountain-gate", "supporting", True, ["fountain-gate-part-of-jerusalem"]),
    (S_INSPECTION, "kings-pool", "supporting", True, ["kings-pool-part-of-jerusalem"]),
    (S_INSPECTION, "judean-people", "background", True, []),
    # rally 2.17-18
    (S_RALLY, "nehemiah-governor", "central", True, []),
    (S_RALLY, "judean-people", "central", True, ["people-agree-rebuild"]),
    (S_RALLY, "jerusalem-wall", "central", True, ["people-agree-rebuild"]),
    (S_RALLY, "jerusalem-gates", "supporting", True, ["gates-destroyed-by-fire"]),
    (S_RALLY, "jerusalem", "supporting", True, []),
    (S_RALLY, "god-of-heaven", "supporting", True, []),
    (S_RALLY, "artaxerxes-i", "background", True, ["artaxerxes-grants-request"]),
    # answer 2.19-20
    (S_ANSWER, "nehemiah-governor", "central", True, ["god-will-grant-success"]),
    (S_ANSWER, "sanballat-the-horonite", "supporting", True, ["sanballat-no-claim"]),
    (S_ANSWER, "tobiah-ammonite", "supporting", True, ["tobiah-opposes"]),
    (S_ANSWER, "geshem-arabian", "supporting", True, ["geshem-opposes"]),
    (S_ANSWER, "artaxerxes-i", "background", True, []),
    (S_ANSWER, "god-of-heaven", "central", True, ["god-will-grant-success"]),
    (S_ANSWER, "jerusalem", "supporting", True, ["sanballat-no-claim", "tobiah-no-claim", "geshem-no-claim"]),
    (S_ANSWER, "judean-people", "supporting", True, []),
]

ROLE_TEXT = {
    (S_REQUEST, "nehemiah-governor"): "Nehemiah is the cupbearer whose visible sadness prompts the king's question; he prays, then asks for permission, letters, timber and an escort to rebuild Jerusalem.",
    (S_REQUEST, "artaxerxes-i"): "Artaxerxes holds sole authority to grant the journey, safe passage and materials, and he grants Nehemiah's requests.",
    (S_REQUEST, "cupbearer"): "The cupbearer's trusted access to the king explains both Nehemiah's opportunity to speak and the danger of appearing sad before him.",
    (S_REQUEST, "queen"): "The queen is seated beside the king when he questions Nehemiah; she is named only by her office.",
    (S_REQUEST, "jerusalem"): "Jerusalem is the ruined ancestral city Nehemiah seeks to restore; the chapter does not name it directly but calls it the city where his fathers are buried.",
    (S_REQUEST, "jerusalem-gates"): "Jerusalem's gates had been destroyed by fire; rebuilding them is part of what Nehemiah asks to restore.",
    (S_REQUEST, "judah"): "Judah is the province Nehemiah asks to be sent to, the destination of his mission.",
    (S_REQUEST, "royal-letters"): "The letters are the written authorisation Nehemiah requests for safe passage and for timber.",
    (S_REQUEST, "governors-beyond-the-river"): "These provincial governors control the route and are ordered by the king's letters to grant Nehemiah safe passage.",
    (S_REQUEST, "beyond-the-river"): "The province west of the Euphrates lies on Nehemiah's route to Judah.",
    (S_REQUEST, "asaph-royal-park"): "Asaph, keeper of the king's forest, is asked to supply timber for the gates, wall and Nehemiah's house.",
    (S_REQUEST, "kings-forest"): "The royal forest is the source of the timber Nehemiah requests.",
    (S_REQUEST, "timber"): "Timber is requested for the citadel gates, the city wall and Nehemiah's house.",
    (S_REQUEST, "susa"): "Susa is traditionally the setting of the Persian court, though chapter 2 names no city.",
    (S_REQUEST, "prayer-to-god-of-heaven"): "Nehemiah prays to the God of heaven between the king's question and his answer.",
    (S_REQUEST, "god-of-heaven"): "The God of heaven is the one Nehemiah petitions before answering the king.",
    (S_REQUEST, "wine"): "The wine Nehemiah serves identifies his court service and the moment the king notices his sadness.",
    (S_JOURNEY, "nehemiah-governor"): "Nehemiah travels to the province, delivers the king's letters and arrives in Jerusalem.",
    (S_JOURNEY, "royal-letters"): "The king's letters are delivered to the governors as Nehemiah travels.",
    (S_JOURNEY, "governors-beyond-the-river"): "The governors receive the king's letters for Nehemiah's safe passage.",
    (S_JOURNEY, "beyond-the-river"): "The province is crossed on the way to Judah.",
    (S_JOURNEY, "royal-escort"): "The army officers and cavalry show that the king has authorised and protected the mission.",
    (S_JOURNEY, "sanballat-the-horonite"): "Sanballat is deeply disturbed that someone has come to seek Israel's well-being; opposition begins at once.",
    (S_JOURNEY, "tobiah-ammonite"): "Tobiah is named with Sanballat as an opponent when Nehemiah arrives.",
    (S_JOURNEY, "israelites"): "The Israelites are the people whose well-being Nehemiah came to seek.",
    (S_INSPECTION, "nehemiah-governor"): "Nehemiah inspects the damage secretly by night before disclosing his plan.",
    (S_INSPECTION, "jerusalem"): "Jerusalem is the ruined city Nehemiah surveys.",
    (S_INSPECTION, "jerusalem-wall"): "The broken wall is the object of Nehemiah's inspection.",
    (S_INSPECTION, "jerusalem-gates"): "The gates that had been destroyed by fire are part of the damage Nehemiah inspects.",
    (S_INSPECTION, "valley-gate"): "The Valley Gate is the start and end point of the night circuit.",
    (S_INSPECTION, "well-of-the-serpent"): "The Well of the Serpent is a landmark on the route whose location is uncertain.",
    (S_INSPECTION, "dung-gate"): "The Dung Gate is named as Nehemiah inspects the burned gates.",
    (S_INSPECTION, "fountain-gate"): "The Fountain Gate lies near the King's Pool on the route.",
    (S_INSPECTION, "kings-pool"): "At the King's Pool the way narrows so that Nehemiah's mount cannot pass.",
    (S_INSPECTION, "judean-people"): "The officials of Jerusalem did not yet know where Nehemiah had gone or what he was doing.",
    (S_RALLY, "nehemiah-governor"): "Nehemiah tells the people of the ruin, of God's hand and of the king's words, and calls them to rebuild.",
    (S_RALLY, "judean-people"): "The community agrees to rebuild and sets its hands to the work.",
    (S_RALLY, "jerusalem-wall"): "The wall of Jerusalem is the work the people commit to rebuild.",
    (S_RALLY, "jerusalem-gates"): "The gates that had been burned down are named among the ruins the people commit to rebuild.",
    (S_RALLY, "jerusalem"): "Jerusalem's ruin and disgrace are the reason for the rebuilding.",
    (S_RALLY, "god-of-heaven"): "Nehemiah points to the gracious hand of God as the reason for hope.",
    (S_RALLY, "artaxerxes-i"): "The king's words are evidence Nehemiah reports to the people.",
    (S_ANSWER, "nehemiah-governor"): "Nehemiah answers mockery by trusting God for success and denying the opponents any claim in Jerusalem.",
    (S_ANSWER, "sanballat-the-horonite"): "Sanballat joins the mockery and the accusation of rebellion.",
    (S_ANSWER, "tobiah-ammonite"): "Tobiah joins the mockery of the rebuilding.",
    (S_ANSWER, "geshem-arabian"): "Geshem the Arab joins the mockery of the rebuilding.",
    (S_ANSWER, "artaxerxes-i"): "The opponents appeal to the king's authority by accusing the builders of rebellion.",
    (S_ANSWER, "god-of-heaven"): "Nehemiah declares that the God of heaven will grant success.",
    (S_ANSWER, "jerusalem"): "Nehemiah denies the opponents any portion, right or claim in Jerusalem.",
    (S_ANSWER, "judean-people"): "The builders are named as God's servants who will start rebuilding.",
}

# ---------------------------------------------------------------------------
# locale passage contexts
# ---------------------------------------------------------------------------

CONTEXTS = {
    S_CHAPTER: {
        "who": ("Nehemiah, a Jewish cupbearer to King Artaxerxes I; the king; the queen; Asaph keeper of the king's forest; the governors west of the Euphrates; and the opponents Sanballat, Tobiah and Geshem.", ["nehemiah-cupbearer", "sanballat-opposes", "tobiah-opposes", "geshem-opposes"], None),
        "where": ("The Persian royal court (chapter 2 names no city; it is traditionally associated with Susa), the province Beyond the River, and Jerusalem.", ["beyond-river-part-of-persia"], None),
        "when": ("Nisan in the twentieth year of King Artaxerxes, commonly rendered about 445 BC; the date is approximate.", ["artaxerxes-reigns"], None),
        "what": ("Nehemiah, sad over Jerusalem's ruined walls, prays and asks the king to send him to Judah. He receives letters, timber and an escort, travels to Jerusalem, inspects the walls by night, rallies the people to rebuild, and answers the mockery of Sanballat, Tobiah and Geshem.", ["artaxerxes-grants-request", "nehemiah-inspects-wall", "people-agree-rebuild", "sanballat-no-claim"], None),
        "before": ("A report of Jerusalem's ruin had reached Nehemiah, who mourned, fasted and prayed (Neh.1). An earlier imperial order had stopped work on the city by force (Ezra 4:17-23).", ["prior-stop-order"], None),
        "stakes": ("Nehemiah risks the king's displeasure by appearing sad and by seeking to reverse earlier opposition to the city; royal permission, letters and timber are what make the mission possible.", ["artaxerxes-grants-request"], None),
        "immediate_summary": ("Nehemiah receives permission, letters, timber and an escort to rebuild Jerusalem, inspects the walls and leads the people to begin.", ["artaxerxes-grants-request"], None),
    },
    S_REQUEST: {
        "who": ("Nehemiah, King Artaxerxes, the queen seated beside him, and Asaph keeper of the king's forest.", ["nehemiah-cupbearer", "queen-present", "asaph-keeper-forest"], None),
        "where": ("The Persian royal court. Chapter 2 does not name the city, so the traditional association with Susa is labelled rather than asserted.", ["artaxerxes-rules-persia"], "question:neh-2-court-city"),
        "when": ("Nisan in the twentieth year of Artaxerxes. Ancient regnal-year reckoning varies, so about 445 BC is an approximation.", ["artaxerxes-reigns"], "question:neh-2-year-reckoning"),
        "what": ("Nehemiah, sad over Jerusalem's ruins, prays to the God of heaven and asks to be sent to Judah, requesting letters for safe passage and timber for the gates, wall and his house; the king grants the requests.", ["nehemiah-prays", "artaxerxes-grants-request"], None),
        "before": ("Nehemiah had mourned, fasted and prayed over the report of Jerusalem's ruin (Neh.1), and an earlier imperial order had stopped the city's rebuilding by force (Ezra 4:17-23).", ["prior-stop-order"], None),
        "stakes": ("Appearing sad before the king is dangerous, and requesting the rebuilding reverses an earlier imperial stop order; the king's permission, letters and timber are the difference between a plan and a journey.", ["artaxerxes-grants-request"], None),
        "immediate_summary": ("Nehemiah prays and asks the king to send him to rebuild Jerusalem; the king grants letters, timber and an escort.", ["artaxerxes-grants-request"], None),
    },
    S_JOURNEY: {
        "who": ("Nehemiah, the governors west of the Euphrates who receive the king's letters, the army officers and cavalry escorting him, and the opponents Sanballat and Tobiah.", ["governors-govern-beyond-river", "royal-escort-provided", "sanballat-opposes", "tobiah-opposes"], None),
        "where": ("The route through the province Beyond the River to Judah and on to Jerusalem.", ["beyond-river-part-of-persia"], None),
        "when": ("Following the audience in Nisan of Artaxerxes' twentieth year; the date is approximate.", ["artaxerxes-reigns"], None),
        "what": ("Nehemiah delivers the king's letters to the governors and travels with a royal escort. Sanballat and Tobiah are deeply disturbed that someone has come to seek the well-being of the Israelites.", ["governors-govern-beyond-river", "sanballat-opposes", "tobiah-opposes"], None),
        "before": ("The king's grant of letters, timber and an escort in verses 1-8.", ["artaxerxes-grants-request"], None),
        "stakes": ("Opposition begins as soon as the mission becomes known, setting up the conflict that continues through the book.", ["sanballat-opposes", "tobiah-opposes"], None),
        "immediate_summary": ("Nehemiah reaches the province with the king's letters and an escort, and meets immediate opposition.", ["royal-escort-provided"], None),
    },
    S_INSPECTION: {
        "who": ("Nehemiah and a few men; the officials of Jerusalem did not yet know his purpose.", ["nehemiah-inspects-wall"], None),
        "where": ("Jerusalem by night: the Valley Gate, the Well of the Serpent, the Dung Gate, the Fountain Gate, the King's Pool and the wall.", ["nehemiah-inspects-wall"], "question:neh-2-route-locations"),
        "when": ("After three days in Jerusalem, at night.", ["nehemiah-inspects-wall"], None),
        "what": ("Nehemiah secretly inspects the broken walls and burned gates, finding the damage so extensive that at the King's Pool his mount cannot pass through.", ["nehemiah-inspects-wall", "wall-broken-down", "gates-destroyed-by-fire"], None),
        "before": ("His arrival in Jerusalem and three days there (verse 11).", [], None),
        "stakes": ("He assesses the work first-hand before disclosing it, so the rebuilding plan rests on direct knowledge of the ruins.", ["nehemiah-inspects-wall"], None),
        "immediate_summary": ("Nehemiah makes a night circuit of Jerusalem's ruined walls and gates.", ["nehemiah-inspects-wall"], None),
    },
    S_RALLY: {
        "who": ("Nehemiah and the Jews, priests, nobles, officials and other workers of Jerusalem.", ["people-agree-rebuild"], None),
        "where": ("Jerusalem.", [], None),
        "when": ("After the night inspection, before the wall is rebuilt.", [], None),
        "what": ("Nehemiah tells the people of the city's ruin and disgrace, of the gracious hand of God and of the king's words, and they agree to start rebuilding.", ["people-agree-rebuild", "wall-broken-down", "gates-destroyed-by-fire"], None),
        "before": ("The night inspection of verses 11-16.", ["nehemiah-inspects-wall"], None),
        "stakes": ("The community's shared labour and morale depend on Nehemiah's testimony of God's favour and the king's support.", ["people-agree-rebuild"], None),
        "immediate_summary": ("The people commit to rebuilding the wall of Jerusalem.", ["people-agree-rebuild"], None),
    },
    S_ANSWER: {
        "who": ("Nehemiah, and the opponents Sanballat the Horonite, Tobiah the Ammonite official and Geshem the Arab.", ["sanballat-opposes", "tobiah-opposes", "geshem-opposes"], None),
        "where": ("Jerusalem.", ["sanballat-no-claim"], None),
        "when": ("After the people commit to rebuild.", [], None),
        "what": ("The opponents mock the builders and accuse them of rebelling against the king. Nehemiah answers that the God of heaven will grant success, and that they have no portion, right or claim in Jerusalem.", ["sanballat-no-claim", "tobiah-no-claim", "geshem-no-claim", "god-will-grant-success"], None),
        "before": ("The people's commitment to rebuild in verses 17-18.", [], None),
        "stakes": ("The work faces political and religious opposition that continues in later chapters.", ["sanballat-opposes", "tobiah-opposes", "geshem-opposes"], None),
        "immediate_summary": ("Nehemiah answers the opponents' mockery with confidence in God.", ["god-will-grant-success"], None),
    },
}

# ---------------------------------------------------------------------------
# edition mentions: verse -> [(entity_slug, exact_quote, mention_form, ordinal)]
# ---------------------------------------------------------------------------

# Nehemiah is the chapter's first-person narrator and is never named in it, so
# his edition mentions are pronoun/indirect references ("I", "me", "us",
# "someone"). Occurrence ordinals are the first occurrence in each verse.
MENTIONS: dict[int, list[tuple[str, str, str, int]]] = {
    1: [("nehemiah-governor", "I", "pronoun", 1),
        ("artaxerxes-i", "King Artaxerxes", "explicit_name", 1),
        ("wine", "wine", "explicit_name", 1)],
    2: [("nehemiah-governor", "me", "pronoun", 1),
        ("artaxerxes-i", "the king", "title", 1)],
    3: [("nehemiah-governor", "I", "pronoun", 1),
        ("artaxerxes-i", "the king", "title", 1),
        ("jerusalem", "the city where my fathers are buried", "indirect", 1),
        ("jerusalem-gates", "its gates", "indirect", 1)],
    4: [("nehemiah-governor", "I", "pronoun", 1),
        ("artaxerxes-i", "the king", "title", 1),
        ("god-of-heaven", "the God of heaven", "explicit_name", 1),
        ("prayer-to-god-of-heaven", "prayed", "indirect", 1)],
    5: [("nehemiah-governor", "I", "pronoun", 1),
        ("artaxerxes-i", "the king", "title", 1),
        ("judah", "Judah", "explicit_name", 1),
        ("jerusalem", "the city where my fathers are buried", "indirect", 1)],
    6: [("nehemiah-governor", "me", "pronoun", 1),
        ("artaxerxes-i", "the king", "title", 1),
        ("queen", "the queen", "title", 1)],
    7: [("nehemiah-governor", "I", "pronoun", 1),
        ("artaxerxes-i", "the king", "title", 1),
        ("royal-letters", "letters", "indirect", 1),
        ("governors-beyond-the-river", "the governors west of the Euphrates", "collective", 1),
        ("beyond-the-river", "west of the Euphrates", "explicit_name", 1),
        ("judah", "Judah", "explicit_name", 1)],
    8: [("nehemiah-governor", "I", "pronoun", 1),
        ("asaph-royal-park", "Asaph", "explicit_name", 1),
        ("kings-forest", "the king\u2019s forest", "indirect", 1),
        ("timber", "timber", "explicit_name", 1),
        ("jerusalem-wall", "the city wall", "indirect", 1),
        ("artaxerxes-i", "the king", "title", 2)],
    9: [("nehemiah-governor", "I", "pronoun", 1),
        ("governors-beyond-the-river", "the governors west of the Euphrates", "collective", 1),
        ("royal-letters", "the king\u2019s letters", "indirect", 1),
        ("royal-escort", "army officers and cavalry", "collective", 1)],
    10: [("nehemiah-governor", "someone", "indirect", 1),
         ("sanballat-the-horonite", "Sanballat the Horonite", "explicit_name", 1),
         ("tobiah-ammonite", "Tobiah the Ammonite official", "explicit_name", 1),
         ("israelites", "the Israelites", "collective", 1)],
    11: [("nehemiah-governor", "I", "pronoun", 1),
         ("jerusalem", "Jerusalem", "explicit_name", 1)],
    12: [("nehemiah-governor", "I", "pronoun", 1),
         ("jerusalem", "Jerusalem", "explicit_name", 1),
         ("god-of-heaven", "my God", "indirect", 1)],
    13: [("nehemiah-governor", "I", "pronoun", 1),
         ("valley-gate", "the Valley Gate", "explicit_name", 1),
         ("well-of-the-serpent", "the Well of the Serpent", "explicit_name", 1),
         ("dung-gate", "the Dung Gate", "explicit_name", 1),
         ("jerusalem-wall", "the walls of Jerusalem", "indirect", 1),
         ("jerusalem-gates", "the gates", "indirect", 1),
         ("jerusalem", "Jerusalem", "explicit_name", 1)],
    14: [("nehemiah-governor", "I", "pronoun", 1),
         ("fountain-gate", "the Fountain Gate", "explicit_name", 1),
         ("kings-pool", "the King\u2019s Pool", "explicit_name", 1)],
    15: [("nehemiah-governor", "I", "pronoun", 1),
         ("jerusalem-wall", "the wall", "indirect", 1),
         ("valley-gate", "the Valley Gate", "explicit_name", 1)],
    16: [("nehemiah-governor", "I", "pronoun", 1),
         ("judean-people", "the Jews", "collective", 1)],
    17: [("nehemiah-governor", "I", "pronoun", 1),
         ("jerusalem-wall", "the wall of Jerusalem", "indirect", 1),
         ("jerusalem-gates", "its gates", "indirect", 1),
         ("jerusalem", "Jerusalem", "explicit_name", 2),
         ("judean-people", "us", "pronoun", 1)],
    18: [("nehemiah-governor", "I", "pronoun", 1),
         ("judean-people", "they", "pronoun", 1)],
    19: [("judean-people", "us", "pronoun", 1),
         ("sanballat-the-horonite", "Sanballat the Horonite", "explicit_name", 1),
         ("tobiah-ammonite", "Tobiah the Ammonite official", "explicit_name", 1),
         ("geshem-arabian", "Geshem the Arab", "explicit_name", 1),
         ("artaxerxes-i", "the king", "title", 1)],
    20: [("nehemiah-governor", "I", "pronoun", 1),
         ("god-of-heaven", "The God of heaven", "explicit_name", 1),
         ("judean-people", "His servants", "collective", 1),
         ("jerusalem", "Jerusalem", "explicit_name", 1)],
}

# ---------------------------------------------------------------------------
# builders
# ---------------------------------------------------------------------------

def jcs(obj) -> str:
    """Deterministic RFC-8785-style canonical JSON (sorted keys, compact)."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_text(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def bsb_verse_texts() -> dict[int, str]:
    data = json.loads(BSB_NEH.read_text(encoding="utf-8"))
    chapter = next(c for c in data["chapters"] if c["n"] == 2)
    return {b["n"]: b["text"] for b in chapter["blocks"] if b.get("t") == "v"}


def find_selector(text: str, quote: str, ordinal: int) -> tuple[str, str]:
    pattern = re.compile(re.escape(quote))
    matches = [m for m in pattern.finditer(text)]
    if len(matches) < ordinal:
        raise ValueError(f"quote {quote!r} ordinal {ordinal} not found in {text!r}")
    m = matches[ordinal - 1]
    prefix = text[max(0, m.start() - 20) : m.start()]
    suffix = text[m.end() : m.end() + 20]
    return prefix, suffix


def attestation_key(vs: int, slug: str, kind: str) -> str:
    safe_kind = kind.replace("_", "-")
    return f"attestation:eng-v22-neh-2-{vs}-{slug}-{safe_kind}"


EDITION_SLUG = "bsb-20260912-sha-b2898c49"


def mention_key(vs: int, slug: str) -> str:
    # Edition revision/digest is part of the key so a corrected BSB edition
    # cannot collide with this one.
    return f"mention:{EDITION_SLUG}-neh-2-{vs}:{slug}"


def relevance_key(scope: str, slug: str) -> str:
    scope_slug = scope.split(":")[1]
    return f"relevance:{scope_slug}-{slug}"


def build_canonical() -> dict:
    # candidates + reconciliation
    candidates, reconciliations = [], []
    for e in ENTITIES:
        candidates.append({
            "candidate_key": f"candidate:neh2:{e['slug']}",
            "entity_type": e["type"],
            "proposed_label": e["label"],
            "possible_existing_entity_keys": [],
            "identifying_claim_keys": [],
            "resolution_status": "unresolved",
            "review_status": "draft",
        })
        reconciliations.append({
            "candidate_key": f"candidate:neh2:{e['slug']}",
            "canonical_entity_key": f"entity:{e['slug']}",
            "resolution_status": "created_new_canonical",
            "review_status": "draft",
        })

    # claims + citations
    claims, citations = [], []
    for c in CLAIMS:
        ckey = f"claim:{c['slug']}"
        citation_keys = []
        for i, ev in enumerate(c["evidence"], start=1):
            evidence_key = f"evidence:{ev}"
            if evidence_key not in EVIDENCE_KEYS:
                raise ValueError(f"claim {c['slug']} cites unknown evidence {evidence_key}")
            cit = f"citation:{c['slug']}" + ("" if len(c["evidence"]) == 1 else f"-{i}")
            citation_keys.append(cit)
            citations.append({
                "citation_key": cit,
                "claim_keys": [ckey],
                "evidence_item_key": evidence_key,
                "stance": "supports",
                "evidence_form": "direct" if c["textual_basis"] == "explicit" else "inferential",
                "review_status": "draft",
            })
        claims.append({
            "claim_key": ckey,
            "subject": typed(c["subject"]),
            "predicate": c["predicate"],
            "object": typed(c["object"]),
            "evidence_status": c["evidence_status"],
            "textual_basis": c["textual_basis"],
            "citation_keys": citation_keys,
            "review_status": "draft",
        })

    # attestations
    attestations = []
    for vs, rows in sorted(ATTEST.items()):
        for slug, kind, ident, basis in rows:
            attestations.append({
                "attestation_key": attestation_key(vs, slug, kind),
                "reference_key": f"verse:Neh.2.{vs}",
                "entity_key": f"entity:{slug}",
                "kind": kind,
                "textual_basis": basis,
                "identification_status": ident,
                "claim_keys": claims_for_entity(slug),
                "review_status": "draft",
            })

    relationships = [{
        "relationship_key": f"relationship:{slug}",
        "subject_entity_key": f"entity:{subj}",
        "predicate_key": f"relationship:{pred}",
        "object_entity_key": f"entity:{obj}",
        "applicable_scope_keys": scopes,
        "claim_keys": [f"claim:{c}" for c in cs],
        "review_status": "draft",
    } for slug, subj, pred, obj, scopes, cs in RELS]

    events = [{
        "event_key": f"event:{ev['slug']}",
        "event_type": ev["type"],
        "participant_entity_keys": [f"entity:{s}" for s in ev["participants"]],
        "place_entity_keys": [f"entity:{s}" for s in ev["places"]],
        "scripture_accounts": [{"scope_key": s, "relation": r} for s, r in ev["accounts"]],
        "claim_keys": [f"claim:{c}" for c in ev["claims"]],
        "review_status": "draft",
    } for ev in EVENTS]

    places = [{
        "entity_key": f"entity:{slug}",
        "geographic_positions": [{
            "evidence_item_key": f"evidence:{ev}",
            "precision": precision,
            "claim_keys": [f"claim:{c}" for c in claims_],
        }],
        "review_status": "draft",
    } for slug, ev, precision, claims_ in PLACES]

    relevance = [{
        "relevance_key": relevance_key(scope, slug),
        "scope_key": scope,
        "entity_key": f"entity:{slug}",
        "importance": importance,
        "is_attested": attested,
        "claim_keys": [f"claim:{c}" for c in claims_],
        "review_status": "draft",
    } for scope, slug, importance, attested, claims_ in RELEVANCE]

    skeleton_digest = sha256_text(jcs({
        "reference_system_key": REFSYS,
        "scope_keys": SCOPES,
        "reference_keys": VERSES,
    }))

    pkg = {
        "contract_version": CONTRACT,
        "schema_version": CONTRACT,
        "vocabulary_version": VOCAB,
        "coverage_policy_version": COVERAGE_POLICY,
        "data_classification": DATA_CLASSIFICATION,
        "package_key": CANON_PKG,
        "package_revision": 1,
        "submission_id": "submission:neh2:canonical:attempt-1",
        "attempt": 1,
        "produced_for_job_id": "job:neh2:canonical",
        "package_layer": "canonical",
        "package_family": "canonical-context-draft",
        "scope": {
            "canon_key": CANON,
            "reference_system_key": REFSYS,
            "scope_keys": SCOPES,
            "reference_keys": VERSES,
            "language_tag": None,
            "translation_edition_key": None,
        },
        "review_status": "draft",
        "dependencies": [{
            "package_key": REGISTRY_PKG,
            "revision": 1,
            "digest": skeleton_digest,
        }],
        "records": {
            "entity_candidates": candidates,
            "claims": claims,
            "citations": citations,
            "attestations": attestations,
            "relationships": relationships,
            "events": events,
            "places": places,
            "relevance": relevance,
            "reconciliation_records": reconciliations,
        },
        "coverage": [{
            "annotation_class": "canonical_entity_attestation",
            "groups": [{
                "result": "incomplete",
                "reference_keys": VERSES,
                "record_keys": [a["attestation_key"] for a in attestations],
                "blocker_question_keys": [],
            }],
        }],
        "open_questions": [{
            "question_key": "question:neh-2-artaxerxes-identity",
            "question_type": "ambiguous_identity",
            "record_key": "claim:artaxerxes-reigns",
            "field_path": "/records/claims",
            "question": "Some sources see a different Artaxerxes behind the opposition in Ezra 4; should this identification be shown as disputed?",
            "blocks_publication": False,
        }],
        "editorial_observations": [
            {"code": "source-attribution", "note": PROVENANCE},
            {"code": "bounded-entity-catalog", "note": "Entity identification covers the curated Nehemiah 2 catalog; pronouns and indirect referents are not exhaustively resolved, so coverage is reported incomplete."},
            {"code": "deity-entity-type", "note": "Divine beings use the canonical 'deity' entity type; the God of heaven is typed 'deity', not 'person'."},
        ],
    }
    return pkg


def typed(ref: tuple[str, str]) -> dict:
    kind, value = ref
    if kind == "entity":
        return {"type": "entity", "key": f"entity:{value}"}
    if kind == "scope":
        return {"type": "scope", "key": value}
    if kind == "text":
        return {"type": "text", "value": value}
    raise ValueError(f"unsupported typed ref {ref}")


def claims_for_entity(slug: str) -> list[str]:
    return [f"claim:{c}" for c in ENTITY_CLAIMS.get(slug, [])]


ENTITY_CLAIMS = {e["slug"]: e["claims"] for e in ENTITIES}


def build_edition(canonical_digest: str) -> dict:
    texts = bsb_verse_texts()
    mentions = []
    for vs, rows in sorted(MENTIONS.items()):
        text = texts[vs]
        for slug, quote, form, ordinal in rows:
            prefix, suffix = find_selector(text, quote, ordinal)
            mentions.append({
                "mention_key": mention_key(vs, slug),
                "verse_key": f"verse:Neh.2.{vs}",
                "attestation_key": find_attestation(vs, slug),
                "target": {"type": "entity", "key": f"entity:{slug}"},
                "mention_form": form,
                "selector": {
                    "exact_quote": quote,
                    "occurrence_ordinal": ordinal,
                    "prefix": prefix,
                    "suffix": suffix,
                },
                "claim_keys": claims_for_entity(slug),
                "review_status": "draft",
            })
    mention_by_verse: dict[str, list[str]] = {f"verse:Neh.2.{n}": [] for n in range(1, 21)}
    for m in mentions:
        mention_by_verse[m["verse_key"]].append(m["mention_key"])

    return {
        "contract_version": CONTRACT,
        "schema_version": CONTRACT,
        "vocabulary_version": VOCAB,
        "coverage_policy_version": COVERAGE_POLICY,
        "data_classification": DATA_CLASSIFICATION,
        "package_key": EDITION_PKG,
        "package_revision": 1,
        "submission_id": "submission:neh2:edition-bsb:attempt-1",
        "attempt": 1,
        "produced_for_job_id": "job:neh2:edition-bsb",
        "package_layer": "edition",
        "package_family": "translation-mention-draft",
        "scope": {
            "canon_key": CANON,
            "reference_system_key": REFSYS,
            "scope_keys": SCOPES,
            "reference_keys": VERSES,
            "language_tag": "en",
            "translation_edition_key": EDITION,
        },
        "review_status": "draft",
        "dependencies": [{
            "package_key": CANON_PKG,
            "revision": 1,
            "digest": canonical_digest,
        }],
        "records": {"mentions": mentions},
        "coverage": [{
            "annotation_class": "translation_mention",
            "groups": [{
                "result": "incomplete",
                "reference_keys": VERSES,
                "record_keys": [m["mention_key"] for m in mentions],
                "blocker_question_keys": [],
            }],
        }],
        "open_questions": [],
        "editorial_observations": [
            {"code": "source-attribution", "note": PROVENANCE},
            {"code": "bounded-mention-set", "note": "Mentions cover the curated entity catalog; pronouns and indirect references are not exhaustively extracted, so coverage is reported incomplete."},
        ],
    }


def find_attestation(vs: int, slug: str) -> str:
    for row in ATTEST.get(vs, []):
        if row[0] == slug:
            return attestation_key(vs, slug, row[1])
    raise ValueError(f"no attestation for {slug} at Neh.2.{vs}")


def build_locale(canonical_digest: str) -> dict:
    profiles = []
    for e in ENTITIES:
        profiles.append({
            "profile_key": f"profile:en:{e['slug']}",
            "entity_key": f"entity:{e['slug']}",
            "language_tag": "en",
            "preferred_name": e["label"],
            "aliases": e["aliases"],
            "short_description": {"text": e["short"], "claim_keys": [f"claim:{c}" for c in e["claims"]]},
            "extended_description": ({"text": e["extended"], "claim_keys": [f"claim:{c}" for c in e["claims"]]} if e["extended"] else None),
            "review_status": "draft",
        })
    if len({p["entity_key"] for p in profiles}) != len(profiles):
        raise ValueError("duplicate entity profile")

    contexts, questions = [], []
    blocked_scopes: list[tuple[str, str, list[str]]] = []
    complete_scopes: list[tuple[str, str]] = []
    for scope in SCOPES:
        key = "context:en:" + scope.split(":")[1]
        orientation = {}
        blockers = []
        for field, (text, claim_slugs, qkey) in CONTEXTS[scope].items():
            entry = {
                "text": text,
                "claim_keys": [f"claim:{c}" for c in claim_slugs],
                "open_question_key": qkey,
            }
            orientation[field] = entry
            if qkey:
                blockers.append(qkey)
        contexts.append({
            "context_key": key,
            "scope_key": scope,
            "language_tag": "en",
            "orientation": orientation,
            "review_status": "draft",
        })
        if blockers:
            blocked_scopes.append((scope, key, blockers))
        else:
            complete_scopes.append((scope, key))

    questions = [
        {
            "question_key": "question:neh-2-court-city",
            "question_type": "uncertain_location",
            "record_key": "context:en:neh-2-request",
            "field_path": "/records/passage_contexts/orientation/where",
            "question": "Chapter 2 names no court city; may the setting be identified with Susa, or must it be presented as unnamed?",
            "blocks_publication": True,
        },
        {
            "question_key": "question:neh-2-year-reckoning",
            "question_type": "uncertain_date",
            "record_key": "context:en:neh-2-request",
            "field_path": "/records/passage_contexts/orientation/when",
            "question": "The twentieth year of Artaxerxes is commonly rendered about 445 BC; which regnal-year reckoning should the reader see?",
            "blocks_publication": True,
        },
        {
            "question_key": "question:neh-2-route-locations",
            "question_type": "uncertain_location",
            "record_key": "context:en:neh-2-inspection",
            "field_path": "/records/passage_contexts/orientation/where",
            "question": "The Persian-period locations of the Valley Gate and the King's Pool are reconstructed, not certain; which candidate placement should be shown?",
            "blocks_publication": True,
        },
    ]

    localizations = [{
        "localization_key": f"relevance-localization:en:{relevance_key(scope, slug).split(':', 1)[1]}",
        "relevance_key": relevance_key(scope, slug),
        "scope_key": scope,
        "entity_key": f"entity:{slug}",
        "language_tag": "en",
        "role_text": ROLE_TEXT[(scope, slug)],
        "claim_keys": [f"claim:{c}" for c in claims_],
        "review_status": "draft",
    } for scope, slug, _imp, _att, claims_ in RELEVANCE]

    groups = []
    if complete_scopes:
        groups.append({
            "result": "complete_with_records",
            "scope_keys": [s for s, _ in complete_scopes],
            "record_keys": [c for _, c in complete_scopes],
            "blocker_question_keys": [],
        })
    if blocked_scopes:
        groups.append({
            "result": "blocked",
            "scope_keys": [s for s, _, _ in blocked_scopes],
            "record_keys": [c for _, c, _ in blocked_scopes],
            "blocker_question_keys": sorted({q for _, _, qs in blocked_scopes for q in qs}),
        })

    return {
        "contract_version": CONTRACT,
        "schema_version": CONTRACT,
        "vocabulary_version": VOCAB,
        "coverage_policy_version": COVERAGE_POLICY,
        "data_classification": DATA_CLASSIFICATION,
        "package_key": LOCALE_PKG,
        "package_revision": 1,
        "submission_id": "submission:neh2:locale-en:attempt-1",
        "attempt": 1,
        "produced_for_job_id": "job:neh2:locale-en",
        "package_layer": "locale",
        "package_family": "locale-context-draft",
        "scope": {
            "canon_key": CANON,
            "reference_system_key": REFSYS,
            "scope_keys": SCOPES,
            "reference_keys": VERSES,
            "language_tag": "en",
            "translation_edition_key": None,
        },
        "review_status": "draft",
        "dependencies": [{
            "package_key": CANON_PKG,
            "revision": 1,
            "digest": canonical_digest,
        }],
        "records": {
            "entity_profiles": profiles,
            "passage_contexts": contexts,
            "relevance_localizations": localizations,
        },
        "coverage": [{
            "annotation_class": "passage_context_localization",
            "groups": groups,
        }],
        "open_questions": questions,
        "editorial_observations": [
            {"code": "source-attribution", "note": PROVENANCE},
            {"code": "draft-context", "note": "Reader context is authored draft material grounded in the cited Scripture and structured sources; it requires review and is not approved."},
        ],
    }


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    canonical = build_canonical()
    canonical_digest = sha256_text(jcs(canonical))
    edition = build_edition(canonical_digest)
    locale = build_locale(canonical_digest)

    (OUT / "canonical.v2.json").write_text(
        json.dumps(canonical, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "edition-bsb.v2.json").write_text(
        json.dumps(edition, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "locale-en.v2.json").write_text(
        json.dumps(locale, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "evidence-catalog.json").write_text(
        json.dumps({
            "catalog_version": "1.0.0",
            "data_classification": DATA_CLASSIFICATION,
            "attribution": PROVENANCE,
            "scope": {"canon_key": CANON, "reference_system_key": REFSYS, "scope_keys": SCOPES, "reference_keys": VERSES},
            "items": EVIDENCE,
        }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"canonical entities={len(ENTITIES)} claims={len(CLAIMS)} attestations={sum(len(v) for v in ATTEST.values())}")
    print(f"edition mentions={sum(len(v) for v in MENTIONS.values())}")
    print(f"locale profiles={len(ENTITIES)} contexts={len(SCOPES)} localizations={len(RELEVANCE)}")
    print(f"canonical digest={canonical_digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
