/**
 * Mocks for modules that need native code under Jest. R1-C: this file
 * finally loads via the corrected `setupFilesAfterEnv` jest key (was the
 * inert `setupFilesAfterEach`).
 * - react-native-safe-area-context has no test double in this stack, so the
 *   safe-area provider/view degrade to plain pass-throughs in tests.
 * - react-native-reanimated's shipped Jest double pulls worklets native
 *   code (`loadUnpackers`), so a minimal headless double covers the exact
 *   imported surface instead (gesture physics cannot run headless anyway).
 * - expo-sqlite has no usable native implementation under Jest, so opening
 *   the app database rejects and every passage read falls back to bundled
 *   JSON — exactly today's behavior, which keeps pre-existing suites green
 *   while M03 wires the real path. `expo-crypto` keeps its real
 *   implementation (Node 22 webcrypto).
 */
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const AnimatedView = (props) => {
    const { children, ...rest } = props;
    return React.createElement(View, rest, children);
  };
  return {
    __esModule: true,
    default: { View: AnimatedView },
    View: AnimatedView,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (updater) => updater(),
    withSpring: (value) => value,
  };
});
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => {
    throw new Error('expo-sqlite unavailable under Jest: stores fall back to bundled JSON');
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    __esModule: true,
    SafeAreaProvider: (props) => props.children,
    SafeAreaView: (props) => {
      const { children, ...rest } = props;
      return React.createElement(View, rest, children);
    },
    useSafeAreaInsets: () => inset,
  };
});
