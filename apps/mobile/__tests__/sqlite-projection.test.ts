/**
 * SQLite projection tests (mobile-install-02).
 *
 * Part A runs against a recording fake (statement shapes, ordering,
 * idempotency, atomicity, validation). Part B runs the same projection
 * against a real SQLite engine (`node:sqlite`, available under Node 22
 * with --experimental-sqlite, wired via the `test` script); it skips
 * loudly where the engine is unavailable instead of passing vacuously.
 */

import {
  chapterLocalKey,
  ordinalFor,
  projectChapter,
  verseLocalKey,
  workKeyFor,
  type ChapterInput,
  type ProjectionOptions,
} from '../src/infrastructure/sqlite/projection';
import {
  MigrationError,
  type HashSql,
  type SqliteExecutor,
} from '../src/infrastructure/sqlite/types';
import { LEDGER_SQL } from '../src/infrastructure/sqlite/runner';
import { MIGRATIONS } from '../src/infrastructure/sqlite/migrations';
import type { ChapterBlock } from '../src/content/bsb';
import { toChapterInput } from '../src/content/passageStore';
import { SqlitePassageRepository } from '../src/infrastructure/sqlite/passageRepository';

declare const require: (path: string) => unknown;

interface NodeCrypto {
  createHash: (algorithm: string) => {
    update: (data: string, encoding: string) => { digest: (encoding: string) => string };
  };
}

interface NodeSqliteStatement {
  all<T>(...params: Array<string | number>): T[];
  run(...params: Array<string | number>): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
}

interface NodeSqliteDatabase {
  exec(source: string): void;
  prepare(source: string): NodeSqliteStatement;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (path: ':memory:' | string) => NodeSqliteDatabase;
}

const OPTIONS: ProjectionOptions = {
  editionKey: 'edition:bsb@20260912:sha-b2898c49',
  refsys: 'refsys:eng-v22',
  installationId: 'en.bsb.neh-2@1',
  contentKey: 'en.bsb.neh-2',
  contentVersion: 1,
};

function chapterFixture(): ChapterInput {
  return {
    bookOsis: 'Neh',
    chapter: 2,
    verses: [
      { number: 1, text: 'First verse text.' },
      { number: 2, text: 'Second verse text.' },
      { number: 3, text: 'Third verse text.' },
    ],
  };
}

