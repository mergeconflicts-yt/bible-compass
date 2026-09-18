/**
 * Bundled Scripture asset gate (finding 1).
 *
 * The asset builder once discarded every nested content object, shipping
 * 7,503 empty BSB verses (6,218 Tamil, 7,406 Telugu) — mostly poetry.
 * This suite scans the committed per-book files directly (no Metro, no
 * native modules) and fails on any verse left without text, plus spot
 * checks that structured spans actually survived extraction.
 */

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

const ASSETS = ['bsb', 'tam_irv', 'tel_irv'];

function assetDir(asset: string): string {
  return join('assets', 'scripture', asset);
}

function loadBook(asset: string, file: string): AssetBook {
  return JSON.parse(readFileSync(join(assetDir(asset), file), 'utf-8')) as AssetBook;
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
      const books = readdirSync(assetDir(asset)).filter((file) => file.endsWith('.json'));
      expect(books).toHaveLength(66);
    }
  });

  it('leaves no verse without text in any bundled translation', () => {
    const empty: string[] = [];
    let total = 0;
    for (const asset of ASSETS) {
      for (const file of readdirSync(assetDir(asset))) {
        if (!file.endsWith('.json')) continue;
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

  it('keeps structured poetry spans as readable text', () => {
    // 1Chr 16:8 was the first empty verse found: two poem objects joined.
    expect(verseText('bsb', '1Chr', 16, 8)).toContain('make known His deeds');
    expect(verseText('bsb', 'Ps', 119, 1)).toContain('blameless');
    expect(verseText('tam_irv', 'Neh', 2, 4)).toContain('ராஜா');
  });
});
