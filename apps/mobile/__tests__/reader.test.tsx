import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { act } from 'react';
import { AppPreferencesProvider, usePreferences } from '@/theme/ThemeProvider';
import { ReaderView } from '@/components/ReaderView';

/**
 * Headless Modal double for this file only: react-native's Modal is a
 * native portal that renders nothing under the test renderer, so the peek
 * overlay flow would be unprovable without it. The double renders children
 * inline exactly when `visible`, proving open/dismiss wiring and every
 * nested flow; portal animation, placement measurement, and focus trapping
 * remain device-gated by nature (verified on iOS/Android preview builds).
 */
jest.mock('react-native', () => {
  // NB: no object spread here — spreading the module invokes lazy native
  // getters that crash the test renderer. Replace Modal in place instead;
  // the module registry is per test file, so other suites are unaffected.
  const actual = jest.requireActual('react-native') as Record<string, unknown>;
  const React = jest.requireActual('react') as typeof import('react');
  function PassthroughModal(props: {
    visible?: boolean;
    children?: React.ReactNode;
    testID?: string;
  }): React.ReactNode {
    if (!props.visible) return null;
    // Preserve the overlay testID on a host View: the real Modal forwards
    // it to the native container, which has no test-renderer equivalent.
    const View = actual.View as typeof import('react-native').View;
    return React.createElement(View, { testID: props.testID }, props.children);
  }
  actual.Modal = PassthroughModal;
  return actual;
});

