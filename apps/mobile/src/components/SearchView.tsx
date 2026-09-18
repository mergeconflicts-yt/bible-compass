import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { NavRow } from '@/components/NavRow';
import { EntitySheet } from '@/components/sheets/EntitySheet';
import { searchDemoVisibility } from '@/lib/search';
import { searchEntities } from '@/fixtures/demo';
import { bookNameFor, translationById, verseLabel } from '@/content/bsb';
import { searchVerseText } from '@/content/passageStore';
import { listRecents } from '@/content/recentStore';
import { chapterLabel } from '@/lib/reference';
import { useOptionalPreferences } from '@/theme/ThemeProvider';

export interface SearchViewProps {
  onOpenPassage: (passageKey: string) => void;
}

/** Shortens a verse hit for the row meta; the reader shows the full text. */
function snippetFor(text: string): string {
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/**
 * Reference-first search — demo #v-search. Empty query shows on-device
 * recents plus people/places; typing narrows to reference hits, verse-text
 * hits from the offline store, person hits, or an empty state with a typed
 * hint. No query text ever leaves the device (recents store locations only).
 */
export function SearchView({ onOpenPassage }: SearchViewProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [entitySlug, setEntitySlug] = useState<string | null>(null);
  const preferences = useOptionalPreferences();
  const translationId = preferences?.translationId ?? 'BSB';
  const short = translationById(translationId)?.short ?? 'BSB';
  const trimmed = query.trim();
  const recents = trimmed === '' ? listRecents(translationId) : [];
  const verseHits = trimmed.length >= 2 ? searchVerseText(trimmed, translationId) : [];
  const visibility = searchDemoVisibility(query);

  return (
    <Screen testID="search-screen">
      <AppText variant="title2" accessibilityRole="header">
        Search
      </AppText>
      <TextInput
        style={[
          styles.box,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
        placeholder="Book, chapter or verse — e.g. Neh 2"
        placeholderTextColor={colors.textSecondary}
        aria-label="Search by reference or name"
        accessibilityLabel="Search by reference or name"
        value={query}
        onChangeText={setQuery}
        autoComplete="off"
        testID="search-input"
      />

      {visibility.showReferenceHit ? (
        <NavRow
          title={`${bookNameFor('Neh', translationId)} 2`}
          meta={`${preferences?.translation.short ?? 'BSB'} · reference result`}
          onPress={() => onOpenPassage('Neh.2.1-Neh.2.8')}
          testID="search-ref-hit"
        />
      ) : null}

      {visibility.showRecents && recents.length > 0 ? (
        <View>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            RECENT
          </AppText>
          {recents.map((recent, index) => (
            <NavRow
              key={`${recent.bookOsis}.${recent.chapter}`}
              title={chapterLabel(recent.bookOsis, recent.chapter)}
              meta={`${short} · recent`}
              onPress={() => onOpenPassage(`${recent.bookOsis}.${recent.chapter}`)}
              testID={`search-recent-${index}`}
            />
          ))}
        </View>
      ) : null}

      {verseHits.length > 0 ? (
        <View>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            VERSES
          </AppText>
          {verseHits.map((hit) => (
            <NavRow
              key={`${hit.bookOsis}.${hit.chapter}.${hit.verse}`}
              title={verseLabel(hit.bookOsis, hit.chapter, hit.verse, translationId)}
              meta={snippetFor(hit.text)}
              onPress={() => onOpenPassage(`${hit.bookOsis}.${hit.chapter}.${hit.verse}`)}
              testID={`search-verse-${hit.chapter}-${hit.verse}`}
            />
          ))}
        </View>
      ) : null}

      {visibility.showEntities ? (
        <View>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            PEOPLE AND PLACES
          </AppText>
          <NavRow
            title={searchEntities[0]?.title ?? 'Artaxerxes I'}
            meta={searchEntities[0]?.meta}
            onPress={() => setEntitySlug('artaxerxes-i')}
            testID="search-entity-artaxerxes"
          />
        </View>
      ) : null}

      {visibility.showEmpty && verseHits.length === 0 ? (
        <AppText variant="body" color="textSecondary" style={styles.empty} testID="search-empty">
          No matches — try a reference like “Neh 2”.
        </AppText>
      ) : null}

      <EntitySheet
        visible={entitySlug !== null}
        slug={entitySlug}
        onClose={() => setEntitySlug(null)}
        onOpenEntity={(slug) => setEntitySlug(slug)}
        onOpenPassage={(key) => {
          setEntitySlug(null);
          onOpenPassage(key);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.button,
    minHeight: space[12],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    fontSize: 16,
    marginTop: space[3],
  },
  eyebrow: {
    letterSpacing: 1.5,
    marginTop: space[4],
    marginBottom: space[1],
  },
  empty: {
    textAlign: 'center',
    marginTop: space[6],
  },
});
