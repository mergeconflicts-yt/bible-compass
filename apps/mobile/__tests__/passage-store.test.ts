/**
 * Passage store + SQLite repository contract tests (mobile-install-03).
 *
 * Store tests use stub repositories (no native modules). Adapter tests use
 * a hand-rolled sync reader that only answers the adapter's exact queries
 * and throws otherwise, proving the adapter issues no other reads.
 */

import { getChapter } from '../src/content/bsb';
import {
  BSB_TRANSLATION_ID,
  getPassageContent,
  initializePassageContent,
  resetPassageStore,
  setPassageBackend,
  setPassageRepository,
  toChapterInput,
  type PassageDbHandle,
  type PassageInitDeps,
} from '../src/content/passageStore';
import type { ChapterBlock, ChapterContent } from '../src/content/bsb';
import type { PassageRepository } from '../src/content/passageRepository';
import { SqlitePassageRepository } from '../src/infrastructure/sqlite/passageRepository';

function stubRepo(
  blocks: ChapterBlock[] | null,
  verseText: string | null = null,
): PassageRepository {
  return {
    getChapterBlocks: () => blocks,
    getVerseText: () => verseText,
    searchVerses: () => [],
  };
}

function throwingRepo(): PassageRepository {
  return {
    getChapterBlocks: () => {
      throw new Error('store unavailable');
    },
    getVerseText: () => {
      throw new Error('store unavailable');
    },
    searchVerses: () => {
      throw new Error('store unavailable');
    },
  };
}

function fakeDbHandle(): PassageDbHandle {
  return {
    execAsync: async () => {},
    runAsync: async () => ({ lastInsertRowId: 1, changes: 1 }),
    getAllAsync: async () => [],
    getAllSync: () => [],
    getFirstSync: () => null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      await task();
    },
  };
}

beforeEach(() => {
  resetPassageStore();
});

describe('passage store default', () => {
  it('returns JSON-equal content without native modules', () => {
    const expected = getChapter('Neh', 2, 'BSB');
    const actual = getPassageContent('Neh', 2, 'BSB');
    expect(actual).toEqual(expected);
  });

  it('returns null for unknown chapters in both paths', () => {
    expect(getPassageContent('Xyz', 1, 'BSB')).toBeNull();
  });
});

describe('passage store selection', () => {
  it('composes ChapterContent from repository blocks with localized names', () => {
    setPassageRepository(
      stubRepo([
        { kind: 'heading', text: 'Sent' },
        { kind: 'verse', number: 1, text: 'One.' },
      ]),
    );
    const content = getPassageContent('Neh', 2, 'BSB');
    expect(content).toMatchObject({
      bookOsis: 'Neh',
      bookName: 'Nehemiah',
      chapter: 2,
      verseCount: 1,
    });
    expect(content?.blocks).toHaveLength(2);
  });

  it('falls back to JSON when the repository throws', () => {
    setPassageRepository(throwingRepo());
    expect(getPassageContent('Neh', 2, 'BSB')).toEqual(getChapter('Neh', 2, 'BSB'));
  });

  it('falls back to JSON when the repository lacks the chapter', () => {
    setPassageRepository(stubRepo(null));
    expect(getPassageContent('Neh', 2, 'BSB')).toEqual(getChapter('Neh', 2, 'BSB'));
  });

  it('bundled-json backend ignores the repository entirely', () => {
    setPassageRepository(throwingRepo());
    setPassageBackend('bundled-json');
    expect(getPassageContent('Neh', 2, 'BSB')).toEqual(getChapter('Neh', 2, 'BSB'));
  });
});

describe('toChapterInput mapping', () => {
  it('anchors headings after the preceding verse with leading headings at zero', () => {
    const mapped = toChapterInput([
      { kind: 'heading', text: 'Top' },
      { kind: 'verse', number: 1, text: 'One.' },
      { kind: 'heading', text: 'Mid' },
      { kind: 'verse', number: 2, text: 'Two.' },
    ]);
    expect(mapped.verses).toHaveLength(2);
    expect(mapped.headings).toEqual([
      { afterVerse: 0, text: 'Top' },
      { afterVerse: 1, text: 'Mid' },
    ]);
  });
});

