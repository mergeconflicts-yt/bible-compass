/**
 * Unreviewed DRAFT context access. The data is AI-prepared and has no
 * editorial approval — every surface that renders it must show the DRAFT
 * notice (see ReviewBox / draftNotice). Replacing this with approved content
 * requires named reviewer sign-off per docs/CONTENT_GUIDELINES.md, never an
 * AI edit. Asset synced by `tools/sync-context-draft.py`.
 */

// Metro provides require() at runtime for bundled JSON assets.
declare const require: (path: string) => unknown;

export interface DraftAppearance {
  ref: string;
  passageKey: string;
}

export interface DraftEntity {
  slug: string;
  canonical_name: string;
  type: string;
  short_description: string;
  extended_description: string;
  aliases: string[];
  temporal_range: { label: string; precision: string };
  confidence: string;
  review_status: string;
  /** Name-mention chapters verified by text search; identity review pending. */
  appearances?: DraftAppearance[];
  sources?: string[];
}

export interface DraftRole {
  entity_id: string;
  role_in_passage: string;
  temporal_state?: string;
  priority: number;
}

export interface DraftEvent {
  canonical_key: string;
  title: string;
  short_name: string;
  start: string;
  end: string;
  date_precision: string;
  description: string;
  relevance: string;
  display_mode: string;
  confidence: string;
  review_status: string;
}

/** "-445" -> "445 BC", "30" -> "AD 30". Draft years are whole-year bounds. */
export function formatYear(raw: string): string {
  const year = Number.parseInt(raw, 10);
  if (Number.isNaN(year)) return raw;
  return year < 0 ? `${Math.abs(year)} BC` : `AD ${year}`;
}

/** The single biblical timeline, oldest first. */
export function getTimeline(): DraftEvent[] {
  return getDraft().timeline;
}

export interface DraftContext {
  schema_version: number;
  content_version: number;
  package_key: string;
  passage: string;
  review_status: string;
  who: string;
  where: string;
  when: string;
  what: string;
  before: string;
  stakes: string;
  immediate_summary: string;
  the_moment: { reference: string; text: string };
  entities: DraftEntity[];
  passage_entities: DraftRole[];
  timeline: DraftEvent[];
  sources: Array<{ title: string; [key: string]: unknown }>;
  map_notes: { journey: string; inspection_circuit: string };
}

/** Visible on every surface rendering draft content. Never remove silently. */
export const draftNotice =
  'DRAFT — AI-prepared and unreviewed. Requires named editorial review before production.';

export interface DraftAnchor {
  translation_id: string;
  verse_id: string;
  matched_text: string;
  entity_id: string;
  start_offset: number;
  end_offset: number;
}

/**
 * Anchors for one verse in one translation. Only BSB has validated anchors;
 * other translations read Scripture without the context layer until
 * per-translation anchors are reviewed.
 */
export function anchorsForVerse(
  bookOsis: string,
  chapter: number,
  verse: number,
  translationId = 'BSB',
): Array<{ phrase: string; slug: string }> {
  const draft = getDraft();
  const anchors = (draft as unknown as { anchors?: DraftAnchor[] }).anchors ?? [];
  return anchors
    .filter(
      (anchor) =>
        anchor.translation_id === translationId &&
        anchor.verse_id === `${bookOsis}.${chapter}.${verse}`,
    )
    .map((anchor) => ({ phrase: anchor.matched_text, slug: anchor.entity_id }));
}

export interface TextSegment {
  text: string;
  slug: string | null;
}

/** Splits verse text around validated anchor phrases (first occurrence wins). */
export function splitAnchored(
  text: string,
  anchors: Array<{ phrase: string; slug: string }>,
): TextSegment[] {
  const ordered = anchors
    .map((anchor) => ({ ...anchor, index: text.indexOf(anchor.phrase) }))
    .filter((anchor) => anchor.index >= 0)
    .sort((left, right) => left.index - right.index);
  const out: TextSegment[] = [];
  let cursor = 0;
  for (const anchor of ordered) {
    if (anchor.index < cursor) continue;
    if (anchor.index > cursor) out.push({ text: text.slice(cursor, anchor.index), slug: null });
    out.push({ text: anchor.phrase, slug: anchor.slug });
    cursor = anchor.index + anchor.phrase.length;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), slug: null });
  return out.filter((segment) => segment.text.length > 0);
}

