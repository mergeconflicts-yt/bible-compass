import { Share } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeView } from '@/components/HomeView';
import { buildContinueReadingFixture, buildDailyVerseFixture } from '@/fixtures/home';
import { usePreferences } from '@/theme/ThemeProvider';
import { greetingForHour } from '@/lib/greeting';
import { todayKey } from '@/lib/daily';

/** Thin route: wires the presentational HomeView to the router and Share sheet. */
export default function HomeScreen() {
  const router = useRouter();
  const preferences = usePreferences();
  const greeting = greetingForHour(new Date().getHours());
  const daily = buildDailyVerseFixture(preferences.translationId);
  const progress = buildContinueReadingFixture(preferences.translationId);

  const openPassage = (passageKey: string) => {
    router.push({ pathname: '/passage/[reference]', params: { reference: passageKey } });
  };

  const shareVerse = () => {
    const { text, referenceLabel, translationShort } = daily;
    void Share.share({ message: `${text} — ${referenceLabel} (${translationShort})` });
  };

  return (
    <HomeView
      greeting={greeting}
      daily={daily}
      progress={progress}
      onReadInContext={() =>
        router.push({ pathname: '/daily/[date]', params: { date: todayKey() } })
      }
      onShare={shareVerse}
      onOpenPassage={openPassage}
    />
  );
}
