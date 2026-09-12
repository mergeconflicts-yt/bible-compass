import { useState } from 'react';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Segmented } from '@/components/Segmented';
import { NavRow } from '@/components/NavRow';
import { savedRows, searchRecents } from '@/fixtures/demo';

export interface SavedViewProps {
  onOpenPassage: (passageKey: string) => void;
  onOpenDaily: () => void;
}

/** Saved library — demo #v-saved. Bookmarks and recents share one row pattern. */
export function SavedView({ onOpenPassage, onOpenDaily }: SavedViewProps) {
  const [section, setSection] = useState(0);

  return (
    <Screen testID="saved-screen">
      <AppText variant="title2" accessibilityRole="header">
        Saved
      </AppText>
      <Segmented
        options={['Bookmarks', 'Recent']}
        selected={section}
        onSelect={setSection}
        accessibilityLabel="Saved sections"
        testID="saved-seg"
      />
      {section === 0 ? (
        <>
          <NavRow
            title={savedRows[0]?.title ?? 'Nehemiah 2:1–8'}
            meta={savedRows[0]?.meta}
            onPress={() => onOpenPassage('Neh.2.1-Neh.2.8')}
            testID="saved-bookmark-passage"
          />
          <NavRow
            title={savedRows[1]?.title ?? 'Nehemiah 2:4'}
            meta={savedRows[1]?.meta}
            onPress={onOpenDaily}
            testID="saved-bookmark-daily"
          />
        </>
      ) : (
        <>
          <NavRow
            title={searchRecents[0]?.title ?? 'Nehemiah 2:1–8'}
            meta={searchRecents[0]?.meta}
            onPress={() => onOpenPassage('Neh.2.1-Neh.2.8')}
            testID="saved-recent-passage"
          />
          <NavRow
            title={searchRecents[1]?.title ?? 'Ezra 4:23'}
            meta={searchRecents[1]?.meta}
            testID="saved-recent-ezra"
          />
        </>
      )}
    </Screen>
  );
}
