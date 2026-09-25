import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { api } from "../api/client";

const available =
  Platform.OS !== "web" &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
let registeredToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const granted = (settings: Notifications.NotificationPermissionsStatus) =>
  settings.granted ||
  settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

async function prepareAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("urgent-tasks", {
    name: "Pendientes urgentes",
    description: "Alertas de pendientes urgentes de tu servicio.",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    sound: "default",
  });
}

export async function syncUrgentNotifications(requestPermission = false) {
  if (!available) return "unavailable" as const;
  await prepareAndroidChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (!granted(permission) && requestPermission)
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
  if (!granted(permission)) return "denied" as const;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) throw new Error("La app no tiene configurado el proyecto de notificaciones.");
  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  registeredToken = result.data;
  await api("/notifications/register", "POST", {
    token: result.data,
    platform: Platform.OS,
  });
  return "enabled" as const;
}

export async function unregisterUrgentNotifications() {
  if (!registeredToken || !available) return;
  try {
    await api("/notifications/unregister", "POST", {
      token: registeredToken,
      platform: Platform.OS,
    });
  } finally {
    registeredToken = null;
  }
}
