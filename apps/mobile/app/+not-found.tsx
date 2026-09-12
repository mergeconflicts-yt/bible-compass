import { Stack, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <StateView
          variant="empty"
          title="This screen doesn't exist"
          explanation="The link may be old or mistyped. Home is a safe place to restart."
          actionLabel="Go to home screen"
          onAction={() => router.replace('/(tabs)/home')}
        />
      </Screen>
    </>
  );
}
