import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// "Rest is over" alert: a scheduled local notification, so it fires even when
// the screen is off or the app is in the background.

const CHANNEL = 'rest-timer'
let ready: Promise<boolean> | null = null

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: false, shouldPlaySound: true, shouldSetBadge: false }),
})

function ensureReady() {
  ready ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Koniec przerwy',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
      })
    }
    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
  })().catch(() => false)
  return ready
}

export async function scheduleRestEnd(seconds: number, exerciseName: string): Promise<string | undefined> {
  if (!(await ensureReady()) || seconds < 1) return undefined
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Koniec przerwy', body: `Czas na kolejną serię: ${exerciseName}` },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds), channelId: CHANNEL },
  }).catch(() => undefined)
}

export function cancelRestEnd(id?: string) {
  if (id) Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
}
