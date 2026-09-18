/**
 * Translation rights gates (finding 2).
 *
 * Fail-closed contract tests (no native modules): unknown translations
 * deny every use, known flags match the reviewed table exactly, and each
 * enforcement point (selection, offline projection, search, composer
 * share) honors the table without changing currently allowed behavior.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { selectTranslationId } from '../src/content/bsb';
import { initializePassageContent, searchVerseText } from '../src/content/passageStore';
import {
  canDisplay,
  canSearch,
  canShare,
  canShareImage,
  canStoreOffline,
  rightsEvidence,
  rightsFor,
} from '../src/content/translationRights';
import { ComposerSheet } from '../src/components/sheets/ComposerSheet';

describe('translation rights table', () => {
  it('matches the reviewed posture exactly', () => {
    expect(rightsFor('BSB')).toEqual({
      display: true,
      offline: true,
      search: true,
      image: false,
      share: true,
    });
    expect(rightsFor('tam_irv')).toEqual({
      display: true,
      offline: false,
      search: true,
      image: false,
      share: true,
    });
    expect(rightsFor('tel_irv')).toEqual({
      display: true,
      offline: false,
      search: true,
      image: false,
      share: true,
    });
  });

  it('denies everything unknown, with no evidence to cite', () => {
    for (const id of ['', 'Neh', 'WEB', 'bsb']) {
      expect(rightsFor(id)).toEqual({
        display: false,
        offline: false,
        search: false,
        image: false,
        share: false,
      });
      expect(rightsEvidence(id)).toBeNull();
    }
    expect(rightsEvidence('BSB')).toContain('CONTENT_RIGHTS.md');
  });

  it('exposes one fail-closed predicate per use', () => {
    expect(canDisplay('BSB')).toBe(true);
    expect(canDisplay('nope')).toBe(false);
    expect(canStoreOffline('BSB')).toBe(true);
    expect(canStoreOffline('tam_irv')).toBe(false);
    expect(canStoreOffline('nope')).toBe(false);
    expect(canSearch('tel_irv')).toBe(true);
    expect(canSearch('nope')).toBe(false);
    expect(canShareImage('BSB')).toBe(false);
    expect(canShare('BSB')).toBe(true);
    expect(canShare('nope')).toBe(false);
  });
});

describe('rights enforcement points', () => {
  it('refuses to select display-denied translations', () => {
    expect(selectTranslationId('BSB')).toBe(true);
    expect(selectTranslationId('tam_irv')).toBe(true);
    expect(selectTranslationId('no-such-translation')).toBe(false);
    expect(selectTranslationId('BSB')).toBe(true);
  });

  it('reads denied translations as no search hits', () => {
    expect(searchVerseText('grace', 'no-such-translation', 10)).toEqual([]);
    // Allowed translations still search (behavior unchanged).
    expect(searchVerseText('grace', 'BSB', 5).length).toBeGreaterThan(0);
  });

  it('keeps offline-denied translations off SQLite without touching the database', async () => {
    const openDatabase = jest.fn(async () => {
      throw new Error('must not be called');
    });
    const result = await initializePassageContent(
      {
        openDatabase,
        projectChapter: async () => ({
          installed: true,
          checksum: 'sha256:0',
          units: 0,
          verses: 0,
          headings: 0,
        }),
        hashText: async () => 'sha256:0',
        getBundledChapter: () => null,
        createRepository: () => {
          throw new Error('must not be called');
        },
      },
      'tam_irv',
    );
    expect(result).toBe('bundled-json');
    expect(openDatabase).not.toHaveBeenCalled();
  });

  it('leaves composer download disabled and share enabled for BSB', () => {
    const onShare = jest.fn();
    render(<ComposerSheet visible onClose={jest.fn()} onShare={onShare} />);
    expect(screen.getByTestId('composer-download').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByTestId('composer-share').props.accessibilityState).toMatchObject({
      disabled: false,
    });
    fireEvent.press(screen.getByTestId('composer-share'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
