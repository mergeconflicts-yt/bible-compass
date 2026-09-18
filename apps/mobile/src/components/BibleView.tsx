import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { NavRow } from '@/components/NavRow';
import { useOptionalPreferences } from '@/theme/ThemeProvider';
import { bookNameFor, booksFor } from '@/content/bsb';
import type { BookEntry } from '@/content/books';

export interface BibleViewProps {
  onOpenPassage: (passageKey: string) => void;
}

/**
 * Bible browser: all 66 books by testament in the demo/index.html library
 * style (card rows with inline chapter counts). Tapping a book expands its
 * chapter grid in the same page; single-chapter books open directly.
 * Only Nehemiah 2 carries reviewed context; every other chapter reads
 * Scripture-only and says so. Version identity always comes from the
 * active translation record, never a hardcoded string.
 */
export function BibleView({ onOpenPassage }: BibleViewProps) {
  const { colors } = useTheme();
  const [testament, setTestament] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const preferences = useOptionalPreferences();
  const translationId = preferences?.translationId ?? 'BSB';
  const registry = booksFor(translationId);
  const testaments = preferences?.translation.testaments ?? ['Old Testament', 'New Testament'];

  const books = registry.filter((book) => book.testament === (testament === 0 ? 'OT' : 'NT'));
  const selectedBook = selected ? (registry.find((book) => book.osis === selected) ?? null) : null;

  const openChapter = (osis: string, chapter: number) => {
    onOpenPassage(`${osis}.${chapter}`);
  };

  const openNehemiah2 = () => {
    openChapter('Neh', 2);
  };

  const selectTestament = (index: number) => {
    setTestament(index);
    setSelected(null);
  };

  const toggleBook = (osis: string, chapters: number) => {
    if (chapters === 1) {
      openChapter(osis, 1);
      return;
    }
    if (selected === osis) {
      setSelected(null);
    } else {
      setSelected(osis);
    }
  };

  return (
    <Screen testID="bible-screen">
      <View style={styles.header}>
        <AppText variant="title2" accessibilityRole="header">
          Bible
        </AppText>
        <View style={[styles.versionPill, { borderColor: colors.border }]}>
          <AppText variant="label" color="textSecondary">
            {preferences?.translation.short ?? 'BSB'}
          </AppText>
        </View>
      </View>

      <Segmented
        options={testaments}
        selected={testament}
        onSelect={selectTestament}
        accessibilityLabel="Testament"
        testID="testament-seg"
      />

      {selectedBook ? (
        <SelectedBookCard book={selectedBook} translationId={translationId} />
      ) : testament === 0 ? (
        <View
          style={[
            styles.readyCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText variant="caption" color="accent">
            CONTEXT READY
          </AppText>
          <AppText variant="title2" style={styles.readyTitle}>
            {`${bookNameFor('Neh', translationId)} 2`}
          </AppText>
          <AppText variant="body" color="textSecondary" style={styles.readyMeta}>
            Full orientation, profiles, map and timeline.
          </AppText>
          <Button
            title="Open chapter ›"
            variant="secondary"
            onPress={openNehemiah2}
            testID="open-nehemiah"
          />
        </View>
      ) : null}

      <AppText variant="caption" color="accent" style={styles.eyebrow}>
        ALL BOOKS
      </AppText>
      {books.map((book) => (
        <BookRow
          key={book.osis}
          book={book}
          expanded={selected === book.osis}
          onToggle={toggleBook}
          onOpenChapter={openChapter}
        />
      ))}
    </Screen>
  );
}

function SelectedBookCard({ book, translationId }: { book: BookEntry; translationId: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.readyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <AppText variant="caption" color="accent">
        {book.chapters} CHAPTERS
      </AppText>
      <AppText variant="title2" style={styles.readyTitle}>
        {book.name}
      </AppText>
      <AppText variant="body" color="textSecondary">
        {book.osis === 'Neh'
          ? `${bookNameFor('Neh', translationId)} 2 carries full orientation, profiles, map and timeline. Other chapters are Scripture only.`
          : 'Scripture is available for every chapter. Contextual layers are being added book by book.'}
      </AppText>
    </View>
  );
}

function BookRow({
  book,
  expanded,
  onToggle,
  onOpenChapter,
}: {
  book: BookEntry;
  expanded: boolean;
  onToggle: (osis: string, chapters: number) => void;
  onOpenChapter: (osis: string, chapter: number) => void;
}) {
  const handlePress = () => {
    onToggle(book.osis, book.chapters);
  };
  return (
    <View>
      <NavRow
        title={book.name}
        aside={`${book.chapters}`}
        card
        onPress={handlePress}
        testID={`book-${book.osis.toLowerCase()}`}
      />
      {expanded ? <ChapterGrid book={book} onOpenChapter={onOpenChapter} /> : null}
    </View>
  );
}

function chapterNumbers(count: number): number[] {
  const pages: number[] = [];
  for (let page = 1; page <= count; page += 1) {
    pages.push(page);
  }
  return pages;
}

function ChapterGrid({
  book,
  onOpenChapter,
}: {
  book: BookEntry;
  onOpenChapter: (osis: string, chapter: number) => void;
}) {
  return (
    <View style={styles.grid} testID="chapter-grid">
      {chapterNumbers(book.chapters).map((chapter) => (
        <ChapterCell key={chapter} book={book} chapter={chapter} onOpenChapter={onOpenChapter} />
      ))}
    </View>
  );
}

function ChapterCell({
  book,
  chapter,
  onOpenChapter,
}: {
  book: BookEntry;
  chapter: number;
  onOpenChapter: (osis: string, chapter: number) => void;
}) {
  const { colors } = useTheme();
  const handlePress = () => {
    onOpenChapter(book.osis, chapter);
  };
  const label = `${book.name} chapter ${chapter}`;
  return (
    <Pressable
      onPress={handlePress}
      testID={`chapter-${chapter}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.cell,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <AppText variant="label">{chapter}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  versionPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    minHeight: space[12],
    justifyContent: 'center',
  },
  readyCard: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space[4],
    marginBottom: space[2],
    gap: space[1],
  },
  readyTitle: {
    marginTop: space[1],
  },
  readyMeta: {
    marginBottom: space[2],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: space[2],
    marginBottom: space[4],
  },
  cell: {
    flexBasis: '18%',
    flexGrow: 1,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[3],
  },
  eyebrow: {
    letterSpacing: 1.5,
    marginTop: space[4],
    marginBottom: space[2],
  },
});
