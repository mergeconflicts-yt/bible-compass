import { Share } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeView } from '@/components/HomeView';
import { continueReadingFixture, dailyVerseFixture } from '@/fixtures/home';
import { greetingForHour } from '@/lib/greeting';

/** Thin route: wires the presentational HomeView to the router and Share sheet. */
export default function HomeScreen() {
  const router = useRouter();
  const greeting = greetingForHour(new Date().getHours());

  const openPassage = (passageKey: string) => {
    router.push({ pathname: '/passage/[reference]', params: { reference: passageKey } });
  };

  const shareVerse = () => {
    const { text, referenceLabel, translationShort } = dailyVerseFixture;
    void Share.share({ message: `${text} — ${referenceLabel} (${translationShort})` });
  };

  return (
    <HomeView
      greeting={greeting}
      daily={dailyVerseFixture}
      progress={continueReadingFixture}
      onReadInContext={() => openPassage(dailyVerseFixture.passageKey)}
      onShare={shareVerse}
      onOpenPassage={openPassage}
    />
  );
}
