/**
 * Reference-first search over the downloaded prototype index.
 * Pure logic (no UI): empty query restores recents + entities, a matching
 * query narrows to reference hits and person hits, anything else is empty.
 * Mirrors the demo's matching rules; the licensed local index lands later.
 */
export interface SearchVisibility {
  showReferenceHit: boolean;
  showRecents: boolean;
  showEntities: boolean;
  showEmpty: boolean;
}

const REFERENCE_PATTERN = /neh|^2\b|2\s*:/;
const PERSON_PATTERN = /artaxerxes/;

export function searchDemoVisibility(rawQuery: string): SearchVisibility {
  const query = rawQuery.trim().toLowerCase();
  if (query === '') {
    return { showReferenceHit: false, showRecents: true, showEntities: true, showEmpty: false };
  }
  const referenceHit = REFERENCE_PATTERN.test(query);
  const personHit = PERSON_PATTERN.test(query);
  return {
    showReferenceHit: referenceHit,
    showRecents: false,
    showEntities: personHit,
    showEmpty: !referenceHit && !personHit,
  };
}
