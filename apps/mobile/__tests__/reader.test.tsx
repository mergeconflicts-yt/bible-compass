import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppPreferencesProvider } from '@/theme/ThemeProvider';
import { ReaderView } from '@/components/ReaderView';

function renderReader(bookOsis = 'Neh', chapter = 2) {
  const onBack = jest.fn();
  render(
    <AppPreferencesProvider>
      <ReaderView bookOsis={bookOsis} chapter={chapter} onBack={onBack} />
    </AppPreferencesProvider>,
  );
  return onBack;
}

describe('ReaderView (Nehemiah 2 context mode)', () => {
  it('renders the era rail, story, chapter block and full BSB chapter', () => {
    renderReader();
    expect(screen.getByTestId('reader-screen')).toBeTruthy();
    expect(screen.getByText('PERSIAN PERIOD')).toBeTruthy();
    expect(screen.getByTestId('scripture-block')).toBeTruthy();
    expect(screen.getAllByText(/Berean Standard Bible/).length).toBeGreaterThan(0);
  });

  it('shows one scrollable timeline rail with short names, centered on the passage', () => {
    renderReader();
    expect(screen.getByTestId('timeline-rail')).toBeTruthy();
    expect(screen.getByTestId('rail-nehemiah-2-request')).toBeTruthy();
    expect(screen.getByText('Exodus')).toBeTruthy();
    expect(screen.getByText('Parthenon')).toBeTruthy();
    fireEvent.press(screen.getByTestId('rail-david-capital'));
    expect(screen.getByTestId('timeline-sheet')).toBeTruthy();
  });

  it('shows the draft story summary expanded, collapsible on demand', () => {    renderReader();
    expect(screen.getByText(/Jewish cupbearer to the Persian king/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('story-toggle'));
    expect(screen.queryByText(/Jewish cupbearer to the Persian king/)).toBeNull();
  });

  it('opens a peek from the verse-1 anchor, then the full card onward', () => {
    renderReader();
    fireEvent.press(screen.getByText('King Artaxerxes'));
    expect(screen.getByTestId('peek-overlay')).toBeTruthy();
    expect(screen.getByTestId('peek-card-artaxerxes-i')).toBeTruthy();
    fireEvent.press(screen.getByTestId('peek-card-artaxerxes-i-know-more'));
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(screen.getByText('Artaxerxes I')).toBeTruthy();
    fireEvent.press(screen.getByTestId('understand-passage'));
    expect(screen.getByTestId('context-sheet')).toBeTruthy();
  });

  it('dismisses the peek on tap-outside without opening the full card', () => {
    renderReader();
    fireEvent.press(screen.getByText('King Artaxerxes'));
    expect(screen.getByTestId('peek-card-artaxerxes-i')).toBeTruthy();
    expect(screen.queryByTestId('peek-caret')).toBeNull();
    fireEvent.press(screen.getByTestId('peek-dismiss'));
    expect(screen.queryByTestId('peek-card-artaxerxes-i')).toBeNull();
    expect(screen.queryByTestId('entity-sheet')).toBeNull();
  });

  it('opens the peek from other anchors, then the full card directly', () => {
    renderReader();
    fireEvent.press(screen.getByText('Sanballat the Horonite'));
    expect(screen.getByTestId('peek-card-sanballat-the-horonite')).toBeTruthy();
    fireEvent.press(screen.getByTestId('peek-card-sanballat-the-horonite-know-more'));
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(screen.getByText(/Grieved by Nehemiah/)).toBeTruthy();
  });

  it('shows the full hierarchy with passage context, profile and a way back', () => {
    renderReader();
    fireEvent.press(screen.getByText('Sanballat the Horonite'));
    fireEvent.press(screen.getByTestId('peek-card-sanballat-the-horonite-know-more'));
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(screen.getByText('Sanballat')).toBeTruthy();
    expect(screen.getByText(/Grieved by Nehemiah/)).toBeTruthy();
    expect(screen.getByText('Nehemiah 4')).toBeTruthy();
    expect(screen.getByTestId('connected-nehemiah-governor')).toBeTruthy();
    fireEvent.press(screen.getByTestId('connected-nehemiah-governor'));
    expect(screen.getByText(/cupbearer whose visible sadness/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('fullcard-back'));
    expect(screen.queryByTestId('entity-sheet')).toBeNull();
  });

  it('renders one underline anchor per validated phrase across the chapter', () => {
    renderReader();
    expect(screen.getAllByText('Valley Gate')).toHaveLength(2);
    expect(screen.getByText('Judah')).toBeTruthy();
  });

  it('opens the timeline from the era rail link', () => {
    renderReader();
    fireEvent.press(screen.getByTestId('reader-open-timeline'));
    expect(screen.getByTestId('timeline-sheet')).toBeTruthy();
  });
});

describe('ReaderView (plain Scripture mode)', () => {
  it('reads any bundled chapter honestly without faked context', () => {
    renderReader('Gen', 1);
    expect(screen.getByText('Genesis 1')).toBeTruthy();
    expect(screen.queryByTestId('understand-passage')).toBeNull();
    expect(screen.queryByTestId('story-toggle')).toBeNull();
    expect(screen.getByText(/reviewed context is not ready/)).toBeTruthy();
  });
});
