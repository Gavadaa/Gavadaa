import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ENABLED_KEY = "dj_notifs_enabled";
const DAILY_REMINDER_ID = "dj_daily_reminder";

export async function initNotifications() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {}
}

export async function requestNotifPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!Device.isDevice) return false;
  try {
    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== "granted") {
      const res = await Notifications.requestPermissionsAsync();
      status = res.status;
    }
    const granted = status === "granted";
    await AsyncStorage.setItem(ENABLED_KEY, granted ? "1" : "0");
    return granted;
  } catch {
    return false;
  }
}

export async function isNotifEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const v = await AsyncStorage.getItem(ENABLED_KEY);
  return v === "1";
}

export async function scheduleDailyReminder(hour = 19, minute = 0) {
  if (Platform.OS === "web") return;
  try {
    // Cancel existing
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_REMINDER_ID,
      content: {
        title: "🎧 Ta session du jour ?",
        body: "Log une session avant minuit pour continuer ton streak et compléter les défis quotidiens.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      } as any,
    });
  } catch {}
}

export async function cancelDailyReminder() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
  } catch {}
}

export async function notifyStreakWarning(streak: number) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔥 Ton streak de ${streak} jours est en danger !`,
        body: "Log une session avant minuit pour ne pas le perdre.",
        sound: true,
      },
      trigger: null as any, // immediate
    });
  } catch {}
}

export async function notifyInstant(title: string, body: string) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null as any,
    });
  } catch {}
}
