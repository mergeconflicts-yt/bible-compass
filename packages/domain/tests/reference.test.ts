import { parseQualifiedReference } from '../src/reference';
import { parseCanonKey, parseScopeKey } from '../src/canon';
import { DomainError } from '../src/errors';

describe('qualified reference', () => {
  it('parses Neh.2.4 with refsys eng-v22', () => {
    const r = parseQualifiedReference('Neh.2.4', 'refsys:eng-v22');
    expect(r.qualifiedKey).toBe('refsys:eng-v22:Neh.2.4');
  });
  it('rejects unknown refsys', () => {
    try {
      parseQualifiedReference('Neh.2.4', 'refsys:unknown' as any);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as DomainError).code).toBe('unsupported-reference-system');
    }
  });
  it('rejects mismatched edition refsys', () => {
    try {
      parseQualifiedReference('Neh.2.4', 'refsys:eng-v22', { editionRefsys: 'refsys:tel-v1' });
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as DomainError).code).toBe('mismatched-refsys-edition');
    }
  });
  it('rejects non-ASCII', () => {
    try {
      parseQualifiedReference('Neh．2.4', 'refsys:eng-v22');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as DomainError).code).toBe('invalid-unicode');
    }
  });
  it('rejects reversed', () => {
    try {
      parseQualifiedReference('Neh.2.8-Neh.2.1', 'refsys:eng-v22');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as DomainError).code).toBe('reversed');
    }
  });
});

describe('canon and scope', () => {
  it('accepts canon prot-66', () => {
    expect(parseCanonKey('canon:prot-66')).toBe('canon:prot-66');
  });
  it('rejects invalid canon', () => {
    try {
      parseCanonKey('canon:bad');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as DomainError).code).toBe('invalid-canon');
    }
  });
  it('accepts scope neh-2', () => {
    expect(parseScopeKey('scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20')).toBe(
      'scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20',
    );
  });
});
