import { StyleSheet, View } from 'react-native';
import { space } from '@/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';

export type StateVariant =
  'loading' | 'empty' | 'error' | 'offline' | 'unavailable' | 'unsupported';

interface StateViewProps {
  variant: StateVariant;
  title: string;
  explanation?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

/**
 * Every loading/empty/error/offline/unavailable state: plain-language title,
 * short explanation, primary recovery action when available. Never a blank
 * region or endless spinner — see DESIGN_SPEC.md §5 (StateView).
 */
export function StateView({
  variant,
  title,
  explanation,
  actionLabel,
  onAction,
  testID,
}: StateViewProps) {
  return (
    <View
      style={styles.container}
      testID={testID ?? `state-${variant}`}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <AppText variant="title3" accessibilityRole="header">
        {title}
      </AppText>
      {explanation ? (
        <AppText variant="body" color="textSecondary" style={styles.explanation}>
          {explanation}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[6],
  },
  explanation: {
    marginTop: space[2],
    textAlign: 'center',
  },
  action: {
    marginTop: space[4],
    alignSelf: 'stretch',
  },
});