function loadDraft(): DraftContext {
  const data = require('../../assets/content/nehemiah-2.draft.json') as DraftContext;
  if (!data || data.review_status !== 'draft') {
    throw new Error('neh2Draft: bundled context is missing or not marked draft');
  }
  return data;
}

let cached: DraftContext | null = null;

export function getDraft(): DraftContext {
  if (!cached) cached = loadDraft();
  return cached;
}

export function entityBySlug(slug: string): DraftEntity | null {
  return getDraft().entities.find((entity) => entity.slug === slug) ?? null;
}

export function roleBySlug(slug: string): DraftRole | null {
  return getDraft().passage_entities.find((role) => role.entity_id === slug) ?? null;
}

/** People for the context sheet, in passage priority order. */
export function draftPeople(): Array<{
  slug: string;
  initial: string;
  name: string;
  role: string;
}> {
  const draft = getDraft();
  return draft.passage_entities
    .map((role) => ({ role, entity: draft.entities.find((item) => item.slug === role.entity_id) }))
    .filter(
      (item): item is { role: DraftRole; entity: DraftEntity } =>
        !!item.entity && item.entity.type === 'person',
    )
    .map(({ role, entity }) => ({
      slug: entity.slug,
      initial: entity.canonical_name.slice(0, 1),
      name: entity.canonical_name,
      role: shortRole(role.role_in_passage),
    }));
}

function shortRole(text: string): string {
  const head = text.split(/[;.]/)[0] ?? text;
  return head.length > 42 ? `${head.slice(0, 42).trim()}…` : head.trim();
}

/** The 30-second brief: before / right-now / stakes from the draft fields. */
export function draftBrief(): Array<{ label: string; text: string; hot?: boolean }> {
  const draft = getDraft();
  return [
    { label: 'BEFORE THIS', text: draft.before },
    { label: 'RIGHT NOW', text: draft.what, hot: true },
    { label: 'WHAT IS AT STAKE', text: draft.stakes },
  ];
}

/** Place slugs with a role in this passage, in passage priority order. */
export function draftPlaceSlugs(): string[] {
  const draft = getDraft();
  return draft.passage_entities
    .filter((role) => draft.entities.find((item) => item.slug === role.entity_id)?.type === 'place')
    .map((role) => role.entity_id);
}

/** Neither person nor place: empires, roles, practices, objects with a role here. */
export function draftOtherSlugs(): string[] {
  const draft = getDraft();
  return draft.passage_entities
    .filter((role) => {
      const type = draft.entities.find((item) => item.slug === role.entity_id)?.type;
      return type !== undefined && type !== 'person' && type !== 'place';
    })
    .map((role) => role.entity_id);
}

/** Foreground (in-chapter) timeline events, oldest first. */
export function foregroundEvents(): DraftEvent[] {
  return getTimeline().filter((event) => event.display_mode === 'foreground');
}

/** Splitter for brief prose into scannable bullets (no lookbehind: Hermes-safe). */
export function toBullets(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // Split only where a sentence terminator is followed by whitespace and a
  // capital letter or opening quote. This keeps dotted references such as
  // "Neh.1" / "Ezra 4:17-23" inside one bullet instead of splitting on the
  // book abbreviation. No lookbehind (Hermes-safe).
  const DELIM = '\u0000';
  const marked = trimmed.replace(/([.!?]["'”’)]*)\s+(?=[A-Z“"'(])/g, `$1${DELIM}`);
  return marked
    .split(DELIM)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** Cross-passage connections derived from draft source references. */
export function draftConnections(): Array<{ title: string; note: string; passageKey: string }> {
  return [
    {
      title: 'Nehemiah 1',
      note: 'Nehemiah hears about Jerusalem, mourns, fasts, and prays before ever facing the king.',
      passageKey: 'Neh.1',
    },
    {
      title: 'Ezra 4:17–23',
      note: 'An earlier imperial order stopped rebuilding work by force — the backdrop that makes this request dangerous.',
      passageKey: 'Ezra.4.17-Ezra.4.23',
    },
    {
      title: 'Nehemiah 6:15',
      note: 'The wall project this chapter starts is finished in 52 days.',
      passageKey: 'Neh.6.15',
    },
    {
      title: 'Nehemiah 13:6',
      note: 'After twelve years as governor, Nehemiah returns to the king.',
      passageKey: 'Neh.13.6',
    },
  ];
}
