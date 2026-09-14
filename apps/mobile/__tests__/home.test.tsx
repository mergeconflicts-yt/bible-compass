import { fireEvent, render, screen } from '@testing-library/react-native';
import { HomeView } from '@/components/HomeView';
import { buildContinueReadingFixture, buildDailyVerseFixture } from '@/fixtures/home';
import { greetingForHour } from '@/lib/greeting';

function renderHome(overrides: Partial<Parameters<typeof HomeView>[0]> = {}) {
  const props = {
    greeting: 'Good morning',
    daily: buildDailyVerseFixture('BSB'),
    progress: buildContinueReadingFixture('BSB'),
    onReadInContext: jest.fn(),
    onShare: jest.fn(),
    onOpenPassage: jest.fn(),
    ...overrides,
  };
  render(<HomeView {...props} />);
  return props;
}

describe('greetingForHour', () => {
  it.each([
    [8, 'Good morning'],
    [13, 'Good afternoon'],
    [20, 'Good evening'],
  ])('hour %i greets “%s”', (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});

describe('HomeView', () => {
  it('shows the daily verse artwork, reference and attribution without ambiguity', () => {
    renderHome();
    expect(screen.getByTestId('daily-artwork')).toBeTruthy();
    expect(screen.getByText(/What is your request/)).toBeTruthy();
    expect(screen.getByText('Nehemiah 2:4')).toBeTruthy();
    expect(screen.getByText('Read in context')).toBeTruthy();
  });

  it('routes Read in context through its handler, not a dead control', () => {
    const props = renderHome();
    fireEvent.press(screen.getByTestId('read-in-context'));
    expect(props.onReadInContext).toHaveBeenCalledTimes(1);
  });

  it('opens the verse composer from Share and shares from inside it', () => {
    const props = renderHome();
    fireEvent.press(screen.getByTestId('share-verse'));
    expect(screen.getByTestId('composer-sheet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('composer-share'));
    expect(props.onShare).toHaveBeenCalledTimes(1);
  });

  it('keeps Download visibly disabled while rights are unconfirmed', () => {
    renderHome();
    const download = screen.getByTestId('download-verse');
    expect(download.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(download);
  });

  it('opens the continue-reading passage from the whole card', () => {
    const props = renderHome();
    fireEvent.press(screen.getByTestId('continue-reading-card'));
    expect(props.onOpenPassage).toHaveBeenCalledWith('Neh.2.1-Neh.2.8');
  });

  it('opens the context flow from the explore card', () => {
    renderHome();
    fireEvent.press(screen.getByTestId('explore-context-card'));
    expect(screen.getByTestId('context-sheet')).toBeTruthy();
    expect(screen.getByText('THE 30-SECOND BRIEF')).toBeTruthy();
  });
});
