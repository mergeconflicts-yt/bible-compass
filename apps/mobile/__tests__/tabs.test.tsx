import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppPreferencesProvider } from '@/theme/ThemeProvider';
import { BibleView } from '@/components/BibleView';
import { SavedView } from '@/components/SavedView';
import { SearchView } from '@/components/SearchView';
import { SettingsView } from '@/components/SettingsView';

function renderWithPreferences(element: React.ReactElement) {
  return render(<AppPreferencesProvider>{element}</AppPreferencesProvider>);
}

describe('Bible tab', () => {
  it('lists all Old Testament books with the active version pill', () => {
    render(<BibleView onOpenPassage={jest.fn()} />);
    expect(screen.getByTestId('bible-screen')).toBeTruthy();
    expect(screen.getByText('BSB')).toBeTruthy();
    expect(screen.getByTestId('book-gen')).toBeTruthy();
    expect(screen.getByTestId('book-mal')).toBeTruthy();
    expect(screen.getByText('Nehemiah 2')).toBeTruthy();
  });

  it('opens a chapter grid for a book and a chapter from the grid', () => {
    const onOpenPassage = jest.fn();
    render(<BibleView onOpenPassage={onOpenPassage} />);
    fireEvent.press(screen.getByTestId('book-neh'));
    expect(screen.getByTestId('chapter-grid')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chapter-2'));
    expect(onOpenPassage).toHaveBeenCalledWith('Neh.2');
  });

  it('collapses the grid when its book row is tapped again', () => {
    render(<BibleView onOpenPassage={jest.fn()} />);
    fireEvent.press(screen.getByTestId('book-neh'));
    expect(screen.getByTestId('chapter-grid')).toBeTruthy();
    fireEvent.press(screen.getByTestId('book-neh'));
    expect(screen.queryByTestId('chapter-grid')).toBeNull();
  });

  it('switches testament and opens single-chapter books directly', () => {
    const onOpenPassage = jest.fn();
    render(<BibleView onOpenPassage={onOpenPassage} />);
    fireEvent.press(screen.getByTestId('testament-seg-1'));
    expect(screen.getByTestId('book-jude')).toBeTruthy();
    fireEvent.press(screen.getByTestId('book-jude'));
    expect(onOpenPassage).toHaveBeenCalledWith('Jude.1');
  });
});

describe('Saved tab', () => {
  it('lists bookmarks and opens the saved passage', () => {
    const onOpenPassage = jest.fn();
    render(<SavedView onOpenPassage={onOpenPassage} onOpenDaily={jest.fn()} />);
    expect(screen.getByTestId('saved-screen')).toBeTruthy();
    expect(screen.getByText('Nehemiah 2:1–8')).toBeTruthy();
    fireEvent.press(screen.getByTestId('saved-bookmark-passage'));
    expect(onOpenPassage).toHaveBeenCalledWith('Neh.2.1-Neh.2.8');
  });

  it('switches to the recent pattern without losing the list', () => {
    render(<SavedView onOpenPassage={jest.fn()} onOpenDaily={jest.fn()} />);
    fireEvent.press(screen.getByTestId('saved-seg-1'));
    expect(screen.getByTestId('saved-recent-passage')).toBeTruthy();
  });
});

describe('Search tab', () => {
  it('starts on recents plus people and places', () => {
    render(<SearchView onOpenPassage={jest.fn()} />);
    expect(screen.getByTestId('search-screen')).toBeTruthy();
    expect(screen.getByText('Nehemiah 2:1–8')).toBeTruthy();
    expect(screen.getByTestId('search-entity-artaxerxes')).toBeTruthy();
  });

  it('narrows to the reference hit for "neh 2" and clears people', () => {
    render(<SearchView onOpenPassage={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('search-input'), 'neh 2');
    expect(screen.getByTestId('search-ref-hit')).toBeTruthy();
    expect(screen.queryByTestId('search-entity-artaxerxes')).toBeNull();
  });

  it('explains an empty result with a typed hint', () => {
    render(<SearchView onOpenPassage={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('search-input'), 'zzz');
    expect(screen.getByTestId('search-empty')).toBeTruthy();
  });
});

describe('Settings tab', () => {
  it('renders preferences with functional appearance and text rows', () => {
    renderWithPreferences(<SettingsView />);
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
    expect(screen.getByTestId('settings-appearance')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-appearance'));
    fireEvent.press(screen.getByTestId('settings-text-size'));
  });

  it('lists every bundled translation and switches on selection', () => {
    renderWithPreferences(<SettingsView />);
    expect(screen.getByTestId('settings-translation-BSB')).toBeTruthy();
    expect(screen.getByTestId('settings-translation-tam_irv')).toBeTruthy();
    expect(screen.getByTestId('settings-translation-tel_irv')).toBeTruthy();
    expect(screen.getByTestId('settings-translation-BSB').props.accessibilityState).toMatchObject({
      selected: true,
    });
    fireEvent.press(screen.getByTestId('settings-translation-tam_irv'));
    expect(screen.getByTestId('settings-translation-tam_irv').props.accessibilityState).toMatchObject(
      {
        selected: true,
      },
    );
    expect(screen.getByTestId('settings-translation-BSB').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });
});
