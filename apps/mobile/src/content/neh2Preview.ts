/**
 * Curated Nehemiah 2 preview boundary. Reads the deterministic projection
 * `assets/content/nehemiah-2.preview.json` (built by
 * `tools/build-neh2-preview.py` from the three EN-01 contract packages) and
 * nothing else. Every surface rendering this data must show the preview
 * notice: the content is an unverified draft, never source of truth.
 *
 * Invalid data fails loudly (PreviewError) so callers render an explicit
 * unavailable/error state. This module never falls back to the legacy
 * single-file draft.
 */

import { splitAnchored, toBullets } from '@/content/neh2Draft';

// Metro provides require() at runtime for bundled JSON assets.
declare const require: (path: string) => unknown;

export { splitAnchored, toBullets };

export class PreviewError extends Error {
  constructor(message: string) {
    super(`neh2Preview: ${message}`);
    this.name = 'PreviewError';
  }
}

export interface PreviewScopeContext {
  scope_key: string;
  slug: string;
  title: string;
  range: string;
  passageKey: string;
  who: string;
  where: string;
  when: string;
  what: string;
  before: string;
  stakes: string;
  immediate_summary: string;
  blocked: boolean;
}

export interface PreviewRole {
  scope_key: string;
  scope_slug: string;
  scope_title: string;
  range: string;
  role_text: string;
  importance: 'central' | 'supporting' | 'background';
}

export interface PreviewEntity {
  slug: string;
  name: string;
  type: string;
  aliases: string[];
  short_description: string;
  extended_description: string | null;
  roles: PreviewRole[];
  appearances: { ref: string; passageKey: string }[];
}

export interface PreviewMention {
  verse: number;
  quote: string;
  ordinal: number;
  prefix: string;
  suffix: string;
  entity_slug: string;
  form: string;
}

export interface PreviewEvent {
  key: string;
  title: string;
  range: string;
  scope_key: string;
  participants: { slug: string; name: string }[];
  places: Array<{ slug: string; name: string }>;
}

export interface PreviewRelationship {
  subject_slug: string;
  subject_name: string;
  predicate: string;
  object_slug: string;
  object_name: string;
  ranges: string[];
}

export interface PreviewConnection {
  title: string;
  note: string;
  passageKey: string;
}

export interface PreviewData {
  schema_version: number;
  generator: string;
  packages: { canonical: string; locale: string; edition: string };
  canonical_digest: string;
  review_status: string;
  preview_notice: string;
  passage: string;
  contexts: PreviewScopeContext[];
  entities: PreviewEntity[];
  mentions: PreviewMention[];
  events: PreviewEvent[];
  relationships: PreviewRelationship[];
  connections: PreviewConnection[];
}

const PREVIEW_ASSET = '../../assets/content/nehemiah-2.preview.json';
const CHAPTER_SCOPE = 'neh-2';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Strict structural validation: any deviation fails loudly, never partial.
 * Exported so tests can prove rejection of missing keys and broken links.
 */
export function validatePreview(data: unknown): PreviewData {
  if (!isRecord(data)) throw new PreviewError('preview asset must be an object');
  if (data.schema_version !== 1) throw new PreviewError('unsupported preview schema_version');
  if (data.review_status !== 'draft')
    throw new PreviewError('preview asset must stay marked draft');
  if (data.passage !== 'Neh.2.1-Neh.2.20')
    throw new PreviewError('preview asset must cover Neh.2.1-Neh.2.20');
  for (const section of [
    'contexts',
    'entities',
    'mentions',
    'events',
    'relationships',
    'connections',
  ] as const) {
    if (!Array.isArray(data[section])) throw new PreviewError(`preview asset needs ${section}`);
  }
  const preview = data as unknown as PreviewData;
  if (preview.contexts.length !== 6)
    throw new PreviewError('preview asset needs six passage contexts');
  const slugs = new Set<string>();
  for (const entity of preview.entities) {
    if (!entity.slug || !entity.name || !entity.type) {
      throw new PreviewError('preview entity needs slug, name and type');
    }
    if (slugs.has(entity.slug)) throw new PreviewError(`duplicate preview entity ${entity.slug}`);
    slugs.add(entity.slug);
    for (const role of entity.roles ?? []) {
      if (!role.scope_key || !role.role_text) {
        throw new PreviewError(`preview role for ${entity.slug} needs scope and text`);
      }
    }
  }
  for (const mention of preview.mentions) {
    if (!Number.isInteger(mention.verse) || mention.verse < 1 || mention.verse > 20) {
      throw new PreviewError('preview mention needs a verse 1-20');
    }
    if (!mention.quote || !slugs.has(mention.entity_slug)) {
      throw new PreviewError('preview mention needs a quote and a known entity');
    }
  }
  for (const event of preview.events) {
    for (const person of [...event.participants, ...event.places]) {
      if (!slugs.has(person.slug))
        throw new PreviewError(`preview event ${event.key} names unknown ${person.slug}`);
    }
  }
  return preview;
}

