export type DomainErrorCode =
  | 'empty'
  | 'format'
  | 'reversed'
  | 'unsupported-book'
  | 'unsupported-reference-system'
  | 'mismatched-refsys-edition'
  | 'unmapped'
  | 'ambiguous-scope'
  | 'invalid-unicode'
  | 'invalid-canon'
  | 'invalid-work'
  | 'invalid-scope'
  | 'invalid-translation-work'
  | 'invalid-translation-edition'
  | 'invalid-source'
  | 'invalid-source-release'
  | 'invalid-candidate';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
