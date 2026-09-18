import { useState } from 'react';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Segmented } from '@/components/Segmented';
import { NavRow } from '@/components/NavRow';
import { translationById } from '@/content/bsb';
import { listBookmarks } from '@/content/bookmarkStore';
import { listRecents } from '@/content/recentStore';
import { chapterLabel } from '@/lib/reference';
import { useOptionalPreferences } from '@/theme/ThemeProvider';

export interface SavedViewProps {
  onOpenPassage: (passageKey: string) => void;
  onOpenDaily: () => void;
}

/** Saved library — demo #v-saved. Bookmarks and recents persist on-device. */
export function SavedView({ onOpenPassage, onOpenDaily }: SavedViewProps) {
  const [section, setSection] = useState(0);
  const preferences = useOptionalPreferences();
  const translationId = preferences?.translationId ?? 'BSB';
  const marks = listBookmarks(translationId);
  const short = translationById(translationId)?.short ?? 'BSB';
  const recents = listRecents(translationId);

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
            title="Verse of the day"
            meta={`${short} · verse of the day`}
            onPress={onOpenDaily}
            testID="saved-bookmark-daily"
          />
          {marks.length > 0 ? (
            marks.map((mark, index) => (
              <NavRow
                key={mark.id}
                title={chapterLabel(mark.bookOsis, mark.chapter)}
                meta={`${short} · saved on this device`}
                onPress={() => onOpenPassage(`${mark.bookOsis}.${mark.chapter}`)}
                testID={`saved-bookmark-${index}`}
              />
            ))
          ) : (
            <AppText variant="body" color="textSecondary" testID="saved-bookmarks-empty">
              No chapter bookmarks yet — open a chapter and choose Bookmark to save it here.
            </AppText>
          )}
        </>
      ) : recents.length > 0 ? (
        <>
          {recents.map((recent, index) => (
            <NavRow
              key={`${recent.bookOsis}.${recent.chapter}`}
              title={chapterLabel(recent.bookOsis, recent.chapter)}
              meta={`${short} · recent`}
              onPress={() => onOpenPassage(`${recent.bookOsis}.${recent.chapter}`)}
              testID={`saved-recent-${index}`}
            />
          ))}
        </>
      ) : (
        <AppText variant="body" color="textSecondary" testID="saved-recents-empty">
          No recent chapters yet — chapters you open appear here.
        </AppText>
      )}
    </Screen>
  );
}
