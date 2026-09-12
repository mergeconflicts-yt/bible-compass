import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

interface NavRowProps {
  title: string;
  meta?: string;
  /** Right-aligned summary (e.g. a chapter count) shown beside the chevron. */
  aside?: string;
  /** Card look (bordered, rounded, spaced) for the library book list. */
  card?: boolean;
  onPress?: () => void;
  testID?: string;
}

/**
 * Connection-style row: serif title with supportive meta below, or a compact
 * library row with the meta inline on the right (demo/index.html book list).
 * Rows without onPress render as plain text — never a dead control.
 */
export function NavRow({ title, meta, aside, card, onPress, testID }: NavRowProps) {
  const { colors } = useTheme();
  const content = (
    <View style={styles.inner}>
      <View style={styles.text}>
        <AppText variant="title3">{title}</AppText>
        {meta && !aside ? (
          <AppText variant="metadata" color="textSecondary" style={styles.meta}>
            {meta}
          </AppText>
        ) : null}
      </View>
      {aside ? (
        <AppText variant="metadata" color="textSecondary">
          {aside}
        </AppText>
      ) : null}
      {onPress ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      ) : null}
    </View>
  );
  if (!onPress) {
    return (
      <View
        style={[
          styles.row,
          styles.static,
          card && styles.card,
          {
            borderColor: colors.border,
            backgroundColor: card ? colors.surface : 'transparent',
          },
        ]}
        testID={testID}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={aside ? `${title}, ${aside} chapters` : meta ? `${title}, ${meta}` : title}
      style={({ pressed }) => [
        styles.row,
        styles.pressable,
        card && styles.card,
        {
          borderColor: colors.border,
          backgroundColor: card ? colors.surface : 'transparent',
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: 1,
    paddingVertical: space[4],
    paddingHorizontal: space[1],
    minHeight: space[12],
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: space[4],
    marginBottom: space[2],
  },
  pressable: {},
  static: {},
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  text: {
    flex: 1,
  },
  meta: {
    marginTop: space[1],
  },
});
