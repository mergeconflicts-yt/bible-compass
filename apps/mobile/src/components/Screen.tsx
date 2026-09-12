import { type ReactNode } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { space } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  testID?: string;
  /** Pinned above the scroll content (e.g. a compact reader header). */
  header?: ReactNode;
  /** Pinned above everything (e.g. a floating action). Positions itself. */
  floatingAction?: ReactNode;
}

/** Base screen: safe area + single-column scroll content at 20dp page padding. */
export function Screen({ children, testID, header, floatingAction }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} testID={testID}>
      {header ? (
        <View style={[styles.header, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
          {header}
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        accessibilityRole="none"
      >
        {children}
      </ScrollView>
      {floatingAction}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
  },
  content: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[8],
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
});
