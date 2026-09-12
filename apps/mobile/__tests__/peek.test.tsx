import { fireEvent, render, screen } from '@testing-library/react-native';
import { PeekCard, placementForAnchor } from '@/components/PeekCard';

describe('PeekCard', () => {
  it('shows type, name, one passage sentence and Know more', () => {
    const onFullCard = jest.fn();
    render(<PeekCard slug="artaxerxes-i" onFullCard={onFullCard} />);
    expect(screen.getByTestId('peek-card-artaxerxes-i')).toBeTruthy();
    expect(screen.getByText('PERSON')).toBeTruthy();
    expect(screen.getByText('Artaxerxes I')).toBeTruthy();
    expect(screen.getByText(/sole authority to grant the journey/)).toBeTruthy();
    expect(screen.queryByText('Established')).toBeNull();
    fireEvent.press(screen.getByTestId('peek-card-artaxerxes-i-know-more'));
    expect(onFullCard).toHaveBeenCalledWith('artaxerxes-i');
  });

  it('renders nothing for unknown slugs instead of guessing', () => {
    render(<PeekCard slug="no-such-entity" onFullCard={jest.fn()} />);
    expect(screen.queryByTestId('peek-card-no-such-entity')).toBeNull();
  });
});

describe('placementForAnchor', () => {
  it('places the bubble below mid-screen anchors with a top caret', () => {
    const placement = placementForAnchor({ x: 100, y: 200, width: 80, height: 24 }, 390, 844);
    expect(placement.caret).toBe('top');
    expect(placement.top).toBe(200 + 24 + 14);
    expect(placement.bottom).toBeUndefined();
    expect(placement.caretLeft).toBeCloseTo(100 + 40 - 20 - 8, 5);
  });

  it('places the bubble above low anchors with a bottom caret', () => {
    const placement = placementForAnchor({ x: 100, y: 700, width: 80, height: 24 }, 390, 844);
    expect(placement.caret).toBe('bottom');
    expect(placement.bottom).toBe(844 - 700 + 14);
    expect(placement.top).toBeUndefined();
  });

  it('clamps the caret inside the bubble near screen edges', () => {
    const nearLeft = placementForAnchor({ x: 4, y: 200, width: 20, height: 24 }, 390, 844);
    expect(nearLeft.caretLeft).toBeGreaterThanOrEqual(20);
    const nearRight = placementForAnchor({ x: 370, y: 200, width: 20, height: 24 }, 390, 844);
    expect(nearRight.caretLeft).toBeLessThanOrEqual(390 - 40 - 16 - 20);
  });

  it('falls back to a caretless bubble without a rect', () => {
    expect(placementForAnchor(null, 390, 844).caret).toBeNull();
  });
});