describe('initializePassageContent', () => {
  function chapterContent(chapter: number): ChapterContent {
    return {
      bookOsis: 'Neh',
      bookName: 'Nehemiah',
      chapter,
      blocks: [{ kind: 'verse', number: 1, text: `Verse ${chapter}.1.` }],
      verseCount: 1,
    };
  }

  function deps(overrides: Partial<PassageInitDeps> = {}): PassageInitDeps & {
    projected: Array<{ bookOsis: string; chapter: number }>;
  } {
    const projected: Array<{ bookOsis: string; chapter: number }> = [];
    return {
      openDatabase: async () => fakeDbHandle(),
      projectChapter: async (_db, input) => {
        projected.push({ bookOsis: input.bookOsis, chapter: input.chapter });
        return {
          installed: true,
          checksum: 'sha256:' + 'a'.repeat(64),
          units: 2,
          verses: 1,
          headings: 0,
        };
      },
      hashText: async () => 'sha256:' + 'b'.repeat(64),
      getBundledChapter: (bookOsis, chapter) => chapterContent(chapter),
      createRepository: () => stubRepo([{ kind: 'verse', number: 1, text: 'Cached.' }]),
      projected,
      ...overrides,
    };
  }

  it('projects Nehemiah, activates the repository, and reports ready', async () => {
    const d = deps();
    const status = await initializePassageContent(d);
    expect(status).toBe('ready');
    expect(d.projected).toHaveLength(13);
    expect(d.projected[0]).toEqual({ bookOsis: 'Neh', chapter: 1 });
    expect(getPassageContent('Neh', 2, BSB_TRANSLATION_ID)?.blocks).toEqual([
      { kind: 'verse', number: 1, text: 'Cached.' },
    ]);
  });

  it('keeps bundled JSON when the database cannot open', async () => {
    const d = deps({
      openDatabase: async () => {
        throw new Error('no native module');
      },
    });
    const status = await initializePassageContent(d);
    expect(status).toBe('bundled-json');
    expect(getPassageContent('Neh', 2, 'BSB')).toEqual(getChapter('Neh', 2, 'BSB'));
  });

  it('skips SQLite for translations without defined edition keys', async () => {
    const opened: string[] = [];
    const d = deps({
      openDatabase: async () => {
        opened.push('open');
        return fakeDbHandle();
      },
    });
    const status = await initializePassageContent(d, 'tam_irv');
    expect(status).toBe('bundled-json');
    expect(opened).toHaveLength(0);
  });

  it('isolates per-chapter failures without blocking the rest', async () => {
    const attempted: number[] = [];
    const d = deps({
      projectChapter: (async (_db, input) => {
        attempted.push(input.chapter);
        if (input.chapter === 2) throw new Error('bad chapter');
        return {
          installed: true,
          checksum: 'sha256:' + 'a'.repeat(64),
          units: 2,
          verses: 1,
          headings: 0,
        };
      }) as PassageInitDeps['projectChapter'],
    });
    const status = await initializePassageContent(d);
    expect(status).toBe('ready');
    expect(attempted).toContain(1);
    expect(attempted).toContain(3);
    expect(attempted).toHaveLength(13);
  });
});

describe('SqlitePassageRepository contract', () => {
  interface VerseRow {
    verse: number;
    text: string;
  }
  interface HeadingRow {
    position_verse: number;
    text: string;
  }

  function reader(
    verses: VerseRow[],
    headings: HeadingRow[],
    opts: { throwOnRead?: boolean } = {},
  ): {
    getAllSync<T>(source: string, params: (string | number)[]): T[];
    getFirstSync<T>(source: string, params: (string | number)[]): T | null;
  } {
    return {
      getAllSync<T>(source: string, params: (string | number)[]): T[] {
        if (opts.throwOnRead) throw new Error('store unavailable');
        if (source.includes('FROM headings')) {
          return headings
            .filter((row) => row && params[0] === 'refsys:eng-v22')
            .sort((a, b) => a.position_verse - b.position_verse)
            .map((row) => ({
              position_verse: row.position_verse,
              text: row.text,
            })) as unknown as T[];
        }
        if (source.includes('FROM verses')) {
          return verses.map((row) => ({ verse: row.verse, text: row.text })) as unknown as T[];
        }
        throw new Error(`unexpected read: ${source}`);
      },
      getFirstSync<T>(source: string, params: (string | number)[]): T | null {
        if (opts.throwOnRead) throw new Error('store unavailable');
        if (source.includes('FROM verses')) {
          const verse = params[params.length - 1] as number;
          const found = verses.find((row) => row.verse === verse);
          return (found ? { text: found.text } : null) as unknown as T | null;
        }
        throw new Error(`unexpected read: ${source}`);
      },
    };
  }

  const EDITION = 'edition:bsb@20260912:sha-b2898c49';
  const REFSYS = 'refsys:eng-v22';

  it('reconstructs blocks with headings interleaved, including trailing leftovers', () => {
    const repo = new SqlitePassageRepository(
      reader(
        [
          { verse: 1, text: 'One.' },
          { verse: 2, text: 'Two.' },
        ],
        [
          { position_verse: 0, text: 'Top' },
          { position_verse: 1, text: 'Mid' },
          { position_verse: 99, text: 'Trailing' },
        ],
      ),
      EDITION,
      REFSYS,
    );
    expect(repo.getChapterBlocks('Neh', 2, 'BSB')).toEqual([
      { kind: 'heading', text: 'Top' },
      { kind: 'verse', number: 1, text: 'One.' },
      { kind: 'heading', text: 'Mid' },
      { kind: 'verse', number: 2, text: 'Two.' },
      { kind: 'heading', text: 'Trailing' },
    ]);
  });

  it('returns null when no verses exist, regardless of headings', () => {
    const repo = new SqlitePassageRepository(
      reader([], [{ position_verse: 0, text: 'Orphan' }]),
      EDITION,
      REFSYS,
    );
    expect(repo.getChapterBlocks('Neh', 2, 'BSB')).toBeNull();
  });

  it('reads single verses and misses cleanly', () => {
    const repo = new SqlitePassageRepository(
      reader([{ verse: 4, text: 'Four.' }], []),
      EDITION,
      REFSYS,
    );
    expect(repo.getVerseText('Neh', 2, 4, 'BSB')).toBe('Four.');
    expect(repo.getVerseText('Neh', 2, 5, 'BSB')).toBeNull();
  });

  it('propagates driver errors so the store can fall back', () => {
    const repo = new SqlitePassageRepository(
      reader([], [], { throwOnRead: true }),
      EDITION,
      REFSYS,
    );
    expect(() => repo.getChapterBlocks('Neh', 2, 'BSB')).toThrow('store unavailable');
  });
});
