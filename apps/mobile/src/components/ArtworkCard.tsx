import { StyleSheet, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

interface ArtworkCardProps {
  kicker: string;
  verse: string;
  reference: string;
  attribution: string;
  testID?: string;
}

/**
 * Verse artwork card: gradient-like brand surface with a soft horizon disc,
 * serif verse, reference and attribution. Artwork never implies ownership —
 * attribution is always inside the art — see DESIGN_SPEC.
 * (Linear gradients need a native module; the UI-1 theme pass can promote
 * this to expo-linear-gradient with owner approval. No new dependency here.)
 */
export function ArtworkCard({ kicker, verse, reference, attribution, testID }: ArtworkCardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.art, { backgroundColor: colors.brand }]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={`Verse artwork: ${reference}`}
    >
      <View style={styles.horizon} pointerEvents="none" />
      <AppText variant="label" style={[styles.kicker, { color: '#E8C97A' }]}>
        {kicker.toUpperCase()}
      </AppText>
      <AppText variant="title1" scripture style={[styles.verse, { color: colors.textOnBrand }]}>
        {verse}
      </AppText>
      <AppText variant="title3" style={[styles.ref, { color: colors.textOnBrand }]}>
        {reference}
      </AppText>
      <AppText variant="caption" style={[styles.attr, { color: colors.textOnBrand }]}>
        {attribution}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    borderRadius: radius.prominent,
    padding: space[6],
    overflow: 'hidden',
    position: 'relative',
  },
  horizon: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -90,
    height: 170,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  kicker: {
    letterSpacing: 1.5,
    position: 'relative',
    zIndex: 1,
  },
  verse: {
    marginVertical: space[3],
    position: 'relative',
    zIndex: 1,
  },
  ref: {
    position: 'relative',
    zIndex: 1,
  },
  attr: {
    marginTop: space[1],
    opacity: 0.8,
    position: 'relative',
    zIndex: 1,
  },
});
