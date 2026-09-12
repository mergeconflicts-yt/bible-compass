/**
 * PROTOTYPE FIXTURES — not production content.
 *
 * Copy transcribed from `demo/design-spec.html`, which is itself a prototype
 * built from `docs/DESIGN_SPEC.md` plus sample screenshots. Scripture wording
 * is the active bundled translation (currently BSB) — see `src/content/bsb.ts`.
 * All contextual wording is dummy
 * prototype copy: production claims require approved sources, citations and
 * named editorial review per `docs/CONTENT_GUIDELINES.md`.
 * `docs/CONTENT_RIGHTS.md` records the English/BSB evidence basis; the
 * permission matrix still needs owner sign-off, and Telugu/Tamil are OPEN.
 */

import { activeTranslation, getVerseText } from '@/content/bsb';

export const dailyVerseText =
  getVerseText('Neh', 2, 4) ?? '“What is your request?” replied the king.';

export const dailyVerseReference = 'Nehemiah 2:4';

export const translationAttribution = activeTranslation.attribution;

export const surroundingPassageLabel = 'Nehemiah 2:1–8';
export const surroundingPassageMeta = 'Nehemiah 2:1–8 · About 3 minutes';

export const eraRail = {
  period: 'Persian period · around 445 BC',
  before: '… return',
  now: '445 BC · Nehemiah 2',
  after: '332 BC · Alexander',
} as const;

export const mapCity = {
  title: 'Susa to Jerusalem',
  subtitle: 'Beyond the River · Jerusalem, c. 445 BC',
  description:
    'The dotted circuit is the route of verses 13–15: out by the Valley Gate, south to the Dung Gate, up to the King’s Pool, then on foot up the Kidron and back.',
  uncertainty:
    'Approximate. Persian-period wall line reconstructed from excavation + Neh 3; scholars disagree. Pale rectangle = today’s Old City (1538 AD) — Nehemiah’s city lies mostly outside, on the City of David ridge.',
  hotspots: ['Valley Gate', 'Dung Gate', 'Temple', 'Gihon Spring', 'King’s Pool'],
} as const;

export const mapJourney = {
  description:
    'Nehemiah asks for letters to the governors of Beyond the River — roughly 1,500 km from court to hill town.',
  uncertainty:
    'Schematic. Route not recorded. Athens marked for scale: while this journey was made, the Parthenon was under construction there.',
  distance: '≈ 1,500 km · months of travel',
} as const;

export const companion = {
  verseLabel: 'Nehemiah 2:1',
  phrase: '“King Artaxerxes”',
  eyebrow: 'Person · Persian politics',
  heading: 'The person who can authorize the mission',
  text: 'Artaxerxes rules the empire governing Judah. Nehemiah needs more than permission to leave — he needs official protection and access to royal resources.',
} as const;

export interface SavedRow {
  title: string;
  meta: string;
}

export const savedRows: SavedRow[] = [
  { title: 'Nehemiah 2:1–8', meta: `${activeTranslation.short} · saved today · available offline` },
  { title: 'Nehemiah 2:4', meta: `${activeTranslation.short} · verse of the day · Sep 11` },
];

export const searchRecents: SavedRow[] = [
  { title: 'Nehemiah 2:1–8', meta: `${activeTranslation.short} · recent reference` },
  { title: 'Ezra 4:23', meta: `${activeTranslation.short} · recent reference` },
];

export const searchEntities: SavedRow[] = [
  { title: 'Artaxerxes I', meta: 'Person · Persian politics' },
];

export const composerFormats = ['9:16 Status', '1:1 Square', '4:5 Portrait'] as const;
export const composerThemes = ['Daylight', 'Night', 'Parchment'] as const;
