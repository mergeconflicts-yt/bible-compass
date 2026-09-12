import { type ReactNode } from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { space } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  testID?: string;
}

/** Base screen: safe area + single-column scroll content at 20dp page padding. */
export function Screen({ children, testID }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} testID={testID}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        accessibilityRole="none"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
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
