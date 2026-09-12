import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { entityBySlug, roleBySlug, toBullets } from '@/content/neh2Draft';

const ENTITY_GLYPHS: Record<string, keyof typeof Ionicons.glyphMap> = {
  person: 'person-outline',
  place: 'location-outline',
  event: 'calendar-outline',
  empire: 'flag-outline',
  role: 'briefcase-outline',
  practice: 'repeat-outline',
  object: 'cube-outline',
};

/** Passage-role first sentence as chip qualifier; trimmed, never invented. */
function roleQualifier(slug: string): string | null {
  const role = roleBySlug(slug);
  if (!role) return null;
  const [first] = toBullets(role.role_in_passage);
  const sentence = (first ?? role.role_in_passage).trim();
  return sentence.length > 0 ? sentence : null;
}

/**
 * Full-card entry chip used everywhere a full card is referenced: type
 * glyph, name, short qualifier on one line. Unknown slugs render nothing
 * instead of guessing.
 */
export function EntityChip({
  slug,
  qualifier,
  onPress,
  testID,
}: {
  slug: string;
  qualifier?: string | null;
  onPress: (slug: string) => void;
  testID?: string;
}) {
  const entity = entityBySlug(slug);
  if (!entity) return null;
  const resolvedQualifier = qualifier ?? roleQualifier(slug);
  return (
    <ChipRow
      glyph={ENTITY_GLYPHS[entity.type] ?? 'layers-outline'}
      title={entity.canonical_name}
      qualifier={resolvedQualifier}
      onPress={() => onPress(slug)}
      testID={testID ?? `entity-chip-${slug}`}
    />
  );
}

/**
 * Timeline entry chip with the same visuals: clock glyph, title, date
 * qualifier. Used for time and event rows opening the timeline or an
 * event full card.
 */
export function EventChip({
  title,
  qualifier,
  onPress,
  testID,
}: {
  title: string;
  qualifier?: string | null;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <ChipRow
      glyph="time-outline"
      title={title}
      qualifier={qualifier}
      onPress={onPress}
      testID={testID}
    />
  );
}

function ChipRow({
  glyph,
  title,
  qualifier,
  onPress,
  testID,
}: {
  glyph: keyof typeof Ionicons.glyphMap;
  title: string;
  qualifier?: string | null;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={qualifier ? `${title}, ${qualifier}` : title}
      style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={glyph} size={18} color={colors.accent} />
      </View>
      <View style={styles.text}>
        <AppText variant="title3" numberOfLines={1} style={styles.name}>
          {title}
        </AppText>
        {qualifier ? (
          <AppText
            variant="metadata"
            color="textSecondary"
            numberOfLines={1}
            style={styles.qualifier}
          >
            {qualifier}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderWidth: 1,
    borderRadius: radius.prominent,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    minHeight: 44,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  name: {
    flexShrink: 1,
  },
  qualifier: {
    flex: 1,
  },
});
