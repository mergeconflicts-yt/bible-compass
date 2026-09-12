import { Share } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { DailyView } from '@/components/DailyView';
import { dailyVerseFixture } from '@/fixtures/home';
import { formatDateLabel, isValidDateKey, todayKey } from '@/lib/daily';

/**
 * Full daily verse experience (`/daily/2026-09-11`). Malformed dates get a
 * typed error state with a same-day fallback, never a crash.
 */
export default function DailyScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const raw = Array.isArray(date) ? date[0] : (date ?? '');

  const shareVerse = () => {
    const { text, referenceLabel, translationShort } = dailyVerseFixture;
    void Share.share({ message: `${text} — ${referenceLabel} (${translationShort})` });
  };

  if (!isValidDateKey(raw)) {
    return (
      <>
        <Stack.Screen options={{ title: 'Invalid date' }} />
        <Screen>
          <StateView
            variant="error"
            title="We can't open that day"
            explanation="Daily links use the YYYY-MM-DD calendar date."
            actionLabel="Open today"
            onAction={() =>
              router.replace({ pathname: '/daily/[date]', params: { date: todayKey() } })
            }
            testID="daily-invalid"
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Verse of the day' }} />
      <DailyView
        dateLabel={formatDateLabel(raw)}
        onBack={() => router.back()}
        onShare={shareVerse}
        onOpenPassage={(passageKey) =>
          router.push({ pathname: '/passage/[reference]', params: { reference: passageKey } })
        }
      />
    </>
  );
}
