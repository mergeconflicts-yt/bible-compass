import { fireEvent, render, screen } from '@testing-library/react-native';
import { HomeView } from '@/components/HomeView';
import { continueReadingFixture, dailyVerseFixture } from '@/fixtures/home';
import { greetingForHour } from '@/lib/greeting';

function renderHome(overrides: Partial<Parameters<typeof HomeView>[0]> = {}) {
  const props = {
    greeting: 'Good morning',
    daily: dailyVerseFixture,
    progress: continueReadingFixture,
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
  it('shows the daily verse, reference and translation without ambiguity', () => {
    renderHome();
    expect(screen.getByText(/What is your request/)).toBeTruthy();
    expect(screen.getByText('Nehemiah 2:4')).toBeTruthy();
    expect(screen.getAllByText('WEB')).toHaveLength(2);
    expect(screen.getByText('Read in context')).toBeTruthy();
  });

  it('routes Read in context through its handler, not a dead control', () => {
    const props = renderHome();
    fireEvent.press(screen.getByTestId('read-in-context'));
    expect(props.onReadInContext).toHaveBeenCalledTimes(1);
  });

  it('routes Share through its handler', () => {
    const props = renderHome();
    fireEvent.press(screen.getByTestId('share-verse'));
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
});
