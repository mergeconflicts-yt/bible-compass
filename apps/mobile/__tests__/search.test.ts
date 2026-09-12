import { searchDemoVisibility } from '@/lib/search';

describe('searchDemoVisibility', () => {
  it('restores recents and entities on an empty query', () => {
    expect(searchDemoVisibility('')).toEqual({
      showReferenceHit: false,
      showRecents: true,
      showEntities: true,
      showEmpty: false,
    });
  });

  it.each(['neh 2', 'Neh', '2:4'])('matches the reference hit for %p', (query) => {
    const visibility = searchDemoVisibility(query);
    expect(visibility.showReferenceHit).toBe(true);
    expect(visibility.showRecents).toBe(false);
    expect(visibility.showEmpty).toBe(false);
  });

  it('matches the person hit for artaxerxes', () => {
    const visibility = searchDemoVisibility('Artaxerxes');
    expect(visibility.showEntities).toBe(true);
    expect(visibility.showReferenceHit).toBe(false);
    expect(visibility.showEmpty).toBe(false);
  });

  it('explains anything else with the empty state', () => {
    expect(searchDemoVisibility('zzz')).toEqual({
      showReferenceHit: false,
      showRecents: false,
      showEntities: false,
      showEmpty: true,
    });
  });
});
