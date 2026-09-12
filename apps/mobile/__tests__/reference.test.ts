import { formatReference, parseReference, ReferenceParseError } from '@/lib/reference';

describe('parseReference', () => {
  it('parses a single verse with a stable canonical key', () => {
    expect(parseReference('Neh.2.4')).toEqual({
      kind: 'verse',
      start: { book: 'Neh', chapter: 2, verse: 4 },
      end: { book: 'Neh', chapter: 2, verse: 4 },
      canonicalKey: 'Neh.2.4',
    });
  });

  it('parses a passage range', () => {
    const parsed = parseReference('Neh.2.1-Neh.2.8');
    expect(parsed.kind).toBe('range');
    expect(parsed.canonicalKey).toBe('Neh.2.1-Neh.2.8');
  });

  it('rejects empty input with a typed error', () => {
    expect(() => parseReference('  ')).toThrow(ReferenceParseError);
    try {
      parseReference('');
    } catch (error) {
      expect(error).toBeInstanceOf(ReferenceParseError);
      expect((error as ReferenceParseError).code).toBe('empty');
    }
  });

  it('rejects malformed input with a typed error', () => {
    expect(() => parseReference('Nehemiah 2')).toThrow(ReferenceParseError);
    expect(() => parseReference('Neh.2.4-Neh.2.8-Neh.2.9')).toThrow(ReferenceParseError);
  });

  it('rejects reversed ranges', () => {
    try {
      parseReference('Neh.2.8-Neh.2.1');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ReferenceParseError);
      expect((error as ReferenceParseError).code).toBe('reversed');
    }
  });

  it('rejects books outside the landing slice', () => {
    try {
      parseReference('John.3.16');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ReferenceParseError);
      expect((error as ReferenceParseError).code).toBe('unsupported-book');
    }
  });
});

describe('formatReference', () => {
  it('labels a verse for display without leaking the key as identity', () => {
    expect(formatReference(parseReference('Neh.2.4'))).toBe('Nehemiah 2:4');
  });

  it('labels a same-chapter range', () => {
    expect(formatReference(parseReference('Neh.2.1-Neh.2.8'))).toBe('Nehemiah 2:1–8');
  });
});
