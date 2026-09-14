import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { NavRow } from '@/components/NavRow';
import { EntitySheet } from '@/components/sheets/EntitySheet';
import { searchDemoVisibility } from '@/lib/search';
import { searchEntities, searchRecentsFor } from '@/fixtures/demo';
import { bookNameFor } from '@/content/bsb';
import { useOptionalPreferences } from '@/theme/ThemeProvider';

export interface SearchViewProps {
  onOpenPassage: (passageKey: string) => void;
}

/**
 * Reference-first search — demo #v-search. Empty query shows recents plus
 * people/places; typing narrows to reference hits, person hits, or an empty
 * state with a typed hint. No query text ever leaves the device.
 */
export function SearchView({ onOpenPassage }: SearchViewProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [entitySlug, setEntitySlug] = useState<string | null>(null);
  const preferences = useOptionalPreferences();
  const translationId = preferences?.translationId ?? 'BSB';
  const recents = searchRecentsFor(translationId);
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

      {visibility.showRecents ? (
        <View>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            RECENT
          </AppText>
          <NavRow
            title={recents[0]?.title ?? 'Nehemiah 2:1–8'}
            meta={recents[0]?.meta}
            onPress={() => onOpenPassage('Neh.2.1-Neh.2.8')}
            testID="search-recent-passage"
          />
          <NavRow
            title={recents[1]?.title ?? 'Ezra 4:23'}
            meta={recents[1]?.meta}
            testID="search-recent-ezra"
          />
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

      {visibility.showEmpty ? (
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
