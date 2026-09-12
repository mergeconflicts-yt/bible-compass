import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import {
  formatReference,
  parseReference,
  ReferenceParseError,
  type ParsedReference,
} from '@/lib/reference';

/**
 * Passage route (`/passage/Neh.2.1-Neh.2.8`). The full reader lands with the
 * reader slice (UI-5); until then this is an honest unavailable state, never
 * a dead end. Malformed deep links get a typed error, not a crash — see
 * docs/CANONICAL_IDENTIFIERS.md.
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

  const label = formatReference(parsed);
  return (
    <>
      <Stack.Screen options={{ title: label }} />
      <Screen>
        <StateView
          variant="unavailable"
          title="Passage reader is next"
          explanation={`${label} (${parsed.canonicalKey}) opens here with the reader slice: continuous Scripture, era rail and inline anchors.`}
          actionLabel="Back to Home"
          onAction={() => router.back()}
        />
      </Screen>
    </>
  );
}