/** Deterministic format-valid digest (NOT SHA-256; see note below). */
const hashText: HashSql = async (text: string): Promise<string> => {
  let out = '';
  let seed = 7;
  let material = text;
  while (out.length < 64) {
    let hash = 2166136261 ^ seed;
    for (let index = 0; index < material.length; index += 1) {
      hash ^= material.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    seed += 1;
    out += (hash >>> 0).toString(16).padStart(8, '0');
    material = `${out}${seed}`;
  }
  return `sha256:${out.slice(0, 64)}`;
};

class RecordingExecutor implements SqliteExecutor {
  execCalls: string[] = [];
  runCalls: Array<{ sql: string; params: Array<string | number> }> = [];
  installations: Array<{ id: string; checksum: string; status: string }> = [];
  failOnRunContaining: string | null = null;

  async execAsync(source: string): Promise<void> {
    this.execCalls.push(source);
  }

  async runAsync(
    source: string,
    params: Array<string | number> = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    if (this.failOnRunContaining && source.includes(this.failOnRunContaining)) {
      throw new Error(`fake run failure on ${this.failOnRunContaining}`);
    }
    this.runCalls.push({ sql: source, params });
    return { lastInsertRowId: this.runCalls.length, changes: 1 };
  }

  async getAllAsync<T>(source: string): Promise<T[]> {
    if (source.includes('FROM content_installations')) {
      return [...this.installations] as unknown as T[];
    }
    throw new Error(`fake cannot answer read: ${source}`);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const snapshot = {
      execCalls: [...this.execCalls],
      runCalls: [...this.runCalls],
      installations: [...this.installations],
    };
    try {
      await task();
    } catch (error) {
      this.execCalls = snapshot.execCalls;
      this.runCalls = snapshot.runCalls;
      this.installations = snapshot.installations;
      throw error;
    }
  }
}

function insertsOf(
  fake: RecordingExecutor,
  table: string,
): Array<{ sql: string; params: Array<string | number> }> {
  return fake.runCalls.filter((call) => call.sql.startsWith(`INSERT INTO ${table}`));
}

describe('sqlite projection units', () => {
  it('projects a chapter: chapter unit first, then verse units and verses, then a healthy ledger row', async () => {
    const fake = new RecordingExecutor();
    const result = await projectChapter(fake, chapterFixture(), OPTIONS, hashText);
    expect(result.installed).toBe(true);
    expect(result.units).toBe(4);
    expect(result.verses).toBe(3);
    expect(result.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);

    const unitInserts = insertsOf(fake, 'reference_units');
    expect(unitInserts).toHaveLength(4);
    expect(unitInserts[0]?.params.slice(0, 2)).toEqual(['refsys:eng-v22', 'Neh.2']);
    expect(unitInserts[0]?.params[5]).toBe('chapter');
    const verseInserts = insertsOf(fake, 'verses');
    expect(verseInserts).toHaveLength(3);
    expect(verseInserts[0]?.params.slice(0, 7)).toEqual([
      'edition:bsb@20260912:sha-b2898c49',
      'refsys:eng-v22',
      'Neh.2.1',
      'Neh',
      2,
      1,
      'First verse text.',
    ]);
    // Units land before any verse so the foreign key holds throughout.
    const firstUnitAt = fake.runCalls.findIndex((call) =>
      call.sql.startsWith('INSERT INTO reference_units'),
    );
    const firstVerseAt = fake.runCalls.findIndex((call) =>
      call.sql.startsWith('INSERT INTO verses'),
    );
    expect(firstUnitAt).toBeGreaterThanOrEqual(0);
    expect(firstVerseAt).toBeGreaterThan(firstUnitAt);
    // Bound parameters only: verse text never interpolates into SQL.
    expect(fake.runCalls.every((call) => !call.sql.includes('First verse text.'))).toBe(true);
    const ledgerWrites = insertsOf(fake, 'content_installations');
    expect(ledgerWrites).toHaveLength(1);
    expect(ledgerWrites[0]?.params).toContain('healthy');
  });

  it('skips a healthy snapshot with a matching checksum without writing', async () => {
    const fake = new RecordingExecutor();
    const first = await projectChapter(fake, chapterFixture(), OPTIONS, hashText);
    const writesAfterFirst = fake.runCalls.length;
    fake.installations.push({
      id: OPTIONS.installationId,
      checksum: first.checksum,
      status: 'healthy',
    });
    const second = await projectChapter(fake, chapterFixture(), OPTIONS, hashText);
    expect(second.installed).toBe(false);
    expect(second.checksum).toBe(first.checksum);
    expect(fake.runCalls).toHaveLength(writesAfterFirst);
  });

  it('reinstalls when content changes and retires the old checksum', async () => {
    const fake = new RecordingExecutor();
    const first = await projectChapter(fake, chapterFixture(), OPTIONS, hashText);
    fake.installations.push({
      id: OPTIONS.installationId,
      checksum: first.checksum,
      status: 'healthy',
    });
    const changed = chapterFixture();
    changed.verses[0] = { number: 1, text: 'Edited first verse text.' };
    const second = await projectChapter(fake, changed, OPTIONS, hashText);
    expect(second.installed).toBe(true);
    expect(second.checksum).not.toBe(first.checksum);
    const deletes = fake.runCalls.filter((call) => call.sql.startsWith('DELETE FROM'));
    expect(deletes.length).toBeGreaterThanOrEqual(2);
    const ledgerWrites = insertsOf(fake, 'content_installations');
    expect(ledgerWrites[ledgerWrites.length - 1]?.params).toContain(second.checksum);
  });

  it('rolls back a failed install, preserving the previous healthy snapshot', async () => {
    const fake = new RecordingExecutor();
    const first = await projectChapter(fake, chapterFixture(), OPTIONS, hashText);
    fake.installations.push({
      id: OPTIONS.installationId,
      checksum: first.checksum,
      status: 'healthy',
    });
    const changed = chapterFixture();
    changed.verses[0] = { number: 1, text: 'Edited first verse text.' };
    fake.failOnRunContaining = 'INSERT INTO verses';
    await expect(projectChapter(fake, changed, OPTIONS, hashText)).rejects.toBeInstanceOf(
      MigrationError,
    );
    expect(fake.installations).toEqual([
      { id: OPTIONS.installationId, checksum: first.checksum, status: 'healthy' },
    ]);
  });

  it('rejects empty, duplicate, and malformed input without writing', async () => {
    for (const bad of [
      { ...chapterFixture(), verses: [] },
      {
        ...chapterFixture(),
        verses: [
          { number: 1, text: 'a' },
          { number: 1, text: 'b' },
        ],
      },
      { ...chapterFixture(), verses: [{ number: 0, text: 'a' }] },
      { ...chapterFixture(), verses: [{ number: 1, text: '   ' }] },
      { ...chapterFixture(), bookOsis: '' },
      { ...chapterFixture(), chapter: 0 },
    ]) {
      const fake = new RecordingExecutor();
      await expect(projectChapter(fake, bad, OPTIONS, hashText)).rejects.toMatchObject({
        code: 'invalid-input',
      });
      expect(fake.runCalls).toHaveLength(0);
    }
  });

  it('rejects a text hasher that does not return sha256 hex', async () => {
    const fake = new RecordingExecutor();
    const bogus: HashSql = async () => 'bogus';
    await expect(projectChapter(fake, chapterFixture(), OPTIONS, bogus)).rejects.toMatchObject({
      code: 'invalid-hash',
    });
    expect(fake.runCalls).toHaveLength(0);
  });

  it('builds canonical keys and ordinals', () => {
    expect(workKeyFor('Neh')).toBe('work:Neh:prot-66');
    expect(chapterLocalKey('Neh', 2)).toBe('Neh.2');
    expect(verseLocalKey('Neh', 2, 4)).toBe('Neh.2.4');
    expect(ordinalFor(2, 0)).toBeLessThan(ordinalFor(2, 1));
    expect(ordinalFor(2, 20)).toBeLessThan(ordinalFor(3, 1));
  });

  it('projects headings with positions and folds them into the checksum', async () => {
    const fake = new RecordingExecutor();
    const input = {
      ...chapterFixture(),
      headings: [
        { afterVerse: 0, text: 'Top.' },
        { afterVerse: 2, text: 'Mid.' },
      ],
    };
    const result = await projectChapter(fake, input, OPTIONS, hashText);
    expect(result.headings).toBe(2);
    const headingInserts = fake.runCalls.filter((call) =>
      call.sql.startsWith('INSERT INTO headings'),
    );
    expect(headingInserts).toHaveLength(2);
    expect(headingInserts[0]?.params).toEqual(['refsys:eng-v22', 'Neh.2', 0, 'Top.']);
    const plain = await projectChapter(
      new RecordingExecutor(),
      chapterFixture(),
      OPTIONS,
      hashText,
    );
    expect(result.checksum).not.toBe(plain.checksum);
  });

  it('rejects malformed headings without writing', async () => {
    for (const headings of [[{ afterVerse: -1, text: 'x' }], [{ afterVerse: 1, text: '   ' }]]) {
      const fake = new RecordingExecutor();
      await expect(
        projectChapter(fake, { ...chapterFixture(), headings }, OPTIONS, hashText),
      ).rejects.toMatchObject({ code: 'invalid-input' });
      expect(fake.runCalls).toHaveLength(0);
    }
  });
});

function loadNodeSqlite(): NodeSqliteModule | null {
  try {
    return require('node:sqlite') as NodeSqliteModule;
  } catch {
    return null;
  }
}

const nodeSqlite = loadNodeSqlite();

(nodeSqlite ? describe : describe.skip)('sqlite projection on a real engine (node:sqlite)', () => {
  it('installs the real Nehemiah 2 chapter end to end with enforced foreign keys', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const Neh = require('../assets/scripture/bsb/Neh.json') as {
      chapters: Array<{ n: number; blocks: Array<{ t: string; n?: number; text: string }> }>;
    };
    const chapter = Neh.chapters.find((item) => item.n === 2);
    if (!chapter) throw new Error('Neh.2 missing from bundled asset');
    const input: ChapterInput = {
      bookOsis: 'Neh',
      chapter: 2,
      verses: chapter.blocks
        .filter((block) => block.t === 'v' && typeof block.n === 'number')
        .map((block) => ({ number: block.n as number, text: block.text })),
    };
    expect(input.verses).toHaveLength(20);

    const raw = new nodeSqlite.DatabaseSync(':memory:');
    raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    const plug: SqliteExecutor = {
      execAsync: async (source: string): Promise<void> => {
        raw.exec(source);
      },
      runAsync: async (source: string, params: Array<string | number> = []) => {
        const result = raw.prepare(source).run(...params);
        return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
      },
      getAllAsync: async <T>(source: string, params: Array<string | number> = []): Promise<T[]> =>
        raw.prepare(source).all<T>(...params),
      withTransactionAsync: async (task: () => Promise<void>): Promise<void> => {
        raw.exec('BEGIN IMMEDIATE;');
        try {
          await task();
          raw.exec('COMMIT;');
        } catch (error) {
          try {
            raw.exec('ROLLBACK;');
          } catch {
            // Already rolled back; surface the original failure.
          }
          throw error;
        }
      },
    };

    await plug.execAsync(LEDGER_SQL);
    for (const migration of MIGRATIONS) {
      await plug.execAsync(migration.sql);
    }
    const nodeCrypto = require('crypto') as NodeCrypto;
    const nodeHash: HashSql = async (text: string) =>
      `sha256:${nodeCrypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;

    const result = await projectChapter(plug, input, OPTIONS, nodeHash);
    expect(result.installed).toBe(true);
    expect(result.units).toBe(21);
    expect(result.verses).toBe(20);

    const rows = await plug.getAllAsync<{ local_key: string; text: string }>(
      'SELECT v.local_key, v.text FROM verses v JOIN reference_units u ON v.refsys = u.refsys AND v.local_key = u.local_key WHERE v.edition_key = ? AND v.book = ? AND v.chapter = ? ORDER BY u.ordinal ASC',
      [OPTIONS.editionKey, 'Neh', 2],
    );
    expect(rows).toHaveLength(20);
    expect(rows[0]).toMatchObject({ local_key: 'Neh.2.1' });
    expect(rows[19]).toMatchObject({ local_key: 'Neh.2.20' });

    const rerun = await projectChapter(plug, input, OPTIONS, nodeHash);
    expect(rerun.installed).toBe(false);

    const orphans = await plug.getAllAsync<unknown>(
      'SELECT v.local_key FROM verses v LEFT JOIN reference_units u ON v.refsys = u.refsys AND v.local_key = u.local_key WHERE u.local_key IS NULL',
    );
    expect(orphans).toHaveLength(0);
    raw.close();
  });

  it('round-trips headings through projection and repository reads', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const Neh = require('../assets/scripture/bsb/Neh.json') as {
      chapters: Array<{ n: number; blocks: Array<{ t: string; n?: number; text: string }> }>;
    };
    const chapter = Neh.chapters.find((item) => item.n === 2);
    if (!chapter) throw new Error('Neh.2 missing from bundled asset');
    const mapped = toChapterInput(
      chapter.blocks.flatMap((block): ChapterBlock[] => {
        if (block.t === 'h') return [{ kind: 'heading', text: block.text }];
        if (typeof block.n !== 'number') return [];
        return [{ kind: 'verse', number: block.n, text: block.text }];
      }),
    );
    expect(mapped.headings.length).toBeGreaterThan(0);
    const raw = new nodeSqlite.DatabaseSync(':memory:');
    raw.exec('PRAGMA foreign_keys = ON;');
    raw.exec(LEDGER_SQL);
    for (const migration of MIGRATIONS) {
      raw.exec(migration.sql);
    }
    const plug: SqliteExecutor = {
      execAsync: async (source: string): Promise<void> => {
        raw.exec(source);
      },
      runAsync: async (source: string, params: Array<string | number> = []) => {
        const result = raw.prepare(source).run(...params);
        return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
      },
      getAllAsync: async <T>(source: string, params: Array<string | number> = []): Promise<T[]> =>
        raw.prepare(source).all<T>(...params),
      withTransactionAsync: async (task: () => Promise<void>): Promise<void> => {
        raw.exec('BEGIN IMMEDIATE;');
        try {
          await task();
          raw.exec('COMMIT;');
        } catch (error) {
          try {
            raw.exec('ROLLBACK;');
          } catch {
            // Already rolled back; surface the original failure.
          }
          throw error;
        }
      },
    };
    const nodeCrypto = require('crypto') as NodeCrypto;
    const nodeHash: HashSql = async (text: string) =>
      `sha256:${nodeCrypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
    const result = await projectChapter(
      plug,
      { bookOsis: 'Neh', chapter: 2, verses: mapped.verses, headings: mapped.headings },
      OPTIONS,
      nodeHash,
    );
    expect(result.headings).toBe(mapped.headings.length);
    const repo = new SqlitePassageRepository(
      {
        getAllSync: <T>(source: string, params: (string | number)[]): T[] =>
          raw.prepare(source).all<T>(...params),
        getFirstSync: <T>(source: string, params: (string | number)[]): T | null =>
          raw.prepare(source).all<T>(...params)[0] ?? null,
      },
      OPTIONS.editionKey,
      OPTIONS.refsys,
    );
    const blocks = repo.getChapterBlocks('Neh', 2, 'BSB');
    expect(blocks).not.toBeNull();
    const expected: ChapterBlock[] = chapter.blocks.flatMap((block): ChapterBlock[] => {
      if (block.t === 'h') return [{ kind: 'heading', text: block.text }];
      if (typeof block.n !== 'number') return [];
      return [{ kind: 'verse', number: block.n, text: block.text }];
    });
    expect(blocks).toEqual(expected);
    raw.close();
  });

  it('rejects orphan verses when foreign keys are on', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const raw = new nodeSqlite.DatabaseSync(':memory:');
    raw.exec('PRAGMA foreign_keys = ON;');
    raw.exec(LEDGER_SQL);
    for (const migration of MIGRATIONS) {
      raw.exec(migration.sql);
    }
    expect(() =>
      raw
        .prepare(
          "INSERT INTO verses (edition_key, refsys, local_key, book, chapter, verse, text, text_sha256) VALUES ('e', 'refsys:eng-v22', 'Neh.9.9', 'Neh', 9, 9, 'ghost', 'sha256:00')",
        )
        .run(),
    ).toThrow();
    raw.close();
  });
});

if (!nodeSqlite) {
  // eslint-disable-next-line no-console
  console.warn(
    'SKIP: node:sqlite unavailable (needs Node 22 + --experimental-sqlite); real-engine projection tests skipped loudly.',
  );
}
