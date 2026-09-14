import {
  TRANSLATION_ORDER,
  bookNameFor,
  booksFor,
  getActiveTranslation,
  getChapter,
  getVerseText,
  isIndicTranslation,
  rangeLabel,
  selectTranslationId,
  selectedTranslationId,
  translationById,
  verseLabel,
} from '@/content/bsb';
import { BOOKS, bookByOsis, booksByTestament } from '@/content/books';
import { NEH2_ANCHOR_PHRASE } from '@/components/ReaderView';
import { buildDailyVerseFixture } from '@/fixtures/home';
import { dailyVerseTextFor } from '@/fixtures/demo';

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
    expect(getVerseText('Neh', 2, 4)).toBe(dailyVerseTextFor('BSB'));
    expect(getVerseText('Neh', 2, 4)).toBe(buildDailyVerseFixture('BSB').text);
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
    expect(getActiveTranslation().id).toBe('BSB');
    expect(getActiveTranslation().short).toBe('BSB');
    expect(getActiveTranslation().attribution).toContain('BSB');
    expect(getActiveTranslation().licenseUrl).toContain('berean.bible');
  });
});

describe('bundled translations', () => {
  afterEach(() => {
    selectTranslationId('BSB');
  });

  it('ships English, Tamil and Telugu in display order', () => {
    expect([...TRANSLATION_ORDER]).toEqual(['BSB', 'tam_irv', 'tel_irv']);
    expect(translationById('tam_irv')?.language).toBe('ta');
    expect(translationById('tel_irv')?.language).toBe('te');
    expect(translationById('xx')).toBeNull();
  });

  it('fails closed on unknown translations', () => {
    expect(selectTranslationId('xx')).toBe(false);
    expect(selectedTranslationId()).toBe('BSB');
    expect(selectTranslationId('tam_irv')).toBe(true);
    expect(selectedTranslationId()).toBe('tam_irv');
    expect(getActiveTranslation().short).toBe('IRV-TA');
  });

  it('loads Tamil Nehemiah 2 with a localized book name', () => {
    const chapter = getChapter('Neh', 2, 'tam_irv');
    expect(chapter?.bookName).toBe('நெகேமியா');
    expect(chapter?.verseCount).toBe(20);
    const text = getVerseText('Neh', 2, 4, 'tam_irv');
    expect(text).toBeTruthy();
    expect(text).not.toContain('What is your request');
    expect(buildDailyVerseFixture('tam_irv').translationShort).toBe('IRV-TA');
  });

  it('loads Telugu Nehemiah 2', () => {
    const chapter = getChapter('Neh', 2, 'tel_irv');
    expect(chapter?.bookName).toBe('నెహెమ్యా');
    expect(chapter?.verseCount).toBe(20);
    expect(getVerseText('Neh', 2, 1, 'tel_irv')).toBeTruthy();
  });

  it('returns null for unknown translations instead of guessing', () => {
    expect(getChapter('Neh', 2, 'xx')).toBeNull();
    expect(getVerseText('Neh', 2, 4, 'xx')).toBeNull();
  });

  it('marks only Tamil and Telugu for the Indic reading scale', () => {
    expect(isIndicTranslation('BSB')).toBe(false);
    expect(isIndicTranslation('tam_irv')).toBe(true);
    expect(isIndicTranslation('tel_irv')).toBe(true);
    expect(isIndicTranslation('xx')).toBe(false);
  });

  it('localizes the book registry and testament labels per translation', () => {    expect(booksFor('BSB')).toHaveLength(66);
    expect(booksFor('tam_irv')).toHaveLength(66);
    expect(booksFor('tel_irv')).toHaveLength(66);
    expect(booksFor('tam_irv').find((book) => book.osis === 'Neh')?.name).toBe('நெகேமியா');
    expect(booksFor('tel_irv').find((book) => book.osis === 'Neh')?.name).toBe('నెహెమ్యా');
    expect(booksFor('xx')).toHaveLength(66);
    expect(translationById('tam_irv')?.testaments).toEqual(['பழைய ஏற்பாடு', 'புதிய ஏற்பாடு']);
    expect(translationById('tel_irv')?.testaments).toEqual(['పాత నిబంధన', 'క్రొత్త నిబంధన']);
  });

  it('labels books, verses and ranges in the translation language', () => {
    expect(bookNameFor('Neh', 'BSB')).toBe('Nehemiah');
    expect(bookNameFor('Neh', 'tam_irv')).toBe('நெகேமியா');
    expect(bookNameFor('Neh', 'tel_irv')).toBe('నెహెమ్యా');
    expect(bookNameFor('Xyz', 'tam_irv')).toBe('Xyz');
    expect(verseLabel('Neh', 2, 4, 'BSB')).toBe('Nehemiah 2:4');
    expect(verseLabel('Neh', 2, 4, 'tam_irv')).toBe('நெகேமியா 2:4');
    expect(rangeLabel('Neh', 2, 1, 8, 'BSB')).toBe('Nehemiah 2:1–8');
    expect(rangeLabel('Ezra', 4, 23, 'tel_irv')).toBe('ఎజ్రా 4:23');
  });
});
