import { useRouter } from 'expo-router';
import { BibleView } from '@/components/BibleView';

/** Thin route: Bible browser wired to the canonical passage route. */
export default function BibleScreen() {
  const router = useRouter();
  return (
    <BibleView
      onOpenPassage={(passageKey) =>
        router.push({ pathname: '/passage/[reference]', params: { reference: passageKey } })
      }
    />
  );
}
