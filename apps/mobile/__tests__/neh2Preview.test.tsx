import {
  anchorsForVerse,
  entityBySlug,
  getPreview,
  previewAvailable,
  previewChapter,
  previewContexts,
  previewEvents,
  previewNotice,
  rolesForEntity,
  validatePreview,
} from '@/content/neh2Preview';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ContextSheet } from '@/components/sheets/ContextSheet';
import { getVerseText } from '@/content/bsb';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('curated preview asset', () => {
  it('loads a draft preview covering all six passage scopes', () => {
    expect(previewAvailable()).toBe(true);
    const preview = getPreview();
    expect(preview.review_status).toBe('draft');
    expect(preview.passage).toBe('Neh.2.1-Neh.2.20');
    expect(preview.contexts).toHaveLength(6);
    expect(previewChapter().slug).toBe('neh-2');
    expect(previewNotice()).toMatch(/UNVERIFIED DRAFT PREVIEW/);
  });

  it('links every entity, role, mention and event without orphans', () => {
    const preview = getPreview();
    expect(preview.entities.length).toBeGreaterThan(20);
    for (const entity of preview.entities) {
      // Background concepts without attestations (e.g. the king's office,
      // the empire) legitimately carry no passage role; everything present
      // must resolve.
      for (const role of entity.roles) {
        expect(role.scope_key.length).toBeGreaterThan(0);
        expect(role.role_text.length).toBeGreaterThan(10);
      }
    }
    const withRoles = preview.entities.filter((entity) => entity.roles.length > 0);
    expect(withRoles.length).toBeGreaterThan(20);
    for (const mention of preview.mentions) {
      expect(entityBySlug(mention.entity_slug)).not.toBeNull();
    }
    for (const event of preview.events) {
      expect(event.participants.length + event.places.length).toBeGreaterThan(0);
    }
    expect(rolesForEntity('nehemiah-governor').length).toBeGreaterThan(3);
    expect(entityBySlug('no-such-entity')).toBeNull();
  });

  it('resolves every mention selector against the bundled BSB verse text', () => {
    const preview = getPreview();
    for (const mention of preview.mentions) {
      const text = getVerseText('Neh', 2, mention.verse, 'BSB');
      expect(text).not.toBeNull();
      const verse = text ?? '';
      let index = -1;
      let seen = 0;
      for (
        let i = verse.indexOf(mention.quote);
        i !== -1;
        i = verse.indexOf(mention.quote, i + 1)
      ) {
        seen += 1;
        if (seen === mention.ordinal) {
          index = i;
          break;
        }
      }
      expect(index).toBeGreaterThanOrEqual(0);
      expect(verse.slice(Math.max(0, index - 20), index)).toBe(mention.prefix);
      expect(verse.slice(index + mention.quote.length, index + mention.quote.length + 20)).toBe(
        mention.suffix,
      );
    }
  });

  it('keeps curated anchors off other translations until reviewed', () => {
    expect(anchorsForVerse('Neh', 2, 1, 'tam_irv')).toEqual([]);
    expect(anchorsForVerse('Neh', 2, 1, 'tel_irv')).toEqual([]);
    expect(anchorsForVerse('Neh', 2, 1)).toHaveLength(3);
    expect(anchorsForVerse('Gen', 1, 1)).toEqual([]);
  });
});

describe('preview rejection', () => {
  it('rejects non-draft, wrong-scope and orphaned records', () => {
    const base = clone(getPreview());
    expect(() => validatePreview({ ...base, review_status: 'approved' })).toThrow();
    expect(() => validatePreview({ ...base, contexts: [] })).toThrow();
    const orphan = clone(base);
    orphan.mentions = [
      {
        verse: 1,
        quote: 'King Artaxerxes',
        ordinal: 1,
        prefix: '',
        suffix: '',
        entity_slug: 'no-such-entity',
        form: 'explicit_name',
      },
    ];
    expect(() => validatePreview(orphan)).toThrow();
    const duped = clone(base);
    duped.entities = [...duped.entities, { ...duped.entities[0]! }];
    expect(() => validatePreview(duped)).toThrow();
  });

  it('rejects missing keys and broken event links', () => {
    const base = clone(getPreview());
    const { contexts: _dropped, ...withoutContexts } = base;
    expect(() => validatePreview(withoutContexts)).toThrow();
    const badEvent = clone(base);
    badEvent.events = [
      {
        key: 'ghost',
        title: 'Ghost',
        range: 'Neh.2.1',
        scope_key: 'scope:ghost',
        participants: [{ slug: 'no-such-entity', name: 'Ghost' }],
        places: [],
      },
    ];
    expect(() => validatePreview(badEvent)).toThrow();
  });
});

describe('curated scope coverage', () => {
  it('displays context for all six passage scopes', () => {
    render(
      <ContextSheet
        visible
        onClose={jest.fn()}
        onOpenEntity={jest.fn()}
        onOpenTimeline={jest.fn()}
        onOpenMap={jest.fn()}
        onOpenPassage={jest.fn()}
      />,
    );
    const titles = [
      'Nehemiah 2',
      'Nehemiah Sent to Jerusalem',
      'Nehemiah 2:9–10',
      'Nehemiah Inspects the Walls',
      'Nehemiah 2:17–18',
      'Nehemiah 2:19–20',
    ];
    titles.forEach((title, index) => {
      fireEvent.press(screen.getByTestId(`context-scope-${index}`));
      expect(screen.getByText(title)).toBeTruthy();
    });
  });
});
