import { useRouter } from 'expo-router';
import { SearchView } from '@/components/SearchView';

/** Thin route: reference-first search wired to the canonical passage route. */
export default function SearchScreen() {
  const router = useRouter();
  return (
    <SearchView
      onOpenPassage={(passageKey) =>
        router.push({ pathname: '/passage/[reference]', params: { reference: passageKey } })
      }
    />
  );
}