function renderReader(bookOsis = 'Neh', chapter = 2, initialVerse: number | null = null) {
  const onBack = jest.fn();
  render(
    <AppPreferencesProvider>
      <ReaderView
        bookOsis={bookOsis}
        chapter={chapter}
        initialVerse={initialVerse}
        onBack={onBack}
      />
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

  it('shows the draft story summary expanded, collapsible on demand', () => {
    renderReader();
    expect(screen.getByText(/receives permission, letters, timber and an escort/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('story-toggle'));
    expect(screen.queryByText(/receives permission, letters, timber and an escort/)).toBeNull();
  });

  it('opens a peek from the verse-1 anchor, then the full card onward', async () => {
    renderReader();
    fireEvent.press(screen.getByText('King Artaxerxes'));
    // The open waits on the measure-timeout fallback headless (measurement
    // resolves first on device); findBy polls until it lands.
    expect(await screen.findByTestId('peek-overlay')).toBeTruthy();
    expect(await screen.findByTestId('peek-card-artaxerxes-i')).toBeTruthy();
    fireEvent.press(screen.getByTestId('peek-card-artaxerxes-i-know-more'));
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(screen.getByText('Artaxerxes I')).toBeTruthy();
    fireEvent.press(screen.getByTestId('understand-passage'));
    expect(screen.getByTestId('context-sheet')).toBeTruthy();
    expect(screen.getByLabelText('Open Ezra 4:17-23')).toBeTruthy();
  });

  it('dismisses the peek on tap-outside without opening the full card', async () => {
    renderReader();
    fireEvent.press(screen.getByText('King Artaxerxes'));
    expect(await screen.findByTestId('peek-card-artaxerxes-i')).toBeTruthy();
    expect(screen.queryByTestId('peek-caret')).toBeNull();
    fireEvent.press(screen.getByTestId('peek-dismiss'));
    expect(screen.queryByTestId('peek-card-artaxerxes-i')).toBeNull();
    expect(screen.queryByTestId('entity-sheet')).toBeNull();
  });

  it('opens the peek from other anchors, then the full card directly', async () => {
    renderReader();
    // 'Sanballat the Horonite' anchors verses 10 and 19: scope the press
    // to the verse-10 anchor instead of an ambiguous document query.
    fireEvent.press(within(screen.getByTestId('verse-10')).getByText('Sanballat the Horonite'));
    expect(await screen.findByTestId('peek-card-sanballat-the-horonite')).toBeTruthy();
    fireEvent.press(screen.getByTestId('peek-card-sanballat-the-horonite-know-more'));
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(
      within(screen.getByTestId('fullcard-in-passage')).getByText(/deeply disturbed/),
    ).toBeTruthy();
  });

  it('shows the full hierarchy with passage context, profile and a way back', async () => {
    renderReader();
    fireEvent.press(within(screen.getByTestId('verse-10')).getByText('Sanballat the Horonite'));
    expect(await screen.findByTestId('peek-card-sanballat-the-horonite-know-more')).toBeTruthy();
    fireEvent.press(screen.getByTestId('peek-card-sanballat-the-horonite-know-more'));
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(
      within(screen.getByTestId('entity-sheet')).getByText('Sanballat the Horonite'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('fullcard-in-passage')).getByText(/deeply disturbed/),
    ).toBeTruthy();
    expect(screen.getByTestId('fullcard-appearance-neh-2-10')).toBeTruthy();
    expect(screen.getByTestId('connected-nehemiah-governor')).toBeTruthy();
    fireEvent.press(screen.getByTestId('connected-nehemiah-governor'));
    expect(screen.getByText(/cupbearer whose visible sadness/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('fullcard-back'));
    expect(screen.queryByTestId('entity-sheet')).toBeNull();
  });

  it('renders one underline anchor per validated phrase across the chapter', () => {
    renderReader();
    expect(screen.getAllByText('the Valley Gate')).toHaveLength(2);
    expect(screen.getAllByText('Judah')).toHaveLength(2);
  });

  it('lands on the referenced verse with a highlight instead of the chapter top', () => {
    renderReader('Neh', 2, 10);
    expect(screen.getByTestId('verse-10-target')).toBeTruthy();
    expect(screen.getByTestId('verse-1')).toBeTruthy();
  });

  it('jumps in place for same-chapter verse links without navigating', async () => {
    const onOpenPassage = jest.fn();
    render(
      <AppPreferencesProvider>
        <ReaderView bookOsis="Neh" chapter={2} onBack={jest.fn()} onOpenPassage={onOpenPassage} />
      </AppPreferencesProvider>,
    );
    fireEvent.press(within(screen.getByTestId('verse-10')).getByText('Sanballat the Horonite'));
    expect(await screen.findByTestId('peek-card-sanballat-the-horonite-know-more')).toBeTruthy();
    fireEvent.press(screen.getByTestId('peek-card-sanballat-the-horonite-know-more'));
    fireEvent.press(screen.getByTestId('fullcard-appearance-neh-2-10'));
    expect(screen.getByTestId('verse-10-target')).toBeTruthy();
    // Link taps dismiss layers and navigate: the sheet closes on the jump.
    expect(screen.queryByTestId('entity-sheet')).toBeNull();
    expect(onOpenPassage).not.toHaveBeenCalled();
  });

  it('opens the timeline from the era rail link', () => {
    renderReader();
    fireEvent.press(screen.getByTestId('reader-open-timeline'));
    expect(screen.getByTestId('timeline-sheet')).toBeTruthy();
  });

  it('reads a Tamil chapter with a localized title and no unreviewed anchors', () => {
    // Switch through the real preferences path: the provider owns the
    // translation state, so a module preset alone never reaches the reader.
    let switchTranslation: ((id: string) => void) | null = null;
    function Capture() {
      switchTranslation = usePreferences().setTranslationId;
      return null;
    }
    render(
      <AppPreferencesProvider>
        <Capture />
        <ReaderView bookOsis="Neh" chapter={2} onBack={jest.fn()} />
      </AppPreferencesProvider>,
    );
    void act(() => {
      switchTranslation?.('tam_irv');
    });
    // The header splits title and translation badge across nodes, so the
    // full title only matches as a substring — content provably present.
    expect(screen.getByText('நெகேமியா 2', { exact: false })).toBeTruthy();
    // Tamil has no reviewed anchors: English draft context surrounds the
    // passage, but no anchor opens the context layer.
    expect(screen.queryByText('King Artaxerxes')).toBeNull();
  });
});

describe('ReaderView (plain Scripture mode)', () => {
  it('reads any bundled chapter honestly without faked context', () => {
    renderReader('Gen', 1);
    // Same split-node header as above: badge rides alongside the title.
    expect(screen.getByText('Genesis 1', { exact: false })).toBeTruthy();
    expect(screen.queryByTestId('understand-passage')).toBeNull();
    expect(screen.queryByTestId('story-toggle')).toBeNull();
    expect(screen.getByText(/reviewed context is not ready/)).toBeTruthy();
  });
});
