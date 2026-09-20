import { render, screen } from '@testing-library/react-native';
import { AppPreferencesProvider } from '@/theme/ThemeProvider';
import { ReaderView } from '@/components/ReaderView';

/**
 * The curated preview asset is corrupt here: the reader must show an
 * explicit error state and must never silently fall back to the legacy
 * single-file draft.
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
  it('shows an explicit error instead of legacy content', () => {
    render(
      <AppPreferencesProvider>
        <ReaderView bookOsis="Neh" chapter={2} onBack={jest.fn()} />
      </AppPreferencesProvider>,
    );
    expect(screen.getByTestId('preview-unavailable')).toBeTruthy();
    expect(screen.getByText(/Preview data isn't available/)).toBeTruthy();
    expect(screen.queryByTestId('scripture-block')).toBeNull();
    expect(screen.queryByTestId('understand-passage')).toBeNull();
  });
});
