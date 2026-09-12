/**
 * Mocks for modules that need native code under Jest.
 * react-native-safe-area-context has no test double in this stack, so the
 * safe-area provider/view degrade to plain pass-throughs in tests.
 */
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
