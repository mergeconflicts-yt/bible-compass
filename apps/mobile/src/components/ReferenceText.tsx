import { useMemo } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { AppText } from './AppText';
import { splitReferences, type PassageContext } from '@/lib/autolink';
import type { TypeToken } from '@/theme/tokens';
import type { ThemeColors } from '@/theme/tokens';

interface ReferenceTextProps {
  text: string;
  /** Verse-relative forms resolve here; defaults to the draft passage start. */
  bookOsis?: string;
  chapter?: number;
  /** Absent = plain prose with no links (existing exact-match tests hold). */
  onOpenPassage?: (passageKey: string) => void;
  variant?: TypeToken;
  color?: keyof ThemeColors;
  scripture?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * Prose with every resolvable biblical reference tappable. Unresolvable
 * text renders untouched — never a wrong destination.
 */
export function ReferenceText({
  text,
  bookOsis,
  chapter,
  onOpenPassage,
  variant = 'body',
  color = 'textPrimary',
  scripture = false,
  style,
}: ReferenceTextProps) {
  const spans = useMemo(() => {
    if (!onOpenPassage) return null;
    const context: PassageContext | undefined =
      bookOsis !== undefined && chapter !== undefined ? { bookOsis, chapter } : undefined;
    return splitReferences(text, context);
  }, [text, bookOsis, chapter, onOpenPassage]);

  if (!spans) {
    return (
      <AppText variant={variant} color={color} scripture={scripture} style={style}>
        {text}
      </AppText>
    );
  }
  return (
    <AppText variant={variant} color={color} scripture={scripture} style={style}>
      {spans.map((span, index) =>
        span.passageKey ? (
          <AppText
            key={index}
            variant={variant}
            color="accent"
            scripture={scripture}
            onPress={onOpenPassage ? () => onOpenPassage(span.passageKey as string) : undefined}
            accessibilityRole="link"
            accessibilityLabel={`Open ${span.text}`}
            style={styles.link}
          >
            {span.text}
          </AppText>
        ) : (
          span.text
        ),
      )}
    </AppText>
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
  },
});