let cached: PreviewData | null = null;

export function getPreview(): PreviewData {
  if (!cached) {
    cached = validatePreview(require(PREVIEW_ASSET));
  }
  return cached;
}

/** True when the generated preview asset loads and validates. */
export function previewAvailable(): boolean {
  try {
    getPreview();
    return true;
  } catch {
    return false;
  }
}

/** Visible on every surface rendering preview content. Never remove silently. */
export function previewNotice(): string {
  try {
    return getPreview().preview_notice;
  } catch {
    return 'UNVERIFIED DRAFT PREVIEW — preview data is unavailable.';
  }
}

export interface PreviewAnchor {
  phrase: string;
  slug: string;
  /** 1-based occurrence of phrase in the verse; validated upstream. */
  ordinal: number;
}

export interface TextSegment {
  text: string;
  slug: string | null;
}

/**
 * Splits verse text around validated mention selectors, resolving each
 * anchor to its exact occurrence. Overlapping spans resolve to the earliest,
 * longest match; anything else renders as plain text. Never guesses.
 */
export function splitAnchoredOccurrences(text: string, anchors: PreviewAnchor[]): TextSegment[] {
  const resolved = anchors.flatMap((anchor) => {
    let index = -1;
    let seen = 0;
    for (let i = text.indexOf(anchor.phrase); i !== -1; i = text.indexOf(anchor.phrase, i + 1)) {
      seen += 1;
      if (seen === anchor.ordinal) {
        index = i;
        break;
      }
    }
    return index >= 0 ? [{ ...anchor, index }] : [];
  });
  resolved.sort((a, b) => a.index - b.index || b.phrase.length - a.phrase.length);
  const out: TextSegment[] = [];
  let cursor = 0;
  for (const anchor of resolved) {
    if (anchor.index < cursor) continue;
    if (anchor.index > cursor) out.push({ text: text.slice(cursor, anchor.index), slug: null });
    out.push({ text: anchor.phrase, slug: anchor.slug });
    cursor = anchor.index + anchor.phrase.length;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), slug: null });
  return out.filter((segment) => segment.text.length > 0);
}

/** "Neh.2.1–Neh.2.8" -> "2:1–8" for narrow rail labels. */
export function shortRange(range: string): string {
  // Input looks like "Neh.2.1–Neh.2.8" (book.chapter.verse, en dash).
  const compact = range.replace(/Neh\./g, '');
  const [start = '', end = ''] = compact.split('–');
  const [startChapter, startVerse] = start.split('.');
  const [endChapter, endVerse] = (end || start).split('.');
  if (startChapter && startChapter === endChapter && startVerse && endVerse) {
    return `${startChapter}:${startVerse}–${endVerse}`;
  }
  return compact;
}

