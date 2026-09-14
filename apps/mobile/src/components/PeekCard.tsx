import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { ReferenceText } from './ReferenceText';
import { entityBySlug, roleBySlug, toBullets } from '@/content/neh2Draft';

const TYPE_LABELS: Record<string, string> = {
  person: 'Person',
  place: 'Place',
  empire: 'Empire',
  role: 'Role',
  practice: 'Practice',
  object: 'Object',
};

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  person: 'person-outline',
  place: 'location-outline',
};

/** First sentence of passage prose; never invents, only trims. */
function firstSentence(text: string): string {
  const [first] = toBullets(text);
  const sentence = (first ?? text).trim();
  return sentence.length > 0 ? sentence : text.trim();
}

/** Tapped anchor bounds in window coordinates, via Text.measureInWindow. */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PeekPlacement {
  top?: number;
  bottom?: number;
  caret: 'top' | 'bottom' | null;
  caretLeft: number;
}

/** Side margin shared with the overlay bubble (space[5]). */
export const PEEK_SIDE_MARGIN = 20;

const CARET_SIZE = 16;
/** Gap between anchor and bubble edge: half caret plus breathing room. */
const ANCHOR_GAP = 14;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Pure bubble placement for the peek overlay. Mid-screen anchors get a
 * below-bubble with a top caret; low anchors get an above-bubble with a
 * bottom caret; a null rect falls back to a caretless bottom bubble.
 */
export function placementForAnchor(
  rect: AnchorRect | null,
  windowWidth: number,
  windowHeight: number,
): PeekPlacement {
  if (!rect) return { caret: null, caretLeft: 0 };
  const anchorCenter = rect.x + rect.width / 2;
  const caretLeft = clamp(
    anchorCenter - PEEK_SIDE_MARGIN - CARET_SIZE / 2,
    20,
    windowWidth - PEEK_SIDE_MARGIN * 2 - CARET_SIZE - 20,
  );
  if (rect.y > windowHeight * 0.5) {
    return { bottom: windowHeight - rect.y + ANCHOR_GAP, caret: 'bottom', caretLeft };
  }
  return { top: rect.y + rect.height + ANCHOR_GAP, caret: 'top', caretLeft };
}

/**
 * Sneak-peek popover for a tapped anchor: type, name, one sentence about
 * this passage, one way forward (Know more). It sits over the text
 * text without moving it; the parent overlay dismisses on tap-outside.
 * Unknown slugs render nothing instead of guessing.
 */
export function PeekCard({
  slug,
  onFullCard,
  onOpenPassage,
}: {
  slug: string;
  onFullCard: (slug: string) => void;
  onOpenPassage?: (passageKey: string) => void;
}) {
  const { colors } = useTheme();
  const entity = entityBySlug(slug);
  const role = roleBySlug(slug);
  if (!entity) return null;
  const typeLabel =
    TYPE_LABELS[entity.type] ?? entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
  const sentence = firstSentence(role?.role_in_passage ?? entity.short_description);
  return (
    <View
      style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID={`peek-card-${slug}`}
      accessibilityRole="dialog"
      accessibilityLabel={`${typeLabel}: ${entity.canonical_name}`}
    >
      <View style={styles.head}>
        <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
          <Ionicons
            name={TYPE_ICONS[entity.type] ?? 'layers-outline'}
            size={22}
            color={colors.accent}
          />
        </View>
        <View style={styles.headText}>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            {typeLabel.toUpperCase()}
          </AppText>
          <AppText variant="title2">{entity.canonical_name}</AppText>
        </View>
      </View>
      <ReferenceText text={sentence} onOpenPassage={onOpenPassage} variant="body" />
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.foot}>
        <Pressable
          onPress={() => onFullCard(slug)}
          testID={`peek-card-${slug}-know-more`}
          accessibilityRole="button"
          accessibilityLabel={`Know more about ${entity.canonical_name}`}
          hitSlop={8}
          style={styles.knowMore}
        >
          <AppText variant="label" color="accent">Know more ›</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderWidth: 1,
    borderRadius: radius.prominent,
    paddingHorizontal: space[5],
    paddingTop: space[5],
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  head: {
    flexDirection: 'row',
    gap: space[3],
    alignItems: 'center',
    marginBottom: space[3],
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
  },
  eyebrow: {
    letterSpacing: 1.5,
    marginBottom: space[1],
  },
  divider: {
    height: 1,
    marginTop: space[2],
    marginBottom: space[1],
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space[3],
  },
  knowMore: {
    minHeight: space[12],
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
});
