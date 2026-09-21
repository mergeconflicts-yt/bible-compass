import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppPreferencesProvider } from '@/theme/ThemeProvider';
import { ReaderView } from '@/components/ReaderView';

/**
 * The curated preview asset is corrupt here: Scripture must stay readable
 * with context disabled and an explicit error notice. The reader must never
 * silently fall back to the legacy single-file draft.
 */
jest.mock('../assets/content/nehemiah-2.preview.json', () => ({
  schema_version: 999,
  review_status: 'approved',
  passage: 'Neh.2.1-Neh.2.20',
  contexts: [],
  entities: [],
  mentions: [],
  events: [],
  relationships: [],
  connections: [],
}));

describe('Nehemiah 2 invalid preview', () => {
  it('keeps Scripture readable with context disabled and an explicit notice', () => {
    render(
      <AppPreferencesProvider>
        <ReaderView bookOsis="Neh" chapter={2} onBack={jest.fn()} />
      </AppPreferencesProvider>,
    );
    // Scripture still renders, unchanged.
    expect(screen.getByTestId('scripture-block')).toBeTruthy();
    expect(screen.getByText(/King Artaxerxes/)).toBeTruthy();
    // Context is explicitly unavailable.
    expect(screen.getByTestId('preview-unavailable')).toBeTruthy();
    expect(screen.getByText(/Preview data isn't available/)).toBeTruthy();
    // No curated context affordances and no draft anchor layer.
    expect(screen.queryByTestId('understand-passage')).toBeNull();
    expect(screen.queryByTestId('story-toggle')).toBeNull();
    expect(screen.queryByTestId('context-sheet')).toBeNull();
  });

  it('does not open a mention peek when the preview is invalid', () => {
    render(
      <AppPreferencesProvider>
        <ReaderView bookOsis="Neh" chapter={2} onBack={jest.fn()} />
      </AppPreferencesProvider>,
    );
    fireEvent.press(screen.getByText(/King Artaxerxes/));
    expect(screen.queryByTestId('peek-overlay')).toBeNull();
  });
});
