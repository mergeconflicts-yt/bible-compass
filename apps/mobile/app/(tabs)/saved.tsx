import { useRouter } from 'expo-router';
import { SavedView } from '@/components/SavedView';
import { todayKey } from '@/lib/daily';

/** Thin route: saved library wired to passage and daily routes. */
export default function SavedScreen() {
  const router = useRouter();
  return (
    <SavedView
      onOpenPassage={(passageKey) =>
        router.push({ pathname: '/passage/[reference]', params: { reference: passageKey } })
      }
      onOpenDaily={() => router.push({ pathname: '/daily/[date]', params: { date: todayKey() } })}
    />
  );
}
