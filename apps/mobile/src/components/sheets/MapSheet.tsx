import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { mapCity, mapJourney } from '@/fixtures/demo';

interface MapSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Historical map — demo #s-map. No vector-map dependency is approved yet, so
 * both views are honest schematics built from Views: hotspot chips for the
 * city circuit and an endpoint-to-endpoint sketch for the journey. Positions
 * are illustrative; uncertainty is stated in words, never implied by art.
 * (Promote to react-native-svg reviewed assets with owner approval.)
 */
export function MapSheet({ visible, onClose }: MapSheetProps) {
  const { colors } = useTheme();
  const [view, setView] = useState(0);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="Historical map"
      title={mapCity.title}
      full
      testID="map-sheet"
    >
      <AppText variant="body" color="textSecondary">
        {mapCity.subtitle}
      </AppText>
      <Segmented
        options={['The city', 'The journey']}
        selected={view}
        onSelect={setView}
        accessibilityLabel="Map view"
        testID="map-view-seg"
      />

      {view === 0 ? (
        <View testID="map-city">
          <View
            style={[styles.mapBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="image"
            accessibilityLabel="Schematic map of Jerusalem showing the Valley Gate, Dung Gate, Temple, Gihon Spring and King's Pool. Positions illustrative, not to scale."
          >
            <View style={[styles.circuit, { borderColor: colors.accent }]} />
            <View style={[styles.marker, styles.temple, { backgroundColor: colors.accentSoft }]}>
              <AppText variant="caption" color="accent">
                Temple
              </AppText>
            </View>
            <View style={styles.leftCol}>
              <MapChip label="Valley Gate" />
              <MapChip label="Dung Gate" />
            </View>
            <View style={styles.rightCol}>
              <MapChip label="Gihon Spring" />
              <MapChip label="King’s Pool" />
            </View>
          </View>
          <AppText variant="caption" color="textSecondary" style={styles.caption}>
            ● Gates named in verses 13–15 · ● Water sources · Schematic, not to scale
          </AppText>
          <AppText variant="body" scripture style={styles.body}>
            {mapCity.description}
          </AppText>
          <View
            style={[
              styles.callout,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <AppText variant="body">
              <AppText variant="label">Approximate. </AppText>
              {mapCity.uncertainty}
            </AppText>
          </View>
        </View>
      ) : (
        <View testID="map-journey">
          <View
            style={[styles.mapBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="image"
            accessibilityLabel="Schematic sketch of the journey from Susa to Jerusalem, about 1,500 kilometres. Coastlines and routes simplified, not to scale."
          >
            <View style={styles.journeyRow}>
              <View style={styles.endpoint}>
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                <AppText variant="label">Susa</AppText>
              </View>
              <View style={[styles.dashed, { borderColor: colors.accent }]} />
              <View style={styles.endpoint}>
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                <AppText variant="label">Jerusalem</AppText>
              </View>
            </View>
            <AppText variant="caption" color="textSecondary" style={styles.caption}>
              {mapJourney.distance}
            </AppText>
          </View>
          <AppText variant="body" scripture style={styles.body}>
            {mapJourney.description}
          </AppText>
          <View
            style={[
              styles.callout,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <AppText variant="body">
              <AppText variant="label">Schematic. </AppText>
              {mapJourney.uncertainty}
            </AppText>
          </View>
        </View>
      )}

      <View style={styles.action}>
        <Button title="Back to reading" onPress={onClose} testID="map-back" />
      </View>
    </Sheet>
  );
}

function MapChip({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
      <View style={[styles.chipDot, { backgroundColor: colors.accent }]} />
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  mapBox: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space[4],
    marginVertical: space[3],
    minHeight: 220,
    overflow: 'hidden',
  },
  circuit: {
    position: 'absolute',
    left: 60,
    right: 60,
    top: 30,
    bottom: 30,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 999,
  },
  temple: {
    alignSelf: 'center',
    marginTop: space[2],
  },
  marker: {
    borderRadius: space[2],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  leftCol: {
    position: 'absolute',
    left: space[3],
    top: 70,
    gap: space[4],
  },
  rightCol: {
    position: 'absolute',
    right: space[3],
    top: 90,
    gap: space[4],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[6],
  },
  endpoint: {
    alignItems: 'center',
    gap: space[1],
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dashed: {
    flex: 1,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    marginHorizontal: space[2],
  },
  caption: {
    textAlign: 'center',
    marginTop: space[2],
  },
  body: {
    marginTop: space[3],
  },
  callout: {
    borderWidth: 1,
    borderRadius: radius.button,
    padding: space[4],
    marginTop: space[3],
  },
  action: {
    marginTop: space[4],
  },
});
