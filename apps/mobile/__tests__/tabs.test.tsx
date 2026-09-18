import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppPreferencesProvider } from '@/theme/ThemeProvider';
import { BibleView } from '@/components/BibleView';
import { SavedView } from '@/components/SavedView';
import { SearchView } from '@/components/SearchView';
import { SettingsView } from '@/components/SettingsView';
import {
  initializeBookmarkStore,
  resetBookmarkStore,
  type Bookmark,
  type BookmarkRepository,
} from '@/content/bookmarkStore';
import {
  initializeRecentStore,
  resetRecentStore,
  type RecentEntry,
  type RecentRepository,
} from '@/content/recentStore';
import {
  resetPassageStore,
  setPassageRepository,
  type PassageDbHandle,
} from '@/content/passageStore';
import type { PassageRepository } from '@/content/passageRepository';
import { initializeAuthStore, resetAuthStore, restoreSession } from '@/content/authStore';

function seedBookmarks(marks: Bookmark[]): void {
  const stub: BookmarkRepository = {
    listBookmarks: (translationId: string) =>
      marks.filter((mark) => mark.translationId === translationId),
    isBookmarked: () => false,
    listPendingOps: () => [],
    toggleBookmark: async () => ({ bookmarked: true }),
    ackOps: async () => {},
    applyRemoteBookmarks: async () => ({ inserted: 0 }),
    applyRemoteTombstones: async () => ({ removed: 0 }),
  };
  initializeBookmarkStore({
    createRepository: () => stub,
    db: {} as PassageDbHandle,
    newId: () => 'test-id',
  });
}

function seedRecents(entries: RecentEntry[]): void {
  const stub: RecentRepository = {
    listRecents: (translationId: string, limit: number) =>
      entries.filter((entry) => entry.translationId === translationId).slice(0, limit),
    recordRecent: async () => {},
  };
  initializeRecentStore({
    createRepository: () => stub,
    db: {} as PassageDbHandle,
  });
}

function seedAuthReady(): void {
  initializeAuthStore({
    createAuth: () => ({
      getSession: async () => null,
      signIn: async () => ({ userId: 'user-1', provider: 'apple' as const }),
      signOut: async () => {},
    }),
    wipeLibrary: async () => {},
  });
}

async function seedSignedIn(): Promise<void> {
  initializeAuthStore({
    createAuth: () => ({
      getSession: async () => ({ userId: 'user-9', provider: 'google' as const }),
      signIn: async () => ({ userId: 'user-9', provider: 'google' as const }),
      signOut: async () => {},
    }),
    wipeLibrary: async () => {},
  });
  await restoreSession();
}

function seedVerseHits(): void {
  const stub: PassageRepository = {
    getChapterBlocks: () => null,
    getVerseText: () => null,
    searchVerses: () => [{ bookOsis: 'Neh', chapter: 2, verse: 4, text: 'Seeded verse hit.' }],
  };
  setPassageRepository(stub);
}

