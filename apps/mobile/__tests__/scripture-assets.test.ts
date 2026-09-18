/**
 * Bundled Scripture whole-corpus integrity gate (finding 1 follow-through).
 *
 * The asset builder once discarded every nested content object, shipping
 * 7,503 empty BSB verses (6,218 Tamil, 7,406 Telugu) — mostly poetry.
 * This suite scans the committed per-book files directly (no Metro, no
 * native modules) and fails on any silent content loss or structural
 * drift: empty verses/headings, broken numbering, chapters without
 * verses, or committed assets disagreeing with the generated registries.
 * No curation or feature work lands while this gate is red.
 */

import { BOOKS } from '../src/content/books';
import { BOOKS_TA } from '../src/content/books_ta';
import { BOOKS_TE } from '../src/content/books_te';

declare const require: (path: string) => unknown;

const { readdirSync, readFileSync } = require('fs') as {
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: string) => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

interface AssetBlock {
  t?: string;
  n?: number;
  text?: string;
}

interface AssetChapter {
  n?: number;
  blocks?: AssetBlock[];
}

interface AssetBook {
  osis?: string;
  chapters?: AssetChapter[];
}

const ASSETS = ['bsb', 'tam_irv', 'tel_irv'] as const;

const REGISTRIES = {
  bsb: BOOKS,
  tam_irv: BOOKS_TA,
  tel_irv: BOOKS_TE,
} as const;

function assetDir(asset: string): string {
  return join('assets', 'scripture', asset);
}

function loadBook(asset: string, file: string): AssetBook {
  return JSON.parse(readFileSync(join(assetDir(asset), file), 'utf-8')) as AssetBook;
}

function bookFiles(asset: string): string[] {
  return readdirSync(assetDir(asset))
    .filter((file) => file.endsWith('.json'))
    .sort();
}

function verseText(asset: string, osis: string, chapter: number, verse: number): string | null {
  const files = readdirSync(assetDir(asset)).filter((file) =>
    file.toLowerCase().startsWith(osis.toLowerCase()),
  );
  if (files.length === 0) return null;
  const book = loadBook(asset, files[0] as string);
  const foundChapter = book.chapters?.find((entry) => entry.n === chapter);
  const block = foundChapter?.blocks?.find((entry) => entry.t === 'v' && entry.n === verse);
  return block?.text ?? null;
}

describe('bundled scripture assets', () => {
  it('ships 66 books per translation', () => {
    for (const asset of ASSETS) {
      expect(bookFiles(asset)).toHaveLength(66);
    }
  });

  it('leaves no verse without text in any bundled translation', () => {
    const empty: string[] = [];
    let total = 0;
    for (const asset of ASSETS) {
      for (const file of bookFiles(asset)) {
        const book = loadBook(asset, file);
        for (const chapter of book.chapters ?? []) {
          for (const block of chapter.blocks ?? []) {
            if (block.t !== 'v') continue;
            total += 1;
            if (!block.text || block.text.trim().length === 0) {
              empty.push(`${asset} ${book.osis} ${chapter.n}:${block.n}`);
            }
          }
        }
      }
    }
    expect(total).toBeGreaterThan(90000);
    expect(empty).toEqual([]);
  });

  it('leaves no heading without text in any bundled translation', () => {
    const empty: string[] = [];
    for (const asset of ASSETS) {
      for (const file of bookFiles(asset)) {
        const book = loadBook(asset, file);
        for (const chapter of book.chapters ?? []) {
          for (const block of chapter.blocks ?? []) {
            if (block.t !== 'h') continue;
            if (!block.text || block.text.trim().length === 0) {
              empty.push(`${asset} ${book.osis} ${chapter.n}:heading`);
            }
          }
        }
      }
    }
    expect(empty).toEqual([]);
  });

  it('keeps chapters contiguous, verses uniquely ordered, and every chapter non-empty', () => {
    const problems: string[] = [];
    for (const asset of ASSETS) {
      for (const file of bookFiles(asset)) {
        const book = loadBook(asset, file);
        const numbers = (book.chapters ?? []).map((chapter) => chapter.n ?? -1);
        numbers.forEach((number, index) => {
          if (number !== index + 1) {
            problems.push(`${asset} ${book.osis}: chapter ${number} at position ${index + 1}`);
          }
        });
        for (const chapter of book.chapters ?? []) {
          const verses = (chapter.blocks ?? [])
            .filter((block) => block.t === 'v')
            .map((block) => block.n ?? -1);
          if (verses.length === 0) {
            problems.push(`${asset} ${book.osis} ${chapter.n}: no verses`);
          }
          const ordered = [...verses].sort((a, b) => a - b);
          if (verses.some((value, index) => value !== ordered[index])) {
            problems.push(`${asset} ${book.osis} ${chapter.n}: verses out of order`);
          }
          if (new Set(verses).size !== verses.length) {
            problems.push(`${asset} ${book.osis} ${chapter.n}: duplicate verses`);
          }
          for (const block of chapter.blocks ?? []) {
            if (block.t !== 'v' && block.t !== 'h') {
              problems.push(`${asset} ${book.osis} ${chapter.n}: unknown block kind`);
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('matches the generated registries book-for-book and chapter-for-chapter', () => {
    for (const asset of ASSETS) {
      const registry = REGISTRIES[asset];
      const files = bookFiles(asset);
      expect(files).toHaveLength(registry.length);
      for (const record of registry) {
        const book = loadBook(asset, `${record.osis}.json`);
        expect(book.osis).toBe(record.osis);
        expect(book.chapters).toHaveLength(record.chapters);
      }
    }
    const sets = ASSETS.map((asset) => new Set(bookFiles(asset).map((file) => file.toLowerCase())));
    expect([...(sets[0] as Set<string>)]).toEqual([...(sets[1] as Set<string>)]);
    expect([...(sets[0] as Set<string>)]).toEqual([...(sets[2] as Set<string>)]);
  });

  it('keeps structured poetry spans as readable text', () => {
    // 1Chr 16:8 was the first empty verse found: two poem objects joined.
    expect(verseText('bsb', '1Chr', 16, 8)).toContain('make known His deeds');
    expect(verseText('bsb', 'Ps', 119, 1)).toContain('blameless');
    expect(verseText('tam_irv', 'Neh', 2, 4)).toContain('ராஜா');
  });
});
