/**
 * Machine-enforced translation rights (finding 2).
 *
 * Every licensed use routes through this table: in-app display, offline
 * SQLite projection, local verse search, generated-image share/download,
 * and native text sharing. Unknown translations and unknown uses deny by
 * default (fail closed per docs/CONTENT_RIGHTS.md) — there is no
 * allow-by-default path.
 *
 * Flag values encode the owner-gated posture as built and gate-passed,
 * each with its evidence pointer; they assert nothing beyond it. The
 * CONTENT_RIGHTS.md permission-matrix signature is the only path to
 * relax a flag, and image download stays disabled until that signature
 * exists (explicit owner direction). Text sharing rides on display
 * authorization (user-initiated, no artifact generated).
 *
 * This module imports nothing: content, infrastructure, and components
 * all depend on it without layering risk.
 */

export interface TranslationRights {
  /** Render verses in reader, daily verse, cards, and settings. */
  display: boolean;
  /** Project chapters into the offline SQLite cache. */
  offline: boolean;
  /** Verse-text search over bundled or cached text (no separate index). */
  search: boolean;
  /** Generated verse-card images: share sheet and media download. */
  image: boolean;
  /** Native OS share of displayed verse text (no file generated). */
  share: boolean;
}

interface RightsEntry {
  rights: TranslationRights;
  /** Why these values: owner decision, built behavior, or pending matrix. */
  evidence: string;
}

const DENY_ALL: TranslationRights = {
  display: false,
  offline: false,
  search: false,
  image: false,
  share: false,
};

const TABLE: Record<string, RightsEntry> = {
  BSB: {
    rights: { display: true, offline: true, search: true, image: false, share: true },
    evidence:
      'Display: owner-confirmed berean.bible basis (CONTENT_RIGHTS.md 2026-09-12). ' +
      'Offline/search: built and gate-passed as M02/M06b with owner visibility. ' +
      'Image: explicitly fail-closed until the matrix is signed. ' +
      'Share: shipped composer/daily text share with no generated artifact.',
  },
  tam_irv: {
    rights: { display: true, offline: false, search: true, image: false, share: true },
    evidence:
      'Display: owner-confirmed same basis as BSB, ship-at-beta (CONTENT_RIGHTS.md 2026-09-13). ' +
      'Offline: never built (bundled-JSON only by construction) and matrix OPEN. ' +
      'Search: reads already-displayed bundled text, no separate index (M06b precedent). ' +
      'Image: fail-closed until the matrix is signed.',
  },
  tel_irv: {
    rights: { display: true, offline: false, search: true, image: false, share: true },
    evidence:
      'Display: owner-confirmed same basis as BSB, ship-at-beta (CONTENT_RIGHTS.md 2026-09-13). ' +
      'Offline: never built (bundled-JSON only by construction) and matrix OPEN. ' +
      'Search: reads already-displayed bundled text, no separate index (M06b precedent). ' +
      'Image: fail-closed until the matrix is signed.',
  },
};

/** Fail-closed rights lookup: unknown translations deny everything. */
export function rightsFor(translationId: string): TranslationRights {
  return TABLE[translationId]?.rights ?? DENY_ALL;
}

/** Evidence pointer for review surfaces; unknown translations report none. */
export function rightsEvidence(translationId: string): string | null {
  return TABLE[translationId]?.evidence ?? null;
}

export function canDisplay(translationId: string): boolean {
  return rightsFor(translationId).display;
}

export function canStoreOffline(translationId: string): boolean {
  return rightsFor(translationId).offline;
}

export function canSearch(translationId: string): boolean {
  return rightsFor(translationId).search;
}

export function canShareImage(translationId: string): boolean {
  return rightsFor(translationId).image;
}

export function canShare(translationId: string): boolean {
  return rightsFor(translationId).share;
}