afterEach(() => {
  resetBookmarkStore();
  resetRecentStore();
  resetPassageStore();
  resetAuthStore();
});

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
  it('lists persisted bookmarks and opens the saved chapter', () => {
    seedBookmarks([
      {
        id: 'b1',
        translationId: 'BSB',
        bookOsis: 'Neh',
        chapter: 2,
        createdAt: '2026-09-15T00:00:00.000Z',
      },
    ]);
    const onOpenPassage = jest.fn();
    render(<SavedView onOpenPassage={onOpenPassage} onOpenDaily={jest.fn()} />);
    expect(screen.getByTestId('saved-screen')).toBeTruthy();
    expect(screen.getByText('Nehemiah 2')).toBeTruthy();
    fireEvent.press(screen.getByTestId('saved-bookmark-0'));
    expect(onOpenPassage).toHaveBeenCalledWith('Neh.2');
  });

  it('explains an empty library instead of faking rows', () => {
    render(<SavedView onOpenPassage={jest.fn()} onOpenDaily={jest.fn()} />);
    expect(screen.getByTestId('saved-bookmarks-empty')).toBeTruthy();
    expect(screen.queryByTestId('saved-bookmark-0')).toBeNull();
  });

  it('switches to persisted recents and opens the recent chapter', () => {
    seedRecents([
      { translationId: 'BSB', bookOsis: 'Neh', chapter: 2, openedAt: '2026-09-15T00:00:00.000Z' },
    ]);
    const onOpenPassage = jest.fn();
    render(<SavedView onOpenPassage={onOpenPassage} onOpenDaily={jest.fn()} />);
    fireEvent.press(screen.getByTestId('saved-seg-1'));
    expect(screen.getByText('Nehemiah 2')).toBeTruthy();
    fireEvent.press(screen.getByTestId('saved-recent-0'));
    expect(onOpenPassage).toHaveBeenCalledWith('Neh.2');
  });

  it('explains an empty recent list instead of faking rows', () => {
    render(<SavedView onOpenPassage={jest.fn()} onOpenDaily={jest.fn()} />);
    fireEvent.press(screen.getByTestId('saved-seg-1'));
    expect(screen.getByTestId('saved-recents-empty')).toBeTruthy();
  });
});

describe('Search tab', () => {
  it('starts on persisted recents plus people and places', () => {
    seedRecents([
      { translationId: 'BSB', bookOsis: 'Neh', chapter: 2, openedAt: '2026-09-15T00:00:00.000Z' },
    ]);
    render(<SearchView onOpenPassage={jest.fn()} />);
    expect(screen.getByTestId('search-screen')).toBeTruthy();
    expect(screen.getByText('Nehemiah 2')).toBeTruthy();
    expect(screen.getByTestId('search-recent-0')).toBeTruthy();
    expect(screen.getByTestId('search-entity-artaxerxes')).toBeTruthy();
  });

  it('hides recents when the library has none', () => {
    render(<SearchView onOpenPassage={jest.fn()} />);
    expect(screen.queryByTestId('search-recent-0')).toBeNull();
    expect(screen.getByTestId('search-entity-artaxerxes')).toBeTruthy();
  });

  it('narrows to the reference hit for "neh 2" and clears people', () => {
    render(<SearchView onOpenPassage={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('search-input'), 'neh 2');
    expect(screen.getByTestId('search-ref-hit')).toBeTruthy();
    expect(screen.queryByTestId('search-entity-artaxerxes')).toBeNull();
  });

  it('finds offline verse text and opens the verse', () => {
    seedVerseHits();
    const onOpenPassage = jest.fn();
    render(<SearchView onOpenPassage={onOpenPassage} />);
    fireEvent.changeText(screen.getByTestId('search-input'), 'request');
    expect(screen.getByTestId('search-verse-2-4')).toBeTruthy();
    fireEvent.press(screen.getByTestId('search-verse-2-4'));
    expect(onOpenPassage).toHaveBeenCalledWith('Neh.2.4');
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

  it('stays honestly anonymous when no sync project is configured', () => {
    renderWithPreferences(<SettingsView />);
    expect(screen.getByTestId('settings-account-status')).toBeTruthy();
    expect(screen.getByText('Sync unavailable')).toBeTruthy();
    expect(screen.queryByTestId('settings-sign-in-apple')).toBeNull();
    expect(screen.queryByTestId('settings-sign-out')).toBeNull();
  });

  it('offers provider sign-in rows when a project is configured', () => {
    seedAuthReady();
    renderWithPreferences(<SettingsView />);
    expect(screen.getByTestId('settings-sign-in-apple')).toBeTruthy();
    expect(screen.getByTestId('settings-sign-in-google')).toBeTruthy();
  });

  it('shows the signed-in account with sign-out', async () => {
    await seedSignedIn();
    renderWithPreferences(<SettingsView />);
    await screen.findByTestId('settings-sign-out');
    expect(screen.getByText('Signed in')).toBeTruthy();
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
    expect(
      screen.getByTestId('settings-translation-tam_irv').props.accessibilityState,
    ).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('settings-translation-BSB').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });
});
