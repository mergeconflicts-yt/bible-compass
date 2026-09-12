import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { ReaderView } from '@/components/ReaderView';
import { getChapter } from '@/content/bsb';
import {
  formatReference,
  parseReference,
  ReferenceParseError,
  type ParsedReference,
} from '@/lib/reference';

/**
 * Passage reader (`/passage/Neh.2`, `/passage/Neh.2.4`,
 * `/passage/Neh.2.1-Neh.2.8`). One chapter per screen: the reader opens the
 * whole chapter containing the reference. Multi-chapter ranges get an honest
 * unavailable state. Malformed deep links get a typed error, not a crash —
 * see docs/CANONICAL_IDENTIFIERS.md.
 */
export default function PassageScreen() {
  const router = useRouter();
  const { reference } = useLocalSearchParams<{ reference: string }>();
  const raw = Array.isArray(reference) ? reference[0] : (reference ?? '');

  let parsed: ParsedReference | null = null;
  let parseError: string | null = null;
  try {
    parsed = parseReference(raw);
  } catch (error) {
    parseError =
      error instanceof ReferenceParseError ? error.message : 'That link did not work. Try again.';
  }

  if (!parsed) {
    return (
      <>
        <Stack.Screen options={{ title: 'Invalid reference' }} />
        <Screen>
          <StateView
            variant="error"
            title="We can't open that reference"
            explanation={parseError ?? 'That link did not work. Try again.'}
            actionLabel="Back to Home"
            onAction={() => router.back()}
          />
        </Screen>
      </>
    );
  }

  if (parsed.kind === 'range' && parsed.start.chapter !== parsed.end.chapter) {
    const label = formatReference(parsed);
    return (
      <>
        <Stack.Screen options={{ title: label }} />
        <Screen>
          <StateView
            variant="unavailable"
            title="One chapter at a time"
            explanation={`${label} spans more than one chapter. Open the chapter you want to start in.`}
            actionLabel="Back to Home"
            onAction={() => router.back()}
            testID="passage-unavailable"
          />
        </Screen>
      </>
    );
  }

  const content = getChapter(parsed.start.book, parsed.start.chapter);
  if (!content) {
    const label = formatReference(parsed);
    return (
      <>
        <Stack.Screen options={{ title: label }} />
        <Screen>
          <StateView
            variant="unavailable"
            title="This chapter isn't ready yet"
            explanation={`${label} has no bundled chapter text in this build.`}
            actionLabel="Read Nehemiah 2"
            onAction={() =>
              router.replace({
                pathname: '/passage/[reference]',
                params: { reference: 'Neh.2' },
              })
            }
            testID="passage-unavailable"
          />
        </Screen>
      </>
    );
  }

  const label = formatReference(parsed);
  const openPassage = (passageKey: string) => {
    router.push({ pathname: '/passage/[reference]', params: { reference: passageKey } });
  };
  return (
    <>
      <Stack.Screen options={{ title: label }} />
      <ReaderView
        bookOsis={parsed.start.book}
        chapter={parsed.start.chapter}
        onBack={() => router.back()}
        onOpenPassage={openPassage}
      />
    </>
  );
}
