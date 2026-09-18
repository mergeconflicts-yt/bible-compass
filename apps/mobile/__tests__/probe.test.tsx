import { useEffect, useRef } from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

describe('node mock probe', () => {
  it('custom createNodeMock reaches refs', () => {
    let seen: string = 'no-ref';
    function Probe() {
      const ref = useRef<unknown>(null);
      useEffect(() => {
        const node = ref.current as { marker?: string; measureInWindow?: unknown } | null;
        seen =
          node === null
            ? 'ref-null'
            : `marker:${String((node as { marker?: unknown }).marker)} measure:${typeof node.measureInWindow}`;
      }, []);
      return (
        <Text ref={ref as never} testID="probe-text">
          hello
        </Text>
      );
    }
    render(<Probe />, {
      createNodeMock: () => ({
        marker: 'custom-mock',
        measureInWindow: (callback: (...args: number[]) => void) => callback(0, 0, 0, 0),
      }),
    });
    expect(screen.getByTestId('probe-text')).toBeTruthy();
    // eslint-disable-next-line no-console
    console.log('NODE_SURFACE:', seen);
  });
});
