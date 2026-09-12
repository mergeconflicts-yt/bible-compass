import { activeTranslation, getChapter, getVerseText } from '@/content/bsb';
import { BOOKS, bookByOsis, booksByTestament } from '@/content/books';
import { NEH2_ANCHOR_PHRASE } from '@/components/ReaderView';
import { dailyVerseFixture } from '@/fixtures/home';
import { dailyVerseText } from '@/fixtures/demo';

describe('book registry', () => {
  it('lists all 66 books across both testaments', () => {
    expect(BOOKS).toHaveLength(66);
    expect(booksByTestament('OT')).toHaveLength(39);
    expect(booksByTestament('NT')).toHaveLength(27);
    expect(bookByOsis('Neh')?.name).toBe('Nehemiah');
    expect(bookByOsis('Neh')?.chapters).toBe(13);
    expect(bookByOsis('Ps')?.chapters).toBe(150);
    expect(bookByOsis('Xyz')).toBeNull();
  });
});

describe('bundled BSB chapters', () => {
  it('loads Nehemiah 2 with headings and all 20 verses', () => {
    const chapter = getChapter('Neh', 2);
    expect(chapter?.bookName).toBe('Nehemiah');
    expect(chapter?.verseCount).toBe(20);
    expect(chapter?.blocks.filter((block) => block.kind === 'heading')).toHaveLength(2);
  });

  it('keeps the daily verse identical across every surface', () => {
    expect(getVerseText('Neh', 2, 4)).toBe(dailyVerseText);
    expect(getVerseText('Neh', 2, 4)).toBe(dailyVerseFixture.text);
  });

  it('contains the validated companion anchor phrase in Nehemiah 2:1', () => {
    expect(getVerseText('Neh', 2, 1)).toContain(NEH2_ANCHOR_PHRASE);
  });

  it('returns null outside the bundled build instead of guessing', () => {
    expect(getChapter('Xyz', 1)).toBeNull();
    expect(getChapter('Neh', 99)).toBeNull();
    expect(getVerseText('Neh', 2, 99)).toBeNull();
  });

  it('identifies the active translation on every surface from one record', () => {
    expect(activeTranslation.id).toBe('BSB');
    expect(activeTranslation.short).toBe('BSB');
    expect(activeTranslation.attribution).toContain('BSB');
    expect(activeTranslation.licenseUrl).toContain('berean.bible');
  });
});
