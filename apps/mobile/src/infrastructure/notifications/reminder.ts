/**
 * Local-reminder notifications adapter (mobile-install-07c).
 *
 * The only module allowed to import `expo-notifications`. Implements the
 * `ReminderScheduler` port from `content/reminderStore` plus two
 * composition-root helpers: presentation setup (handler + Android channel)
 * and tap routing (open today's daily verse). Local-only: no push tokens,
 * no server, no credentials of any kind.
 *
 * Idempotency: `scheduleDaily` cancels every scheduled notification before
 * scheduling one daily, so re-enables, restores, and retries converge on
 * exactly one 08:00 reminder per local day.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  REMINDER_COPY,
  REMINDER_PAYLOAD_KIND,
  type ReminderPermission,
  type ReminderScheduler,
} from '@/content/reminderStore';

const REMINDER_CHANNEL_ID = 'daily-verse';

/** Foreground presentation + Android channel. Called once at startup. */
export async function installReminderPresentation(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Daily verse',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

function mapPermission(granted: boolean, canAskAgain: boolean): ReminderPermission {
  if (granted) return 'granted';
  // Revoked or permanently denied: never re-prompt, direct to settings.
  if (!canAskAgain) return 'denied';
  return 'undetermined';
}

/**
 * Subscribes tap handling for reminder notifications. The callback fires
 * for the cold-start tap (if any) and every later tap; taps on anything
 * else are ignored. Returns an unsubscribe function.
 */
export function subscribeReminderResponses(onReminderTap: () => void): () => void {
  const isOurs = (response: Notifications.NotificationResponse): boolean =>
    response.notification.request.content.data?.kind === REMINDER_PAYLOAD_KIND;

  const last = Notifications.getLastNotificationResponse();
  if (last && isOurs(last)) {
    onReminderTap();
  }
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    if (isOurs(response)) onReminderTap();
  });
  return () => subscription.remove();
}

export class ExpoReminderScheduler implements ReminderScheduler {
  async getPermission(): Promise<ReminderPermission> {
    const status = await Notifications.getPermissionsAsync();
    return mapPermission(status.granted, status.canAskAgain);
  }

  async requestPermission(): Promise<ReminderPermission> {
    const status = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    return mapPermission(status.granted, status.canAskAgain);
  }

  async scheduleDaily(hour: number, minute: number): Promise<void> {
    // Cancel-then-schedule: exactly one daily survives any retry path.
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: REMINDER_COPY.title,
        body: REMINDER_COPY.body,
        data: { kind: REMINDER_PAYLOAD_KIND },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' ? { channelId: REMINDER_CHANNEL_ID } : {}),
      },
    });
  }

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}