function shortTitle(key: string): string {
  return key
    .split('-')
    .map((word) => (word.length > 0 ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** Curated rail stops for the passage timeline (no prototype claims). */
export function previewRailStops(): Array<{ key: string; top: string; title: string }> {
  return getPreview().events.map((event) => ({
    key: event.key,
    top: shortRange(event.range),
    title: shortTitle(event.key),
  }));
}

/**
 * Curated BSB mentions for one verse. Only BSB has validated selectors;
 * other translations read Scripture without the mention layer until
 * per-translation mentions are reviewed.
 */
export function anchorsForVerse(
  bookOsis: string,
  chapter: number,
  verse: number,
  translationId = 'BSB',
): PreviewAnchor[] {
  if (bookOsis !== 'Neh' || chapter !== 2 || translationId !== 'BSB') return [];
  return getPreview()
    .mentions.filter((mention) => mention.verse === verse)
    .map((mention) => ({
      phrase: mention.quote,
      slug: mention.entity_slug,
      ordinal: mention.ordinal,
    }));
}

export function entityBySlug(slug: string): PreviewEntity | null {
  return getPreview().entities.find((entity) => entity.slug === slug) ?? null;
}

const IMPORTANCE_RANK: Record<string, number> = { central: 0, supporting: 1, background: 2 };

function scopeOrder(): string[] {
  return getPreview().contexts.map((context) => context.slug);
}

function rankRole(scopeIndex: Map<string, number>, role: PreviewRole): number {
  return (scopeIndex.get(role.scope_slug) ?? 99) * 10 + (IMPORTANCE_RANK[role.importance] ?? 9);
}

/** All passage roles for an entity, most prominent first. */
export function rolesForEntity(slug: string): PreviewRole[] {
  const entity = entityBySlug(slug);
  if (!entity) return [];
  const order = new Map(scopeOrder().map((key, index) => [key, index]));
  return [...entity.roles].sort((a, b) => rankRole(order, a) - rankRole(order, b));
}

export interface PassageRole {
  entity_id: string;
  role_in_passage: string;
  priority: number;
}

/** The entity's most prominent passage role (chapter view default). */
export function roleBySlug(slug: string): PassageRole | null {
  const [first] = rolesForEntity(slug);
  if (!first) return null;
  return { entity_id: slug, role_in_passage: first.role_text, priority: 1 };
}

export function previewContexts(): PreviewScopeContext[] {
  return getPreview().contexts;
}

export function previewContext(scopeSlug: string): PreviewScopeContext | null {
  return getPreview().contexts.find((context) => context.slug === scopeSlug) ?? null;
}

export function previewChapter(): PreviewScopeContext {
  const chapter = previewContext(CHAPTER_SCOPE);
  if (!chapter) throw new PreviewError('preview asset needs the chapter scope');
  return chapter;
}

export function previewEvents(): PreviewEvent[] {
  return getPreview().events;
}

export function previewEvent(key: string): PreviewEvent | null {
  return getPreview().events.find((event) => event.key === key) ?? null;
}

/** Events in a scope; the chapter scope shows every passage event. */
export function previewEventsForScope(scopeSlug: string): PreviewEvent[] {
  const preview = getPreview();
  if (scopeSlug === CHAPTER_SCOPE) return preview.events;
  const scope = preview.contexts.find((context) => context.slug === scopeSlug);
  if (!scope) return [];
  return preview.events.filter((event) => event.scope_key === scope.scope_key);
}

export function previewRelationships(): PreviewRelationship[] {
  return getPreview().relationships;
}

export function relationshipsFor(slug: string): PreviewRelationship[] {
  return getPreview().relationships.filter(
    (rel) => rel.subject_slug === slug || rel.object_slug === slug,
  );
}

export function previewConnections(): PreviewConnection[] {
  return getPreview().connections;
}

export interface PreviewPerson {
  slug: string;
  initial: string;
  name: string;
  role: string;
}

function shortRole(text: string): string {
  const head = text.split(/[;.]/)[0] ?? text;
  return head.length > 42 ? `${head.slice(0, 42).trim()}…` : head.trim();
}

function peopleInScope(scopeSlug: string): PreviewPerson[] {
  const preview = getPreview();
  const order = new Map(scopeOrder().map((key, index) => [key, index]));
  const seen = new Map<string, PreviewPerson & { rank: number }>();
  const scopes =
    scopeSlug === CHAPTER_SCOPE ? preview.contexts.map((context) => context.slug) : [scopeSlug];
  for (const entity of preview.entities) {
    for (const role of entity.roles) {
      if (!scopes.includes(role.scope_slug)) continue;
      const rank = rankRole(order, role);
      const current = seen.get(entity.slug);
      const person = {
        slug: entity.slug,
        initial: entity.name.slice(0, 1),
        name: entity.name,
        role: shortRole(role.role_text),
        rank,
      };
      if (!current || rank < current.rank) seen.set(entity.slug, person);
    }
  }
  return [...seen.values()]
    .sort((a, b) => a.rank - b.rank)
    .map(({ slug, initial, name, role }) => ({ slug, initial, name, role }));
}

const PEOPLE_TYPES = new Set(['person', 'deity']);
const PLACE_TYPES = new Set(['place', 'structure']);

/** People for the context sheet, in passage relevance order. */
export function previewPeople(scopeSlug: string = CHAPTER_SCOPE): PreviewPerson[] {
  const preview = getPreview();
  return peopleInScope(scopeSlug).filter((person) =>
    PEOPLE_TYPES.has(preview.entities.find((e) => e.slug === person.slug)?.type ?? ''),
  );
}

/** Place/structure slugs with a role in the scope, in relevance order. */
export function previewPlaceSlugs(scopeSlug: string = CHAPTER_SCOPE): string[] {
  const preview = getPreview();
  return peopleInScope(scopeSlug)
    .map((person) => person.slug)
    .filter((slug) => PLACE_TYPES.has(preview.entities.find((e) => e.slug === slug)?.type ?? ''));
}

/** Neither person nor place: collectives, roles, practices, objects with a role here. */
export function previewOtherSlugs(scopeSlug: string = CHAPTER_SCOPE): string[] {
  const preview = getPreview();
  return peopleInScope(scopeSlug)
    .map((person) => person.slug)
    .filter((slug) => {
      const type = preview.entities.find((e) => e.slug === slug)?.type ?? '';
      return type !== '' && !PEOPLE_TYPES.has(type) && !PLACE_TYPES.has(type);
    });
}

/** The 30-second brief: before / right-now / stakes from the scope fields. */
export function previewBrief(scopeSlug: string = CHAPTER_SCOPE): Array<{
  label: string;
  text: string;
  hot?: boolean;
}> {
  const context = previewContext(scopeSlug) ?? previewChapter();
  return [
    { label: 'BEFORE THIS', text: context.before },
    { label: 'RIGHT NOW', text: context.what, hot: true },
    { label: 'WHAT IS AT STAKE', text: context.stakes },
  ];
}
