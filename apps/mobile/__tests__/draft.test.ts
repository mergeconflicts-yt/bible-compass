import {
  anchorsForVerse,
  draftBrief,
  draftConnections,
  draftNotice,
  draftPeople,
  draftPlaceSlugs,
  entityBySlug,
  formatYear,
  getDraft,
  getTimeline,
  roleBySlug,
  splitAnchored,
  toBullets,
} from '@/content/neh2Draft';
import { getVerseText } from '@/content/bsb';
import { NEH2_ANCHOR_PHRASE } from '@/components/ReaderView';

describe('draft context wiring', () => {
  it('loads only content explicitly marked draft', () => {
    const draft = getDraft();
    expect(draft.review_status).toBe('draft');
    expect(draft.passage).toBe('Neh.2.1-Neh.2.20');
    for (const field of ['who', 'where', 'when', 'what', 'before', 'stakes'] as const) {
      expect(draft[field].length).toBeGreaterThan(20);
    }
  });

  it('resolves every passage role to a defined entity', () => {
    const draft = getDraft();
    for (const role of draft.passage_entities) {
      expect(entityBySlug(role.entity_id)).not.toBeNull();
      expect(role.role_in_passage.length).toBeGreaterThan(10);
    }
    expect(roleBySlug('nehemiah-governor')).not.toBeNull();
    expect(roleBySlug('no-such-entity')).toBeNull();
    expect(entityBySlug('no-such-entity')).toBeNull();
  });

  it('keeps the companion anchor validated against the bundled verse text', () => {
    expect(getVerseText('Neh', 2, 1)).toContain(NEH2_ANCHOR_PHRASE);
  });

  it('validates every anchor phrase and offset against its exact verse text', () => {
    const draft = getDraft();
    const anchors = (draft as unknown as { anchors: Array<{ verse_id: string; matched_text: string; entity_id: string; start_offset: number; end_offset: number }> }).anchors;
    expect(anchors.length).toBeGreaterThanOrEqual(19);
    for (const anchor of anchors) {
      const [, chapterRaw, verseRaw] = anchor.verse_id.split('.');
      const text = getVerseText('Neh', Number(chapterRaw), Number(verseRaw));
      expect(text).not.toBeNull();
      expect(text!.slice(anchor.start_offset, anchor.end_offset)).toBe(anchor.matched_text);
      expect(entityBySlug(anchor.entity_id)).not.toBeNull();
    }
  });

  it('splits brief prose into bullets without losing sentences', () => {
    expect(toBullets('First. Second! Third?')).toEqual(['First.', 'Second!', 'Third?']);
    expect(toBullets('No terminator')).toEqual(['No terminator']);
  });

  it('splits verse text around each anchor without losing words', () => {
    const text = getVerseText('Neh', 2, 10) ?? '';
    const segments = splitAnchored(text, anchorsForVerse('Neh', 2, 10));
    expect(segments.filter((segment) => segment.slug).map((segment) => segment.text)).toEqual([
      'Sanballat the Horonite',
      'Tobiah the Ammonite official',
    ]);
    expect(segments.map((segment) => segment.text).join('')).toBe(text);
    expect(anchorsForVerse('Neh', 2, 4)).toEqual([
      { phrase: 'I prayed to the God of heaven', slug: 'prayer-before-the-king' },
    ]);
  });

  it('derives the brief, people, places, history and connections views without gaps', () => {
    expect(draftBrief()).toHaveLength(3);
    expect(draftPeople().length).toBeGreaterThanOrEqual(6);
    expect(draftPlaceSlugs().length).toBeGreaterThanOrEqual(4);
    for (const connection of draftConnections()) {
      expect(connection.passageKey.length).toBeGreaterThan(0);
    }
  });

  it('labels every timeline event with precision and keeps the draft notice', () => {
    for (const event of getDraft().timeline) {
      expect(event.date_precision.length).toBeGreaterThan(0);
      expect(event.relevance.length).toBeGreaterThan(0);
    }
    expect(draftNotice).toMatch(/unreviewed/i);
  });

  it('holds one chronological biblical spine with short names for the rail', () => {
    const events = getTimeline();
    expect(events.length).toBeGreaterThanOrEqual(10);
    const years = events.map((event) => Number.parseInt(event.start, 10));
    expect([...years].sort((left, right) => left - right)).toEqual(years);
    for (const event of events) {
      expect(event.short_name.length).toBeGreaterThan(0);
    }
    expect(events.map((event) => event.canonical_key)).toContain('nehemiah-2-request');
  });

  it('formats draft years for display on both sides of the era divide', () => {
    expect(formatYear('-445')).toBe('445 BC');
    expect(formatYear('-2000')).toBe('2000 BC');
    expect(formatYear('30')).toBe('AD 30');
  });

  it('stores machine-verified appearance refs on person entities', () => {    const artaxerxes = entityBySlug('artaxerxes-i');
    expect(artaxerxes?.appearances?.length).toBe(7);
    for (const appearance of artaxerxes?.appearances ?? []) {
      expect(appearance.ref.length).toBeGreaterThan(0);
      expect(appearance.passageKey).toMatch(/^[A-Za-z1-9]+\.\d+$/);
    }
    expect(entityBySlug('asaph-royal-park')?.appearances).toHaveLength(1);
  });
});
